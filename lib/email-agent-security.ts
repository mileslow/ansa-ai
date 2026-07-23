import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type {
  MailboxMessage,
  MailboxThread,
  NylasWebhookEvent,
} from "./email-agent-types";

const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const EVENT_TYPES = new Set([
  "message.created",
  "grant.expired",
  "grant.deleted",
  "grant.updated",
]);

export function stableEmailAgentId(value: string, length = 40) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

export function normalizeEmailAddress(value: string) {
  const raw = String(value || "").trim();
  const bracketed = raw.match(/<([^<>]+)>/)?.[1] || raw;
  const normalized = bracketed.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized) || normalized.length > 254)
    throw new Error("Enter a valid email address");
  return normalized;
}

export function senderIdForEmail(value: string) {
  return stableEmailAgentId(normalizeEmailAddress(value), 48);
}

export function verifyNylasWebhookSignature(
  rawBody: Buffer,
  suppliedSignature: string,
  secret: string,
) {
  if (!rawBody.length || !secret || !/^[a-f0-9]{64}$/i.test(suppliedSignature))
    return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const supplied = suppliedSignature.toLowerCase();
  return expected.length === supplied.length &&
    timingSafeEqual(Buffer.from(expected, "ascii"), Buffer.from(supplied, "ascii"));
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function baseEventType(value: string) {
  return value.replace(/\.(?:truncated|transformed)$/i, "");
}

export function parseNylasWebhookEvent(value: unknown): NylasWebhookEvent | null {
  if (!plainObject(value) || typeof value.id !== "string" || !value.id)
    return null;
  if (typeof value.type !== "string" || !EVENT_TYPES.has(baseEventType(value.type)))
    return null;
  if (!plainObject(value.data) || !plainObject(value.data.object)) return null;
  const object = value.data.object;
  const id = String(object.id || object.grant_id || "").trim();
  if (!id) return null;
  const time = Number(value.time);
  if (!Number.isFinite(time) || time <= 0) return null;
  return {
    id: value.id,
    type: baseEventType(value.type),
    time,
    data: {
      applicationId:
        typeof value.data.application_id === "string"
          ? value.data.application_id
          : undefined,
      object: {
        id,
        grantId:
          typeof object.grant_id === "string" || typeof object.grantId === "string"
            ? String(object.grant_id || object.grantId)
            : baseEventType(value.type).startsWith("grant.")
              ? id
              : undefined,
        threadId:
          typeof object.thread_id === "string" || typeof object.threadId === "string"
            ? String(object.thread_id || object.threadId)
            : undefined,
        grantStatus:
          typeof object.grant_status === "string" || typeof object.grantStatus === "string"
            ? String(object.grant_status || object.grantStatus)
            : undefined,
      },
    },
  };
}

export function htmlEmailToText(value: string) {
  return String(value || "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) =>
      Number(code) <= 0xffff ? String.fromCharCode(Number(code)) : " ",
    )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function stripQuotedEmailText(value: string) {
  const text = htmlEmailToText(value);
  const replyMarker = text.search(
    /\n(?:On .{0,300} wrote:|From:\s.{1,200}\n(?:Sent|Date):|[- ]{2,}Original Message[- ]{2,})/i,
  );
  const newest = replyMarker >= 0 ? text.slice(0, replyMarker) : text;
  return newest
    .split("\n")
    .filter((line) => !/^\s*>/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function headerMap(message: MailboxMessage) {
  return new Map(
    message.headers.map((header) => [header.name.trim().toLowerCase(), header.value.trim()]),
  );
}

export function ineligibleMessageReason(
  message: MailboxMessage,
  mailboxAddress: string,
) {
  if (message.from.length !== 1) return "missing_or_ambiguous_sender";
  let sender: string;
  try {
    sender = normalizeEmailAddress(message.from[0].email);
  } catch {
    return "invalid_sender";
  }
  if (sender === normalizeEmailAddress(mailboxAddress)) return "self_message";
  const headers = headerMap(message);
  const automatic = headers.get("auto-submitted")?.toLowerCase();
  if (automatic && automatic !== "no") return "automatic_response";
  if (
    headers.has("x-autoreply") ||
    headers.has("x-autorespond") ||
    headers.has("x-auto-response-suppress")
  )
    return "automatic_response";
  const precedence = headers.get("precedence")?.toLowerCase();
  if (["bulk", "list", "junk"].includes(precedence || "") || headers.has("list-id"))
    return "bulk_or_list_message";
  if (/^(?:mailer-daemon|postmaster)@/i.test(sender)) return "delivery_failure";
  if (/^(?:undeliverable|delivery status notification|mail delivery failed|automatic reply|out of office)\b/i.test(message.subject))
    return "automatic_response";
  if (!stripQuotedEmailText(message.body || message.snippet)) return "empty_body";
  return null;
}

export function renderEmailThreadContext(input: {
  mailboxAddress: string;
  senderAddress: string;
  thread: MailboxThread;
  latestMessage: MailboxMessage;
  maxCharacters?: number;
  newestMinimumCharacters?: number;
}) {
  const maximum = Math.max(4_000, input.maxCharacters || 40_000);
  const newestMinimum = Math.min(
    maximum,
    Math.max(1_000, input.newestMinimumCharacters || 16_000),
  );
  const mailbox = normalizeEmailAddress(input.mailboxAddress);
  const messageBlocks = [...input.thread.messages]
    .sort((left, right) => left.date - right.date)
    .slice(-12)
    .map((message) => {
      const from = message.from[0]?.email || "unknown";
      const role = (() => {
        try {
          return normalizeEmailAddress(from) === mailbox
            ? "CONNECTED MAILBOX (assistant)"
            : "EXTERNAL SENDER";
        } catch {
          return "EXTERNAL SENDER";
        }
      })();
      return {
        id: message.id,
        text: `[${role} | ${new Date(message.date * 1000).toISOString()}]\n${stripQuotedEmailText(message.body || message.snippet)}`,
      };
    })
    .filter((block) => !/\]\n\s*$/.test(block.text));
  const latestBody = stripQuotedEmailText(
    input.latestMessage.body || input.latestMessage.snippet,
  );
  const latest = [
    "LATEST INCOMING MESSAGE",
    `From: ${input.senderAddress}`,
    `Subject: ${input.latestMessage.subject || input.thread.subject || "(no subject)"}`,
    "",
    latestBody.slice(0, maximum),
  ].join("\n");
  const latestBudget = Math.max(newestMinimum, Math.min(maximum, latest.length));
  const historyBudget = Math.max(0, maximum - Math.min(latest.length, latestBudget));
  const history = messageBlocks
    .filter((block) => block.id !== input.latestMessage.id)
    .map((block) => block.text)
    .join("\n\n")
    .slice(-historyBudget);
  const rendered = [
    `Connected mailbox: ${input.mailboxAddress}`,
    `Authorized sender: ${input.senderAddress}`,
    `Thread subject: ${input.thread.subject || input.latestMessage.subject || "(no subject)"}`,
    history ? `RECENT THREAD CONTEXT\n${history}` : "",
    latest,
  ]
    .filter(Boolean)
    .join("\n\n");
  return rendered.slice(-maximum);
}

export function validateReplyBody(value: unknown, maximum = 12_000) {
  const body = String(value || "").replace(/\u0000/g, "").trim();
  if (!body) throw new Error("The model returned an empty email reply");
  if (body.length > maximum)
    throw new Error(`The model reply exceeds the ${maximum}-character limit`);
  return body;
}

function encryptionKey(secret: string) {
  if (!secret.trim())
    throw new Error("MCP_CREDENTIAL_ENCRYPTION_KEY is required for approval workflows");
  return createHash("sha256").update(secret).digest();
}

export function sealEmailAgentJson(value: unknown, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function openEmailAgentJson<T>(value: string, secret: string): T {
  const [version, ivValue, tagValue, encryptedValue] = String(value).split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue)
    throw new Error("The approval workflow payload is invalid");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(secret),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8"),
  ) as T;
}

export function constantTimeSecretMatches(
  expected: string | undefined,
  supplied: string | string[] | undefined,
) {
  const left = String(expected || "").trim();
  const right = String(Array.isArray(supplied) ? supplied[0] || "" : supplied || "").trim();
  return Boolean(
    left && left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right)),
  );
}

export function redactMcpArguments(
  value: unknown,
  extraSensitiveKeys: string[] = [],
): unknown {
  const sensitive = new Set([
    "authorization",
    "token",
    "access_token",
    "refresh_token",
    "password",
    "secret",
    "api_key",
    ...extraSensitiveKeys.map((key) => key.toLowerCase()),
  ]);
  const visit = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(visit);
    if (!plainObject(item)) return item;
    return Object.fromEntries(
      Object.entries(item).map(([key, nested]) => [
        key,
        sensitive.has(key.toLowerCase()) ? "[REDACTED]" : visit(nested),
      ]),
    );
  };
  return visit(value);
}
