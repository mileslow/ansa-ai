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
  employerOfferingAuthorities,
} from "./benefit-requirements";
import {
  BenefitTypeSchema,
  RequirementCandidateOutputSchema,
  canonicalizeRequirementCandidatePath,
  validateRequirementCandidateOutput,
  type RequirementCandidateOutput,
} from "./benefit-requirements/extraction-contracts";
import type {
  ExtractedRequirementCandidate,
  RequirementEvidence,
} from "./benefit-requirements/types";
import {
  createPdfPageChunks,
  type PdfPageChunk,
} from "./pdf-page-chunks";

const EvidenceTextSchema = z.object({
  value: z.string(),
  page: z.number().int().positive().nullable(),
  quote: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

const OptionalEvidenceTextSchema = EvidenceTextSchema.nullable();

const DocumentPlanOptionSchema = z.object({
  benefitType: z.enum(["medical", "dental", "vision"]),
  planOrProgramName: z.string().min(1),
  planOrProgramId: z.string().min(1).nullable(),
  enrollmentTypes: z.array(z.string().min(1)),
  page: z.number().int().positive().nullable(),
  quote: z.string().min(1).nullable(),
  confidence: z.number().min(0).max(1),
});

export type DocumentPlanOption = z.infer<typeof DocumentPlanOptionSchema>;

const DocumentPlanOptionIndexSchema = z.object({
  documentPlanOptions: z.array(DocumentPlanOptionSchema),
});

const VisionSchedulePathSchema = z.enum([
  "plans.vision.exam.schedule",
  "plans.vision.materials.copay",
  "plans.vision.lenses.standardSchedule",
  "plans.vision.frames.schedule",
  "plans.vision.contacts.electiveSchedule",
  "plans.vision.contacts.necessarySchedule",
  "plans.vision.network.outOfNetworkSchedule",
  "plans.vision.lenses.enhancements",
]);

const VisionScheduleEvidenceSegmentSchema = z.object({
  page: z.number().int().positive(),
  quote: z.string().min(1),
});

const VisionScheduleCandidateSchema = z.object({
  planOrProgramName: z.string().min(1),
  path: VisionSchedulePathSchema,
  valueJson: z.string().min(2),
  rawValue: z.string().min(1),
  evidenceSegments: z.array(VisionScheduleEvidenceSegmentSchema).min(1),
  confidence: z.number().min(0).max(1),
});

const VisionScheduleIndexSchema = z.object({
  candidates: z.array(VisionScheduleCandidateSchema),
});

type VisionScheduleCandidate = z.infer<typeof VisionScheduleCandidateSchema>;
type VisionSchedulePath = z.infer<typeof VisionSchedulePathSchema>;

const comparisonVisionSchedulePaths: VisionSchedulePath[] = [
  "plans.vision.exam.schedule",
  "plans.vision.lenses.standardSchedule",
  "plans.vision.frames.schedule",
  "plans.vision.contacts.electiveSchedule",
  "plans.vision.contacts.necessarySchedule",
  "plans.vision.network.outOfNetworkSchedule",
  "plans.vision.lenses.enhancements",
];

const comparisonVisionRequiredRows: Partial<
  Record<VisionSchedulePath, Array<{ label: string; pattern: RegExp }>>
> = {
  "plans.vision.lenses.standardSchedule": [
    { label: "single", pattern: /single/i },
    { label: "bifocal", pattern: /bifocal/i },
    { label: "trifocal", pattern: /trifocal/i },
    { label: "lenticular", pattern: /lenticular/i },
    { label: "progressive", pattern: /progressive/i },
  ],
  "plans.vision.contacts.electiveSchedule": [
    { label: "conventional", pattern: /conventional/i },
    { label: "disposable", pattern: /disposable/i },
    { label: "fitting", pattern: /fit/i },
  ],
  "plans.vision.contacts.necessarySchedule": [
    { label: "medically necessary", pattern: /medically.?necessary/i },
  ],
  "plans.vision.lenses.enhancements": [
    { label: "anti-reflective", pattern: /anti.?reflective/i },
    { label: "scratch-resistant", pattern: /scratch.?resistant/i },
    { label: "polycarbonate", pattern: /polycarbonate/i },
    {
      label: "photochromic/transitions",
      pattern: /photochromic|transitions/i,
    },
    { label: "polarized", pattern: /polarized/i },
    { label: "tinting", pattern: /tint/i },
    { label: "UV treatment", pattern: /UV.?treatment/i },
  ],
};

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
  documentPlanOptions: z.array(DocumentPlanOptionSchema),
  requirementCandidates: z.array(RequirementCandidateOutputSchema),
});

type ParsedBookletDocumentExtraction = z.infer<typeof BookletDocumentExtractionSchema>;
export type BookletDocumentExtraction = Omit<
  ParsedBookletDocumentExtraction,
  "documentPlanOptions" | "requirementCandidates"
> & {
  fileId: string;
  fileName: string;
  documentType: ClassifiedDocument["documentType"];
  /** Optional only for legacy fixtures/snapshots created before option indexing. */
  documentPlanOptions?: DocumentPlanOption[];
  /** Optional only for legacy fixtures/snapshots created before registry wiring. */
  requirementCandidates?: ExtractedRequirementCandidate[];
  companyProfile?: {
    description?: string | null;
    industry?: string | null;
    headquarters?: string | null;
    employeeRange?: string | null;
  };
};

export function extractionFromCompanyWebsite(
  file: LoadedUploadedFile,
  classification: ClassifiedDocument,
): BookletDocumentExtraction {
  const profile = JSON.parse(file.textContent || file.data.toString("utf8")) as Record<
    string,
    unknown
  >;
  const evidence = (key: string) => {
    const value = typeof profile[key] === "string" ? String(profile[key]).trim() : "";
    return value
      ? { value, page: null, quote: `${key}: ${value}`, confidence: 0.85 }
      : null;
  };
  return {
    fileId: file.id,
    fileName: file.fileName,
    documentType: classification.documentType,
    employer: {
      name: evidence("name"),
      legalName: null,
      address: null,
      website: evidence("website"),
    },
    companyProfile: {
      description: evidence("description")?.value || null,
      industry: evidence("industry")?.value || null,
      headquarters: evidence("headquarters")?.value || null,
      employeeRange: evidence("employeeRange")?.value || null,
    },
    planYear: { start: null, end: null, label: null },
    eligibility: { waitingPeriod: null, description: null, employeeClasses: [] },
    offeredBenefits: [],
    selectedPlans: [],
    contributions: [],
    contacts: [],
    accounts: [],
    sectionOrder: [],
    templateRole: "none",
    extractionMethod: "model",
    warnings: [],
    documentPlanOptions: [],
  };
}

const SYSTEM_PROMPT = `You extract source-backed facts for an employee benefits booklet.
Use only the supplied document. Never infer checked boxes, filled values, employer identity,
contributions, benefit offerings, or selected plans from blank form labels. A blank application
is a template, not factual evidence. Keep current employer facts separate from master-template
or prior-employer facts. Never assign a carrier, insurer, or administrator address to the employer.
Return concise quotes and exact source page numbers. If the PDF is
image-only, visually read it and set extractionMethod to ocr. Record uncertainty in warnings.

For requirementCandidates, emit candidate facts rather than final truth. Use only allowed registry
paths supplied in the task. Keep every plan/program separate. Preserve network, tier, frequency,
member category, unit, period, and product-subtype qualifiers. Use valueJson for nested schedules.
A blank or silent source is not explicit_none: use not_found. Use explicit_none or not_applicable
only for an explicit source statement and an allowed reason code. Never make a legal determination.
Every known material candidate needs a page and short supporting quote.

Before requirementCandidates, build documentPlanOptions as the source's entity index. Include one
entry for each distinct medical, dental, or vision plan option visible in the supplied document,
including single-option documents. planOrProgramName must contain the exact product and option name
needed to distinguish it from every sibling option. Enrollment types or coverage tiers (for example,
Self Only, Self Plus One, and Self and Family) belong in enrollmentTypes under their plan option;
they are not separate plan options. Use a direct identity quote and its page. Then use those exact
documentPlanOptions names as planOrProgramName on every corresponding requirement candidate.

offeredBenefits and selectedPlans mean an employer actually offers or selected the benefit/plan.
Never populate either from a plan document, SBC, certificate, carrier brochure, or compatibility
statement alone. Put plan identity and design in requirementCandidates instead. When a source shows
multiple options, create separate identity and design candidates for every exact option name; never
collapse them under a carrier, program, or generic product name. Copy every registry path exactly,
including camelCase and [] markers; never translate paths to snake_case or kebab-case. Capture every
clearly visible material formula, maximum, duration, frequency, dollar cap, and option-specific rate
on the supplied pages, even when the source authority cannot prove an employer offering. Never call
coverage employer-paid, employee-paid, contributory, or noncontributory unless the supporting quote
explicitly states who pays or uses that exact funding term.

For disability, always capture a visible benefit formula, weekly/monthly cap, elimination period,
and maximum duration. For FSA/HSA/HRA, capture participant administrative fees with their units and
frequency. For dental multi-option sources, documentPlanOptions must contain separate subjects for
every named option such as the MetLife Federal Dental Plan High Option and Standard Option; attach
their Self Only, Self Plus One, and Self and Family variants as enrollmentTypes. For vision
comparison tables, scan every supplied page and capture each option's
exam, frames, standard and progressive lenses, lens enhancements, contacts, pediatric schedule,
frequency, and material savings/discount rows.`;

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
    classification.benefitTypes.length === 0 ||
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
    company_website:
      "Extract only public employer identity, address, website, and company context. Do not infer plan offerings, eligibility, plan year, contributions, or contacts that are not explicitly present.",
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

function claimsZeroEmployeeCost(value: unknown) {
  if (typeof value === "number") return value === 0;
  if (typeof value !== "string") return false;
  return /^(?:\$?\s*0(?:\.0+)?|zero|no employee cost|no employee premium)$/i.test(
    value.trim(),
  );
}

function quoteSupportsZeroEmployeeCost(quote: string | null) {
  const source = quote || "";
  return (
    /\b(?:employee|member)\b.{0,40}\b(?:cost|premium|contribution)\b.{0,30}(?:\$\s*0\b|\bzero\b|\bno cost\b)/i.test(
      source,
    ) ||
    /\b(?:no cost|at no cost|no premium|fully paid)\b.{0,40}\b(?:employee|member)\b/i.test(
      source,
    ) ||
    /\b(?:employer|company|state|policyholder)\b.{0,40}\b(?:pays?|paid|covers?)\b.{0,25}\b(?:100%|full|entire)\b.{0,25}\bpremium\b/i.test(
      source,
    ) ||
    /\bnoncontributory\b/i.test(source)
  );
}

function normalizedIdentity(value: string | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function identityTokens(value: string) {
  return new Set(normalizedIdentity(value).split(" ").filter(Boolean));
}

function indexedPlanOptions(
  parsed: ParsedBookletDocumentExtraction,
  file: LoadedUploadedFile,
  classification: ClassifiedDocument,
) {
  const warnings: string[] = [];
  const seen = new Set<string>();
  const filtered = parsed.documentPlanOptions.filter((option) => {
    if (!benefitAllowedForDocument(option.benefitType, file, classification)) {
      warnings.push(
        `Rejected document plan option ${option.planOrProgramName}: ${option.benefitType} is outside this document's classified benefit focus.`,
      );
      return false;
    }
    if (!file.textContent && (!option.page || !option.quote?.trim())) {
      warnings.push(
        `Rejected document plan option ${option.planOrProgramName}: PDF option identities need a page and supporting quote.`,
      );
      return false;
    }
    const key = `${option.benefitType}:${normalizedIdentity(option.planOrProgramName)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const idCounts = new Map<string, number>();
  for (const option of filtered) {
    if (!option.planOrProgramId) continue;
    const key = `${option.benefitType}:${normalizedIdentity(option.planOrProgramId)}`;
    idCounts.set(key, (idCounts.get(key) || 0) + 1);
  }
  const clearedSharedIds = new Set<string>();
  const options = filtered.map((option) => {
    if (!option.planOrProgramId) return option;
    const key = `${option.benefitType}:${normalizedIdentity(option.planOrProgramId)}`;
    if ((idCounts.get(key) || 0) === 1) return option;
    if (!clearedSharedIds.has(key)) {
      warnings.push(
        `Cleared shared plan/program ID ${option.planOrProgramId}: it does not distinguish the indexed ${option.benefitType} options.`,
      );
      clearedSharedIds.add(key);
    }
    return { ...option, planOrProgramId: null };
  });
  return { options, warnings };
}

function matchingPlanOptions(
  candidate: ExtractedRequirementCandidate,
  options: DocumentPlanOption[],
) {
  if (candidate.subjectHint.planOrProgramId) {
    const idMatches = options.filter(
      (option) =>
        option.planOrProgramId === candidate.subjectHint.planOrProgramId,
    );
    if (idMatches.length) return idMatches;
  }
  const candidateName = normalizedIdentity(
    candidate.subjectHint.planOrProgramName,
  );
  if (!candidateName) return [];
  const exact = options.filter(
    (option) => normalizedIdentity(option.planOrProgramName) === candidateName,
  );
  if (exact.length) return exact;

  const candidateTokens = identityTokens(candidateName);
  const tokenCounts = new Map<string, number>();
  for (const option of options)
    for (const token of identityTokens(option.planOrProgramName))
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
  const uniqueTokenMatches = options.filter((option) =>
    [...identityTokens(option.planOrProgramName)].some(
      (token) => tokenCounts.get(token) === 1 && candidateTokens.has(token),
    ),
  );
  return uniqueTokenMatches.length === 1 ? uniqueTokenMatches : [];
}

function planOptionEvidence(
  option: DocumentPlanOption,
  file: LoadedUploadedFile,
  classification: ClassifiedDocument,
  index: number,
): RequirementEvidence {
  const textStart =
    file.textContent && option.quote
      ? Math.max(0, file.textContent.indexOf(option.quote))
      : 0;
  const locator = option.page
    ? {
        kind: "pdf" as const,
        page: option.page,
        quote: option.quote || undefined,
      }
    : file.textContent && option.quote
      ? {
          kind: "text" as const,
          start: textStart,
          end: textStart + option.quote.length,
          quote: option.quote,
        }
      : undefined;
  return {
    id: `${file.id}:document-plan-option:${index}`,
    sourceFileId: file.id,
    sourceFileName: file.fileName,
    authority: classification.authority || "unknown",
    authorityDomain: "identity",
    ...(classification.effectiveStart
      ? { effectiveStart: classification.effectiveStart }
      : {}),
    ...(classification.effectiveEnd
      ? { effectiveEnd: classification.effectiveEnd }
      : {}),
    ...(classification.employerOrGroupId
      ? { employerOrGroupId: classification.employerOrGroupId }
      : {}),
    ...(option.planOrProgramId
      ? { planOrProgramId: option.planOrProgramId }
      : {}),
    ...(locator ? { locator } : {}),
    extractionMethod: "text",
    extractorVersion: "benefit-option-index-v1",
    confidence: option.confidence,
  };
}

function visionScheduleEvidence(
  file: LoadedUploadedFile,
  classification: ClassifiedDocument,
  path: string,
  page: number,
  quote: string,
  id: string,
): RequirementEvidence {
  return {
    id,
    sourceFileId: file.id,
    sourceFileName: file.fileName,
    authority: classification.authority || "unknown",
    authorityDomain: authorityDomain(path),
    ...(classification.effectiveStart
      ? { effectiveStart: classification.effectiveStart }
      : {}),
    ...(classification.effectiveEnd
      ? { effectiveEnd: classification.effectiveEnd }
      : {}),
    ...(classification.employerOrGroupId
      ? { employerOrGroupId: classification.employerOrGroupId }
      : {}),
    locator: { kind: "pdf", page, quote },
    extractionMethod: "table",
    extractorVersion: "vision-schedule-v1",
  };
}

function focusedVisionScheduleCandidates(
  index: z.infer<typeof VisionScheduleIndexSchema>,
  file: LoadedUploadedFile,
  classification: ClassifiedDocument,
) {
  return index.candidates.map((candidate, candidateIndex) => {
    let value: unknown;
    try {
      value = JSON.parse(candidate.valueJson);
    } catch {
      throw new Error(
        `Vision schedule candidate ${candidate.path} returned invalid valueJson.`,
      );
    }
    const evidence = candidate.evidenceSegments.map((segment, segmentIndex) =>
      visionScheduleEvidence(
        file,
        classification,
        candidate.path,
        segment.page,
        segment.quote,
        `${file.id}:vision-schedule:${candidateIndex}:${segmentIndex}`,
      ),
    );
    return {
      subjectHint: {
        benefitType: "vision" as const,
        planOrProgramName: candidate.planOrProgramName,
      },
      path: candidate.path,
      state: "known" as const,
      value,
      rawValue: candidate.rawValue,
      evidence: evidence[0],
      ...(evidence.length > 1
        ? { supportingEvidence: evidence.slice(1) }
        : {}),
      confidence: candidate.confidence,
    } satisfies ExtractedRequirementCandidate;
  });
}

function visionScheduleCandidateKey(
  planOrProgramName: string,
  path: VisionSchedulePath,
) {
  return `${normalizedIdentity(planOrProgramName)}:${path}`;
}

function visionScheduleRepairTargets(
  file: LoadedUploadedFile,
  candidates: VisionScheduleCandidate[],
  documentPlanOptions: DocumentPlanOption[],
) {
  const visionOptions = documentPlanOptions.filter(
    (option) => option.benefitType === "vision",
  );
  if (
    visionOptions.length < 2 ||
    !/\b(?:benefits?[-_ ]comparison|compare|side[-_ ]by[-_ ]side)\b/i.test(
      file.fileName,
    )
  )
    return [];
  const byKey = new Map(
    candidates.map((candidate) => [
      visionScheduleCandidateKey(candidate.planOrProgramName, candidate.path),
      candidate,
    ]),
  );
  return visionOptions.flatMap((option) =>
    comparisonVisionSchedulePaths.flatMap((path) => {
      const candidate = byKey.get(
        visionScheduleCandidateKey(option.planOrProgramName, path),
      );
      if (!candidate)
        return [
          {
            planOrProgramName: option.planOrProgramName,
            path,
            reason: "The first pass omitted this plan/path cell.",
          },
        ];
      if (
        !/adults?/i.test(candidate.valueJson) ||
        !/child(?:ren)?/i.test(candidate.valueJson)
      )
        return [
          {
            planOrProgramName: option.planOrProgramName,
            path,
            reason:
              "The first pass did not preserve both adult and child branches.",
          },
        ];
      const candidateText = `${candidate.valueJson} ${candidate.rawValue}`;
      const missingRows = (comparisonVisionRequiredRows[path] || [])
        .filter((row) => !row.pattern.test(candidateText))
        .map((row) => row.label);
      if (missingRows.length)
        return [
          {
            planOrProgramName: option.planOrProgramName,
            path,
            reason: `The first pass omitted required comparison rows: ${missingRows.join(
              ", ",
            )}.`,
          },
        ];
      return [];
    }),
  );
}

function reconcilePlanOptionCandidates(
  candidates: ExtractedRequirementCandidate[],
  options: DocumentPlanOption[],
  file: LoadedUploadedFile,
  classification: ClassifiedDocument,
) {
  const indexed = new Map<BenefitType, DocumentPlanOption[]>();
  for (const option of options) {
    const group = indexed.get(option.benefitType) || [];
    group.push(option);
    indexed.set(option.benefitType, group);
  }
  const optionIndex = new Map(
    options.map((option, index) => [
      `${option.benefitType}:${normalizedIdentity(option.planOrProgramName)}`,
      index,
    ]),
  );
  const reconciled = candidates.flatMap((candidate) => {
    const siblings = indexed.get(candidate.subjectHint.benefitType) || [];
    if (!siblings.length) return [candidate];
    const matches = matchingPlanOptions(candidate, siblings);
    const targets = matches.length ? matches : siblings;
    return targets.map((option) => {
      const index =
        optionIndex.get(
          `${option.benefitType}:${normalizedIdentity(option.planOrProgramName)}`,
        ) ?? 0;
      const isPlanName =
        candidate.path === `plans.${option.benefitType}.identity.planName`;
      const identityEvidence = planOptionEvidence(
        option,
        file,
        classification,
        index,
      );
      return {
        ...candidate,
        subjectHint: {
          benefitType: candidate.subjectHint.benefitType,
          planOrProgramName: option.planOrProgramName,
          ...(option.planOrProgramId
            ? { planOrProgramId: option.planOrProgramId }
            : {}),
        },
        ...(isPlanName
          ? {
              value: option.planOrProgramName,
              rawValue: option.planOrProgramName,
              evidence: identityEvidence,
              confidence: option.confidence,
            }
          : {
              evidence: {
                ...candidate.evidence,
                id: `${candidate.evidence.id || `${file.id}:requirement`}:option:${index}`,
                ...(option.planOrProgramId
                  ? { planOrProgramId: option.planOrProgramId }
                  : { planOrProgramId: undefined }),
              },
            }),
      } satisfies ExtractedRequirementCandidate;
    });
  });

  for (const [index, option] of options.entries()) {
    const path = `plans.${option.benefitType}.identity.planName`;
    const exists = reconciled.some(
      (candidate) =>
        candidate.path === path &&
        normalizedIdentity(candidate.subjectHint.planOrProgramName) ===
          normalizedIdentity(option.planOrProgramName),
    );
    if (exists) continue;
    reconciled.push({
      subjectHint: {
        benefitType: option.benefitType,
        planOrProgramName: option.planOrProgramName,
        ...(option.planOrProgramId
          ? { planOrProgramId: option.planOrProgramId }
          : {}),
      },
      path,
      state: "known",
      value: option.planOrProgramName,
      rawValue: option.planOrProgramName,
      evidence: planOptionEvidence(option, file, classification, index),
      confidence: option.confidence,
    });
  }
  const seenPlanIdentities = new Set<string>();
  return reconciled.filter((candidate) => {
    if (!/\.identity\.planName$/.test(candidate.path)) return true;
    const key = `${candidate.subjectHint.benefitType}:${candidate.path}:${normalizedIdentity(candidate.subjectHint.planOrProgramName)}`;
    if (seenPlanIdentities.has(key)) return false;
    seenPlanIdentities.add(key);
    return true;
  });
}

function requirementCandidates(
  parsed: ParsedBookletDocumentExtraction,
  file: LoadedUploadedFile,
  classification: ClassifiedDocument,
  focusedVisionCandidates: ExtractedRequirementCandidate[] = [],
): {
  candidates: ExtractedRequirementCandidate[];
  documentPlanOptions: DocumentPlanOption[];
  warnings: string[];
} {
  const extractionMethod: RequirementEvidence["extractionMethod"] =
    parsed.extractionMethod === "ocr" ? "ocr" : "text";
  const planOptions = indexedPlanOptions(parsed, file, classification);
  const warnings: string[] = [...planOptions.warnings];
  const accepted = parsed.requirementCandidates.flatMap((rawCandidate, index) => {
    const candidate = canonicalizeRequirementCandidatePath(rawCandidate);
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
    const candidateValue =
      candidate.state === "known" ? String(parsedValue(candidate) ?? "") : "";
    if (
      candidate.state === "known" &&
      /\b(?:implicit|inferred|assumed|assumption)\b/i.test(candidateValue)
    ) {
      warnings.push(
        `Rejected requirement candidate ${candidate.path}: known values cannot contain an inference or assumption.`,
      );
      return [];
    }
    if (
      candidate.state === "known" &&
      /\.rates\.employeeCost$/.test(candidate.path) &&
      claimsZeroEmployeeCost(parsedValue(candidate)) &&
      !quoteSupportsZeroEmployeeCost(candidate.quote)
    ) {
      warnings.push(
        `Rejected requirement candidate ${candidate.path}: a zero employee cost needs an explicit no-cost or fully-paid source statement.`,
      );
      return [];
    }
    if (
      /fundingArrangement$/i.test(candidate.path) &&
      /\b(?:employer[- ]paid|noncontributory)\b/i.test(candidateValue) &&
      !/\b(?:employer|company|policyholder)\b.{0,50}\b(?:pay|paid|premium|contribut)|\b(?:paid|premium)\b.{0,50}\b(?:by the employer|by the company|by the policyholder)|\bnoncontributory\b|\bat no cost\b/i.test(
        candidate.quote || "",
      )
    ) {
      warnings.push(
        `Rejected requirement candidate ${candidate.path}: the source quote does not support the employer-paid funding inference.`,
      );
      return [];
    }
    const requirement = BENEFIT_REQUIREMENTS_REGISTRY[candidate.benefitType].fields.find(
      (field) => field.path === candidate.path,
    );
    if (
      candidate.state !== "not_found" &&
      requirement &&
      classification.authority &&
      /offering|selectedByEmployer/i.test(candidate.path) &&
      !requirement.acceptedAuthorities.includes(classification.authority)
    ) {
      warnings.push(
        `Rejected requirement candidate ${candidate.path}: ${classification.authority} is not accepted authority for this registry field.`,
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
    return [
      {
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
        ...(candidate.state === "known"
          ? { value: parsedValue(candidate) }
          : {}),
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
      },
    ];
  });
  const reconciled = reconcilePlanOptionCandidates(
    accepted,
    planOptions.options,
    file,
    classification,
  );
  const focused = reconcilePlanOptionCandidates(
    focusedVisionCandidates,
    planOptions.options,
    file,
    classification,
  );
  const focusedKeys = new Set(
    focused.map(
      (candidate) =>
        `${candidate.subjectHint.benefitType}:${candidate.path}:${normalizedIdentity(candidate.subjectHint.planOrProgramName)}`,
    ),
  );
  return {
    candidates: [
      ...reconciled.filter(
        (candidate) =>
          !focusedKeys.has(
            `${candidate.subjectHint.benefitType}:${candidate.path}:${normalizedIdentity(candidate.subjectHint.planOrProgramName)}`,
          ),
      ),
      ...focused,
    ],
    documentPlanOptions: planOptions.options,
    warnings,
  };
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

function needsPlanOptionIndex(classification: ClassifiedDocument) {
  if (
    [
      "company_website",
      "email_export",
      "employer_application",
      "census",
    ].includes(classification.documentType)
  )
    return false;
  return (classification.benefitTypes || []).some((benefitType) =>
    ["medical", "dental", "vision"].includes(benefitType),
  );
}

async function discoverDocumentPlanOptions({
  file,
  classification,
  client,
  model,
}: {
  file: LoadedUploadedFile;
  classification: ClassifiedDocument;
  client: Pick<OpenAI, "responses">;
  model: string;
}) {
  if (!needsPlanOptionIndex(classification)) return [];
  const response = await client.responses.parse({
    model,
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content: `You identify medical, dental, and vision plan-option entities in an employee-benefit source.
This is an entity-indexing task, not a general summary. Inspect every supplied page before answering.
Return exactly one documentPlanOptions entry per distinct product or benefit-design option, including
the only option in a single-option source. Never return only a carrier, program, or parent product when
named child options are visible. Never turn enrollment types or coverage tiers into separate options;
attach them to their parent option as enrollmentTypes. Names must combine enough visible parent-product
and option wording to remain unique outside this document. Each identity needs a direct quote and page.

Example: a MetLife Federal Dental Plan source that lists High Option - Self Only, High Option - Self Plus
One, High Option - Self and Family, followed by the same three enrollment types for Standard Option has
exactly two documentPlanOptions: MetLife Federal Dental Plan High Option and MetLife Federal Dental Plan
Standard Option. Each entry has the three Self enrollment types. It does not have one generic MetLife
option, and it does not have six plan options. Use only visible evidence; return an empty array when the
source genuinely contains no medical, dental, or vision plan identity.`,
      },
      {
        role: "user",
        content: [
          ...fileContent(file),
          {
            type: "input_text",
            text: `Classification context: ${JSON.stringify({
              documentType: classification.documentType,
              documentSubtype: classification.documentSubtype || "legacy_unknown",
              benefitTypes: classification.benefitTypes || [],
              planOrProgramIds: classification.planOrProgramIds || [],
            })}`,
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(
        DocumentPlanOptionIndexSchema,
        "document_plan_option_index",
      ),
    },
  });
  if (!response.output_parsed)
    throw new Error(`OpenAI returned no plan-option index for ${file.fileName}`);
  return DocumentPlanOptionIndexSchema.parse(response.output_parsed)
    .documentPlanOptions;
}

async function discoverVisionScheduleCandidates({
  file,
  classification,
  documentPlanOptions,
  client,
  model,
}: {
  file: LoadedUploadedFile;
  classification: ClassifiedDocument;
  documentPlanOptions: DocumentPlanOption[];
  client: Pick<OpenAI, "responses">;
  model: string;
}) {
  if (!(classification.benefitTypes || []).includes("vision")) return [];
  const response = await client.responses.parse({
    model,
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content: `You extract complete, option-specific vision benefit schedules from supplied pages.
This is a focused table and conditional-cost pass, not a general summary. Inspect every supplied page,
including continuation pages. Return at most one candidate for each exact plan/path pair. Put the whole
normalized schedule in valueJson as valid JSON, with separate objects for every population, network,
retailer, service subtype, and conditional group. Do not merge adults with children, in-network member
cost with parenthetical out-of-network reimbursement, standard with progressive lenses, or ordinary
members with a specially named employee class. rawValue must concisely retain every value in valueJson.

Use these paths only:
- plans.vision.exam.schedule: exam member costs, exact frequency, network/location, and population.
- plans.vision.materials.copay: eyewear/materials copays and conditional second-pair copays.
- plans.vision.lenses.standardSchedule: single, bifocal, trifocal, lenticular, and progressive-lens costs and frequency.
- plans.vision.frames.schedule: allowances, overage percentages, retailer/collection variants, and frequency.
- plans.vision.lenses.enhancements: every separately listed coating, treatment, tint, or other promoted enhancement with costs.
- plans.vision.contacts.electiveSchedule: conventional/disposable allowances, substitution rule, and fitting fees.
- plans.vision.contacts.necessarySchedule: medically necessary contact costs/allowances.
- plans.vision.network.outOfNetworkSchedule: parenthetical reimbursements by core service when shown.

Each evidenceSegments entry must quote only text visible on that page. Include every page that contributes
to valueJson, but do not claim that one page supports a value found only on another. In comparison tables,
emit every applicable path for every plan column and include both Adults 19+ and Children under 19 branches.
In prose, preserve conditional branches such as a $0 named-location exam copay or a special employee class's
$35 second-pair materials copay. A statement that an employer pays a portion of a premium is not an employee
cost and must not appear in these schedules. Return no candidate for a path absent from the supplied pages.`,
      },
      {
        role: "user",
        content: [
          ...fileContent(file),
          {
            type: "input_text",
            text: `Classification context: ${JSON.stringify({
              documentType: classification.documentType,
              documentSubtype: classification.documentSubtype || "legacy_unknown",
              authority: classification.authority || "unknown",
            })}\nExact plan-option index: ${JSON.stringify(documentPlanOptions)}`,
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(
        VisionScheduleIndexSchema,
        "vision_schedule_index",
      ),
    },
  });
  if (!response.output_parsed)
    throw new Error(`OpenAI returned no vision schedule index for ${file.fileName}`);
  const initial = VisionScheduleIndexSchema.parse(response.output_parsed);
  const repairTargets = visionScheduleRepairTargets(
    file,
    initial.candidates,
    documentPlanOptions,
  );
  if (!repairTargets.length)
    return focusedVisionScheduleCandidates(initial, file, classification);

  const repairResponse = await client.responses.parse({
    model,
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content: `You repair specific omissions in a multi-plan vision benefits comparison.
Inspect every supplied page, especially adult/child continuation pages. Return a complete replacement
candidate for each requested plan/path pair when the source visibly contains that schedule. Preserve
adult and child branches separately, parenthetical out-of-network reimbursements separately from member
cost, and every contributing page as an evidence segment. For elective contacts include conventional,
disposable, and fitting rows. For necessary contacts include the medically necessary row. For standard
lenses include single, bifocal, trifocal, lenticular, and progressive rows. For lens enhancements include
every separately listed coating, treatment, and tint. Use the requested plan name and path verbatim.
Never invent a benefit or value; if a requested schedule truly is absent, return no candidate for it.`,
      },
      {
        role: "user",
        content: [
          ...fileContent(file),
          {
            type: "input_text",
            text: `Exact plan-option index: ${JSON.stringify(
              documentPlanOptions,
            )}\nMissing or incomplete plan/path pairs to repair: ${JSON.stringify(
              repairTargets,
            )}`,
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(
        VisionScheduleIndexSchema,
        "vision_schedule_repair_index",
      ),
    },
  });
  if (!repairResponse.output_parsed)
    throw new Error(`OpenAI returned no vision schedule repair for ${file.fileName}`);
  const repair = VisionScheduleIndexSchema.parse(repairResponse.output_parsed);
  const repairKeys = new Set(
    repairTargets.map((target) =>
      visionScheduleCandidateKey(target.planOrProgramName, target.path),
    ),
  );
  const merged = new Map(
    initial.candidates.map((candidate) => [
      visionScheduleCandidateKey(candidate.planOrProgramName, candidate.path),
      candidate,
    ]),
  );
  for (const candidate of repair.candidates) {
    const key = visionScheduleCandidateKey(
      candidate.planOrProgramName,
      candidate.path,
    );
    if (repairKeys.has(key)) merged.set(key, candidate);
  }
  return focusedVisionScheduleCandidates(
    { candidates: [...merged.values()] },
    file,
    classification,
  );
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
  const discoveredPlanOptions = await discoverDocumentPlanOptions({
    file,
    classification,
    client,
    model,
  });
  const discoveredVisionCandidates = await discoverVisionScheduleCandidates({
    file,
    classification,
    documentPlanOptions: discoveredPlanOptions,
    client,
    model,
  });
  const response = await client.responses.parse({
    model,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          ...fileContent(file),
          {
            type: "input_text",
            text: `${promptFor(classification)}\nFocused document plan-option index (copy these exact identities into documentPlanOptions and use their names on requirementCandidates): ${JSON.stringify(discoveredPlanOptions)}`,
          },
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
    documentPlanOptions: discoveredPlanOptions.length
      ? discoveredPlanOptions
      : (response.output_parsed as { documentPlanOptions?: unknown })
          .documentPlanOptions || [],
    requirementCandidates:
      (response.output_parsed as { requirementCandidates?: unknown })
        .requirementCandidates || [],
  });
  const validatedCandidates = requirementCandidates(
    parsed,
    file,
    classification,
    discoveredVisionCandidates,
  );
  const allowed = (benefitType: BenefitType) =>
    benefitAllowedForDocument(benefitType, file, classification);
  // Legacy callers may not yet supply authority. Once authority is known, the
  // employer-level arrays fail closed: plan design is not employer selection.
  const canProveEmployerOffering =
    !classification.authority ||
    employerOfferingAuthorities.includes(classification.authority) ||
    classification.authority === "prior_year_context";
  const canProveEmployerContribution =
    !classification.authority ||
    [
      "employer_selection",
      "rate_or_contribution",
      "manual_answer",
      "prior_year_context",
    ].includes(classification.authority);
  const offeredBenefits = canProveEmployerOffering
    ? parsed.offeredBenefits.filter((item) => allowed(item.benefitType))
    : [];
  const selectedPlans = canProveEmployerOffering
    ? parsed.selectedPlans.filter((item) => allowed(item.benefitType))
    : [];
  const contributions = canProveEmployerContribution
    ? parsed.contributions.filter((item) => allowed(item.benefitType))
    : [];
  const accounts = parsed.accounts.filter((item) => allowed(item.type));
  const planDocumentAddressNeedsContext =
    parsed.employer.address &&
    [
      "current_plan_document",
      "current_amendment_or_rider",
      "administrator_material",
      "generic_marketing",
    ].includes(classification.authority || "") &&
    !/\b(?:employer|policyholder|plan sponsor|group address)\b/i.test(
      parsed.employer.address.quote || "",
    );
  const employer = planDocumentAddressNeedsContext
    ? { ...parsed.employer, address: null }
    : parsed.employer;
  const validDateEvidence = (value: typeof parsed.planYear.start) =>
    !value || !Number.isNaN(new Date(value.value).getTime()) ? value : null;
  const planYear = {
    ...parsed.planYear,
    start: validDateEvidence(parsed.planYear.start),
    end: validDateEvidence(parsed.planYear.end),
  };
  const rejectedPlanYearDates =
    Number(Boolean(parsed.planYear.start && !planYear.start)) +
    Number(Boolean(parsed.planYear.end && !planYear.end));
  const rejectedLegacyFacts =
    parsed.offeredBenefits.length - offeredBenefits.length +
    parsed.selectedPlans.length - selectedPlans.length +
    parsed.contributions.length - contributions.length +
    parsed.accounts.length - accounts.length;
  return {
    ...parsed,
    employer,
    planYear,
    offeredBenefits,
    selectedPlans,
    contributions,
    accounts,
    documentPlanOptions: validatedCandidates.documentPlanOptions,
    warnings: [
      ...parsed.warnings,
      ...validatedCandidates.warnings,
      ...(planDocumentAddressNeedsContext
        ? [
            "Rejected employer address from a plan document because its quote did not identify an employer or policyholder address.",
          ]
        : []),
      ...(rejectedPlanYearDates
        ? [
            `Rejected ${rejectedPlanYearDates} plan-year date field(s) that were not parseable dates.`,
          ]
        : []),
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
