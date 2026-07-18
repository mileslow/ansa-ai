import { createHash } from "node:crypto";
import type {
  BenefitsPackage,
  BlockerQuestion,
  ContributionRule,
  SourceRef,
} from "./booklet-types";
import { findContributionRule } from "./contribution-engine";

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
  if (!benefitsPackage.plans.length)
    questions.push(
      question(
        "plans.selected",
        "Which current plans should be included in this booklet?",
        "No selected plan could be distinguished from the carrier catalog or template documents.",
        benefitsPackage.confidenceReport.sources,
      ),
    );

  for (const plan of benefitsPackage.plans) {
    const rate = benefitsPackage.rates.find((item) => item.id === plan.ratePlanId);
    if (!rate) {
      questions.push(
        question(
          `plans.${plan.id}.ratePlanId`,
          `Which uploaded rate row matches ${plan.name}?`,
          `The plan was detected, but no rate row matched confidently enough to calculate employee costs.`,
          plan.sourceRefs,
          benefitsPackage.rates
            .filter((item) => item.benefitType === plan.benefitType)
            .slice(0, 20)
            .map((item) => item.id),
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
