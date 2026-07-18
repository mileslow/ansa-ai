import type { BenefitType } from "../booklet-types";

/**
 * The registry intentionally separates extraction, booklet publishing, and
 * formal-disclosure completeness. Passing one gate never implies another.
 */
export type RequirementGate =
  | "complete_extraction"
  | "safe_booklet"
  | "formal_disclosure";

export type RequirementLevel = "required" | "conditional" | "optional";

export type SourceAuthority =
  | "current_plan_document"
  | "current_amendment_or_rider"
  | "employer_selection"
  | "employer_eligibility"
  | "rate_or_contribution"
  | "administrator_material"
  | "manual_answer"
  | "regulatory_source"
  | "approved_boilerplate"
  | "prior_year_context"
  | "generic_marketing"
  /** A classifier that could not establish a usable authority fails closed. */
  | "unknown";

export type EvidenceLocator =
  | { kind: "pdf"; page: number; quote?: string; boundingBox?: number[] }
  | { kind: "sheet"; sheet: string; row?: number; cellRange?: string; quote?: string }
  | { kind: "text"; start: number; end: number; quote?: string };

export type RequirementEvidence = {
  /** Stable when supplied by the extractor; otherwise derived from the record. */
  id?: string;
  sourceFileId: string;
  sourceFileName?: string;
  authority: SourceAuthority;
  authorityDomain:
    | "offering"
    | "identity"
    | "plan_design"
    | "eligibility"
    | "rate"
    | "contribution"
    | "contact"
    | "legal_or_regulatory"
    | "approved_language";
  effectiveStart?: string;
  effectiveEnd?: string;
  employerOrGroupId?: string;
  planOrProgramId?: string;
  locator?: EvidenceLocator;
  extractionMethod: "text" | "ocr" | "table" | "spreadsheet" | "manual" | "derived";
  extractorVersion?: string;
  confidence?: number;
  parentEvidenceIds?: string[];
  transformId?: string;
};

export type FieldResolution<T = unknown> =
  | { status: "known"; value: T; evidence: RequirementEvidence[] }
  | {
      status: "explicit_none";
      reasonCode: string;
      evidence: RequirementEvidence[];
    }
  | {
      status: "not_applicable";
      reasonCode: string;
      evidence: RequirementEvidence[];
    }
  | {
      status: "not_found";
      searchedSourceFileIds: string[];
    }
  | {
      status: "unknown";
      reasonCode: string;
      expectedSourceKinds?: string[];
    }
  | {
      status: "conflicting";
      candidates: Array<{ value: T; evidence: RequirementEvidence[] }>;
    }
  | {
      status: "requires_legal_determination";
      issueCode: string;
      evidence: RequirementEvidence[];
    }
  | {
      status: "not_offered";
      evidence: RequirementEvidence[];
    };

export type ResolutionMap = Record<string, FieldResolution | undefined>;

export type ExtractedRequirementCandidate = {
  subjectHint: {
    benefitType: BenefitType;
    planOrProgramName?: string;
    planOrProgramId?: string;
  };
  path: string;
  state: "known" | "explicit_none" | "not_applicable" | "not_found";
  value?: unknown;
  /** Source wording is retained even when value is normalized. */
  rawValue?: string;
  reasonCode?: string;
  evidence: RequirementEvidence;
  confidence: number;
};

export type RequirementIssue = {
  requirementId: string;
  path: string;
  code:
    | "condition_unknown"
    | "missing"
    | "conflicting"
    | "legal_determination_required"
    | "not_offered"
    | "evidence_missing"
    | "authority_mismatch"
    | "invalid_not_applicable_reason"
    | "invalid_explicit_none_reason";
  blockerCode?: string;
  message: string;
};

export type BenefitRequirementSubject = {
  id: string;
  benefitType: BenefitType;
  entityKind: "plan" | "account" | "program" | "product_collection";
  displayName: string;
  employerOrGroupId: string;
  planOrProgramId?: string;
  effectiveStart?: string;
  effectiveEnd?: string;
  resolutions: ResolutionMap;
  enforcementStatus: "registry_enforced" | "legacy_unenforced";
};

export type BenefitGateReport = {
  subjectId: string;
  benefitType: BenefitType;
  gate: RequirementGate;
  passed: boolean;
  applicableRequirementIds: string[];
  issues: RequirementIssue[];
};

/** Serializable predicates keep requirement decisions auditable and testable. */
export type RequirementPredicate =
  | { op: "field_present"; path: string }
  | { op: "field_equals"; path: string; value: unknown }
  | { op: "field_in"; path: string; values: unknown[] }
  | { op: "field_contains"; path: string; value: unknown }
  | { op: "all"; predicates: RequirementPredicate[] }
  | { op: "any"; predicates: RequirementPredicate[] }
  | { op: "not"; predicate: RequirementPredicate };

export type GateLevels = Partial<Record<RequirementGate, RequirementLevel>>;

export type BenefitFieldRequirement = {
  id: string;
  path: string;
  label: string;
  description: string;
  levels: GateLevels;
  /** Required whenever a gate marks the field conditional. */
  when?: RequirementPredicate;
  material: boolean;
  evidenceRequired: boolean;
  acceptedAuthorities: SourceAuthority[];
  acceptedNotApplicableReasons?: string[];
  acceptedExplicitNoneReasons?: string[];
  validatorIds?: string[];
  blockerCode?: string;
  renderPolicy: "render" | "omit_when_absent" | "reference_governing_document" | "never_render";
};

export type BenefitInvariant = {
  id: string;
  description: string;
  gates: RequirementGate[];
};

export type ResearchSource = {
  title: string;
  url: string;
  authority: "federal" | "state" | "official_plan" | "official_program";
};

export type BenefitRequirementDefinition = {
  benefitType: BenefitType;
  title: string;
  entityKind: "plan" | "account" | "program" | "product_collection";
  fields: BenefitFieldRequirement[];
  invariants: BenefitInvariant[];
  researchSources: ResearchSource[];
  /** Formal notices/SPDs require a separate applicability and delivery engine. */
  formalDisclosureRequiresSeparateApplicability: true;
};

export type BenefitRequirementsRegistry = Record<
  BenefitType,
  BenefitRequirementDefinition
>;

export function requirement(
  value: BenefitFieldRequirement,
): BenefitFieldRequirement {
  return value;
}

export const employerPlanAuthorities: SourceAuthority[] = [
  "current_plan_document",
  "current_amendment_or_rider",
  "employer_selection",
  "employer_eligibility",
  "rate_or_contribution",
  "manual_answer",
];

export const planDesignAuthorities: SourceAuthority[] = [
  "current_plan_document",
  "current_amendment_or_rider",
  "manual_answer",
];

export const employerOfferingAuthorities: SourceAuthority[] = [
  "employer_selection",
  "employer_eligibility",
  "rate_or_contribution",
  "manual_answer",
];

export const regulatoryAuthorities: SourceAuthority[] = [
  "regulatory_source",
  "approved_boilerplate",
];
