import type { AgentTurn, ChannelId } from "../types";

export type NormalizedInbound = {
  turn: AgentTurn;
  channel: ChannelId;
  meta?: Record<string, unknown>;
};

export type OutboundPayload = {
  text: string;
  audioUrl?: string | null;
  attachments?: Array<{ fileName: string; mimeType: string; data: Buffer }>;
  meta?: Record<string, unknown>;
};

export type ChannelAdapter = {
  id: ChannelId;
  normalizeInbound(raw: unknown): Promise<NormalizedInbound> | NormalizedInbound;
  emitOutbound?(payload: OutboundPayload): Promise<void> | void;
};
