import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  isAgentMailReceivedEvent,
  processAgentMailEvent,
  workerSecretMatches,
} from "../lib/agentmail-email-agent";

export const config = { maxDuration: 900 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  if (!workerSecretMatches(req.headers["x-agentmail-worker-secret"]))
    return res.status(401).json({ error: "Unauthorized" });
  if (!isAgentMailReceivedEvent(req.body))
    return res.status(400).json({ error: "Invalid AgentMail event" });
  try {
    const result = await processAgentMailEvent(req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error("agentmail worker failed", { error });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Email processing failed",
    });
  }
}
