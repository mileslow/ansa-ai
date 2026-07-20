import type { VercelRequest, VercelResponse } from "@vercel/node";
import { BookletAuthError, requireBookletUser } from "../../../lib/booklet-auth";
import {
  assertMailboxOAuthEnabled,
  buildOAuthState,
  gmailAuthUrl,
  outlookAuthUrl,
} from "../../../lib/broker-agent";

export const config = { includeFiles: "lib/**" };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    assertMailboxOAuthEnabled();
    const user = await requireBookletUser(req);
    const provider = String(
      (req.method === "GET" ? req.query.provider : (req.body as { provider?: string })?.provider) ||
        "",
    );
    if (provider !== "gmail" && provider !== "outlook") {
      res.status(400).json({ error: "provider must be gmail or outlook" });
      return;
    }
    const returnTo =
      req.method === "GET"
        ? String(req.query.returnTo || "")
        : String((req.body as { returnTo?: string })?.returnTo || "");
    const state = buildOAuthState({
      ownerId: user.uid,
      provider,
      ...(returnTo ? { returnTo } : {}),
    });
    const url = provider === "gmail" ? gmailAuthUrl(state) : outlookAuthUrl(state);
    res.status(200).json({ url, provider });
  } catch (error) {
    if (error instanceof BookletAuthError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "OAuth start failed";
    res.status(500).json({ error: message });
  }
}
