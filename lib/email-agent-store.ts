import { randomBytes, randomUUID } from "node:crypto";
import type { DocumentReference } from "firebase-admin/firestore";
import { getAdminServices } from "./firebase-admin";
import {
  normalizeEmailAddress,
  senderIdForEmail,
  stableEmailAgentId,
} from "./email-agent-security";
import type {
  AllowedSender,
  EmailConnection,
  EmailSenderMemory,
  McpConnection,
  NylasWebhookEvent,
  SenderToolGrant,
} from "./email-agent-types";

const nowIso = () => new Date().toISOString();

function publicConnection(value: EmailConnection): EmailConnection {
  return {
    ...value,
    nylasGrantId: value.nylasGrantId,
  };
}

export async function createEmailOAuthState(input: {
  ownerId: string;
  redirectAfter?: string;
}) {
  const id = randomBytes(32).toString("base64url");
  const now = Date.now();
  const redirectAfter =
    input.redirectAfter?.startsWith("/") && !input.redirectAfter.startsWith("//")
      ? input.redirectAfter
      : "/email-agent";
  await getAdminServices().db.collection("emailOAuthStates").doc(id).set({
    ownerId: input.ownerId,
    redirectAfter,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
  });
  return { id, redirectAfter };
}

export async function consumeEmailOAuthState(id: string) {
  const { db } = getAdminServices();
  const ref = db.collection("emailOAuthStates").doc(id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("OAuth state is invalid or has already been used");
    const state = snapshot.data() as {
      ownerId?: string;
      redirectAfter?: string;
      expiresAt?: string;
    };
    if (!state.ownerId || !state.expiresAt || Date.parse(state.expiresAt) <= Date.now()) {
      transaction.delete(ref);
      throw new Error("OAuth state is invalid or expired");
    }
    transaction.delete(ref);
    return {
      ownerId: state.ownerId,
      redirectAfter: state.redirectAfter || "/email-agent",
    };
  });
}

export async function attachEmailConnection(input: {
  ownerId: string;
  grantId: string;
  emailAddress: string;
}) {
  const { db } = getAdminServices();
  const grantOwnerRef = db
    .collection("nylasGrantOwners")
    .doc(stableEmailAgentId(input.grantId, 56));
  return db.runTransaction(async (transaction) => {
    const grantOwner = await transaction.get(grantOwnerRef);
    const grantData = grantOwner.data() as
      | { ownerId?: string; connectionId?: string }
      | undefined;
    if (grantData?.ownerId && grantData.ownerId !== input.ownerId)
      throw new Error("This Gmail grant is already connected to another Flux user");
    const connectionId = grantData?.connectionId || randomUUID();
    const connectionRef = db.collection("emailConnections").doc(connectionId);
    const existing = await transaction.get(connectionRef);
    const previous = existing.data() as Partial<EmailConnection> | undefined;
    const now = nowIso();
    const record: EmailConnection = {
      id: connectionId,
      ownerId: input.ownerId,
      provider: "google",
      nylasGrantId: input.grantId,
      emailAddress: normalizeEmailAddress(input.emailAddress),
      status: "connected",
      connectedAt: previous?.connectedAt || now,
      updatedAt: now,
      disconnectedAt: null,
      lastWebhookAt: previous?.lastWebhookAt || null,
      lastErrorCode: null,
    };
    transaction.set(connectionRef, record, { merge: true });
    transaction.set(grantOwnerRef, {
      grantId: input.grantId,
      ownerId: input.ownerId,
      connectionId,
      updatedAt: now,
    });
    return publicConnection(record);
  });
}

export async function listEmailConnections(ownerId: string) {
  const snapshot = await getAdminServices()
    .db.collection("emailConnections")
    .where("ownerId", "==", ownerId)
    .get();
  return snapshot.docs
    .map((item) => publicConnection(item.data() as EmailConnection))
    .sort((left, right) => right.connectedAt.localeCompare(left.connectedAt));
}

export async function getEmailConnection(connectionId: string) {
  const snapshot = await getAdminServices()
    .db.collection("emailConnections")
    .doc(connectionId)
    .get();
  return snapshot.exists ? (snapshot.data() as EmailConnection) : null;
}

export async function getEmailConnectionByGrant(grantId: string) {
  const { db } = getAdminServices();
  const owner = await db
    .collection("nylasGrantOwners")
    .doc(stableEmailAgentId(grantId, 56))
    .get();
  const connectionId = owner.data()?.connectionId;
  return typeof connectionId === "string" ? getEmailConnection(connectionId) : null;
}

export async function updateEmailConnection(
  connectionId: string,
  patch: Partial<EmailConnection>,
) {
  await getAdminServices()
    .db.collection("emailConnections")
    .doc(connectionId)
    .set({ ...patch, updatedAt: nowIso() }, { merge: true });
}

export async function markEmailConnectionDisconnected(connectionId: string) {
  const now = nowIso();
  await updateEmailConnection(connectionId, {
    status: "disconnected",
    disconnectedAt: now,
  });
}

function senderCollection(connectionId: string) {
  return getAdminServices()
    .db.collection("emailConnections")
    .doc(connectionId)
    .collection("allowedSenders");
}

export async function listAllowedSenders(connectionId: string) {
  const snapshot = await senderCollection(connectionId).get();
  return snapshot.docs
    .map((item) => item.data() as AllowedSender)
    .sort((left, right) => left.normalizedEmail.localeCompare(right.normalizedEmail));
}

export async function getAllowedSender(connectionId: string, email: string) {
  const id = senderIdForEmail(email);
  const snapshot = await senderCollection(connectionId).doc(id).get();
  return snapshot.exists ? (snapshot.data() as AllowedSender) : null;
}

export async function putAllowedSender(input: {
  connectionId: string;
  email: string;
  createdBy: string;
}) {
  const normalizedEmail = normalizeEmailAddress(input.email);
  const id = senderIdForEmail(normalizedEmail);
  const ref = senderCollection(input.connectionId).doc(id);
  const snapshot = await ref.get();
  const current = snapshot.data() as Partial<AllowedSender> | undefined;
  const now = nowIso();
  const record: AllowedSender = {
    id,
    normalizedEmail,
    displayEmail: String(input.email).trim(),
    enabled: true,
    createdBy: current?.createdBy || input.createdBy,
    createdAt: current?.createdAt || now,
    updatedAt: now,
  };
  await ref.set(record, { merge: true });
  return record;
}

export async function disableAllowedSender(connectionId: string, senderId: string) {
  const ref = senderCollection(connectionId).doc(senderId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return false;
  await ref.set({ enabled: false, updatedAt: nowIso() }, { merge: true });
  return true;
}

function senderMemoryCollection(connectionId: string, senderId: string) {
  return senderCollection(connectionId).doc(senderId).collection("memories");
}

export async function listSenderMemories(
  connectionId: string,
  senderId: string,
  limit = 50,
) {
  const snapshot = await senderMemoryCollection(connectionId, senderId).get();
  return snapshot.docs
    .map((item) => item.data() as EmailSenderMemory)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, Math.min(100, Math.max(1, Math.floor(limit))));
}

export async function putSenderMemory(input: {
  ownerId: string;
  connectionId: string;
  senderId: string;
  senderEmail: string;
  key: string;
  value: string;
  category: EmailSenderMemory["category"];
  sourceMessageId: string;
}) {
  const { db } = getAdminServices();
  const id = stableEmailAgentId(`${input.senderId}:${input.key}`, 48);
  const ref = senderMemoryCollection(input.connectionId, input.senderId).doc(id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data() as Partial<EmailSenderMemory> | undefined;
    const now = nowIso();
    const record: EmailSenderMemory = {
      ...input,
      id,
      senderEmail: normalizeEmailAddress(input.senderEmail),
      createdAt: current?.createdAt || now,
      updatedAt: now,
    };
    transaction.set(ref, record);
    return record;
  });
}

export async function deleteSenderMemory(
  connectionId: string,
  senderId: string,
  key: string,
) {
  const id = stableEmailAgentId(`${senderId}:${key}`, 48);
  const ref = senderMemoryCollection(connectionId, senderId).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return false;
  await ref.delete();
  return true;
}

export async function listMcpConnections(ownerId: string) {
  const snapshot = await getAdminServices()
    .db.collection("mcpConnections")
    .where("ownerId", "==", ownerId)
    .get();
  return snapshot.docs.map((item) => item.data() as McpConnection);
}

export async function getMcpConnection(id: string) {
  const snapshot = await getAdminServices().db.collection("mcpConnections").doc(id).get();
  return snapshot.exists ? (snapshot.data() as McpConnection) : null;
}

function toolGrantCollection(connectionId: string, senderId: string) {
  return senderCollection(connectionId)
    .doc(senderId)
    .collection("toolGrants");
}

export async function listSenderToolGrants(
  connectionId: string,
  senderId: string,
) {
  const snapshot = await toolGrantCollection(connectionId, senderId).get();
  return snapshot.docs.map((item) => item.data() as SenderToolGrant);
}

export async function putSenderToolGrant(input: {
  connectionId: string;
  senderId: string;
  mcpConnectionId: string;
  allowedTools: string[];
  approvalMode: "automatic" | "owner_approval";
  enabled: boolean;
  createdBy: string;
}) {
  const id = stableEmailAgentId(input.mcpConnectionId, 48);
  const ref = toolGrantCollection(input.connectionId, input.senderId).doc(id);
  const snapshot = await ref.get();
  const current = snapshot.data() as Partial<SenderToolGrant> | undefined;
  const now = nowIso();
  const record: SenderToolGrant = {
    id,
    mcpConnectionId: input.mcpConnectionId,
    allowedTools: [...new Set(input.allowedTools)].sort(),
    approvalMode: input.approvalMode,
    enabled: input.enabled,
    createdBy: current?.createdBy || input.createdBy,
    createdAt: current?.createdAt || now,
    updatedAt: now,
  };
  await ref.set(record, { merge: true });
  return record;
}

export async function ensureEmailEventQueued(
  event: NylasWebhookEvent,
  connectionId?: string,
) {
  const { db } = getAdminServices();
  const id = stableEmailAgentId(event.id, 56);
  const ref = db.collection("emailEvents").doc(id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists)
      return {
        created: false as const,
        currentStatus: String(snapshot.data()?.status || "queued"),
        ref,
        id,
      };
    const now = nowIso();
    transaction.create(ref, {
      id,
      connectionId: connectionId || null,
      nylasEventId: event.id,
      eventType: event.type,
      messageId: event.type === "message.created" ? event.data.object.id : null,
      threadId: event.data.object.threadId || null,
      grantId: event.data.object.grantId || null,
      status: "queued",
      attempts: 0,
      leaseUntil: null,
      createdAt: now,
      updatedAt: now,
    });
    return { created: true as const, currentStatus: "queued", ref, id };
  });
}

export async function acquireEmailEvent(eventId: string, maximumAttempts = 5) {
  const { db } = getAdminServices();
  const id = stableEmailAgentId(eventId, 56);
  const ref = db.collection("emailEvents").doc(id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data() as
      | { status?: string; attempts?: number; leaseUntil?: string | null }
      | undefined;
    if (current?.status === "complete")
      return { acquired: false as const, reason: "complete", attempt: current.attempts || 0, ref };
    if (
      current?.status === "processing" &&
      current.leaseUntil &&
      Date.parse(current.leaseUntil) > Date.now()
    )
      return { acquired: false as const, reason: "leased", attempt: current.attempts || 0, ref };
    const attempt = (current?.attempts || 0) + 1;
    if (attempt > maximumAttempts) {
      transaction.set(ref, {
        status: "failed",
        outcome: "attempt_limit_exceeded",
        leaseUntil: null,
        updatedAt: nowIso(),
      }, { merge: true });
      return { acquired: false as const, reason: "attempt_limit", attempt, ref };
    }
    transaction.set(ref, {
      status: "processing",
      attempts: attempt,
      leaseUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      updatedAt: nowIso(),
    }, { merge: true });
    return { acquired: true as const, reason: "acquired", attempt, ref };
  });
}

export async function finishEmailEvent(
  ref: DocumentReference,
  input: { status: "complete" | "failed"; outcome: string; lastError?: string },
) {
  await ref.set({
    status: input.status,
    outcome: input.outcome,
    lastError: input.lastError?.slice(0, 2_000) || null,
    leaseUntil: null,
    updatedAt: nowIso(),
  }, { merge: true });
}

export async function claimInboundEmailMessage(input: {
  connectionId: string;
  messageId: string;
  eventId: string;
}) {
  const { db } = getAdminServices();
  const id = stableEmailAgentId(`${input.connectionId}:${input.messageId}`, 56);
  const ref = db.collection("emailMessageClaims").doc(id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data() as
      | { eventId?: string; status?: string }
      | undefined;
    if (current && current.eventId !== input.eventId)
      return { claimed: false as const, reason: "message_already_claimed", ref };
    if (current && !["failed", "queued"].includes(current.status || ""))
      return { claimed: false as const, reason: "message_already_processing", ref };
    const now = nowIso();
    transaction.set(ref, {
      id,
      connectionId: input.connectionId,
      messageId: input.messageId,
      eventId: input.eventId,
      status: "processing",
      ...(!current ? { createdAt: now } : {}),
      updatedAt: now,
    }, { merge: true });
    return { claimed: true as const, reason: "claimed", ref };
  });
}

export async function updateInboundEmailMessageClaim(
  ref: DocumentReference,
  status: "waiting_approval" | "complete" | "failed",
  sentMessageId?: string,
) {
  await ref.set({
    status,
    sentMessageId: sentMessageId || null,
    updatedAt: nowIso(),
  }, { merge: true });
}

export async function writeEmailAgentAudit(input: {
  connectionId: string;
  messageId: string;
  senderEmail: string;
  decision: "ignored" | "model_called" | "reply_sent" | "failed";
  reason: string;
  model?: string;
  sentMessageId?: string;
  webSearchUsed?: boolean;
  webSearchSources?: string[];
  memoryToolCalls?: string[];
}) {
  let senderEmail = "";
  if (input.senderEmail) {
    try {
      senderEmail = normalizeEmailAddress(input.senderEmail);
    } catch {
      senderEmail = "";
    }
  }
  await getAdminServices().db.collection("emailAgentAudit").doc(randomUUID()).set({
    ...input,
    senderEmail,
    createdAt: nowIso(),
  });
}

export async function writeEmailMemoryToolRun(input: {
  ownerId: string;
  connectionId: string;
  inboundMessageId: string;
  senderEmail: string;
  toolCallId: string;
  toolName: string;
  status: string;
  resultCount: number;
}) {
  await getAdminServices().db.collection("emailMemoryToolRuns").doc(randomUUID()).set({
    ...input,
    senderEmail: normalizeEmailAddress(input.senderEmail),
    createdAt: nowIso(),
  });
}

export async function enforceEmailAgentRateLimits(input: {
  connectionId: string;
  senderEmail: string;
  senderHourly: number;
  mailboxHourly: number;
  globalPerMinute: number;
}) {
  const { db } = getAdminServices();
  const now = new Date();
  const hour = now.toISOString().slice(0, 13);
  const minute = now.toISOString().slice(0, 16);
  const sender = normalizeEmailAddress(input.senderEmail);
  const specs = [
    {
      id: stableEmailAgentId(`sender:${input.connectionId}:${sender}:${hour}`, 56),
      limit: input.senderHourly,
    },
    {
      id: stableEmailAgentId(`mailbox:${input.connectionId}:${hour}`, 56),
      limit: input.mailboxHourly,
    },
    { id: stableEmailAgentId(`global:${minute}`, 56), limit: input.globalPerMinute },
  ];
  const refs = specs.map((spec) => db.collection("emailAgentRateLimits").doc(spec.id));
  return db.runTransaction(async (transaction) => {
    const snapshots = [];
    for (const ref of refs) snapshots.push(await transaction.get(ref));
    const blocked = snapshots.some((snapshot, index) =>
      Number(snapshot.data()?.count || 0) >= specs[index].limit,
    );
    if (blocked) return false;
    refs.forEach((ref, index) => {
      transaction.set(ref, {
        count: Number(snapshots[index].data()?.count || 0) + 1,
        updatedAt: nowIso(),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      }, { merge: true });
    });
    return true;
  });
}

export type EmailAgentApprovalRecord = {
  id: string;
  ownerId: string;
  connectionId: string;
  eventId: string;
  messageId: string;
  senderEmail: string;
  status: "pending" | "processing" | "approved" | "denied" | "failed";
  toolRequests: Array<{
    approvalRequestId: string;
    serverLabel: string;
    toolName: string;
    arguments: unknown;
  }>;
  encryptedPayload: string;
  createdAt: string;
  updatedAt: string;
};

export async function createEmailAgentApproval(
  input: Omit<EmailAgentApprovalRecord, "id" | "status" | "createdAt" | "updatedAt">,
) {
  const id = randomUUID();
  const now = nowIso();
  const record: EmailAgentApprovalRecord = {
    ...input,
    id,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  await getAdminServices().db.collection("emailAgentApprovals").doc(id).set(record);
  return record;
}

export async function listEmailAgentApprovals(ownerId: string) {
  const snapshot = await getAdminServices()
    .db.collection("emailAgentApprovals")
    .where("ownerId", "==", ownerId)
    .get();
  return snapshot.docs
    .map((item) => item.data() as EmailAgentApprovalRecord)
    .filter((item) => item.status === "pending")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function claimEmailAgentApproval(id: string, ownerId: string) {
  const { db } = getAdminServices();
  const ref = db.collection("emailAgentApprovals").doc(id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("Approval request not found");
    const record = snapshot.data() as EmailAgentApprovalRecord;
    if (record.ownerId !== ownerId) throw new Error("Approval request belongs to another user");
    if (record.status !== "pending") throw new Error("Approval request is no longer pending");
    transaction.set(ref, { status: "processing", updatedAt: nowIso() }, { merge: true });
    return { ...record, status: "processing" as const };
  });
}

export async function updateEmailAgentApproval(
  id: string,
  patch: Partial<EmailAgentApprovalRecord>,
) {
  await getAdminServices()
    .db.collection("emailAgentApprovals")
    .doc(id)
    .set({ ...patch, updatedAt: nowIso() }, { merge: true });
}

export async function writeMcpToolRun(input: Record<string, unknown>) {
  const id = typeof input.id === "string" ? input.id : randomUUID();
  await getAdminServices().db.collection("mcpToolRuns").doc(id).set({
    ...input,
    id,
    createdAt: input.createdAt || nowIso(),
  }, { merge: true });
  return id;
}
