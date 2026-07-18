import { describe, expect, it } from "vitest";
import {
  benefitsPackageToLegacyCompany,
  packagePayPeriods,
} from "../lib/booklet-package-adapter";
import type { BenefitsPackage } from "../lib/booklet-types";

describe("benefits package rendering adapter", () => {
  it("uses the active plan's spreadsheet payroll basis over a model default", () => {
    const benefitsPackage = {
      plans: [{ ratePlanId: "active-medical" }],
      contributions: [
        {
          planId: "active-medical",
          payPeriods: 52,
          sourceRefs: [{ extractionMethod: "model" }],
        },
        {
          planId: "active-medical",
          payPeriods: 26,
          sourceRefs: [{ extractionMethod: "spreadsheet" }],
        },
        {
          planId: "inactive-plan",
          payPeriods: 24,
          sourceRefs: [{ extractionMethod: "spreadsheet" }],
        },
      ],
    } as unknown as BenefitsPackage;

    expect(packagePayPeriods(benefitsPackage)).toBe(26);
  });

  it("preserves ancillary plan identity and carrier without requiring a rate row", () => {
    const benefitsPackage = {
      employer: { name: "Yale University" },
      planYear: { start: "2026-01-01", end: "2026-12-31", label: "2026" },
      eligibility: { employeeClasses: [] },
      offeredBenefits: [{ benefitType: "std", offered: true }],
      plans: [
        {
          id: "yale-std",
          benefitType: "std",
          name: "Salary Continuation Program",
          carrier: "Hartford Life and Accident Insurance Company",
        },
      ],
      rates: [],
      contributions: [],
      contacts: [],
      accounts: [],
    } as unknown as BenefitsPackage;

    const company = benefitsPackageToLegacyCompany(benefitsPackage, {
      sections: [{ id: "std", title: "Short-term disability", benefitType: "std", sourceRefs: [] }],
    });
    expect(company.planDetails.carriers.lifeLtd).toEqual({
      name: "Hartford Life and Accident Insurance Company",
    });
    expect(company.planDetails.coverageDetails.shortTermDisability).toMatchObject({
      offered: true,
      planName: "Salary Continuation Program",
    });
  });
});
