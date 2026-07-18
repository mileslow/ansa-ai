import { describe, expect, it } from "vitest";
import {
  renderBenefitsPackageHtml,
  renderBenefitsPackagePreviewPages,
} from "../lib/benefits-booklet-generator";
import { generateBookletOutline } from "../lib/booklet-outline";
import { benefitsPackageToLegacyCompany } from "../lib/booklet-package-adapter";
import { checkBookletQuality } from "../lib/booklet-quality-checker";
import { renderBookletHtml, renderBookletPreviewPages } from "../lib/booklet";
import type {
  BenefitPlan,
  BenefitType,
  BenefitsPackage,
  BlockerQuestion,
  BookletOutline,
  CarrierRatePlan,
  SourceRef,
} from "../lib/booklet-types";

const source: SourceRef = {
  fileId: "employer-source",
  fileName: "employer-application.pdf",
  documentType: "employer_application",
  page: 1,
  extractionMethod: "pdf_text",
};

const benefitPageIds: Record<
  Extract<BenefitType, "medical" | "dental" | "vision" | "telemedicine" | "hra" | "fsa">,
  string
> = {
  medical: "medical",
  dental: "dental",
  vision: "vision",
  telemedicine: "telemedicine",
  hra: "hra",
  fsa: "fsa",
};

function packageFixture(): BenefitsPackage {
  return {
    employer: {
      name: "Acme Manufacturing",
      legalName: "Acme Manufacturing LLC",
      website: "https://acme.test",
    },
    planYear: {
      start: "2026-01-01",
      end: "2026-12-31",
      label: "2026 Plan Year",
    },
    eligibility: {
      waitingPeriod: "First of the month after 30 days",
      description: "Full-time employees are eligible first of the month after 30 days.",
      employeeClasses: ["Full-time employees"],
    },
    offeredBenefits: [],
    plans: [],
    rates: [],
    contributions: [],
    contacts: [],
    accounts: [],
    bookletStyle: { sectionOrder: [], sourceRefs: [source] },
    sourceMap: {
      "employer.name": [source],
      "planYear.start": [source],
      "planYear.end": [source],
      "eligibility.waitingPeriod": [source],
    },
    confidenceReport: {
      overall: 0.95,
      fields: {},
      sources: [source],
      warnings: [],
      assumptions: [],
      conflicts: [],
      manualAnswers: [],
    },
  };
}

function offer(benefitsPackage: BenefitsPackage, benefitType: BenefitType) {
  const existing = benefitsPackage.offeredBenefits.find(
    (item) => item.benefitType === benefitType,
  );
  if (existing) {
    existing.offered = true;
    return existing;
  }
  const offering = {
    benefitType,
    offered: true,
    selectedPlans: [] as string[],
    contributionRules: [],
    contacts: [],
    sourceRefs: [source],
    confidence: 0.95,
  };
  benefitsPackage.offeredBenefits.push(offering);
  return offering;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function addPlan(
  benefitsPackage: BenefitsPackage,
  benefitType: Extract<BenefitType, "medical" | "dental" | "vision">,
  name: string,
  options: {
    withRate?: boolean;
    premium?: number;
    employerPercent?: number;
    payPeriods?: number;
    attributes?: BenefitPlan["attributes"];
  } = {},
) {
  const id = `${benefitType}-${slug(name)}`;
  const rateId = `rate-${id}`;
  const plan: BenefitPlan = {
    id,
    benefitType,
    name,
    carrier: `${benefitType} carrier`,
    year: "2026",
    ratePlanId: rateId,
    attributes: options.attributes,
    sourceRefs: [source],
    confidence: 0.95,
  };
  benefitsPackage.plans.push(plan);
  offer(benefitsPackage, benefitType).selectedPlans.push(id);
  if (options.withRate === false) return plan;

  const premium = options.premium ?? 600;
  const rate: CarrierRatePlan = {
    id: rateId,
    benefitType,
    carrier: plan.carrier,
    effectiveDate: "2026-01-01",
    planName: name,
    tiers: [
      { tier: "employee", monthlyPremium: premium, enrolled: 2 },
      { tier: "family", monthlyPremium: premium * 2.5, enrolled: 1 },
    ],
    sourceFile: "rates.xlsx",
    sourceFileId: "rates",
    sourceSheet: "Rates",
    sourceRow: 4,
    confidence: 0.95,
    employerSpecific: true,
  };
  benefitsPackage.rates.push(rate);
  for (const tier of rate.tiers) {
    benefitsPackage.contributions.push({
      benefitType,
      planId: rateId,
      planName: name,
      tier: tier.tier,
      mode: "percent",
      value: options.employerPercent ?? 0.6,
      payPeriods: options.payPeriods ?? 26,
      sourceRefs: [source],
      confidence: 0.95,
    });
  }
  return plan;
}

type PreviewPage = ReturnType<typeof renderBenefitsPackagePreviewPages>[number];

function pageId(page: PreviewPage) {
  return page.html.match(/data-page-id=["']([^"']+)["']/)?.[1] || "";
}

function pageById(pages: PreviewPage[], id: string) {
  return pages.find((page) => {
    const renderedId = pageId(page);
    return renderedId === id || renderedId.startsWith(`${id}-`);
  });
}

function pagesById(pages: PreviewPage[], id: string) {
  return pages.filter((page) => {
    const renderedId = pageId(page);
    return renderedId === id || renderedId.startsWith(`${id}-`);
  });
}

async function renderScenario(
  benefitsPackage: BenefitsPackage,
  options: {
    questions?: BlockerQuestion[];
    mutateCompany?: (company: any) => void;
  } = {},
) {
  const outline = generateBookletOutline(benefitsPackage);
  let pages: PreviewPage[];
  let html: string;
  if (options.mutateCompany) {
    const company = benefitsPackageToLegacyCompany(benefitsPackage, outline);
    options.mutateCompany(company);
    pages = renderBookletPreviewPages(company, 26);
    html = renderBookletHtml(company, 26);
  } else {
    pages = renderBenefitsPackagePreviewPages(benefitsPackage, outline);
    html = renderBenefitsPackageHtml(benefitsPackage, outline);
  }
  const quality = await checkBookletQuality({
    benefitsPackage,
    outline,
    questions: options.questions,
    html,
  });
  return { benefitsPackage, outline, pages, html, quality };
}

function expectOutline(outline: BookletOutline, id: string, included = true) {
  expect(outline.sections.some((section) => section.id === id)).toBe(included);
}

function issueCodes(result: Awaited<ReturnType<typeof renderScenario>>) {
  return result.quality.issues.map((issue) => issue.code);
}

describe("core booklet section scenarios", () => {
  it.each([
    ["cover", "cover"],
    ["welcome", "welcome"],
    ["enrollment", "open-enrollment"],
    ["eligibility", "eligibility"],
  ])("always outlines and renders the %s section", async (outlineId, renderedId) => {
    const result = await renderScenario(packageFixture());
    expectOutline(result.outline, outlineId);
    expect(pageById(result.pages, renderedId)).toBeDefined();
    expect(result.html).toContain(`data-page-id="${renderedId}"`);
    expect(result.quality.passed).toBe(true);
  });

  it("outlines and renders a table of contents for the core sections", async () => {
    const result = await renderScenario(packageFixture());
    expectOutline(result.outline, "toc");
    const toc = pageById(result.pages, "toc");
    expect(toc?.html).toContain("Table of Contents");
    expect(toc?.html).toContain("Welcome");
    expect(toc?.html).toContain("Open enrollment");
    expect(toc?.html).not.toContain("Medical Plan");
    expect(result.quality.passed).toBe(true);
  });

  it("flags an incomplete cover with missing dates and source provenance", async () => {
    const benefitsPackage = packageFixture();
    benefitsPackage.planYear.start = "";
    benefitsPackage.planYear.end = "";
    benefitsPackage.sourceMap["planYear.start"] = [];
    benefitsPackage.sourceMap["planYear.end"] = [];
    const result = await renderScenario(benefitsPackage);
    expect(pageById(result.pages, "cover")?.html).toContain("2026 Plan Year");
    expect(issueCodes(result)).toContain("missing_source");
    expect(result.quality.passed).toBe(false);
  });

  it("renders a complete cover with the employer and normalized plan-year dates", async () => {
    const result = await renderScenario(packageFixture());
    const cover = pageById(result.pages, "cover")?.html || "";
    expect(cover).toContain("Acme Manufacturing");
    expect(cover).toContain("January 1, 2026 to December 31, 2026");
    expect(cover).not.toMatch(/not set|placeholder/i);
    expect(result.quality.passed).toBe(true);
  });

  it("expands the table of contents for multiple plans and offered account modules", async () => {
    const benefitsPackage = packageFixture();
    addPlan(benefitsPackage, "medical", "Medical Choice Alpha");
    addPlan(benefitsPackage, "medical", "Medical Choice Beta", { premium: 750 });
    addPlan(benefitsPackage, "dental", "Dental Choice");
    addPlan(benefitsPackage, "vision", "Vision Choice");
    for (const type of ["telemedicine", "hra", "fsa"] as const) offer(benefitsPackage, type);
    benefitsPackage.accounts.push({
      type: "hra",
      administrator: "Benefit Accounts Inc",
      sourceRefs: [source],
    });
    const result = await renderScenario(benefitsPackage);
    const toc = pageById(result.pages, "toc")?.html || "";
    for (const label of [
      "Medical - Medical Choice Alpha",
      "Medical - Medical Choice Beta",
      "Dental",
      "Vision",
      "Telemedicine",
      "Health reimbursement account",
      "Flexible spending account",
    ]) {
      expect(toc).toContain(label);
    }
    expect(result.quality.passed).toBe(true);
  });

  it("uses safe generic welcome copy when optional company narrative is missing", async () => {
    const benefitsPackage = packageFixture();
    benefitsPackage.eligibility.description = null;
    const result = await renderScenario(benefitsPackage);
    const welcome = pageById(result.pages, "welcome")?.html || "";
    expect(welcome).toContain("Acme Manufacturing's goal");
    expect(welcome).toContain("not a complete Summary Plan Description");
    expect(welcome).not.toMatch(/placeholder|lorem ipsum/i);
    expect(result.quality.passed).toBe(true);
  });

  it("omits optional open-enrollment detail blocks when no schedule is supplied", async () => {
    const result = await renderScenario(packageFixture());
    const enrollment = pageById(result.pages, "open-enrollment")?.html || "";
    expect(enrollment).toContain("How to enroll");
    expect(enrollment).toContain("Human Resources");
    expect(enrollment).not.toContain('<div class="date-row">');
    expect(enrollment).not.toContain("What&#39;s new");
    expect(result.quality.passed).toBe(true);
  });

  it("renders complete open-enrollment dates, meeting, changes, and contact details", async () => {
    const result = await renderScenario(packageFixture(), {
      mutateCompany(company) {
        company.planDetails.enrollment = {
          start: "2025-11-03",
          end: "2025-11-14",
          meeting: "November 4 at 10:00 AM in the training room",
          whatsNew: ["New medical carrier", "Lower virtual-care copay"],
        };
        company.planDetails.contacts.enrollment = { name: "Riley Benefits" };
      },
    });
    const enrollment = pageById(result.pages, "open-enrollment")?.html || "";
    expect(enrollment).toContain("November 3, 2025 - November 14, 2025");
    expect(enrollment).toContain("November 4 at 10:00 AM in the training room");
    expect(enrollment).toContain("New medical carrier");
    expect(enrollment).toContain("Lower virtual-care copay");
    expect(enrollment).toContain("Riley Benefits");
    expect(result.quality.passed).toBe(true);
  });

  it("filters placeholder enrollment variants while preserving real changes", async () => {
    const result = await renderScenario(packageFixture(), {
      mutateCompany(company) {
        company.planDetails.enrollment = {
          whatsNew: [
            "Placeholder: confirm the carrier",
            "Dental premiums changed",
            "Vision coverage added",
          ],
        };
      },
    });
    const enrollment = pageById(result.pages, "open-enrollment")?.html || "";
    expect(enrollment).not.toContain("confirm the carrier");
    expect(enrollment).toContain("1. Dental premiums changed");
    expect(enrollment).toContain("2. Vision coverage added");
    expect(result.quality.passed).toBe(true);
  });

  it("renders generic eligibility copy but remains blocked when the missing rule has a question", async () => {
    const benefitsPackage = packageFixture();
    benefitsPackage.eligibility.waitingPeriod = null;
    benefitsPackage.eligibility.description = null;
    benefitsPackage.sourceMap["eligibility.waitingPeriod"] = [];
    const blocker: BlockerQuestion = {
      id: "eligibility-question",
      fieldPath: "eligibility.waitingPeriod",
      question: "When are new employees eligible?",
      reason: "The waiting period is required for accurate enrollment guidance.",
      sourceRefs: [],
      blocking: true,
    };
    const result = await renderScenario(benefitsPackage, { questions: [blocker] });
    const eligibility = pageById(result.pages, "eligibility")?.html || "";
    expect(eligibility).toContain("ends 30 days from that date");
    expect(issueCodes(result)).toContain("unresolved_questions");
    expect(result.quality.passed).toBe(false);
  });

  it.each([
    "Date of hire",
    "First of the month following 30 days",
    "First of the month following 60 days",
  ])("renders the supplied eligibility variant: %s", async (waitingPeriod) => {
    const benefitsPackage = packageFixture();
    benefitsPackage.eligibility.waitingPeriod = waitingPeriod;
    benefitsPackage.eligibility.description = waitingPeriod;
    const result = await renderScenario(benefitsPackage);
    expect(pageById(result.pages, "eligibility")?.html).toContain(waitingPeriod);
    expect(result.quality.passed).toBe(true);
  });

  it.each(["cover", "toc", "welcome", "eligibility", "enrollment"])(
    "quality rejects an outline missing required core section %s",
    async (sectionId) => {
      const benefitsPackage = packageFixture();
      const complete = await renderScenario(benefitsPackage);
      const incompleteOutline = {
        sections: complete.outline.sections.filter((section) => section.id !== sectionId),
      };
      const quality = await checkBookletQuality({
        benefitsPackage,
        outline: incompleteOutline,
        html: complete.html,
      });
      expect(quality.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "missing_section" })]),
      );
      expect(quality.passed).toBe(false);
    },
  );
});

describe("dynamic section no-offering and partial-detail matrix", () => {
  it.each(["medical", "telemedicine", "hra", "fsa", "dental", "vision"] as const)(
    "omits %s from outline and rendered output when it is not offered",
    async (benefitType) => {
      const result = await renderScenario(packageFixture());
      expectOutline(result.outline, benefitType, false);
      expect(pagesById(result.pages, benefitPageIds[benefitType])).toHaveLength(0);
      expect(result.quality.passed).toBe(true);
    },
  );

  it.each(["medical", "dental", "vision"] as const)(
    "flags an offered %s plan that has no matching rate data",
    async (benefitType) => {
      const benefitsPackage = packageFixture();
      addPlan(benefitsPackage, benefitType, `${benefitType} incomplete`, {
        withRate: false,
      });
      const result = await renderScenario(benefitsPackage);
      expectOutline(result.outline, benefitType);
      expect(pagesById(result.pages, benefitType)).toHaveLength(0);
      expect(issueCodes(result)).toEqual(
        expect.arrayContaining(["missing_plan", "missing_rendered_section"]),
      );
      expect(result.quality.passed).toBe(false);
    },
  );

  it.each([
    ["telemedicine", "Common conditions treated", "Contact"],
    ["hra", "employer-funded account", "Employer contribution"],
    ["fsa", "pre-tax payroll deductions", "Benefit Accounts Inc"],
  ] as const)(
    "renders a safe partial %s section when optional details are absent",
    async (benefitType, genericCopy, optionalDetail) => {
      const benefitsPackage = packageFixture();
      offer(benefitsPackage, benefitType);
      const result = await renderScenario(benefitsPackage);
      expectOutline(result.outline, benefitType);
      const section = pageById(result.pages, benefitType)?.html || "";
      expect(section).toContain(genericCopy);
      expect(section).not.toContain(optionalDetail);
      expect(result.quality.passed).toBe(true);
    },
  );
});

describe("complete medical, dental, and vision plan scenarios", () => {
  it("renders medical costs, plan attributes, provenance-backed outline, and clean quality", async () => {
    const benefitsPackage = packageFixture();
    addPlan(benefitsPackage, "medical", "Acme Gold Medical", {
      premium: 600,
      employerPercent: 0.6,
      payPeriods: 26,
      attributes: {
        identity: { carrier: "Acme Health" },
        financial: {
          deductible: { raw: "$2,000 individual / $4,000 family" },
          outOfPocketLimit: { raw: "$6,000 individual / $12,000 family" },
        },
        services: [
          {
            medicalEvent: "Office visit",
            service: "Primary care visit",
            inNetwork: [{ cost: "$25 copay" }],
          },
        ],
        prescriptions: { tiers: [{ name: "Generic", retailCost: "$10 copay" }] },
      } as any,
    });
    const result = await renderScenario(benefitsPackage);
    const medical = pageById(result.pages, "medical")?.html || "";
    expectOutline(result.outline, "medical");
    expect(result.outline.sections.find((section) => section.id === "medical")?.sourceRefs).toEqual([
      source,
    ]);
    expect(medical).toContain("Acme Gold Medical");
    expect(medical).toContain("$600.00");
    expect(medical).toContain("$360.00");
    expect(medical).toContain("$240.00");
    expect(medical).toContain("$110.77");
    expect(medical).toContain("Plan highlights");
    expect(medical).toContain("$2,000 individual / $4,000 family");
    expect(medical).toContain("$25 copay");
    expect(result.quality.passed).toBe(true);
  });

  it.each([
    ["dental", "Acme Dental PPO", "Dental Plan"],
    ["vision", "Acme Vision Plus", "Vision Plan"],
  ] as const)(
    "renders a complete %s plan with premium and contribution values",
    async (benefitType, name, heading) => {
      const benefitsPackage = packageFixture();
      addPlan(benefitsPackage, benefitType, name, {
        premium: 50,
        employerPercent: 0.5,
        payPeriods: 26,
      });
      const result = await renderScenario(benefitsPackage);
      const section = pageById(result.pages, benefitType)?.html || "";
      expectOutline(result.outline, benefitType);
      expect(section).toContain(heading);
      expect(section).toContain(name);
      expect(section).toContain("$50.00");
      expect(section).toContain("$25.00");
      expect(section).toContain("$11.54");
      expect(result.quality.passed).toBe(true);
    },
  );

  it.each(["medical", "dental", "vision"] as const)(
    "renders every selected %s plan as its own page",
    async (benefitType) => {
      const benefitsPackage = packageFixture();
      const first = `${benefitType} Choice One`;
      const second = `${benefitType} Choice Two`;
      addPlan(benefitsPackage, benefitType, first, { premium: 400 });
      addPlan(benefitsPackage, benefitType, second, { premium: 700 });
      const result = await renderScenario(benefitsPackage);
      const planPages = pagesById(result.pages, benefitType);
      expect(planPages).toHaveLength(2);
      expect(planPages.some((page) => page.html.includes(first))).toBe(true);
      expect(planPages.some((page) => page.html.includes(second))).toBe(true);
      expect(result.html).toContain(first);
      expect(result.html).toContain(second);
      expect(result.quality.passed).toBe(true);
    },
  );
});

describe("complete telemedicine, HRA, and FSA variants", () => {
  it("renders every available telemedicine access method", async () => {
    const benefitsPackage = packageFixture();
    offer(benefitsPackage, "telemedicine");
    const result = await renderScenario(benefitsPackage, {
      mutateCompany(company) {
        company.planDetails.telemedicine = {
          app: "Acme Virtual Care",
          phone: "800-555-2200",
          text: "Text CARE to 2200",
          website: "https://care.acme.test",
        };
      },
    });
    const section = pageById(result.pages, "telemedicine")?.html || "";
    for (const value of [
      "Acme Virtual Care",
      "800-555-2200",
      "Text CARE to 2200",
      "https://care.acme.test",
    ]) {
      expect(section).toContain(value);
    }
    expect(section).toContain("Contact");
    expect(result.quality.passed).toBe(true);
  });

  it("renders a complete HRA administrator and multiple tier contributions", async () => {
    const benefitsPackage = packageFixture();
    offer(benefitsPackage, "hra");
    benefitsPackage.accounts.push({
      type: "hra",
      administrator: "Benefit Accounts Inc",
      sourceRefs: [source],
    });
    const result = await renderScenario(benefitsPackage, {
      mutateCompany(company) {
        company.planDetails.accounts.hraContributions = [
          { tier: "Employee only", amount: 750 },
          { tier: "Employee + family", amount: 1500 },
        ];
      },
    });
    const section = pageById(result.pages, "hra")?.html || "";
    expect(section).toContain("Benefit Accounts Inc");
    expect(section).toContain("Employee only");
    expect(section).toContain("$750.00");
    expect(section).toContain("Employee + family");
    expect(section).toContain("$1,500.00");
    expect(result.quality.passed).toBe(true);
  });

  it("renders a complete FSA administrator without pending copy", async () => {
    const benefitsPackage = packageFixture();
    offer(benefitsPackage, "fsa");
    benefitsPackage.accounts.push({
      type: "fsa",
      administrator: "Flex Account Services",
      sourceRefs: [source],
    });
    const result = await renderScenario(benefitsPackage);
    const section = pageById(result.pages, "fsa")?.html || "";
    expect(section).toContain("Flex Account Services");
    expect(section).toContain("Medical FSA");
    expect(section).toContain("Dependent care FSA");
    expect(section).not.toMatch(/\bpending\b|\bplaceholder\b/i);
    expect(result.quality.passed).toBe(true);
  });

  it("renders HRA and FSA as distinct pages when both account variants are offered", async () => {
    const benefitsPackage = packageFixture();
    offer(benefitsPackage, "hra");
    offer(benefitsPackage, "fsa");
    benefitsPackage.accounts.push(
      { type: "hra", administrator: "Combined Benefits", sourceRefs: [source] },
      { type: "fsa", administrator: "Combined Benefits", sourceRefs: [source] },
    );
    const result = await renderScenario(benefitsPackage);
    expectOutline(result.outline, "hra");
    expectOutline(result.outline, "fsa");
    expect(pagesById(result.pages, "hra")).toHaveLength(1);
    expect(pagesById(result.pages, "fsa")).toHaveLength(1);
    expect(pageById(result.pages, "toc")?.html).toContain("Health reimbursement account");
    expect(pageById(result.pages, "toc")?.html).toContain("Flexible spending account");
    expect(result.quality.passed).toBe(true);
  });
});
