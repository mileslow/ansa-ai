import { describe, expect, it } from "vitest";
import {
  buildBenefitRequirementSubjects,
  candidatesFromDocumentExtractions,
} from "../lib/benefit-resolution-builder";
import {
  buildBookletRenderManifest,
  evaluateRequirementSubjects,
} from "../lib/booklet-render-manifest";
import { buildRequirementQuestions } from "../lib/question-engine";
import type {
  ExtractedRequirementCandidate,
  RequirementEvidence,
  SourceAuthority,
} from "../lib/benefit-requirements/types";
import type { ClassifiedDocument } from "../lib/booklet-types";

function classification(fileId: string, authority: SourceAuthority): ClassifiedDocument {
  return {
    fileId,
    documentType:
      authority === "employer_selection" ? "employer_application" : "sbc",
    confidence: 0.99,
    reasoningSummary: "Registry test fixture",
    benefitTypes: ["medical"],
    documentSubtype: "test",
    scope:
      authority === "generic_marketing" ? "generic_reference" : "current_employer",
    authority,
    employerOrGroupId: "Acme",
    planOrProgramIds: [],
    effectiveStart: "2026-01-01",
    effectiveEnd: "2026-12-31",
  };
}

function extracted(
  fileId: string,
  authority: SourceAuthority,
  planName: string | undefined,
  path: string,
  value: unknown,
  employerOrGroupId = "Acme",
): ExtractedRequirementCandidate {
  const evidence: RequirementEvidence = {
    id: `${fileId}:${path}`,
    sourceFileId: fileId,
    sourceFileName: `${fileId}.pdf`,
    authority,
    authorityDomain: path.includes("offering") ? "offering" : "plan_design",
    employerOrGroupId,
    effectiveStart: "2026-01-01",
    effectiveEnd: "2026-12-31",
    locator: { kind: "pdf", page: 1, quote: String(value) },
    extractionMethod: "text",
  };
  return {
    subjectHint: {
      benefitType: "medical",
      ...(planName ? { planOrProgramName: planName } : {}),
    },
    path,
    state: "known",
    value,
    evidence,
    confidence: 0.98,
  };
}

describe("benefit requirement resolution wiring", () => {
  it("reuses registry account identity when projecting legacy account facts", () => {
    const generic = {
      ...extracted(
        "hsa-form",
        "current_plan_document",
        "SEGIP HSA",
        "hsa.ownership.owner",
        "employee",
      ),
      subjectHint: {
        benefitType: "hsa" as const,
        planOrProgramName: "SEGIP HSA",
        planOrProgramId: "segip-hsa",
      },
    };
    const candidates = candidatesFromDocumentExtractions({
      extractions: [
        {
          fileId: "hsa-form",
          fileName: "hsa-form.pdf",
          documentType: "plan_summary",
          employer: { name: null, legalName: null, address: null, website: null },
          planYear: { start: null, end: null, label: null },
          eligibility: { waitingPeriod: null, description: null, employeeClasses: [] },
          offeredBenefits: [],
          selectedPlans: [],
          contributions: [],
          contacts: [],
          accounts: [
            { type: "hsa", administrator: "Optum", page: 1, confidence: 0.99 },
          ],
          sectionOrder: [],
          templateRole: "employer_factual",
          extractionMethod: "pdf_text",
          warnings: [],
          requirementCandidates: [generic],
        },
      ],
      classifications: [],
    });
    expect(
      new Set(
        candidates
          .filter((candidate) => candidate.subjectHint.benefitType === "hsa")
          .map((candidate) => candidate.subjectHint.planOrProgramName),
      ),
    ).toEqual(new Set(["SEGIP HSA"]));
    expect(
      candidates
        .filter((candidate) => candidate.subjectHint.benefitType === "hsa")
        .every(
          (candidate) => candidate.subjectHint.planOrProgramId === "segip-hsa",
        ),
    ).toBe(true);
  });

  it("keeps similarly structured medical options in separate subjects", () => {
    const candidates = [
      extracted(
        "selection",
        "employer_selection",
        undefined,
        "plans.medical.offering.selectedByEmployer",
        true,
      ),
      extracted(
        "selection",
        "employer_selection",
        "Gold PPO",
        "plans.medical.identity.planName",
        "Gold PPO",
      ),
      extracted(
        "selection",
        "employer_selection",
        "Silver PPO",
        "plans.medical.identity.planName",
        "Silver PPO",
      ),
      extracted(
        "gold",
        "current_plan_document",
        "Gold PPO",
        "plans.medical.financial.deductible",
        { individual: 1000 },
      ),
      extracted(
        "silver",
        "current_plan_document",
        "Silver PPO",
        "plans.medical.financial.deductible",
        { individual: 2500 },
      ),
    ];
    const subjects = buildBenefitRequirementSubjects({
      companyId: "acme",
      classifications: [
        classification("selection", "employer_selection"),
        classification("gold", "current_plan_document"),
        classification("silver", "current_plan_document"),
      ],
      candidates,
      manualAnswers: {},
    });
    expect(subjects).toHaveLength(2);
    expect(
      subjects.find((subject) => subject.displayName === "Gold PPO")?.resolutions[
        "plans.medical.financial.deductible"
      ],
    ).toMatchObject({ status: "known", value: { individual: 1000 } });
    expect(
      subjects.find((subject) => subject.displayName === "Silver PPO")?.resolutions[
        "plans.medical.financial.deductible"
      ],
    ).toMatchObject({ status: "known", value: { individual: 2500 } });
    expect(
      subjects.every(
        (subject) =>
          subject.resolutions[
            "plans.medical.identity.requiresOptionDisambiguation"
          ]?.status === "known" &&
          subject.resolutions[
            "plans.medical.identity.requiresOptionDisambiguation"
          ].value === true,
      ),
    ).toBe(true);
  });

  it("rejects generic marketing as employer offering evidence", () => {
    const subjects = buildBenefitRequirementSubjects({
      companyId: "acme",
      classifications: [classification("brochure", "generic_marketing")],
      candidates: [
        extracted(
          "brochure",
          "generic_marketing",
          "Carrier PPO",
          "plans.medical.offering.selectedByEmployer",
          true,
        ),
      ],
      manualAnswers: {},
    });
    expect(
      subjects[0].resolutions["plans.medical.offering.selectedByEmployer"],
    ).toMatchObject({ status: "unknown", reasonCode: "AUTHORITY_NOT_ACCEPTED" });
  });

  it("joins internal company IDs and detected current-employer names as aliases", () => {
    const subjects = buildBenefitRequirementSubjects({
      companyId: "acme-internal-id",
      classifications: [
        classification("selection", "employer_selection"),
        {
          ...classification("rates", "rate_or_contribution"),
          documentType: "carrier_rate_sheet",
          employerOrGroupId: null,
        },
      ],
      candidates: [
        extracted(
          "selection",
          "employer_selection",
          "Acme PPO",
          "plans.medical.identity.planName",
          "Acme PPO",
        ),
        extracted(
          "rates",
          "rate_or_contribution",
          "Acme PPO",
          "plans.medical.rates.providedSeparately",
          false,
          "acme-internal-id",
        ),
      ],
      manualAnswers: {},
    });
    expect(
      subjects[0].resolutions["plans.medical.rates.providedSeparately"],
    ).toMatchObject({ status: "known", value: false });
  });

  it("preserves conflicts and resolves them only through accountable manual evidence", () => {
    const candidates = [
      extracted(
        "plan-a",
        "current_plan_document",
        "Acme PPO",
        "plans.medical.financial.deductible",
        { individual: 1000 },
      ),
      extracted(
        "plan-b",
        "current_plan_document",
        "Acme PPO",
        "plans.medical.financial.deductible",
        { individual: 1500 },
      ),
    ];
    const classifications = [
      classification("plan-a", "current_plan_document"),
      classification("plan-b", "current_plan_document"),
    ];
    const first = buildBenefitRequirementSubjects({
      companyId: "acme",
      classifications,
      candidates,
      manualAnswers: {},
    });
    expect(
      first[0].resolutions["plans.medical.financial.deductible"],
    ).toMatchObject({ status: "conflicting" });
    const answerKey = `requirements.${first[0].id}.medical.financial.deductible`;
    const resolved = buildBenefitRequirementSubjects({
      companyId: "acme",
      classifications,
      candidates,
      manualAnswers: { [answerKey]: { individual: 1200 } },
    });
    expect(
      resolved[0].resolutions["plans.medical.financial.deductible"],
    ).toMatchObject({
      status: "known",
      value: { individual: 1200 },
      evidence: [expect.objectContaining({ authority: "manual_answer" })],
    });
  });

  it("prefers a path-specific parser over a generic projection of the same source", () => {
    const generic = extracted(
      "plan-a",
      "current_plan_document",
      "Acme PPO",
      "plans.medical.identity.carrierOrAdministrator",
      "UHC",
    );
    generic.evidence.extractorVersion = "benefit-requirements-v1";
    const specialized = extracted(
      "plan-a",
      "current_plan_document",
      "Acme PPO",
      "plans.medical.identity.carrierOrAdministrator",
      "UnitedHealthcare",
    );
    specialized.evidence.extractorVersion = "medical-plan-schema-v1";
    const subjects = buildBenefitRequirementSubjects({
      companyId: "acme",
      classifications: [classification("plan-a", "current_plan_document")],
      candidates: [generic, specialized],
      manualAnswers: {},
    });
    expect(
      subjects[0].resolutions[
        "plans.medical.identity.carrierOrAdministrator"
      ],
    ).toMatchObject({ status: "known", value: "UnitedHealthcare" });
  });

  it("retains every page of supporting evidence for a resolved value", () => {
    const candidate = extracted(
      "plan-a",
      "current_plan_document",
      "Acme PPO",
      "plans.medical.financial.deductible",
      { individual: 1000, family: 2000 },
    );
    candidate.supportingEvidence = [
      {
        ...candidate.evidence,
        id: "plan-a:deductible:page-2",
        locator: {
          kind: "pdf",
          page: 2,
          quote: "Family deductible: $2,000",
        },
      },
    ];
    const subjects = buildBenefitRequirementSubjects({
      companyId: "acme",
      classifications: [classification("plan-a", "current_plan_document")],
      candidates: [candidate],
      manualAnswers: {},
    });

    expect(
      subjects[0].resolutions["plans.medical.financial.deductible"],
    ).toMatchObject({
      status: "known",
      evidence: [
        expect.objectContaining({
          locator: expect.objectContaining({ kind: "pdf", page: 1 }),
        }),
        expect.objectContaining({
          locator: expect.objectContaining({ kind: "pdf", page: 2 }),
        }),
      ],
    });
  });

  it("uses current plan identity while retaining employer selection as offering proof", () => {
    const subjects = buildBenefitRequirementSubjects({
      companyId: "acme",
      classifications: [
        classification("selection", "employer_selection"),
        classification("plan", "current_plan_document"),
      ],
      candidates: [
        extracted(
          "selection",
          "employer_selection",
          "UHC Bronze 2026",
          "plans.medical.offering.selectedByEmployer",
          true,
        ),
        extracted(
          "selection",
          "employer_selection",
          "UHC Bronze 2026",
          "plans.medical.identity.planName",
          "UHC Bronze 2026",
        ),
        extracted(
          "plan",
          "current_plan_document",
          "UnitedHealthcare Bronze HSA 2026",
          "plans.medical.identity.planName",
          "UnitedHealthcare Bronze HSA 2026",
        ),
      ],
      manualAnswers: {},
    });
    expect(subjects).toHaveLength(1);
    expect(
      subjects[0].resolutions["plans.medical.identity.planName"],
    ).toMatchObject({
      status: "known",
      value: "UnitedHealthcare Bronze HSA 2026",
    });
    expect(
      subjects[0].resolutions["plans.medical.offering.selectedByEmployer"],
    ).toMatchObject({ status: "known", value: true });
  });

  it("turns evaluator issues into stable subject-scoped questions", () => {
    const subjects = buildBenefitRequirementSubjects({
      companyId: "acme",
      classifications: [classification("selection", "employer_selection")],
      candidates: [
        extracted(
          "selection",
          "employer_selection",
          "Acme PPO",
          "plans.medical.identity.planName",
          "Acme PPO",
        ),
      ],
      manualAnswers: {},
    });
    const reports = evaluateRequirementSubjects(subjects, "complete_extraction");
    const questions = buildRequirementQuestions({ subjects, reports });
    expect(questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subjectId: subjects[0].id,
          benefitType: "medical",
          blockerCode: "MEDICAL_EMPLOYER_SELECTION_UNPROVEN",
          fieldPath: `requirements.${subjects[0].id}.medical.offering.selectedByEmployer`,
        }),
      ]),
    );
    const manifest = buildBookletRenderManifest(subjects);
    expect(
      manifest.sections
        .flatMap((section) => section.fields)
        .some((field) => field.path.includes("offering.selectedByEmployer")),
    ).toBe(false);
  });
});
