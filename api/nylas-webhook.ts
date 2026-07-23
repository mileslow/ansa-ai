import { gunzipSync } from "node:zlib";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  parseNylasWebhookEvent,
  verifyNylasWebhookSignature,
} from "../lib/email-agent-security";
import { queueNylasEvent } from "../lib/nylas-email-agent";

export const config = { api: { bodyParser: false }, maxDuration: 15, includeFiles: "lib/**" };

type RawRequest = VercelRequest & { rawBody?: Buffer };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function rawRequestBody(req: RawRequest) {
  if (req.rawBody) return req.rawBody;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1024 * 1024) throw new Error("Webhook payload exceeds 1 MiB");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: RawRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const challenge = first(req.query.challenge);
    if (!challenge) return res.status(400).json({ error: "Webhook challenge is required" });
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Length", String(Buffer.byteLength(challenge)));
    return res.end(challenge);
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const secret = process.env.NYLAS_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: "Nylas webhook is not configured" });
  const signature = first(req.headers["x-nylas-signature"]);
  if (!signature) return res.status(401).json({ error: "Missing webhook signature" });
  try {
    const rawBody = await rawRequestBody(req);
    if (!verifyNylasWebhookSignature(rawBody, signature, secret))
      return res.status(401).json({ error: "Invalid webhook signature" });
    const encoding = first(req.headers["content-encoding"])?.toLowerCase();
    const jsonBody = encoding === "gzip" ? gunzipSync(rawBody) : rawBody;
    if (encoding && encoding !== "identity" && encoding !== "gzip")
      return res.status(415).json({ error: "Unsupported webhook encoding" });
    const event = parseNylasWebhookEvent(JSON.parse(jsonBody.toString("utf8")));
    if (!event) return res.status(200).json({ ok: true, ignored: true });
    const queued = await queueNylasEvent(event);
    return res.status(200).json({ ok: true, status: queued.status });
  } catch (error) {
    console.error("Nylas webhook processing failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return res.status(500).json({ error: "Could not queue Nylas event" });
  }
}
