/**
 * AgentMail channel adapter — maps inbound email into broker-agent sessions.
 * Booklet email processing remains imperative for parity; shared tools live in
 * lib/broker-agent/tools. Chat/voice use handleTurn LLM tool loop.
 */
import type { ChannelAdapter, NormalizedInbound } from "./types";

export function normalizeEmailInbound(raw: {
  subject?: string;
  body?: string;
}): NormalizedInbound {
  const subject = String(raw.subject || "").trim();
  const body = String(raw.body || "").trim();
  const text = [subject ? `Subject: ${subject}` : "", body].filter(Boolean).join("\n\n");
  if (!text) throw new Error("Email turn requires subject or body");
  return {
    turn: { kind: "text", text },
    channel: "email",
    meta: { subject },
  };
}

export const emailChannelAdapter: ChannelAdapter = {
  id: "email",
  normalizeInbound: (raw) =>
    normalizeEmailInbound(raw as { subject?: string; body?: string }),
};
