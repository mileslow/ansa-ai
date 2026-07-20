import { describe, expect, it } from "vitest";
import { assembleBenefitsPackage } from "../lib/benefits-package-assembler";
import type { BookletDocumentExtraction } from "../lib/booklet-document-extractor";
import { generateBookletOutline } from "../lib/booklet-outline";
import type {
  BenefitType,
  CarrierRatePlan,
  ContributionRule,
  LoadedUploadedFile,
} from "../lib/booklet-types";
import { buildBlockerQuestions } from "../lib/question-engine";

const evidence = (value: string, confidence = 0.95) => ({
  value,
  page: 1,
  quote: value,
  confidence,
});

function extraction(
  overrides: Partial<BookletDocumentExtraction> = {},
): BookletDocumentExtraction {
  return {
    fileId: "application",
    fileName: "application.pdf",
    documentType: "employer_application",
    employer: {
      name: evidence("Acme Manufacturing"),
      legalName: null,
      address: null,
      website: null,
    },
    planYear: {
      start: evidence("2026-01-01"),
      end: evidence("2026-12-31"),
      label: evidence("2026"),
    },
    eligibility: {
      waitingPeriod: evidence("First of month after 30 days"),
      description: evidence("Full-time employees are eligible first of month after 30 days."),
      employeeClasses: [evidence("Full-time")],
    },
    offeredBenefits: [
      {
        benefitType: "medical",
        offered: true,
        page: 1,
        quote: "Medical",
        confidence: 0.95,
      },
    ],
    selectedPlans: [
      {
        planName: "Acme Gold 2026",
        benefitType: "medical",
        carrier: "Excellus",
        page: 1,
        quote: "Acme Gold 2026",
        confidence: 0.95,
      },
    ],
    contributions: [],
    contacts: [],
    accounts: [],
    sectionOrder: [],
    templateRole: "employer_factual",
    extractionMethod: "pdf_text",
    warnings: [],
    ...overrides,
  };
}

function rate(
  planName = "Acme Gold 2026",
  benefitType: BenefitType = "medical",
  overrides: Partial<CarrierRatePlan> = {},
): CarrierRatePlan {
  return {
    id: `rate-${benefitType}-${planName}`,
    benefitType,
    carrier: "Excellus",
    planName,
    tiers: [{ tier: "employee", monthlyPremium: 1000 }],
    sourceFile: "rates.xlsx",
    sourceFileId: "rates",
    sourceSheet: "Rates",
    sourceRow: 2,
    confidence: 0.98,
    employerSpecific: true,
    ...overrides,
  };
}

function contribution(plan: CarrierRatePlan): ContributionRule {
  return {
    benefitType: plan.benefitType,
    planId: plan.id,
    planName: plan.planName,
    tier: "employee",
    employeeClass: null,
    mode: "percent",
    value: 0.6,
    payPeriods: 26,
    sourceRefs: [],
    confidence: 0.98,
  };
}

function assemble(
  documentExtractions: BookletDocumentExtraction[] = [extraction()],
  rates: CarrierRatePlan[] = [rate()],
  contributions: ContributionRule[] = rates.map(contribution),
  manualAnswers: Record<string, unknown> = {},
) {
  return assembleBenefitsPackage({
    companyId: "acme",
    documentExtractions,
    rates,
    rateContributions: contributions,
    medicalPlans: [],
    manualAnswers,
  });
}

describe("benefits package assembler and question engine", () => {
  it("prefers a current employer application over a prior booklet for employer identity", () => {
    const prior = extraction({
      fileId: "prior",
      fileName: "prior.pdf",
      documentType: "prior_booklet",
      employer: { name: evidence("Old Employer"), legalName: null, address: null, website: null },
      templateRole: "employer_prior_context",
    });
    expect(assemble([prior, extraction()]).employer.name).toBe("Acme Manufacturing");
  });

  it("does not use master-template employer facts", () => {
    const template = extraction({
      documentType: "benefit_guide",
      templateRole: "master_template",
      employer: { name: evidence("Flower City"), legalName: null, address: null, website: null },
    });
    const result = assemble([template], [], []);
    expect(result.employer.name).toBe("");
  });

  it("detects a blocking conflict between equally authoritative waiting periods", () => {
    const second = extraction({
      fileId: "application-2",
      fileName: "application-2.pdf",
      eligibility: {
        waitingPeriod: evidence("First of month after 60 days"),
        description: null,
        employeeClasses: [],
      },
    });
    const result = assemble([extraction(), second]);
    expect(
      result.confidenceReport.conflicts.find(
        (conflict) => conflict.fieldPath === "eligibility.waitingPeriod",
      ),
    ).toMatchObject({ blocking: true, resolution: null });
  });

  it("resolves a conflict with a manual thread answer", () => {
    const second = extraction({
      fileId: "application-2",
      eligibility: {
        waitingPeriod: evidence("First of month after 60 days"),
        description: null,
        employeeClasses: [],
      },
    });
    const result = assemble(
      [extraction(), second],
      [rate()],
      [contribution(rate())],
      { "eligibility.waitingPeriod": "First of month after 45 days" },
    );
    expect(result.eligibility.waitingPeriod).toBe("First of month after 45 days");
    expect(result.confidenceReport.conflicts[0]).toMatchObject({ blocking: false });
  });

  it("matches the selected plan to the correct plan year", () => {
    const current = rate("Acme Gold 2026");
    const prior = rate("Acme Gold 2025");
    const result = assemble([extraction()], [prior, current], [contribution(current)]);
    expect(result.plans[0].ratePlanId).toBe(current.id);
  });

  it("normalizes natural-language plan-year dates for stable rendering", () => {
    const current = extraction({
      planYear: {
        start: evidence("January 1, 2026"),
        end: evidence("December 31, 2026"),
        label: evidence("2026"),
      },
    });
    expect(assemble([current]).planYear).toMatchObject({
      start: "2026-01-01",
      end: "2026-12-31",
    });
  });

  it("detects a dental plan as an offered benefit", () => {
    const dentalRate = rate("Excellus Dental 2026", "dental");
    const current = extraction({
      offeredBenefits: [
        { benefitType: "dental", offered: true, page: 1, quote: "Dental", confidence: 0.98 },
      ],
      selectedPlans: [
        {
          planName: dentalRate.planName,
          benefitType: "dental",
          carrier: "Excellus",
          page: 1,
          quote: dentalRate.planName,
          confidence: 0.98,
        },
      ],
    });
    const result = assemble([current], [dentalRate], [contribution(dentalRate)]);
    expect(result.plans[0].benefitType).toBe("dental");
    expect(result.offeredBenefits.find((item) => item.benefitType === "dental")?.offered).toBe(
      true,
    );
  });

  it("detects HRA accounts and offerings", () => {
    const current = extraction({
      offeredBenefits: [
        { benefitType: "hra", offered: true, page: 2, quote: "HRA", confidence: 0.96 },
      ],
      accounts: [{ type: "hra", administrator: "HealthEquity", page: 2, confidence: 0.96 }],
    });
    const result = assemble([current], [], []);
    expect(result.accounts).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "hra", administrator: "HealthEquity" })]),
    );
    expect(result.offeredBenefits.find((item) => item.benefitType === "hra")?.offered).toBe(
      true,
    );
    expect(buildBlockerQuestions(result).some((item) => item.fieldPath === "plans.selected")).toBe(
      false,
    );
  });

  it("does not turn an HSA account form title into a selected medical plan", () => {
    const current = extraction({
      offeredBenefits: [
        {
          benefitType: "hsa",
          offered: true,
          page: 1,
          quote: "Health Savings Account (HSA) Change in Contribution Form",
          confidence: 0.98,
        },
      ],
      selectedPlans: [
        {
          planName: "Health Savings Account (HSA)",
          benefitType: "medical",
          carrier: null,
          page: 1,
          quote: "Health Savings Account (HSA) Change in Contribution Form",
          confidence: 0.8,
        },
      ],
      accounts: [{ type: "hsa", administrator: null, page: 1, confidence: 0.98 }],
    });
    const result = assemble([current], [], []);
    expect(result.plans).toEqual([]);
    expect(result.offeredBenefits.find((item) => item.benefitType === "hsa")).toMatchObject({
      offered: true,
    });
    expect(buildBlockerQuestions(result).some((item) => item.fieldPath === "plans.selected")).toBe(
      false,
    );
  });

  it("does not infer an HSA program or block the medical booklet from plan qualification alone", () => {
    const inputFile: LoadedUploadedFile = {
      id: "sbc",
      companyId: "acme",
      fileName: "hsa-plan.pdf",
      storagePath: "hsa-plan.pdf",
      mimeType: "application/pdf",
      uploadedAt: "2026-07-17T00:00:00.000Z",
      sha256: "fixture",
      processingStatus: "uploaded",
      data: Buffer.from("pdf"),
    };
    const result = assembleBenefitsPackage({
      companyId: "acme",
      documentExtractions: [extraction()],
      rates: [rate()],
      rateContributions: [contribution(rate())],
      medicalPlans: [
        {
          file: inputFile,
          classification: {
            fileId: "sbc",
            documentType: "sbc",
            confidence: 0.98,
            reasoningSummary: "SBC",
          },
          attributes: {
            identity: {
              planName: "Acme Gold 2026",
              carrier: "Excellus",
              hsaEligible: true,
              sourcePages: [1],
            },
          } as any,
        },
      ],
    });
    expect(result.offeredBenefits.find((item) => item.benefitType === "hsa")).toBeUndefined();
    expect(
      buildBlockerQuestions(result).some(
        (question) => question.fieldPath === "offeredBenefits.hsa",
      ),
    ).toBe(false);
    expect(generateBookletOutline(result).sections.map((section) => section.id)).not.toContain(
      "hsa",
    );
  });

  it("applies a manual HSA offering decision without treating qualification as the answer", () => {
    const inputFile: LoadedUploadedFile = {
      id: "sbc-manual-hsa",
      companyId: "acme",
      fileName: "hsa-plan.pdf",
      storagePath: "hsa-plan.pdf",
      mimeType: "application/pdf",
      uploadedAt: "2026-07-17T00:00:00.000Z",
      sha256: "fixture",
      processingStatus: "uploaded",
      data: Buffer.from("pdf"),
    };
    const assembleWithAnswer = (answer: boolean) =>
      assembleBenefitsPackage({
        companyId: "acme",
        documentExtractions: [extraction()],
        rates: [rate()],
        rateContributions: [contribution(rate())],
        medicalPlans: [
          {
            file: inputFile,
            classification: {
              fileId: inputFile.id,
              documentType: "sbc",
              confidence: 0.98,
              reasoningSummary: "SBC",
            },
            attributes: {
              identity: {
                planName: "Acme Gold 2026",
                carrier: "Excellus",
                hsaEligible: true,
                sourcePages: [1],
              },
            } as any,
          },
        ],
        manualAnswers: { "offeredBenefits.hsa": answer },
      });

    const offered = assembleWithAnswer(true);
    expect(offered.offeredBenefits.find((item) => item.benefitType === "hsa")).toMatchObject({
      offered: true,
      confidence: 1,
    });
    expect(buildBlockerQuestions(offered).some((item) => item.fieldPath === "offeredBenefits.hsa")).toBe(false);

    const notOffered = assembleWithAnswer(false);
    expect(notOffered.offeredBenefits.find((item) => item.benefitType === "hsa")).toMatchObject({
      offered: false,
      confidence: 1,
    });
    expect(generateBookletOutline(notOffered).sections.map((section) => section.id)).not.toContain("hsa");
  });

  it("attaches a differently named SBC to one explicit medical selection without duplicating it", () => {
    const inputFile: LoadedUploadedFile = {
      id: "sbc-alias",
      companyId: "acme",
      fileName: "carrier-marketing-name.pdf",
      storagePath: "carrier-marketing-name.pdf",
      mimeType: "application/pdf",
      uploadedAt: "2026-07-17T00:00:00.000Z",
      sha256: "fixture",
      processingStatus: "uploaded",
      data: Buffer.from("pdf"),
    };
    const selectedRate = rate("Acme Gold 2026");
    const result = assembleBenefitsPackage({
      companyId: "acme",
      documentExtractions: [
        extraction({
          offeredBenefits: [
            {
              benefitType: "medical",
              offered: true,
              page: 1,
              quote: "Medical",
              confidence: 0.95,
            },
            {
              benefitType: "hsa",
              offered: true,
              page: 1,
              quote: "HSA",
              confidence: 0.95,
            },
          ],
        }),
      ],
      rates: [selectedRate],
      rateContributions: [contribution(selectedRate)],
      medicalPlans: [
        {
          file: inputFile,
          classification: {
            fileId: inputFile.id,
            documentType: "sbc",
            confidence: 0.98,
            reasoningSummary: "SBC",
          },
          attributes: {
            identity: {
              planName: "Carrier Choice Plus HSA",
              carrier: "UnitedHealthcare",
              hsaEligible: true,
              sourcePages: [1],
            },
            services: [{ service: "Primary care", inNetwork: "$25", sourcePages: [2] }],
          } as any,
        },
      ],
    });
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0]).toMatchObject({
      name: "Acme Gold 2026",
      ratePlanId: selectedRate.id,
    });
    expect(result.plans[0].attributes?.identity.planName).toBe("Carrier Choice Plus HSA");
    expect(buildBlockerQuestions(result)).toEqual([]);
  });

  it("infers the newest plans from employer-specific rate rows when selections are absent", () => {
    const current = extraction({ selectedPlans: [], offeredBenefits: [] });
    const result = assemble(
      [current],
      [rate("Plan A 2025"), rate("Plan A 2026")],
      [],
    );
    expect(result.plans.map((plan) => plan.name)).toEqual(["Plan A 2026"]);
    expect(result.confidenceReport.assumptions).toHaveLength(1);
  });

  it("asks for the employer name, plan year, eligibility, and selected plans when all are missing", () => {
    const empty = extraction({
      employer: { name: null, legalName: null, address: null, website: null },
      planYear: { start: null, end: null, label: null },
      eligibility: { waitingPeriod: null, description: null, employeeClasses: [] },
      offeredBenefits: [],
      selectedPlans: [],
    });
    const questions = buildBlockerQuestions(assemble([empty], [], []));
    expect(questions.map((question) => question.fieldPath)).toEqual(
      expect.arrayContaining([
        "employer.name",
        "planYear.start",
        "planYear.end",
        "eligibility.waitingPeriod",
        "plans.selected",
      ]),
    );
  });

  it("does not ask users to choose a rate row when no rate file was supplied", () => {
    const questions = buildBlockerQuestions(assemble([extraction()], [], []));
    expect(questions.some((question) => question.fieldPath.includes("ratePlanId"))).toBe(false);
  });

  it("asks for an ambiguous plan-rate match when candidate rows exist", () => {
    const questions = buildBlockerQuestions(
      assemble([extraction()], [rate("Unrelated Plan A"), rate("Unrelated Plan B")], []),
    );
    expect(questions.some((question) => question.fieldPath.includes("ratePlanId"))).toBe(true);
  });

  it("asks for a missing contribution by tier", () => {
    const questions = buildBlockerQuestions(assemble([extraction()], [rate()], []));
    expect(questions.some((question) => question.fieldPath.startsWith("contributions."))).toBe(
      true,
    );
  });

  it("asks no questions for a complete package", () => {
    expect(buildBlockerQuestions(assemble())).toEqual([]);
  });

  it("accepts a manual selected plan answer", () => {
    const emptySelection = extraction({ selectedPlans: [], offeredBenefits: [] });
    const selectedRate = rate("Manual Dental 2026", "dental");
    const result = assemble(
      [emptySelection],
      [selectedRate],
      [contribution(selectedRate)],
      {
        "plans.selected": [
          { planName: "Manual Dental 2026", benefitType: "dental", carrier: "Excellus" },
        ],
      },
    );
    expect(result.plans[0]).toMatchObject({ name: "Manual Dental 2026", benefitType: "dental" });
  });

  it("normalizes title-case email plan types and deduplicates matching extracted plans", () => {
    const source = extraction({
      selectedPlans: [
        {
          planName: "Generic Medical",
          benefitType: "medical",
          carrier: "UnitedHealthcare",
          page: 1,
          quote: "Generic Medical",
          confidence: 0.95,
        },
      ],
    });
    const result = assemble([source], [], [], {
      "plans.selected": [
        {
          planName: "UnitedHealthcare Freedom EPO ZD 25/50/100",
          benefitType: "Medical",
        },
      ],
    });

    expect(result.plans).toHaveLength(1);
    expect(result.plans[0]).toMatchObject({
      name: "UnitedHealthcare Freedom EPO ZD 25/50/100",
      benefitType: "medical",
    });
    expect(result.offeredBenefits).toHaveLength(1);
    expect(result.offeredBenefits[0].benefitType).toBe("medical");
  });

  it("includes offered dental and HRA sections while omitting unoffered vision", () => {
    const dentalRate = rate("Dental 2026", "dental");
    const current = extraction({
      offeredBenefits: [
        { benefitType: "dental", offered: true, page: 1, quote: "Dental", confidence: 0.95 },
        { benefitType: "hra", offered: true, page: 1, quote: "HRA", confidence: 0.95 },
      ],
      selectedPlans: [
        {
          planName: dentalRate.planName,
          benefitType: "dental",
          carrier: "Excellus",
          page: 1,
          quote: dentalRate.planName,
          confidence: 0.95,
        },
      ],
    });
    const result = assemble([current], [dentalRate], [contribution(dentalRate)]);
    const ids = generateBookletOutline(result).sections.map((section) => section.id);
    expect(ids).toEqual(expect.arrayContaining(["dental", "hra"]));
    expect(ids).not.toContain("vision");
  });

  it("preserves a trusted prior section order", () => {
    const current = extraction();
    const template = extraction({
      fileId: "template",
      fileName: "Flower City.pdf",
      documentType: "benefit_guide",
      templateRole: "master_template",
      sectionOrder: ["Eligibility", "Medical", "Welcome"],
    });
    const ids = generateBookletOutline(assemble([current, template])).sections.map(
      (section) => section.id,
    );
    expect(ids.indexOf("eligibility")).toBeLessThan(ids.indexOf("medical"));
    expect(ids.indexOf("medical")).toBeLessThan(ids.indexOf("welcome"));
  });
});
