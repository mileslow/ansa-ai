import {
  dentalRequirements,
  medicalRequirements,
  visionRequirements,
} from "./core-plans";
import {
  eapRequirements,
  lifeRequirements,
  ltdRequirements,
  stdRequirements,
  telemedicineRequirements,
  voluntaryRequirements,
} from "./ancillary";
import {
  fsaRequirements,
  hraRequirements,
  hsaRequirements,
} from "./accounts";
import type {
  BenefitRequirementDefinition,
  BenefitRequirementsRegistry,
  RequirementPredicate,
} from "./types";

export * from "./types";
export * from "./evaluator";
export * from "./core-plans";
export * from "./ancillary";
export * from "./accounts";

export const BENEFIT_REQUIREMENTS_REGISTRY: BenefitRequirementsRegistry = {
  medical: medicalRequirements,
  dental: dentalRequirements,
  vision: visionRequirements,
  life: lifeRequirements,
  std: stdRequirements,
  ltd: ltdRequirements,
  eap: eapRequirements,
  voluntary: voluntaryRequirements,
  telemedicine: telemedicineRequirements,
  hsa: hsaRequirements,
  hra: hraRequirements,
  fsa: fsaRequirements,
};

/** Persisted with every gate report so an old snapshot is never silently trusted. */
export const BENEFIT_REQUIREMENTS_REGISTRY_VERSION = "2026-07-17.1";

export const BENEFIT_REQUIREMENT_DEFINITIONS = Object.values(
  BENEFIT_REQUIREMENTS_REGISTRY,
);

export function predicatePaths(predicate: RequirementPredicate): string[] {
  if (predicate.op === "all" || predicate.op === "any")
    return predicate.predicates.flatMap(predicatePaths);
  if (predicate.op === "not") return predicatePaths(predicate.predicate);
  return [predicate.path];
}

export type RegistryDefinitionIssue = {
  benefitType: BenefitRequirementDefinition["benefitType"];
  requirementId?: string;
  code:
    | "benefit_type_mismatch"
    | "duplicate_requirement_id"
    | "duplicate_requirement_path"
    | "conditional_without_predicate"
    | "predicate_without_conditional_gate"
    | "material_without_evidence"
    | "empty_authority_list"
    | "missing_blocker_code"
    | "invalid_predicate_path";
  message: string;
};

/**
 * Structural validation for the registry itself. Runtime benefit completeness
 * is evaluated separately by evaluateBenefitRequirements().
 */
export function validateBenefitRequirementsRegistry(
  registry: BenefitRequirementsRegistry = BENEFIT_REQUIREMENTS_REGISTRY,
) {
  const issues: RegistryDefinitionIssue[] = [];
  for (const [benefitType, definition] of Object.entries(registry) as Array<
    [keyof BenefitRequirementsRegistry, BenefitRequirementDefinition]
  >) {
    if (benefitType !== definition.benefitType)
      issues.push({
        benefitType: definition.benefitType,
        code: "benefit_type_mismatch",
        message: `Registry key ${benefitType} does not match ${definition.benefitType}.`,
      });
    const ids = new Set<string>();
    const paths = new Set<string>();
    for (const field of definition.fields) {
      if (ids.has(field.id))
        issues.push({
          benefitType: definition.benefitType,
          requirementId: field.id,
          code: "duplicate_requirement_id",
          message: `Requirement ID ${field.id} is duplicated.`,
        });
      ids.add(field.id);
      if (paths.has(field.path))
        issues.push({
          benefitType: definition.benefitType,
          requirementId: field.id,
          code: "duplicate_requirement_path",
          message: `Requirement path ${field.path} is duplicated within ${definition.benefitType}.`,
        });
      paths.add(field.path);

      const hasConditionalGate = Object.values(field.levels).includes(
        "conditional",
      );
      if (hasConditionalGate && !field.when)
        issues.push({
          benefitType: definition.benefitType,
          requirementId: field.id,
          code: "conditional_without_predicate",
          message: `Conditional requirement ${field.id} has no predicate.`,
        });
      if (!hasConditionalGate && field.when)
        issues.push({
          benefitType: definition.benefitType,
          requirementId: field.id,
          code: "predicate_without_conditional_gate",
          message: `Requirement ${field.id} has a predicate but no conditional gate.`,
        });
      if (field.material && !field.evidenceRequired)
        issues.push({
          benefitType: definition.benefitType,
          requirementId: field.id,
          code: "material_without_evidence",
          message: `Material requirement ${field.id} does not require evidence.`,
        });
      if (!field.acceptedAuthorities.length)
        issues.push({
          benefitType: definition.benefitType,
          requirementId: field.id,
          code: "empty_authority_list",
          message: `Requirement ${field.id} accepts no source authority.`,
        });
      if (
        Object.values(field.levels).some((level) => level !== "optional") &&
        !field.blockerCode
      )
        issues.push({
          benefitType: definition.benefitType,
          requirementId: field.id,
          code: "missing_blocker_code",
          message: `Blocking requirement ${field.id} has no blocker code.`,
        });
      for (const path of field.when ? predicatePaths(field.when) : []) {
        // Predicate inputs include both extracted facts and routing context.
        // They need a stable, machine-addressable path, but do not need to be
        // renderable booklet fields. At runtime an absent input is "unknown"
        // and blocks the conditional gate rather than silently evaluating false.
        if (!/^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)+$/.test(path))
          issues.push({
            benefitType: definition.benefitType,
            requirementId: field.id,
            code: "invalid_predicate_path",
            message: `Predicate path ${path} is not a valid dotted dependency path.`,
          });
      }
    }
  }

  return { passed: issues.length === 0, issues };
}

/**
 * Every input the extraction/assembly layer must resolve before conditional
 * requirements can be evaluated. This makes routing dependencies inspectable
 * without pretending they are fields that belong in the rendered booklet.
 */
export function collectPredicateDependencies(
  registry: BenefitRequirementsRegistry = BENEFIT_REQUIREMENTS_REGISTRY,
) {
  return Object.fromEntries(
    Object.entries(registry).map(([benefitType, definition]) => [
      benefitType,
      [
        ...new Set(
          definition.fields.flatMap((field) =>
            field.when ? predicatePaths(field.when) : [],
          ),
        ),
      ].sort(),
    ]),
  ) as Record<keyof BenefitRequirementsRegistry, string[]>;
}
