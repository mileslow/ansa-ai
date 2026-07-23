import type { VercelRequest, VercelResponse } from "@vercel/node";
import { timingSafeEqual } from "node:crypto";
import { processOwnerHistory } from "../../lib/broker-assistant";
import { isBrokerAssistantEmailEnabled } from "../../lib/broker-agent/flags";

export const config = { maxDuration: 300, includeFiles: "lib/**" };

function workerSecretMatches(value: string | string[] | undefined) {
  const expected = (process.env.BROKER_ASSISTANT_WORKER_SECRET || "").trim();
  const supplied = (Array.isArray(value) ? value[0] || "" : value || "").trim();
  if (!expected || expected.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  if (!isBrokerAssistantEmailEnabled())
    return res.status(503).json({ error: "Broker assistant is disabled" });
  if (!workerSecretMatches(req.headers["x-broker-assistant-worker-secret"]))
    return res.status(401).json({ error: "Unauthorized" });

  try {
    const body = (req.body || {}) as { ownerId?: string; historyId?: string };
    if (!body.ownerId) return res.status(400).json({ error: "ownerId is required" });
    const result = await processOwnerHistory(body.ownerId, body.historyId);
    return res.status(200).json(result);
  } catch (error) {
    console.error("broker assistant worker failed", { error });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Worker failed",
    });
  }
}
