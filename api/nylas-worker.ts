import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseNylasWebhookEvent } from "../lib/email-agent-security";
import {
  emailAgentWorkerSecretMatches,
  processNylasEvent,
} from "../lib/nylas-email-agent";

export const config = { maxDuration: 900, includeFiles: "lib/**" };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!emailAgentWorkerSecretMatches(req.headers["x-email-agent-worker-secret"]))
    return res.status(401).json({ error: "Unauthorized" });
  const event = parseNylasWebhookEvent(req.body);
  if (!event) return res.status(400).json({ error: "Invalid Nylas event" });
  try {
    return res.status(200).json(await processNylasEvent(event));
  } catch (error) {
    console.error("Nylas email worker failed", {
      eventId: event.id,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return res.status(500).json({ error: "Email processing failed" });
  }
}
