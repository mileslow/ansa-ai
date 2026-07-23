import type { VercelRequest, VercelResponse } from "@vercel/node";
import { attachEmailConnection, consumeEmailOAuthState } from "../lib/email-agent-store";
import { NylasMailboxProvider } from "../lib/nylas-mailbox-provider";

export const config = { maxDuration: 60, includeFiles: "lib/**" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function callbackUrl() {
  const value = process.env.NYLAS_OAUTH_CALLBACK_URL;
  if (!value) throw new Error("NYLAS_OAUTH_CALLBACK_URL is not configured");
  return value;
}

function redirectLocation(path: string, result: "connected" | "error", code?: string) {
  const base = process.env.EMAIL_AGENT_UI_BASE_URL;
  const target = base ? new URL(path, base) : new URL(path, "http://callback.local");
  target.searchParams.set("gmail", result);
  if (code) target.searchParams.set("code", code);
  return base ? target.href : `${target.pathname}${target.search}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const stateValue = first(req.query.state);
  if (!stateValue) return res.status(400).json({ error: "OAuth state is required" });
  let state: Awaited<ReturnType<typeof consumeEmailOAuthState>>;
  try {
    state = await consumeEmailOAuthState(stateValue);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "OAuth state is invalid",
    });
  }
  const providerError = first(req.query.error);
  if (providerError) {
    res.statusCode = 302;
    res.setHeader("Location", redirectLocation(state.redirectAfter, "error", "consent_denied"));
    return res.end();
  }
  const code = first(req.query.code);
  if (!code) return res.status(400).json({ error: "Nylas authorization code is required" });
  try {
    const connected = await new NylasMailboxProvider().completeConnection({
      code,
      redirectUri: callbackUrl(),
    });
    await attachEmailConnection({
      ownerId: state.ownerId,
      grantId: connected.grantId,
      emailAddress: connected.emailAddress,
    });
    res.statusCode = 302;
    res.setHeader("Location", redirectLocation(state.redirectAfter, "connected"));
    return res.end();
  } catch (error) {
    console.error("Nylas OAuth callback failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    res.statusCode = 302;
    res.setHeader("Location", redirectLocation(state.redirectAfter, "error", "connection_failed"));
    return res.end();
  }
}
