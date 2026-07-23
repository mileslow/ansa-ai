import { describe, expect, it, vi } from "vitest";
import type { AgentMailClient } from "agentmail";
import {
  AgentMailEmailReplyTransport,
  EmailReplyTransportError,
  externalReplyHeaders,
  NylasEmailReplyTransport,
} from "../lib/email-agent-reply-transport";
import type {
  EmailConnection,
  EmailReplyInput,
  MailboxMessage,
  MailboxProvider,
} from "../lib/email-agent-types";

const connection: EmailConnection = {
  id: "connection-1",
  ownerId: "owner-1",
  provider: "google",
  nylasGrantId: "grant-1",
  emailAddress: "mileslow2@gmail.com",
  status: "connected",
  connectedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const message: MailboxMessage = {
  id: "message-1",
  grantId: "grant-1",
  threadId: "thread-1",
  subject: "HSA contribution question",
  body: "What is the limit?",
  snippet: "What is the limit?",
  date: 1_800_000_000,
  from: [{ name: "Akhil", email: "akhd2000@gmail.com" }],
  to: [{ email: "mileslow2@gmail.com" }],
  cc: [],
  headers: [
    { name: "Message-ID", value: "<incoming-1@example.com>\r\nBcc: attacker@example.com" },
    { name: "References", value: "<root@example.com> invalid <parent@example.com>" },
  ],
};

function replyInput(overrides: Partial<EmailReplyInput> = {}): EmailReplyInput {
  return {
    connection,
    message,
    recipient: message.from[0],
    body: "The 2026 limit is available from the IRS.",
    idempotencyKey: "stable-idempotency-key",
    ...overrides,
  };
}

describe("email-agent reply transport", () => {
  it("sends from AgentMail while routing future replies back through Gmail", async () => {
    const send = vi.fn(async () => ({
      messageId: "agentmail-message-1",
      threadId: "agentmail-thread-1",
    }));
    const client = {
      inboxes: { messages: { send } },
    } as unknown as AgentMailClient;
    const transport = new AgentMailEmailReplyTransport(
      client,
      "ansa-agent@agentmail.to",
    );

    await expect(transport.send(replyInput())).resolves.toEqual({
      id: "agentmail-message-1",
      threadId: "agentmail-thread-1",
      transport: "agentmail",
      fromAddress: "ansa-agent@agentmail.to",
    });
    expect(send).toHaveBeenCalledWith(
      "ansa-agent@agentmail.to",
      {
        to: "akhd2000@gmail.com",
        replyTo: "mileslow2@gmail.com",
        subject: "Re: HSA contribution question",
        text: "The 2026 limit is available from the IRS.",
        headers: {
          "In-Reply-To": "<incoming-1@example.com>",
          References:
            "<root@example.com> <parent@example.com> <incoming-1@example.com>",
        },
      },
      { idempotencyKey: "stable-idempotency-key" },
    );
  });

  it("omits foreign-thread headers when Gmail does not expose a valid Message-ID", async () => {
    const withoutMessageId = {
      ...message,
      subject: "Re: Existing subject",
      headers: [{ name: "Message-ID", value: "not-a-valid-message-id" }],
    };
    const send = vi.fn(async () => ({
      messageId: "sent-2",
      threadId: "thread-2",
    }));
    const transport = new AgentMailEmailReplyTransport(
      { inboxes: { messages: { send } } } as unknown as AgentMailClient,
      "ansa-agent@agentmail.to",
    );
    await transport.send(replyInput({ message: withoutMessageId }));
    expect(send).toHaveBeenCalledWith(
      "ansa-agent@agentmail.to",
      expect.objectContaining({
        subject: "Re: Existing subject",
        headers: {},
      }),
      expect.anything(),
    );
    expect(externalReplyHeaders(withoutMessageId)).toEqual({});
  });

  it("wraps AgentMail delivery failures without treating them as Gmail grant failures", async () => {
    const client = {
      inboxes: {
        messages: {
          send: vi.fn(async () => {
            throw Object.assign(new Error("AgentMail rejected the key"), {
              statusCode: 401,
            });
          }),
        },
      },
    } as unknown as AgentMailClient;
    const transport = new AgentMailEmailReplyTransport(
      client,
      "ansa-agent@agentmail.to",
    );
    await expect(transport.send(replyInput())).rejects.toMatchObject({
      name: "EmailReplyTransportError",
      transport: "agentmail",
      statusCode: 401,
    } satisfies Partial<EmailReplyTransportError>);
  });

  it("retains the existing Nylas reply path as an explicit fallback", async () => {
    const reply = vi.fn(async () => ({
      id: "nylas-message-1",
      threadId: "gmail-thread-1",
    }));
    const provider = { reply } as unknown as MailboxProvider;
    const transport = new NylasEmailReplyTransport(provider);
    await expect(transport.send(replyInput())).resolves.toEqual({
      id: "nylas-message-1",
      threadId: "gmail-thread-1",
      transport: "nylas",
      fromAddress: "mileslow2@gmail.com",
    });
    expect(reply).toHaveBeenCalledWith({
      grantId: "grant-1",
      messageId: "message-1",
      recipient: message.from[0],
      body: "The 2026 limit is available from the IRS.",
      idempotencyKey: "stable-idempotency-key",
    });
  });
});
