import { randomUUID } from "node:crypto";
import { getAdminServices } from "../firebase-admin";

export type AssistantSettings = {
  ownerId: string;
  enabled: boolean;
  paused: boolean;
  allowedCompanyIds: string[];
  brokerDisplayName?: string | null;
  gmailConnectionId?: string | null;
  gmailEmail?: string | null;
  gmailHistoryId?: string | null;
  gmailWatchExpiration?: string | null;
  updatedAt: string;
  createdAt: string;
};

export type ResearchItem = {
  id: string;
  ownerId: string;
  status: "open" | "done";
  companyId?: string | null;
  companyName?: string | null;
  fromEmail: string;
  subject: string;
  questionSnippet: string;
  gmailThreadId?: string | null;
  gmailMessageId?: string | null;
  gmailPermalink?: string | null;
  reason: string;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssistantAudit = {
  id: string;
  ownerId: string;
  companyId?: string | null;
  gmailMessageId: string;
  gmailThreadId: string;
  draftId?: string | null;
  /** What the assistant did with this message. */
  action?:
    | "auto_sent"
    | "escalated"
    | "approval_approved"
    | "approval_denied"
    | "approval_answered"
    | null;
  sentMessageId?: string | null;
  confidence: number;
  needsResearch: boolean;
  sourceRefs: string[];
  createdAt: string;
};

const SETTINGS = "brokerAssistantSettings";
const RESEARCH = "brokerAssistantResearch";
const AUDIT = "brokerAssistantAudit";

export async function getAssistantSettings(ownerId: string) {
  const { db } = getAdminServices();
  const snapshot = await db.collection(SETTINGS).doc(ownerId).get();
  return snapshot.exists ? (snapshot.data() as AssistantSettings) : null;
}

export async function saveAssistantSettings(
  patch: Partial<AssistantSettings> & { ownerId: string },
) {
  const { db } = getAdminServices();
  const existing = await getAssistantSettings(patch.ownerId);
  const now = new Date().toISOString();
  const record: AssistantSettings = {
    ownerId: patch.ownerId,
    enabled: patch.enabled ?? existing?.enabled ?? false,
    paused: patch.paused ?? existing?.paused ?? false,
    allowedCompanyIds:
      patch.allowedCompanyIds ?? existing?.allowedCompanyIds ?? [],
    brokerDisplayName:
      patch.brokerDisplayName !== undefined
        ? patch.brokerDisplayName
        : existing?.brokerDisplayName || null,
    gmailConnectionId:
      patch.gmailConnectionId !== undefined
        ? patch.gmailConnectionId
        : existing?.gmailConnectionId || null,
    gmailEmail:
      patch.gmailEmail !== undefined
        ? patch.gmailEmail
        : existing?.gmailEmail || null,
    gmailHistoryId:
      patch.gmailHistoryId !== undefined
        ? patch.gmailHistoryId
        : existing?.gmailHistoryId || null,
    gmailWatchExpiration:
      patch.gmailWatchExpiration !== undefined
        ? patch.gmailWatchExpiration
        : existing?.gmailWatchExpiration || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await db.collection(SETTINGS).doc(patch.ownerId).set(record, { merge: true });
  return record;
}

export async function createResearchItem(
  item: Omit<ResearchItem, "id" | "createdAt" | "updatedAt" | "status"> & {
    status?: ResearchItem["status"];
  },
) {
  const { db } = getAdminServices();
  const now = new Date().toISOString();
  const record: ResearchItem = {
    ...item,
    id: randomUUID(),
    status: item.status || "open",
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(RESEARCH).doc(record.id).set(record);
  return record;
}

export async function listResearchItems(ownerId: string, status: "open" | "done" | "all" = "open") {
  const { db } = getAdminServices();
  let query = db.collection(RESEARCH).where("ownerId", "==", ownerId);
  const snapshot = await query.limit(100).get();
  return snapshot.docs
    .map((doc) => doc.data() as ResearchItem)
    .filter((item) => (status === "all" ? true : item.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateResearchItem(
  id: string,
  ownerId: string,
  patch: Partial<Pick<ResearchItem, "status" | "note">>,
) {
  const { db } = getAdminServices();
  const ref = db.collection(RESEARCH).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("Research item not found");
  const current = snapshot.data() as ResearchItem;
  if (current.ownerId !== ownerId) throw new Error("Research item belongs to another user");
  const updated = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await ref.set(updated, { merge: true });
  return updated;
}

export type PendingApproval = {
  id: string;
  ownerId: string;
  status: "pending" | "approved" | "denied" | "expired";
  /** Client thread the answer belongs to. */
  clientThreadId: string;
  clientMessageId: string;
  clientFrom: string;
  clientSubject: string;
  /** Reply Ansa proposes to send to the client once approved. */
  proposedReply: string;
  /** What Ansa needs from the broker. */
  brokerQuestion: string;
  companyId?: string | null;
  companyName?: string | null;
  /** Thread of the escalation email sent to the broker. */
  approvalThreadId?: string | null;
  approvalMessageId?: string | null;
  resolutionNote?: string | null;
  createdAt: string;
  updatedAt: string;
};

const APPROVALS = "brokerAssistantApprovals";

export async function createPendingApproval(
  item: Omit<PendingApproval, "id" | "status" | "createdAt" | "updatedAt">,
) {
  const { db } = getAdminServices();
  const now = new Date().toISOString();
  const record: PendingApproval = {
    ...item,
    id: randomUUID(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(APPROVALS).doc(record.id).set(record);
  return record;
}

export async function setApprovalThread(
  id: string,
  approvalThreadId: string | null,
  approvalMessageId: string | null,
) {
  const { db } = getAdminServices();
  await db.collection(APPROVALS).doc(id).set(
    {
      approvalThreadId,
      approvalMessageId,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function findPendingApprovalByThread(
  ownerId: string,
  approvalThreadId: string,
) {
  const { db } = getAdminServices();
  const snapshot = await db
    .collection(APPROVALS)
    .where("ownerId", "==", ownerId)
    .where("approvalThreadId", "==", approvalThreadId)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  return snapshot.empty ? null : (snapshot.docs[0].data() as PendingApproval);
}

export async function resolvePendingApproval(
  id: string,
  status: "approved" | "denied",
  resolutionNote?: string | null,
) {
  const { db } = getAdminServices();
  await db.collection(APPROVALS).doc(id).set(
    {
      status,
      resolutionNote: resolutionNote || null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function listPendingApprovals(ownerId: string, limit = 50) {
  const { db } = getAdminServices();
  const snapshot = await db
    .collection(APPROVALS)
    .where("ownerId", "==", ownerId)
    .where("status", "==", "pending")
    .limit(limit)
    .get();
  return snapshot.docs
    .map((doc) => doc.data() as PendingApproval)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function writeAssistantAudit(
  entry: Omit<AssistantAudit, "id" | "createdAt">,
) {
  const { db } = getAdminServices();
  const record: AssistantAudit = {
    ...entry,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await db.collection(AUDIT).doc(record.id).set(record);
  return record;
}

export async function listAssistantAudit(ownerId: string, limit = 40) {
  const { db } = getAdminServices();
  const snapshot = await db
    .collection(AUDIT)
    .where("ownerId", "==", ownerId)
    .limit(limit)
    .get();
  return snapshot.docs
    .map((doc) => doc.data() as AssistantAudit)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
