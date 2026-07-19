import { createHash } from "node:crypto";
import type {
  BenefitsPackage,
  BlockerQuestion,
  ContributionRule,
  SourceRef,
} from "./booklet-types";
import { findContributionRule } from "./contribution-engine";
import {
  BENEFIT_REQUIREMENTS_REGISTRY,
  predicatePaths,
} from "./benefit-requirements";
import type {
  BenefitGateReport,
  BenefitRequirementSubject,
  FieldResolution,
  RequirementEvidence,
} from "./benefit-requirements/types";

const id = (path: string) =>
  `question_${createHash("sha1").update(path).digest("hex").slice(0, 12)}`;

const validDate = (value: string) =>
  Boolean(value) && !Number.isNaN(new Date(value).getTime());

function question(
  fieldPath: string,
  prompt: string,
  reason: string,
  sourceRefs: SourceRef[] = [],
  options?: string[],
  recommendedAnswer?: unknown,
): BlockerQuestion {
  return {
    id: id(fieldPath),
    fieldPath,
    question: prompt,
    reason,
    sourceRefs,
    options,
    recommendedAnswer,
    blocking: true,
  };
}

export function buildBlockerQuestions(
  benefitsPackage: BenefitsPackage,
): BlockerQuestion[] {
  const questions: BlockerQuestion[] = [];
  if (!benefitsPackage.employer.name)
    questions.push(
      question(
        "employer.name",
        "What employer name should appear on this booklet?",
        "No filled employer name was found. Blank application labels and template employers are not treated as factual data.",
        benefitsPackage.confidenceReport.sources,
      ),
    );
  if (!validDate(benefitsPackage.planYear.start))
    questions.push(
      question(
        "planYear.start",
        "What is the plan-year start date?",
        "A plan-year start date is required for the cover and benefit effective-period language.",
        benefitsPackage.sourceMap["planYear.start"] || [],
      ),
    );
  if (!validDate(benefitsPackage.planYear.end))
    questions.push(
      question(
        "planYear.end",
        "What is the plan-year end date?",
        "A plan-year end date is required for the cover and benefit effective-period language.",
        benefitsPackage.sourceMap["planYear.end"] || [],
      ),
    );
  if (!benefitsPackage.eligibility.waitingPeriod)
    questions.push(
      question(
        "eligibility.waitingPeriod",
        "What eligibility waiting period should employees see in the booklet?",
        "No reliable waiting period was found in the uploaded materials.",
        benefitsPackage.sourceMap["eligibility.waitingPeriod"] || [],
      ),
    );
  const offeredPlanBenefits = benefitsPackage.offeredBenefits.filter(
    (offering) =>
      offering.offered &&
      ["medical", "dental", "vision", "life", "std", "ltd"].includes(
        offering.benefitType,
      ),
  );
  const hasAnyOffering = benefitsPackage.offeredBenefits.some(
    (offering) => offering.offered,
  );
  if (
    !benefitsPackage.plans.length &&
    (!hasAnyOffering || offeredPlanBenefits.length > 0)
  )
    questions.push(
      question(
        "plans.selected",
        "Which current plans should be included in this booklet?",
        "No selected plan could be distinguished from the carrier catalog or template documents.",
        benefitsPackage.confidenceReport.sources,
      ),
    );

  for (const plan of benefitsPackage.plans) {
    if (!["medical", "dental", "vision"].includes(plan.benefitType)) continue;
    const rate = benefitsPackage.rates.find((item) => item.id === plan.ratePlanId);
    if (!rate) {
      const candidateRates = benefitsPackage.rates.filter(
        (item) => item.benefitType === plan.benefitType,
      );
      // A missing rate file is not the same thing as an ambiguous rate match.
      // The requirements engine separately asks whether employee costs are
      // provided elsewhere. Only ask users to select a row when there are
      // actual rows of the right benefit type to choose from.
      if (candidateRates.length)
        questions.push(
          question(
            `plans.${plan.id}.ratePlanId`,
            `Which uploaded rate row matches ${plan.name}?`,
            `The plan was detected, but no rate row matched confidently enough to calculate employee costs.`,
            plan.sourceRefs,
            candidateRates.slice(0, 20).map((item) => item.id),
          ),
        );
      continue;
    }
    for (const tier of rate.tiers) {
      const rule = findContributionRule(
        benefitsPackage.contributions,
        plan.benefitType,
        rate.id,
        rate.planName,
        tier.tier,
      );
      if (rule) continue;
      questions.push(
        question(
          `contributions.${plan.id}.${tier.tier}`,
          `What employer contribution should be used for ${plan.name}, ${tier.tier.replace(/_/g, " ")} coverage?`,
          "The monthly premium was found, but no percentage, flat-monthly, or flat-per-pay employer contribution was found.",
          plan.sourceRefs,
          ["percent", "flat_monthly", "flat_per_pay"],
        ),
      );
    }
  }

  for (const conflict of benefitsPackage.confidenceReport.conflicts.filter(
    (item) => item.blocking && !item.resolution,
  )) {
    questions.push(
      question(
        conflict.fieldPath,
        `Which value should be used for ${conflict.fieldPath}?`,
        conflict.description,
        conflict.values.flatMap((item) => item.sourceRefs),
        conflict.values.map((item) => String(item.value)),
        conflict.values[0]?.value,
      ),
    );
  }
  return [...new Map(questions.map((item) => [item.fieldPath, item])).values()];
}

function resolutionEvidence(resolution: FieldResolution | undefined) {
  if (!resolution) return [];
  if (
    resolution.status === "known" ||
    resolution.status === "explicit_none" ||
    resolution.status === "not_applicable" ||
    resolution.status === "not_offered" ||
    resolution.status === "requires_legal_determination"
  )
    return resolution.evidence;
  if (resolution.status === "conflicting")
    return resolution.candidates.flatMap((item) => item.evidence);
  return [];
}

function evidenceSourceRef(evidence: RequirementEvidence): SourceRef {
  const locator = evidence.locator;
  return {
    fileId: evidence.sourceFileId,
    fileName: evidence.sourceFileName || evidence.sourceFileId,
    documentType:
      evidence.authority === "manual_answer" ? "manual_answer" : "unknown",
    ...(locator?.kind === "pdf" ? { page: locator.page } : {}),
    ...(locator?.kind === "sheet"
      ? { sheet: locator.sheet, row: locator.row }
      : {}),
    ...(locator?.quote ? { textRange: locator.quote } : {}),
    extractionMethod:
      evidence.extractionMethod === "manual"
        ? "manual"
        : evidence.extractionMethod === "spreadsheet"
          ? "spreadsheet"
          : evidence.extractionMethod === "ocr"
            ? "ocr"
            : "model",
  };
}

function expectedAnswerKind(path: string, description: string) {
  if (/date|period/i.test(`${path} ${description}`)) return "date_or_period";
  if (/status|whether|yes\/no|boolean/i.test(`${path} ${description}`))
    return "boolean";
  if (/cost|rate|amount|limit|maximum|percentage|frequency/i.test(`${path} ${description}`))
    return "structured_value";
  if (/schedule|tiers|classes|options|services/i.test(`${path} ${description}`))
    return "list_or_schedule";
  return "text";
}

export function buildRequirementQuestions({
  subjects,
  reports,
}: {
  subjects: BenefitRequirementSubject[];
  reports: BenefitGateReport[];
}): BlockerQuestion[] {
  const result: BlockerQuestion[] = [];
  for (const report of reports) {
    const subject = subjects.find((item) => item.id === report.subjectId);
    if (!subject || subject.enforcementStatus !== "registry_enforced") continue;
    const definition = BENEFIT_REQUIREMENTS_REGISTRY[subject.benefitType];
    for (const issue of report.issues) {
      // Legal/compliance review is not converted into an ordinary factual
      // answer that could accidentally waive the determination.
      if (issue.code === "legal_determination_required") continue;
      const requirement = definition.fields.find(
        (field) => field.id === issue.requirementId,
      );
      if (!requirement) continue;
      let answerPath = `requirements.${subject.id}.${requirement.id}`;
      let label = requirement.label;
      let description = requirement.description;
      let sourceResolution = subject.resolutions[requirement.path];
      if (issue.code === "condition_unknown" && requirement.when) {
        const dependencyPath = predicatePaths(requirement.when).find((path) => {
          const resolution = subject.resolutions[path];
          return (
            !resolution ||
            [
              "not_found",
              "unknown",
              "conflicting",
              "requires_legal_determination",
            ].includes(resolution.status)
          );
        });
        if (dependencyPath) {
          answerPath = `requirements.${subject.id}.dependencies.${dependencyPath}`;
          label = dependencyPath;
          description = `This routing fact is needed to determine whether ${requirement.label} applies.`;
          sourceResolution = subject.resolutions[dependencyPath];
        }
      }
      const options = [
        ...(requirement.acceptedExplicitNoneReasons || []).map(
          (reasonCode) => `explicit_none:${reasonCode}`,
        ),
        ...(requirement.acceptedNotApplicableReasons || []).map(
          (reasonCode) => `not_applicable:${reasonCode}`,
        ),
      ];
      result.push({
        id: id(answerPath),
        fieldPath: answerPath,
        question: `For ${subject.displayName}, what is the ${label.toLowerCase()}?`,
        reason: `${issue.message} ${description}`,
        ...(options.length ? { options } : {}),
        sourceRefs: resolutionEvidence(sourceResolution).map(evidenceSourceRef),
        blocking: true,
        subjectId: subject.id,
        benefitType: subject.benefitType,
        requirementId: requirement.id,
        blockerCode: issue.blockerCode || `${subject.benefitType.toUpperCase()}_REQUIREMENT_UNRESOLVED`,
        expectedAnswerKind: expectedAnswerKind(requirement.path, description),
      });
    }
  }
  return [
    ...new Map(
      result.map((item) => [
        `${item.subjectId}:${item.blockerCode}:${item.fieldPath}`,
        item,
      ]),
    ).values(),
  ];
}

export function contributionAnswerToRule(
  fieldPath: string,
  answer: unknown,
  benefitsPackage: BenefitsPackage,
): ContributionRule | null {
  const match = fieldPath.match(/^contributions\.([^.]+)\.([^.]+)$/);
  if (!match || !answer || typeof answer !== "object") return null;
  const plan = benefitsPackage.plans.find((item) => item.id === match[1]);
  if (!plan) return null;
  const value = answer as Record<string, unknown>;
  if (!["percent", "flat_monthly", "flat_per_pay"].includes(String(value.mode)))
    return null;
  return {
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
        fileId: `manual:${id(fieldPath)}`,
        fileName: "User answer",
        documentType: "manual_answer",
        extractionMethod: "manual",
      },
    ],
    confidence: 1,
  };
}
