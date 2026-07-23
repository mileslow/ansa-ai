import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  executeEmailMemoryToolCall,
  openAiEmailMemoryTools,
  type EmailMemoryToolCall,
  type EmailMemoryToolContext,
  type EmailMemoryToolDependencies,
} from "../lib/email-agent-memory";
import { createModelResponse } from "../lib/nylas-email-agent";
import type {
  EmailSenderMemory,
  MailboxMessage,
  MailboxProvider,
} from "../lib/email-agent-types";

const senderEmail = "person@example.com";

function message(input: Partial<MailboxMessage> & Pick<MailboxMessage, "id">): MailboxMessage {
  return {
    id: input.id,
    grantId: "grant-1",
    threadId: input.threadId || "thread-old",
    subject: input.subject || "Project Phoenix",
    body: input.body || "The Phoenix launch date is Friday.",
    snippet: input.snippet || "",
    date: input.date || 1_800_000_000,
    from: input.from || [{ email: senderEmail }],
    to: input.to || [{ email: "agent@example.com" }],
    cc: input.cc || [],
    headers: input.headers || [],
  };
}

function memory(input: Partial<EmailSenderMemory> = {}): EmailSenderMemory {
  return {
    id: "memory-1",
    ownerId: "owner-1",
    connectionId: "connection-1",
    senderId: "sender-1",
    senderEmail,
    key: "preferred_name",
    value: "Call me Sam",
    category: "identity",
    sourceMessageId: "message-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...input,
  };
}

function call(name: string, args: Record<string, unknown>): EmailMemoryToolCall {
  return {
    type: "function_call",
    call_id: `call-${name}`,
    name,
    arguments: JSON.stringify(args),
  };
}

function outputValue(result: Awaited<ReturnType<typeof executeEmailMemoryToolCall>>) {
  return JSON.parse(result.output);
}

describe("email-agent sender memory tools", () => {
  let provider: MailboxProvider;
  let context: EmailMemoryToolContext;
  let dependencies: EmailMemoryToolDependencies;

  beforeEach(() => {
    provider = {
      createGoogleConnectUrl: vi.fn(),
      completeConnection: vi.fn(),
      getMessage: vi.fn(),
      getThread: vi.fn(),
      searchMessages: vi.fn(async () => []),
      reply: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as MailboxProvider;
    context = {
      ownerId: "owner-1",
      connectionId: "connection-1",
      senderId: "sender-1",
      senderEmail,
      mailboxEmail: "agent@example.com",
      grantId: "grant-1",
      inboundMessageId: "message-current",
      provider,
    };
    dependencies = {
      getAllowedSender: vi.fn(async () => ({
        id: "sender-1",
        normalizedEmail: senderEmail,
        displayEmail: senderEmail,
        enabled: true,
        createdBy: "owner-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })),
      listSenderMemories: vi.fn(async () => []),
      putSenderMemory: vi.fn(async (input) => memory({
        key: input.key,
        value: input.value,
        category: input.category,
      })),
      deleteSenderMemory: vi.fn(async () => true),
      writeEmailMemoryToolRun: vi.fn(async () => undefined),
    };
  });

  it("declares four strict Responses API function tools", () => {
    const tools = openAiEmailMemoryTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      "remember_sender_fact",
      "forget_sender_fact",
      "search_sender_memory",
      "search_past_conversations",
    ]);
    expect(tools.every((tool) => tool.type === "function" && tool.strict)).toBe(true);
    expect(tools.every((tool) => tool.parameters.additionalProperties === false)).toBe(true);
  });

  it("saves a durable fact only inside the current sender scope", async () => {
    const result = await executeEmailMemoryToolCall(call("remember_sender_fact", {
      person_email: "Person@Example.com",
      key: "Preferred Name",
      value: "Call me Sam",
      category: "identity",
    }), context, dependencies);
    expect(outputValue(result)).toMatchObject({ ok: true, saved: { key: "preferred_name" } });
    expect(dependencies.putSenderMemory).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: "connection-1",
      senderId: "sender-1",
      senderEmail,
      key: "preferred_name",
      value: "Call me Sam",
    }));
    expect(dependencies.writeEmailMemoryToolRun).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: "remember_sender_fact", status: "complete" }),
    );
  });

  it("denies cross-address access before any memory or mailbox lookup", async () => {
    const result = await executeEmailMemoryToolCall(call("search_past_conversations", {
      person_email: "someone-else@example.com",
      query: "contract",
      limit: 5,
    }), context, dependencies);
    expect(outputValue(result)).toMatchObject({ ok: false });
    expect(dependencies.getAllowedSender).not.toHaveBeenCalled();
    expect(provider.searchMessages).not.toHaveBeenCalled();
    expect(dependencies.listSenderMemories).not.toHaveBeenCalled();
    expect(dependencies.writeEmailMemoryToolRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "scope_denied" }),
    );
  });

  it("rejects credentials instead of persisting them", async () => {
    const result = await executeEmailMemoryToolCall(call("remember_sender_fact", {
      person_email: senderEmail,
      key: "api key",
      value: "My API key is sk-not-a-real-secret",
      category: "other",
    }), context, dependencies);
    expect(outputValue(result)).toMatchObject({ ok: false });
    expect(dependencies.putSenderMemory).not.toHaveBeenCalled();
    expect(dependencies.writeEmailMemoryToolRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("filters memory results by the exact sender and query", async () => {
    vi.mocked(dependencies.listSenderMemories).mockResolvedValue([
      memory({ key: "current_project", value: "Phoenix rollout" }),
      memory({ id: "memory-2", senderEmail: "other@example.com", key: "current_project", value: "Phoenix secret" }),
      memory({ id: "memory-3", key: "timezone", value: "America/Chicago" }),
    ]);
    const result = await executeEmailMemoryToolCall(call("search_sender_memory", {
      person_email: senderEmail,
      query: "phoenix",
      limit: 10,
    }), context, dependencies);
    expect(outputValue(result)).toEqual({
      ok: true,
      memories: [expect.objectContaining({ key: "current_project", value: "Phoenix rollout" })],
      recent_memories_if_query_was_too_narrow: [],
    });
  });

  it("returns recent same-sender facts when a model query is overly specific", async () => {
    vi.mocked(dependencies.listSenderMemories).mockResolvedValue([
      memory({ key: "test_constellation", value: "Lyra" }),
    ]);
    const result = await executeEmailMemoryToolCall(call("search_sender_memory", {
      person_email: senderEmail,
      query: "memory-recall-999999 exact validation token",
      limit: 5,
    }), context, dependencies);
    expect(outputValue(result)).toEqual({
      ok: true,
      memories: [],
      recent_memories_if_query_was_too_narrow: [
        expect.objectContaining({ key: "test_constellation", value: "Lyra" }),
      ],
    });
  });

  it("returns only matching one-to-one past conversations", async () => {
    vi.mocked(provider.searchMessages!).mockResolvedValue([
      message({ id: "message-good", date: 5 }),
      message({ id: "message-group", date: 6, cc: [{ email: "third-party@example.com" }] }),
      message({ id: "message-current", date: 7 }),
      message({ id: "message-unrelated", date: 8, body: "A different topic", subject: "Other" }),
    ]);
    const result = await executeEmailMemoryToolCall(call("search_past_conversations", {
      person_email: senderEmail,
      query: "Phoenix",
      limit: 5,
    }), context, dependencies);
    const parsed = outputValue(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.conversations).toHaveLength(1);
    expect(parsed.conversations[0]).toMatchObject({
      direction: "from_sender",
      subject: "Project Phoenix",
    });
  });

  it("executes a real function-call loop and sends the tool output back to Responses", async () => {
    const client = {
      responses: {
        create: vi.fn()
          .mockResolvedValueOnce({
            output_text: "",
            output: [call("remember_sender_fact", {
              person_email: senderEmail,
              key: "timezone",
              value: "America/Chicago",
              category: "preference",
            })],
          })
          .mockResolvedValueOnce({
            output_text: "I’ll remember that your timezone is America/Chicago.",
            output: [{ type: "message", id: "message-output" }],
          }),
      },
    };
    const run = await createModelResponse({
      context: "Authorized sender: person@example.com",
      servers: [],
      memoryContext: context,
      memoryDependencies: dependencies,
      client: client as never,
    });
    expect(run.response.output_text).toContain("America/Chicago");
    expect(run.memoryToolCalls).toEqual(["remember_sender_fact"]);
    expect(client.responses.create).toHaveBeenCalledTimes(2);
    expect(client.responses.create.mock.calls[0][0].tools).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "function", name: "remember_sender_fact" })]),
    );
    expect(client.responses.create.mock.calls[1][0].input).toEqual(
      expect.arrayContaining([expect.objectContaining({
        type: "function_call_output",
        call_id: "call-remember_sender_fact",
        output: expect.stringContaining('"ok":true'),
      })]),
    );
  });
});
