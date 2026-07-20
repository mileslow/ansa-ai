import {
  decryptSecret,
  encryptSecret,
  getMailboxConnection,
  listActiveMailboxConnections,
  saveMailboxConnection,
  type MailboxConnection,
} from "./mailbox-tokens";
import type { SourceConnector, SourceFetchResult, SourceHit, SourceQuery } from "./types";

const HIT_PREFIX = "outlook:";

async function refreshOutlookToken(conn: MailboxConnection) {
  if (new Date(conn.expiresAt).getTime() > Date.now() + 60_000) {
    return decryptSecret(conn.accessTokenEnc);
  }
  const clientId = process.env.OUTLOOK_OAUTH_CLIENT_ID;
  const clientSecret = process.env.OUTLOOK_OAUTH_CLIENT_SECRET;
  const tenant = process.env.OUTLOOK_OAUTH_TENANT || "common";
  if (!clientId || !clientSecret) throw new Error("Outlook OAuth client is not configured");
  const refreshToken = decryptSecret(conn.refreshTokenEnc);
  if (!refreshToken) throw new Error("Outlook refresh token is missing; reconnect the mailbox");
  const response = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: "offline_access Mail.Read User.Read",
      }),
    },
  );
  if (!response.ok)
    throw new Error(`Outlook token refresh failed (${response.status})`);
  const json = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  await saveMailboxConnection({
    ...conn,
    accessTokenEnc: encryptSecret(json.access_token),
    ...(json.refresh_token
      ? { refreshTokenEnc: encryptSecret(json.refresh_token) }
      : {}),
    expiresAt: new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString(),
  });
  return json.access_token;
}

function buildOutlookSearch(query: SourceQuery) {
  const terms = [
    ...(query.employerName ? [query.employerName] : []),
    ...(query.planYear ? [query.planYear] : []),
    ...(query.keywords || []),
  ].filter(Boolean);
  if (!terms.length) return "benefits OR renewal OR SBC OR rate";
  return terms.join(" ");
}

async function graphFetch(path: string, accessToken: string) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Microsoft Graph error ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

export const outlookConnector: SourceConnector = {
  id: "outlook",
  async list(query: SourceQuery): Promise<SourceHit[]> {
    const connections = query.connectionIds?.length
      ? (
          await Promise.all(query.connectionIds.map((id) => getMailboxConnection(id)))
        ).filter((c): c is MailboxConnection => Boolean(c && c.provider === "outlook"))
      : await listActiveMailboxConnections(query.ownerId, "outlook");
    if (!connections.length) return [];

    const limit = Math.min(query.limit ?? 15, 25);
    const hits: SourceHit[] = [];
    const search = encodeURIComponent(buildOutlookSearch(query));
    for (const conn of connections) {
      const token = await refreshOutlookToken(conn);
      const list = (await graphFetch(
        `/me/messages?$search="${search}"&$top=${limit}&$select=id,subject,bodyPreview,receivedDateTime,from,hasAttachments`,
        token,
      )) as {
        value?: Array<{
          id: string;
          subject?: string;
          bodyPreview?: string;
          receivedDateTime?: string;
          hasAttachments?: boolean;
          from?: { emailAddress?: { address?: string } };
        }>;
      };
      for (const message of list.value || []) {
        hits.push({
          id: `${HIT_PREFIX}${conn.id}:${message.id}`,
          connectorId: "outlook",
          title: message.subject || `Outlook message ${message.id}`,
          snippet: message.bodyPreview,
          receivedAt: message.receivedDateTime || null,
          meta: {
            connectionId: conn.id,
            messageId: message.id,
            from: message.from?.emailAddress?.address || null,
            hasAttachments: Boolean(message.hasAttachments),
          },
        });
        if (hits.length >= limit) break;
      }
      if (hits.length >= limit) break;
    }
    return hits.slice(0, limit);
  },

  async fetch(hitId: string, query: SourceQuery): Promise<SourceFetchResult> {
    if (!hitId.startsWith(HIT_PREFIX)) throw new Error(`Invalid Outlook hit id: ${hitId}`);
    const rest = hitId.slice(HIT_PREFIX.length);
    const colon = rest.indexOf(":");
    if (colon < 0) throw new Error(`Invalid Outlook hit id: ${hitId}`);
    const connectionId = rest.slice(0, colon);
    const messageId = rest.slice(colon + 1);
    const conn = await getMailboxConnection(connectionId);
    if (!conn || conn.ownerId !== query.ownerId || conn.provider !== "outlook")
      throw new Error("Outlook connection not found for this user");
    const token = await refreshOutlookToken(conn);
    const message = (await graphFetch(
      `/me/messages/${messageId}?$select=id,subject,body,receivedDateTime,from`,
      token,
    )) as {
      id: string;
      subject?: string;
      body?: { content?: string; contentType?: string };
      receivedDateTime?: string;
      from?: { emailAddress?: { address?: string } };
    };
    const attachments = (await graphFetch(
      `/me/messages/${messageId}/attachments`,
      token,
    )) as {
      value?: Array<{
        id: string;
        name?: string;
        contentType?: string;
        contentBytes?: string;
        "@odata.type"?: string;
      }>;
    };
    const fileAttachment = (attachments.value || []).find(
      (item) => item["@odata.type"]?.includes("fileAttachment") && item.contentBytes,
    );
    if (fileAttachment?.contentBytes) {
      const fileName = fileAttachment.name || `outlook-attachment-${fileAttachment.id}`;
      const mimeType = fileAttachment.contentType || "application/octet-stream";
      return {
        hit: {
          id: hitId,
          connectorId: "outlook",
          title: fileName,
          fileName,
          mimeType,
          meta: { connectionId, messageId, attachmentId: fileAttachment.id },
        },
        fileName,
        mimeType,
        data: Buffer.from(fileAttachment.contentBytes, "base64"),
        sourceKind: "mailbox_attachment",
        intakeCategory: "documents",
      };
    }

    const text = [
      `From: ${message.from?.emailAddress?.address || ""}`,
      `Subject: ${message.subject || ""}`,
      `Date: ${message.receivedDateTime || ""}`,
      "",
      message.body?.content || "",
    ].join("\n");
    const fileName = `outlook-${messageId.slice(0, 12)}.txt`;
    return {
      hit: {
        id: hitId,
        connectorId: "outlook",
        title: message.subject || fileName,
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

export function outlookAuthUrl(state: string) {
  const clientId = process.env.OUTLOOK_OAUTH_CLIENT_ID;
  const redirectUri = process.env.OUTLOOK_OAUTH_REDIRECT_URI;
  const tenant = process.env.OUTLOOK_OAUTH_TENANT || "common";
  if (!clientId || !redirectUri) throw new Error("Outlook OAuth is not configured");
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: "offline_access Mail.Read User.Read",
    state,
  });
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeOutlookCode(code: string) {
  const clientId = process.env.OUTLOOK_OAUTH_CLIENT_ID;
  const clientSecret = process.env.OUTLOOK_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.OUTLOOK_OAUTH_REDIRECT_URI;
  const tenant = process.env.OUTLOOK_OAUTH_TENANT || "common";
  if (!clientId || !clientSecret || !redirectUri)
    throw new Error("Outlook OAuth is not configured");
  const response = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: "offline_access Mail.Read User.Read",
      }),
    },
  );
  if (!response.ok)
    throw new Error(`Outlook code exchange failed (${response.status})`);
  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  }>;
}

export async function fetchOutlookProfileEmail(accessToken: string) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { mail?: string; userPrincipalName?: string };
  return json.mail || json.userPrincipalName || null;
}
