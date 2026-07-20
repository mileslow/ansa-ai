import { randomUUID } from "node:crypto";
import { getAdminServices } from "../firebase-admin";
import { createBookletThread, getBookletThread } from "../booklet-thread-store";
import type { AgentSession, BookletPreferences, ChannelId, PendingEmailSend } from "./types";

const COLLECTION = "brokerAgentSessions";

export async function createAgentSession({
  ownerId,
  companyId,
  channel,
  bookletThreadId,
  mailboxConnectionIds = [],
  preferences = {},
}: {
  ownerId: string;
  companyId: string;
  channel: ChannelId;
  bookletThreadId?: string;
  mailboxConnectionIds?: string[];
  preferences?: BookletPreferences;
}): Promise<AgentSession> {
  const { db } = getAdminServices();
  const thread =
    bookletThreadId != null
      ? await getBookletThread(bookletThreadId)
      : await createBookletThread(companyId, ownerId);
  if (!thread) throw new Error("Booklet thread was not found");
  if (thread.ownerId !== ownerId)
    throw new Error("Booklet thread belongs to another user");
  if (thread.companyId !== companyId)
    throw new Error("Booklet thread belongs to another company");

  const now = new Date().toISOString();
  const session: AgentSession = {
    id: randomUUID(),
    ownerId,
    companyId,
    bookletThreadId: thread.id,
    bookletRunId: thread.latestRunId || null,
    channel,
    mailboxConnectionIds,
    preferences,
    pendingEmailSend: null,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COLLECTION).doc(session.id).set(session);
  return session;
}

export async function getAgentSession(sessionId: string) {
  const { db } = getAdminServices();
  const snapshot = await db.collection(COLLECTION).doc(sessionId).get();
  return snapshot.exists ? (snapshot.data() as AgentSession) : null;
}

export async function saveAgentSession(session: AgentSession) {
  const { db } = getAdminServices();
  const updated = { ...session, updatedAt: new Date().toISOString() };
  await db.collection(COLLECTION).doc(session.id).set(updated, { merge: true });
  return updated;
}

export async function updateSessionPreferences(
  session: AgentSession,
  preferences: BookletPreferences,
) {
  return saveAgentSession({
    ...session,
    preferences: { ...session.preferences, ...preferences },
  });
}

export async function setPendingEmailSend(
  session: AgentSession,
  pending: PendingEmailSend | null,
) {
  return saveAgentSession({ ...session, pendingEmailSend: pending });
}

export async function listMailboxConnections(ownerId: string) {
  const { db } = getAdminServices();
  const snapshot = await db
    .collection("brokerMailboxConnections")
    .where("ownerId", "==", ownerId)
    .where("status", "==", "active")
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as object) }));
}
