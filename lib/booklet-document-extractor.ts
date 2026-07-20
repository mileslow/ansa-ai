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
  benefitType: BenefitTypeSchema,
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

const RequirementCandidateRepairSchema = z.object({
  requirementCandidates: z.array(RequirementCandidateOutputSchema),
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
entry for each distinct plan, account, program, or product option visible in the supplied document,
including single-option documents and separate STD/LTD, life/AD&D, voluntary, and account programs.
planOrProgramName must contain the exact product and option name
needed to distinguish it from every sibling option. Enrollment types or coverage tiers (for example,
Self Only, Self Plus One, and Self and Family) belong in enrollmentTypes under their plan option;
they are not separate plan options. Use a direct identity quote and its page. Then use those exact
documentPlanOptions names as planOrProgramName on every corresponding requirement candidate.
Regulatory publications describe arrangement types but are not themselves employer plan options;
do not index hypothetical or generic regulatory examples as documentPlanOptions.

offeredBenefits and selectedPlans mean an employer actually offers or selected the benefit/plan.
Never populate either from a plan document, SBC, certificate, carrier brochure, or compatibility
statement alone. Put plan identity and design in requirementCandidates instead. When a source shows
multiple options, create separate identity and design candidates for every exact option name; never
collapse them under a carrier, program, or generic product name. Copy every registry path exactly,
including camelCase and [] markers; never translate paths to snake_case or kebab-case. Capture every
clearly visible material formula, maximum, duration, frequency, dollar cap, and option-specific rate
on the supplied pages, even when the source authority cannot prove an employer offering. Never call
coverage employer-paid, employee-paid, contributory, or noncontributory unless the supporting quote
explicitly states who pays or uses that exact funding term. Funding labels such as shared or contributory
are not product subtypes. A premium contribution statement does not establish benefit taxability; emit a
taxabilityBasis candidate only when the quote explicitly addresses taxes, pre-tax/after-tax treatment,
imputed income, or taxable benefits.

For disability, always capture a visible benefit formula, weekly/monthly cap, elimination period,
and maximum duration. For FSA/HSA/HRA, capture participant administrative fees with their units and
frequency. For HRA sources, capture every separately named supplemental benefit, including its total
pool or per-participant amount, triggering threshold, year, allocation rule, eligible expenses,
exclusions, claim deadline, and reimbursement instructions. For dental multi-option sources,
documentPlanOptions must contain separate subjects for
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
  if (classification.authority === "regulatory_source") {
    if (parsed.documentPlanOptions.length)
      warnings.push(
        `Rejected ${parsed.documentPlanOptions.length} regulatory concept(s) from the plan-option index because regulatory guidance does not establish plan entities.`,
      );
    return { options: [], warnings };
  }
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
  warnings: string[] = [],
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
    const isCoreIdentity =
      ["medical", "dental", "vision"].includes(
        candidate.subjectHint.benefitType,
      ) &&
      candidate.path ===
        `plans.${candidate.subjectHint.benefitType}.identity.planName`;
    const sharedCorePath =
      ["medical", "dental", "vision"].includes(
        candidate.subjectHint.benefitType,
      ) &&
      /\.identity\.(?:carrierOrAdministrator|coveragePeriod|planDesign)$|\.contacts\.memberServices$|\.documents\.governingTerms$/.test(
        candidate.path,
      );
    const targets = matches.length
      ? matches
      : siblings.length === 1 || isCoreIdentity || sharedCorePath
        ? siblings
        : [];
    if (!targets.length) {
      warnings.push(
        `Rejected requirement candidate ${candidate.path}: its subject ${candidate.subjectHint.planOrProgramName || "was unnamed"} could not be matched unambiguously to ${siblings.length} indexed ${candidate.subjectHint.benefitType} options.`,
      );
      return [];
    }
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
    if (!["medical", "dental", "vision"].includes(option.benefitType))
      continue;
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
      candidate.path === "telemedicine.emergencyWarning" &&
      !/\b(?:emergenc\w*|911|crisis|suicid\w*|emergency room|nearest er)\b/i.test(
        candidate.quote || "",
      )
    ) {
      warnings.push(
        `Rejected requirement candidate ${candidate.path}: an emergency warning needs a quote that explicitly mentions an emergency, crisis, 911, or equivalent emergency direction.`,
      );
      return [];
    }
    if (
      ["explicit_none", "not_applicable"].includes(candidate.state) &&
      /\b(?:not mentioned|not shown|not provided|no information|source is silent|silent on|supplied pages do not|document does not mention|no\b.{0,80}\b(?:is|are|was|were)?\s*(?:mentioned|shown|provided))\b/i.test(
        `${candidate.rawValue || ""} ${candidate.quote || ""}`,
      )
    ) {
      warnings.push(
        `Rejected requirement candidate ${candidate.path}: source silence cannot establish ${candidate.state}.`,
      );
      return [];
    }
    if (
      candidate.state === "known" &&
      /\.(?:productSubtype)$/.test(candidate.path) &&
      /^(?:shared|employer[- ]paid|employee[- ]paid|contributory|noncontributory|cost[- ]sharing)$/i.test(
        candidateValue.trim(),
      )
    ) {
      warnings.push(
        `Rejected requirement candidate ${candidate.path}: a funding label is not a product subtype.`,
      );
      return [];
    }
    if (
      candidate.state === "known" &&
      /\.taxabilityBasis$/.test(candidate.path) &&
      !/\b(?:tax|taxable|pre[- ]?tax|post[- ]?tax|after[- ]?tax|imputed income|internal revenue|irc)\b/i.test(
        candidate.quote || "",
      )
    ) {
      warnings.push(
        `Rejected requirement candidate ${candidate.path}: a contribution statement alone does not establish taxability.`,
      );
      return [];
    }
    if (
      candidate.state === "known" &&
      /\.effectivePeriod$/.test(candidate.path) &&
      !/\b(?:20\d{2}|19\d{2}|january|february|march|april|may|june|july|august|september|october|november|december|effective\s+(?:date|on)|begins?|ends?|through|anniversary)\b/i.test(
        `${candidateValue} ${candidate.quote || ""}`,
      )
    ) {
      warnings.push(
        `Rejected requirement candidate ${candidate.path}: a period label without a date or effective-date rule is not an effective period.`,
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
      !file.textContent &&
      candidate.state !== "not_found" &&
      requirement?.material &&
      requirement.evidenceRequired &&
      (!candidate.page || !candidate.quote?.trim())
    ) {
      warnings.push(
        `Rejected requirement candidate ${candidate.path}: a material PDF fact needs an in-range page and supporting quote.`,
      );
      return [];
    }
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
    warnings,
  );
  const focused = reconcilePlanOptionCandidates(
    focusedVisionCandidates,
    planOptions.options,
    file,
    classification,
    warnings,
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
  if (classification.authority === "regulatory_source") return false;
  if (
    [
      "company_website",
      "email_export",
      "employer_application",
      "census",
    ].includes(classification.documentType)
  )
    return false;
  return Boolean((classification.benefitTypes || []).length);
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
        content: `You identify every plan, account, program, and product-option entity in an employee-benefit source.
This is an entity-indexing task, not a general summary. Inspect every supplied page before answering.
Return exactly one documentPlanOptions entry per distinct product or benefit-design option, including
the only option in a single-option source. Never return only a carrier, program, or parent product when
named child options are visible. Never turn enrollment types or coverage tiers into separate options;
attach them to their parent option as enrollmentTypes. Names must combine enough visible parent-product
and option wording to remain unique outside this document. Each identity needs a direct quote and page.

For combined sources, keep different benefit families separate (for example, one STD program and one
LTD program). Preserve named life/AD&D choices, Core versus Buy-Up disability, Low versus High voluntary
options, and distinct HSA/HRA/FSA arrangements when the source presents them as selectable designs.
Do not turn service categories, benefit amounts, employee classes, network tiers, enrollment tiers,
dependent tiers, riders, notices, translations, or claim forms into plan options.

Example: a MetLife Federal Dental Plan source that lists High Option - Self Only, High Option - Self Plus
One, High Option - Self and Family, followed by the same three enrollment types for Standard Option has
exactly two documentPlanOptions: MetLife Federal Dental Plan High Option and MetLife Federal Dental Plan
Standard Option. Each entry has the three Self enrollment types. It does not have one generic MetLife
option, and it does not have six plan options. Use only visible evidence; return an empty array when the
source genuinely contains no plan, account, program, or product identity.`,
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
  repairIncomplete = true,
}: {
  file: LoadedUploadedFile;
  classification: ClassifiedDocument;
  documentPlanOptions: DocumentPlanOption[];
  client: Pick<OpenAI, "responses">;
  model: string;
  repairIncomplete?: boolean;
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
  if (!repairIncomplete)
    return focusedVisionScheduleCandidates(initial, file, classification);
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

function extractionConcurrency() {
  const configured = Number.parseInt(
    process.env.BOOKLET_EXTRACTION_CONCURRENCY || "3",
    10,
  );
  return Number.isInteger(configured) && configured > 0
    ? Math.min(configured, 8)
    : 3;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  task: (value: T, index: number) => Promise<R>,
) {
  const output = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, values.length)) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        output[index] = await task(values[index], index);
      }
    },
  );
  await Promise.all(workers);
  return output;
}

function loadedChunkFile(
  file: LoadedUploadedFile,
  chunk: PdfPageChunk,
  index: number,
): LoadedUploadedFile {
  if (
    chunk.method === "original" &&
    chunk.startPage === 1 &&
    (chunk.totalPages === null || chunk.endPage === chunk.totalPages)
  )
    return file;
  return {
    ...file,
    id: `${file.id}:pages:${chunk.startPage}-${chunk.endPage}`,
    storagePath: `${file.storagePath}#pages=${chunk.startPage}-${chunk.endPage}`,
    data: chunk.data,
    textContent: undefined,
    sha256: `${file.sha256}:chunk:${index}`,
  };
}

function originalChunkPage(page: number | null, chunk: PdfPageChunk) {
  if (page === null) return null;
  if (chunk.totalPages === null) return page;
  const localPageCount = chunk.endPage - chunk.startPage + 1;
  if (page < 1 || page > localPageCount) return null;
  return chunk.startPage + page - 1;
}

function remapDocumentPlanOption(
  option: DocumentPlanOption,
  chunk: PdfPageChunk,
): DocumentPlanOption {
  return { ...option, page: originalChunkPage(option.page, chunk) };
}

function remapParsedExtractionPages(
  parsed: ParsedBookletDocumentExtraction,
  chunk: PdfPageChunk,
): ParsedBookletDocumentExtraction {
  const remapEvidence = <T extends { page: number | null }>(value: T | null) =>
    value ? { ...value, page: originalChunkPage(value.page, chunk) } : null;
  return {
    ...parsed,
    employer: {
      name: remapEvidence(parsed.employer.name),
      legalName: remapEvidence(parsed.employer.legalName),
      address: remapEvidence(parsed.employer.address),
      website: remapEvidence(parsed.employer.website),
    },
    planYear: {
      start: remapEvidence(parsed.planYear.start),
      end: remapEvidence(parsed.planYear.end),
      label: remapEvidence(parsed.planYear.label),
    },
    eligibility: {
      waitingPeriod: remapEvidence(parsed.eligibility.waitingPeriod),
      description: remapEvidence(parsed.eligibility.description),
      employeeClasses: parsed.eligibility.employeeClasses.map((item) => ({
        ...item,
        page: originalChunkPage(item.page, chunk),
      })),
    },
    offeredBenefits: parsed.offeredBenefits.map((item) => ({
      ...item,
      page: originalChunkPage(item.page, chunk),
    })),
    selectedPlans: parsed.selectedPlans.map((item) => ({
      ...item,
      page: originalChunkPage(item.page, chunk),
    })),
    contributions: parsed.contributions.map((item) => ({
      ...item,
      page: originalChunkPage(item.page, chunk),
    })),
    contacts: parsed.contacts.map((item) => ({
      ...item,
      page: originalChunkPage(item.page, chunk),
    })),
    accounts: parsed.accounts.map((item) => ({
      ...item,
      page: originalChunkPage(item.page, chunk),
    })),
    documentPlanOptions: parsed.documentPlanOptions.map((option) =>
      remapDocumentPlanOption(option, chunk),
    ),
    requirementCandidates: parsed.requirementCandidates.map((candidate) => ({
      ...candidate,
      page: originalChunkPage(candidate.page, chunk),
    })),
  };
}

function remapRequirementEvidence(
  evidence: RequirementEvidence,
  chunk: PdfPageChunk,
  sourceFile: LoadedUploadedFile,
): RequirementEvidence {
  if (evidence.locator?.kind !== "pdf")
    return {
      ...evidence,
      sourceFileId: sourceFile.id,
      sourceFileName: sourceFile.fileName,
    };
  const page = originalChunkPage(evidence.locator.page, chunk);
  return {
    ...evidence,
    sourceFileId: sourceFile.id,
    sourceFileName: sourceFile.fileName,
    ...(page
      ? { locator: { ...evidence.locator, page } }
      : { locator: undefined }),
  };
}

function remapFocusedCandidates(
  candidates: ExtractedRequirementCandidate[],
  chunk: PdfPageChunk,
  sourceFile: LoadedUploadedFile,
) {
  return candidates.map((candidate) => ({
    ...candidate,
    evidence: remapRequirementEvidence(candidate.evidence, chunk, sourceFile),
    ...(candidate.supportingEvidence
      ? {
          supportingEvidence: candidate.supportingEvidence.map((evidence) =>
            remapRequirementEvidence(evidence, chunk, sourceFile),
          ),
        }
      : {}),
  }));
}

function optionSpecificTokens(value: string) {
  return new Set(
    normalizedIdentity(value)
      .split(" ")
      .filter((token) =>
        /^(?:high|standard|basic|premier|focus|enhanced|core|buy|up|buyup|low|bronze|silver|gold|platinum|general|limited|purpose|combination|post|deductible|dependent|care|medical|health|option|plan|[ivx]+|\d+)$/.test(
          token,
        ),
      ),
  );
}

function mergeOptionRecords(
  left: DocumentPlanOption,
  right: DocumentPlanOption,
): DocumentPlanOption {
  const leftName = normalizedIdentity(left.planOrProgramName);
  const rightName = normalizedIdentity(right.planOrProgramName);
  const preferred = rightName.length > leftName.length ? right : left;
  const alternate = preferred === left ? right : left;
  return {
    ...preferred,
    planOrProgramId:
      preferred.planOrProgramId || alternate.planOrProgramId || null,
    enrollmentTypes: [
      ...new Set([...left.enrollmentTypes, ...right.enrollmentTypes]),
    ],
    confidence: Math.max(left.confidence, right.confidence),
  };
}

function consolidateDocumentPlanOptions(options: DocumentPlanOption[]) {
  const exact = new Map<string, DocumentPlanOption>();
  for (const option of options) {
    const key = `${option.benefitType}:${normalizedIdentity(option.planOrProgramName)}`;
    exact.set(
      key,
      exact.has(key) ? mergeOptionRecords(exact.get(key)!, option) : option,
    );
  }
  let consolidated = [...exact.values()];

  const mergedById: DocumentPlanOption[] = [];
  for (const option of consolidated) {
    const optionId = normalizedIdentity(option.planOrProgramId || "");
    if (!optionId) {
      mergedById.push(option);
      continue;
    }
    const compatible = mergedById
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => {
        if (
          candidate.benefitType !== option.benefitType ||
          normalizedIdentity(candidate.planOrProgramId || "") !== optionId
        )
          return false;
        const left = optionSpecificTokens(candidate.planOrProgramName);
        const right = optionSpecificTokens(option.planOrProgramName);
        return ![...left].some(
          (token) =>
            token !== "plan" && token !== "option" && !right.has(token),
        ) &&
          ![...right].some(
            (token) =>
              token !== "plan" && token !== "option" && !left.has(token),
          );
      });
    if (compatible.length === 1) {
      const match = compatible[0];
      mergedById[match.index] = mergeOptionRecords(match.candidate, option);
    } else {
      mergedById.push(option);
    }
  }
  consolidated = mergedById;

  const stopwords = new Set([
    "the",
    "of",
    "and",
    "for",
    "plan",
    "option",
    "insurance",
    "income",
    "group",
    "university",
  ]);
  const identityWords = (value: string) =>
    new Set(
      normalizedIdentity(value)
        .split(" ")
        .filter((token) => token.length > 1 && !stopwords.has(token)),
    );
  const fuzzyMerged: DocumentPlanOption[] = [];
  for (const option of consolidated) {
    if (["medical", "dental", "vision"].includes(option.benefitType)) {
      fuzzyMerged.push(option);
      continue;
    }
    const words = identityWords(option.planOrProgramName);
    const specific = optionSpecificTokens(option.planOrProgramName);
    const matches = fuzzyMerged
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => {
        if (candidate.benefitType !== option.benefitType) return false;
        const candidateSpecific = optionSpecificTokens(
          candidate.planOrProgramName,
        );
        const specificConflict =
          [...specific].some(
            (token) =>
              token !== "plan" &&
              token !== "option" &&
              !candidateSpecific.has(token),
          ) ||
          [...candidateSpecific].some(
            (token) =>
              token !== "plan" && token !== "option" && !specific.has(token),
          );
        if (specificConflict) return false;
        const candidateWords = identityWords(candidate.planOrProgramName);
        const overlap = [...words].filter((token) =>
          candidateWords.has(token),
        ).length;
        return overlap / Math.max(1, Math.min(words.size, candidateWords.size)) >= 0.75;
      });
    if (matches.length === 1) {
      const match = matches[0];
      fuzzyMerged[match.index] = mergeOptionRecords(match.candidate, option);
    } else {
      fuzzyMerged.push(option);
    }
  }
  consolidated = fuzzyMerged;

  // Drop a generic parent label when the same source has two or more named
  // descendants. It is a product family, not a third selectable option.
  consolidated = consolidated.filter((option, optionIndex) => {
    const name = normalizedIdentity(option.planOrProgramName);
    const descendants = consolidated.filter((candidate, candidateIndex) => {
      if (
        candidateIndex === optionIndex ||
        candidate.benefitType !== option.benefitType
      )
        return false;
      const candidateName = normalizedIdentity(candidate.planOrProgramName);
      return candidateName.length > name.length && candidateName.includes(name);
    });
    return descendants.length < 2;
  });

  // Merge a short label (for example, "High Option") into its one uniquely
  // matching fully-qualified identity, without merging High and Standard.
  const removed = new Set<number>();
  for (let index = 0; index < consolidated.length; index += 1) {
    if (removed.has(index)) continue;
    const option = consolidated[index];
    const name = normalizedIdentity(option.planOrProgramName);
    const matches = consolidated
      .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
      .filter(({ candidate, candidateIndex }) => {
        if (
          candidateIndex === index ||
          removed.has(candidateIndex) ||
          candidate.benefitType !== option.benefitType
        )
          return false;
        const candidateName = normalizedIdentity(candidate.planOrProgramName);
        if (!(candidateName.includes(name) || name.includes(candidateName)))
          return false;
        const leftSpecific = optionSpecificTokens(name);
        const rightSpecific = optionSpecificTokens(candidateName);
        const conflictingSpecific = [...leftSpecific].some(
          (token) => !rightSpecific.has(token) && token !== "option" && token !== "plan",
        );
        return !conflictingSpecific;
      });
    if (matches.length !== 1) continue;
    const match = matches[0];
    consolidated[index] = mergeOptionRecords(option, match.candidate);
    removed.add(match.candidateIndex);
  }
  return consolidated
    .filter((_, index) => !removed.has(index))
    .map((option) =>
      ["medical", "dental", "vision"].includes(option.benefitType)
        ? option
        : { ...option, enrollmentTypes: [] },
    );
}

function bestEvidenceText<T extends { confidence: number }>(
  values: Array<T | null>,
) {
  return values
    .filter((value): value is T => Boolean(value))
    .sort((left, right) => right.confidence - left.confidence)[0] || null;
}

function uniqueEvidenceRows<T extends { page: number | null; confidence: number }>(
  values: T[],
) {
  const rows = new Map<string, T>();
  for (const value of values) {
    const { page: _page, confidence: _confidence, ...identity } = value;
    const key = JSON.stringify(identity);
    const existing = rows.get(key);
    if (!existing || value.confidence > existing.confidence) rows.set(key, value);
  }
  return [...rows.values()];
}

function mergeParsedExtractions(
  parsed: ParsedBookletDocumentExtraction[],
  options: DocumentPlanOption[],
  chunkWarnings: string[],
): ParsedBookletDocumentExtraction {
  const first = parsed[0];
  const templatePriority: ParsedBookletDocumentExtraction["templateRole"][] = [
    "employer_factual",
    "employer_prior_context",
    "master_template",
    "none",
  ];
  return {
    ...first,
    employer: {
      name: bestEvidenceText(parsed.map((item) => item.employer.name)),
      legalName: bestEvidenceText(parsed.map((item) => item.employer.legalName)),
      address: bestEvidenceText(parsed.map((item) => item.employer.address)),
      website: bestEvidenceText(parsed.map((item) => item.employer.website)),
    },
    planYear: {
      start: bestEvidenceText(parsed.map((item) => item.planYear.start)),
      end: bestEvidenceText(parsed.map((item) => item.planYear.end)),
      label: bestEvidenceText(parsed.map((item) => item.planYear.label)),
    },
    eligibility: {
      waitingPeriod: bestEvidenceText(
        parsed.map((item) => item.eligibility.waitingPeriod),
      ),
      description: bestEvidenceText(
        parsed.map((item) => item.eligibility.description),
      ),
      employeeClasses: uniqueEvidenceRows(
        parsed.flatMap((item) => item.eligibility.employeeClasses),
      ),
    },
    offeredBenefits: uniqueEvidenceRows(
      parsed.flatMap((item) => item.offeredBenefits),
    ),
    selectedPlans: uniqueEvidenceRows(
      parsed.flatMap((item) => item.selectedPlans),
    ),
    contributions: uniqueEvidenceRows(
      parsed.flatMap((item) => item.contributions),
    ),
    contacts: uniqueEvidenceRows(parsed.flatMap((item) => item.contacts)),
    accounts: uniqueEvidenceRows(parsed.flatMap((item) => item.accounts)),
    sectionOrder:
      [...parsed].sort(
        (left, right) => right.sectionOrder.length - left.sectionOrder.length,
      )[0]?.sectionOrder || [],
    templateRole:
      templatePriority.find((role) =>
        parsed.some((item) => item.templateRole === role),
      ) || "none",
    extractionMethod: parsed.some((item) => item.extractionMethod === "ocr")
      ? "ocr"
      : parsed.some((item) => item.extractionMethod === "pdf_text")
        ? "pdf_text"
        : first.extractionMethod,
    warnings: [
      ...new Set([...parsed.flatMap((item) => item.warnings), ...chunkWarnings]),
    ],
    documentPlanOptions: options,
    requirementCandidates: parsed.flatMap(
      (item) => item.requirementCandidates,
    ),
  };
}

function stableCandidateValue(candidate: ExtractedRequirementCandidate) {
  return JSON.stringify({
    state: candidate.state,
    value: candidate.state === "known" ? candidate.value : undefined,
    reasonCode: candidate.reasonCode,
  });
}

function evidenceKey(evidence: RequirementEvidence) {
  return JSON.stringify({
    sourceFileId: evidence.sourceFileId,
    authority: evidence.authority,
    locator: evidence.locator,
  });
}

function candidateEvidence(candidate: ExtractedRequirementCandidate) {
  return [candidate.evidence, ...(candidate.supportingEvidence || [])];
}

function mergeCandidateEvidence(
  preferred: ExtractedRequirementCandidate,
  others: ExtractedRequirementCandidate[],
) {
  const uniqueEvidence = [
    ...new Map(
      [preferred, ...others]
        .flatMap(candidateEvidence)
        .map((evidence) => [evidenceKey(evidence), evidence]),
    ).values(),
  ];
  return {
    ...preferred,
    evidence: uniqueEvidence[0],
    ...(uniqueEvidence.length > 1
      ? { supportingEvidence: uniqueEvidence.slice(1) }
      : { supportingEvidence: undefined }),
    confidence: Math.max(
      preferred.confidence,
      ...others.map((candidate) => candidate.confidence),
    ),
  };
}

function isDeepSubset(subset: unknown, superset: unknown): boolean {
  if (Object.is(subset, superset)) return true;
  if (Array.isArray(subset) && Array.isArray(superset))
    return subset.every((value) =>
      superset.some((candidate) => isDeepSubset(value, candidate)),
    );
  if (
    subset &&
    superset &&
    typeof subset === "object" &&
    typeof superset === "object" &&
    !Array.isArray(subset) &&
    !Array.isArray(superset)
  )
    return Object.entries(subset).every(
      ([key, value]) =>
        key in (superset as Record<string, unknown>) &&
        isDeepSubset(value, (superset as Record<string, unknown>)[key]),
    );
  return false;
}

function mergeDuplicateRequirementCandidates(
  candidates: ExtractedRequirementCandidate[],
) {
  const merged = new Map<string, ExtractedRequirementCandidate>();
  for (const candidate of candidates) {
    const key = [
      candidate.subjectHint.benefitType,
      normalizedIdentity(candidate.subjectHint.planOrProgramName),
      candidate.subjectHint.planOrProgramId || "",
      candidate.path,
      stableCandidateValue(candidate),
    ].join(":");
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, candidate);
      continue;
    }
    const preferred =
      candidate.confidence > existing.confidence ? candidate : existing;
    merged.set(
      key,
      mergeCandidateEvidence(preferred, [
        preferred === candidate ? existing : candidate,
      ]),
    );
  }
  const bySubjectPath = new Map<string, ExtractedRequirementCandidate[]>();
  for (const candidate of merged.values()) {
    const key = [
      candidate.subjectHint.benefitType,
      normalizedIdentity(candidate.subjectHint.planOrProgramName),
      candidate.subjectHint.planOrProgramId || "",
      candidate.path,
    ].join(":");
    const group = bySubjectPath.get(key) || [];
    group.push(candidate);
    bySubjectPath.set(key, group);
  }
  return [...bySubjectPath.values()].flatMap((group) => {
    let survivors = group.some((candidate) => candidate.state !== "not_found")
      ? group.filter((candidate) => candidate.state !== "not_found")
      : group;
    const removed = new Set<number>();
    for (let left = 0; left < survivors.length; left += 1) {
      if (removed.has(left) || survivors[left].state !== "known") continue;
      for (let right = 0; right < survivors.length; right += 1) {
        if (
          left === right ||
          removed.has(right) ||
          survivors[right].state !== "known"
        )
          continue;
        const leftValue = survivors[left].value;
        const rightValue = survivors[right].value;
        if (
          isDeepSubset(leftValue, rightValue) &&
          !isDeepSubset(rightValue, leftValue)
        ) {
          survivors[right] = mergeCandidateEvidence(survivors[right], [
            survivors[left],
          ]);
          removed.add(left);
          break;
        }
      }
    }
    survivors = survivors.filter((_, index) => !removed.has(index));
    return survivors;
  });
}

function rawCandidateSubjectKey(candidate: RequirementCandidateOutput) {
  return [
    candidate.benefitType,
    normalizedIdentity(candidate.planOrProgramName || ""),
    candidate.path,
  ].join(":");
}

async function auditChunkRequirementCandidates({
  chunkFile,
  classification,
  discoveredPlanOptions,
  initialCandidates,
  pageContext,
  client,
  model,
}: {
  chunkFile: LoadedUploadedFile;
  classification: ClassifiedDocument;
  discoveredPlanOptions: DocumentPlanOption[];
  initialCandidates: RequirementCandidateOutput[];
  pageContext: string;
  client: Pick<OpenAI, "responses">;
  model: string;
}) {
  const response = await client.responses.parse({
    model,
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content: `You are the completeness and evidence repair pass for employee-benefit extraction.
Inspect every supplied page and compare it with the initial requirement candidates. Return only:
(1) complete replacements for candidates whose value, quote, option identity, or qualifiers are incomplete,
and (2) material registry candidates that the initial pass omitted. A replacement must use the same exact
planOrProgramName and registry path. Never shorten a value with ellipses. Preserve every included and excluded
employee class, hours/service threshold, waiting period, active-work rule, network, tier, population, frequency,
duration, formula, cap, exception, limitation, and conditional branch visible on the page. Quotes must be short
but verbatim and must directly support the whole normalized value; use valueJson when the value needs structure.

Do not repeat already complete candidates. Do not emit not_found for a page-window absence. Do not infer an
employer offering, plan selection, funding label, taxability rule, legal conclusion, or zero employee cost.
Funding is not a product subtype, a contribution is not a taxability statement, and silence is not explicit none.
Use only registry paths in the supplied contract and local page numbers from the supplied PDF window.`,
      },
      {
        role: "user",
        content: [
          ...fileContent(chunkFile),
          {
            type: "input_text",
            text: `${pageContext}\n${promptFor(classification)}\nExact entity index: ${JSON.stringify(discoveredPlanOptions)}\nInitial candidates to audit: ${JSON.stringify(initialCandidates)}`,
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(
        RequirementCandidateRepairSchema,
        "requirement_candidate_repairs",
      ),
    },
  });
  if (!response.output_parsed)
    throw new Error(`OpenAI returned no requirement repair for ${chunkFile.fileName}`);
  const repairs = RequirementCandidateRepairSchema.parse(
    response.output_parsed,
  ).requirementCandidates.map(canonicalizeRequirementCandidatePath);
  const usableRepairs = repairs.filter((candidate) => {
    if (!validateRequirementCandidateOutput(candidate).success) return false;
    if (
      candidate.state !== "not_found" &&
      (!candidate.page || !candidate.quote?.trim())
    )
      return false;
    return true;
  });
  const repairedKeys = new Set(usableRepairs.map(rawCandidateSubjectKey));
  return [
    ...initialCandidates.filter(
      (candidate) => !repairedKeys.has(rawCandidateSubjectKey(candidate)),
    ),
    ...usableRepairs,
  ];
}

async function parseBookletChunk({
  chunkFile,
  sourceFile,
  chunk,
  classification,
  discoveredPlanOptions,
  client,
  model,
}: {
  chunkFile: LoadedUploadedFile;
  sourceFile: LoadedUploadedFile;
  chunk: PdfPageChunk;
  classification: ClassifiedDocument;
  discoveredPlanOptions: DocumentPlanOption[];
  client: Pick<OpenAI, "responses">;
  model: string;
}) {
  const pageContext =
    chunk.totalPages !== null && chunk.totalPages > chunk.endPage
      ? `This input contains original source pages ${chunk.startPage}-${chunk.endPage} of ${chunk.totalPages}. Exhaustively extract every applicable visible fact from this page window. Do not emit not_found merely because a field is absent from this window. Page numbers in your response must refer to the supplied chunk (1-${chunk.endPage - chunk.startPage + 1}); they will be remapped to original pages after validation.`
      : "Exhaustively inspect every supplied page and emit every applicable visible registry fact.";
  const focused = await discoverVisionScheduleCandidates({
    file: chunkFile,
    classification,
    documentPlanOptions: discoveredPlanOptions,
    client,
    model,
    repairIncomplete:
      chunk.method === "original" &&
      chunk.startPage === 1 &&
      (chunk.totalPages === null || chunk.endPage === chunk.totalPages),
  });
  const response = await client.responses.parse({
    model,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          ...fileContent(chunkFile),
          {
            type: "input_text",
            text: `${pageContext}\n${promptFor(classification)}\nFocused document plan-option index (copy these exact identities into documentPlanOptions and use their names on requirementCandidates): ${JSON.stringify(discoveredPlanOptions)}`,
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(
        BookletDocumentExtractionSchema,
        "booklet_document_extraction",
      ),
    },
  });
  if (!response.output_parsed)
    throw new Error(`OpenAI returned no parsed extraction for ${sourceFile.fileName}`);
  const parsed = BookletDocumentExtractionSchema.parse({
    ...response.output_parsed,
    documentPlanOptions:
      (response.output_parsed as { documentPlanOptions?: unknown })
        .documentPlanOptions || [],
    requirementCandidates:
      (response.output_parsed as { requirementCandidates?: unknown })
        .requirementCandidates || [],
  });
  const shouldRepair =
    sourceFile.data.subarray(0, 5).toString("ascii") === "%PDF-" &&
    process.env.BOOKLET_EXTRACTOR_DISABLE_REPAIR !== "1";
  const repairedCandidates = shouldRepair
    ? await auditChunkRequirementCandidates({
        chunkFile,
        classification,
        discoveredPlanOptions,
        initialCandidates: parsed.requirementCandidates,
        pageContext,
        client,
        model,
      })
    : parsed.requirementCandidates;
  return {
    parsed: remapParsedExtractionPages(
      { ...parsed, requirementCandidates: repairedCandidates },
      chunk,
    ),
    focused: remapFocusedCandidates(focused, chunk, sourceFile),
  };
}

export async function extractBookletDocument({
  file,
  classification,
  apiKey = process.env.OPENAI_API_KEY,
  client = new OpenAI({ apiKey }),
  model = process.env.OPENAI_BOOKLET_MODEL || "gpt-5.4-mini",
  maxPagesPerPass,
}: {
  file: LoadedUploadedFile;
  classification: ClassifiedDocument;
  apiKey?: string;
  client?: Pick<OpenAI, "responses">;
  model?: string;
  /** Test/operations override; production defaults to bounded 24-page passes. */
  maxPagesPerPass?: number;
}): Promise<BookletDocumentExtraction> {
  if (!file.data.length && !file.textContent) throw new Error(`${file.fileName} is empty`);
  const configuredPageLimit = Number.parseInt(
    process.env.BOOKLET_EXTRACTOR_MAX_PAGES_PER_PASS || "24",
    10,
  );
  const pageLimit =
    maxPagesPerPass ||
    (Number.isInteger(configuredPageLimit) && configuredPageLimit > 1
      ? configuredPageLimit
      : 24);
  const looksLikePdf =
    !file.textContent &&
    (file.mimeType === "application/pdf" || file.fileName.toLowerCase().endsWith(".pdf")) &&
    file.data.subarray(0, 5).toString("ascii") === "%PDF-";
  const chunks: PdfPageChunk[] = looksLikePdf
    ? await createPdfPageChunks(file.data, {
        maxPages: pageLimit,
        overlapPages: 1,
      })
    : [
        {
          data: file.data,
          startPage: 1,
          endPage: 1,
          totalPages: null,
          method: "original",
        },
      ];
  const chunkFiles = chunks.map((chunk, index) =>
    loadedChunkFile(file, chunk, index),
  );
  const discoveredPlanOptions = needsPlanOptionIndex(classification)
    ? consolidateDocumentPlanOptions(
        (
          await mapWithConcurrency(
            chunkFiles,
            extractionConcurrency(),
            async (chunkFile, index) =>
              (
                await discoverDocumentPlanOptions({
                  file: chunkFile,
                  classification,
                  client,
                  model,
                })
              ).map((option) => remapDocumentPlanOption(option, chunks[index])),
          )
        ).flat(),
      )
    : [];
  const chunkResults = await mapWithConcurrency(
    chunkFiles,
    extractionConcurrency(),
    (chunkFile, index) =>
      parseBookletChunk({
        chunkFile,
        sourceFile: file,
        chunk: chunks[index],
        classification,
        discoveredPlanOptions,
        client,
        model,
      }),
  );
  const allPlanOptions = consolidateDocumentPlanOptions([
    ...discoveredPlanOptions,
    ...chunkResults.flatMap((result) => result.parsed.documentPlanOptions),
  ]);
  const parsed = mergeParsedExtractions(
    chunkResults.map((result) => result.parsed),
    allPlanOptions,
    chunks.flatMap((chunk) => (chunk.warning ? [chunk.warning] : [])),
  );
  const validatedCandidates = requirementCandidates(
    parsed,
    file,
    classification,
    chunkResults.flatMap((result) => result.focused),
  );
  validatedCandidates.candidates = mergeDuplicateRequirementCandidates(
    validatedCandidates.candidates,
  );
  const allowed = (benefitType: BenefitType) =>
    benefitAllowedForDocument(benefitType, file, classification);
  const templateOnly =
    classification.scope === "master_template" ||
    parsed.templateRole === "master_template";
  // Legacy callers may not yet supply authority. Once authority is known, the
  // employer-level arrays fail closed: plan design is not employer selection.
  const canProveEmployerOffering =
    !templateOnly &&
    (!classification.authority ||
      employerOfferingAuthorities.includes(classification.authority) ||
      classification.authority === "prior_year_context");
  const canProveEmployerContribution =
    !templateOnly &&
    (!classification.authority ||
      [
        "employer_selection",
        "rate_or_contribution",
        "manual_answer",
        "prior_year_context",
      ].includes(classification.authority));
  const offeredBenefits = canProveEmployerOffering
    ? parsed.offeredBenefits.filter((item) => allowed(item.benefitType))
    : [];
  const selectedPlans = canProveEmployerOffering
    ? parsed.selectedPlans.filter((item) => allowed(item.benefitType))
    : [];
  const contributions = canProveEmployerContribution
    ? parsed.contributions.filter(
        (item) =>
          allowed(item.benefitType) &&
          (item.value !== 0 ||
            /(?:\$\s*0(?:\.0+)?\b|\bzero\b|\bno (?:employer |employee )?contribution\b|\bdoes not contribute\b)/i.test(
              item.quote || "",
            )),
      )
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
  const employer = templateOnly
    ? { name: null, legalName: null, address: null, website: null }
    : planDocumentAddressNeedsContext
      ? { ...parsed.employer, address: null }
      : parsed.employer;
  const validDateEvidence = (value: typeof parsed.planYear.start) =>
    !value || !Number.isNaN(new Date(value.value).getTime()) ? value : null;
  const regulatoryPlanYear = classification.authority === "regulatory_source";
  const planYear = regulatoryPlanYear
    ? { start: null, end: null, label: null }
    : {
        ...parsed.planYear,
        start: validDateEvidence(parsed.planYear.start),
        end: validDateEvidence(parsed.planYear.end),
      };
  const rejectedPlanYearDates =
    (regulatoryPlanYear
      ? 0
      : Number(Boolean(parsed.planYear.start && !planYear.start)) +
        Number(Boolean(parsed.planYear.end && !planYear.end)));
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
      ...(templateOnly && Object.values(parsed.employer).some(Boolean)
        ? [
            "Rejected employer identity from a master template because sample or placeholder values are not current-employer facts.",
          ]
        : []),
      ...(rejectedPlanYearDates
        ? [
            `Rejected ${rejectedPlanYearDates} plan-year date field(s) that were not parseable dates.`,
          ]
        : []),
      ...(regulatoryPlanYear && Object.values(parsed.planYear).some(Boolean)
        ? [
            "Rejected legacy plan-year fields from regulatory guidance because regulatory applicability dates are not an employer plan year.",
          ]
        : []),
      ...(rejectedLegacyFacts
        ? [
            `Rejected ${rejectedLegacyFacts} legacy summary fact(s) that failed document authority or evidence safeguards.`,
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
