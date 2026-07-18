import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import companyProfile from "../api/company-profile";
import generateBooklet from "../api/generate-booklet";
import parsePlan from "../api/parse-plan";
import bookletPipeline from "../api/booklet-pipeline";

type CompatibleRequest = IncomingMessage & {
  body?: unknown;
  query?: Record<string, string | string[]>;
};

type CompatibleResponse = ServerResponse & {
  status(code: number): CompatibleResponse;
  json(body: unknown): CompatibleResponse;
};

type ApiHandler = (
  request: CompatibleRequest,
  response: CompatibleResponse,
) => unknown | Promise<unknown>;

const routes = new Map<string, ApiHandler>([
  ["/api/company-profile", companyProfile as ApiHandler],
  ["/api/generate-booklet", generateBooklet as ApiHandler],
  ["/api/parse-plan", parsePlan as ApiHandler],
  ["/api/booklet-pipeline", bookletPipeline as ApiHandler],
]);

const port = Number(process.env.PORT || 8080);
const maxBodyBytes = Number(process.env.MAX_JSON_BODY_BYTES || 30 * 1024 * 1024);
const localOrigins = ["http://127.0.0.1:5173", "http://localhost:5173"];
const configuredOrigins = String(process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOriginPatterns = configuredOrigins.length
  ? configuredOrigins
  : localOrigins;

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function wildcardPattern(value: string) {
  const escaped = value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
}

function originIsAllowed(origin: string) {
  return allowedOriginPatterns.some(
    (pattern) => pattern === "*" || wildcardPattern(pattern).test(origin),
  );
}

function applyCors(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin;
  response.setHeader("Vary", "Origin");
  if (!origin) return true;
  if (!originIsAllowed(origin)) return false;
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization,Content-Type,X-Requested-With",
  );
  response.setHeader("Access-Control-Max-Age", "86400");
  response.setHeader("Access-Control-Expose-Headers", "Content-Length,Content-Type");
  return true;
}

function addResponseHelpers(response: ServerResponse): CompatibleResponse {
  const compatible = response as CompatibleResponse;
  compatible.status = (code: number) => {
    compatible.statusCode = code;
    return compatible;
  };
  compatible.json = (body: unknown) => {
    if (!compatible.headersSent)
      compatible.setHeader("Content-Type", "application/json; charset=utf-8");
    compatible.end(JSON.stringify(body));
    return compatible;
  };
  return compatible;
}

function queryFrom(url: URL) {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams) {
    const existing = query[key];
    query[key] = existing
      ? Array.isArray(existing)
        ? [...existing, value]
        : [existing, value]
      : value;
  }
  return query;
}

async function jsonBody(request: IncomingMessage) {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > maxBodyBytes)
      throw new HttpError(413, `Request body exceeds ${maxBodyBytes} bytes`);
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, rawResponse) => {
  const response = addResponseHelpers(rawResponse);
  try {
    if (!applyCors(request, response)) {
      sendJson(response, 403, { error: "Origin is not allowed" });
      return;
    }
    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      response.end();
      return;
    }

    const url = new URL(request.url || "/", "http://cloud-run.local");
    const pathname = url.pathname.length > 1
      ? url.pathname.replace(/\/+$/, "")
      : url.pathname;
    if (pathname === "/" || pathname === "/healthz") {
      sendJson(response, 200, {
        ok: true,
        service: process.env.K_SERVICE || "ansa-booklet-backend",
        revision: process.env.K_REVISION || "local",
      });
      return;
    }

    const handler = routes.get(pathname);
    if (!handler) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }
    const compatibleRequest = request as CompatibleRequest;
    compatibleRequest.query = queryFrom(url);
    compatibleRequest.body = await jsonBody(request);
    await handler(compatibleRequest, response);
  } catch (error) {
    console.error("cloud-run request failed", {
      method: request.method,
      url: request.url,
      error,
    });
    if (response.writableEnded) return;
    sendJson(
      response,
      error instanceof HttpError ? error.statusCode : 500,
      {
        error:
          error instanceof Error ? error.message : "Backend request failed",
      },
    );
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`ansa booklet backend listening on 0.0.0.0:${port}`);
});

function shutdown(signal: string) {
  console.log(`received ${signal}; closing HTTP server`);
  server.close((error) => {
    if (error) console.error("HTTP server shutdown failed", error);
    process.exit(error ? 1 : 0);
  });
  setTimeout(() => process.exit(1), 9_000).unref();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
