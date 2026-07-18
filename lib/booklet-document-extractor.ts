import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type {
  BenefitType,
  ClassifiedDocument,
  ContributionMode,
  LoadedUploadedFile,
  SourceRef,
} from "./booklet-types";
import {
  BENEFIT_REQUIREMENTS_REGISTRY,
  collectPredicateDependencies,
} from "./benefit-requirements";
import {
  BenefitTypeSchema,
  RequirementCandidateOutputSchema,
  validateRequirementCandidateOutput,
  type RequirementCandidateOutput,
} from "./benefit-requirements/extraction-contracts";
import type {
  ExtractedRequirementCandidate,
  RequirementEvidence,
} from "./benefit-requirements/types";

const EvidenceTextSchema = z.object({
  value: z.string(),
  page: z.number().int().positive().nullable(),
  quote: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

const OptionalEvidenceTextSchema = EvidenceTextSchema.nullable();

export const BookletDocumentExtractionSchema = z.object({
  employer: z.object({
    name: OptionalEvidenceTextSchema,
    legalName: OptionalEvidenceTextSchema,
    address: OptionalEvidenceTextSchema,
    website: OptionalEvidenceTextSchema,
  }),
  planYear: z.object({
    start: OptionalEvidenceTextSchema,
    end: OptionalEvidenceTextSchema,
    label: OptionalEvidenceTextSchema,
  }),
  eligibility: z.object({
    waitingPeriod: OptionalEvidenceTextSchema,
    description: OptionalEvidenceTextSchema,
    employeeClasses: z.array(EvidenceTextSchema),
  }),
  offeredBenefits: z.array(
    z.object({
      benefitType: BenefitTypeSchema,
      offered: z.boolean(),
      page: z.number().int().positive().nullable(),
      quote: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  selectedPlans: z.array(
    z.object({
      planName: z.string(),
      benefitType: z.enum(["medical", "dental", "vision", "life", "std", "ltd"]),
      carrier: z.string().nullable(),
      page: z.number().int().positive().nullable(),
      quote: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  contributions: z.array(
    z.object({
      benefitType: z.enum([
        "medical",
        "dental",
        "vision",
        "life",
        "std",
        "ltd",
        "hsa",
        "hra",
        "fsa",
      ]),
      planName: z.string().nullable(),
      tier: z.string(),
      employeeClass: z.string().nullable(),
      mode: z.enum(["percent", "flat_monthly", "flat_per_pay"]),
      value: z.number(),
      payPeriods: z.number().int().positive().nullable(),
      page: z.number().int().positive().nullable(),
      quote: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  contacts: z.array(
    z.object({
      role: z.string(),
      name: z.string().nullable(),
      organization: z.string().nullable(),
      phone: z.string().nullable(),
      email: z.string().nullable(),
      website: z.string().nullable(),
      page: z.number().int().positive().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  accounts: z.array(
    z.object({
      type: z.enum(["hsa", "hra", "fsa"]),
      administrator: z.string().nullable(),
      page: z.number().int().positive().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  sectionOrder: z.array(z.string()),
  templateRole: z.enum(["employer_factual", "employer_prior_context", "master_template", "none"]),
  extractionMethod: z.enum(["pdf_text", "ocr", "model", "email_text"]),
  warnings: z.array(z.string()),
  requirementCandidates: z.array(RequirementCandidateOutputSchema),
});

type ParsedBookletDocumentExtraction = z.infer<typeof BookletDocumentExtractionSchema>;
export type BookletDocumentExtraction = Omit<
  ParsedBookletDocumentExtraction,
  "requirementCandidates"
> & {
  fileId: string;
  fileName: string;
  documentType: ClassifiedDocument["documentType"];
  /** Optional only for legacy fixtures/snapshots created before registry wiring. */
  requirementCandidates?: ExtractedRequirementCandidate[];
};

const SYSTEM_PROMPT = `You extract source-backed facts for an employee benefits booklet.
Use only the supplied document. Never infer checked boxes, filled values, employer identity,
contributions, benefit offerings, or selected plans from blank form labels. A blank application
is a template, not factual evidence. Keep current employer facts separate from master-template
or prior-employer facts. Return concise quotes and exact source page numbers. If the PDF is
image-only, visually read it and set extractionMethod to ocr. Record uncertainty in warnings.

For requirementCandidates, emit candidate facts rather than final truth. Use only allowed registry
paths supplied in the task. Keep every plan/program separate. Preserve network, tier, frequency,
member category, unit, period, and product-subtype qualifiers. Use valueJson for nested schedules.
A blank or silent source is not explicit_none: use not_found. Use explicit_none or not_applicable
only for an explicit source statement and an allowed reason code. Never make a legal determination.
Every known material candidate needs a page and short supporting quote.`;

function registryContract(classification: ClassifiedDocument) {
  const benefitTypes = classification.benefitTypes || [];
  const dependencies = collectPredicateDependencies();
  return benefitTypes.map((benefitType) => {
    const definition = BENEFIT_REQUIREMENTS_REGISTRY[benefitType];
    return {
      benefitType,
      entityKind: definition.entityKind,
      fields: definition.fields.map((field) => ({
        id: field.id,
        path: field.path,
        label: field.label,
        description: field.description,
        acceptedNotApplicableReasons: field.acceptedNotApplicableReasons || [],
        acceptedExplicitNoneReasons: field.acceptedExplicitNoneReasons || [],
      })),
      conditionalDependencies: dependencies[benefitType],
    };
  });
}

function focusedAccountBenefit(
  file: LoadedUploadedFile,
  classification: ClassifiedDocument,
): "hsa" | "hra" | "fsa" | undefined {
  const context = `${file.fileName} ${classification.documentSubtype || ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  if (!/\b(?:form|agreement|election|contribution|reimbursement|claim)\b/.test(context))
    return undefined;
  if (/\b(?:hsa|health savings account)\b/.test(context)) return "hsa";
  if (/\b(?:hra|health reimbursement)\b/.test(context)) return "hra";
  if (/\b(?:fsa|flexible spending)\b/.test(context)) return "fsa";
  return undefined;
}

function benefitAllowedForDocument(
  benefitType: BenefitType,
  file: LoadedUploadedFile,
  classification: ClassifiedDocument,
) {
  const focusedAccount = focusedAccountBenefit(file, classification);
  if (focusedAccount && benefitType !== focusedAccount) return false;
  return (
    classification.benefitTypes === undefined ||
    classification.benefitTypes.includes(benefitType)
  );
}

function promptFor(classification: ClassifiedDocument) {
  const role = {
    employer_application:
      "Extract filled employer setup, eligibility, selected products, contribution rules, accounts, and contacts. Ignore empty form fields and unchecked options.",
    prior_booklet:
      "Extract employer-specific prior context, offered sections, eligibility language, plan names, contacts, and section order. Treat year-specific facts as prior unless clearly current.",
    benefit_guide:
      "Determine whether this is an employer-specific current guide or a master template. Extract section order and style role. Do not copy one employer's facts to another.",
    email_export:
      "Extract explicit employer instructions, plan selections, contribution decisions, dates, eligibility, and contacts from the email body and quoted thread.",
    plan_summary:
      "Extract plan identity, carrier, plan year, benefit type, and any explicit employer setup or contribution facts.",
  }[classification.documentType];
  return `${role || "Extract booklet-relevant employer and benefit facts."}
Classification context: ${JSON.stringify({
    documentType: classification.documentType,
    documentSubtype: classification.documentSubtype || "legacy_unknown",
    benefitTypes: classification.benefitTypes || [],
    scope: classification.scope || "unknown",
    authority: classification.authority || "unknown",
    employerOrGroupId: classification.employerOrGroupId || null,
    planOrProgramIds: classification.planOrProgramIds || [],
    effectiveStart: classification.effectiveStart || null,
    effectiveEnd: classification.effectiveEnd || null,
  })}
Applicable canonical registry contract: ${JSON.stringify(registryContract(classification))}`;
}

function authorityDomain(path: string): RequirementEvidence["authorityDomain"] {
  if (/offering|selectedByEmployer/i.test(path)) return "offering";
  if (/identity|administrator|custodian/i.test(path)) return "identity";
  if (/eligib|employeeClass|workStates/i.test(path)) return "eligibility";
  if (/rate|cost|funding|contribution|payroll/i.test(path)) return "rate";
  if (/contact|access|portal|website|phone/i.test(path)) return "contact";
  if (/formal|legal|notice|regulatory|governing/i.test(path))
    return "legal_or_regulatory";
  return "plan_design";
}

function parsedValue(candidate: RequirementCandidateOutput) {
  if (candidate.valueJson) {
    try {
      return JSON.parse(candidate.valueJson);
    } catch {
      return candidate.valueJson;
    }
  }
  return candidate.value === null ? undefined : candidate.value;
}

function requirementCandidates(
  parsed: ParsedBookletDocumentExtraction,
  file: LoadedUploadedFile,
  classification: ClassifiedDocument,
): { candidates: ExtractedRequirementCandidate[]; warnings: string[] } {
  const extractionMethod: RequirementEvidence["extractionMethod"] =
    parsed.extractionMethod === "ocr" ? "ocr" : "text";
  const warnings: string[] = [];
  const accepted = parsed.requirementCandidates.flatMap((candidate, index) => {
    if (!benefitAllowedForDocument(candidate.benefitType, file, classification)) {
      warnings.push(
        `Rejected requirement candidate ${candidate.path}: ${candidate.benefitType} is outside this document's classified benefit focus.`,
      );
      return [];
    }
    const validation = validateRequirementCandidateOutput(candidate);
    if (!validation.success) {
      warnings.push(
        `Rejected requirement candidate ${candidate.path}: ${validation.error.issues
          .map((issue) => issue.message)
          .join(" ")}`,
      );
      return [];
    }
    const textStart =
      file.textContent && candidate.quote
        ? Math.max(0, file.textContent.indexOf(candidate.quote))
        : 0;
    const locator = candidate.page
      ? {
          kind: "pdf" as const,
          page: candidate.page,
          quote: candidate.quote || undefined,
        }
      : file.textContent && candidate.quote
        ? {
            kind: "text" as const,
            start: textStart,
            end: textStart + candidate.quote.length,
            quote: candidate.quote,
          }
        : undefined;
    return [{
    subjectHint: {
      benefitType: candidate.benefitType,
      ...(candidate.planOrProgramName
        ? { planOrProgramName: candidate.planOrProgramName }
        : {}),
      ...(candidate.planOrProgramId
        ? { planOrProgramId: candidate.planOrProgramId }
        : {}),
    },
    path: candidate.path,
    state: candidate.state,
    ...(candidate.state === "known" ? { value: parsedValue(candidate) } : {}),
    ...(candidate.rawValue ? { rawValue: candidate.rawValue } : {}),
    ...(candidate.reasonCode ? { reasonCode: candidate.reasonCode } : {}),
    evidence: {
      id: `${file.id}:requirement:${index}`,
      sourceFileId: file.id,
      sourceFileName: file.fileName,
      authority: classification.authority || "unknown",
      authorityDomain: authorityDomain(candidate.path),
      ...(classification.effectiveStart
        ? { effectiveStart: classification.effectiveStart }
        : {}),
      ...(classification.effectiveEnd
        ? { effectiveEnd: classification.effectiveEnd }
        : {}),
      ...(classification.employerOrGroupId
        ? { employerOrGroupId: classification.employerOrGroupId }
        : {}),
      ...(candidate.planOrProgramId
        ? { planOrProgramId: candidate.planOrProgramId }
        : {}),
      ...(locator ? { locator } : {}),
      extractionMethod,
      extractorVersion: "benefit-requirements-v1",
      confidence: candidate.confidence,
    },
    confidence: candidate.confidence,
    }];
  });
  return { candidates: accepted, warnings };
}

function fileContent(file: LoadedUploadedFile) {
  if (file.textContent)
    return [
      {
        type: "input_text" as const,
        text: `BEGIN SOURCE DOCUMENT: ${file.fileName}\n${file.textContent}\nEND SOURCE DOCUMENT: ${file.fileName}`,
      },
    ];
  return [
    {
      type: "input_file" as const,
      filename: file.fileName,
      file_data: `data:${file.mimeType || "application/pdf"};base64,${file.data.toString("base64")}`,
    },
  ];
}

export async function extractBookletDocument({
  file,
  classification,
  apiKey = process.env.OPENAI_API_KEY,
  client = new OpenAI({ apiKey }),
  model = process.env.OPENAI_BOOKLET_MODEL || "gpt-5.4-mini",
}: {
  file: LoadedUploadedFile;
  classification: ClassifiedDocument;
  apiKey?: string;
  client?: Pick<OpenAI, "responses">;
  model?: string;
}): Promise<BookletDocumentExtraction> {
  if (!file.data.length && !file.textContent) throw new Error(`${file.fileName} is empty`);
  const response = await client.responses.parse({
    model,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          ...fileContent(file),
          { type: "input_text", text: promptFor(classification) },
        ],
      },
    ],
    text: {
      format: zodTextFormat(BookletDocumentExtractionSchema, "booklet_document_extraction"),
    },
  });
  if (!response.output_parsed)
    throw new Error(`OpenAI returned no parsed extraction for ${file.fileName}`);
  const parsed = BookletDocumentExtractionSchema.parse({
    ...response.output_parsed,
    requirementCandidates:
      (response.output_parsed as { requirementCandidates?: unknown })
        .requirementCandidates || [],
  });
  const validatedCandidates = requirementCandidates(parsed, file, classification);
  const allowed = (benefitType: BenefitType) =>
    benefitAllowedForDocument(benefitType, file, classification);
  const offeredBenefits = parsed.offeredBenefits.filter((item) =>
    allowed(item.benefitType),
  );
  const selectedPlans = parsed.selectedPlans.filter((item) =>
    allowed(item.benefitType),
  );
  const contributions = parsed.contributions.filter((item) =>
    allowed(item.benefitType),
  );
  const accounts = parsed.accounts.filter((item) => allowed(item.type));
  const rejectedLegacyFacts =
    parsed.offeredBenefits.length - offeredBenefits.length +
    parsed.selectedPlans.length - selectedPlans.length +
    parsed.contributions.length - contributions.length +
    parsed.accounts.length - accounts.length;
  return {
    ...parsed,
    offeredBenefits,
    selectedPlans,
    contributions,
    accounts,
    warnings: [
      ...parsed.warnings,
      ...validatedCandidates.warnings,
      ...(rejectedLegacyFacts
        ? [
            `Rejected ${rejectedLegacyFacts} legacy summary fact(s) outside this document's classified benefit focus.`,
          ]
        : []),
    ],
    fileId: file.id,
    fileName: file.fileName,
    documentType: classification.documentType,
    requirementCandidates: validatedCandidates.candidates,
  };
}

export function extractionSource(
  extraction: BookletDocumentExtraction,
  page: number | null,
  quote?: string | null,
): SourceRef {
  return {
    fileId: extraction.fileId,
    fileName: extraction.fileName,
    documentType: extraction.documentType,
    page: page || undefined,
    textRange: quote || undefined,
    extractionMethod:
      extraction.extractionMethod === "email_text"
        ? "model"
        : extraction.extractionMethod,
  };
}

export function normalizeContributionMode(value: string): ContributionMode {
  if (value === "flat_per_pay") return "flat_per_pay";
  if (value === "flat_monthly") return "flat_monthly";
  return "percent";
}

export function normalizeBenefitType(value: string): BenefitType {
  return value.toLowerCase() as BenefitType;
}
