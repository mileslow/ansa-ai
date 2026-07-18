import { describe, expect, it } from "vitest";
import {
  renderBenefitsPackagePreviewPages,
} from "../lib/benefits-booklet-generator";
import { generateBookletOutline } from "../lib/booklet-outline";
import type {
  BenefitsPackage,
  BenefitType,
  CompanyOffering,
  SourceRef,
} from "../lib/booklet-types";
import { renderBookletPreviewPages } from "../lib/booklet";

const sourceRef: SourceRef = {
  fileId: "current-guide",
  fileName: "current-benefits-guide.pdf",
  documentType: "benefit_guide",
  page: 14,
  extractionMethod: "pdf_text",
};

const ancillarySections = [
  {
    benefitType: "life" as const,
    outlineId: "life",
    outlineTitle: "Life and AD&D",
    rendererTitle: "Basic life and AD&D",
  },
  {
    benefitType: "std" as const,
    outlineId: "std",
    outlineTitle: "Short-term disability",
    rendererTitle: "Short term disability",
  },
  {
    benefitType: "ltd" as const,
    outlineId: "ltd",
    outlineTitle: "Long-term disability",
    rendererTitle: "Long term disability",
  },
  {
    benefitType: "eap" as const,
    outlineId: "eap",
    outlineTitle: "Employee assistance program",
    rendererTitle: "Employee assistance program",
  },
  {
    benefitType: "voluntary" as const,
    outlineId: "voluntary",
    outlineTitle: "Voluntary benefits",
    rendererTitle: "Voluntary benefits",
  },
] satisfies Array<{
  benefitType: BenefitType;
  outlineId: string;
  outlineTitle: string;
  rendererTitle: string;
}>;

const forbiddenPlaceholderCopy =
  /\b(?:tbd|todo)\b|placeholder|pending confirmation|not provided|to be confirmed|example\.com|555[- )]?01/i;

function offering(
  benefitType: BenefitType,
  offered: boolean,
  overrides: Partial<CompanyOffering> = {},
): CompanyOffering {
  return {
    benefitType,
    offered,
    selectedPlans: [],
    contributionRules: [],
    contacts: [],
    sourceRefs: offered ? [sourceRef] : [],
    confidence: offered ? 0.99 : 0.95,
    ...overrides,
  };
}

function benefitsPackage(
  offeredBenefits: CompanyOffering[],
  overrides: Partial<BenefitsPackage> = {},
): BenefitsPackage {
  return {
    employer: {
      name: "Northstar Fabrication",
      legalName: "Northstar Fabrication LLC",
      website: "https://benefits.northstar.test",
    },
    planYear: {
      start: "2026-01-01",
      end: "2026-12-31",
      label: "2026",
    },
    eligibility: {
      waitingPeriod: "First of the month after 30 days",
      description: "Full-time employees are eligible first of the month after 30 days.",
      employeeClasses: ["Full-time employees"],
    },
    offeredBenefits,
    plans: [],
    rates: [],
    contributions: [],
    contacts: [],
    accounts: [],
    bookletStyle: {
      templateName: "Employee Benefits Guide",
      sectionOrder: [],
      sourceRefs: [sourceRef],
    },
    sourceMap: {
      "employer.name": [sourceRef],
      "planYear.start": [sourceRef],
      "eligibility.waitingPeriod": [sourceRef],
    },
    confidenceReport: {
      overall: 0.99,
      fields: {},
      sources: [sourceRef],
      warnings: [],
      assumptions: [],
      conflicts: [],
      manualAnswers: [],
    },
    ...overrides,
  };
}

function legacyCompany(planDetails: Record<string, unknown>) {
  return {
    name: "Northstar Fabrication",
    description: "Employee benefits guide",
    website: "https://benefits.northstar.test",
    phone: "585-555-2000",
    email: "benefits@northstar.test",
    planDetails: {
      employer: { cover: "Northstar Fabrication" },
      planYear: { start: "2026-01-01", end: "2026-12-31" },
      eligibility: { initialPeriod: "First of the month after 30 days." },
      ...planDetails,
    },
    benefits: {
      health: { uploadedPlanCount: 0, plans: [] },
      dental: { uploadedPlanCount: 0, plans: [] },
      vision: { uploadedPlanCount: 0, plans: [] },
    },
  };
}

function pageByTitle(
  pages: ReturnType<typeof renderBookletPreviewPages>,
  title: string,
) {
  const result = pages.find((page) => page.title === title);
  expect(result, `expected renderer page ${title}`).toBeDefined();
  return result!;
}

describe("ancillary booklet section scenario matrix", () => {
  it("omits every insufficient or explicitly unoffered ancillary section and keeps final sections", () => {
    const packageInput = benefitsPackage(
      ancillarySections.map(({ benefitType }) => offering(benefitType, false)),
    );
    const outline = generateBookletOutline(packageInput);
    const outlineIds = outline.sections.map((section) => section.id);

    expect(outlineIds).toEqual(
      expect.arrayContaining(["cover", "contacts", "legal"]),
    );
    expect(outlineIds).not.toEqual(
      expect.arrayContaining(ancillarySections.map((section) => section.outlineId)),
    );
    for (const { outlineId } of ancillarySections) {
      expect(outlineIds).not.toContain(outlineId);
    }

    const pages = renderBenefitsPackagePreviewPages(packageInput, outline);
    const titles = pages.map((page) => page.title);
    expect(titles).toEqual(
      expect.arrayContaining(["Contact list", "Legal disclaimer"]),
    );
    for (const { rendererTitle } of ancillarySections) {
      expect(titles).not.toContain(rendererTitle);
    }
  });

  it.each(ancillarySections)(
    "includes only the offered $outlineTitle section when optional details are missing",
    ({ benefitType, outlineId, outlineTitle, rendererTitle }) => {
      const packageInput = benefitsPackage([
        offering(benefitType, true),
        ...ancillarySections
          .filter((section) => section.benefitType !== benefitType)
          .map((section) => offering(section.benefitType, false)),
      ]);
      const outline = generateBookletOutline(packageInput);
      const selected = outline.sections.find((section) => section.id === outlineId);

      expect(selected).toMatchObject({
        id: outlineId,
        title: outlineTitle,
        benefitType,
        sourceRefs: [sourceRef],
      });
      for (const other of ancillarySections.filter(
        (section) => section.outlineId !== outlineId,
      )) {
        expect(outline.sections.map((section) => section.id)).not.toContain(
          other.outlineId,
        );
      }

      const pages = renderBenefitsPackagePreviewPages(packageInput, outline);
      const rendered = pageByTitle(pages, rendererTitle);
      expect(rendered.html).not.toMatch(forbiddenPlaceholderCopy);
      expect(rendered.html).not.toMatch(
        /Guardian|ComPsych|Colonial|\$50,000|\b60%\b|1-855-239-0743/i,
      );
      expect(rendered.html).not.toContain("undefined");
      expect(rendered.html).not.toContain("null");
    },
  );

  it("does not invent optional policy tables, carrier contacts, or representatives", () => {
    const packageInput = benefitsPackage(
      ancillarySections.map(({ benefitType }) => offering(benefitType, true)),
    );
    const outline = generateBookletOutline(packageInput);
    const pages = renderBenefitsPackagePreviewPages(packageInput, outline);

    for (const title of [
      "Basic life and AD&D",
      "Short term disability",
      "Long term disability",
    ]) {
      expect(pageByTitle(pages, title).html).not.toContain(
        '<table class="benefit-table">',
      );
    }
    expect(pageByTitle(pages, "Employee assistance program").html).not.toContain(
      '<table class="contact-table">',
    );
    expect(pageByTitle(pages, "Voluntary benefits").html).not.toContain(
      "Representative",
    );

    const ancillaryHtml = pages
      .filter((page) =>
        ancillarySections.some((section) => section.rendererTitle === page.title),
      )
      .map((page) => page.html)
      .join("\n");
    expect(ancillaryHtml).not.toMatch(forbiddenPlaceholderCopy);
    expect(ancillaryHtml).not.toMatch(
      /Guardian|ComPsych|Colonial|\$50,000|\$4,000|180 days|1-855-239-0743/i,
    );
  });
});

describe("complete ancillary and final-section rendering", () => {
  const completeCompany = legacyCompany({
    carriers: {
      lifeLtd: {
        name: "Guardian Life",
        phone: "800-541-7846",
        website: "https://www.guardiananytime.com",
      },
      eap: {
        name: "ComPsych GuidanceResources",
        phone: "855-239-0743",
        website: "https://www.guidanceresources.com",
      },
    },
    coverageDetails: {
      life: {
        benefit: "1 x annual salary",
        addBenefit: "Matches the basic life benefit",
        funding: "Employer paid",
        employeeCost: "$0",
        guaranteeIssue: "$50,000",
        ageReduction: "35% at age 65; 50% at age 70",
      },
      shortTermDisability: {
        benefitPercentage: "66 2/3% of weekly earnings",
        weeklyMaximum: "$1,500",
        eliminationPeriod: "7 days",
        maximumDuration: "26 weeks",
        funding: "Employee paid",
      },
      longTermDisability: {
        benefitPercentage: "60% of monthly earnings",
        monthlyMaximum: "$4,000",
        eliminationPeriod: "180 days",
        maximumDuration: "Social Security Normal Retirement Age",
        preExistingConditions: "3 months / 12 months",
        funding: "Employer paid",
      },
    },
    contacts: {
      hr: {
        name: "Jordan Lee",
        phone: "585-555-2200",
        email: "jordan.lee@northstar.test",
      },
      enrollment: {
        name: "Casey Morgan",
        phone: "585-555-2201",
        email: "enrollment@northstar.test",
      },
      voluntary: {
        offered: true,
        name: "Taylor Brooks",
        phone: "585-555-2202",
        email: "taylor.brooks@colonial.test",
      },
    },
  });
  const completePages = renderBookletPreviewPages(completeCompany, 26);

  it("renders source-supplied Basic Life & AD&D values", () => {
    const html = pageByTitle(completePages, "Basic life and AD&D").html;
    for (const value of [
      "Guardian Life",
      "1 x annual salary",
      "Matches the basic life benefit",
      "Employer paid",
      "$0",
      "$50,000",
      "35% at age 65; 50% at age 70",
    ]) {
      expect(html).toContain(value);
    }
    expect(html).not.toMatch(forbiddenPlaceholderCopy);
  });

  it("renders source-supplied STD and LTD variants without crossing their values", () => {
    const std = pageByTitle(completePages, "Short term disability").html;
    expect(std).toContain("66 2/3% of weekly earnings");
    expect(std).toContain("$1,500");
    expect(std).toContain("7 days");
    expect(std).toContain("26 weeks");
    expect(std).toContain("Employee paid");
    expect(std).not.toContain("$4,000");
    expect(std).not.toContain("180 days");

    const ltd = pageByTitle(completePages, "Long term disability").html;
    expect(ltd).toContain("60% of monthly earnings");
    expect(ltd).toContain("$4,000");
    expect(ltd).toContain("180 days");
    expect(ltd).toContain("Social Security Normal Retirement Age");
    expect(ltd).toContain("3 months / 12 months");
    expect(ltd).toContain("Employer paid");
    expect(ltd).not.toContain("$1,500");
    expect(ltd).not.toContain("26 weeks");
  });

  it("renders the supplied EAP and voluntary representative variants", () => {
    const eap = pageByTitle(completePages, "Employee assistance program").html;
    expect(eap).toContain("ComPsych GuidanceResources");
    expect(eap).toContain("855-239-0743");
    expect(eap).toContain("https://www.guidanceresources.com");
    expect(eap).not.toContain("Taylor Brooks");

    const voluntary = pageByTitle(completePages, "Voluntary benefits").html;
    expect(voluntary).toContain("Taylor Brooks");
    expect(voluntary).toContain("585-555-2202");
    expect(voluntary).toContain("taylor.brooks@colonial.test");
    expect(voluntary).not.toContain("ComPsych GuidanceResources");
  });

  it("renders a deduplicated contact list from real carrier, HR, enrollment, and voluntary data", () => {
    const html = pageByTitle(completePages, "Contact list").html;
    for (const value of [
      "Guardian Life",
      "800-541-7846",
      "https://www.guardiananytime.com",
      "ComPsych GuidanceResources",
      "Jordan Lee",
      "Casey Morgan",
      "Taylor Brooks",
      "https://benefits.northstar.test",
    ]) {
      expect(html).toContain(value);
    }
    expect(html.match(/Jordan Lee/g)).toHaveLength(1);
    expect(html).not.toMatch(forbiddenPlaceholderCopy);
  });

  it("always renders the legal disclaimer with plan-document precedence and employer identity", () => {
    const html = pageByTitle(completePages, "Legal disclaimer").html;
    expect(html).toContain("Legal Notices");
    expect(html).toContain("the actual plan documents will prevail");
    expect(html).toContain("Health Insurance Portability and Accountability Act of 1996");
    expect(html).toContain("Northstar Fabrication");
    expect(html).toContain("https://benefits.northstar.test");
    expect(html).not.toMatch(forbiddenPlaceholderCopy);
  });

  it("renders every ancillary and final section with no empty or fabricated values", () => {
    const requiredTitles = [
      ...ancillarySections.map((section) => section.rendererTitle),
      "Contact list",
      "Legal disclaimer",
    ];
    const selectedPages = requiredTitles.map((title) =>
      pageByTitle(completePages, title),
    );
    expect(selectedPages.every((page) => page.html.length > 500)).toBe(true);
    expect(selectedPages.map((page) => page.html).join("\n")).not.toMatch(
      forbiddenPlaceholderCopy,
    );
    expect(selectedPages.map((page) => page.html).join("\n")).not.toMatch(
      />\s*(?:undefined|null)\s*</i,
    );
  });
});

describe("partial ancillary detail variants", () => {
  it.each([
    {
      label: "life benefit only",
      title: "Basic life and AD&D",
      planDetails: {
        coverageDetails: { life: { benefit: "$25,000" } },
      },
      expected: ["Life benefit", "$25,000"],
      absent: ["Guarantee issue", "Age reduction", "Guardian Life"],
    },
    {
      label: "LTD percentage only",
      title: "Long term disability",
      planDetails: {
        coverageDetails: {
          longTermDisability: { benefitPercentage: "50% of monthly earnings" },
        },
      },
      expected: ["Benefit percentage", "50% of monthly earnings"],
      absent: ["Monthly maximum", "Elimination period", "$4,000"],
    },
    {
      label: "EAP website only",
      title: "Employee assistance program",
      planDetails: {
        carriers: {
          eap: {
            name: "SupportLinc",
            website: "https://support.northstar.test",
          },
        },
      },
      expected: ["SupportLinc", "Website", "https://support.northstar.test"],
      absent: ["Phone</th>", "855-239-0743"],
    },
    {
      label: "voluntary representative email only",
      title: "Voluntary benefits",
      planDetails: {
        contacts: {
          voluntary: {
            offered: true,
            name: "Avery Quinn",
            email: "avery.quinn@northstar.test",
          },
        },
      },
      expected: ["Avery Quinn", "avery.quinn@northstar.test"],
      absent: ["Phone</th>", "585-555-2202"],
    },
  ])(
    "renders only supplied values for the $label variant",
    ({ title, planDetails, expected, absent }) => {
      const html = pageByTitle(
        renderBookletPreviewPages(legacyCompany(planDetails), 26),
        title,
      ).html;

      for (const value of expected) expect(html).toContain(value);
      for (const value of absent) expect(html).not.toContain(value);
      expect(html).not.toMatch(forbiddenPlaceholderCopy);
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("null");
    },
  );
});
