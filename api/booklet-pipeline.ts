import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createGenerationRun, runBookletPipeline } from "../lib/booklet-pipeline";
import type { BookletGenerationRun } from "../lib/booklet-types";
import {
  addBookletMessage,
  attachFileIdsToThread,
  createBookletThread,
  getBookletThread,
  getGenerationRun,
  getPipelineEvents,
  loadUploadedFiles,
  saveGeneratedPdf,
  saveGenerationRun,
  saveExtractedFacts,
  savePipelineEvent,
  storeUploadedFiles,
} from "../lib/booklet-thread-store";

export const config = { maxDuration: 300, includeFiles: "lib/**" };

const validId = (value: unknown) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(value);

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
    return { fileName: String(upload.fileName), mimeType, data };
  });
}

async function executeRun(run: BookletGenerationRun) {
  const files = await loadUploadedFiles(run.uploadedFileIds);
  run.status = "processing";
  run.error = null;
  await saveGenerationRun(run);
  try {
    const result = await runBookletPipeline({
      runId: run.id,
      companyId: run.companyId,
      files,
      answers: run.answers,
      onEvent: savePipelineEvent,
    });
    run.questions = result.questions;
    run.benefitsPackageSnapshot = result.benefitsPackage;
    run.requirementsSnapshot = result.benefitsPackage.requirements;
    run.renderManifest = result.renderManifest || null;
    run.claimLedger = result.content?.claims || [];
    run.contentModel = result.content?.model || null;
    run.qualityReport = result.qualityReport || null;
    run.confidenceReport = result.benefitsPackage.confidenceReport;
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
    run.pdfStoragePath = stored.storagePath;
    run.pdfUrl = stored.url;
    run.completedAt = new Date().toISOString();
    await saveGenerationRun(run);
    await addBookletMessage({
      threadId: run.threadId,
      role: "agent",
      text: `Benefits booklet complete: ${stored.url}`,
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const input = req.method === "GET" ? req.query : req.body || {};
  const action = String(input.action || (req.method === "GET" ? "status" : ""));
  try {
    if (action === "create_thread") {
      if (!validId(input.companyId))
        return res.status(400).json({ error: "A valid companyId is required" });
      const thread = await createBookletThread(String(input.companyId));
      const uploads = decodeUploads(input.files);
      const uploaded = uploads.length ? await storeUploadedFiles({ thread, files: uploads }) : [];
      const existingFileIds = Array.isArray(input.fileIds)
        ? input.fileIds.filter(validId).map(String)
        : [];
      await attachFileIdsToThread(thread.id, existingFileIds);
      const attachmentFileIds = [...uploaded.map((file) => file.id), ...existingFileIds];
      if (input.message)
        await addBookletMessage({
          threadId: thread.id,
          role: "user",
          text: String(input.message),
          attachmentFileIds,
          kind: "message",
        });
      return res.status(201).json({
        thread: { ...thread, uploadedFileIds: attachmentFileIds },
        files: uploaded,
      });
    }

    if (action === "add_message") {
      if (!validId(input.threadId))
        return res.status(400).json({ error: "A valid threadId is required" });
      const thread = await getBookletThread(String(input.threadId));
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      const uploads = decodeUploads(input.files);
      const uploaded = uploads.length ? await storeUploadedFiles({ thread, files: uploads }) : [];
      const fileIds = [
        ...uploaded.map((file) => file.id),
        ...(Array.isArray(input.fileIds) ? input.fileIds.filter(validId).map(String) : []),
      ];
      await attachFileIdsToThread(thread.id, fileIds);
      const message = await addBookletMessage({
        threadId: thread.id,
        role: "user",
        text: String(input.message || ""),
        attachmentFileIds: fileIds,
        kind: "message",
      });
      return res.status(201).json({ message, files: uploaded });
    }

    if (action === "start") {
      if (!validId(input.threadId))
        return res.status(400).json({ error: "A valid threadId is required" });
      const thread = await getBookletThread(String(input.threadId));
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      const requestedFileIds = Array.isArray(input.fileIds)
        ? input.fileIds.filter(validId).map(String)
        : thread.uploadedFileIds;
      if (!requestedFileIds.length)
        return res.status(422).json({ error: "Attach at least one file before starting" });
      const run = createGenerationRun({
        threadId: thread.id,
        companyId: thread.companyId,
        uploadedFileIds: requestedFileIds,
      });
      await saveGenerationRun(run);
      const completed = await executeRun(run);
      return res.status(completed.status === "blocked" ? 202 : 200).json({ run: completed });
    }

    if (action === "answer") {
      if (!validId(input.runId))
        return res.status(400).json({ error: "A valid runId is required" });
      const run = await getGenerationRun(String(input.runId));
      if (!run) return res.status(404).json({ error: "Generation run not found" });
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
      const completed = await executeRun(run);
      return res.status(completed.status === "blocked" ? 202 : 200).json({ run: completed });
    }

    if (action === "status") {
      if (!validId(input.runId))
        return res.status(400).json({ error: "A valid runId is required" });
      const run = await getGenerationRun(String(input.runId));
      if (!run) return res.status(404).json({ error: "Generation run not found" });
      const events = await getPipelineEvents(run.id);
      return res.status(200).json({ run, events });
    }
    return res.status(400).json({
      error: "Unknown action. Use create_thread, add_message, start, answer, or status.",
    });
  } catch (error) {
    console.error("booklet-pipeline failed", { action, error });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Booklet pipeline failed",
    });
  }
}
