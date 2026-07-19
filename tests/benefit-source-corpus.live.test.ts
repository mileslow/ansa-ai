import { createHash } from "node:crypto";
import path from "node:path";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import {
  BENEFIT_REQUIREMENTS_REGISTRY,
  type ExtractedRequirementCandidate,
} from "../lib/benefit-requirements";
import {
  extractBookletDocument,
  type BookletDocumentExtraction,
} from "../lib/booklet-document-extractor";
import type {
  BenefitType,
  ClassifiedDocument,
  LoadedUploadedFile,
} from "../lib/booklet-types";
import { classifyDocumentWithFallback } from "../lib/document-classifier";
import {
  dailyBenefitSourceSeed,
  discoverBenefitSourceDocuments,
  parseBenefitSourceCategories,
  sampleBenefitSourceDocuments,
  samplePdfPages,
  type BenefitSourceDocument,
  type SampledPdf,
} from "./helpers/benefit-source-corpus";

const live =
  process.env.RUN_LIVE_BENEFIT_SOURCE_SAMPLING_TESTS === "1" &&
  Boolean(process.env.OPENAI_API_KEY);

const IssueCodeSchema = z.enum([
  "wrong_benefit_family",
  "unsupported_fact",
  "missed_obvious_material_fact",
  "collapsed_options",
  "lost_qualifier",
  "incorrect_offering_inference",
  "incorrect_none_state",
  "wrong_document_role",
  "evidence_mismatch",
]);

const JudgeIssueSchema = z.object({
  severity: z.enum(["warning", "critical"]),
  code: IssueCodeSchema,
  path: z.string().nullable(),
  sampledPage: z.number().int().positive().nullable(),
  explanation: z.string(),
});

const BenefitSourceJudgeSchema = z.object({
  documentRoleSupported: z.boolean(),
  expectedBenefitFamilySupported: z.boolean(),
  multipleOptionsVisible: z.boolean(),
  multipleOptionsPreserved: z.boolean().nullable(),
  issues: z.array(JudgeIssueSchema),
  summary: z.string(),
});

type JudgeIssue = z.infer<typeof JudgeIssueSchema>;

type AuditFinding = {
  severity: "warning" | "critical";
  source: "contract" | "judge" | "runtime";
  code: string;
  path: string | null;
  explanation: string;
};

type AuditReport = {
  relativePath: string;
  sampledOriginalPages: number[];
  classification?: ClassifiedDocument;
  extractionOutline?: {
    employer: BookletDocumentExtraction["employer"];
    candidates: Array<ReturnType<typeof compactCandidate>>;
  };
  findings: AuditFinding[];
  judgeSummary?: string;
};

function positiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`Expected a positive integer, received ${value}`);
  return parsed;
}

function compactValue(value: unknown, limit = 700) {
  const serialized =
    typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
  return serialized.length > limit
    ? `${serialized.slice(0, limit)}…`
    : serialized;
}

function originalPage(sample: SampledPdf, sampledPage: number | undefined) {
  if (!sampledPage) return null;
  return sample.originalPageNumbers[sampledPage - 1] ?? null;
}

function compactCandidate(
  candidate: ExtractedRequirementCandidate,
  sample: SampledPdf,
) {
  const locator = candidate.evidence.locator;
  const sampledPage = locator?.kind === "pdf" ? locator.page : null;
  const quote = locator && "quote" in locator ? locator.quote : undefined;
  return {
    benefitType: candidate.subjectHint.benefitType,
    planOrProgramName: candidate.subjectHint.planOrProgramName || null,
    path: candidate.path,
    state: candidate.state,
    value:
      candidate.state === "known" ? compactValue(candidate.value) : null,
    rawValue: candidate.rawValue
      ? compactValue(candidate.rawValue, 400)
      : null,
    reasonCode: candidate.reasonCode || null,
    sampledPage,
    originalPage: originalPage(sample, sampledPage || undefined),
    quote: quote ? compactValue(quote, 400) : null,
    supportingEvidence: (candidate.supportingEvidence || []).map((evidence) => {
      const supportingLocator = evidence.locator;
      const supportingPage =
        supportingLocator?.kind === "pdf" ? supportingLocator.page : null;
      const supportingQuote =
        supportingLocator && "quote" in supportingLocator
          ? supportingLocator.quote
          : undefined;
      return {
        sampledPage: supportingPage,
        originalPage: originalPage(sample, supportingPage || undefined),
        quote: supportingQuote ? compactValue(supportingQuote, 400) : null,
      };
    }),
    authority: candidate.evidence.authority,
    confidence: candidate.confidence,
  };
}

function extractionSummary(
  extraction: BookletDocumentExtraction,
  sample: SampledPdf,
) {
  return {
    employer: extraction.employer,
    planYear: extraction.planYear,
    eligibility: extraction.eligibility,
    offeredBenefits: extraction.offeredBenefits,
    selectedPlans: extraction.selectedPlans,
    contributions: extraction.contributions,
    contacts: extraction.contacts,
    accounts: extraction.accounts,
    warnings: extraction.warnings,
    documentPlanOptions: extraction.documentPlanOptions || [],
    requirementCandidates: (extraction.requirementCandidates || [])
      .slice(0, 160)
      .map((candidate) => compactCandidate(candidate, sample)),
  };
}

function addFinding(
  findings: AuditFinding[],
  severity: AuditFinding["severity"],
  source: AuditFinding["source"],
  code: string,
  explanation: string,
  path: string | null = null,
) {
  findings.push({ severity, source, code, path, explanation });
}

function expectedTypesPresent(
  document: BenefitSourceDocument,
  actual: BenefitType[],
) {
  return document.expectedMatch === "all"
    ? document.expectedBenefitTypes.every((benefitType) =>
        actual.includes(benefitType),
      )
    : document.expectedBenefitTypes.some((benefitType) =>
        actual.includes(benefitType),
      );
}

function focusedAccountDocument(document: BenefitSourceDocument) {
  if (!["hsa", "hra", "fsa"].includes(document.category)) return false;
  return /(?:form|agreement|election|contribution|reimbursement|claim)/i.test(
    `${document.offering}/${document.optionOrDocument}`,
  );
}

function contractFindings(
  document: BenefitSourceDocument,
  classification: ClassifiedDocument,
  extraction: BookletDocumentExtraction,
) {
  const findings: AuditFinding[] = [];
  const benefitTypes = classification.benefitTypes || [];
  if (classification.documentType === "unknown")
    addFinding(
      findings,
      classification.scope === "regulatory" &&
        classification.authority === "regulatory_source"
        ? "warning"
        : "critical",
      "contract",
      "unknown_document_role",
      classification.scope === "regulatory"
        ? "The regulatory source has no more specific documentType enum value."
        : "The source remained classified as an unknown document role.",
    );
  if (!expectedTypesPresent(document, benefitTypes))
    addFinding(
      findings,
      "critical",
      "contract",
      "missing_expected_benefit_family",
      `Expected ${document.expectedMatch} of [${document.expectedBenefitTypes.join(", ")}], classified [${benefitTypes.join(", ")}].`,
    );

  for (const warning of extraction.warnings) {
    if (/^Rejected (?:requirement candidate|\d+ legacy summary fact)/.test(warning))
      addFinding(
        findings,
        "warning",
        "contract",
        "safety_filter_rejected_output",
        warning,
      );
  }

  const candidates = extraction.requirementCandidates || [];
  for (const candidate of candidates) {
    if (!benefitTypes.includes(candidate.subjectHint.benefitType))
      addFinding(
        findings,
        "critical",
        "contract",
        "benefit_focus_leak",
        `${candidate.subjectHint.benefitType} candidate escaped a [${benefitTypes.join(", ")}] classification.`,
        candidate.path,
      );
    const requirement = BENEFIT_REQUIREMENTS_REGISTRY[
      candidate.subjectHint.benefitType
    ].fields.find((field) => field.path === candidate.path);
    if (
      candidate.state === "known" &&
      requirement?.material &&
      requirement.evidenceRequired
    ) {
      const locator = candidate.evidence.locator;
      const quote = locator && "quote" in locator ? locator.quote : undefined;
      if (locator?.kind !== "pdf" || !quote?.trim())
        addFinding(
          findings,
          "critical",
          "contract",
          "material_evidence_missing",
          "A known material registry fact does not have both a PDF page and supporting quote.",
          candidate.path,
        );
    }
  }

  if (classification.authority === "current_plan_document") {
    for (const offered of extraction.offeredBenefits.filter((item) => item.offered))
      addFinding(
        findings,
        "critical",
        "contract",
        "plan_document_claimed_employer_offering",
        `A plan-design document was treated as proof that the employer offers ${offered.benefitType}.`,
        `offeredBenefits.${offered.benefitType}`,
      );
    for (const selected of extraction.selectedPlans)
      addFinding(
        findings,
        "critical",
        "contract",
        "plan_document_claimed_employer_selection",
        `A plan-design document was treated as proof that the employer selected ${selected.planName}.`,
        `selectedPlans.${selected.benefitType}`,
      );
    for (const candidate of candidates.filter((item) =>
      item.state !== "not_found" &&
      /offering|selectedByEmployer/i.test(item.path),
    ))
      addFinding(
        findings,
        "critical",
        "contract",
        "plan_document_claimed_employer_selection",
        "A current plan document emitted an employer-offering candidate.",
        candidate.path,
      );
  }

  if (focusedAccountDocument(document)) {
    const medicalCandidates = candidates.filter(
      (candidate) => candidate.subjectHint.benefitType === "medical",
    );
    const medicalPlans = extraction.selectedPlans.filter(
      (plan) => plan.benefitType === "medical",
    );
    if (medicalCandidates.length || medicalPlans.length)
      addFinding(
        findings,
        "critical",
        "contract",
        "account_form_created_medical_subject",
        "An account form created a medical plan subject from compatibility language.",
      );
  }

  const expectedCandidateCount = candidates.filter((candidate) =>
    document.expectedBenefitTypes.includes(candidate.subjectHint.benefitType),
  ).length;
  if (
    expectedCandidateCount === 0 &&
    extraction.accounts.length === 0 &&
    extraction.selectedPlans.length === 0
  )
    addFinding(
      findings,
      "warning",
      "contract",
      "no_structured_expected_output",
      "The sampled pages produced no registry candidate, account, or plan for the expected benefit family.",
    );
  return findings;
}

async function judgeExtraction({
  client,
  model,
  document,
  file,
  sample,
  classification,
  extraction,
}: {
  client: OpenAI;
  model: string;
  document: BenefitSourceDocument;
  file: LoadedUploadedFile;
  sample: SampledPdf;
  classification: ClassifiedDocument;
  extraction: BookletDocumentExtraction;
}) {
  const pageMap = sample.originalPageNumbers
    .map(
      (originalPage, index) =>
        `sampled PDF page ${index + 1} = original PDF page ${originalPage}`,
    )
    .join("; ");
  const response = await client.responses.parse({
    model,
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content: `You audit structured extraction from employee-benefit source documents.
Compare the supplied sampled PDF pages with the classification and extraction JSON. Use only
visible evidence. Do not penalize an extractor for content on unsampled pages or for harmless
wording differences. A plan document proves plan design, not that a particular employer offers
or selected the plan. HSA-compatible or HSA-qualified medical coverage does not prove an employer
offers an HSA account. Pediatric dental/vision inside a medical plan is not standalone coverage.
For plan documents, certificates, SBCs, and carrier brochures, empty offeredBenefits,
selectedPlans, and contributions are intentional safety behavior and are not omissions. Judge their
plan identities, variants, design terms, and explicitly stated costs in requirementCandidates.
Enrollment tiers such as Self Only, Self Plus One, and Family are not separate plan options.
documentType is intentionally a coarse enum: plan_summary is an acceptable container for an
insurance certificate when documentSubtype accurately says certificate. Do not flag that mapping.

Report a critical issue for any unsupported material fact, wrong benefit family or document role,
employer-offering inference, contradicted none/not-applicable state, collapsed visibly distinct
options, material evidence mismatch, or loss of a material tier/network/frequency/unit qualifier.
Also report a critical missed_obvious_material_fact when a clearly visible identity, deductible,
out-of-pocket maximum, benefit amount, waiting/elimination period, duration, frequency, or material
service cost is omitted. Use warning only for a real but non-material issue. Do not manufacture an
issue merely to populate the list. Evidence page numbers in the extraction refer to sampled PDF
pages, and the task supplies their original-page mapping.`,
      },
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename: file.fileName,
            file_data: `data:application/pdf;base64,${file.data.toString("base64")}`,
          },
          {
            type: "input_text",
            text: `Corpus path: ${document.relativePath}
Expected benefit family (${document.expectedMatch}): ${document.expectedBenefitTypes.join(", ")}
Page mapping: ${pageMap}
Classification JSON: ${JSON.stringify(classification)}
Extraction JSON: ${JSON.stringify(extractionSummary(extraction, sample))}`,
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(
        BenefitSourceJudgeSchema,
        "benefit_source_extraction_audit",
      ),
    },
  });
  if (!response.output_parsed)
    throw new Error(`Judge returned no parsed result for ${document.relativePath}`);
  return response.output_parsed;
}

function loadedFile(document: BenefitSourceDocument, sample: SampledPdf, seed: string) {
  const id = createHash("sha1")
    .update(`${seed}\0${document.relativePath}`)
    .digest("hex")
    .slice(0, 20);
  return {
    id,
    companyId: "benefit-source-ai-audit",
    fileName: path.basename(document.absolutePath),
    storagePath: document.relativePath,
    mimeType: "application/pdf",
    uploadedAt: new Date().toISOString(),
    sha256: createHash("sha256").update(sample.data).digest("hex"),
    processingStatus: "uploaded" as const,
    data: sample.data,
  } satisfies LoadedUploadedFile;
}

function candidateText(candidate: ExtractedRequirementCandidate) {
  return [
    candidate.state === "known" ? JSON.stringify(candidate.value) : "",
    candidate.rawValue || "",
  ].join(" ");
}

function candidateEvidencePages(candidate: ExtractedRequirementCandidate) {
  return [candidate.evidence, ...(candidate.supportingEvidence || [])]
    .map((evidence) =>
      evidence.locator?.kind === "pdf" ? evidence.locator.page : null,
    )
    .filter((page): page is number => page !== null);
}

function normalizedPlanName(value: string | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

describe.skipIf(!live)("paid pinned benefit-source regressions", () => {
  it(
    "preserves the MetLife FEDVIP High and Standard dental options",
    async () => {
      const seed = "metlife-fedvip-dental-options-v1";
      const relativePath =
        "dental/metlife-fedvip-2026/high-and-standard-options/official-plan-brochure.pdf";
      const documents = await discoverBenefitSourceDocuments();
      const document = documents.find(
        (candidate) => candidate.relativePath === relativePath,
      );
      expect(document, `Missing pinned corpus document ${relativePath}`).toBeDefined();
      const sample = await samplePdfPages(document!, { seed, maxPages: 3 });
      expect(sample.originalPageNumbers[0]).toBe(1);
      const file = loadedFile(document!, sample, seed);
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const model =
        process.env.OPENAI_BOOKLET_MODEL || "gpt-5.4-mini";
      const classification = await classifyDocumentWithFallback({
        file,
        client,
        model,
      });
      const extraction = await extractBookletDocument({
        file,
        classification,
        client,
        model,
      });

      const normalized = (value: string | undefined) =>
        (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const options = (extraction.documentPlanOptions || []).filter(
        (option) => option.benefitType === "dental",
      );
      expect(options).toHaveLength(2);
      expect(options.map((option) => normalized(option.planOrProgramName))).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/metlife.*dental.*high option/),
          expect.stringMatching(/metlife.*dental.*standard option/),
        ]),
      );
      for (const option of options) {
        expect(option.enrollmentTypes.map(normalized)).toEqual(
          expect.arrayContaining([
            "self only",
            "self plus one",
            "self and family",
          ]),
        );
        expect(option.page).toBe(1);
        expect(option.quote).toMatch(/High Option|Standard Option/);
      }

      const identities = (extraction.requirementCandidates || []).filter(
        (candidate) =>
          candidate.subjectHint.benefitType === "dental" &&
          candidate.path === "plans.dental.identity.planName" &&
          candidate.state === "known",
      );
      expect(identities).toHaveLength(2);
      expect(
        identities.map((candidate) =>
          normalized(candidate.subjectHint.planOrProgramName),
        ),
      ).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/metlife.*dental.*high option/),
          expect.stringMatching(/metlife.*dental.*standard option/),
        ]),
      );
      expect(
        identities.every((candidate) => {
          const locator = candidate.evidence.locator;
          return (
            locator?.kind === "pdf" &&
            locator.page === 1 &&
            Boolean(locator.quote?.trim())
          );
        }),
      ).toBe(true);
    },
    300_000,
  );

  it(
    "preserves the CalHR Premier conditional copay without inventing a zero premium",
    async () => {
      const seed = "calhr-repro-17";
      const relativePath =
        "vision/calhr-vsp-2026/basic-and-premier-options/evidence-of-coverage.pdf";
      const documents = await discoverBenefitSourceDocuments();
      const document = documents.find(
        (candidate) => candidate.relativePath === relativePath,
      );
      expect(document, `Missing pinned corpus document ${relativePath}`).toBeDefined();
      const sample = await samplePdfPages(document!, { seed, maxPages: 3 });
      expect(sample.originalPageNumbers).toEqual([1, 6, 15]);
      const file = loadedFile(document!, sample, seed);
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const model = process.env.OPENAI_BOOKLET_MODEL || "gpt-5.4-mini";
      const classification = await classifyDocumentWithFallback({
        file,
        client,
        model,
      });
      const extraction = await extractBookletDocument({
        file,
        classification,
        client,
        model,
      });
      const candidates = extraction.requirementCandidates || [];
      const options = (extraction.documentPlanOptions || []).filter(
        (option) => option.benefitType === "vision",
      );
      expect(options).toHaveLength(2);
      expect(options.map((option) => normalizedPlanName(option.planOrProgramName))).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/basic/),
          expect.stringMatching(/premier/),
        ]),
      );

      const premierCopay = candidates.find(
        (candidate) =>
          candidate.state === "known" &&
          candidate.path === "plans.vision.materials.copay" &&
          /premier/.test(
            normalizedPlanName(candidate.subjectHint.planOrProgramName),
          ),
      );
      expect(premierCopay).toBeDefined();
      expect(candidateText(premierCopay!)).toMatch(/\$?35/);
      expect(candidateText(premierCopay!)).toMatch(/CCPOA Supervisors/i);
      expect(candidateText(premierCopay!)).toMatch(/second pair/i);
      expect(candidateEvidencePages(premierCopay!)).toContain(2);
      expect(
        [premierCopay!.evidence, ...(premierCopay!.supportingEvidence || [])].some(
          (evidence) =>
            evidence.locator?.kind === "pdf" &&
            evidence.locator.page === 2 &&
            /\$35|CCPOA Supervisors/i.test(evidence.locator.quote || ""),
        ),
      ).toBe(true);

      const examSchedule = candidates.find(
        (candidate) =>
          candidate.state === "known" &&
          candidate.path === "plans.vision.exam.schedule" &&
          /premier/.test(
            normalizedPlanName(candidate.subjectHint.planOrProgramName),
          ),
      );
      expect(examSchedule).toBeDefined();
      expect(candidateText(examSchedule!)).toMatch(/\$0/);
      expect(candidateText(examSchedule!)).toMatch(/Premier Edge/i);
      expect(candidateEvidencePages(examSchedule!)).toContain(2);

      const inventedZeroPremiums = candidates.filter((candidate) => {
        if (
          candidate.state !== "known" ||
          candidate.path !== "plans.vision.rates.employeeCost" ||
          !/premier/.test(
            normalizedPlanName(candidate.subjectHint.planOrProgramName),
          )
        )
          return false;
        return (
          candidate.value === 0 ||
          (typeof candidate.value === "string" &&
            /^(?:\$?0(?:\.00)?|zero|no employee (?:cost|premium))$/i.test(
              candidate.value.trim(),
            ))
        );
      });
      expect(inventedZeroPremiums).toHaveLength(0);
    },
    300_000,
  );

  it(
    "preserves every adult and child schedule in the Washington PEBB comparison",
    async () => {
      const seed = "washington-repro-6";
      const relativePath =
        "vision/washington-pebb-2026/all-options/benefits-comparison.pdf";
      const documents = await discoverBenefitSourceDocuments();
      const document = documents.find(
        (candidate) => candidate.relativePath === relativePath,
      );
      expect(document, `Missing pinned corpus document ${relativePath}`).toBeDefined();
      const sample = await samplePdfPages(document!, { seed, maxPages: 3 });
      expect(sample.originalPageNumbers).toEqual([1, 2, 3]);
      const file = loadedFile(document!, sample, seed);
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const model = process.env.OPENAI_BOOKLET_MODEL || "gpt-5.4-mini";
      const classification = await classifyDocumentWithFallback({
        file,
        client,
        model,
      });
      const extraction = await extractBookletDocument({
        file,
        classification,
        client,
        model,
      });
      const candidates = extraction.requirementCandidates || [];
      const optionNames = [
        "Davis Vision by MetLife",
        "EyeMed",
        "MetLife Vision",
      ];
      const options = (extraction.documentPlanOptions || []).filter(
        (option) => option.benefitType === "vision",
      );
      expect(options).toHaveLength(3);
      expect(options.map((option) => normalizedPlanName(option.planOrProgramName))).toEqual(
        expect.arrayContaining(optionNames.map(normalizedPlanName)),
      );

      const pathsAndPages: Array<[string, number[]]> = [
        ["plans.vision.exam.schedule", [1, 2]],
        ["plans.vision.frames.schedule", [1, 2]],
        ["plans.vision.lenses.standardSchedule", [1, 2]],
        ["plans.vision.lenses.enhancements", [1, 2]],
        ["plans.vision.contacts.electiveSchedule", [2, 3]],
        ["plans.vision.contacts.necessarySchedule", [2, 3]],
      ];
      for (const optionName of optionNames) {
        for (const [candidatePath, expectedPages] of pathsAndPages) {
          const matches = candidates.filter(
            (candidate) =>
              candidate.state === "known" &&
              candidate.path === candidatePath &&
              normalizedPlanName(candidate.subjectHint.planOrProgramName) ===
                normalizedPlanName(optionName),
          );
          expect(
            matches,
            `Expected one ${candidatePath} candidate for ${optionName}`,
          ).toHaveLength(1);
          expect(candidateText(matches[0])).toMatch(/adult/i);
          expect(candidateText(matches[0])).toMatch(/child/i);
          expect(candidateEvidencePages(matches[0])).toEqual(
            expect.arrayContaining(expectedPages),
          );
        }
      }

      const valuesAt = (candidatePath: string) =>
        candidates
          .filter(
            (candidate) =>
              candidate.state === "known" && candidate.path === candidatePath,
          )
          .map(candidateText)
          .join(" ");
      expect(valuesAt("plans.vision.exam.schedule")).toMatch(/\$40/);
      expect(valuesAt("plans.vision.exam.schedule")).toMatch(/\$84/);
      expect(valuesAt("plans.vision.exam.schedule")).toMatch(/\$90/);
      expect(valuesAt("plans.vision.exam.schedule")).toMatch(/\$45/);
      expect(valuesAt("plans.vision.frames.schedule")).toMatch(/\$200/);
      expect(valuesAt("plans.vision.lenses.standardSchedule")).toMatch(/trifocal/i);
      expect(valuesAt("plans.vision.lenses.standardSchedule")).toMatch(/progressive/i);
      expect(valuesAt("plans.vision.lenses.standardSchedule")).toMatch(/\$175/);
      expect(valuesAt("plans.vision.lenses.enhancements")).toMatch(
        /anti-reflective/i,
      );
      expect(valuesAt("plans.vision.contacts.electiveSchedule")).toMatch(/\$200/);
      expect(valuesAt("plans.vision.contacts.electiveSchedule")).toMatch(/\$300/);
      expect(valuesAt("plans.vision.contacts.electiveSchedule")).toMatch(/fit/i);
      expect(valuesAt("plans.vision.contacts.necessarySchedule")).toMatch(/\$225/);
      expect(valuesAt("plans.vision.contacts.necessarySchedule")).toMatch(/\$300/);
    },
    300_000,
  );
});

describe.skipIf(!live)("paid randomized benefit source extraction audit", () => {
  it(
    "finds unsafe or materially incomplete extraction across a seeded corpus sample",
    async () => {
      const seed =
        process.env.BENEFIT_SOURCE_SAMPLE_SEED || dailyBenefitSourceSeed();
      const categories = parseBenefitSourceCategories(
        process.env.BENEFIT_SOURCE_SAMPLE_CATEGORIES,
      );
      const size = process.env.BENEFIT_SOURCE_SAMPLE_SIZE
        ? positiveInteger(process.env.BENEFIT_SOURCE_SAMPLE_SIZE, 18)
        : undefined;
      const maxPages = positiveInteger(
        process.env.BENEFIT_SOURCE_SAMPLE_PAGES,
        3,
      );
      const documents = await discoverBenefitSourceDocuments();
      const selected = sampleBenefitSourceDocuments(documents, {
        seed,
        categories,
        size,
      });
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const model =
        process.env.OPENAI_BOOKLET_JUDGE_MODEL ||
        process.env.OPENAI_BOOKLET_MODEL ||
        "gpt-5.4-mini";
      const reports: AuditReport[] = [];

      console.info(
        `[benefit-source-audit] seed=${seed} documents=${selected.length} maxPages=${maxPages}`,
      );
      for (const document of selected) {
        const report: AuditReport = {
          relativePath: document.relativePath,
          sampledOriginalPages: [],
          findings: [],
        };
        try {
          const sample = await samplePdfPages(document, { seed, maxPages });
          report.sampledOriginalPages = sample.originalPageNumbers;
          const file = loadedFile(document, sample, seed);
          console.info(
            `[benefit-source-audit] ${document.relativePath} originalPages=${sample.originalPageNumbers.join(",")}/${sample.totalOriginalPages}`,
          );
          const classification = await classifyDocumentWithFallback({
            file,
            client,
            model,
          });
          report.classification = classification;
          const extraction = await extractBookletDocument({
            file,
            classification,
            client,
            model,
          });
          report.extractionOutline = {
            employer: extraction.employer,
            candidates: (extraction.requirementCandidates || [])
              .slice(0, 160)
              .map((candidate) => compactCandidate(candidate, sample)),
          };
          report.findings.push(
            ...contractFindings(document, classification, extraction),
          );
          const judge = await judgeExtraction({
            client,
            model,
            document,
            file,
            sample,
            classification,
            extraction,
          });
          report.judgeSummary = judge.summary;
          for (const issue of judge.issues as JudgeIssue[])
            addFinding(
              report.findings,
              issue.severity,
              "judge",
              issue.code,
              issue.explanation,
              issue.path,
            );
          if (!judge.documentRoleSupported)
            if (
              !report.findings.some(
                (finding) =>
                  finding.source === "judge" &&
                  finding.code === "wrong_document_role",
              )
            )
              addFinding(
                report.findings,
                "critical",
                "judge",
                "wrong_document_role",
                "The judge found that the classified document role is not supported by the sampled pages.",
              );
          if (!judge.expectedBenefitFamilySupported)
            addFinding(
              report.findings,
              "critical",
              "judge",
              "wrong_benefit_family",
              "The judge found that the expected corpus benefit family is not supported by the sampled pages.",
            );
          if (
            judge.multipleOptionsVisible &&
            judge.multipleOptionsPreserved === false &&
            !report.findings.some(
              (finding) =>
                finding.source === "judge" &&
                finding.code === "collapsed_options",
            )
          )
            addFinding(
              report.findings,
              "critical",
              "judge",
              "collapsed_options",
              "Multiple visibly distinct options were collapsed in structured output.",
            );
        } catch (error) {
          addFinding(
            report.findings,
            "critical",
            "runtime",
            "audit_runtime_failure",
            error instanceof Error ? error.message : String(error),
          );
        }
        reports.push(report);
      }

      const findings = reports.flatMap((report) =>
        report.findings.map((finding) => ({
          document: report.relativePath,
          originalPages: report.sampledOriginalPages,
          ...finding,
        })),
      );
      const warnings = findings.filter((finding) => finding.severity === "warning");
      const critical = findings.filter((finding) => finding.severity === "critical");
      if (warnings.length)
        console.warn(
          `[benefit-source-audit] warnings\n${JSON.stringify(warnings, null, 2)}`,
        );
      expect(
        critical,
        `Seed ${seed} found critical benefit-source extraction issues:\n${JSON.stringify(
          { critical, reports },
          null,
          2,
        )}`,
      ).toEqual([]);
    },
    1_800_000,
  );
});
