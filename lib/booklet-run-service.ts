import type {
  BookletGenerationRun,
  BookletSectionArtifact,
  PipelineEvent,
} from "./booklet-types";
import { PDFDocument } from "pdf-lib";
import { runBookletPipeline } from "./booklet-pipeline";
import {
  addBookletMessage,
  getExtractedFacts,
  getPipelineEvents,
  getSectionArtifacts,
  loadUploadedFiles,
  pruneSectionArtifacts,
  refreshGeneratedPdfUrl,
  resetPipelineEvents,
  saveGeneratedPdf,
  saveGenerationRun,
  saveExtractedFacts,
  savePipelineEvent,
  saveSectionArtifact,
} from "./booklet-thread-store";

export async function presentBookletRun(run: BookletGenerationRun) {
  if (run.status === "complete" && run.pdfStoragePath) {
    return {
      ...run,
      pdfUrl: await refreshGeneratedPdfUrl(run.pdfStoragePath),
    };
  }
  return run;
}

export async function getBookletRunStatus(run: BookletGenerationRun) {
  const [events, facts, sections] = await Promise.all([
    getPipelineEvents(run.id),
    getExtractedFacts(run.id),
    getSectionArtifacts(run.id),
  ]);
  return { run: await presentBookletRun(run), events, facts, sections };
}

export async function executeBookletRun(
  run: BookletGenerationRun,
  onEvent?: (event: PipelineEvent) => void | Promise<void>,
  onArtifact?: (artifact: BookletSectionArtifact) => void | Promise<void>,
  options: { enforceRegistry?: boolean } = {},
) {
  const enforceRegistry =
    options.enforceRegistry ?? run.generationMode !== "employee_booklet";
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
      enforceRegistry,
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
    // Employee-booklet mode produces the concise, source-backed summary itself.
    // Uploaded guides and governing documents remain evidence; do not copy
    // their complete pages into the employee-facing output.
    const finalPdf = result.pdf!;
    const stored = await saveGeneratedPdf({
      run,
      pdf: finalPdf,
      employerName: result.benefitsPackage.employer.name,
    });
    run.status = "complete";
    run.questions = [];
    run.bookletOutline = result.outline;
    run.qualityReport = result.qualityReport
      ? {
          ...result.qualityReport,
          pageCount: (await PDFDocument.load(finalPdf)).getPageCount(),
        }
      : null;
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
