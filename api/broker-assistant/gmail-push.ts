import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  findOwnerIdByGmailAddress,
  queueAssistantHistoryJob,
} from "../../lib/broker-assistant";
import { isBrokerAssistantEmailEnabled } from "../../lib/broker-agent/flags";

export const config = { maxDuration: 30, includeFiles: "lib/**" };

/**
 * Gmail Pub/Sub push endpoint.
 * Configure the subscription to push JSON with message.data = base64(emailAddress/historyId).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  if (!isBrokerAssistantEmailEnabled())
    return res.status(503).json({ error: "Broker assistant is disabled" });

  try {
    const envelope = req.body as {
      message?: { data?: string; messageId?: string };
      emailAddress?: string;
      historyId?: string;
    };

    let emailAddress = envelope.emailAddress;
    let historyId = envelope.historyId;

    if (envelope.message?.data) {
      const decoded = JSON.parse(
        Buffer.from(envelope.message.data, "base64").toString("utf8"),
      ) as { emailAddress?: string; historyId?: string };
      emailAddress = decoded.emailAddress || emailAddress;
      historyId = decoded.historyId || historyId;
    }

    if (!emailAddress)
      return res.status(202).json({ ok: true, ignored: true, reason: "no emailAddress" });

    const ownerId = await findOwnerIdByGmailAddress(emailAddress);
    if (!ownerId)
      return res.status(202).json({ ok: true, ignored: true, reason: "unknown mailbox" });

    const queued = await queueAssistantHistoryJob(ownerId, historyId);
    return res.status(202).json({ ok: true, ownerId, status: queued.status });
  } catch (error) {
    console.error("gmail push failed", { error });
    return res.status(500).json({ error: "Push handling failed" });
  }
}
