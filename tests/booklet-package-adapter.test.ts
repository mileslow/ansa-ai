import { describe, expect, it } from "vitest";
import { packagePayPeriods } from "../lib/booklet-package-adapter";
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
});
