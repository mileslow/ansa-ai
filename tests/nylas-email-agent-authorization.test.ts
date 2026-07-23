import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MailboxProvider, NylasWebhookEvent } from "../lib/email-agent-types";

const mocks = vi.hoisted(() => ({
  acquireEmailEvent: vi.fn(),
  claimInboundEmailMessage: vi.fn(),
  createEmailAgentApproval: vi.fn(),
  ensureEmailEventQueued: vi.fn(),
  enforceEmailAgentRateLimits: vi.fn(),
  finishEmailEvent: vi.fn(),
  getAllowedSender: vi.fn(),
  getEmailConnection: vi.fn(),
  getEmailConnectionByGrant: vi.fn(),
  listMcpConnections: vi.fn(),
  listSenderMemories: vi.fn(),
  listSenderToolGrants: vi.fn(),
  putSenderMemory: vi.fn(),
  deleteSenderMemory: vi.fn(),
  updateEmailAgentApproval: vi.fn(),
  updateEmailConnection: vi.fn(),
  updateInboundEmailMessageClaim: vi.fn(),
  writeEmailAgentAudit: vi.fn(),
  writeEmailMemoryToolRun: vi.fn(),
  writeMcpToolRun: vi.fn(),
  claimEmailAgentApproval: vi.fn(),
}));

vi.mock("../lib/email-agent-store", () => mocks);

import { processNylasEvent } from "../lib/nylas-email-agent";

const event: NylasWebhookEvent = {
  id: "event-1",
  type: "message.created",
  time: 1_800_000_000,
  data: {
    object: {
      id: "message-1",
      grantId: "grant-1",
      threadId: "thread-1",
    },
  },
};

describe("Nylas email-agent authorization ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.acquireEmailEvent.mockResolvedValue({
      acquired: true,
      reason: "acquired",
      attempt: 1,
      ref: { id: "event-document" },
    });
    mocks.getEmailConnectionByGrant.mockResolvedValue({
      id: "connection-1",
      ownerId: "owner-1",
      provider: "google",
      nylasGrantId: "grant-1",
      emailAddress: "agent@example.com",
      status: "connected",
      connectedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mocks.updateEmailConnection.mockResolvedValue(undefined);
    mocks.finishEmailEvent.mockResolvedValue(undefined);
    mocks.writeEmailAgentAudit.mockResolvedValue(undefined);
  });

  it("never fetches thread context, calls rate-limiting/model paths, or sends for a disallowed sender", async () => {
    mocks.getAllowedSender.mockResolvedValue(null);
    const provider = {
      getMessage: vi.fn(async () => ({
        id: "message-1",
        grantId: "grant-1",
        threadId: "thread-1",
        subject: "Private request",
        body: "This body must never reach OpenAI.",
        snippet: "This body must never reach OpenAI.",
        date: 1_800_000_000,
        from: [{ email: "blocked@example.com" }],
        to: [{ email: "agent@example.com" }],
        cc: [],
        headers: [],
      })),
      getThread: vi.fn(),
      reply: vi.fn(),
    } as unknown as MailboxProvider;

    await expect(processNylasEvent(event, { provider })).resolves.toEqual({
      status: "ignored",
      reason: "sender_not_allowed",
    });
    expect(provider.getThread).not.toHaveBeenCalled();
    expect(provider.reply).not.toHaveBeenCalled();
    expect(mocks.claimInboundEmailMessage).not.toHaveBeenCalled();
    expect(mocks.enforceEmailAgentRateLimits).not.toHaveBeenCalled();
    expect(mocks.finishEmailEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ outcome: "ignored_sender_not_allowed" }),
    );
  });

  it("suppresses a duplicate event before reading the mailbox", async () => {
    mocks.acquireEmailEvent.mockResolvedValue({
      acquired: false,
      reason: "complete",
      attempt: 1,
      ref: { id: "event-document" },
    });
    const provider = {
      getMessage: vi.fn(),
      getThread: vi.fn(),
      reply: vi.fn(),
    } as unknown as MailboxProvider;
    await expect(processNylasEvent(event, { provider })).resolves.toEqual({
      status: "duplicate",
      reason: "complete",
    });
    expect(provider.getMessage).not.toHaveBeenCalled();
  });
});
