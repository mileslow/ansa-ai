import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getAdminServices } from "../../firebase-admin";
import { isMailboxOAuthEnabled } from "../flags";

export type MailboxProvider = "gmail" | "outlook";

export type MailboxConnection = {
  id: string;
  ownerId: string;
  provider: MailboxProvider;
  email?: string | null;
  status: "active" | "revoked" | "error";
  accessTokenEnc: string;
  refreshTokenEnc: string;
  expiresAt: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
};

function tokenSecret() {
  const secret = process.env.MAILBOX_TOKEN_SECRET || process.env.AGENTMAIL_WORKER_SECRET;
  if (!secret || secret.length < 16)
    throw new Error("MAILBOX_TOKEN_SECRET (or AGENTMAIL_WORKER_SECRET) must be set");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string) {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted secret");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    tokenSecret(),
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function assertMailboxOAuthEnabled() {
  if (!isMailboxOAuthEnabled())
    throw new Error("Mailbox OAuth is disabled (set BROKER_MAILBOX_OAUTH=1)");
}

export async function getMailboxConnection(connectionId: string) {
  const { db } = getAdminServices();
  const snapshot = await db.collection("brokerMailboxConnections").doc(connectionId).get();
  return snapshot.exists ? ({ id: snapshot.id, ...snapshot.data() } as MailboxConnection) : null;
}

export async function listActiveMailboxConnections(
  ownerId: string,
  provider?: MailboxProvider,
) {
  const { db } = getAdminServices();
  let query = db
    .collection("brokerMailboxConnections")
    .where("ownerId", "==", ownerId)
    .where("status", "==", "active");
  const snapshot = await query.get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as MailboxConnection))
    .filter((conn) => (provider ? conn.provider === provider : true));
}

export async function saveMailboxConnection(
  connection: Omit<MailboxConnection, "id"> & { id?: string },
) {
  const { db } = getAdminServices();
  const id = connection.id || randomConnectionId(connection.ownerId, connection.provider);
  const record: MailboxConnection = {
    ...connection,
    id,
    updatedAt: new Date().toISOString(),
  };
  await db.collection("brokerMailboxConnections").doc(id).set(record, { merge: true });
  return record;
}

function randomConnectionId(ownerId: string, provider: MailboxProvider) {
  return createHash("sha256")
    .update(`${ownerId}:${provider}:${Date.now()}:${randomBytes(8).toString("hex")}`)
    .digest("hex")
    .slice(0, 40);
}

export async function revokeMailboxConnection(connectionId: string, ownerId: string) {
  const conn = await getMailboxConnection(connectionId);
  if (!conn || conn.ownerId !== ownerId) throw new Error("Mailbox connection not found");
  await saveMailboxConnection({
    ...conn,
    status: "revoked",
    accessTokenEnc: encryptSecret(""),
    refreshTokenEnc: encryptSecret(""),
  });
  return { id: connectionId, status: "revoked" as const };
}

export function buildOAuthState(payload: {
  ownerId: string;
  provider: MailboxProvider;
  returnTo?: string;
}) {
  const body = Buffer.from(JSON.stringify({ ...payload, ts: Date.now() }), "utf8").toString(
    "base64url",
  );
  const sig = createHash("sha256")
    .update(`${body}:${tokenSecret().toString("hex")}`)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function parseOAuthState(state: string) {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("Invalid OAuth state");
  const expected = createHash("sha256")
    .update(`${body}:${tokenSecret().toString("hex")}`)
    .digest("base64url");
  if (expected !== sig) throw new Error("OAuth state signature mismatch");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
    ownerId: string;
    provider: MailboxProvider;
    returnTo?: string;
    ts: number;
  };
  if (Date.now() - payload.ts > 30 * 60 * 1000) throw new Error("OAuth state expired");
  return payload;
}
