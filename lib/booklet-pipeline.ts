import { randomUUID } from "node:crypto";
import {
  assessBookletContentSections,
  generateBookletContentIncrementally,
  type BookletContentResult,
  type BookletSectionContent,
} from "./booklet-content-agent";
import { assembleBenefitsPackage, type ExtractedMedicalPlan } from "./benefits-package-assembler";
import {
  extractBookletDocument,
  extractionFromCompanyWebsite,
  type BookletDocumentExtraction,
} from "./booklet-document-extractor";
import {
  generateBenefitsPackagePdfFromHtml,
  renderBenefitsPackagePreviewPages,
} from "./benefits-booklet-generator";
import {
  artifactsFromPreviewPages,
  composeBookletHtml,
  sectionIdFromPageId,
} from "./booklet-section-artifacts";
import { checkBookletQuality, type QualityReport } from "./booklet-quality-checker";
import { generateBookletOutline } from "./booklet-outline";
import type {
  BenefitsPackage,
  BlockerQuestion,
  BookletGenerationRun,
  BookletOutline,
  BookletSectionArtifact,
  ClassifiedDocument,
  ExtractedFact,
  LoadedUploadedFile,
  PipelineEvent,
  PipelineStage,
} from "./booklet-types";
import { classifyDocumentWithFallback } from "./document-classifier";
import {
  factsFromDocumentExtraction,
  factsFromManualAnswers,
  factsFromMedicalPlan,
} from "./extracted-facts";
import { extractMedicalPlan, type PlanPatch } from "./plan-extractor";
import { buildBlockerQuestions } from "./question-engine";
import { extractRateSheet } from "./rate-sheet-extractor";

export type PipelineResult = {
  status: "blocked" | "complete";
  classifications: ClassifiedDocument[];
  questions: BlockerQuestion[];
  benefitsPackage: BenefitsPackage;
  outline?: BookletOutline;
  html?: string;
  pdf?: Buffer;
  qualityReport?: QualityReport;
  content?: BookletContentResult;
  facts: ExtractedFact[];
  artifacts: BookletSectionArtifact[];
};

export type PipelineDependencies = {
  classify?: (file: LoadedUploadedFile) => Promise<ClassifiedDocument>;
  extractDocument?: (args: {
    file: LoadedUploadedFile;
    classification: ClassifiedDocument;
  }) => Promise<BookletDocumentExtraction>;
  extractPlan?: (args: {
    file: LoadedUploadedFile;
    classification: ClassifiedDocument;
  }) => Promise<ExtractedMedicalPlan>;
  writeContent?: (args: {
    benefitsPackage: BenefitsPackage;
    outline: BookletOutline;
  }) => Promise<BookletContentResult | undefined>;
  renderPdf?: (
    benefitsPackage: BenefitsPackage,
    outline: BookletOutline,
    content?: BookletContentResult,
  ) => Promise<Buffer>;
};

const documentExtractionTypes = new Set([
  "employer_application",
  "benefit_guide",
  "prior_booklet",
  "email_export",
  "company_website",
]);
const planTypes = new Set(["sbc", "spd", "plan_summary"]);
const rateTypes = new Set(["carrier_rate_sheet", "renewal_spreadsheet"]);

function sectionsBlockedByQuestions(
  questions: BlockerQuestion[],
  benefitsPackage: BenefitsPackage,
) {
  const blocked = new Set<string>(["toc"]);
  for (const question of questions) {
    const path = question.fieldPath;
    if (path.startsWith("employer.")) {
      blocked.add("cover");
      blocked.add("welcome");
    }
    if (path.startsWith("planYear.")) blocked.add("cover");
    if (path.startsWith("eligibility.")) blocked.add("eligibility");
    if (path === "plans.selected") {
      for (const section of [
        "medical",
        "dental",
        "vision",
        "life",
        "std",
        "ltd",
        "hsa",
        "hra",
        "fsa",
        "telemedicine",
        "eap",
        "voluntary",
      ])
        blocked.add(section);
    }
    const planId = path.match(/^(?:plans|contributions)\.([^.]+)/)?.[1];
    const plan = benefitsPackage.plans.find((item) => item.id === planId);
    if (plan) blocked.add(plan.benefitType);
  }
  return blocked;
}

function availableArtifactsDuringGeneration(
  artifacts: BookletSectionArtifact[],
  benefitsPackage: BenefitsPackage,
) {
  const hasEmployerIdentity = Boolean(benefitsPackage.employer.name.trim());
  const hasBenefitEvidence = benefitsPackage.offeredBenefits.some(
    (offering) => offering.offered,
  );
  return artifacts
    .map((artifact) =>
      artifact.sectionId === "cover" &&
      hasEmployerIdentity &&
      artifact.contentStatus === "blocked"
        ? { ...artifact, contentStatus: "provisional" as const }
        : artifact,
    )
    .filter(
      (artifact) =>
        artifact.sectionId !== "toc" &&
        (artifact.contentStatus === "ready" ||
          artifact.contentStatus === "provisional") &&
        (artifact.sectionId !== "welcome" || hasBenefitEvidence),
    );
}

function memoryPlanStore() {
  const patches: PlanPatch[] = [];
  const textPages: Array<{ pageNumber: number; text: string }> = [];
  return {
    patches,
    textPages,
    store: {
      updatePlan: async (patch: PlanPatch) => void patches.push(patch),
      writeTextPage: async (page: { pageNumber: number; text: string }) =>
        void textPages.push(page),
    },
  };
}

export async function runBookletPipeline({
  runId = randomUUID(),
  companyId,
  files,
  answers = {},
  onEvent = async () => {},
  onArtifact,
  dependencies = {},
}: {
  runId?: string;
  companyId: string;
  files: LoadedUploadedFile[];
  answers?: Record<string, unknown>;
  onEvent?: (event: PipelineEvent) => Promise<void> | void;
  onArtifact?: (artifact: BookletSectionArtifact) => Promise<void> | void;
  dependencies?: PipelineDependencies;
}): Promise<PipelineResult> {
  let eventSequence = 0;
  const emit = async (
    stage: PipelineStage,
    status: PipelineEvent["status"],
    message: string,
    details?: Record<string, unknown>,
  ) => {
    eventSequence += 1;
    const event: PipelineEvent = {
      id: `${runId}:${String(eventSequence).padStart(3, "0")}`,
      runId,
      stage,
      status,
      message,
      createdAt: new Date().toISOString(),
      ...(details === undefined ? {} : { details }),
    };
    await onEvent(event);
  };
  if (!files.length) throw new Error("At least one uploaded file is required");

  await emit("Uploading files", "complete", `${files.length} file(s) are ready for processing.`, {
    files: files.map((file) => ({ id: file.id, fileName: file.fileName, sha256: file.sha256 })),
  });

  await emit("Classifying documents", "started", "Classifying every uploaded file.");
  const classify = dependencies.classify || ((file) => classifyDocumentWithFallback({ file }));
  const classifications = await Promise.all(files.map((file) => classify(file)));
  await emit("Classifying documents", "complete", "Document classification is complete.", {
    documents: classifications.map((item) => ({
      fileId: item.fileId,
      documentType: item.documentType,
      confidence: item.confidence,
    })),
  });

  const employerExtractions: BookletDocumentExtraction[] = [];
  const planExtractions: BookletDocumentExtraction[] = [];
  const contextExtractions: BookletDocumentExtraction[] = [];
  const rates = [] as ReturnType<typeof extractRateSheet>["plans"];
  const rateContributions = [] as ReturnType<typeof extractRateSheet>["contributions"];
  const rateFacts: ExtractedFact[] = [];
  const rateWarnings: string[] = [];
  const medicalPlans: ExtractedMedicalPlan[] = [];
  const earlyArtifacts = new Map<string, BookletSectionArtifact>();
  const publishArtifact = onArtifact || (async () => {});
  let previewQueue: Promise<void> | null = null;
  const pendingPreviewReasons = new Set<string>();
  const fileOrder = new Map(files.map((file, index) => [file.id, index]));
  const orderExtractions = (items: BookletDocumentExtraction[]) =>
    [...items].sort(
      (left, right) =>
        (fileOrder.get(left.fileId) ?? Number.MAX_SAFE_INTEGER) -
        (fileOrder.get(right.fileId) ?? Number.MAX_SAFE_INTEGER),
    );
  const orderMedicalPlans = (items: ExtractedMedicalPlan[]) =>
    [...items].sort(
      (left, right) =>
        (fileOrder.get(left.file.id) ?? Number.MAX_SAFE_INTEGER) -
        (fileOrder.get(right.file.id) ?? Number.MAX_SAFE_INTEGER),
    );

  const publishAvailableArtifacts = async (reason: string) => {
    try {
      const snapshotPackage = assembleBenefitsPackage({
        companyId,
        documentExtractions: [
          ...orderExtractions(employerExtractions),
          ...orderExtractions(planExtractions),
          ...orderExtractions(contextExtractions),
        ],
        rates: [...rates],
        rateContributions: [...rateContributions],
        medicalPlans: orderMedicalPlans(medicalPlans),
        manualAnswers: answers,
      });
      snapshotPackage.confidenceReport.warnings.push(...rateWarnings);
      const snapshotOutline = generateBookletOutline(snapshotPackage);
      const snapshotContent: BookletContentResult = {
        variant: "incremental-source-backed",
        model: "deterministic",
        sections: assessBookletContentSections(snapshotPackage, snapshotOutline),
      };
      const readyArtifacts = availableArtifactsDuringGeneration(artifactsFromPreviewPages({
        runId,
        pages: renderBenefitsPackagePreviewPages(
          snapshotPackage,
          snapshotOutline,
          snapshotContent,
        ),
        outline: snapshotOutline,
        content: snapshotContent,
      }), snapshotPackage);
      for (const artifact of readyArtifacts) {
        const previous = earlyArtifacts.get(artifact.id);
        if (
          previous?.html === artifact.html &&
          previous?.pageIndex === artifact.pageIndex &&
          previous?.contentStatus === artifact.contentStatus
        )
          continue;
        earlyArtifacts.set(artifact.id, artifact);
        await publishArtifact(artifact);
        await emit(
          "Writing booklet content",
          "progress",
          `${previous ? "Updated" : "Generated"} ${artifact.title} while source processing continues.`,
          {
            artifactId: artifact.id,
            sectionId: artifact.sectionId,
            pageIndex: artifact.pageIndex,
            incremental: true,
            reason,
          },
        );
      }
    } catch (error) {
      await emit(
        "Writing booklet content",
        "warning",
        "An incremental preview snapshot could not be rendered; source processing will continue.",
        { reason, error: error instanceof Error ? error.message : String(error) },
      );
    }
  };

  const queuePreview = (reason: string) => {
    if (!onArtifact) return Promise.resolve();
    pendingPreviewReasons.add(reason);
    if (!previewQueue) {
      previewQueue = (async () => {
        // Let source branches that finish in the same turn share one package
        // snapshot instead of rendering the same pages repeatedly.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        while (pendingPreviewReasons.size) {
          const reasons = [...pendingPreviewReasons];
          pendingPreviewReasons.clear();
          await publishAvailableArtifacts(reasons.join("; "));
        }
      })().finally(() => {
        previewQueue = null;
      });
    }
    return previewQueue;
  };

  const extractionFor = async (
    stage: PipelineStage,
    types: Set<string>,
    target: BookletDocumentExtraction[],
  ) => {
    await emit(stage, "started", stage);
    const candidates = classifications.filter((item) => types.has(item.documentType));
    await Promise.all(
      candidates.map(async (classification) => {
        const file = files.find((candidate) => candidate.id === classification.fileId)!;
        try {
          const extraction = classification.documentType === "company_website"
            ? extractionFromCompanyWebsite(file, classification)
            : await (dependencies.extractDocument || ((args) => extractBookletDocument(args)))({
                file,
                classification,
              });
          target.push(extraction);
          await emit(stage, "progress", `Extracted ${file.fileName}.`, {
            fileId: file.id,
            documentType: classification.documentType,
          });
          await queuePreview(`${stage}: ${file.fileName}`);
        } catch (error) {
          await emit(stage, "warning", `Could not extract ${file.fileName}.`, {
            fileId: file.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );
    await emit(stage, "complete", `${target.length} document(s) extracted.`);
  };

  const readRates = async () => {
    await emit("Reading carrier rate sheets", "started", "Reading rate and contribution workbooks.");
    await Promise.all(
      classifications
        .filter((item) => rateTypes.has(item.documentType))
        .map(async (classification) => {
          const file = files.find((candidate) => candidate.id === classification.fileId)!;
          try {
            const extraction = extractRateSheet(file);
            rates.push(...extraction.plans);
            rateContributions.push(...extraction.contributions);
            rateFacts.push(...extraction.facts);
            rateWarnings.push(...extraction.warnings);
            await emit("Reading carrier rate sheets", "progress", `Found ${extraction.plans.length} plan-rate row(s) in ${file.fileName}.`);
            await queuePreview(`rates: ${file.fileName}`);
          } catch (error) {
            const message = `Could not read ${file.fileName}: ${error instanceof Error ? error.message : String(error)}`;
            rateWarnings.push(message);
            await emit("Reading carrier rate sheets", "warning", message);
          }
        }),
    );
    await emit("Reading carrier rate sheets", "complete", `${rates.length} normalized plan-rate row(s) found.`);
  };

  const parsePlans = async () => {
    await emit("Parsing plan documents", "started", "Parsing current plan documents.");
    await Promise.all(
      classifications
        .filter((item) => planTypes.has(item.documentType))
        .map(async (classification) => {
          const file = files.find((candidate) => candidate.id === classification.fileId)!;
          const genericExtraction = (async () => {
            try {
              const extraction = await (dependencies.extractDocument || ((args) => extractBookletDocument(args)))({
                file,
                classification,
              });
              planExtractions.push(extraction);
              await emit("Parsing plan documents", "progress", `Identified benefit coverage in ${file.fileName}.`, {
                benefitTypes: classification.detectedBenefitTypes || [],
              });
              await queuePreview(`plan inventory: ${file.fileName}`);
            } catch (error) {
              await emit("Parsing plan documents", "warning", `Could not extract benefit coverage from ${file.fileName}.`, {
                error: error instanceof Error ? error.message : String(error),
              });
            }
          })();
          const detectedTypes = classification.detectedBenefitTypes || [];
          const medicalExtraction = detectedTypes.length && !detectedTypes.includes("medical")
            ? Promise.resolve()
            : (async () => {
                try {
                  if (dependencies.extractPlan) {
                    medicalPlans.push(await dependencies.extractPlan({ file, classification }));
                  } else {
                    const state = memoryPlanStore();
                    const attributes = await extractMedicalPlan({
                      file: file.data,
                      fileName: file.fileName,
                      store: state.store,
                    });
                    medicalPlans.push({ file, classification, attributes });
                  }
                  await emit("Parsing plan documents", "progress", `Parsed medical plan details from ${file.fileName}.`);
                  await queuePreview(`medical details: ${file.fileName}`);
                } catch (error) {
                  await emit("Parsing plan documents", "warning", `Could not parse medical plan details from ${file.fileName}.`, {
                    error: error instanceof Error ? error.message : String(error),
                  });
                }
              })();
          await Promise.all([genericExtraction, medicalExtraction]);
        }),
    );
    await emit(
      "Parsing plan documents",
      "complete",
      `${planExtractions.length} plan document(s) inventoried; ${medicalPlans.length} medical plan(s) parsed in detail.`,
    );
  };

  await emit(
    "Writing booklet content",
    "started",
    "Streaming each source-backed HTML section as soon as its dependencies are ready.",
    { incremental: true },
  );
  await Promise.all([
    extractionFor(
      "Extracting employer setup",
      new Set(["employer_application", "email_export", "company_website"]),
      employerExtractions,
    ),
    readRates(),
    parsePlans(),
    extractionFor(
      "Reading prior booklets/guides",
      new Set(["benefit_guide", "prior_booklet"]),
      contextExtractions,
    ),
  ]);
  if (previewQueue) await previewQueue;
  const documentExtractions = [
    ...orderExtractions(employerExtractions),
    ...orderExtractions(planExtractions),
    ...orderExtractions(contextExtractions),
  ];
  const orderedMedicalPlans = orderMedicalPlans(medicalPlans);
  const facts = [
    ...documentExtractions.flatMap((extraction) =>
      factsFromDocumentExtraction(companyId, extraction),
    ),
    ...rateFacts,
    ...orderedMedicalPlans.flatMap(factsFromMedicalPlan),
    ...factsFromManualAnswers(companyId, answers),
  ];

  await emit("Matching rates to plans", "started", "Matching selected plans to normalized rate rows.");
  let benefitsPackage = assembleBenefitsPackage({
    companyId,
    documentExtractions,
    rates,
    rateContributions,
    medicalPlans: orderedMedicalPlans,
    manualAnswers: answers,
  });
  benefitsPackage.confidenceReport.warnings.push(...rateWarnings);
  await emit("Matching rates to plans", "complete", `${benefitsPackage.plans.filter((plan) => plan.ratePlanId).length} of ${benefitsPackage.plans.length} selected plan(s) matched to rates.`);

  await emit("Detecting offered benefits", "started", "Detecting offered benefit lines.");
  await emit("Detecting offered benefits", "complete", `${benefitsPackage.offeredBenefits.filter((item) => item.offered).length} offered benefit line(s) detected.`, {
    benefits: benefitsPackage.offeredBenefits
      .filter((item) => item.offered)
      .map((item) => item.benefitType),
  });

  await emit("Resolving conflicts", "started", "Applying field-specific source priority and checking blockers.");
  const questions = buildBlockerQuestions(benefitsPackage);
  await emit(
    "Resolving conflicts",
    questions.length ? "warning" : "complete",
    questions.length
      ? `${questions.length} blocking question(s) require an answer.`
      : "Conflicts are resolved and no blocking questions remain.",
    { questionIds: questions.map((question) => question.id) },
  );
  if (questions.length) {
    await emit(
      "Building booklet outline",
      "started",
      "Building the partial outline for sections that have enough evidence.",
    );
    const partialOutline = generateBookletOutline(benefitsPackage);
    await emit(
      "Building booklet outline",
      "complete",
      `${partialOutline.sections.length} potential section(s) identified.`,
      { sections: partialOutline.sections.map((section) => section.id), partial: true },
    );
    await emit(
      "Writing booklet content",
      "progress",
      "Rendering available HTML sections while blocked fields wait for answers.",
    );
    const blockedSectionIds = sectionsBlockedByQuestions(questions, benefitsPackage);
    const assessedSections = assessBookletContentSections(
      benefitsPackage,
      partialOutline,
    ).map((section) =>
      blockedSectionIds.has(section.id)
        ? {
            ...section,
            status: "blocked" as const,
            missingFields: [
              ...section.missingFields,
              ...questions
                .filter((question) => {
                  if (section.id === "cover")
                    return /^(?:employer|planYear)\./.test(question.fieldPath);
                  if (section.id === "eligibility")
                    return question.fieldPath.startsWith("eligibility.");
                  return true;
                })
                .map((question) => question.fieldPath),
            ],
          }
        : section,
    );
    const partialContent: BookletContentResult = {
      variant: "partial-source-backed",
      model: "deterministic",
      sections: assessedSections,
    };
    const partialArtifacts = availableArtifactsDuringGeneration(artifactsFromPreviewPages({
      runId,
      pages: renderBenefitsPackagePreviewPages(
        benefitsPackage,
        partialOutline,
        partialContent,
      ),
      outline: partialOutline,
      content: partialContent,
    }), benefitsPackage);
    for (const artifact of partialArtifacts) {
      const previous = earlyArtifacts.get(artifact.id);
      if (
        previous?.html === artifact.html &&
        previous?.pageIndex === artifact.pageIndex &&
        previous?.contentStatus === artifact.contentStatus
      )
        continue;
      earlyArtifacts.set(artifact.id, artifact);
      await publishArtifact(artifact);
      await emit("Writing booklet content", "progress", `Generated ${artifact.title}.`, {
        artifactId: artifact.id,
        sectionId: artifact.sectionId,
        pageIndex: artifact.pageIndex,
        partial: true,
      });
    }
    await emit(
      "Writing booklet content",
      partialArtifacts.length ? "complete" : "warning",
      partialArtifacts.length
        ? `${partialArtifacts.length} available HTML page(s) are ready while ${questions.length} blocker(s) remain.`
        : "No HTML section has enough evidence yet.",
      { partial: true, artifactCount: partialArtifacts.length },
    );
    return {
      status: "blocked",
      classifications,
      questions,
      benefitsPackage,
      facts,
      outline: partialOutline,
      content: partialContent,
      artifacts: partialArtifacts,
    };
  }

  await emit("Building booklet outline", "started", "Building a source-backed section outline.");
  const outline = generateBookletOutline(benefitsPackage);
  await emit("Building booklet outline", "complete", `${outline.sections.length} booklet section(s) selected.`, {
    sections: outline.sections.map((section) => section.id),
  });

  await emit("Writing booklet content", "progress", "Writing concise employee-facing content from the normalized package.");
  let content: BookletContentResult | undefined;
  const streamedArtifacts = new Map<string, BookletSectionArtifact>(earlyArtifacts);
  const streamedSections = new Map<string, BookletSectionContent>();
  for (const artifact of artifactsFromPreviewPages({
    runId,
    pages: renderBenefitsPackagePreviewPages(benefitsPackage, outline),
    outline,
  })) {
    const previous = streamedArtifacts.get(artifact.id);
    if (
      previous?.html === artifact.html &&
      previous?.pageIndex === artifact.pageIndex &&
      previous?.contentStatus === artifact.contentStatus
    )
      continue;
    streamedArtifacts.set(artifact.id, artifact);
    await publishArtifact(artifact);
    await emit(
      "Writing booklet content",
      "progress",
      `Rendered source-backed HTML for ${artifact.title}.`,
      {
        artifactId: artifact.id,
        sectionId: artifact.sectionId,
        pageIndex: artifact.pageIndex,
        draft: true,
      },
    );
  }
  const publishSection = async (section: BookletSectionContent) => {
    streamedSections.set(section.id, section);
    const partialContent: BookletContentResult = {
      variant: "employee-friendly standard",
      model: process.env.OPENAI_BOOKLET_CONTENT_MODEL || "incremental",
      sections: [...streamedSections.values()],
    };
    const pages = renderBenefitsPackagePreviewPages(
      benefitsPackage,
      outline,
      partialContent,
    ).filter((page) => {
      const pageId = page.html.match(/data-page-id=["']([^"']+)["']/)?.[1] || "";
      return sectionIdFromPageId(pageId) === section.id;
    });
    for (const artifact of artifactsFromPreviewPages({
      runId,
      pages,
      outline,
      content: partialContent,
    })) {
      const previous = streamedArtifacts.get(artifact.id);
      if (
        previous?.html === artifact.html &&
        previous?.pageIndex === artifact.pageIndex &&
        previous?.contentStatus === artifact.contentStatus
      )
        continue;
      streamedArtifacts.set(artifact.id, artifact);
      await publishArtifact(artifact);
      await emit(
        "Writing booklet content",
        "progress",
        `Generated ${artifact.title}.`,
        {
          artifactId: artifact.id,
          sectionId: artifact.sectionId,
          pageIndex: artifact.pageIndex,
          contentStatus: artifact.contentStatus,
        },
      );
    }
  };
  try {
    if (dependencies.writeContent) {
      content = await dependencies.writeContent({ benefitsPackage, outline });
    } else if (process.env.OPENAI_API_KEY) {
      content = await generateBookletContentIncrementally(
        benefitsPackage,
        outline,
        "employee-friendly standard",
        {
          apiKey: process.env.OPENAI_API_KEY,
          batchSize: 3,
          concurrency: 2,
          onSection: publishSection,
          onSectionError: async (sectionIds, error) => {
            await emit(
              "Writing booklet content",
              "warning",
              `Dynamic copy could not be completed for ${sectionIds.join(", ")}; deterministic source-backed HTML will be used.`,
              { error: error instanceof Error ? error.message : String(error), sectionIds },
            );
          },
        },
      );
    }
  } catch (error) {
    await emit(
      "Writing booklet content",
      "warning",
      "The grounded content agent could not complete; deterministic source-backed rendering will continue.",
      { error: error instanceof Error ? error.message : String(error) },
    );
  }
  const finalArtifacts = artifactsFromPreviewPages({
    runId,
    pages: renderBenefitsPackagePreviewPages(benefitsPackage, outline, content),
    outline,
    content,
  });
  for (const artifact of finalArtifacts) {
    const previous = streamedArtifacts.get(artifact.id);
    if (
      previous?.html === artifact.html &&
      previous?.contentStatus === artifact.contentStatus
    )
      continue;
    streamedArtifacts.set(artifact.id, artifact);
    await publishArtifact(artifact);
    await emit("Writing booklet content", "progress", `Generated ${artifact.title}.`, {
      artifactId: artifact.id,
      sectionId: artifact.sectionId,
      pageIndex: artifact.pageIndex,
      contentStatus: artifact.contentStatus,
    });
  }
  const artifacts = finalArtifacts;
  const html = composeBookletHtml(artifacts);
  await emit(
    "Writing booklet content",
    "complete",
    content
      ? `${content.sections.filter((section) => section.status === "ready").length} grounded dynamic section(s) are ready.`
      : "Booklet HTML is ready.",
  );

  await emit("Running quality checks", "started", "Checking sources, sections, costs, and placeholders before rendering.");
  const preflight = await checkBookletQuality({ benefitsPackage, outline, html });
  if (!preflight.passed) {
    const message = preflight.issues.filter((issue) => issue.blocking).map((issue) => issue.message).join(" ");
    await emit("Running quality checks", "warning", message, { issues: preflight.issues });
    throw new Error(`Booklet preflight failed: ${message}`);
  }
  await emit("Running quality checks", "complete", "Pre-render quality checks passed.");

  await emit("Rendering PDF", "started", "Rendering the final PDF.");
  const pdf = dependencies.renderPdf
    ? await dependencies.renderPdf(benefitsPackage, outline, content)
    : await generateBenefitsPackagePdfFromHtml(html);
  await emit("Rendering PDF", "complete", `Rendered ${pdf.length} PDF bytes.`);

  await emit("Running quality checks", "started", "Validating the rendered PDF.");
  const qualityReport = await checkBookletQuality({ benefitsPackage, outline, html, pdf });
  if (!qualityReport.passed) {
    const message = qualityReport.issues.filter((issue) => issue.blocking).map((issue) => issue.message).join(" ");
    await emit("Running quality checks", "warning", message, { issues: qualityReport.issues });
    throw new Error(`Rendered booklet failed quality checks: ${message}`);
  }
  await emit("Running quality checks", "complete", `Rendered PDF passed quality checks (${qualityReport.pageCount} pages).`);
  await emit("Complete", "complete", "Benefits booklet generation is complete.", {
    confidence: benefitsPackage.confidenceReport.overall,
    pageCount: qualityReport.pageCount,
  });
  return {
    status: "complete",
    classifications,
    questions: [],
    benefitsPackage,
    outline,
    html,
    pdf,
    qualityReport,
    content,
    facts,
    artifacts,
  };
}

export function createGenerationRun({
  id = randomUUID(),
  threadId,
  companyId,
  ownerId,
  uploadedFileIds,
}: {
  id?: string;
  threadId: string;
  companyId: string;
  ownerId: string;
  uploadedFileIds: string[];
}): BookletGenerationRun {
  return {
    id,
    threadId,
    companyId,
    ownerId,
    status: "queued",
    uploadedFileIds,
    stages: [],
    questions: [],
    answers: {},
    createdAt: new Date().toISOString(),
  };
}
