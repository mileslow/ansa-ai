import { describe, expect, it } from "vitest";
import type { BookletDocumentExtraction } from "../lib/booklet-document-extractor";
import {
  factsFromDocumentExtraction,
  factsFromManualAnswers,
  factsFromMedicalPlan,
  requirementCandidatesFromMedicalPlan,
} from "../lib/extracted-facts";

const evidence = (value: string, page = 1) => ({
  value,
  page,
  quote: value,
  confidence: 0.9,
});

function extraction(): BookletDocumentExtraction {
  return {
    fileId: "application",
    fileName: "application.pdf",
    documentType: "employer_application",
    employer: {
      name: evidence("Acme Manufacturing"),
      legalName: evidence("Acme Manufacturing LLC"),
      address: null,
      website: null,
    },
    planYear: { start: evidence("2026-01-01"), end: evidence("2026-12-31"), label: null },
    eligibility: {
      waitingPeriod: evidence("First of month after 30 days", 3),
      description: null,
      employeeClasses: [evidence("Full-time", 3)],
    },
    offeredBenefits: [
      { benefitType: "dental", offered: true, page: 4, quote: "Dental", confidence: 0.95 },
    ],
    selectedPlans: [
      {
        planName: "Dental Plan A",
        benefitType: "dental",
        carrier: "Excellus",
        page: 4,
        quote: "Dental Plan A",
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
  };
}

describe("extracted fact creation", () => {
  it("creates normalized employer facts with page provenance", () => {
    const facts = factsFromDocumentExtraction("acme", extraction());
    expect(facts.find((fact) => fact.path === "employer.name")).toMatchObject({
      normalizedValue: "acme manufacturing",
      confidence: 0.9,
      source: { fileName: "application.pdf", page: 1, extractionMethod: "pdf_text" },
    });
  });

  it("stores eligibility class facts separately", () => {
    const facts = factsFromDocumentExtraction("acme", extraction());
    expect(facts.find((fact) => fact.path === "eligibility.employeeClasses[0]")).toMatchObject({
      value: "Full-time",
      source: { page: 3 },
    });
  });

  it("stores offered-benefit boolean facts", () => {
    const facts = factsFromDocumentExtraction("acme", extraction());
    expect(facts.find((fact) => fact.path.includes("offeredBenefits"))).toMatchObject({
      value: true,
      source: { page: 4 },
    });
  });

  it("stores selected dental plan facts", () => {
    const facts = factsFromDocumentExtraction("acme", extraction());
    expect(facts.find((fact) => fact.path === "selectedPlans[0].planName")).toMatchObject({
      value: "Dental Plan A",
      normalizedValue: "dental plan a",
    });
  });

  it("records manual answers as confidence-one facts", () => {
    const facts = factsFromManualAnswers("acme", {
      "eligibility.waitingPeriod": "First of month after 45 days",
    });
    expect(facts[0]).toMatchObject({
      documentType: "manual_answer",
      confidence: 1,
      extractionMethod: "manual",
      source: { fileName: "User answer" },
    });
  });

  it("stores medical plan attribute groups without flattening large service lists", () => {
    const facts = factsFromMedicalPlan({
      file: {
        id: "sbc",
        companyId: "acme",
        fileName: "plan.pdf",
        storagePath: "plan.pdf",
        mimeType: "application/pdf",
        uploadedAt: "2026-07-17T00:00:00.000Z",
        sha256: "fixture",
        processingStatus: "uploaded",
        data: Buffer.from("pdf"),
      },
      classification: {
        fileId: "sbc",
        documentType: "sbc",
        confidence: 0.98,
        reasoningSummary: "SBC",
      },
      attributes: {
        identity: { planName: "Plan A", sourcePages: [1] },
        financial: { sourcePages: [1] },
        network: { sourcePages: [1] },
        services: [{ sourcePage: 2 }],
        prescriptions: { sourcePages: [3] },
      } as any,
    });
    expect(facts.map((fact) => fact.path)).toEqual([
      "plan.identity",
      "plan.financial",
      "plan.network",
      "plan.services",
      "plan.prescriptions",
    ]);
    expect(facts.find((fact) => fact.path === "plan.services")?.source.page).toBe(2);
  });

  it("projects medical parser facts needed by conditional registry routes", () => {
    const candidates = requirementCandidatesFromMedicalPlan({
      file: {
        id: "sbc-routes",
        companyId: "acme",
        fileName: "plan.pdf",
        storagePath: "plan.pdf",
        mimeType: "application/pdf",
        uploadedAt: "2026-07-17T00:00:00.000Z",
        sha256: "fixture",
        processingStatus: "uploaded",
        data: Buffer.from("pdf"),
      },
      classification: {
        fileId: "sbc-routes",
        documentType: "sbc",
        confidence: 0.99,
        reasoningSummary: "SBC",
        authority: "current_plan_document",
      },
      attributes: {
        identity: {
          planName: "Plan A",
          hsaEligible: true,
          sourcePages: [1],
        },
        financial: {
          specificDeductibles: [],
          specificDeductiblesStatus: "explicit_none",
          servicesBeforeDeductible: [],
          excludedFromOutOfPocket: [],
          sourcePages: [1],
        },
        network: { sourcePages: [1] },
        contacts: [],
        services: [],
        prescriptions: {
          tiers: [{ name: "Generic", sourcePage: 3 }],
          sourcePages: [3],
        },
        exclusions: [],
        otherCoveredServices: [],
        coverageExamples: [],
      } as any,
    });
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "plans.medical.compatibility.marketedAsHsaCompatible",
          value: true,
        }),
        expect.objectContaining({
          path: "plans.medical.prescriptions.covered",
          value: true,
        }),
        expect.objectContaining({
          path: "plans.medical.financial.specificDeductibles",
          state: "explicit_none",
          reasonCode: "NO_SERVICE_SPECIFIC_DEDUCTIBLES",
        }),
      ]),
    );
  });
});
