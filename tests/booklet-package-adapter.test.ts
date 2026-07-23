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

  it("preserves selected medical, dental, and vision plans when premiums are supplied separately", () => {
    const benefitsPackage = {
      employer: { name: "Big Tows Inc." },
      planYear: {
        start: "2026-03-01",
        end: "2027-02-28",
        label: "March 1, 2026 – February 28, 2027",
      },
      eligibility: { employeeClasses: [] },
      offeredBenefits: [
        { benefitType: "medical", offered: true },
        { benefitType: "dental", offered: true },
        { benefitType: "vision", offered: true },
      ],
      plans: [
        {
          id: "medical",
          benefitType: "medical",
          name: "UnitedHealthcare Freedom EPO ZD 25/50/100",
          carrier: "UnitedHealthcare",
        },
        {
          id: "dental",
          benefitType: "dental",
          name: "UnitedHealthcare Dental Options PPO 20",
          carrier: "UnitedHealthcare",
        },
        {
          id: "vision",
          benefitType: "vision",
          name: "UnitedHealthcare Vision Plan SF020",
          carrier: "UnitedHealthcare",
        },
      ],
      rates: [],
      contributions: [],
      contacts: [],
      accounts: [],
    } as unknown as BenefitsPackage;

    const company = benefitsPackageToLegacyCompany(benefitsPackage, {
      sections: [],
    }, undefined, { allowUnpricedPlans: true });

    expect(company.benefits.health.plans).toHaveLength(1);
    expect(company.benefits.dental.plans).toHaveLength(1);
    expect(company.benefits.vision.plans).toHaveLength(1);
    for (const benefit of Object.values(company.benefits)) {
      expect(benefit.plans[0]).toMatchObject({ tiers: [] });
    }
    expect(company.planDetails.carriers.medical).toEqual({
      name: "UnitedHealthcare",
    });
    expect(company.planDetails.carriers.dental).toEqual({
      name: "UnitedHealthcare",
    });
  });

  it("keeps different medical and dental carriers separate", () => {
    const benefitsPackage = {
      employer: { name: "Northstar Fabrication" },
      planYear: { start: "2026-01-01", end: "2026-12-31", label: "2026" },
      eligibility: { employeeClasses: [] },
      offeredBenefits: [
        { benefitType: "medical", offered: true },
        { benefitType: "dental", offered: true },
      ],
      plans: [
        {
          id: "medical",
          benefitType: "medical",
          name: "SimplyBlue Plus Gold 6",
          carrier: "Excellus BlueCross BlueShield",
        },
        {
          id: "dental",
          benefitType: "dental",
          name: "Delta Dental Enhanced Family PPO Plan III",
          carrier: "Delta Dental",
        },
      ],
      rates: [],
      contributions: [],
      contacts: [],
      accounts: [],
    } as unknown as BenefitsPackage;

    const company = benefitsPackageToLegacyCompany(
      benefitsPackage,
      { sections: [] },
      undefined,
      { allowUnpricedPlans: true },
    );

    expect(company.planDetails.carriers.medical).toEqual({
      name: "Excellus BlueCross BlueShield",
    });
    expect(company.planDetails.carriers.dental).toEqual({
      name: "Delta Dental",
    });
  });

  it("uses the confirmed waiting period ahead of a broader eligibility description", () => {
    const company = benefitsPackageToLegacyCompany(
      {
        employer: { name: "Big Tows Inc." },
        planYear: { start: "2026-03-01", end: "2027-02-28", label: "2026-2027" },
        eligibility: {
          waitingPeriod: "Benefits begin after two months of employment.",
          description: "Eligible dependents include spouses and children.",
          employeeClasses: [],
        },
        offeredBenefits: [],
        plans: [],
        rates: [],
        contributions: [],
        contacts: [],
        accounts: [],
      } as unknown as BenefitsPackage,
      { sections: [] },
    );

    expect(company.planDetails.eligibility.initialPeriod).toBe(
      "Benefits begin after two months of employment.",
    );
  });
});
