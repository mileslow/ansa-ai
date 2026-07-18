import type {
  BenefitRequirementDefinition,
  BenefitFieldRequirement,
  FieldResolution,
  RequirementGate,
  RequirementIssue,
  RequirementPredicate,
  ResolutionMap,
  SourceAuthority,
} from "./types";

export type PredicateResult = true | false | "unknown";

function resolvedValue(resolution: FieldResolution | undefined) {
  return resolution?.status === "known" ? resolution.value : undefined;
}

export function evaluatePredicate(
  predicate: RequirementPredicate,
  resolutions: ResolutionMap,
): PredicateResult {
  if (predicate.op === "all") {
    const results = predicate.predicates.map((item) =>
      evaluatePredicate(item, resolutions),
    );
    if (results.includes(false)) return false;
    return results.includes("unknown") ? "unknown" : true;
  }
  if (predicate.op === "any") {
    const results = predicate.predicates.map((item) =>
      evaluatePredicate(item, resolutions),
    );
    if (results.includes(true)) return true;
    return results.includes("unknown") ? "unknown" : false;
  }
  if (predicate.op === "not") {
    const result = evaluatePredicate(predicate.predicate, resolutions);
    return result === "unknown" ? result : !result;
  }

  const resolution = resolutions[predicate.path];
  if (!resolution || ["not_found", "unknown", "conflicting", "requires_legal_determination"].includes(resolution.status))
    return "unknown";
  if (predicate.op === "field_present")
    return ["known", "explicit_none", "not_applicable"].includes(
      resolution.status,
    );
  const value = resolvedValue(resolution);
  if (resolution.status !== "known") return false;
  if (predicate.op === "field_equals")
    return Object.is(value, predicate.value);
  if (predicate.op === "field_in")
    return predicate.values.some((candidate) => Object.is(candidate, value));
  return Array.isArray(value)
    ? value.some((candidate) => Object.is(candidate, predicate.value))
    : typeof value === "string"
      ? value.includes(String(predicate.value))
      : false;
}

function evidenceFor(resolution: FieldResolution) {
  if (
    resolution.status === "known" ||
    resolution.status === "explicit_none" ||
    resolution.status === "not_applicable" ||
    resolution.status === "not_offered" ||
    resolution.status === "requires_legal_determination"
  )
    return resolution.evidence;
  if (resolution.status === "conflicting")
    return resolution.candidates.flatMap((candidate) => candidate.evidence);
  return [];
}

function authorityAllowed(
  authorities: SourceAuthority[],
  requirement: BenefitFieldRequirement,
) {
  return authorities.some((authority) =>
    requirement.acceptedAuthorities.includes(authority),
  );
}

function resolutionIssue(
  requirement: BenefitFieldRequirement,
  resolution: FieldResolution | undefined,
): RequirementIssue | null {
  const base = {
    requirementId: requirement.id,
    path: requirement.path,
    blockerCode: requirement.blockerCode,
  };
  if (!resolution || resolution.status === "not_found" || resolution.status === "unknown")
    return {
      ...base,
      code: "missing",
      message: `${requirement.label} is unresolved.`,
    };
  if (resolution.status === "conflicting")
    return {
      ...base,
      code: "conflicting",
      message: `${requirement.label} has conflicting source values.`,
    };
  if (resolution.status === "requires_legal_determination")
    return {
      ...base,
      code: "legal_determination_required",
      message: `${requirement.label} requires a legal or compliance determination.`,
    };
  if (resolution.status === "not_offered")
    return {
      ...base,
      code: "not_offered",
      message: `${requirement.label} cannot be satisfied by a not-offered state.`,
    };
  if (
    resolution.status === "not_applicable" &&
    !requirement.acceptedNotApplicableReasons?.includes(resolution.reasonCode)
  )
    return {
      ...base,
      code: "invalid_not_applicable_reason",
      message: `${requirement.label} uses an unsupported not-applicable reason.`,
    };
  if (
    resolution.status === "explicit_none" &&
    !requirement.acceptedExplicitNoneReasons?.includes(resolution.reasonCode)
  )
    return {
      ...base,
      code: "invalid_explicit_none_reason",
      message: `${requirement.label} uses an unsupported explicit-none reason.`,
    };
  const evidence = evidenceFor(resolution);
  if (requirement.evidenceRequired && !evidence.length)
    return {
      ...base,
      code: "evidence_missing",
      message: `${requirement.label} has no field-level evidence.`,
    };
  if (
    evidence.length &&
    !authorityAllowed(
      evidence.map((item) => item.authority),
      requirement,
    )
  )
    return {
      ...base,
      code: "authority_mismatch",
      message: `${requirement.label} is not supported by an accepted source authority.`,
    };
  return null;
}

export function evaluateBenefitRequirements({
  definition,
  gate,
  resolutions,
  renderedPaths = [],
}: {
  definition: BenefitRequirementDefinition;
  gate: RequirementGate;
  resolutions: ResolutionMap;
  renderedPaths?: Iterable<string>;
}) {
  const rendered = new Set(renderedPaths);
  const issues: RequirementIssue[] = [];
  const applicableRequirementIds: string[] = [];

  for (const field of definition.fields) {
    const configuredLevel = field.levels[gate];
    if (!configuredLevel) continue;
    const level =
      configuredLevel === "optional" && rendered.has(field.path)
        ? "required"
        : configuredLevel;
    if (level === "optional") continue;
    if (level === "conditional") {
      if (!field.when) {
        issues.push({
          requirementId: field.id,
          path: field.path,
          code: "condition_unknown",
          blockerCode: field.blockerCode,
          message: `${field.label} is conditional but has no predicate.`,
        });
        continue;
      }
      const result = evaluatePredicate(field.when, resolutions);
      if (result === false) continue;
      if (result === "unknown") {
        issues.push({
          requirementId: field.id,
          path: field.path,
          code: "condition_unknown",
          blockerCode: field.blockerCode,
          message: `The applicability of ${field.label} could not be determined.`,
        });
        continue;
      }
    }
    applicableRequirementIds.push(field.id);
    const issue = resolutionIssue(field, resolutions[field.path]);
    if (issue) issues.push(issue);
  }

  return {
    passed: issues.length === 0,
    gate,
    applicableRequirementIds,
    issues,
  };
}
