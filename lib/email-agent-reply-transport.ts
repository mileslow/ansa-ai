import { AgentMailClient } from "agentmail";
import type {
  EmailReplyInput,
  EmailReplyTransport,
  MailboxMessage,
  MailboxProvider,
  SentMessage,
} from "./email-agent-types";
import { normalizeEmailAddress } from "./email-agent-security";

const MESSAGE_ID_PATTERN = /<[^<>\s\r\n]+>/g;

function safeSubject(value: string) {
  const subject = String(value || "")
    .replace(/[\r\n\0]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
  const base = subject || "(no subject)";
  return /^re\s*:/i.test(base) ? base : `Re: ${base}`;
}

function messageHeader(message: MailboxMessage, name: string) {
  return message.headers.find(
    (header) => header.name.trim().toLowerCase() === name.toLowerCase(),
  )?.value || "";
}

function messageIds(value: string, limit = 20) {
  return (String(value || "").match(MESSAGE_ID_PATTERN) || []).slice(-limit);
}

export function externalReplyHeaders(message: MailboxMessage) {
  const inboundMessageId = messageIds(messageHeader(message, "message-id"), 1)[0];
  if (!inboundMessageId) return {};
  const references = messageIds(messageHeader(message, "references"));
  return {
    "In-Reply-To": inboundMessageId,
    References: [...new Set([...references, inboundMessageId])].slice(-20).join(" "),
  };
}

export class EmailReplyTransportError extends Error {
  readonly transport: "nylas" | "agentmail";
  readonly statusCode: number;

  constructor(
    transport: "nylas" | "agentmail",
    message: string,
    statusCode = 0,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "EmailReplyTransportError";
    this.transport = transport;
    this.statusCode = statusCode;
  }
}

export class NylasEmailReplyTransport implements EmailReplyTransport {
  constructor(private readonly provider: MailboxProvider) {}

  async send(input: EmailReplyInput): Promise<SentMessage> {
    const sent = await this.provider.reply({
      grantId: input.connection.nylasGrantId,
      messageId: input.message.id,
      recipient: input.recipient,
      body: input.body,
      idempotencyKey: input.idempotencyKey,
    });
    return {
      ...sent,
      transport: "nylas",
      fromAddress: normalizeEmailAddress(input.connection.emailAddress),
    };
  }
}

export class AgentMailEmailReplyTransport implements EmailReplyTransport {
  private readonly inboxId: string;

  constructor(
    private readonly client: AgentMailClient,
    inboxId: string,
  ) {
    this.inboxId = normalizeEmailAddress(inboxId);
  }

  async send(input: EmailReplyInput): Promise<SentMessage> {
    try {
      const recipient = normalizeEmailAddress(input.recipient.email);
      const replyTo = normalizeEmailAddress(input.connection.emailAddress);
      const sent = await this.client.inboxes.messages.send(
        this.inboxId,
        {
          to: recipient,
          replyTo,
          subject: safeSubject(input.message.subject),
          text: input.body,
          headers: externalReplyHeaders(input.message),
        },
        { idempotencyKey: input.idempotencyKey },
      );
      return {
        id: sent.messageId,
        threadId: sent.threadId,
        transport: "agentmail",
        fromAddress: this.inboxId,
      };
    } catch (error) {
      const statusCode = Number(
        (error as { statusCode?: number; status?: number })?.statusCode ||
        (error as { statusCode?: number; status?: number })?.status ||
        0,
      );
      throw new EmailReplyTransportError(
        "agentmail",
        error instanceof Error ? error.message : "AgentMail reply failed",
        statusCode,
        { cause: error },
      );
    }
  }
}

function configuredAgentMailTransport() {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  if (!apiKey) throw new Error("AGENTMAIL_API_KEY is not configured");
  const inboxId = process.env.EMAIL_AGENT_AGENTMAIL_INBOX_ID;
  if (!inboxId)
    throw new Error("EMAIL_AGENT_AGENTMAIL_INBOX_ID is not configured");
  return new AgentMailEmailReplyTransport(
    new AgentMailClient({ apiKey, timeoutInSeconds: 45, maxRetries: 2 }),
    inboxId,
  );
}

export function configuredEmailReplyTransport(
  provider: MailboxProvider,
): EmailReplyTransport {
  const transport = String(process.env.EMAIL_AGENT_REPLY_TRANSPORT || "nylas")
    .trim()
    .toLowerCase();
  if (transport === "nylas") return new NylasEmailReplyTransport(provider);
  if (transport === "agentmail") return configuredAgentMailTransport();
  throw new Error(`Unsupported EMAIL_AGENT_REPLY_TRANSPORT: ${transport}`);
}
