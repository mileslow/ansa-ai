import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createGenerationRun, runBookletPipeline } from "../lib/booklet-pipeline";
import { assertOwner, BookletAuthError, requireBookletUser } from "../lib/booklet-auth";
import type {
  BookletGenerationRun,
  BookletSectionArtifact,
  PipelineEvent,
  UploadedFile,
} from "../lib/booklet-types";
import { generateCompanyProfile } from "../lib/company-profile.js";
import {
  addBookletMessage,
  attachFileIdsToThread,
  createBookletThread,
  deleteUploadedFileFromThread,
  getBookletThread,
  getExtractedFacts,
  getGenerationRun,
  getPipelineEvents,
  getSectionArtifacts,
  getUploadedFileRecords,
  loadUploadedFiles,
  pruneSectionArtifacts,
  refreshGeneratedPdfUrl,
  resetPipelineEvents,
  saveGeneratedPdf,
  saveGenerationRun,
  saveExtractedFacts,
  savePipelineEvent,
  saveSectionArtifact,
  storeUploadedFiles,
} from "../lib/booklet-thread-store";

export const config = { maxDuration: 300, includeFiles: "lib/**" };

const validId = (value: unknown) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(value);
const wantsStream = (value: unknown) => value === true || value === "true" || value === "1";

function decodeUploads(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`File ${index + 1} is invalid`);
    const upload = item as Record<string, unknown>;
    if (!upload.fileName || !upload.mimeType || !upload.base64)
      throw new Error(`File ${index + 1} requires fileName, mimeType, and base64`);
    const data = Buffer.from(String(upload.base64), "base64");
    if (!data.length) throw new Error(`File ${index + 1} is empty`);
    if (data.length > 50 * 1024 * 1024) throw new Error(`${upload.fileName} exceeds 50 MiB`);
    const mimeType = String(upload.mimeType).toLowerCase();
    if (
      ![
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
        "message/rfc822",
        "text/plain",
      ].includes(mimeType)
    )
      throw new Error(`${upload.fileName} has an unsupported file type (${mimeType})`);
    const intakeCategory = [
      "employer",
      "rates",
      "documents",
      "template",
      "census",
      "instructions",
    ].includes(String(upload.intakeCategory))
      ? (String(upload.intakeCategory) as UploadedFile["intakeCategory"])
      : undefined;
    return { fileName: String(upload.fileName), mimeType, data, intakeCategory };
  });
}

async function websiteEvidence(rawUrl: unknown) {
  if (!rawUrl) return null;
  const profile = await generateCompanyProfile(String(rawUrl), process.env.OPENAI_API_KEY);
  const sourceUrl = String(profile.website || rawUrl);
  return {
    profile,
    file: {
      fileName: "company-website-evidence.txt",
      mimeType: "text/plain",
      data: Buffer.from(JSON.stringify(profile, null, 2), "utf8"),
      sourceKind: "company_website" as const,
      sourceUrl,
      intakeCategory: "employer" as const,
    },
  };
}

function messageEvidence(message: unknown, enabled: unknown) {
  const text = String(message || "").trim();
  if (!text || !wantsStream(enabled)) return null;
  return {
    fileName: "booklet-thread-instructions.txt",
    mimeType: "text/plain",
    data: Buffer.from(`Booklet thread instruction\n\n${text}`, "utf8"),
    sourceKind: "thread_message" as const,
    intakeCategory: "instructions" as const,
  };
}

async function assertOwnedFiles(
  fileIds: string[],
  ownerId: string,
  companyId?: string,
): Promise<UploadedFile[]> {
  const files = await getUploadedFileRecords(fileIds);
  files.forEach((file) => {
    assertOwner(file.ownerId, ownerId);
    if (companyId && file.companyId !== companyId)
      throw new BookletAuthError("An uploaded file belongs to another company", 403);
  });
  return files;
}

async function presentRun(run: BookletGenerationRun) {
  if (run.status === "complete" && run.pdfStoragePath) {
    return {
      ...run,
      pdfUrl: await refreshGeneratedPdfUrl(run.pdfStoragePath),
    };
  }
  return run;
}

async function runStatusPayload(run: BookletGenerationRun) {
  const [events, facts, sections] = await Promise.all([
    getPipelineEvents(run.id),
    getExtractedFacts(run.id),
    getSectionArtifacts(run.id),
  ]);
  return { run: await presentRun(run), events, facts, sections };
}

async function executeRun(
  run: BookletGenerationRun,
  onEvent?: (event: PipelineEvent) => void | Promise<void>,
  onArtifact?: (artifact: BookletSectionArtifact) => void | Promise<void>,
) {
  await resetPipelineEvents(run.id);
  const files = await loadUploadedFiles(run.uploadedFileIds);
  run.status = "processing";
  run.error = null;
  run.stages = [];
  run.questions = [];
  run.bookletOutline = null;
  run.qualityReport = null;
  run.pdfStoragePath = null;
  run.pdfUrl = null;
  run.completedAt = null;
  run.sectionArtifactCount = 0;
  await saveGenerationRun(run);
  try {
    const result = await runBookletPipeline({
      runId: run.id,
      companyId: run.companyId,
      files,
      answers: run.answers,
      onEvent: async (event) => {
        await savePipelineEvent(event);
        await onEvent?.(event);
      },
      onArtifact: async (artifact) => {
        await saveSectionArtifact(artifact);
        await onArtifact?.(artifact);
      },
    });
    run.questions = result.questions;
    run.classifications = result.classifications;
    run.benefitsPackageSnapshot = result.benefitsPackage;
    run.requirementsSnapshot = result.benefitsPackage.requirements;
    run.renderManifest = result.renderManifest || null;
    run.claimLedger = result.content?.claims || [];
    run.contentModel = result.content?.model || null;
    run.qualityReport = result.qualityReport || null;
    run.confidenceReport = result.benefitsPackage.confidenceReport;
    run.extractedFactCount = result.facts.length;
    run.sectionArtifactCount = result.artifacts.length;
    run.bookletOutline = result.outline || null;
    await pruneSectionArtifacts(
      run.id,
      result.artifacts.map((artifact) => artifact.id),
    );
    await saveExtractedFacts(run.id, result.facts);
    if (result.status === "blocked") {
      run.status = "blocked";
      await saveGenerationRun(run);
      await Promise.all(
        result.questions.map((question) =>
          addBookletMessage({
            threadId: run.threadId,
            role: "agent",
            text: question.question,
            attachmentFileIds: [],
            kind: "question",
          }),
        ),
      );
      return run;
    }
    const stored = await saveGeneratedPdf({
      run,
      pdf: result.pdf!,
      employerName: result.benefitsPackage.employer.name,
    });
    run.status = "complete";
    run.questions = [];
    run.bookletOutline = result.outline;
    run.qualityReport = result.qualityReport || null;
    run.pdfStoragePath = stored.storagePath;
    run.pdfUrl = stored.url;
    run.completedAt = new Date().toISOString();
    await saveGenerationRun(run);
    await addBookletMessage({
      threadId: run.threadId,
      role: "agent",
      text: "The source-backed benefits booklet is complete.",
      attachmentFileIds: [],
      kind: "result",
    });
    return run;
  } catch (error) {
    run.status = "failed";
    run.error = error instanceof Error ? error.message : "Booklet generation failed";
    await saveGenerationRun(run);
    await addBookletMessage({
      threadId: run.threadId,
      role: "agent",
      text: run.error,
      attachmentFileIds: [],
      kind: "error",
    });
    throw error;
  }
}

async function streamExecution(res: VercelResponse, run: BookletGenerationRun) {
  res.status(202);
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  const send = (value: unknown) => {
    if (res.writableEnded || res.destroyed) return;
    res.write(`${JSON.stringify(value)}\n`);
  };
  send({ type: "run", run });
  try {
    const completed = await executeRun(
      run,
      (event) => {
        send({ type: "event", event });
      },
      (section) => {
        send({ type: "section", section });
      },
    );
    send({ type: "result", run: await presentRun(completed) });
  } catch (error) {
    send({
      type: "error",
      error: error instanceof Error ? error.message : "Booklet generation failed",
    });
  }
  if (!res.writableEnded && !res.destroyed) res.end();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const input = req.method === "GET" ? req.query : req.body || {};
  const action = String(input.action || (req.method === "GET" ? "status" : ""));
  try {
    const user = await requireBookletUser(req);

    if (action === "create_thread") {
      if (!validId(input.companyId))
        return res.status(400).json({ error: "A valid companyId is required" });
      const website = await websiteEvidence(input.websiteUrl);
      const instruction = messageEvidence(input.message, input.messageAsEvidence);
      const thread = await createBookletThread(String(input.companyId), user.uid);
      const uploads = decodeUploads(input.files);
      const uploaded = await storeUploadedFiles({
        thread,
        files: [
          ...uploads,
          ...(website ? [website.file] : []),
          ...(instruction ? [instruction] : []),
        ],
      });
      const existingFileIds = Array.isArray(input.fileIds)
        ? input.fileIds.filter(validId).map(String)
        : [];
      await assertOwnedFiles(existingFileIds, user.uid, thread.companyId);
      await attachFileIdsToThread(thread.id, existingFileIds);
      const attachmentFileIds = [...uploaded.map((file) => file.id), ...existingFileIds];
      if (input.message || attachmentFileIds.length)
        await addBookletMessage({
          threadId: thread.id,
          role: "user",
          text: String(input.message || "Added booklet source evidence."),
          attachmentFileIds,
          kind: "message",
        });
      return res.status(201).json({
        thread: { ...thread, uploadedFileIds: attachmentFileIds },
        files: uploaded,
        websiteProfile: website?.profile || null,
      });
    }

    if (action === "add_message") {
      if (!validId(input.threadId))
        return res.status(400).json({ error: "A valid threadId is required" });
      const thread = await getBookletThread(String(input.threadId));
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      assertOwner(thread.ownerId, user.uid);
      const website = await websiteEvidence(input.websiteUrl);
      const instruction = messageEvidence(input.message, input.messageAsEvidence);
      const uploads = decodeUploads(input.files);
      const uploaded = await storeUploadedFiles({
        thread,
        files: [
          ...uploads,
          ...(website ? [website.file] : []),
          ...(instruction ? [instruction] : []),
        ],
      });
      const existingFileIds = Array.isArray(input.fileIds)
        ? input.fileIds.filter(validId).map(String)
        : [];
      await assertOwnedFiles(existingFileIds, user.uid, thread.companyId);
      const fileIds = [...uploaded.map((file) => file.id), ...existingFileIds];
      await attachFileIdsToThread(thread.id, existingFileIds);
      const message = await addBookletMessage({
        threadId: thread.id,
        role: "user",
        text: String(input.message || (fileIds.length ? "Added booklet source evidence." : "")),
        attachmentFileIds: fileIds,
        kind: "message",
      });
      return res.status(201).json({
        message,
        files: uploaded,
        websiteProfile: website?.profile || null,
      });
    }

    if (action === "delete_file") {
      if (!validId(input.threadId) || !validId(input.fileId))
        return res.status(400).json({ error: "A valid threadId and fileId are required" });
      const thread = await getBookletThread(String(input.threadId));
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      assertOwner(thread.ownerId, user.uid);
      if (!thread.uploadedFileIds.includes(String(input.fileId)))
        return res.status(404).json({ error: "Source file is not attached to this thread" });
      if (thread.latestRunId) {
        const latestRun = await getGenerationRun(thread.latestRunId);
        if (latestRun && ["queued", "processing"].includes(latestRun.status))
          return res.status(409).json({ error: "Wait for the current generation run before deleting a source" });
      }
      const [file] = await assertOwnedFiles(
        [String(input.fileId)],
        user.uid,
        thread.companyId,
      );
      const updatedThread = await deleteUploadedFileFromThread(thread, file);
      await addBookletMessage({
        threadId: thread.id,
        role: "user",
        text: `Removed source file: ${file.fileName}`,
        attachmentFileIds: [],
        kind: "message",
      });
      return res.status(200).json({
        thread: updatedThread,
        files: await getUploadedFileRecords(updatedThread.uploadedFileIds),
        deletedFileId: file.id,
      });
    }

    if (action === "start") {
      if (!validId(input.threadId))
        return res.status(400).json({ error: "A valid threadId is required" });
      const thread = await getBookletThread(String(input.threadId));
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      assertOwner(thread.ownerId, user.uid);
      const requestedFileIds = Array.isArray(input.fileIds)
        ? input.fileIds.filter(validId).map(String)
        : thread.uploadedFileIds;
      if (!requestedFileIds.length)
        return res.status(422).json({ error: "Attach at least one file before starting" });
      if (requestedFileIds.some((fileId) => !thread.uploadedFileIds.includes(fileId)))
        throw new BookletAuthError("A requested file is not attached to this thread", 403);
      await assertOwnedFiles(requestedFileIds, user.uid, thread.companyId);
      const run = createGenerationRun({
        threadId: thread.id,
        companyId: thread.companyId,
        ownerId: user.uid,
        uploadedFileIds: requestedFileIds,
      });
      await saveGenerationRun(run);
      if (wantsStream(input.stream)) return streamExecution(res, run);
      const completed = await executeRun(run);
      return res.status(completed.status === "blocked" ? 202 : 200).json({
        run: await presentRun(completed),
      });
    }

    if (action === "answer") {
      if (!validId(input.runId))
        return res.status(400).json({ error: "A valid runId is required" });
      const run = await getGenerationRun(String(input.runId));
      if (!run) return res.status(404).json({ error: "Generation run not found" });
      assertOwner(run.ownerId, user.uid);
      const suppliedAnswers =
        input.answers && typeof input.answers === "object" && !Array.isArray(input.answers)
          ? (input.answers as Record<string, unknown>)
          : null;
      if (suppliedAnswers) {
        const blockingPaths = new Set(run.questions.map((item) => item.fieldPath));
        const acceptedAnswers = Object.fromEntries(
          Object.entries(suppliedAnswers).filter(([fieldPath]) => blockingPaths.has(fieldPath)),
        );
        if (!Object.keys(acceptedAnswers).length)
          return res.status(404).json({ error: "No supplied answers match a blocking question" });
        run.answers = { ...run.answers, ...acceptedAnswers };
        await Promise.all(
          Object.entries(acceptedAnswers).map(([fieldPath, answer]) =>
            addBookletMessage({
              threadId: run.threadId,
              role: "user",
              text: `${fieldPath}: ${JSON.stringify(answer)}`,
              attachmentFileIds: [],
              kind: "answer",
            }),
          ),
        );
      } else {
        const question = run.questions.find(
          (item) => item.id === input.questionId || item.fieldPath === input.fieldPath,
        );
        if (!question) return res.status(404).json({ error: "Blocking question not found" });
        run.answers = { ...run.answers, [question.fieldPath]: input.answer };
        await addBookletMessage({
          threadId: run.threadId,
          role: "user",
          text: `${question.fieldPath}: ${JSON.stringify(input.answer)}`,
          attachmentFileIds: [],
          kind: "answer",
        });
      }
      if (wantsStream(input.stream)) return streamExecution(res, run);
      const completed = await executeRun(run);
      return res.status(completed.status === "blocked" ? 202 : 200).json({
        run: await presentRun(completed),
      });
    }

    if (action === "status") {
      if (!validId(input.runId))
        return res.status(400).json({ error: "A valid runId is required" });
      const run = await getGenerationRun(String(input.runId));
      if (!run) return res.status(404).json({ error: "Generation run not found" });
      assertOwner(run.ownerId, user.uid);
      return res.status(200).json(await runStatusPayload(run));
    }

    if (action === "thread_status") {
      if (!validId(input.threadId))
        return res.status(400).json({ error: "A valid threadId is required" });
      const thread = await getBookletThread(String(input.threadId));
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      assertOwner(thread.ownerId, user.uid);
      const files = await assertOwnedFiles(thread.uploadedFileIds, user.uid, thread.companyId);
      if (!thread.latestRunId) return res.status(200).json({ thread, files, run: null, events: [], facts: [], sections: [] });
      const run = await getGenerationRun(thread.latestRunId);
      if (!run) return res.status(200).json({ thread, files, run: null, events: [], facts: [], sections: [] });
      assertOwner(run.ownerId, user.uid);
      return res.status(200).json({ thread, files, ...(await runStatusPayload(run)) });
    }

    return res.status(400).json({
      error:
        "Unknown action. Use create_thread, add_message, delete_file, start, answer, status, or thread_status.",
    });
  } catch (error) {
    if (!(error instanceof BookletAuthError))
      console.error("booklet-pipeline failed", { action, error });
    if (res.headersSent) {
      if (!res.writableEnded) res.end();
      return;
    }
    return res.status(error instanceof BookletAuthError ? error.statusCode : 500).json({
      error: error instanceof Error ? error.message : "Booklet pipeline failed",
    });
  }
}
