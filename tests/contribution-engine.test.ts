import { describe, expect, it } from "vitest";
import {
  calculateContribution,
  findContributionRule,
} from "../lib/contribution-engine";
import type { ContributionMode, ContributionRule } from "../lib/booklet-types";

function rule(
  mode: ContributionMode,
  value: number,
  payPeriods = 26,
  overrides: Partial<ContributionRule> = {},
): ContributionRule {
  return {
    benefitType: "medical",
    planId: "plan-1",
    planName: "Plan One",
    tier: "employee",
    employeeClass: null,
    mode,
    value,
    payPeriods,
    sourceRefs: [],
    ...overrides,
  };
}

describe("contribution engine", () => {
  it.each([
    [52, 92.31],
    [26, 184.62],
    [24, 200],
    [12, 400],
  ])("calculates employee per-pay cost for %i payroll periods", (payPeriods, expected) => {
    expect(calculateContribution(1000, rule("percent", 0.6, payPeriods)).employeePerPay).toBe(
      expected,
    );
  });

  it.each([
    ["percent" as const, 50, 500],
    ["percent" as const, 0.5, 500],
    ["flat_monthly" as const, 325, 325],
    ["flat_per_pay" as const, 150, 325],
  ])("normalizes %s contributions", (mode, value, employerMonthly) => {
    expect(calculateContribution(1000, rule(mode, value)).employerMonthly).toBe(
      employerMonthly,
    );
  });

  it("caps the employer amount at the premium", () => {
    expect(calculateContribution(500, rule("flat_monthly", 700))).toMatchObject({
      employerMonthly: 500,
      employeeMonthly: 0,
    });
  });

  it("does not allow a negative employer amount", () => {
    expect(calculateContribution(500, rule("flat_monthly", -100))).toMatchObject({
      employerMonthly: 0,
      employeeMonthly: 500,
    });
  });

  it("does not allow a negative premium", () => {
    expect(calculateContribution(-500, rule("percent", 0.5))).toMatchObject({
      premiumMonthly: 0,
      totalAnnual: 0,
    });
  });

  it("keeps annual employer and employee totals arithmetically consistent", () => {
    const amounts = calculateContribution(1234.56, rule("flat_monthly", 456.78));
    expect(amounts.employerAnnual + amounts.employeeAnnual).toBeCloseTo(
      amounts.totalAnnual,
      2,
    );
  });

  it("finds a plan-specific tier rule", () => {
    const match = findContributionRule(
      [
        rule("percent", 0.5, 26, { planId: null, planName: null }),
        rule("flat_monthly", 400),
      ],
      "medical",
      "plan-1",
      "Plan One",
      "employee",
    );
    expect(match?.mode).toBe("flat_monthly");
  });

  it("falls back to a benefit-wide tier rule", () => {
    const match = findContributionRule(
      [rule("percent", 0.5, 26, { planId: null, planName: null })],
      "medical",
      "another-plan",
      "Another Plan",
      "employee",
    );
    expect(match?.value).toBe(0.5);
  });

  it("does not match a contribution for another benefit type", () => {
    const match = findContributionRule(
      [rule("percent", 0.5, 26, { benefitType: "dental" })],
      "medical",
      "plan-1",
      "Plan One",
      "employee",
    );
    expect(match).toBeUndefined();
  });
});
