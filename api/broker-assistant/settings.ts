import type { VercelRequest, VercelResponse } from "@vercel/node";
import { BookletAuthError, requireBookletUser } from "../../lib/booklet-auth";
import { listActiveMailboxConnections } from "../../lib/broker-agent/sources/mailbox-tokens";
import { isMailboxOAuthEnabled } from "../../lib/broker-agent/flags";
import {
  assertBrokerAssistantEnabled,
  ensureGmailWatchForOwner,
  getAssistantSettings,
  getOwnerGmailConnection,
  saveAssistantSettings,
  stopGmailWatch,
} from "../../lib/broker-assistant";

export const config = { includeFiles: "lib/**" };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    assertBrokerAssistantEnabled();
    const user = await requireBookletUser(req);

    if (req.method === "GET") {
      const settings = await getAssistantSettings(user.uid);
      const connections = isMailboxOAuthEnabled()
        ? await listActiveMailboxConnections(user.uid, "gmail")
        : [];
      return res.status(200).json({
        settings: settings || {
          ownerId: user.uid,
          enabled: false,
          paused: false,
          allowedCompanyIds: [],
        },
        gmailConnections: connections.map((c) => ({
          id: c.id,
          email: c.email || null,
          status: c.status,
        })),
      });
    }

    if (req.method === "POST") {
      const body = (req.body || {}) as Record<string, unknown>;
      const action = String(body.action || "save");

      if (action === "enable_watch") {
        const settings = await ensureGmailWatchForOwner(user.uid);
        return res.status(200).json({ settings });
      }

      if (action === "pause" || action === "resume") {
        const settings = await saveAssistantSettings({
          ownerId: user.uid,
          paused: action === "pause",
          enabled: true,
        });
        return res.status(200).json({ settings });
      }

      if (action === "disable") {
        const existing = await getAssistantSettings(user.uid);
        if (existing?.gmailConnectionId) {
          try {
            const conn = await getOwnerGmailConnection(
              user.uid,
              existing.gmailConnectionId,
            );
            await stopGmailWatch(conn);
          } catch (error) {
            console.error("stop gmail watch failed", { error });
          }
        }
        const settings = await saveAssistantSettings({
          ownerId: user.uid,
          enabled: false,
          paused: true,
        });
        return res.status(200).json({ settings });
      }

      const settings = await saveAssistantSettings({
        ownerId: user.uid,
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        paused: typeof body.paused === "boolean" ? body.paused : undefined,
        brokerDisplayName: body.brokerDisplayName
          ? String(body.brokerDisplayName)
          : undefined,
        allowedCompanyIds: Array.isArray(body.allowedCompanyIds)
          ? body.allowedCompanyIds.map(String)
          : undefined,
        gmailConnectionId: body.gmailConnectionId
          ? String(body.gmailConnectionId)
          : undefined,
        gmailEmail: body.gmailEmail ? String(body.gmailEmail) : undefined,
      });
      return res.status(200).json({ settings });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (error instanceof BookletAuthError)
      return res.status(error.statusCode).json({ error: error.message });
    const message = error instanceof Error ? error.message : "Assistant settings failed";
    console.error("broker assistant settings failed", { error });
    return res.status(500).json({ error: message });
  }
}
