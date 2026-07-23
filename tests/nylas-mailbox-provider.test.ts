import { afterEach, describe, expect, it, vi } from "vitest";
import { NylasMailboxProvider } from "../lib/nylas-mailbox-provider";

describe("Nylas mailbox adapter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("restricts hosted auth to Google and verifies the returned grant", async () => {
    vi.stubEnv("NYLAS_CLIENT_ID", "client-1");
    const client = {
      auth: {
        urlForOAuth2: vi.fn(() => "https://api.us.nylas.com/v3/connect/auth"),
        exchangeCodeForToken: vi.fn(async () => ({
          grantId: "grant-1",
          email: "person@example.com",
          provider: "google",
        })),
      },
      grants: {
        find: vi.fn(async () => ({
          data: { id: "grant-1", provider: "google", email: "person@example.com" },
        })),
      },
    };
    const provider = new NylasMailboxProvider(client as never);
    expect(provider.createGoogleConnectUrl({
      state: "state-1",
      redirectUri: "https://flux.example.com/callback",
    })).toContain("nylas.com");
    expect(client.auth.urlForOAuth2).toHaveBeenCalledWith(expect.objectContaining({
      clientId: "client-1",
      provider: "google",
      state: "state-1",
      redirectUri: "https://flux.example.com/callback",
    }));
    await expect(provider.completeConnection({
      code: "code-1",
      redirectUri: "https://flux.example.com/callback",
    })).resolves.toEqual({
      grantId: "grant-1",
      emailAddress: "person@example.com",
      provider: "google",
    });
  });

  it("fetches canonical thread messages and sends a deterministic threaded reply", async () => {
    const messages = {
      "message-1": { id: "message-1", grantId: "grant-1", object: "message", date: 2, folders: [], to: [], from: [{ email: "person@example.com" }], subject: "Re: Test", body: "Newest", threadId: "thread-1" },
      "message-0": { id: "message-0", grantId: "grant-1", object: "message", date: 1, folders: [], to: [], from: [{ email: "agent@example.com" }], subject: "Test", body: "Older", threadId: "thread-1" },
    };
    const client = {
      messages: {
        find: vi.fn(async ({ messageId }) => ({ data: messages[messageId] })),
        send: vi.fn(async () => ({ data: { id: "sent-1", threadId: "thread-1" } })),
      },
      threads: {
        find: vi.fn(async () => ({
          data: { id: "thread-1", subject: "Test", messageIds: ["message-1", "message-0"] },
        })),
      },
      grants: { destroy: vi.fn(async () => ({})) },
    };
    const provider = new NylasMailboxProvider(client as never);
    const thread = await provider.getThread("grant-1", "thread-1");
    expect(thread.messages.map((item) => item.id)).toEqual(["message-0", "message-1"]);
    await expect(provider.reply({
      grantId: "grant-1",
      messageId: "message-1",
      recipient: { email: "person@example.com" },
      body: "Here is the answer.",
      idempotencyKey: "stable-key",
    })).resolves.toEqual({ id: "sent-1", threadId: "thread-1" });
    expect(client.messages.send).toHaveBeenCalledWith(expect.objectContaining({
      identifier: "grant-1",
      requestBody: expect.objectContaining({
        to: [{ email: "person@example.com" }],
        body: "Here is the answer.",
        replyToMessageId: "message-1",
        isPlaintext: true,
      }),
      overrides: { headers: { "Idempotency-Key": "stable-key" } },
    }));
  });

  it("searches Gmail history inside a backend-enforced participant scope", async () => {
    const client = {
      messages: {
        list: vi.fn(async () => ({
          data: [{
            id: "message-old",
            grantId: "grant-1",
            object: "message",
            date: 1,
            folders: [],
            to: [{ email: "agent@example.com" }],
            from: [{ email: "person@example.com" }],
            cc: [],
            subject: "Phoenix",
            body: "Earlier project decision",
            threadId: "thread-old",
          }],
        })),
      },
    };
    const provider = new NylasMailboxProvider(client as never);
    await expect(provider.searchMessages("grant-1", {
      participantEmail: "Person@Example.com",
      query: "Phoenix from:someone-else@example.com",
      limit: 5,
    })).resolves.toEqual([
      expect.objectContaining({ id: "message-old", subject: "Phoenix" }),
    ]);
    const request = client.messages.list.mock.calls[0][0];
    expect(request.identifier).toBe("grant-1");
    expect(request.queryParams.limit).toBe(5);
    expect(request.queryParams.searchQueryNative).toContain(
      "{from:person@example.com to:person@example.com cc:person@example.com bcc:person@example.com}",
    );
    expect(request.queryParams.searchQueryNative).not.toContain("from:someone-else@example.com");
  });
});
