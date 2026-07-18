import { describe, expect, it } from "vitest";
import { renderBookletPreviewPages } from "../lib/booklet";

const company = {
  name: "Example Company",
  description: "Example description",
  website: "https://example.com",
  planDetails: {
    employer: { cover: "Example Company" },
    planYear: { start: "2026-01-01", end: "2026-12-31" },
  },
  benefits: {
    health: {
      plans: [{ name: "Medical Plan", year: 2026, tiers: [] }],
    },
    dental: {
      uploadedPlanCount: 0,
      plans: [{ name: "Stale Dental Plan", year: 2026, tiers: [] }],
    },
  },
};

describe("booklet coverage pages", () => {
  it("includes an enrollment-weighted total in medical cost tables", () => {
    const withEnrollment = {
      ...company,
      benefits: {
        ...company.benefits,
        health: {
          plans: [
            {
              name: "Medical Plan",
              year: 2026,
              tiers: [{ tier: "EE", premium: 500, erPercent: 0.6, enrolled: 2 }],
            },
          ],
        },
      },
    };
    const medical = renderBookletPreviewPages(withEnrollment, 52).find((page) =>
      page.title.startsWith("Medical"),
    );
    expect(medical?.html).toContain("Enrollment total");
    expect(medical?.html).toContain("2 enrolled");
    expect(medical?.html).toContain("$1,000.00");
  });

  it("includes every plan when a company has multiple plans", () => {
    const withMultiplePlans = {
      ...company,
      benefits: {
        health: {
          plans: [
            { name: "Medical Choice A", year: 2026, tiers: [] },
            { name: "Medical Choice B", year: 2026, tiers: [] },
          ],
        },
        dental: {
          uploadedPlanCount: 2,
          plans: [
            { name: "Dental Choice A", year: 2026, tiers: [] },
            { name: "Dental Choice B", year: 2026, tiers: [] },
          ],
        },
        vision: {
          plans: [
            { name: "Vision Choice A", year: 2026, tiers: [] },
            { name: "Vision Choice B", year: 2026, tiers: [] },
          ],
        },
      },
    };
    const pages = renderBookletPreviewPages(withMultiplePlans, 52);
    const planPages = pages.filter((page) =>
      /^(Medical|Dental|Vision)/.test(page.title),
    );

    expect(planPages).toHaveLength(6);
    for (const planName of [
      "Medical Choice A",
      "Medical Choice B",
      "Dental Choice A",
      "Dental Choice B",
      "Vision Choice A",
      "Vision Choice B",
    ]) {
      expect(planPages.some((page) => page.html.includes(planName))).toBe(true);
    }
  });

  it("omits dental when no dental plan was uploaded", () => {
    const titles = renderBookletPreviewPages(company, 52).map((page) => page.title);
    expect(titles).not.toContain("Dental");
  });

  it("includes dental when an uploaded dental plan has rates", () => {
    const withDental = {
      ...company,
      benefits: {
        ...company.benefits,
        dental: { ...company.benefits.dental, uploadedPlanCount: 1 },
      },
    };
    const titles = renderBookletPreviewPages(withDental, 52).map((page) => page.title);
    expect(titles).toContain("Dental");
  });

  it("renders natural-language plan dates without producing Invalid Date", () => {
    const naturalDates = {
      ...company,
      planDetails: {
        ...company.planDetails,
        planYear: { start: "January 1, 2026", end: "December 31, 2026" },
      },
    };
    const cover = renderBookletPreviewPages(naturalDates, 52)[0];
    expect(cover.html).toContain("January 1, 2026 to December 31, 2026");
    expect(cover.html).not.toContain("Invalid Date");
  });

  it("injects ready grounded content and ignores blocked content", () => {
    const withGeneratedContent = {
      ...company,
      planDetails: {
        ...company.planDetails,
        generatedContent: [
          {
            id: "welcome",
            status: "ready",
            copy: "Grounded welcome copy for Example Company.",
          },
          {
            id: "eligibility",
            status: "blocked",
            copy: "This blocked copy must never render.",
          },
        ],
      },
    };
    const pages = renderBookletPreviewPages(withGeneratedContent, 52);
    expect(pages.find((page) => page.title === "Welcome")?.html).toContain(
      "Grounded welcome copy for Example Company.",
    );
    expect(pages.find((page) => page.title === "Eligibility")?.html).not.toContain(
      "This blocked copy must never render.",
    );
  });

  it("renders every supported ancillary module without placeholder copy", () => {
    const withAncillary = {
      ...company,
      planDetails: {
        ...company.planDetails,
        accounts: { type: "HSA/HRA/FSA" },
        telemedicine: { offered: true },
        coverageDetails: {
          life: { offered: true },
          shortTermDisability: { offered: true },
          longTermDisability: { offered: true },
        },
        carriers: { eap: { offered: true } },
        contacts: { voluntary: { offered: true } },
      },
    };
    const pages = renderBookletPreviewPages(withAncillary, 26);
    expect(pages.map((page) => page.title)).toEqual(
      expect.arrayContaining([
        "Telemedicine",
        "Health savings account",
        "Health reimbursement account",
        "Flexible spending account",
        "Basic life and AD&D",
        "Short term disability",
        "Long term disability",
        "Employee assistance program",
        "Voluntary benefits",
      ]),
    );
    expect(pages.map((page) => page.html).join("\n")).not.toMatch(
      /pending confirmation|not provided|placeholder/i,
    );
  });
});
