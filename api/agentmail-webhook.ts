import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Webhook } from "svix";
import {
  isAgentMailReceivedEvent,
  queueAgentMailEvent,
} from "../lib/agentmail-email-agent";

export const config = {
  api: { bodyParser: false },
  maxDuration: 15,
};

type RawRequest = VercelRequest & { rawBody?: Buffer };

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function rawRequestBody(req: RawRequest) {
  if (req.rawBody) return req.rawBody;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: RawRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
  if (!secret)
    return res.status(503).json({ error: "AgentMail webhook is not configured" });
  const headers = {
    "svix-id": firstHeader(req.headers["svix-id"]),
    "svix-timestamp": firstHeader(req.headers["svix-timestamp"]),
    "svix-signature": firstHeader(req.headers["svix-signature"]),
  };
  if (!headers["svix-id"] || !headers["svix-timestamp"] || !headers["svix-signature"])
    return res.status(401).json({ error: "Missing webhook signature" });
  const rawBody = await rawRequestBody(req);
  let event: unknown;
  try {
    event = new Webhook(secret).verify(rawBody.toString("utf8"), headers);
  } catch (error) {
    console.error("agentmail webhook signature rejected", { error });
    return res.status(401).json({ error: "Invalid webhook signature" });
  }
  if (!isAgentMailReceivedEvent(event))
    return res.status(202).json({ ok: true, ignored: true });
  try {
    const queued = await queueAgentMailEvent(event);
    return res.status(202).json({ ok: true, status: queued.status });
  } catch (error) {
    console.error("agentmail webhook queue failed", { error });
    return res.status(500).json({ error: "Could not queue email" });
  }
}
