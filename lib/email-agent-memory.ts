import {
  deleteSenderMemory,
  getAllowedSender,
  listSenderMemories,
  putSenderMemory,
  writeEmailMemoryToolRun,
} from "./email-agent-store";
import {
  normalizeEmailAddress,
  stripQuotedEmailText,
} from "./email-agent-security";
import type {
  EmailSenderMemory,
  MailboxMessage,
  MailboxProvider,
} from "./email-agent-types";

const MEMORY_CATEGORIES = [
  "identity",
  "preference",
  "project",
  "relationship",
  "other",
] as const;

const MEMORY_TOOL_NAMES = new Set([
  "remember_sender_fact",
  "forget_sender_fact",
  "search_sender_memory",
  "search_past_conversations",
]);

export type EmailMemoryToolCall = {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
};

export type EmailMemoryToolContext = {
  ownerId: string;
  connectionId: string;
  senderId: string;
  senderEmail: string;
  mailboxEmail: string;
  grantId: string;
  inboundMessageId: string;
  provider: MailboxProvider;
};

export type EmailMemoryToolDependencies = {
  getAllowedSender: typeof getAllowedSender;
  listSenderMemories: typeof listSenderMemories;
  putSenderMemory: typeof putSenderMemory;
  deleteSenderMemory: typeof deleteSenderMemory;
  writeEmailMemoryToolRun: typeof writeEmailMemoryToolRun;
};

const defaultDependencies: EmailMemoryToolDependencies = {
  getAllowedSender,
  listSenderMemories,
  putSenderMemory,
  deleteSenderMemory,
  writeEmailMemoryToolRun,
};

const personEmailProperty = {
  type: "string",
  description: "The exact email address of the person whose memory or conversation history is being accessed. This must be the current authorized sender.",
};

export function openAiEmailMemoryTools() {
  return [
    {
      type: "function" as const,
      name: "remember_sender_fact",
      description: "Save one stable, useful fact or preference for the current authorized sender so it can be recalled in later email threads. Use only for facts the sender explicitly asks you to remember or clearly provides for future usefulness. Never store passwords, credentials, authentication codes, financial account numbers, or government identifiers.",
      parameters: {
        type: "object",
        properties: {
          person_email: personEmailProperty,
          key: {
            type: "string",
            description: "A short stable label such as preferred_name, timezone, writing_style, or current_project.",
          },
          value: {
            type: "string",
            description: "The concise fact to remember, without unrelated email content.",
          },
          category: {
            type: "string",
            enum: [...MEMORY_CATEGORIES],
          },
        },
        required: ["person_email", "key", "value", "category"],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: "function" as const,
      name: "forget_sender_fact",
      description: "Delete one saved fact for the current authorized sender when they ask Ansa to forget it.",
      parameters: {
        type: "object",
        properties: {
          person_email: personEmailProperty,
          key: {
            type: "string",
            description: "The exact memory key to forget.",
          },
        },
        required: ["person_email", "key"],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: "function" as const,
      name: "search_sender_memory",
      description: "Search durable facts saved for the current authorized sender. Use when their request depends on a preference, identity detail, project, or other fact from an earlier email thread.",
      parameters: {
        type: "object",
        properties: {
          person_email: personEmailProperty,
          query: {
            type: "string",
            description: "A few plain-language terms describing the fact to recall, such as preferred name or constellation. Do not include request IDs, test tokens, or the sender email. Use an empty string to list recent saved facts.",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 10,
          },
        },
        required: ["person_email", "query", "limit"],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: "function" as const,
      name: "search_past_conversations",
      description: "Search prior one-to-one emails between the connected mailbox and the current authorized sender, including other threads. Use when the sender asks what was discussed, decided, promised, or shared in past conversations.",
      parameters: {
        type: "object",
        properties: {
          person_email: personEmailProperty,
          query: {
            type: "string",
            description: "Plain-language search terms. Use an empty string for the most recent one-to-one messages.",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 10,
          },
        },
        required: ["person_email", "query", "limit"],
        additionalProperties: false,
      },
      strict: true,
    },
  ];
}

export function emailMemoryFunctionCalls(response: { output?: unknown[] }) {
  return (Array.isArray(response.output) ? response.output : [])
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .filter((item) => item.type === "function_call" && MEMORY_TOOL_NAMES.has(String(item.name || "")))
    .map((item) => ({
      type: "function_call" as const,
      call_id: String(item.call_id || ""),
      name: String(item.name || ""),
      arguments: String(item.arguments || "{}"),
    }))
    .filter((item) => item.call_id);
}

function boundedText(value: unknown, maximum: number) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function normalizedMemoryKey(value: unknown) {
  const key = boundedText(value, 80).toLowerCase();
  if (!/^[a-z0-9][a-z0-9 _.-]{1,79}$/.test(key))
    throw new Error("Memory keys must be 2-80 plain characters");
  return key.replace(/\s+/g, "_");
}

function boundedLimit(value: unknown) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? Math.min(10, Math.max(1, parsed)) : 5;
}

function safeMemoryValue(value: unknown) {
  const text = boundedText(value, 500);
  if (!text) throw new Error("The memory value is empty");
  if (/(?:password|passcode|one[- ]?time code|otp|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|private[_ -]?key|social security|\bssn\b|credit card|bank account)/i.test(text))
    throw new Error("Sensitive credentials and financial or government identifiers cannot be saved in sender memory");
  return text;
}

function memoryMatchScore(memory: EmailSenderMemory, query: string) {
  const terms = query.toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2)
    .filter((term) => !new Set([
      "about", "address", "asked", "email", "exact", "memory", "remember",
      "remembered", "sender", "test", "that", "this", "what", "with",
    ]).has(term));
  if (!terms.length) return 1;
  const haystack = `${memory.key} ${memory.value} ${memory.category}`.toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function exactOneToOneMessage(
  message: MailboxMessage,
  mailboxEmail: string,
  senderEmail: string,
) {
  const mailbox = normalizeEmailAddress(mailboxEmail);
  const sender = normalizeEmailAddress(senderEmail);
  const participants = [...message.from, ...message.to, ...message.cc]
    .map((address) => {
      try {
        return normalizeEmailAddress(address.email);
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  const distinct = new Set(participants);
  return distinct.has(mailbox) && distinct.has(sender) &&
    [...distinct].every((address) => address === mailbox || address === sender);
}

function conversationMatches(message: MailboxMessage, query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = `${message.subject} ${stripQuotedEmailText(message.body || message.snippet)}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function parseArguments(call: EmailMemoryToolCall) {
  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(call.arguments);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    parsed = value as Record<string, unknown>;
  } catch {
    throw new Error("The memory tool arguments were not valid JSON");
  }
  return parsed;
}

function functionOutput(callId: string, value: unknown) {
  return {
    type: "function_call_output" as const,
    call_id: callId,
    output: JSON.stringify(value),
  };
}

export async function executeEmailMemoryToolCall(
  call: EmailMemoryToolCall,
  context: EmailMemoryToolContext,
  dependencyOverrides: Partial<EmailMemoryToolDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  let status = "complete";
  let resultCount = 0;
  try {
    const args = parseArguments(call);
    const requestedEmail = normalizeEmailAddress(String(args.person_email || ""));
    const senderEmail = normalizeEmailAddress(context.senderEmail);
    if (requestedEmail !== senderEmail) {
      status = "scope_denied";
      return functionOutput(call.call_id, {
        ok: false,
        error: "This tool can only access memory and conversations for the current authorized sender.",
      });
    }
    const allowed = await dependencies.getAllowedSender(context.connectionId, senderEmail);
    if (!allowed?.enabled || allowed.id !== context.senderId) {
      status = "authorization_revoked";
      return functionOutput(call.call_id, {
        ok: false,
        error: "Sender authorization is no longer active.",
      });
    }

    if (call.name === "remember_sender_fact") {
      const category = String(args.category || "");
      if (!MEMORY_CATEGORIES.includes(category as typeof MEMORY_CATEGORIES[number]))
        throw new Error("The memory category is invalid");
      const memory = await dependencies.putSenderMemory({
        ownerId: context.ownerId,
        connectionId: context.connectionId,
        senderId: context.senderId,
        senderEmail,
        key: normalizedMemoryKey(args.key),
        value: safeMemoryValue(args.value),
        category: category as EmailSenderMemory["category"],
        sourceMessageId: context.inboundMessageId,
      });
      resultCount = 1;
      return functionOutput(call.call_id, {
        ok: true,
        saved: { key: memory.key, value: memory.value, category: memory.category },
      });
    }

    if (call.name === "forget_sender_fact") {
      const deleted = await dependencies.deleteSenderMemory(
        context.connectionId,
        context.senderId,
        normalizedMemoryKey(args.key),
      );
      resultCount = deleted ? 1 : 0;
      return functionOutput(call.call_id, { ok: true, deleted });
    }

    if (call.name === "search_sender_memory") {
      const query = boundedText(args.query, 200);
      const limit = boundedLimit(args.limit);
      const allMemories = (await dependencies.listSenderMemories(
        context.connectionId,
        context.senderId,
        100,
      ))
        .filter((memory) => memory.senderEmail === senderEmail);
      const memories = allMemories
        .map((memory) => ({ memory, score: memoryMatchScore(memory, query) }))
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score ||
          right.memory.updatedAt.localeCompare(left.memory.updatedAt))
        .slice(0, limit)
        .map(({ memory: { key, value, category, updatedAt } }) => ({
          key,
          value,
          category,
          updatedAt,
        }));
      const recentMemories = memories.length ? [] : allMemories
        .slice(0, Math.min(5, limit))
        .map(({ key, value, category, updatedAt }) => ({ key, value, category, updatedAt }));
      resultCount = memories.length;
      return functionOutput(call.call_id, {
        ok: true,
        memories,
        recent_memories_if_query_was_too_narrow: recentMemories,
      });
    }

    if (call.name === "search_past_conversations") {
      if (!context.provider.searchMessages)
        throw new Error("The mailbox provider does not support conversation search");
      const query = boundedText(args.query, 200);
      const limit = boundedLimit(args.limit);
      const messages = (await context.provider.searchMessages(context.grantId, {
        participantEmail: senderEmail,
        query,
        limit: Math.min(30, Math.max(10, limit * 3)),
      }))
        .filter((message) => message.id !== context.inboundMessageId)
        .filter((message) => exactOneToOneMessage(message, context.mailboxEmail, senderEmail))
        .filter((message) => conversationMatches(message, query))
        .sort((left, right) => right.date - left.date)
        .slice(0, limit)
        .map((message) => ({
          date: new Date(message.date * 1000).toISOString(),
          direction: normalizeEmailAddress(message.from[0]?.email || "") === senderEmail
            ? "from_sender"
            : "from_connected_mailbox",
          subject: boundedText(message.subject, 300),
          excerpt: boundedText(stripQuotedEmailText(message.body || message.snippet), 1_500),
        }));
      resultCount = messages.length;
      return functionOutput(call.call_id, { ok: true, conversations: messages });
    }

    throw new Error("Unsupported memory tool");
  } catch (error) {
    status = "failed";
    return functionOutput(call.call_id, {
      ok: false,
      error: error instanceof Error ? error.message : "Memory tool failed",
    });
  } finally {
    await dependencies.writeEmailMemoryToolRun({
      ownerId: context.ownerId,
      connectionId: context.connectionId,
      inboundMessageId: context.inboundMessageId,
      senderEmail: context.senderEmail,
      toolCallId: call.call_id,
      toolName: call.name,
      status,
      resultCount,
    });
  }
}
