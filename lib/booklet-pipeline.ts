import { randomUUID } from "node:crypto";
import {
  generateBookletContent,
  type BookletContentResult,
} from "./booklet-content-agent";
import { assembleBenefitsPackage, type ExtractedMedicalPlan } from "./benefits-package-assembler";
import {
  extractBookletDocument,
  type BookletDocumentExtraction,
} from "./booklet-document-extractor";
import { generateBenefitsPackagePdf, renderBenefitsPackageHtml } from "./benefits-booklet-generator";
import { checkBookletQuality, type QualityReport } from "./booklet-quality-checker";
import { generateBookletOutline } from "./booklet-outline";
import type {
  BenefitsPackage,
  BlockerQuestion,
  BookletGenerationRun,
  BookletOutline,
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
  requirementCandidatesFromMedicalPlan,
  requirementCandidatesFromRates,
} from "./extracted-facts";
import { extractMedicalPlan, type PlanPatch } from "./plan-extractor";
import {
  buildBlockerQuestions,
  buildRequirementQuestions,
} from "./question-engine";
import { extractRateSheet } from "./rate-sheet-extractor";
import {
  buildBenefitRequirementSubjects,
  candidatesFromDocumentExtractions,
} from "./benefit-resolution-builder";
import {
  buildBookletRenderManifest,
  evaluateRequirementSubjects,
  renderedPathsFromManifest,
} from "./booklet-render-manifest";
import { BENEFIT_REQUIREMENTS_REGISTRY_VERSION } from "./benefit-requirements";
import type { BookletRenderManifest } from "./booklet-types";

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
  renderManifest?: BookletRenderManifest;
  facts: ExtractedFact[];
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
    renderManifest?: BookletRenderManifest;
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
]);
const planTypes = new Set(["sbc", "spd", "plan_summary"]);
const rateTypes = new Set(["carrier_rate_sheet", "renewal_spreadsheet"]);

function isLikelyAncillaryPlanDocument(
  file: LoadedUploadedFile,
  classification: ClassifiedDocument,
) {
  // A medical SBC stays on the detailed medical parser even when it mentions
  // embedded telehealth services or HSA compatibility. Those references do
  // not turn the SBC into a standalone ancillary/account document.
  if (
    classification.documentType === "sbc" &&
    classification.benefitTypes?.includes("medical")
  )
    return false;
  const explicitlyAncillary = classification.benefitTypes?.some((benefitType) =>
    [
      "dental",
      "vision",
      "life",
      "std",
      "ltd",
      "eap",
      "voluntary",
      "telemedicine",
      "hsa",
      "hra",
      "fsa",
    ].includes(benefitType),
  );
  if (explicitlyAncillary && !classification.benefitTypes?.includes("medical"))
    return true;
  const evidence = `${file.fileName} ${classification.reasoningSummary}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  return /\b(?:std|disability|short term disability|ltd|long term disability|life and ad d|dental|vision|health savings account|hsa|health reimbursement account|hra|flexible spending account|fsa|telemedicine|employee assistance|eap|accident|critical illness|hospital indemnity)\b/.test(
    evidence,
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
  dependencies = {},
}: {
  runId?: string;
  companyId: string;
  files: LoadedUploadedFile[];
  answers?: Record<string, unknown>;
  onEvent?: (event: PipelineEvent) => Promise<void> | void;
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

  const extractionFor = async (stage: PipelineStage, types: Set<string>) => {
    await emit(stage, "started", stage);
    const extracted: BookletDocumentExtraction[] = [];
    for (const classification of classifications.filter((item) => types.has(item.documentType))) {
      const file = files.find((candidate) => candidate.id === classification.fileId)!;
      try {
        extracted.push(
          await (dependencies.extractDocument || ((args) => extractBookletDocument(args)))({
            file,
            classification,
          }),
        );
        await emit(stage, "progress", `Extracted ${file.fileName}.`, {
          fileId: file.id,
          documentType: classification.documentType,
        });
      } catch (error) {
        await emit(stage, "warning", `Could not extract ${file.fileName}.`, {
          fileId: file.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    await emit(stage, "complete", `${extracted.length} document(s) extracted.`);
    return extracted;
  };

  const employerExtractions = await extractionFor(
    "Extracting employer setup",
    new Set(["employer_application", "email_export"]),
  );

  await emit("Reading carrier rate sheets", "started", "Reading rate and contribution workbooks.");
  const rates = [] as ReturnType<typeof extractRateSheet>["plans"];
  const rateContributions = [] as ReturnType<typeof extractRateSheet>["contributions"];
  const rateFacts: ExtractedFact[] = [];
  const rateWarnings: string[] = [];
  for (const classification of classifications.filter((item) => rateTypes.has(item.documentType))) {
    const file = files.find((candidate) => candidate.id === classification.fileId)!;
    try {
      const extraction = extractRateSheet(file);
      rates.push(...extraction.plans);
      rateContributions.push(...extraction.contributions);
      rateFacts.push(...extraction.facts);
      rateWarnings.push(...extraction.warnings);
      await emit("Reading carrier rate sheets", "progress", `Found ${extraction.plans.length} plan-rate row(s) in ${file.fileName}.`);
    } catch (error) {
      const message = `Could not read ${file.fileName}: ${error instanceof Error ? error.message : String(error)}`;
      rateWarnings.push(message);
      await emit("Reading carrier rate sheets", "warning", message);
    }
  }
  await emit("Reading carrier rate sheets", "complete", `${rates.length} normalized plan-rate row(s) found.`);

  await emit("Parsing plan documents", "started", "Parsing current plan documents.");
  const medicalPlans: ExtractedMedicalPlan[] = [];
  const ancillaryPlanExtractions: BookletDocumentExtraction[] = [];
  for (const classification of classifications.filter((item) => planTypes.has(item.documentType))) {
    const file = files.find((candidate) => candidate.id === classification.fileId)!;
    try {
      if (isLikelyAncillaryPlanDocument(file, classification)) {
        ancillaryPlanExtractions.push(
          await (dependencies.extractDocument || ((args) => extractBookletDocument(args)))({
            file,
            classification,
          }),
        );
        await emit(
          "Parsing plan documents",
          "progress",
          `Extracted ancillary plan ${file.fileName}.`,
        );
      } else if (dependencies.extractPlan) {
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
      if (!isLikelyAncillaryPlanDocument(file, classification))
        await emit("Parsing plan documents", "progress", `Parsed ${file.fileName}.`);
    } catch (error) {
      await emit("Parsing plan documents", "warning", `Could not parse ${file.fileName}.`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  await emit("Parsing plan documents", "complete", `${medicalPlans.length} plan document(s) parsed.`);

  const contextExtractions = await extractionFor(
    "Reading prior booklets/guides",
    new Set(["benefit_guide", "prior_booklet"]),
  );
  const documentExtractions = [
    ...employerExtractions,
    ...contextExtractions,
    ...ancillaryPlanExtractions,
  ];
  const facts = [
    ...documentExtractions.flatMap((extraction) =>
      factsFromDocumentExtraction(companyId, extraction),
    ),
    ...rateFacts,
    ...medicalPlans.flatMap(factsFromMedicalPlan),
    ...factsFromManualAnswers(companyId, answers),
  ];

  await emit("Matching rates to plans", "started", "Matching selected plans to normalized rate rows.");
  let benefitsPackage = assembleBenefitsPackage({
    companyId,
    documentExtractions,
    rates,
    rateContributions,
    medicalPlans,
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

  const requirementCandidates = [
    ...candidatesFromDocumentExtractions({
      extractions: documentExtractions,
      classifications,
    }),
    ...medicalPlans.flatMap(requirementCandidatesFromMedicalPlan),
    ...requirementCandidatesFromRates({
      companyId,
      rates,
      contributions: [...rateContributions],
      selectedRatePlanIds: benefitsPackage.plans
        .map((plan) => plan.ratePlanId)
        .filter((value): value is string => Boolean(value)),
    }),
  ];
  const requirementSubjects = buildBenefitRequirementSubjects({
    companyId,
    classifications,
    candidates: requirementCandidates,
    manualAnswers: answers,
  });
  const registryClassificationContractReady = classifications.every(
    (item) =>
      Array.isArray(item.benefitTypes) &&
      typeof item.documentSubtype === "string" &&
      typeof item.scope === "string" &&
      typeof item.authority === "string" &&
      Array.isArray(item.planOrProgramIds),
  );
  if (!registryClassificationContractReady)
    for (const subject of requirementSubjects)
      subject.enforcementStatus = "legacy_unenforced";
  const extractionReports = evaluateRequirementSubjects(
    requirementSubjects,
    "complete_extraction",
  );
  const registryEnforcementActive = requirementSubjects.some(
    (subject) => subject.enforcementStatus === "registry_enforced",
  );
  benefitsPackage.requirements = {
    registryVersion: BENEFIT_REQUIREMENTS_REGISTRY_VERSION,
    subjects: requirementSubjects,
    extractionReports,
    safeBookletReports: [],
    renderedPathsBySubject: {},
  };

  await emit("Resolving conflicts", "started", "Applying field-specific source priority and checking blockers.");
  const legacyQuestions = buildBlockerQuestions(benefitsPackage);
  const registryQuestions = registryEnforcementActive
    ? buildRequirementQuestions({
        subjects: requirementSubjects,
        reports: extractionReports,
      })
    : [];
  const questions = [
    ...new Map(
      [...registryQuestions, ...legacyQuestions].map((item) => [
        item.fieldPath,
        item,
      ]),
    ).values(),
  ];
  await emit(
    "Resolving conflicts",
    questions.length ? "warning" : "complete",
    questions.length
      ? `${questions.length} blocking question(s) require an answer.`
      : "Conflicts are resolved and no blocking questions remain.",
    { questionIds: questions.map((question) => question.id) },
  );
  if (questions.length)
    return { status: "blocked", classifications, questions, benefitsPackage, facts };

  if (
    registryEnforcementActive &&
    extractionReports.some(
      (report) =>
        requirementSubjects.find((subject) => subject.id === report.subjectId)
          ?.enforcementStatus === "registry_enforced" && !report.passed,
    )
  ) {
    const reviewIssues = extractionReports
      .flatMap((report) => report.issues)
      .filter((issue) => issue.code === "legal_determination_required");
    throw new Error(
      reviewIssues.length
        ? `Benefit requirements require compliance review: ${reviewIssues.map((issue) => issue.blockerCode || issue.requirementId).join(", ")}`
        : "Benefit requirement extraction failed without a user-resolvable answer.",
    );
  }

  await emit("Building booklet outline", "started", "Building a source-backed section outline.");
  const outline = generateBookletOutline(benefitsPackage);
  await emit("Building booklet outline", "complete", `${outline.sections.length} booklet section(s) selected.`, {
    sections: outline.sections.map((section) => section.id),
  });

  const renderManifest = buildBookletRenderManifest(requirementSubjects);
  const intendedRenderedPaths = renderedPathsFromManifest(renderManifest);
  const safeBookletReports = evaluateRequirementSubjects(
    requirementSubjects,
    "safe_booklet",
    intendedRenderedPaths,
  );
  benefitsPackage.requirements.safeBookletReports = safeBookletReports;
  benefitsPackage.requirements.renderedPathsBySubject = intendedRenderedPaths;
  benefitsPackage.requirements.renderManifest = renderManifest;
  if (registryEnforcementActive) {
    const safeQuestions = buildRequirementQuestions({
      subjects: requirementSubjects,
      reports: safeBookletReports,
    });
    if (safeQuestions.length)
      return {
        status: "blocked",
        classifications,
        questions: safeQuestions,
        benefitsPackage,
        outline,
        renderManifest,
        facts,
      };
    if (
      safeBookletReports.some(
        (report) =>
          requirementSubjects.find((subject) => subject.id === report.subjectId)
            ?.enforcementStatus === "registry_enforced" && !report.passed,
      )
    )
      throw new Error("The safe-booklet requirements gate failed.");
  }

  await emit("Writing booklet content", "started", "Writing concise employee-facing content from the normalized package.");
  let content: BookletContentResult | undefined;
  try {
    if (dependencies.writeContent) {
      content = await dependencies.writeContent({
        benefitsPackage,
        outline,
        renderManifest,
      });
    } else if (process.env.OPENAI_API_KEY) {
      content = await generateBookletContent(
        benefitsPackage,
        outline,
        "employee-friendly standard",
        {
          apiKey: process.env.OPENAI_API_KEY,
          ...(registryEnforcementActive ? { renderManifest } : {}),
        },
      );
    }
  } catch (error) {
    if (registryEnforcementActive)
      throw new Error(
        `Registry-grounded content generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    await emit(
      "Writing booklet content",
      "warning",
      "The grounded content agent could not complete; deterministic source-backed rendering will continue.",
      { error: error instanceof Error ? error.message : String(error) },
    );
  }
  if (registryEnforcementActive && !content)
    throw new Error(
      "Registry-enforced generation requires a manifest-aware content writer; the legacy deterministic fallback is not allowed to bypass the registry.",
    );
  if (registryEnforcementActive && content) {
    const allowedGroundedPaths = new Set(
      renderManifest.sections.flatMap((section) =>
        section.fields.map(
          (field) => `requirements.${field.subjectId}.${field.path}`,
        ),
      ),
    );
    const unsupportedPath = content.sections
      .flatMap((section) => section.sourcePaths)
      .find(
        (path) => path.startsWith("requirements.") && !allowedGroundedPaths.has(path),
      );
    if (unsupportedPath)
      throw new Error(`Content cited a path outside the safe render manifest: ${unsupportedPath}`);
    const benefitSectionIds = new Set([
      "medical", "dental", "vision", "life", "std", "ltd", "eap",
      "voluntary", "telemedicine", "hsa", "hra", "fsa",
    ]);
    const unscopedBenefitPath = content.sections
      .filter(
        (section) =>
          benefitSectionIds.has(section.id) && section.status === "ready",
      )
      .flatMap((section) => section.sourcePaths)
      .find((path) => !path.startsWith("requirements."));
    if (unscopedBenefitPath)
      throw new Error(
        `Registry-grounded benefit copy cited a legacy package path: ${unscopedBenefitPath}`,
      );
    benefitsPackage.requirements.claims = content.claims || [];
    const benefitCopyExists = content.sections.some(
      (section) =>
        benefitSectionIds.has(section.id) &&
        section.status === "ready" &&
        Boolean(section.copy),
    );
    if (benefitCopyExists && !content.claims?.length)
      throw new Error("Registry-grounded benefit copy did not return a claim ledger.");
  }
  if (registryEnforcementActive) {
    const actualRenderedPaths = Object.fromEntries(
      Object.entries(intendedRenderedPaths).map(([subjectId, paths]) => [
        subjectId,
        [...paths],
      ]),
    );
    for (const claim of content?.claims || [])
      actualRenderedPaths[claim.subjectId] = [
        ...new Set([
          ...(actualRenderedPaths[claim.subjectId] || []),
          ...claim.sourcePaths,
        ]),
      ];
    const finalSafeBookletReports = evaluateRequirementSubjects(
      requirementSubjects,
      "safe_booklet",
      actualRenderedPaths,
    );
    benefitsPackage.requirements.safeBookletReports = finalSafeBookletReports;
    benefitsPackage.requirements.renderedPathsBySubject = actualRenderedPaths;
    if (finalSafeBookletReports.some((report) => !report.passed))
      throw new Error("Content failed the final safe-booklet requirements gate.");
  }
  const html = renderBenefitsPackageHtml(benefitsPackage, outline, content);
  await emit(
    "Writing booklet content",
    "complete",
    content
      ? `${content.sections.filter((section) => section.status === "ready").length} grounded dynamic section(s) are ready.`
      : "Booklet HTML is ready.",
  );

  await emit("Running quality checks", "started", "Checking sources, sections, costs, and placeholders before rendering.");
  const preflight = await checkBookletQuality({
    benefitsPackage,
    outline,
    html,
    requirements: benefitsPackage.requirements,
    requireRegistryEnforcement: registryEnforcementActive,
  });
  if (!preflight.passed) {
    const message = preflight.issues.filter((issue) => issue.blocking).map((issue) => issue.message).join(" ");
    await emit("Running quality checks", "warning", message, { issues: preflight.issues });
    throw new Error(`Booklet preflight failed: ${message}`);
  }
  await emit("Running quality checks", "complete", "Pre-render quality checks passed.");

  await emit("Rendering PDF", "started", "Rendering the final PDF.");
  const pdf = await (dependencies.renderPdf || generateBenefitsPackagePdf)(
    benefitsPackage,
    outline,
    content,
  );
  await emit("Rendering PDF", "complete", `Rendered ${pdf.length} PDF bytes.`);

  await emit("Running quality checks", "started", "Validating the rendered PDF.");
  const qualityReport = await checkBookletQuality({
    benefitsPackage,
    outline,
    html,
    pdf,
    requirements: benefitsPackage.requirements,
    requireRegistryEnforcement: registryEnforcementActive,
  });
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
    renderManifest,
    facts,
  };
}

export function createGenerationRun({
  id = randomUUID(),
  threadId,
  companyId,
  uploadedFileIds,
}: {
  id?: string;
  threadId: string;
  companyId: string;
  uploadedFileIds: string[];
}): BookletGenerationRun {
  return {
    id,
    threadId,
    companyId,
    status: "queued",
    uploadedFileIds,
    stages: [],
    questions: [],
    answers: {},
    snapshotSchemaVersion: 2,
    createdAt: new Date().toISOString(),
  };
}
