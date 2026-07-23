import {
  decryptSecret,
  encryptSecret,
  getMailboxConnection,
  listActiveMailboxConnections,
  saveMailboxConnection,
  type MailboxConnection,
} from "./mailbox-tokens";
import type { SourceConnector, SourceFetchResult, SourceHit, SourceQuery } from "./types";

const HIT_PREFIX = "gmail:";

async function refreshGmailToken(conn: MailboxConnection) {
  if (new Date(conn.expiresAt).getTime() > Date.now() + 60_000) {
    return decryptSecret(conn.accessTokenEnc);
  }
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Gmail OAuth client is not configured");
  const refreshToken = decryptSecret(conn.refreshTokenEnc);
  if (!refreshToken) throw new Error("Gmail refresh token is missing; reconnect the mailbox");
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
  if (!response.ok)
    throw new Error(`Gmail token refresh failed (${response.status})`);
  const json = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };
  const expiresAt = new Date(
    Date.now() + (json.expires_in || 3600) * 1000,
  ).toISOString();
  await saveMailboxConnection({
    ...conn,
    accessTokenEnc: encryptSecret(json.access_token),
    expiresAt,
  });
  return json.access_token;
}

function buildGmailQuery(query: SourceQuery) {
  const parts = ["has:attachment"];
  if (query.employerName) parts.push(`"${query.employerName}"`);
  if (query.planYear) parts.push(query.planYear);
  for (const keyword of query.keywords || []) {
    if (keyword.trim()) parts.push(keyword.trim());
  }
  if (!(query.keywords || []).length && !query.employerName) {
    parts.push("(rate OR SBC OR SPD OR booklet OR renewal OR benefits)");
  }
  return parts.join(" ");
}

async function gmailFetch(path: string, accessToken: string) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail API error ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

export const gmailConnector: SourceConnector = {
  id: "gmail",
  async list(query: SourceQuery): Promise<SourceHit[]> {
    const connections = query.connectionIds?.length
      ? (
          await Promise.all(query.connectionIds.map((id) => getMailboxConnection(id)))
        ).filter((c): c is MailboxConnection => Boolean(c && c.provider === "gmail"))
      : await listActiveMailboxConnections(query.ownerId, "gmail");
    if (!connections.length) return [];

    const limit = Math.min(query.limit ?? 15, 25);
    const hits: SourceHit[] = [];
    for (const conn of connections) {
      const token = await refreshGmailToken(conn);
      const q = encodeURIComponent(buildGmailQuery(query));
      const list = (await gmailFetch(
        `/users/me/messages?q=${q}&maxResults=${limit}`,
        token,
      )) as { messages?: Array<{ id: string }> };
      for (const message of list.messages || []) {
        const detail = (await gmailFetch(
          `/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          token,
        )) as {
          id: string;
          snippet?: string;
          internalDate?: string;
          payload?: { headers?: Array<{ name: string; value: string }> };
        };
        const headers = Object.fromEntries(
          (detail.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value]),
        );
        hits.push({
          id: `${HIT_PREFIX}${conn.id}:${detail.id}`,
          connectorId: "gmail",
          title: headers.subject || `Gmail message ${detail.id}`,
          snippet: detail.snippet,
          receivedAt: detail.internalDate
            ? new Date(Number(detail.internalDate)).toISOString()
            : headers.date || null,
          meta: {
            connectionId: conn.id,
            messageId: detail.id,
            from: headers.from || null,
          },
        });
        if (hits.length >= limit) break;
      }
      if (hits.length >= limit) break;
    }
    return hits.slice(0, limit);
  },

  async fetch(hitId: string, query: SourceQuery): Promise<SourceFetchResult> {
    if (!hitId.startsWith(HIT_PREFIX)) throw new Error(`Invalid Gmail hit id: ${hitId}`);
    const rest = hitId.slice(HIT_PREFIX.length);
    const colon = rest.indexOf(":");
    if (colon < 0) throw new Error(`Invalid Gmail hit id: ${hitId}`);
    const connectionId = rest.slice(0, colon);
    const messageId = rest.slice(colon + 1);
    const conn = await getMailboxConnection(connectionId);
    if (!conn || conn.ownerId !== query.ownerId || conn.provider !== "gmail")
      throw new Error("Gmail connection not found for this user");
    const token = await refreshGmailToken(conn);
    const detail = (await gmailFetch(
      `/users/me/messages/${messageId}?format=full`,
      token,
    )) as {
      id: string;
      snippet?: string;
      payload?: {
        mimeType?: string;
        body?: { data?: string };
        parts?: Array<{
          filename?: string;
          mimeType?: string;
          body?: { data?: string; attachmentId?: string };
          parts?: unknown[];
        }>;
        headers?: Array<{ name: string; value: string }>;
      };
    };

    const headers = Object.fromEntries(
      (detail.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value]),
    );
    const attachments: Array<{ fileName: string; mimeType: string; attachmentId: string }> =
      [];
    const walk = (part: {
      filename?: string;
      mimeType?: string;
      body?: { data?: string; attachmentId?: string };
      parts?: Array<{
        filename?: string;
        mimeType?: string;
        body?: { data?: string; attachmentId?: string };
        parts?: unknown[];
      }>;
    }) => {
      if (part.body?.attachmentId && part.filename) {
        attachments.push({
          fileName: part.filename,
          mimeType: part.mimeType || "application/octet-stream",
          attachmentId: part.body.attachmentId,
        });
      }
      for (const child of part.parts || []) walk(child as typeof part);
    };
    if (detail.payload) walk(detail.payload);

    if (attachments.length) {
      const first = attachments[0];
      const att = (await gmailFetch(
        `/users/me/messages/${messageId}/attachments/${first.attachmentId}`,
        token,
      )) as { data?: string };
      const data = Buffer.from(att.data || "", "base64url");
      return {
        hit: {
          id: hitId,
          connectorId: "gmail",
          title: first.fileName,
          fileName: first.fileName,
          mimeType: first.mimeType,
          meta: { connectionId, messageId, attachmentId: first.attachmentId },
        },
        fileName: first.fileName,
        mimeType: first.mimeType,
        data,
        sourceKind: "mailbox_attachment",
        intakeCategory: "documents",
      };
    }

    const decode = (value?: string) =>
      value ? Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8") : "";
    let bodyText = decode(detail.payload?.body?.data);
    if (!bodyText && detail.payload?.parts) {
      for (const part of detail.payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          bodyText = decode(part.body.data);
          break;
        }
      }
    }
    const text = [
      `From: ${headers.from || ""}`,
      `Subject: ${headers.subject || ""}`,
      `Date: ${headers.date || ""}`,
      "",
      bodyText || detail.snippet || "",
    ].join("\n");
    const fileName = `gmail-${messageId.slice(0, 12)}.txt`;
    return {
      hit: {
        id: hitId,
        connectorId: "gmail",
        title: headers.subject || fileName,
        fileName,
        mimeType: "text/plain",
        meta: { connectionId, messageId },
      },
      fileName,
      mimeType: "text/plain",
      data: Buffer.from(text, "utf8"),
      text,
      sourceKind: "mailbox_message",
      intakeCategory: "instructions",
    };
  },
};

export function gmailAuthUrl(state: string) {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GMAIL_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) throw new Error("Gmail OAuth is not configured");
  // modify covers watch history + drafts; readonly alone cannot create drafts.
  const scopes = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" ");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGmailCode(code: string) {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri)
    throw new Error("Gmail OAuth is not configured");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok)
    throw new Error(`Gmail code exchange failed (${response.status})`);
  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  }>;
}

export async function fetchGmailProfileEmail(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { email?: string };
  return json.email || null;
}
