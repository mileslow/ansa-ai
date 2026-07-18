import { describe, expect, it } from "vitest";
import {
  evaluateBenefitRequirements,
  evaluatePredicate,
} from "../lib/benefit-requirements/evaluator";
import {
  BENEFIT_REQUIREMENTS_REGISTRY,
  collectPredicateDependencies,
  validateBenefitRequirementsRegistry,
} from "../lib/benefit-requirements";
import type {
  BenefitRequirementDefinition,
  RequirementEvidence,
  ResolutionMap,
} from "../lib/benefit-requirements/types";

const planEvidence: RequirementEvidence = {
  sourceFileId: "plan-1",
  authority: "current_plan_document",
  authorityDomain: "plan_design",
  locator: { kind: "pdf", page: 3, quote: "The benefit is 60%." },
  extractionMethod: "text",
};

const employerEvidence: RequirementEvidence = {
  sourceFileId: "selection-1",
  authority: "employer_selection",
  authorityDomain: "offering",
  locator: { kind: "pdf", page: 1, quote: "Short-term disability is offered." },
  extractionMethod: "text",
};

const definition: BenefitRequirementDefinition = {
  benefitType: "std",
  title: "Short-term disability",
  entityKind: "plan",
  formalDisclosureRequiresSeparateApplicability: true,
  researchSources: [],
  invariants: [],
  fields: [
    {
      id: "std.offering",
      path: "offering.status",
      label: "Offering status",
      description: "Current employer evidence that STD is offered.",
      levels: {
        complete_extraction: "required",
        safe_booklet: "required",
        formal_disclosure: "required",
      },
      material: true,
      evidenceRequired: true,
      acceptedAuthorities: ["employer_selection", "manual_answer"],
      blockerCode: "STD_OFFERING_UNKNOWN",
      renderPolicy: "never_render",
    },
    {
      id: "std.percentage",
      path: "coverage.benefitPercentage",
      label: "Benefit percentage",
      description: "Percentage of covered earnings.",
      levels: {
        complete_extraction: "required",
        safe_booklet: "required",
        formal_disclosure: "required",
      },
      material: true,
      evidenceRequired: true,
      acceptedAuthorities: ["current_plan_document", "current_amendment_or_rider"],
      blockerCode: "STD_BENEFIT_PERCENTAGE_UNKNOWN",
      renderPolicy: "render",
    },
    {
      id: "std.pregnancy",
      path: "limitations.pregnancy",
      label: "Pregnancy-specific rule",
      description: "Any distinct pregnancy limitation stated by the plan.",
      levels: {
        complete_extraction: "conditional",
        safe_booklet: "conditional",
        formal_disclosure: "conditional",
      },
      when: {
        op: "field_equals",
        path: "features.hasPregnancySpecificRule",
        value: true,
      },
      material: true,
      evidenceRequired: true,
      acceptedAuthorities: ["current_plan_document", "current_amendment_or_rider"],
      acceptedNotApplicableReasons: ["NO_PREGNANCY_SPECIFIC_RULE"],
      blockerCode: "STD_PREGNANCY_RULE_UNKNOWN",
      renderPolicy: "render",
    },
    {
      id: "std.portal",
      path: "claims.portalUrl",
      label: "Claim portal",
      description: "Optional online claim portal.",
      levels: {
        complete_extraction: "optional",
        safe_booklet: "optional",
        formal_disclosure: "optional",
      },
      material: false,
      evidenceRequired: true,
      acceptedAuthorities: ["current_plan_document", "administrator_material"],
      renderPolicy: "omit_when_absent",
    },
  ],
};

function completeResolutions(): ResolutionMap {
  return {
    "offering.status": {
      status: "known",
      value: "offered",
      evidence: [employerEvidence],
    },
    "coverage.benefitPercentage": {
      status: "known",
      value: 0.6,
      evidence: [planEvidence],
    },
    "features.hasPregnancySpecificRule": {
      status: "known",
      value: false,
      evidence: [planEvidence],
    },
  };
}

describe("benefit requirements evaluator", () => {
  it("evaluates serializable predicates with three-state results", () => {
    const resolutions = completeResolutions();
    expect(
      evaluatePredicate(
        {
          op: "all",
          predicates: [
            { op: "field_equals", path: "offering.status", value: "offered" },
            {
              op: "not",
              predicate: {
                op: "field_equals",
                path: "features.hasPregnancySpecificRule",
                value: true,
              },
            },
          ],
        },
        resolutions,
      ),
    ).toBe(true);
    expect(
      evaluatePredicate(
        { op: "field_equals", path: "features.missing", value: true },
        resolutions,
      ),
    ).toBe("unknown");
  });

  it("passes a safe-booklet gate when all applicable required fields are sourced", () => {
    const report = evaluateBenefitRequirements({
      definition,
      gate: "safe_booklet",
      resolutions: completeResolutions(),
    });
    expect(report.passed).toBe(true);
    expect(report.applicableRequirementIds).toEqual([
      "std.offering",
      "std.percentage",
    ]);
  });

  it("blocks when a conditional trigger cannot be resolved", () => {
    const resolutions = completeResolutions();
    delete resolutions["features.hasPregnancySpecificRule"];
    const report = evaluateBenefitRequirements({
      definition,
      gate: "safe_booklet",
      resolutions,
    });
    expect(report.passed).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        requirementId: "std.pregnancy",
        code: "condition_unknown",
      }),
    );
  });

  it("requires an optional field when the renderer elects to use it", () => {
    const report = evaluateBenefitRequirements({
      definition,
      gate: "safe_booklet",
      resolutions: completeResolutions(),
      renderedPaths: ["claims.portalUrl"],
    });
    expect(report.passed).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        requirementId: "std.portal",
        code: "missing",
      }),
    );
  });

  it("rejects unsupported explicit-none and not-applicable reason codes", () => {
    const resolutions = completeResolutions();
    resolutions["coverage.benefitPercentage"] = {
      status: "explicit_none",
      reasonCode: "BLANK_SOURCE_CELL",
      evidence: [planEvidence],
    };
    resolutions["features.hasPregnancySpecificRule"] = {
      status: "known",
      value: true,
      evidence: [planEvidence],
    };
    resolutions["limitations.pregnancy"] = {
      status: "not_applicable",
      reasonCode: "SOURCE_WAS_SILENT",
      evidence: [planEvidence],
    };
    const report = evaluateBenefitRequirements({
      definition,
      gate: "safe_booklet",
      resolutions,
    });
    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "invalid_explicit_none_reason",
        "invalid_not_applicable_reason",
      ]),
    );
  });

  it("rejects evidence from an authority outside the field's domain", () => {
    const resolutions = completeResolutions();
    resolutions["offering.status"] = {
      status: "known",
      value: "offered",
      evidence: [planEvidence],
    };
    const report = evaluateBenefitRequirements({
      definition,
      gate: "safe_booklet",
      resolutions,
    });
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        requirementId: "std.offering",
        code: "authority_mismatch",
      }),
    );
  });
});

describe("canonical benefit requirements registry", () => {
  const expectedCounts = {
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
  } as const;

  it("covers every supported benefit type with the reviewed field inventory", () => {
    expect(Object.keys(BENEFIT_REQUIREMENTS_REGISTRY)).toEqual(
      Object.keys(expectedCounts),
    );
    expect(
      Object.fromEntries(
        Object.entries(BENEFIT_REQUIREMENTS_REGISTRY).map(
          ([benefitType, entry]) => [benefitType, entry.fields.length],
        ),
      ),
    ).toEqual(expectedCounts);
    expect(
      Object.values(BENEFIT_REQUIREMENTS_REGISTRY).reduce(
        (total, entry) => total + entry.fields.length,
        0,
      ),
    ).toBe(338);
  });

  it("passes structural validation and uses globally unique IDs", () => {
    const validation = validateBenefitRequirementsRegistry();
    expect(validation.issues).toEqual([]);
    expect(validation.passed).toBe(true);

    const ids = Object.values(BENEFIT_REQUIREMENTS_REGISTRY).flatMap((entry) =>
      entry.fields.map((field) => field.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("requires evidence for every material field and a predicate for every conditional gate", () => {
    for (const entry of Object.values(BENEFIT_REQUIREMENTS_REGISTRY)) {
      expect(entry.formalDisclosureRequiresSeparateApplicability).toBe(true);
      expect(entry.invariants.length).toBeGreaterThan(0);
      expect(entry.researchSources.length).toBeGreaterThan(0);
      for (const source of entry.researchSources)
        expect(source.url).toMatch(/^https:\/\//);

      for (const field of entry.fields) {
        if (field.material) expect(field.evidenceRequired).toBe(true);
        if (Object.values(field.levels).includes("conditional"))
          expect(field.when).toBeDefined();
      }
    }
  });

  it("does not use plan documents, prior guides, or marketing to prove an employer offering", () => {
    const offeringRequirementIds = [
      "medical.offering.selectedByEmployer",
      "dental.offering.selectedByEmployer",
      "vision.offering.selectedByEmployer",
      "life.offering-status",
      "std.offering-status",
      "ltd.offering-status",
      "eap.offering-status",
      "voluntary.offering-status",
      "telemedicine.offering-status",
      "hsa.offering.confirmed",
      "hra.offering.confirmed",
      "fsa.offering.confirmed",
    ];
    const fields = Object.values(BENEFIT_REQUIREMENTS_REGISTRY).flatMap(
      (entry) => entry.fields,
    );
    for (const requirementId of offeringRequirementIds) {
      const requirement = fields.find((field) => field.id === requirementId);
      expect(requirement, requirementId).toBeDefined();
      expect(requirement?.acceptedAuthorities).not.toContain(
        "current_plan_document",
      );
      expect(requirement?.acceptedAuthorities).not.toContain(
        "prior_year_context",
      );
      expect(requirement?.acceptedAuthorities).not.toContain(
        "generic_marketing",
      );
    }
  });

  it("publishes every conditional dependency for the extraction router", () => {
    const dependencies = collectPredicateDependencies();
    expect(Object.keys(dependencies)).toEqual(Object.keys(expectedCounts));
    expect(dependencies.medical).toContain("booklet.mode");
    expect(dependencies.std).toContain("employment.workStates");
    expect(dependencies.hra).toContain("hra.design.subtype");
    expect(dependencies.fsa).toContain("fsa.arrangements.offeredTypes");
  });

  it("is JSON serializable for prompt, fixture, and judge-test generation", () => {
    expect(() => JSON.stringify(BENEFIT_REQUIREMENTS_REGISTRY)).not.toThrow();
    expect(
      JSON.parse(JSON.stringify(BENEFIT_REQUIREMENTS_REGISTRY)).medical.fields,
    ).toHaveLength(expectedCounts.medical);
  });
});
