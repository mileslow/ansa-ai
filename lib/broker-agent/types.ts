import type { BlockerQuestion } from "../booklet-types";

export type ChannelId = "chat" | "email" | "voice";

export type AgentTurnKind = "text" | "voice_transcript";

export type BookletPreferences = {
  tone?: string;
  includeSections?: string[];
  omitSections?: string[];
  appendix?: boolean;
  brandingNotes?: string;
  extraInstructions?: string;
};

export type PendingEmailSend = {
  id: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  runId: string;
  pdfStoragePath: string;
  createdAt: string;
};

export type AgentSession = {
  id: string;
  ownerId: string;
  companyId: string;
  bookletThreadId: string;
  bookletRunId?: string | null;
  channel: ChannelId;
  mailboxConnectionIds: string[];
  preferences: BookletPreferences;
  pendingEmailSend?: PendingEmailSend | null;
  status: "open" | "processing" | "blocked" | "complete" | "failed";
  createdAt: string;
  updatedAt: string;
};

export type AgentTurn = {
  kind: AgentTurnKind;
  text: string;
  audioBase64?: string;
  mimeType?: string;
};

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ToolResult = {
  toolCallId: string;
  name: string;
  ok: boolean;
  result: unknown;
  error?: string;
};

export type RuntimeEvent =
  | { type: "assistant_delta"; text: string }
  | { type: "assistant_message"; text: string }
  | { type: "tool_start"; name: string; arguments: Record<string, unknown> }
  | { type: "tool_result"; name: string; ok: boolean; result: unknown }
  | { type: "awaiting_confirmation"; pendingEmailSend: PendingEmailSend }
  | { type: "run_status"; runId: string; status: string; questions?: BlockerQuestion[] }
  | { type: "pdf_ready"; runId: string; pdfUrl?: string | null; pdfStoragePath?: string | null }
  | { type: "audio_url"; audioUrl: string }
  | { type: "error"; message: string }
  | { type: "done"; sessionId: string };

export type HandleTurnInput = {
  session: AgentSession;
  turn: AgentTurn;
  channel: ChannelId;
  /** Opaque channel metadata (e.g. AgentMail message ids). */
  channelMeta?: Record<string, unknown>;
  onEvent?: (event: RuntimeEvent) => void | Promise<void>;
  /** Cap LLM tool iterations. */
  maxToolRounds?: number;
  /** Company display name for proactive source search (employer context). */
  companyDisplayName?: string;
};

export type HandleTurnResult = {
  session: AgentSession;
  assistantText: string;
  events: RuntimeEvent[];
  audioUrl?: string | null;
};
