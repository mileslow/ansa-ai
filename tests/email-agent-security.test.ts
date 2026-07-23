import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ineligibleMessageReason,
  normalizeEmailAddress,
  openEmailAgentJson,
  parseNylasWebhookEvent,
  renderEmailThreadContext,
  sealEmailAgentJson,
  senderIdForEmail,
  validateReplyBody,
  verifyNylasWebhookSignature,
} from "../lib/email-agent-security";
import type { MailboxMessage } from "../lib/email-agent-types";

const message = (patch: Partial<MailboxMessage> = {}): MailboxMessage => ({
  id: "message-1",
  grantId: "grant-1",
  threadId: "thread-1",
  subject: "Question",
  body: "Can you help with this?",
  snippet: "Can you help with this?",
  date: 1_800_000_000,
  from: [{ email: "Person@Example.com" }],
  to: [{ email: "agent@example.com" }],
  cc: [],
  headers: [],
  ...patch,
});

describe("Nylas email-agent security", () => {
  it("normalizes case and display-address syntax without rewriting Gmail dots or plus suffixes", () => {
    expect(normalizeEmailAddress(" Person <User.Name+work@Gmail.com> ")).toBe(
      "user.name+work@gmail.com",
    );
    expect(normalizeEmailAddress("username@gmail.com")).not.toBe(
      normalizeEmailAddress("user.name@gmail.com"),
    );
    expect(senderIdForEmail("USER@example.com")).toBe(
      senderIdForEmail("user@example.com"),
    );
    expect(() => normalizeEmailAddress("not-an-address")).toThrow(
      "valid email",
    );
  });

  it("verifies the exact raw webhook bytes with an HMAC-SHA256 signature", () => {
    const raw = Buffer.from('{"id":"event-1", "type":"message.created"}');
    const signature = createHmac("sha256", "webhook-secret")
      .update(raw)
      .digest("hex");
    expect(verifyNylasWebhookSignature(raw, signature, "webhook-secret")).toBe(true);
    expect(
      verifyNylasWebhookSignature(
        Buffer.from('{"id":"event-1","type":"message.created"}'),
        signature,
        "webhook-secret",
      ),
    ).toBe(false);
    expect(verifyNylasWebhookSignature(raw, "short", "webhook-secret")).toBe(false);
  });

  it("accepts supported CloudEvents notifications and normalizes transformed payloads", () => {
    expect(
      parseNylasWebhookEvent({
        specversion: "1.0",
        id: "event-1",
        type: "message.created.transformed",
        time: 1_800_000_000,
        data: {
          application_id: "app-1",
          object: {
            id: "message-1",
            grant_id: "grant-1",
            thread_id: "thread-1",
          },
        },
      }),
    ).toMatchObject({
      id: "event-1",
      type: "message.created",
      data: { object: { id: "message-1", grantId: "grant-1", threadId: "thread-1" } },
    });
    expect(
      parseNylasWebhookEvent({
        id: "event-2",
        type: "contact.created",
        time: 1_800_000_000,
        data: { object: { id: "contact-1" } },
      }),
    ).toBeNull();
  });

  it("rejects self-mail, automatic responses, bounces, and list mail", () => {
    expect(
      ineligibleMessageReason(
        message({ from: [{ email: "agent@example.com" }] }),
        "agent@example.com",
      ),
    ).toBe("self_message");
    expect(
      ineligibleMessageReason(
        message({ headers: [{ name: "Auto-Submitted", value: "auto-replied" }] }),
        "agent@example.com",
      ),
    ).toBe("automatic_response");
    expect(
      ineligibleMessageReason(
        message({ headers: [{ name: "List-Id", value: "list.example.com" }] }),
        "agent@example.com",
      ),
    ).toBe("bulk_or_list_message");
    expect(
      ineligibleMessageReason(
        message({ from: [{ email: "mailer-daemon@example.com" }] }),
        "agent@example.com",
      ),
    ).toBe("delivery_failure");
  });

  it("bounds thread context, strips quoted replies, and preserves the newest request", () => {
    const latest = message({
      id: "latest",
      body: "Newest request that must remain.\n\nOn Monday Person wrote:\n> old quote",
      date: 1_800_000_100,
    });
    const rendered = renderEmailThreadContext({
      mailboxAddress: "agent@example.com",
      senderAddress: "person@example.com",
      thread: {
        id: "thread-1",
        subject: "Question",
        messages: [
          message({ id: "old", body: `Old context ${"x".repeat(10_000)}` }),
          latest,
        ],
      },
      latestMessage: latest,
      maxCharacters: 4_000,
      newestMinimumCharacters: 2_000,
    });
    expect(rendered.length).toBeLessThanOrEqual(4_000);
    expect(rendered).toContain("Newest request that must remain.");
    expect(rendered).not.toContain("old quote");
  });

  it("validates model output and encrypts approval workflow state", () => {
    expect(validateReplyBody("  Hello there.  ")).toBe("Hello there.");
    expect(() => validateReplyBody("", 100)).toThrow("empty");
    expect(() => validateReplyBody("x".repeat(101), 100)).toThrow("exceeds");
    const sealed = sealEmailAgentJson({ approval: "mcpr_123", token: "private" }, "key-material");
    expect(sealed).not.toContain("private");
    expect(openEmailAgentJson(sealed, "key-material")).toEqual({
      approval: "mcpr_123",
      token: "private",
    });
    expect(() => openEmailAgentJson(sealed, "different-key")).toThrow();
  });
});
