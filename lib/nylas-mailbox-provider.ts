import Nylas from "nylas";
import { MessageFields, type Message } from "nylas";
import type {
  MailboxMessage,
  MailboxProvider,
  MailboxThread,
} from "./email-agent-types";
import { normalizeEmailAddress } from "./email-agent-security";

function configuredNylas() {
  const apiKey = process.env.NYLAS_API_KEY;
  if (!apiKey) throw new Error("NYLAS_API_KEY is not configured");
  return new Nylas({
    apiKey,
    apiUri: process.env.NYLAS_API_URI || "https://api.us.nylas.com",
    timeout: 45,
  });
}

function applicationClientId() {
  const clientId = process.env.NYLAS_CLIENT_ID;
  if (!clientId) throw new Error("NYLAS_CLIENT_ID is not configured");
  return clientId;
}

function toMailboxMessage(message: Message): MailboxMessage {
  return {
    id: message.id,
    grantId: message.grantId,
    threadId: message.threadId,
    subject: message.subject || "",
    body: message.body || "",
    snippet: message.snippet || "",
    date: message.date,
    from: (message.from || []).map(({ name, email }) => ({ name, email })),
    to: (message.to || []).map(({ name, email }) => ({ name, email })),
    cc: (message.cc || []).map(({ name, email }) => ({ name, email })),
    headers: (message.headers || []).map(({ name, value }) => ({ name, value })),
  };
}

export class NylasMailboxProvider implements MailboxProvider {
  private readonly client: Nylas;

  constructor(client = configuredNylas()) {
    this.client = client;
  }

  createGoogleConnectUrl(input: {
    state: string;
    redirectUri: string;
    loginHint?: string;
  }) {
    return this.client.auth.urlForOAuth2({
      clientId: applicationClientId(),
      provider: "google",
      redirectUri: input.redirectUri,
      state: input.state,
      loginHint: input.loginHint,
      accessType: "offline",
    });
  }

  async completeConnection(input: { code: string; redirectUri: string }) {
    const exchanged = await this.client.auth.exchangeCodeForToken({
      clientId: applicationClientId(),
      code: input.code,
      redirectUri: input.redirectUri,
    });
    const grant = await this.client.grants.find({ grantId: exchanged.grantId });
    const provider = String(grant.data.provider || exchanged.provider || "");
    if (provider !== "google")
      throw new Error("Only Gmail and Google Workspace connections are supported");
    const emailAddress = grant.data.email || exchanged.email;
    if (!emailAddress) throw new Error("Nylas did not return the connected email address");
    return { grantId: exchanged.grantId, emailAddress, provider };
  }

  async getMessage(grantId: string, messageId: string) {
    const response = await this.client.messages.find({
      identifier: grantId,
      messageId,
      queryParams: { fields: MessageFields.INCLUDE_HEADERS },
    });
    return toMailboxMessage(response.data);
  }

  async getThread(grantId: string, threadId: string): Promise<MailboxThread> {
    const response = await this.client.threads.find({ identifier: grantId, threadId });
    const thread = response.data;
    const messages = await Promise.all(
      thread.messageIds.slice(-12).map((messageId) => this.getMessage(grantId, messageId)),
    );
    return {
      id: thread.id,
      subject: thread.subject || "",
      messages: messages.sort((left, right) => left.date - right.date),
    };
  }

  async searchMessages(grantId: string, input: {
    participantEmail: string;
    query: string;
    limit: number;
  }) {
    const participant = normalizeEmailAddress(input.participantEmail);
    const query = String(input.query || "")
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}@._ -]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    const participantScope = `{from:${participant} to:${participant} cc:${participant} bcc:${participant}}`;
    const response = await this.client.messages.list({
      identifier: grantId,
      queryParams: {
        searchQueryNative: [participantScope, query].filter(Boolean).join(" "),
        limit: Math.min(30, Math.max(1, Math.floor(input.limit))),
      },
    });
    return response.data.map(toMailboxMessage);
  }

  async reply(input: {
    grantId: string;
    messageId: string;
    recipient: { name?: string; email: string };
    body: string;
    idempotencyKey: string;
  }) {
    const response = await this.client.messages.send({
      identifier: input.grantId,
      requestBody: {
        to: [input.recipient],
        body: input.body,
        replyToMessageId: input.messageId,
        isPlaintext: true,
      },
      overrides: { headers: { "Idempotency-Key": input.idempotencyKey } },
    });
    return { id: response.data.id, threadId: response.data.threadId };
  }

  async disconnect(grantId: string) {
    await this.client.grants.destroy({ grantId });
  }
}
