import { createHash } from "node:crypto";
import type { MedicalPlanAttributes } from "./plan-schema";
import type {
  BenefitPlan,
  BenefitType,
  BenefitsPackage,
  CarrierRatePlan,
  ClassifiedDocument,
  Conflict,
  ContributionRule,
  LoadedUploadedFile,
  SourceRef,
} from "./booklet-types";
import { BENEFIT_REQUIREMENTS_REGISTRY_VERSION } from "./benefit-requirements";
import {
  extractionSource,
  type BookletDocumentExtraction,
} from "./booklet-document-extractor";
import { normalizeTier } from "./rate-sheet-extractor";

type Candidate<T> = {
  value: T;
  confidence: number;
  sourceRefs: SourceRef[];
  priority: number;
};

export type ExtractedMedicalPlan = {
  file: LoadedUploadedFile;
  classification: ClassifiedDocument;
  attributes: MedicalPlanAttributes;
};

const sha = (value: string) =>
  createHash("sha1").update(value).digest("hex").slice(0, 20);
const normalized = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function normalizePlanDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00`)
    : new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const sourcePriority = (documentType: ClassifiedDocument["documentType"]) =>
  ({
    employer_application: 100,
    carrier_rate_sheet: 90,
    renewal_spreadsheet: 90,
    sbc: 85,
    spd: 84,
    plan_summary: 82,
    benefit_guide: 70,
    prior_booklet: 60,
    email_export: 55,
    company_website: 45,
    census: 40,
    unknown: 10,
  })[documentType];

function pick<T>(candidates: Candidate<T>[]) {
  return [...candidates].sort(
    (a, b) => b.priority - a.priority || b.confidence - a.confidence,
  )[0];
}

function evidenceCandidate(
  extraction: BookletDocumentExtraction,
  field:
    | {
        value: string;
        page?: number | null;
        quote?: string | null;
        confidence: number;
      }
    | null,
): Candidate<string> | null {
  if (!field?.value.trim()) return null;
  if (extraction.templateRole === "master_template") return null;
  return {
    value: field.value.trim(),
    confidence: field.confidence,
    sourceRefs: [extractionSource(extraction, field.page, field.quote)],
    priority: sourcePriority(extraction.documentType),
  };
}

function conflictingValues(fieldPath: string, candidates: Candidate<string>[]): Conflict | null {
  const strong = candidates.filter((candidate) => candidate.confidence >= 0.75);
  const groups = new Map<string, Candidate<string>[]>();
  for (const candidate of strong) {
    const group = groups.get(normalized(candidate.value)) || [];
    group.push(candidate);
    groups.set(normalized(candidate.value), group);
  }
  if (groups.size < 2) return null;
  const values = [...groups.values()].map((group) => ({
    value: group[0].value,
    sourceRefs: group.flatMap((item) => item.sourceRefs),
    confidence: Math.max(...group.map((item) => item.confidence)),
  }));
  const sorted = [...strong].sort((a, b) => b.priority - a.priority);
  const priorityGap = sorted[0].priority - sorted[1].priority;
  return {
    fieldPath,
    description: `Conflicting values were found for ${fieldPath}.`,
    values,
    resolution:
      priorityGap >= 20
        ? `Used ${sorted[0].value} because its source has higher field authority.`
        : null,
    blocking: priorityGap < 20,
  };
}

function tokenSimilarity(left: string, right: string) {
  const a = new Set(normalized(left).split(" ").filter((token) => token.length > 1));
  const b = new Set(normalized(right).split(" ").filter((token) => token.length > 1));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return (2 * intersection) / (a.size + b.size);
}

function bestRateMatch(planName: string, rates: CarrierRatePlan[]) {
  return rates
    .map((rate) => ({ rate, score: tokenSimilarity(planName, rate.planName) }))
    .sort((a, b) => b.score - a.score)[0];
}

function accountDocumentPlanMisclassification(
  extraction: BookletDocumentExtraction,
  plan: BookletDocumentExtraction["selectedPlans"][number],
) {
  if (plan.benefitType !== "medical") return false;
  const hasMedicalOffering = extraction.offeredBenefits.some(
    (offering) => offering.benefitType === "medical" && offering.offered,
  );
  const hasAccountOffering = extraction.offeredBenefits.some(
    (offering) =>
      ["hsa", "hra", "fsa"].includes(offering.benefitType) && offering.offered,
  );
  return (
    !hasMedicalOffering &&
    hasAccountOffering &&
    /\b(?:health savings account|health reimbursement account|flexible spending account|hsa contribution|hra contribution|fsa contribution)\b/i.test(
      plan.planName,
    )
  );
}

function planYearFromRate(rate: CarrierRatePlan | undefined) {
  const value = rate?.effectiveDate || rate?.planName.match(/\b20\d{2}\b/)?.[0] || "";
  const year = value.match(/\b20\d{2}\b/)?.[0];
  if (!year) return null;
  return { start: `${year}-01-01`, end: `${year}-12-31`, label: year };
}

function applyManual<T>(
  path: string,
  existing: T | undefined,
  answers: Record<string, unknown>,
): T | undefined {
  return Object.prototype.hasOwnProperty.call(answers, path)
    ? (answers[path] as T)
    : existing;
}

function manualBooleanAnswer(
  path: string,
  answers: Record<string, unknown>,
): boolean | undefined {
  if (!Object.prototype.hasOwnProperty.call(answers, path)) return undefined;
  const value = answers[path];
  if (typeof value === "boolean") return value;
  const normalizedValue = normalized(value);
  if (["yes", "true", "offered"].includes(normalizedValue)) return true;
  if (["no", "false", "not offered"].includes(normalizedValue)) return false;
  return undefined;
}

export function assembleBenefitsPackage({
  companyId,
  documentExtractions,
  rates,
  rateContributions,
  medicalPlans,
  manualAnswers = {},
}: {
  companyId: string;
  documentExtractions: BookletDocumentExtraction[];
  rates: CarrierRatePlan[];
  rateContributions: ContributionRule[];
  medicalPlans: ExtractedMedicalPlan[];
  manualAnswers?: Record<string, unknown>;
}): BenefitsPackage {
  const employerCandidates = documentExtractions
    .map((item) => evidenceCandidate(item, item.employer.name))
    .filter((item): item is Candidate<string> => Boolean(item));
  const legalNameCandidates = documentExtractions
    .map((item) => evidenceCandidate(item, item.employer.legalName))
    .filter((item): item is Candidate<string> => Boolean(item));
  const addressCandidates = documentExtractions
    .map((item) => evidenceCandidate(item, item.employer.address))
    .filter((item): item is Candidate<string> => Boolean(item));
  const websiteCandidates = documentExtractions
    .map((item) => evidenceCandidate(item, item.employer.website))
    .filter((item): item is Candidate<string> => Boolean(item));
  const startCandidates = documentExtractions
    .map((item) => evidenceCandidate(item, item.planYear.start))
    .filter((item): item is Candidate<string> => Boolean(item));
  const endCandidates = documentExtractions
    .map((item) => evidenceCandidate(item, item.planYear.end))
    .filter((item): item is Candidate<string> => Boolean(item));
  const labelCandidates = documentExtractions
    .map((item) => evidenceCandidate(item, item.planYear.label))
    .filter((item): item is Candidate<string> => Boolean(item));
  const waitingCandidates = documentExtractions
    .map((item) => evidenceCandidate(item, item.eligibility.waitingPeriod))
    .filter((item): item is Candidate<string> => Boolean(item));
  const descriptionCandidates = documentExtractions
    .map((item) => evidenceCandidate(item, item.eligibility.description))
    .filter((item): item is Candidate<string> => Boolean(item));

  const selectedPlanEvidence = documentExtractions
    .filter((item) => item.templateRole !== "master_template")
    .flatMap((item) =>
      item.selectedPlans
        .filter((plan) => !accountDocumentPlanMisclassification(item, plan))
        .map((plan) => ({
        ...plan,
        sourceRefs: [extractionSource(item, plan.page, plan.quote)],
        priority: sourcePriority(item.documentType),
        })),
    );
  const manualSelections = manualAnswers["plans.selected"];
  if (Array.isArray(manualSelections)) {
    for (const item of manualSelections) {
      if (!item || typeof item !== "object") continue;
      const value = item as Record<string, unknown>;
      if (!value.planName || !value.benefitType) continue;
      selectedPlanEvidence.push({
        planName: String(value.planName),
        benefitType: String(value.benefitType) as "medical" | "dental" | "vision" | "life" | "std" | "ltd",
        carrier: value.carrier ? String(value.carrier) : null,
        page: null,
        quote: null,
        confidence: 1,
        sourceRefs: [
          {
            fileId: "manual:plans.selected",
            fileName: "User answer",
            documentType: "manual_answer",
            extractionMethod: "manual",
          },
        ],
        priority: 110,
      });
    }
  }

  // An explicitly selected plan name from employer instructions/application is
  // authoritative. Carrier SBC identities often use a longer marketing name;
  // adding both creates a duplicate selected plan and a false missing-rate
  // blocker. Plan documents become selections only when no explicit medical
  // selection was supplied, while their attributes are still attached below.
  if (!selectedPlanEvidence.some((plan) => plan.benefitType === "medical")) {
    for (const item of medicalPlans) {
      selectedPlanEvidence.push({
        planName: item.attributes.identity.planName,
        benefitType: "medical",
        carrier: item.attributes.identity.carrier,
        page: item.attributes.identity.sourcePages[0] || null,
        quote: null,
        confidence: 0.98,
        sourceRefs: [
          {
            fileId: item.file.id,
            fileName: item.file.fileName,
            documentType: item.classification.documentType,
            page: item.attributes.identity.sourcePages[0],
            extractionMethod: "model",
          },
        ],
        priority: sourcePriority(item.classification.documentType),
      });
    }
  }

  const uniqueSelections = new Map<string, (typeof selectedPlanEvidence)[number]>();
  for (const plan of selectedPlanEvidence.sort((a, b) => b.priority - a.priority)) {
    const selectionKey = `${plan.benefitType}:${normalized(plan.planName)}`;
    if (!uniqueSelections.has(selectionKey)) uniqueSelections.set(selectionKey, plan);
  }
  if (!uniqueSelections.size) {
    const employerRates = rates.filter((rate) => rate.employerSpecific);
    const newestYear = Math.max(
      0,
      ...employerRates.map((rate) => Number(rate.planName.match(/\b20\d{2}\b/)?.[0] || 0)),
    );
    for (const rate of employerRates.filter(
      (item) => !newestYear || item.planName.includes(String(newestYear)),
    )) {
      uniqueSelections.set(`${rate.benefitType}:${normalized(rate.planName)}`, {
        planName: rate.planName,
        benefitType: rate.benefitType as "medical" | "dental" | "vision" | "life" | "std" | "ltd",
        carrier: rate.carrier || null,
        page: null,
        quote: null,
        confidence: 0.65,
        sourceRefs: [
          {
            fileId: rate.sourceFileId,
            fileName: rate.sourceFile,
            documentType: "renewal_spreadsheet",
            sheet: rate.sourceSheet,
            row: rate.sourceRow,
            extractionMethod: "spreadsheet",
          },
        ],
        priority: 50,
      });
    }
  }

  const medicalSelectionCount = [...uniqueSelections.values()].filter(
    (selection) => selection.benefitType === "medical",
  ).length;
  const plans: BenefitPlan[] = [...uniqueSelections.values()].map((selection) => {
    const candidateRates = rates.filter((rate) => rate.benefitType === selection.benefitType);
    const match = bestRateMatch(selection.planName, candidateRates);
    const extractedCandidates = medicalPlans
      .map((item) => {
        const identity = item.attributes.identity;
        const nameScore = tokenSimilarity(identity.planName, selection.planName);
        const selectionYear = selection.planName.match(/\b20\d{2}\b/)?.[0];
        const planYear =
          identity.coverageStart?.match(/\b20\d{2}\b/)?.[0] ||
          identity.planName.match(/\b20\d{2}\b/)?.[0];
        const carrierMatches =
          selection.carrier && identity.carrier
            ? tokenSimilarity(selection.carrier, identity.carrier) >= 0.5
            : false;
        return {
          item,
          score:
            nameScore +
            (carrierMatches ? 0.25 : 0) +
            (selectionYear && planYear && selectionYear === planYear ? 0.2 : 0),
        };
      })
      .sort((left, right) => right.score - left.score);
    const extracted =
      selection.benefitType === "medical" &&
      (extractedCandidates[0]?.score >= 0.45 ||
        (medicalPlans.length === 1 && medicalSelectionCount === 1))
        ? extractedCandidates[0]?.item
        : undefined;
    return {
      id: sha(`${companyId}:${selection.benefitType}:${selection.planName}`),
      benefitType: selection.benefitType as BenefitType,
      name: selection.planName,
      carrier: selection.carrier || extracted?.attributes.identity.carrier || match?.rate.carrier || null,
      year:
        selection.planName.match(/\b20\d{2}\b/)?.[0] ||
        extracted?.attributes.identity.coverageStart?.match(/\b20\d{2}\b/)?.[0] ||
        match?.rate.effectiveDate?.match(/\b20\d{2}\b/)?.[0] ||
        null,
      ratePlanId: null,
      attributes: extracted?.attributes || null,
      sourceRefs: [
        ...selection.sourceRefs,
        ...(match && match.score >= 0.45
          ? [
              {
                fileId: match.rate.sourceFileId,
                fileName: match.rate.sourceFile,
                documentType: match.rate.employerSpecific
                  ? ("renewal_spreadsheet" as const)
                  : ("carrier_rate_sheet" as const),
                sheet: match.rate.sourceSheet,
                row: match.rate.sourceRow,
                extractionMethod: "spreadsheet" as const,
              },
            ]
          : []),
      ],
      confidence: match && match.score >= 0.45 ? Math.min(selection.confidence, match.rate.confidence) : selection.confidence * 0.7,
    };
  });
  for (const plan of plans) {
    const manualRate = manualAnswers[`plans.${plan.id}.ratePlanId`];
    if (typeof manualRate === "string" && rates.some((rate) => rate.id === manualRate))
      plan.ratePlanId = manualRate;
    else {
      const candidateRates = rates.filter((rate) => rate.benefitType === plan.benefitType);
      const match = bestRateMatch(plan.name, candidateRates);
      plan.ratePlanId = match && match.score >= 0.45 ? match.rate.id : null;
    }
  }

  const extractedContributions: ContributionRule[] = documentExtractions.flatMap((item) =>
    item.contributions.map((rule) => ({
      benefitType: rule.benefitType,
      planId:
        plans.find((plan) => plan.name.toLowerCase() === rule.planName?.toLowerCase())?.id || null,
      planName: rule.planName,
      tier: normalizeTier(rule.tier),
      employeeClass: rule.employeeClass,
      mode: rule.mode,
      value: rule.mode === "percent" && rule.value > 1 ? rule.value / 100 : rule.value,
      payPeriods: rule.payPeriods || 52,
      sourceRefs: [extractionSource(item, rule.page, rule.quote)],
      confidence: rule.confidence,
    })),
  );
  const contributions = [...extractedContributions, ...rateContributions].filter((rule) => {
    if (!rule.planName) return true;
    return plans.some(
      (plan) =>
        tokenSimilarity(plan.name, rule.planName || "") >= 0.45 || plan.ratePlanId === rule.planId,
    );
  });
  for (const [path, answer] of Object.entries(manualAnswers)) {
    const match = path.match(/^contributions\.([^.]+)\.([^.]+)$/);
    if (!match || !answer || typeof answer !== "object") continue;
    const plan = plans.find((item) => item.id === match[1]);
    if (!plan) continue;
    const value = answer as Record<string, unknown>;
    if (!["percent", "flat_monthly", "flat_per_pay"].includes(String(value.mode)))
      continue;
    contributions.push({
      benefitType: plan.benefitType,
      planId: plan.ratePlanId,
      planName: plan.name,
      tier: match[2],
      employeeClass: null,
      mode: value.mode as ContributionRule["mode"],
      value: Number(value.value),
      payPeriods: Number(value.payPeriods || 52),
      sourceRefs: [
        {
          fileId: `manual:${sha(path)}`,
          fileName: "User answer",
          documentType: "manual_answer",
          extractionMethod: "manual",
        },
      ],
      confidence: 1,
    });
  }

  const offeringEvidence = documentExtractions
    .filter((item) => item.templateRole !== "master_template")
    .flatMap((item) =>
      item.offeredBenefits.map((offering) => ({
        ...offering,
        sourceRef: extractionSource(item, offering.page, offering.quote),
        priority: sourcePriority(item.documentType),
      })),
    );
  const accountEvidence = documentExtractions
    .filter((item) => item.templateRole !== "master_template")
    .flatMap((item) =>
      item.accounts.map((account) => ({
        type: account.type,
        administrator: account.administrator,
        sourceRef: extractionSource(item, account.page),
        confidence: account.confidence,
      })),
    );
  const manualHsaOffering = manualBooleanAnswer(
    "offeredBenefits.hsa",
    manualAnswers,
  );
  const benefitTypes = new Set<BenefitType>([
    ...plans.map((plan) => plan.benefitType),
    ...offeringEvidence.map((item) => item.benefitType),
    ...accountEvidence.map((item) => item.type),
    ...(manualHsaOffering === undefined ? [] : (["hsa"] as const)),
  ]);
  const offeredBenefits = [...benefitTypes].map((type) => {
    const evidence = offeringEvidence
      .filter((item) => item.benefitType === type)
      .sort((a, b) => b.priority - a.priority || b.confidence - a.confidence);
    const selected = plans.filter((plan) => plan.benefitType === type);
    const accountEntries = accountEvidence.filter((account) => account.type === type);
    const manualOffering =
      type === "hsa" ? manualHsaOffering : undefined;
    const manualSource: SourceRef[] =
      manualOffering === undefined
        ? []
        : [
            {
              fileId: `manual:${sha("offeredBenefits.hsa")}`,
              fileName: "User answer",
              documentType: "manual_answer",
              extractionMethod: "manual",
            },
          ];
    return {
      benefitType: type,
      offered:
        manualOffering ??
        (selected.length > 0 ||
          accountEntries.length > 0 ||
          evidence[0]?.offered === true),
      selectedPlans: selected.map((plan) => plan.id),
      eligibilityRule: pick(waitingCandidates)?.value || null,
      contributionRules: contributions.filter((rule) => rule.benefitType === type),
      contacts: [],
      sourceRefs: [
        ...evidence.map((item) => item.sourceRef),
        ...selected.flatMap((plan) => plan.sourceRefs),
        ...accountEntries.map((account) => account.sourceRef),
        ...manualSource,
      ],
      confidence: Math.max(
        manualOffering === undefined ? 0 : 1,
        evidence[0]?.confidence || 0,
        ...selected.map((plan) => plan.confidence),
        ...accountEntries.map((account) => account.confidence),
        0.5,
      ),
    };
  });

  const contacts = documentExtractions
    .filter((item) => item.templateRole !== "master_template")
    .flatMap((item) =>
      item.contacts.map((contact) => ({
        role: contact.role,
        name: contact.name,
        organization: contact.organization,
        phone: contact.phone,
        email: contact.email,
        website: contact.website,
        sourceRefs: [extractionSource(item, contact.page)],
      })),
    );
  const accounts = accountEvidence.map((account) => ({
    type: account.type,
    administrator: account.administrator,
    sourceRefs: [account.sourceRef],
  }));
  const styleSource = documentExtractions.find((item) => item.templateRole === "master_template") ||
    documentExtractions.find((item) => item.templateRole === "employer_prior_context");

  const derivedYear = planYearFromRate(
    rates.find((rate) => plans.some((plan) => plan.ratePlanId === rate.id)),
  );
  const start = normalizePlanDate(applyManual(
    "planYear.start",
    pick(startCandidates)?.value || derivedYear?.start,
    manualAnswers,
  ));
  const end = normalizePlanDate(applyManual(
    "planYear.end",
    pick(endCandidates)?.value || derivedYear?.end,
    manualAnswers,
  ));
  const label = applyManual(
    "planYear.label",
    pick(labelCandidates)?.value || derivedYear?.label,
    manualAnswers,
  );
  const employerName = applyManual(
    "employer.name",
    pick(employerCandidates)?.value,
    manualAnswers,
  );
  const waitingPeriod = applyManual(
    "eligibility.waitingPeriod",
    pick(waitingCandidates)?.value,
    manualAnswers,
  );
  const companyProfileSource = documentExtractions.find(
    (item) => item.documentType === "company_website" && item.companyProfile,
  );

  const conflicts = [
    conflictingValues("employer.name", employerCandidates),
    conflictingValues("planYear.start", startCandidates),
    conflictingValues("planYear.end", endCandidates),
    conflictingValues("eligibility.waitingPeriod", waitingCandidates),
  ]
    .filter((item): item is Conflict => Boolean(item))
    .map((conflict) =>
      Object.prototype.hasOwnProperty.call(manualAnswers, conflict.fieldPath)
        ? {
            ...conflict,
            resolution: "Resolved by a user answer on the booklet thread.",
            blocking: false,
          }
        : conflict,
    );
  const warnings = [
    ...documentExtractions.flatMap((item) => item.warnings),
    ...plans.filter((plan) => !plan.ratePlanId).map((plan) => `No confident rate match was found for ${plan.name}.`),
  ];
  const sourceMap: Record<string, SourceRef[]> = {
    "employer.name": pick(employerCandidates)?.sourceRefs || [],
    "employer.legalName": pick(legalNameCandidates)?.sourceRefs || [],
    "employer.address": pick(addressCandidates)?.sourceRefs || [],
    "employer.website": pick(websiteCandidates)?.sourceRefs || [],
    "planYear.start": pick(startCandidates)?.sourceRefs || [],
    "planYear.end": pick(endCandidates)?.sourceRefs || [],
    "eligibility.waitingPeriod": pick(waitingCandidates)?.sourceRefs || [],
  };
  for (const path of Object.keys(manualAnswers)) {
    sourceMap[path] = [
      {
        fileId: `manual:${sha(path)}`,
        fileName: "User answer",
        documentType: "manual_answer",
        extractionMethod: "manual",
      },
    ];
  }
  const fieldConfidences = {
    "employer.name": Object.prototype.hasOwnProperty.call(manualAnswers, "employer.name")
      ? 1
      : pick(employerCandidates)?.confidence || 0,
    "planYear.start": Object.prototype.hasOwnProperty.call(manualAnswers, "planYear.start")
      ? 1
      : pick(startCandidates)?.confidence || (derivedYear ? 0.65 : 0),
    "planYear.end": Object.prototype.hasOwnProperty.call(manualAnswers, "planYear.end")
      ? 1
      : pick(endCandidates)?.confidence || (derivedYear ? 0.65 : 0),
    "eligibility.waitingPeriod": Object.prototype.hasOwnProperty.call(
      manualAnswers,
      "eligibility.waitingPeriod",
    )
      ? 1
      : pick(waitingCandidates)?.confidence || 0,
    plans: plans.length ? plans.reduce((sum, plan) => sum + plan.confidence, 0) / plans.length : 0,
    contributions: contributions.length
      ? contributions.reduce((sum, rule) => sum + (rule.confidence || 0.75), 0) / contributions.length
      : 0,
  };
  const confidenceValues = Object.values(fieldConfidences);

  return {
    employer: {
      name: employerName || "",
      legalName: pick(legalNameCandidates)?.value || null,
      address: pick(addressCandidates)?.value || null,
      website: pick(websiteCandidates)?.value || null,
      publicProfile: companyProfileSource?.companyProfile || null,
    },
    planYear: { start: start || "", end: end || "", label: label || "" },
    eligibility: {
      waitingPeriod: waitingPeriod || null,
      description: pick(descriptionCandidates)?.value || null,
      employeeClasses: [
        ...new Set(
          documentExtractions
            .filter((item) => item.templateRole !== "master_template")
            .flatMap((item) => item.eligibility.employeeClasses.map((entry) => entry.value)),
        ),
      ],
    },
    offeredBenefits,
    plans,
    rates,
    contributions,
    contacts,
    accounts,
    bookletStyle: {
      templateName: styleSource?.fileName || null,
      sectionOrder: styleSource?.sectionOrder || [],
      sourceRefs: styleSource ? [extractionSource(styleSource, null)] : [],
    },
    sourceMap,
    confidenceReport: {
      overall: confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length,
      fields: fieldConfidences,
      sources: [...new Map(Object.values(sourceMap).flat().map((item) => [`${item.fileId}:${item.page || ""}:${item.sheet || ""}:${item.row || ""}`, item])).values()],
      warnings,
      assumptions: uniqueSelections.size && !selectedPlanEvidence.length
        ? ["Selected plans were inferred from the newest employer-specific cost-summary rows."]
        : [],
      conflicts,
      manualAnswers: Object.keys(manualAnswers),
    },
    requirements: {
      registryVersion: BENEFIT_REQUIREMENTS_REGISTRY_VERSION,
      subjects: [],
      extractionReports: [],
      safeBookletReports: [],
      renderedPathsBySubject: {},
    },
  };
}
