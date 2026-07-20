import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { AgentMailClient } from "agentmail";
import { randomUUID } from "node:crypto";
import { createGenerationRun } from "../../booklet-pipeline";
import {
  executeBookletRun,
  getBookletRunStatus,
  presentBookletRun,
} from "../../booklet-run-service";
import type { BlockerQuestion } from "../../booklet-types";
import {
  addBookletMessage,
  attachFileIdsToThread,
  getBookletThread,
  getGenerationRun,
  getUploadedFileRecords,
  saveGenerationRun,
  storeUploadedFiles,
} from "../../booklet-thread-store";
import { getAdminServices } from "../../firebase-admin";
import { fetchSourceHit, listActiveMailboxConnections, searchAllSources } from "../sources";
import {
  saveAgentSession,
  setPendingEmailSend,
  updateSessionPreferences,
} from "../session-store";
import type { AgentSession, BookletPreferences, PendingEmailSend, ToolResult } from "../types";

const FollowupAnswersSchema = z.object({
  answers: z.array(
    z.object({
      fieldPath: z.string(),
      answerJson: z.string(),
      evidence: z.string(),
    }),
  ),
});

export const BOOKLET_INTAKE_QUESTIONS: BlockerQuestion[] = [
  {
    id: "email-intake-employer",
    fieldPath: "employer.name",
    question: "What employer name should appear on this booklet?",
    reason: "The employer name is required on the cover.",
    sourceRefs: [],
    blocking: true,
  },
  {
    id: "email-intake-plan-start",
    fieldPath: "planYear.start",
    question: "What is the plan-year start date?",
    reason: "The plan-year start date is required on the cover.",
    sourceRefs: [],
    blocking: true,
    expectedAnswerKind: "date_or_period",
  },
  {
    id: "email-intake-plan-end",
    fieldPath: "planYear.end",
    question: "What is the plan-year end date?",
    reason: "The plan-year end date is required on the cover.",
    sourceRefs: [],
    blocking: true,
    expectedAnswerKind: "date_or_period",
  },
  {
    id: "email-intake-eligibility",
    fieldPath: "eligibility.waitingPeriod",
    question: "What eligibility waiting period should employees see in the booklet?",
    reason: "Employees need the eligibility rule.",
    sourceRefs: [],
    blocking: true,
  },
  {
    id: "email-intake-plans",
    fieldPath: "plans.selected",
    question: "Which current plans should be included in this booklet?",
    reason: "The current employer-selected plans must be identified.",
    sourceRefs: [],
    blocking: true,
    expectedAnswerKind: "list_or_schedule",
  },
];

function openAIClient() {
  if (!process.env.OPENAI_API_KEY)
    throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function parseAnswerJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value.trim();
  }
}

export async function answersFromFollowup({
  subject,
  body,
  attachmentFileNames,
  questions,
  client = openAIClient(),
}: {
  subject: string;
  body: string;
  attachmentFileNames: string[];
  questions: BlockerQuestion[];
  client?: Pick<OpenAI, "responses">;
}) {
  if (!questions.length) return {};
  const questionContract = questions.map((question) => ({
    fieldPath: question.fieldPath,
    question: question.question,
    options: question.options || [],
    expectedAnswerKind: question.expectedAnswerKind || "text",
    specialShape:
      question.fieldPath === "plans.selected"
        ? "JSON array of {planName, benefitType, carrier?} objects"
        : question.fieldPath.startsWith("contributions.")
          ? "JSON object {mode: percent|flat_monthly|flat_per_pay, value: number, payPeriods?: number}"
          : undefined,
  }));
  const response = await client.responses.parse({
    model: process.env.OPENAI_EMAIL_MODEL || "gpt-5.4-mini",
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content:
          "Extract only answers explicitly stated in the latest message. Map them only to the supplied fieldPath values. Never guess. answerJson must be valid JSON representing the answer. Omit unanswered questions. Attachment names do not prove their contents.",
      },
      {
        role: "user",
        content: `Blocking questions:\n${JSON.stringify(questionContract)}\n\nLatest subject: ${subject}\nAttachments: ${attachmentFileNames.join(", ") || "none"}\n\nLatest message:\n${body}`,
      },
    ],
    text: {
      format: zodTextFormat(FollowupAnswersSchema, "booklet_followup_answers"),
    },
  });
  const allowed = new Set(questions.map((question) => question.fieldPath));
  return Object.fromEntries(
    (response.output_parsed?.answers || [])
      .filter((answer) => allowed.has(answer.fieldPath))
      .map((answer) => [answer.fieldPath, parseAnswerJson(answer.answerJson)]),
  );
}

export type ToolContext = {
  session: AgentSession;
  assertOwner: () => void;
};

export type BrokerToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    ctx: ToolContext,
  ) => Promise<{ result: unknown; session?: AgentSession }>;
};

async function requireThread(session: AgentSession) {
  const thread = await getBookletThread(session.bookletThreadId);
  if (!thread) throw new Error("Booklet thread was not found");
  if (thread.ownerId !== session.ownerId)
    throw new Error("Booklet thread belongs to another user");
  return thread;
}

export const brokerTools: BrokerToolDefinition[] = [
  {
    name: "connect_mailbox_status",
    description: "Check whether the broker has linked Gmail and/or Outlook mailboxes.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    async execute(_args, ctx) {
      ctx.assertOwner();
      const connections = await listActiveMailboxConnections(ctx.session.ownerId);
      return {
        result: {
          connected: connections.map((c) => ({
            id: c.id,
            provider: c.provider,
            email: c.email || null,
          })),
          gmail: connections.some((c) => c.provider === "gmail"),
          outlook: connections.some((c) => c.provider === "outlook"),
          oauthEnabled:
            process.env.BROKER_MAILBOX_OAUTH === "1" ||
            process.env.BROKER_MAILBOX_OAUTH === "true",
        },
      };
    },
  },
  {
    name: "search_sources",
    description:
      "Search Ansa company library plus linked Gmail/Outlook for plan docs, rate sheets, SBCs, and prior booklets.",
    parameters: {
      type: "object",
      properties: {
        keywords: { type: "array", items: { type: "string" } },
        employerName: { type: "string" },
        planYear: { type: "string" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    async execute(args, ctx) {
      ctx.assertOwner();
      const hits = await searchAllSources({
        ownerId: ctx.session.ownerId,
        companyId: ctx.session.companyId,
        keywords: Array.isArray(args.keywords)
          ? args.keywords.map(String)
          : undefined,
        employerName: args.employerName ? String(args.employerName) : undefined,
        planYear: args.planYear ? String(args.planYear) : undefined,
        limit: typeof args.limit === "number" ? args.limit : 20,
        connectionIds: ctx.session.mailboxConnectionIds,
      });
      return { result: { hits } };
    },
  },
  {
    name: "attach_sources",
    description:
      "Fetch selected source hits and attach them to the booklet thread (no manual upload).",
    parameters: {
      type: "object",
      properties: {
        hitIds: { type: "array", items: { type: "string" } },
      },
      required: ["hitIds"],
      additionalProperties: false,
    },
    async execute(args, ctx) {
      ctx.assertOwner();
      const hitIds = Array.isArray(args.hitIds) ? args.hitIds.map(String) : [];
      if (!hitIds.length) throw new Error("hitIds is required");
      const thread = await requireThread(ctx.session);
      const files = [];
      for (const hitId of hitIds.slice(0, 20)) {
        const fetched = await fetchSourceHit(hitId, {
          ownerId: ctx.session.ownerId,
          companyId: ctx.session.companyId,
          connectionIds: ctx.session.mailboxConnectionIds,
        });
        if (!fetched.data) continue;
        files.push({
          fileName: fetched.fileName,
          mimeType: fetched.mimeType,
          data: fetched.data,
          sourceKind: fetched.sourceKind,
          sourceUrl: fetched.sourceUrl || null,
          intakeCategory: fetched.intakeCategory,
        });
      }
      const stored = await storeUploadedFiles({ thread, files });
      return {
        result: {
          attached: stored.map((file) => ({
            id: file.id,
            fileName: file.fileName,
            sourceKind: file.sourceKind,
          })),
        },
      };
    },
  },
  {
    name: "set_booklet_preferences",
    description: "Store booklet customization preferences from the broker's spoken or typed intent.",
    parameters: {
      type: "object",
      properties: {
        tone: { type: "string" },
        includeSections: { type: "array", items: { type: "string" } },
        omitSections: { type: "array", items: { type: "string" } },
        appendix: { type: "boolean" },
        brandingNotes: { type: "string" },
        extraInstructions: { type: "string" },
      },
      additionalProperties: false,
    },
    async execute(args, ctx) {
      ctx.assertOwner();
      const preferences: BookletPreferences = {
        ...(args.tone ? { tone: String(args.tone) } : {}),
        ...(Array.isArray(args.includeSections)
          ? { includeSections: args.includeSections.map(String) }
          : {}),
        ...(Array.isArray(args.omitSections)
          ? { omitSections: args.omitSections.map(String) }
          : {}),
        ...(typeof args.appendix === "boolean" ? { appendix: args.appendix } : {}),
        ...(args.brandingNotes ? { brandingNotes: String(args.brandingNotes) } : {}),
        ...(args.extraInstructions
          ? { extraInstructions: String(args.extraInstructions) }
          : {}),
      };
      const session = await updateSessionPreferences(ctx.session, preferences);
      return { result: { preferences: session.preferences }, session };
    },
  },
  {
    name: "add_spoken_instructions",
    description: "Persist natural-language broker instructions as evidence on the booklet thread.",
    parameters: {
      type: "object",
      properties: {
        instructions: { type: "string" },
      },
      required: ["instructions"],
      additionalProperties: false,
    },
    async execute(args, ctx) {
      ctx.assertOwner();
      const instructions = String(args.instructions || "").trim();
      if (!instructions) throw new Error("instructions is required");
      const thread = await requireThread(ctx.session);
      const stored = await storeUploadedFiles({
        thread,
        files: [
          {
            fileName: `broker-instructions-${Date.now()}.txt`,
            mimeType: "text/plain",
            data: Buffer.from(`Broker instructions\n\n${instructions}`, "utf8"),
            sourceKind: "thread_message",
            intakeCategory: "instructions",
          },
        ],
      });
      await addBookletMessage({
        threadId: thread.id,
        role: "user",
        text: instructions,
        attachmentFileIds: stored.map((file) => file.id),
        kind: "message",
      });
      return { result: { fileIds: stored.map((file) => file.id) } };
    },
  },
  {
    name: "start_booklet_run",
    description: "Create and execute a booklet generation run from the current thread sources.",
    parameters: {
      type: "object",
      properties: {
        answers: { type: "object", additionalProperties: true },
      },
      additionalProperties: false,
    },
    async execute(args, ctx) {
      ctx.assertOwner();
      const thread = await requireThread(ctx.session);
      if (!thread.uploadedFileIds.length)
        throw new Error("Attach at least one source before starting a booklet run");
      const prefs = ctx.session.preferences;
      const instructionBits = [
        prefs.tone ? `Tone: ${prefs.tone}` : "",
        prefs.includeSections?.length
          ? `Include sections: ${prefs.includeSections.join(", ")}`
          : "",
        prefs.omitSections?.length
          ? `Omit sections: ${prefs.omitSections.join(", ")}`
          : "",
        typeof prefs.appendix === "boolean" ? `Appendix: ${prefs.appendix}` : "",
        prefs.brandingNotes ? `Branding: ${prefs.brandingNotes}` : "",
        prefs.extraInstructions || "",
      ]
        .filter(Boolean)
        .join("\n");
      if (instructionBits) {
        await storeUploadedFiles({
          thread,
          files: [
            {
              fileName: `session-preferences-${Date.now()}.txt`,
              mimeType: "text/plain",
              data: Buffer.from(instructionBits, "utf8"),
              sourceKind: "thread_message",
              intakeCategory: "instructions",
            },
          ],
        });
      }
      const refreshed = await requireThread(ctx.session);
      const run = createGenerationRun({
        threadId: refreshed.id,
        companyId: refreshed.companyId,
        ownerId: refreshed.ownerId,
        uploadedFileIds: refreshed.uploadedFileIds,
      });
      if (args.answers && typeof args.answers === "object")
        run.answers = args.answers as Record<string, unknown>;
      await saveGenerationRun(run);
      const completed = await executeBookletRun(run, undefined, undefined, {
        enforceRegistry: false,
      });
      const presented = await presentBookletRun(completed);
      const session = await saveAgentSession({
        ...ctx.session,
        bookletRunId: completed.id,
        status:
          completed.status === "blocked"
            ? "blocked"
            : completed.status === "complete"
              ? "complete"
              : "processing",
      });
      return {
        result: {
          runId: presented.id,
          status: presented.status,
          questions: presented.questions,
          pdfUrl: presented.pdfUrl || null,
          pdfStoragePath: presented.pdfStoragePath || null,
        },
        session,
      };
    },
  },
  {
    name: "resume_booklet_run",
    description: "Resume a blocked booklet run with new answers and/or newly attached sources.",
    parameters: {
      type: "object",
      properties: {
        runId: { type: "string" },
        answers: { type: "object", additionalProperties: true },
      },
      additionalProperties: false,
    },
    async execute(args, ctx) {
      ctx.assertOwner();
      const runId = String(args.runId || ctx.session.bookletRunId || "");
      if (!runId) throw new Error("runId is required");
      const existing = await getGenerationRun(runId);
      if (!existing) throw new Error("Booklet run was not found");
      if (existing.ownerId !== ctx.session.ownerId)
        throw new Error("Booklet run belongs to another user");
      const thread = await requireThread(ctx.session);
      const run = createGenerationRun({
        threadId: thread.id,
        companyId: thread.companyId,
        ownerId: thread.ownerId,
        uploadedFileIds: thread.uploadedFileIds,
      });
      run.answers = {
        ...(existing.answers || {}),
        ...((args.answers as Record<string, unknown>) || {}),
      };
      await saveGenerationRun(run);
      const completed = await executeBookletRun(run, undefined, undefined, {
        enforceRegistry: false,
      });
      const presented = await presentBookletRun(completed);
      const session = await saveAgentSession({
        ...ctx.session,
        bookletRunId: completed.id,
        status:
          completed.status === "blocked"
            ? "blocked"
            : completed.status === "complete"
              ? "complete"
              : "processing",
      });
      return {
        result: {
          runId: presented.id,
          status: presented.status,
          questions: presented.questions,
          pdfUrl: presented.pdfUrl || null,
          pdfStoragePath: presented.pdfStoragePath || null,
        },
        session,
      };
    },
  },
  {
    name: "answer_blockers",
    description:
      "Extract answers to blocking booklet questions from free-form broker speech or text.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string" },
        subject: { type: "string" },
      },
      required: ["message"],
      additionalProperties: false,
    },
    async execute(args, ctx) {
      ctx.assertOwner();
      const run = ctx.session.bookletRunId
        ? await getGenerationRun(ctx.session.bookletRunId)
        : null;
      const questions = [
        ...new Map(
          [...BOOKLET_INTAKE_QUESTIONS, ...(run?.questions || [])].map((q) => [
            q.fieldPath,
            q,
          ]),
        ).values(),
      ];
      const answers = await answersFromFollowup({
        subject: String(args.subject || ""),
        body: String(args.message || ""),
        attachmentFileNames: [],
        questions,
      });
      return { result: { answers, questionCount: questions.length } };
    },
  },
  {
    name: "get_run_status",
    description: "Get booklet run status, blocking questions, and PDF URL if ready.",
    parameters: {
      type: "object",
      properties: {
        runId: { type: "string" },
      },
      additionalProperties: false,
    },
    async execute(args, ctx) {
      ctx.assertOwner();
      const runId = String(args.runId || ctx.session.bookletRunId || "");
      if (!runId) throw new Error("No booklet run on this session");
      const run = await getGenerationRun(runId);
      if (!run) throw new Error("Booklet run was not found");
      if (run.ownerId !== ctx.session.ownerId)
        throw new Error("Booklet run belongs to another user");
      const status = await getBookletRunStatus(run);
      return {
        result: {
          runId: status.run.id,
          status: status.run.status,
          questions: status.run.questions,
          pdfUrl: status.run.pdfUrl || null,
          pdfStoragePath: status.run.pdfStoragePath || null,
          error: status.run.error || null,
        },
      };
    },
  },
  {
    name: "propose_email",
    description:
      "Propose sending the finished booklet PDF by email. Does not send until confirm_send_booklet_email.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "array", items: { type: "string" } },
        cc: { type: "array", items: { type: "string" } },
        subject: { type: "string" },
        body: { type: "string" },
        runId: { type: "string" },
      },
      required: ["to", "subject", "body"],
      additionalProperties: false,
    },
    async execute(args, ctx) {
      ctx.assertOwner();
      const runId = String(args.runId || ctx.session.bookletRunId || "");
      if (!runId) throw new Error("runId is required");
      const run = await getGenerationRun(runId);
      if (!run || run.ownerId !== ctx.session.ownerId)
        throw new Error("Booklet run was not found");
      if (!run.pdfStoragePath)
        throw new Error("Booklet PDF is not ready yet");
      const pending: PendingEmailSend = {
        id: randomUUID(),
        to: Array.isArray(args.to) ? args.to.map(String) : [],
        cc: Array.isArray(args.cc) ? args.cc.map(String) : undefined,
        subject: String(args.subject || ""),
        body: String(args.body || ""),
        runId: run.id,
        pdfStoragePath: run.pdfStoragePath,
        createdAt: new Date().toISOString(),
      };
      if (!pending.to.length) throw new Error("At least one recipient is required");
      const session = await setPendingEmailSend(ctx.session, pending);
      return { result: { pendingEmailSend: pending }, session };
    },
  },
  {
    name: "confirm_send_booklet_email",
    description:
      "Confirm and send a previously proposed booklet email. Requires pendingEmailSend.confirmToken match via pending id.",
    parameters: {
      type: "object",
      properties: {
        pendingId: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["pendingId", "confirmed"],
      additionalProperties: false,
    },
    async execute(args, ctx) {
      ctx.assertOwner();
      if (args.confirmed !== true)
        throw new Error("Send was not confirmed");
      const pending = ctx.session.pendingEmailSend;
      if (!pending || pending.id !== String(args.pendingId || ""))
        throw new Error("No matching pending email proposal on this session");
      const apiKey = process.env.AGENTMAIL_API_KEY;
      const inboxId = process.env.AGENTMAIL_INBOX_ID;
      if (!apiKey || !inboxId)
        throw new Error("AgentMail is not configured for outbound send");
      const [pdf] = await getAdminServices()
        .bucket.file(pending.pdfStoragePath)
        .download();
      const client = new AgentMailClient({
        apiKey,
        timeoutInSeconds: 45,
        maxRetries: 2,
      });
      const sendResult = await (
        client.inboxes.messages as unknown as {
          send: (
            inboxId: string,
            body: Record<string, unknown>,
          ) => Promise<{ messageId?: string }>;
        }
      ).send(inboxId, {
        to: pending.to,
        ...(pending.cc?.length ? { cc: pending.cc } : {}),
        subject: pending.subject,
        text: pending.body,
        attachments: [
          {
            filename: "benefits-booklet.pdf",
            contentType: "application/pdf",
            content: pdf.toString("base64"),
          },
        ],
      });
      const { db } = getAdminServices();
      const auditId = randomUUID();
      await db.collection("brokerAgentEmailAudit").doc(auditId).set({
        id: auditId,
        sessionId: ctx.session.id,
        ownerId: ctx.session.ownerId,
        companyId: ctx.session.companyId,
        runId: pending.runId,
        pdfStoragePath: pending.pdfStoragePath,
        to: pending.to,
        cc: pending.cc || [],
        subject: pending.subject,
        confirmedBy: ctx.session.ownerId,
        agentmailMessageId:
          (sendResult as { messageId?: string })?.messageId || null,
        createdAt: new Date().toISOString(),
      });
      const session = await setPendingEmailSend(ctx.session, null);
      return {
        result: {
          sent: true,
          auditId,
          to: pending.to,
          subject: pending.subject,
        },
        session,
      };
    },
  },
  {
    name: "attach_library_file_ids",
    description:
      "Attach existing Ansa uploaded file IDs already owned by this broker/company to the thread.",
    parameters: {
      type: "object",
      properties: {
        fileIds: { type: "array", items: { type: "string" } },
      },
      required: ["fileIds"],
      additionalProperties: false,
    },
    async execute(args, ctx) {
      ctx.assertOwner();
      const fileIds = Array.isArray(args.fileIds) ? args.fileIds.map(String) : [];
      const files = await getUploadedFileRecords(fileIds);
      for (const file of files) {
        if (file.ownerId && file.ownerId !== ctx.session.ownerId)
          throw new Error("File belongs to another user");
        if (file.companyId !== ctx.session.companyId)
          throw new Error("File belongs to another company");
      }
      await attachFileIdsToThread(ctx.session.bookletThreadId, fileIds);
      return { result: { attachedFileIds: fileIds } };
    },
  },
];

export function getToolByName(name: string) {
  return brokerTools.find((tool) => tool.name === name) || null;
}

export function openaiToolSchemas() {
  return brokerTools.map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

export async function executeBrokerTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ toolResult: ToolResult; session: AgentSession }> {
  const tool = getToolByName(name);
  if (!tool) {
    return {
      toolResult: {
        toolCallId: "",
        name,
        ok: false,
        result: null,
        error: `Unknown tool: ${name}`,
      },
      session: ctx.session,
    };
  }
  try {
    const executed = await tool.execute(args, ctx);
    return {
      toolResult: {
        toolCallId: "",
        name,
        ok: true,
        result: executed.result,
      },
      session: executed.session || ctx.session,
    };
  } catch (error) {
    return {
      toolResult: {
        toolCallId: "",
        name,
        ok: false,
        result: null,
        error: error instanceof Error ? error.message : "Tool failed",
      },
      session: ctx.session,
    };
  }
}
