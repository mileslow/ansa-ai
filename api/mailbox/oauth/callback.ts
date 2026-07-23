import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  assertMailboxOAuthEnabled,
  encryptSecret,
  exchangeGmailCode,
  exchangeOutlookCode,
  fetchGmailProfileEmail,
  fetchOutlookProfileEmail,
  parseOAuthState,
  saveMailboxConnection,
} from "../../../lib/broker-agent";

export const config = { includeFiles: "lib/**" };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    assertMailboxOAuthEnabled();
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code || !state) {
      res.status(400).send("Missing code or state");
      return;
    }
    const parsed = parseOAuthState(state);
    const now = new Date().toISOString();
    if (parsed.provider === "gmail") {
      const tokens = await exchangeGmailCode(code);
      if (!tokens.refresh_token)
        throw new Error("Gmail did not return a refresh token; revoke access and retry");
      const email = await fetchGmailProfileEmail(tokens.access_token);
      const connection = await saveMailboxConnection({
        ownerId: parsed.ownerId,
        provider: "gmail",
        email,
        status: "active",
        accessTokenEnc: encryptSecret(tokens.access_token),
        refreshTokenEnc: encryptSecret(tokens.refresh_token),
        expiresAt: new Date(
          Date.now() + (tokens.expires_in || 3600) * 1000,
        ).toISOString(),
        scopes: (tokens.scope || "").split(" ").filter(Boolean),
        createdAt: now,
        updatedAt: now,
      });
      try {
        const { isBrokerAssistantEmailEnabled } = await import(
          "../../../lib/broker-agent/flags"
        );
        if (isBrokerAssistantEmailEnabled()) {
          const { saveAssistantSettings, ensureGmailWatchForOwner } = await import(
            "../../../lib/broker-assistant"
          );
          await saveAssistantSettings({
            ownerId: parsed.ownerId,
            gmailConnectionId: connection.id,
            gmailEmail: email,
            enabled: true,
            paused: false,
          });
          await ensureGmailWatchForOwner(parsed.ownerId);
        }
      } catch (watchError) {
        console.error("assistant watch setup after oauth failed", { watchError });
      }
    } else {
      const tokens = await exchangeOutlookCode(code);
      if (!tokens.refresh_token)
        throw new Error("Outlook did not return a refresh token; reconnect and retry");
      const email = await fetchOutlookProfileEmail(tokens.access_token);
      await saveMailboxConnection({
        ownerId: parsed.ownerId,
        provider: "outlook",
        email,
        status: "active",
        accessTokenEnc: encryptSecret(tokens.access_token),
        refreshTokenEnc: encryptSecret(tokens.refresh_token),
        expiresAt: new Date(
          Date.now() + (tokens.expires_in || 3600) * 1000,
        ).toISOString(),
        scopes: (tokens.scope || "").split(" ").filter(Boolean),
        createdAt: now,
        updatedAt: now,
      });
    }
    const redirectBase = parsed.returnTo || "/";
    const joiner = redirectBase.includes("?") ? "&" : "?";
    const redirect =
      parsed.provider === "gmail"
        ? `${redirectBase}${joiner}assistant=connected`
        : redirectBase;
    res.statusCode = 302;
    res.setHeader("Location", redirect);
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth callback failed";
    console.error("mailbox oauth callback failed", { error });
    res.status(500).send(message);
  }
}
