import { describe, expect, it } from "vitest";
import {
  BENEFIT_REQUIREMENTS_REGISTRY,
  collectPredicateDependencies,
  predicatePaths,
} from "../lib/benefit-requirements";
import {
  BENEFIT_EXTRACTION_CONTRACTS,
  BENEFIT_REQUIREMENT_CANDIDATE_SCHEMAS,
  BENEFIT_TYPE_VALUES,
  validateRequirementCandidateOutput,
} from "../lib/benefit-requirements/extraction-contracts";
import type {
  ExtractedRequirementCandidate,
  RequirementEvidence,
  SourceAuthority,
} from "../lib/benefit-requirements/types";
import { buildBenefitRequirementSubjects } from "../lib/benefit-resolution-builder";
import { evaluateRequirementSubjects } from "../lib/booklet-render-manifest";
import { buildRequirementQuestions } from "../lib/question-engine";
import type { BenefitType, ClassifiedDocument } from "../lib/booklet-types";

const expectedFieldCounts: Record<BenefitType, number> = {
  medical: 33,
  dental: 30,
  vision: 26,
  life: 24,
  std: 26,
  ltd: 28,
  eap: 18,
  voluntary: 23,
  telemedicine: 21,
  hsa: 31,
  hra: 39,
  fsa: 39,
};

const benefitTypesWithConditions = BENEFIT_TYPE_VALUES.filter((benefitType) =>
  BENEFIT_REQUIREMENTS_REGISTRY[benefitType].fields.some(
    (field) => field.when && field.levels.complete_extraction === "conditional",
  ),
);

function rawCandidate(benefitType: BenefitType, path: string) {
  return {
    benefitType,
    planOrProgramName: `${benefitType.toUpperCase()} fixture`,
    planOrProgramId: `${benefitType}-fixture`,
    path,
    state: "known" as const,
    value: true,
    valueJson: null,
    rawValue: "true",
    reasonCode: null,
    page: 1,
    quote: `${path} is true`,
    confidence: 0.99,
  };
}

function documentType(authority: SourceAuthority): ClassifiedDocument["documentType"] {
  if (authority === "employer_selection" || authority === "manual_answer")
    return "email_export";
  if (authority === "employer_eligibility") return "employer_application";
  if (authority === "rate_or_contribution") return "carrier_rate_sheet";
  return "plan_summary";
}

function fixtureValue(path: string) {
  if (/offering|selectedByEmployer/i.test(path)) return true;
  if (/name|carrier|administrator|custodian|title/i.test(path)) return "Fixture value";
  return false;
}

function completeFixture(benefitType: BenefitType) {
  const definition = BENEFIT_REQUIREMENTS_REGISTRY[benefitType];
  const dependencies = collectPredicateDependencies()[benefitType];
  const requirementsByPath = new Map(
    definition.fields.map((field) => [field.path, field]),
  );
  const paths = [
    ...new Set([...definition.fields.map((field) => field.path), ...dependencies]),
  ];
  const candidates: ExtractedRequirementCandidate[] = paths.map((path) => {
    const requirement = requirementsByPath.get(path);
    const authority = requirement?.acceptedAuthorities[0] || "manual_answer";
    const sourceFileId = `${benefitType}-${authority}`;
    const evidence: RequirementEvidence = {
      id: `${benefitType}:${path}`,
      sourceFileId,
      sourceFileName: `${sourceFileId}.txt`,
      authority,
      authorityDomain: /offering|selectedByEmployer/i.test(path)
        ? "offering"
        : "plan_design",
      employerOrGroupId: "Acme",
      planOrProgramId: `${benefitType}-fixture`,
      locator: { kind: "text", start: 0, end: 20, quote: `${path} fixture` },
      extractionMethod: authority === "manual_answer" ? "manual" : "text",
      confidence: 0.99,
    };
    return {
      subjectHint: {
        benefitType,
        planOrProgramName: `${benefitType.toUpperCase()} fixture`,
        planOrProgramId: `${benefitType}-fixture`,
      },
      path,
      state: "known",
      value: fixtureValue(path),
      rawValue: String(fixtureValue(path)),
      evidence,
      confidence: 0.99,
    };
  });
  const classifications: ClassifiedDocument[] = [
    ...new Map(
      candidates.map((candidate) => {
        const authority = candidate.evidence.authority;
        return [
          candidate.evidence.sourceFileId,
          {
            fileId: candidate.evidence.sourceFileId,
            documentType: documentType(authority),
            confidence: 0.99,
            reasoningSummary: "Twelve-type contract fixture",
            benefitTypes: [benefitType],
            documentSubtype: "test_fixture",
            scope: "current_employer" as const,
            authority,
            employerOrGroupId: "Acme",
            planOrProgramIds: [`${benefitType}-fixture`],
          },
        ];
      }),
    ).values(),
  ];
  return { candidates, classifications };
}

describe("all-benefit extraction contracts", () => {
  it("defines a path-constrained schema for every one of the 12 benefit types", () => {
    expect(Object.keys(BENEFIT_EXTRACTION_CONTRACTS)).toEqual([
      ...BENEFIT_TYPE_VALUES,
    ]);
    expect(Object.keys(BENEFIT_REQUIREMENT_CANDIDATE_SCHEMAS)).toEqual([
      ...BENEFIT_TYPE_VALUES,
    ]);
    for (const benefitType of BENEFIT_TYPE_VALUES) {
      const contract = BENEFIT_EXTRACTION_CONTRACTS[benefitType];
      expect(contract.fieldPaths).toHaveLength(expectedFieldCounts[benefitType]);
      expect(contract.allowedPaths).toEqual(
        expect.arrayContaining(contract.fieldPaths),
      );
      expect(contract.allowedPaths).toEqual(
        expect.arrayContaining(contract.dependencyPaths),
      );
    }
  });

  it.each(BENEFIT_TYPE_VALUES)(
    "%s accepts its own paths and rejects foreign or invented paths",
    (benefitType) => {
      const own = BENEFIT_EXTRACTION_CONTRACTS[benefitType];
      const otherType = BENEFIT_TYPE_VALUES.find(
        (candidate) => candidate !== benefitType,
      )!;
      const foreignPath = BENEFIT_EXTRACTION_CONTRACTS[
        otherType
      ].allowedPaths.find((path) => !own.allowedPaths.includes(path))!;
      expect(validateRequirementCandidateOutput(rawCandidate(benefitType, own.allowedPaths[0])).success).toBe(true);
      expect(validateRequirementCandidateOutput(rawCandidate(benefitType, foreignPath)).success).toBe(false);
      expect(
        validateRequirementCandidateOutput(
          rawCandidate(benefitType, `${benefitType}.invented.modelPath`),
        ).success,
      ).toBe(false);
    },
  );

  it("rejects malformed structured values before they enter resolution", () => {
    const candidate = {
      ...rawCandidate("medical", BENEFIT_EXTRACTION_CONTRACTS.medical.allowedPaths[0]),
      value: null,
      valueJson: "{not-json}",
    };
    expect(validateRequirementCandidateOutput(candidate).success).toBe(false);
  });
});

describe("all-benefit resolution and gate matrix", () => {
  it.each(BENEFIT_TYPE_VALUES)(
    "%s resolves every registry field and passes extraction and booklet gates",
    (benefitType) => {
      const fixture = completeFixture(benefitType);
      const subjects = buildBenefitRequirementSubjects({
        companyId: "Acme",
        ...fixture,
        manualAnswers: {},
      });
      expect(subjects).toHaveLength(1);
      expect(subjects[0]).toMatchObject({
        benefitType,
        enforcementStatus: "registry_enforced",
      });
      expect(Object.keys(subjects[0].resolutions)).toEqual(
        expect.arrayContaining(
          BENEFIT_EXTRACTION_CONTRACTS[benefitType].allowedPaths,
        ),
      );
      expect(
        evaluateRequirementSubjects(subjects, "complete_extraction")[0].passed,
      ).toBe(true);
      expect(
        evaluateRequirementSubjects(subjects, "safe_booklet")[0].passed,
      ).toBe(true);
    },
  );

  it.each(BENEFIT_TYPE_VALUES)(
    "%s turns a missing required field into its registry blocker question",
    (benefitType) => {
      const definition = BENEFIT_REQUIREMENTS_REGISTRY[benefitType];
      const missing = definition.fields.find(
        (field) => field.levels.complete_extraction === "required",
      )!;
      const fixture = completeFixture(benefitType);
      fixture.candidates = fixture.candidates.filter(
        (candidate) => candidate.path !== missing.path,
      );
      const subjects = buildBenefitRequirementSubjects({
        companyId: "Acme",
        ...fixture,
        manualAnswers: {},
      });
      const reports = evaluateRequirementSubjects(subjects, "complete_extraction");
      expect(reports[0]).toMatchObject({
        passed: false,
        issues: expect.arrayContaining([
          expect.objectContaining({
            requirementId: missing.id,
            blockerCode: missing.blockerCode,
          }),
        ]),
      });
      expect(buildRequirementQuestions({ subjects, reports })).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            benefitType,
            subjectId: subjects[0].id,
            blockerCode: missing.blockerCode,
          }),
        ]),
      );
    },
  );

  it.each(BENEFIT_TYPE_VALUES)(
    "%s rejects evidence from an authority outside the field contract",
    (benefitType) => {
      const definition = BENEFIT_REQUIREMENTS_REGISTRY[benefitType];
      const target = definition.fields.find(
        (field) => field.levels.complete_extraction === "required",
      )!;
      expect(target.acceptedAuthorities).not.toContain("generic_marketing");
      const fixture = completeFixture(benefitType);
      const subjects = buildBenefitRequirementSubjects({
        companyId: "Acme",
        ...fixture,
        manualAnswers: {},
      });
      const resolution = subjects[0].resolutions[target.path];
      expect(resolution?.status).toBe("known");
      if (resolution?.status !== "known") throw new Error("Fixture did not resolve");
      subjects[0].resolutions[target.path] = {
        ...resolution,
        evidence: resolution.evidence.map((item) => ({
          ...item,
          authority: "generic_marketing",
        })),
      };
      expect(
        evaluateRequirementSubjects(subjects, "complete_extraction")[0].issues,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            requirementId: target.id,
            code: "authority_mismatch",
          }),
        ]),
      );
    },
  );

  it.each(benefitTypesWithConditions)(
    "%s blocks when a conditional requirement's routing inputs are unknown",
    (benefitType) => {
      const conditional = BENEFIT_REQUIREMENTS_REGISTRY[
        benefitType
      ].fields.find(
        (field) =>
          field.when && field.levels.complete_extraction === "conditional",
      )!;
      const fixture = completeFixture(benefitType);
      const subjects = buildBenefitRequirementSubjects({
        companyId: "Acme",
        ...fixture,
        manualAnswers: {},
      });
      for (const path of predicatePaths(conditional.when!))
        subjects[0].resolutions[path] = {
          status: "not_found",
          searchedSourceFileIds: [],
        };
      expect(
        evaluateRequirementSubjects(subjects, "complete_extraction")[0].issues,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            requirementId: conditional.id,
            code: "condition_unknown",
          }),
        ]),
      );
    },
  );

  it("records that EAP has no conditional routing inputs", () => {
    expect(benefitTypesWithConditions).not.toContain("eap");
    expect(BENEFIT_EXTRACTION_CONTRACTS.eap.dependencyPaths).toEqual([]);
  });
});
