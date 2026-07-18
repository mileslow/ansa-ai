import { describe, expect, it } from "vitest";
import {
  BOOKLET_CONTENT_SECTION_IDS,
  generateBookletContent,
  type BookletContentResult,
  type BookletContentSectionId,
  type BookletContentSectionStatus,
} from "../lib/booklet-content-agent";
import { generateBookletOutline } from "../lib/booklet-outline";
import type {
  BenefitPlan,
  BenefitType,
  BenefitsPackage,
  CarrierRatePlan,
  CompanyOffering,
  Contact,
  ContributionRule,
  SourceRef,
} from "../lib/booklet-types";

const live =
  process.env.RUN_LIVE_BOOKLET_CONTENT_TESTS === "1" &&
  Boolean(process.env.OPENAI_API_KEY);

const source: SourceRef = {
  fileId: "live-section-scenario",
  fileName: "live-section-scenario.json",
  documentType: "manual_answer",
  extractionMethod: "manual",
};

const benefitSections = [
  "medical",
  "telemedicine",
  "hra",
  "fsa",
  "dental",
  "vision",
  "life",
  "ltd",
  "eap",
  "voluntary",
] as const;

function offering(
  benefitType: BenefitType,
  selectedPlans: string[] = [],
): CompanyOffering {
  return {
    benefitType,
    offered: true,
    selectedPlans,
    contributionRules: [],
    contacts: [],
    sourceRefs: [source],
    confidence: 0.99,
  };
}

function plan(
  id: string,
  benefitType: BenefitType,
  name: string,
  carrier: string,
  attributes: BenefitPlan["attributes"] = null,
): BenefitPlan {
  return {
    id,
    benefitType,
    name,
    carrier,
    year: "2026",
    ratePlanId: `rate-${id}`,
    attributes,
    sourceRefs: [source],
    confidence: 0.99,
  };
}

function rate(input: BenefitPlan, premium: number): CarrierRatePlan {
  return {
    id: `rate-${input.id}`,
    benefitType: input.benefitType,
    carrier: input.carrier,
    effectiveDate: "2026-01-01",
    planName: input.name,
    tiers: [
      { tier: "employee", monthlyPremium: premium },
      { tier: "family", monthlyPremium: premium * 2.4 },
    ],
    sourceFile: source.fileName,
    sourceFileId: source.fileId,
    sourceSheet: "Rates",
    sourceRow: 2,
    confidence: 0.99,
    employerSpecific: true,
  };
}

function contribution(input: BenefitPlan): ContributionRule {
  return {
    benefitType: input.benefitType,
    planId: `rate-${input.id}`,
    planName: input.name,
    tier: "employee",
    employeeClass: null,
    mode: "percent",
    value: 0.6,
    payPeriods: 26,
    sourceRefs: [source],
    confidence: 0.99,
  };
}

function basePackage(): BenefitsPackage {
  return {
    employer: { name: "" },
    planYear: { start: "", end: "", label: "" },
    eligibility: { waitingPeriod: null, description: null, employeeClasses: [] },
    offeredBenefits: [],
    plans: [],
    rates: [],
    contributions: [],
    contacts: [],
    accounts: [],
    bookletStyle: { sectionOrder: [], sourceRefs: [] },
    sourceMap: {},
    confidenceReport: {
      overall: 0,
      fields: {},
      sources: [],
      warnings: [],
      assumptions: [],
      conflicts: [],
      manualAnswers: [],
    },
  };
}

function partialPackage(): BenefitsPackage {
  return {
    ...basePackage(),
    employer: { name: "Summit Works LLC" },
    planYear: { start: "2026-01-01", end: "2026-12-31", label: "2026" },
    offeredBenefits: benefitSections.map((type) => offering(type)),
    sourceMap: {
      "employer.name": [source],
      "planYear.start": [source],
      "planYear.end": [source],
    },
  };
}

const medicalAttributes = {
  identity: {
    planName: "Summit Gold PPO",
    carrier: "Northlake Health",
    coverageStart: "2026-01-01",
    hsaEligible: false,
    sourcePages: [1],
  },
  financial: {
    deductible: { raw: "$1,500 individual / $3,000 family" },
    outOfPocketLimit: { raw: "$6,000 individual / $12,000 family" },
  },
  network: { type: "PPO", name: "Northlake Choice" },
  services: [
    {
      medicalEvent: "Primary care visit",
      service: "Primary care visit",
      inNetwork: [{ cost: "$30 copay" }],
      sourcePages: [2],
    },
    {
      medicalEvent: "Emergency room",
      service: "Emergency room",
      inNetwork: [{ cost: "$350 copay" }],
      sourcePages: [3],
    },
  ],
  prescriptions: { tiers: [{ name: "Generic", retailCost: "$15 copay" }] },
  legal: {
    disclaimer:
      "If this guide conflicts with the official plan documents, the official plan documents control.",
  },
  notices: [
    {
      title: "Official plan documents",
      text: "Review the carrier certificate for exclusions and limitations.",
      sourcePages: [6],
    },
  ],
} as any;

function completePackage(multiple = false): BenefitsPackage {
  const medical = plan(
    "medical-gold",
    "medical",
    "Summit Gold PPO",
    "Northlake Health",
    medicalAttributes,
  );
  const dental = plan(
    "dental-ppo",
    "dental",
    "BrightSmile Dental PPO",
    "BrightSmile",
  );
  const vision = plan(
    "vision-standard",
    "vision",
    "ClearView Vision",
    "ClearView",
  );
  const life = plan(
    "life-basic",
    "life",
    "Employer Basic Life and AD&D",
    "Guardian Life",
  );
  const ltd = plan(
    "ltd-core",
    "ltd",
    "Core Long-Term Disability",
    "Guardian Life",
  );
  const plans = [medical, dental, vision, life, ltd];
  if (multiple) {
    plans.push(
      plan(
        "medical-silver",
        "medical",
        "Summit Silver HSA",
        "Northlake Health",
        {
          ...medicalAttributes,
          identity: {
            ...medicalAttributes.identity,
            planName: "Summit Silver HSA",
            hsaEligible: true,
          },
        } as any,
      ),
      plan("dental-dhmo", "dental", "BrightSmile Dental DHMO", "BrightSmile"),
      plan("vision-plus", "vision", "ClearView Vision Plus", "ClearView"),
    );
  }
  const contacts: Contact[] = [
    {
      role: "Human Resources and enrollment",
      name: "Jordan Lee",
      phone: "585-555-2200",
      email: "benefits@summitworks.test",
      sourceRefs: [source],
    },
    {
      role: "Telemedicine support",
      organization: "Northlake Virtual Care",
      phone: "800-555-1414",
      website: "https://virtual.summitworks.test",
      sourceRefs: [source],
    },
    {
      role: "Life and AD&D carrier",
      organization: "Guardian Life",
      phone: "800-555-2424",
      sourceRefs: [source],
    },
    {
      role: "LTD disability carrier",
      organization: "Guardian Life",
      phone: "800-555-2424",
      sourceRefs: [source],
    },
    {
      role: "EAP",
      organization: "Guidance Support",
      phone: "800-555-3434",
      sourceRefs: [source],
    },
    {
      role: "Voluntary benefits",
      name: "Taylor Brooks",
      email: "voluntary@summitworks.test",
      sourceRefs: [source],
    },
  ];
  const offeredBenefits = benefitSections.map((type) =>
    offering(
      type,
      plans.filter((item) => item.benefitType === type).map((item) => item.id),
    ),
  );
  const rated = plans.filter((item) =>
    ["medical", "dental", "vision"].includes(item.benefitType),
  );
  return {
    ...basePackage(),
    employer: {
      name: "Summit Works LLC",
      legalName: "Summit Works Manufacturing LLC",
      website: "https://benefits.summitworks.test",
    },
    planYear: { start: "2026-01-01", end: "2026-12-31", label: "2026" },
    eligibility: {
      waitingPeriod: "First of the month after 30 days",
      description: "Full-time employees are eligible first of the month after 30 days.",
      employeeClasses: ["Full-time employees"],
    },
    offeredBenefits,
    plans,
    rates: rated.map((item, index) => rate(item, 60 + index * 300)),
    contributions: rated.map(contribution),
    contacts,
    accounts: [
      { type: "hra", administrator: "HealthEquity", sourceRefs: [source] },
      { type: "fsa", administrator: "HealthEquity", sourceRefs: [source] },
    ],
    sourceMap: {
      "employer.name": [source],
      "planYear.start": [source],
      "planYear.end": [source],
      "eligibility.waitingPeriod": [source],
    },
    confidenceReport: {
      overall: 0.99,
      fields: {},
      sources: [source],
      warnings: [],
      assumptions: [],
      conflicts: [],
      manualAnswers: [],
    },
  };
}

type Scenario = "insufficient" | "partial" | "complete" | "multiple";

const scenarioInput: Record<
  Scenario,
  { benefitsPackage: BenefitsPackage; variant: string }
> = {
  insufficient: {
    benefitsPackage: basePackage(),
    variant: "plain-language diagnostic",
  },
  partial: {
    benefitsPackage: partialPackage(),
    variant: "plain-language partial-evidence diagnostic",
  },
  complete: {
    benefitsPackage: completePackage(),
    variant: "employee-friendly standard",
  },
  multiple: {
    benefitsPackage: completePackage(true),
    variant: "comparison-focused; name every medical, dental, and vision plan",
  },
};

const cache = new Map<Scenario, Promise<BookletContentResult>>();
function resultFor(scenario: Scenario) {
  let pending = cache.get(scenario);
  if (!pending) {
    const input = scenarioInput[scenario];
    pending = generateBookletContent(
      input.benefitsPackage,
      generateBookletOutline(input.benefitsPackage),
      input.variant,
      { apiKey: process.env.OPENAI_API_KEY },
    );
    cache.set(scenario, pending);
  }
  return pending;
}

function expectedStatus(
  scenario: Scenario,
  id: BookletContentSectionId,
): BookletContentSectionStatus {
  if (scenario === "complete" || scenario === "multiple") return "ready";
  if (scenario === "insufficient") {
    if (id === "toc") return "ready";
    if (benefitSections.includes(id as (typeof benefitSections)[number]))
      return "omitted";
    return "blocked";
  }
  if (
    [
      "enrollment",
      "eligibility",
      "medical",
      "dental",
      "vision",
      "contacts",
      "legal",
    ].includes(id)
  )
    return "blocked";
  return "ready";
}

function assertSectionResult(
  section: BookletContentResult["sections"][number],
  status: BookletContentSectionStatus,
) {
  expect(section.status).toBe(status);
  if (status === "ready") {
    expect(section.copy.length).toBeGreaterThan(5);
    expect(section.sourcePaths.length).toBeGreaterThan(0);
    expect(section.copy).not.toMatch(
      /placeholder|pending confirmation|to be confirmed|not provided|tbd|todo|lorem ipsum/i,
    );
  } else {
    expect(section.copy).toBe("");
    if (status === "blocked")
      expect(section.missingFields.length).toBeGreaterThan(0);
    if (status === "omitted") expect(section.sourcePaths).toEqual([]);
  }
}

describe.skipIf(!live)("live LLM booklet section scenario matrix", () => {
  for (const scenario of [
    "insufficient",
    "partial",
    "complete",
    "multiple",
  ] as const) {
    describe(`${scenario} evidence`, () => {
      it.each(BOOKLET_CONTENT_SECTION_IDS)(
        `generates a grounded ${scenario} result for %s`,
        async (id) => {
          const result = await resultFor(scenario);
          expect(result.sections).toHaveLength(BOOKLET_CONTENT_SECTION_IDS.length);
          const section = result.sections.find((item) => item.id === id)!;
          assertSectionResult(section, expectedStatus(scenario, id));
          if (
            scenario === "multiple" &&
            ["medical", "dental", "vision"].includes(id)
          ) {
            const planNames = scenarioInput.multiple.benefitsPackage.plans
              .filter((item) => item.benefitType === id)
              .map((item) => item.name);
            for (const name of planNames) expect(section.copy).toContain(name);
          }
        },
        300_000,
      );
    });
  }
});
