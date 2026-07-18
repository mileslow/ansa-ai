import { describe, expect, it, vi } from "vitest";
import { extractMedicalPlan, type PlanPatch } from "../lib/plan-extractor";

const identity = {
  identity: { documentType: "Summary of Benefits and Coverage", carrier: "Example Health", planName: "Example Bronze", planId: "EX-1", groupName: null, coverageStart: "2026-01-01", coverageEnd: "2026-12-31", coverageFor: "Employee/Family", planType: "EPO", networkName: "Example Network", market: "group", state: "NY", fundingType: null, metalTier: "Bronze", hsaEligible: true, sourcePages: [1] },
  financial: {
    deductible: { individual: "$6,500", family: "$13,000", embeddedIndividual: null, period: "calendar year", raw: "$6,500 Individual / $13,000 Family per calendar year" },
    familyDeductibleRule: "Each member meets an individual deductible.", servicesBeforeDeductible: ["Preventive care"], servicesBeforeDeductibleNotes: null, specificDeductibles: [], specificDeductiblesStatus: "explicit_none",
    outOfPocketLimit: { individual: "$8,000", family: "$16,000", embeddedIndividual: null, period: "calendar year", raw: "$8,000 Individual / $16,000 Family" },
    familyOutOfPocketRule: null, excludedFromOutOfPocket: ["Premiums"], sourcePages: [1],
  },
  network: { usesProviderNetwork: true, outOfNetworkCoverage: "Not covered except emergency care", referralRequired: false, referralNotes: null, balanceBillingWarning: "Out-of-network providers may balance bill.", emergencyCoverageNotes: null, providerDirectoryUrl: "https://example.com/providers", sourcePages: [1] },
  contacts: [],
};

const costs = {
  services: [{ medicalEvent: "Office or clinic", service: "Primary care visit", inNetwork: [{ networkTier: "Network provider", cost: "$40 copay per visit", deductibleApplies: false, notes: null }], outOfNetwork: [{ networkTier: "Out-of-network", cost: "Not Covered", deductibleApplies: null, notes: null }], limitations: null, preauthorization: null, visitOrUnitLimit: null, ageLimit: null, rawNotes: null, sourcePage: 2 }],
  prescriptions: { drugListUrl: null, pharmacyNetworkNotes: null, retailSupply: "30 days", mailOrderSupply: "90 days", priorAuthorizationNotes: null, stepTherapyNotes: null, specialtyDrugNotes: null, tiers: [], sourcePages: [3] },
};

const coverage = {
  exclusions: [], otherCoveredServices: [],
  legal: { continuationRights: null, grievanceAndAppealsRights: null, minimumEssentialCoverage: true, minimumValueStandard: true, marketplaceNotes: null, contacts: [], sourcePages: [5] },
  languageAccess: [], coverageExamples: [], notices: [], extractionWarnings: [],
};

function deepMerge(target: Record<string, any>, patch: Record<string, any>) {
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value)) target[key] = deepMerge(target[key] || {}, value);
    else target[key] = value;
  }
  return target;
}

function memoryStore() {
  const document: Record<string, any> = {}, patches: PlanPatch[] = [], textPages: Array<{ pageNumber: number; text: string }> = [];
  return { document, patches, textPages, store: {
    updatePlan: vi.fn(async (patch: PlanPatch) => { patches.push(patch); deepMerge(document, patch); }),
    writeTextPage: vi.fn(async (page: { pageNumber: number; text: string }) => { textPages.push(page); }),
  } };
}

describe("extractMedicalPlan", () => {
  it("writes transcript pages, partial attributes, and ordered progress states", async () => {
    const parsed = [{ pages: [{ pageNumber: 1, text: "Example plan" }] }, identity, costs, coverage];
    const client = { responses: { parse: vi.fn(async () => ({ output_parsed: parsed.shift() })) } } as any;
    const state = memoryStore();
    const result = await extractMedicalPlan({ client, file: Buffer.from("pdf"), fileName: "example.pdf", store: state.store, progressIntervalMs: 0 });

    expect(client.responses.parse).toHaveBeenCalledTimes(4);
    expect(state.textPages).toEqual([{ pageNumber: 1, text: "Example plan" }]);
    expect(result.identity.planName).toBe("Example Bronze");
    expect(result.services[0].inNetwork[0].cost).toBe("$40 copay per visit");
    expect(state.document).toMatchObject({ status: "complete", parsingPct: 100 });
    expect(state.document.attributes.identity.planId).toBe("EX-1");
    expect(state.patches.map((patch) => patch.parsingState).filter(Boolean)).toEqual(expect.arrayContaining(["extracting characters", "reading plan", "extracting benefits", "reading exclusions and examples", "validating plan", "complete"]));
  });

  it("marks the plan failed when a model phase errors", async () => {
    const client = { responses: { parse: vi.fn(async () => Promise.reject(new Error("model unavailable"))) } } as any;
    const state = memoryStore();
    await expect(extractMedicalPlan({ client, file: Buffer.from("pdf"), fileName: "broken.pdf", store: state.store, progressIntervalMs: 0 })).rejects.toThrow("model unavailable");
    expect(state.document).toMatchObject({ status: "failed", parsingState: "failed", error: "model unavailable" });
  });

  it("backfills a missing plan ID from a page footer transcript", async () => {
    const withoutPlanId = structuredClone(identity);
    withoutPlanId.identity.planId = null;
    const parsed = [
      { pages: [{ pageNumber: 1, text: "Plan details\nNY_SB_2026_METRO_EPO_HSA_01X Page 1 of 6" }] },
      withoutPlanId,
      costs,
      coverage,
    ];
    const client = { responses: { parse: vi.fn(async () => ({ output_parsed: parsed.shift() })) } } as any;
    const state = memoryStore();

    const result = await extractMedicalPlan({ client, file: Buffer.from("pdf"), fileName: "example.pdf", store: state.store, progressIntervalMs: 0 });

    expect(result.identity.planId).toBe("NY_SB_2026_METRO_EPO_HSA_01X");
    expect(state.document.attributes.identity.planId).toBe("NY_SB_2026_METRO_EPO_HSA_01X");
  });
});
