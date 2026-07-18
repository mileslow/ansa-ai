import type { ContributionRule } from "./booklet-types";

export type ContributionAmounts = {
  premiumMonthly: number;
  employerMonthly: number;
  employeeMonthly: number;
  employerPerPay: number;
  employeePerPay: number;
  employerAnnual: number;
  employeeAnnual: number;
  totalAnnual: number;
};

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateContribution(
  premiumMonthly: number,
  rule: ContributionRule,
): ContributionAmounts {
  const premium = Math.max(0, Number(premiumMonthly) || 0);
  const payPeriods = Math.max(1, Number(rule.payPeriods) || 12);
  const rawEmployer =
    rule.mode === "percent"
      ? premium * (rule.value > 1 ? rule.value / 100 : rule.value)
      : rule.mode === "flat_per_pay"
        ? (Number(rule.value) * payPeriods) / 12
        : Number(rule.value);
  const employerMonthly = Math.min(premium, Math.max(0, rawEmployer || 0));
  const employeeMonthly = Math.max(0, premium - employerMonthly);
  return {
    premiumMonthly: cents(premium),
    employerMonthly: cents(employerMonthly),
    employeeMonthly: cents(employeeMonthly),
    employerPerPay: cents((employerMonthly * 12) / payPeriods),
    employeePerPay: cents((employeeMonthly * 12) / payPeriods),
    employerAnnual: cents(employerMonthly * 12),
    employeeAnnual: cents(employeeMonthly * 12),
    totalAnnual: cents(premium * 12),
  };
}

export function findContributionRule(
  rules: ContributionRule[],
  benefitType: ContributionRule["benefitType"],
  planId: string | null | undefined,
  planName: string | null | undefined,
  tier: string,
) {
  const normalizedName = String(planName || "").toLowerCase();
  return rules
    .filter((rule) => rule.benefitType === benefitType)
    .sort((a, b) => Number(Boolean(b.planId)) - Number(Boolean(a.planId)))
    .find(
      (rule) =>
        rule.tier === tier &&
        (!rule.planId || rule.planId === planId) &&
        (!rule.planName || rule.planName.toLowerCase() === normalizedName),
    );
}
