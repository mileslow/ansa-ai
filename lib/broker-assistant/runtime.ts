import { createHash } from "node:crypto";
import { CloudTasksClient } from "@google-cloud/tasks";
import { answerQuestion } from "./answer";
import { buildContextPack, resolveCompany } from "./company-context";
import { assertBrokerAssistantEnabled } from "./flags";
import {
  createReplyDraft,
  fetchGmailMessage,
  getOwnerGmailConnection,
  isNoiseEmail,
  listHistoryMessageIds,
  startGmailWatch,
} from "./gmail-ops";
import {
  createResearchItem,
  getAssistantSettings,
  saveAssistantSettings,
  writeAssistantAudit,
} from "./store";
import { getAdminServices } from "../firebase-admin";

export type GmailPushPayload = {
  emailAddress?: string;
  historyId?: string;
};

function stableId(value: string, length = 40) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

async function acquireMessageLease(ownerId: string, messageId: string) {
  const { db } = getAdminServices();
  const id = stableId(`${ownerId}:${messageId}`);
  const ref = db.collection("brokerAssistantMessageLeases").doc(id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data() as { status?: string } | undefined;
    if (current?.status === "complete" || current?.status === "processing")
      return { acquired: false as const, ref };
    transaction.set(
      ref,
      {
        ownerId,
        messageId,
        status: "processing",
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return { acquired: true as const, ref };
  });
}

export async function ensureGmailWatchForOwner(ownerId: string) {
  assertBrokerAssistantEnabled();
  const settings = await getAssistantSettings(ownerId);
  const conn = await getOwnerGmailConnection(ownerId, settings?.gmailConnectionId);
  const watch = await startGmailWatch(conn);
  return saveAssistantSettings({
    ownerId,
    gmailConnectionId: conn.id,
    gmailEmail: conn.email || settings?.gmailEmail || null,
    gmailHistoryId: watch.historyId,
    gmailWatchExpiration: watch.expiration,
    enabled: true,
  });
}

export async function processOwnerHistory(ownerId: string, incomingHistoryId?: string) {
  assertBrokerAssistantEnabled();
  const settings = await getAssistantSettings(ownerId);
  if (!settings?.enabled || settings.paused)
    return { status: "skipped" as const, reason: "assistant paused or disabled" };

  const conn = await getOwnerGmailConnection(ownerId, settings.gmailConnectionId);
  const startHistoryId = settings.gmailHistoryId;
  if (!startHistoryId) {
    await saveAssistantSettings({
      ownerId,
      gmailHistoryId: incomingHistoryId || null,
    });
    return { status: "initialized" as const };
  }

  const messageIds = await listHistoryMessageIds(conn, startHistoryId);
  const results = [];
  for (const messageId of messageIds.slice(0, 20)) {
    results.push(await processGmailMessage(ownerId, messageId));
  }
  if (incomingHistoryId) {
    await saveAssistantSettings({ ownerId, gmailHistoryId: incomingHistoryId });
  }
  return { status: "processed" as const, count: results.length, results };
}

export async function processGmailMessage(ownerId: string, messageId: string) {
  assertBrokerAssistantEnabled();
  const lease = await acquireMessageLease(ownerId, messageId);
  if (!lease.acquired) return { status: "duplicate" as const, messageId };

  try {
    const settings = await getAssistantSettings(ownerId);
    if (!settings?.enabled || settings.paused) {
      await lease.ref.set(
        { status: "complete", outcome: "paused", updatedAt: new Date().toISOString() },
        { merge: true },
      );
      return { status: "skipped" as const, messageId };
    }

    const conn = await getOwnerGmailConnection(ownerId, settings.gmailConnectionId);
    const message = await fetchGmailMessage(conn, messageId);
    if (isNoiseEmail(message, settings.gmailEmail || conn.email)) {
      await lease.ref.set(
        { status: "complete", outcome: "noise", updatedAt: new Date().toISOString() },
        { merge: true },
      );
      return { status: "ignored" as const, messageId };
    }

    const resolved = await resolveCompany({
      fromEmail: message.from,
      subject: message.subject,
      body: message.body,
      allowedCompanyIds: settings.allowedCompanyIds,
    });

    const context = resolved.company
      ? await buildContextPack(resolved.company, ownerId)
      : null;

    const answer = await answerQuestion({
      subject: message.subject,
      body: message.body,
      fromEmail: message.from,
      brokerName: settings.brokerDisplayName || undefined,
      context,
    });

    const draft = await createReplyDraft(conn, message, answer.answer);

    if (answer.needsResearch || !resolved.company) {
      await createResearchItem({
        ownerId,
        companyId: resolved.company?.id || null,
        companyName: resolved.company?.name || null,
        fromEmail: message.from,
        subject: message.subject,
        questionSnippet: message.body.slice(0, 400),
        gmailThreadId: message.threadId,
        gmailMessageId: message.id,
        gmailPermalink: `https://mail.google.com/mail/u/0/#inbox/${message.threadId}`,
        reason: answer.reason || resolved.reason,
      });
    }

    await writeAssistantAudit({
      ownerId,
      companyId: resolved.company?.id || null,
      gmailMessageId: message.id,
      gmailThreadId: message.threadId,
      draftId: draft.draftId,
      confidence: answer.confidence,
      needsResearch: answer.needsResearch,
      sourceRefs: answer.sourceRefs,
    });

    await lease.ref.set(
      {
        status: "complete",
        outcome: answer.needsResearch ? "research" : "answered",
        draftId: draft.draftId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    return {
      status: "complete" as const,
      messageId,
      draftId: draft.draftId,
      needsResearch: answer.needsResearch,
      companyId: resolved.company?.id || null,
    };
  } catch (error) {
    await lease.ref.set(
      {
        status: "failed",
        lastError: error instanceof Error ? error.message.slice(0, 2000) : "failed",
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    throw error;
  }
}

export async function queueAssistantHistoryJob(ownerId: string, historyId?: string) {
  const queue = process.env.BROKER_ASSISTANT_TASK_QUEUE;
  if (!queue) return processOwnerHistory(ownerId, historyId);

  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  const location = process.env.BROKER_ASSISTANT_TASK_LOCATION || "us-east1";
  const workerUrl = process.env.BROKER_ASSISTANT_WORKER_URL;
  const workerSecret = process.env.BROKER_ASSISTANT_WORKER_SECRET?.trim();
  if (!project || !workerUrl || !workerSecret)
    throw new Error("Broker assistant Cloud Tasks configuration is incomplete");

  const tasks = new CloudTasksClient();
  const parent = tasks.queuePath(project, location, queue);
  const taskName = tasks.taskPath(
    project,
    location,
    queue,
    `assistant-${stableId(`${ownerId}:${historyId || Date.now()}`, 32)}`,
  );
  try {
    await tasks.createTask({
      parent,
      task: {
        name: taskName,
        httpRequest: {
          httpMethod: "POST",
          url: workerUrl,
          headers: {
            "Content-Type": "application/json",
            "X-Broker-Assistant-Worker-Secret": workerSecret,
          },
          body: Buffer.from(JSON.stringify({ ownerId, historyId })),
        },
        dispatchDeadline: { seconds: 300 },
      },
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 6) throw error;
  }
  return { status: "queued" as const, taskName };
}

export async function findOwnerIdByGmailAddress(emailAddress: string) {
  const { db } = getAdminServices();
  const snapshot = await db
    .collection("brokerAssistantSettings")
    .where("gmailEmail", "==", emailAddress)
    .limit(1)
    .get();
  if (!snapshot.empty) return snapshot.docs[0].id;

  const connections = await db
    .collection("brokerMailboxConnections")
    .where("provider", "==", "gmail")
    .where("status", "==", "active")
    .where("email", "==", emailAddress)
    .limit(1)
    .get();
  if (!connections.empty)
    return String((connections.docs[0].data() as { ownerId?: string }).ownerId || "");
  return null;
}
