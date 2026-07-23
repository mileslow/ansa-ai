import {
  decryptSecret,
  getMailboxConnection,
  listActiveMailboxConnections,
  type MailboxConnection,
} from "../broker-agent/sources/mailbox-tokens";
import { saveMailboxConnection, encryptSecret } from "../broker-agent/sources/mailbox-tokens";

async function refreshAccessToken(conn: MailboxConnection) {
  if (new Date(conn.expiresAt).getTime() > Date.now() + 60_000) {
    return decryptSecret(conn.accessTokenEnc);
  }
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Gmail OAuth client is not configured");
  const refreshToken = decryptSecret(conn.refreshTokenEnc);
  if (!refreshToken) throw new Error("Gmail refresh token is missing; reconnect Gmail");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error(`Gmail token refresh failed (${response.status})`);
  const json = (await response.json()) as { access_token: string; expires_in?: number };
  await saveMailboxConnection({
    ...conn,
    accessTokenEnc: encryptSecret(json.access_token),
    expiresAt: new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString(),
  });
  return json.access_token;
}

export async function gmailApi(
  path: string,
  accessToken: string,
  init?: RequestInit & { json?: unknown },
) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.json ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail API ${path} failed (${response.status}): ${text.slice(0, 400)}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function getOwnerGmailConnection(ownerId: string, connectionId?: string | null) {
  if (connectionId) {
    const conn = await getMailboxConnection(connectionId);
    if (!conn || conn.ownerId !== ownerId || conn.provider !== "gmail")
      throw new Error("Gmail connection not found");
    return conn;
  }
  const list = await listActiveMailboxConnections(ownerId, "gmail");
  if (!list.length) throw new Error("No active Gmail connection");
  return list[0];
}

export async function startGmailWatch(conn: MailboxConnection) {
  const topic = process.env.GMAIL_PUBSUB_TOPIC;
  if (!topic)
    throw new Error("GMAIL_PUBSUB_TOPIC is not configured (projects/.../topics/...)");
  const token = await refreshAccessToken(conn);
  const result = (await gmailApi("/users/me/watch", token, {
    method: "POST",
    json: {
      topicName: topic,
      labelIds: ["INBOX"],
    },
  })) as { historyId?: string; expiration?: string };
  return {
    historyId: result.historyId || null,
    expiration: result.expiration
      ? new Date(Number(result.expiration)).toISOString()
      : null,
  };
}

export async function stopGmailWatch(conn: MailboxConnection) {
  const token = await refreshAccessToken(conn);
  await gmailApi("/users/me/stop", token, { method: "POST" });
}

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  labelIds: string[];
};

function headerMap(headers: Array<{ name: string; value: string }> | undefined) {
  return Object.fromEntries(
    (headers || []).map((h) => [h.name.toLowerCase(), h.value]),
  );
}

function decodeBody(data?: string) {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function extractText(payload: {
  mimeType?: string;
  body?: { data?: string };
  parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>;
}): string {
  if (payload.body?.data && payload.mimeType?.startsWith("text/"))
    return decodeBody(payload.body.data);
  for (const part of payload.parts || []) {
    if (part.mimeType === "text/plain" && part.body?.data)
      return decodeBody(part.body.data);
  }
  for (const part of payload.parts || []) {
    const nested = extractText(part as typeof payload);
    if (nested) return nested;
  }
  return "";
}

export async function fetchGmailMessage(
  conn: MailboxConnection,
  messageId: string,
): Promise<GmailMessageSummary> {
  const token = await refreshAccessToken(conn);
  const detail = (await gmailApi(
    `/users/me/messages/${messageId}?format=full`,
    token,
  )) as {
    id: string;
    threadId: string;
    labelIds?: string[];
    payload?: {
      mimeType?: string;
      headers?: Array<{ name: string; value: string }>;
      body?: { data?: string };
      parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>;
    };
  };
  const headers = headerMap(detail.payload?.headers);
  return {
    id: detail.id,
    threadId: detail.threadId,
    from: headers.from || "",
    to: String(headers.to || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    subject: headers.subject || "",
    body: extractText(detail.payload || {}),
    labelIds: detail.labelIds || [],
  };
}

export async function listHistoryMessageIds(
  conn: MailboxConnection,
  startHistoryId: string,
) {
  const token = await refreshAccessToken(conn);
  const ids = new Set<string>();
  let pageToken: string | undefined;
  do {
    const path =
      `/users/me/history?startHistoryId=${encodeURIComponent(startHistoryId)}&historyTypes=messageAdded` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const result = (await gmailApi(path, token)) as {
      history?: Array<{ messagesAdded?: Array<{ message?: { id?: string } }> }>;
      historyId?: string;
      nextPageToken?: string;
    };
    for (const row of result.history || []) {
      for (const added of row.messagesAdded || []) {
        if (added.message?.id) ids.add(added.message.id);
      }
    }
    pageToken = result.nextPageToken;
  } while (pageToken);
  return [...ids];
}

function encodeRawEmail(raw: string) {
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createReplyDraft(
  conn: MailboxConnection,
  message: GmailMessageSummary,
  bodyText: string,
) {
  const token = await refreshAccessToken(conn);
  const raw = [
    `To: ${message.from}`,
    `Subject: ${message.subject?.toLowerCase().startsWith("re:") ? message.subject : `Re: ${message.subject || ""}`}`,
    `In-Reply-To: ${message.id}`,
    `References: ${message.id}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    "",
    bodyText,
  ].join("\r\n");

  const draft = (await gmailApi("/users/me/drafts", token, {
    method: "POST",
    json: {
      message: {
        threadId: message.threadId,
        raw: encodeRawEmail(raw),
      },
    },
  })) as { id?: string };

  return { draftId: draft.id || null };
}

export function isNoiseEmail(message: GmailMessageSummary, inboxEmail?: string | null) {
  const from = message.from.toLowerCase();
  if (inboxEmail && from.includes(inboxEmail.toLowerCase())) return true;
  if (/noreply|no-reply|donotreply|mailer-daemon|calendar-notification|notifications@/i.test(from))
    return true;
  if (message.labelIds.includes("DRAFT") || message.labelIds.includes("SENT")) return true;
  if (/^unsubscribe$/i.test(message.subject.trim())) return true;
  return false;
}
