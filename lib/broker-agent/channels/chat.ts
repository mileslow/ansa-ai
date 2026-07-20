import type { AgentTurn } from "../types";
import type { ChannelAdapter, NormalizedInbound } from "./types";

export function normalizeChatInbound(raw: {
  text?: string;
}): NormalizedInbound {
  const text = String(raw.text || "").trim();
  if (!text) throw new Error("Chat turn requires text");
  const turn: AgentTurn = { kind: "text", text };
  return { turn, channel: "chat" };
}

export const chatChannelAdapter: ChannelAdapter = {
  id: "chat",
  normalizeInbound: (raw) => normalizeChatInbound(raw as { text?: string }),
};
