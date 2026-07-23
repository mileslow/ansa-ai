import { createHash } from "node:crypto";
import { CloudTasksClient } from "@google-cloud/tasks";
import { answerQuestion } from "./answer";
import { buildContextPack, resolveCompany } from "./company-context";
import { assertBrokerAssistantEnabled } from "./flags";
import {
  fetchGmailMessage,
  getOwnerGmailConnection,
  isNoiseEmail,
  listHistoryMessageIds,
  sendNewEmail,
  sendReply,
  startGmailWatch,
  type GmailMessageSummary,
} from "./gmail-ops";
import {
  createPendingApproval,
  createResearchItem,
  findPendingApprovalByThread,
  getAssistantSettings,
  resolvePendingApproval,
  saveAssistantSettings,
  setApprovalThread,
  writeAssistantAudit,
  type PendingApproval,
} from "./store";
import { getAdminServices } from "../firebase-admin";

/** Replies at or above this confidence are sent to the client automatically. */
const AUTO_SEND_MIN_CONFIDENCE = 0.7;

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

/** Strip quoted history from a Gmail reply body, keeping only the new text. */
export function extractReplyText(body: string) {
  const lines = body.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) break;
    if (/^\s*On .+ wrote:\s*$/i.test(line)) break;
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(line)) break;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

/** Interpret the broker's reply to an escalation email. */
export function parseApprovalDecision(
  text: string,
): "approve" | "deny" | "answer" | "empty" {
  const normalized = text.trim().toLowerCase().replace(/[.!]+$/, "");
  if (!normalized) return "empty";
  if (
    /^(approve|approved|yes|yep|yeah|send|send it|ok|okay|looks good|lgtm|go ahead|👍)$/.test(
      normalized,
    )
  )
    return "approve";
  if (
    /^(deny|denied|no|nope|don'?t send|do not send|skip|reject|rejected|hold|hold off)$/.test(
      normalized,
    )
  )
    return "deny";
  return "answer";
}

function buildEscalationEmail(
  approval: Pick<
    PendingApproval,
    "clientFrom" | "clientSubject" | "proposedReply" | "brokerQuestion" | "companyName"
  >,
) {
  return [
    "Hi — it's Ansa. I got a client email I'm not confident enough to answer on my own.",
    "",
    `From: ${approval.clientFrom}`,
    `Subject: ${approval.clientSubject || "(no subject)"}`,
    approval.companyName ? `Company: ${approval.companyName}` : null,
    "",
    `What I need from you: ${approval.brokerQuestion}`,
    "",
    "Here's the reply I would send:",
    "----------------------------------------",
    approval.proposedReply,
    "----------------------------------------",
    "",
    "Reply to this email with:",
    '- "Approve" — I\'ll send the reply above to the client.',
    '- "Deny" — I\'ll hold off and do nothing.',
    "- Or just type the answer, and I'll send that to the client instead.",
    "",
    "— Ansa",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function buildClientAck(brokerName?: string | null) {
  return [
    "Thanks for reaching out — I've received your email.",
    `I'm confirming a couple of details${brokerName ? ` with ${brokerName}` : ""} to make sure I give you an accurate answer, and I'll follow up shortly.`,
    "",
    "— Ansa",
    brokerName ? `Assistant to ${brokerName}` : "Benefits assistant",
  ].join("\n");
}

/** Handle the broker's reply to a pending-approval thread. */
async function handleApprovalReply(
  ownerId: string,
  conn: Awaited<ReturnType<typeof getOwnerGmailConnection>>,
  message: GmailMessageSummary,
  approval: PendingApproval,
) {
  const replyText = extractReplyText(message.body);
  const decision = parseApprovalDecision(replyText);
  if (decision === "empty") return { outcome: "approval_noop" as const };

  const clientMessage = await fetchGmailMessage(conn, approval.clientMessageId);

  if (decision === "deny") {
    await resolvePendingApproval(approval.id, "denied", replyText);
    await writeAssistantAudit({
      ownerId,
      companyId: approval.companyId || null,
      gmailMessageId: message.id,
      gmailThreadId: approval.clientThreadId,
      action: "approval_denied",
      confidence: 1,
      needsResearch: false,
      sourceRefs: [],
    });
    return { outcome: "approval_denied" as const };
  }

  const bodyToSend =
    decision === "approve"
      ? approval.proposedReply
      : `${replyText}\n\n— Ansa\nOn behalf of the broker`;

  const sent = await sendReply(conn, clientMessage, bodyToSend);
  await resolvePendingApproval(
    approval.id,
    "approved",
    decision === "approve" ? null : replyText,
  );
  await writeAssistantAudit({
    ownerId,
    companyId: approval.companyId || null,
    gmailMessageId: message.id,
    gmailThreadId: approval.clientThreadId,
    action: decision === "approve" ? "approval_approved" : "approval_answered",
    sentMessageId: sent.messageId,
    confidence: 1,
    needsResearch: false,
    sourceRefs: [],
  });
  return {
    outcome:
      decision === "approve"
        ? ("approval_approved" as const)
        : ("approval_answered" as const),
    sentMessageId: sent.messageId,
  };
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
    const brokerEmail = (settings.gmailEmail || conn.email || "").toLowerCase();

    // Broker replying to an escalation thread? Handle approve/deny/answer
    // before the noise filter (self-mail would otherwise be dropped).
    if (brokerEmail && message.from.toLowerCase().includes(brokerEmail)) {
      const approval = await findPendingApprovalByThread(ownerId, message.threadId);
      if (approval && message.id !== approval.approvalMessageId) {
        const result = await handleApprovalReply(ownerId, conn, message, approval);
        await lease.ref.set(
          { status: "complete", outcome: result.outcome, updatedAt: new Date().toISOString() },
          { merge: true },
        );
        return { status: "complete" as const, messageId, ...result };
      }
    }

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

    const confident =
      !answer.needsResearch &&
      Boolean(resolved.company) &&
      answer.confidence >= AUTO_SEND_MIN_CONFIDENCE;

    if (confident) {
      // High confidence: reply to the client directly, no broker involvement.
      const sent = await sendReply(conn, message, answer.answer);

      await writeAssistantAudit({
        ownerId,
        companyId: resolved.company?.id || null,
        gmailMessageId: message.id,
        gmailThreadId: message.threadId,
        action: "auto_sent",
        sentMessageId: sent.messageId,
        confidence: answer.confidence,
        needsResearch: false,
        sourceRefs: answer.sourceRefs,
      });

      await lease.ref.set(
        {
          status: "complete",
          outcome: "auto_sent",
          sentMessageId: sent.messageId,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      return {
        status: "complete" as const,
        messageId,
        outcome: "auto_sent" as const,
        sentMessageId: sent.messageId,
        companyId: resolved.company?.id || null,
      };
    }

    // Low confidence: ack the client, then escalate to the broker for
    // approve / deny / answer. Nothing goes to the client until he responds.
    const ack = await sendReply(
      conn,
      message,
      buildClientAck(settings.brokerDisplayName),
    );

    const approval = await createPendingApproval({
      ownerId,
      clientThreadId: message.threadId,
      clientMessageId: message.id,
      clientFrom: message.from,
      clientSubject: message.subject,
      proposedReply: answer.answer,
      brokerQuestion: answer.brokerQuestion,
      companyId: resolved.company?.id || null,
      companyName: resolved.company?.name || null,
      approvalThreadId: null,
      approvalMessageId: null,
    });

    const escalation = await sendNewEmail(conn, {
      to: settings.gmailEmail || conn.email || "",
      subject: `[Ansa needs your OK] ${message.subject || "(no subject)"}`,
      bodyText: buildEscalationEmail(approval),
    });
    await setApprovalThread(approval.id, escalation.threadId, escalation.messageId);

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
      reason: answer.brokerQuestion || answer.reason || resolved.reason,
    });

    await writeAssistantAudit({
      ownerId,
      companyId: resolved.company?.id || null,
      gmailMessageId: message.id,
      gmailThreadId: message.threadId,
      action: "escalated",
      sentMessageId: ack.messageId,
      confidence: answer.confidence,
      needsResearch: true,
      sourceRefs: answer.sourceRefs,
    });

    await lease.ref.set(
      {
        status: "complete",
        outcome: "escalated",
        approvalId: approval.id,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    return {
      status: "complete" as const,
      messageId,
      outcome: "escalated" as const,
      approvalId: approval.id,
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
