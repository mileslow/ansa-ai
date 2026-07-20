import { z } from "zod";
import type { BenefitType } from "../booklet-types";
import {
  BENEFIT_REQUIREMENTS_REGISTRY,
  collectPredicateDependencies,
} from "./index";

export const BENEFIT_TYPE_VALUES = [
  "medical",
  "dental",
  "vision",
  "life",
  "std",
  "ltd",
  "eap",
  "voluntary",
  "telemedicine",
  "hsa",
  "hra",
  "fsa",
] as const satisfies readonly BenefitType[];

export const BenefitTypeSchema = z.enum(BENEFIT_TYPE_VALUES);

const CandidateScalarSchema = z.union([z.string(), z.number(), z.boolean()]);

/**
 * The Responses API rejects arbitrary-key objects in strict JSON schemas
 * (`propertyNames` is unsupported). Structured values therefore travel as
 * JSON text and are parsed only after the benefit-specific contract accepts
 * the candidate and its registry path.
 */
export const RequirementCandidateOutputSchema = z.object({
  benefitType: BenefitTypeSchema,
  planOrProgramName: z.string().nullable(),
  planOrProgramId: z.string().nullable(),
  path: z.string(),
  state: z.enum(["known", "explicit_none", "not_applicable", "not_found"]),
  value: z.union([CandidateScalarSchema, z.array(CandidateScalarSchema)]).nullable(),
  valueJson: z.string().nullable(),
  rawValue: z.string().nullable(),
  reasonCode: z.string().nullable(),
  page: z.number().int().positive().nullable(),
  quote: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type RequirementCandidateOutput = z.infer<
  typeof RequirementCandidateOutputSchema
>;

export type BenefitExtractionContract = {
  benefitType: BenefitType;
  entityKind: (typeof BENEFIT_REQUIREMENTS_REGISTRY)[BenefitType]["entityKind"];
  fieldPaths: string[];
  dependencyPaths: string[];
  allowedPaths: string[];
};

const dependencies = collectPredicateDependencies();

export const BENEFIT_EXTRACTION_CONTRACTS = Object.fromEntries(
  BENEFIT_TYPE_VALUES.map((benefitType) => {
    const definition = BENEFIT_REQUIREMENTS_REGISTRY[benefitType];
    const fieldPaths = definition.fields.map((field) => field.path);
    const dependencyPaths = dependencies[benefitType];
    return [
      benefitType,
      {
        benefitType,
        entityKind: definition.entityKind,
        fieldPaths,
        dependencyPaths,
        allowedPaths: [...new Set([...fieldPaths, ...dependencyPaths])],
      },
    ];
  }),
) as Record<BenefitType, BenefitExtractionContract>;

function candidateSchema(benefitType: BenefitType) {
  const contract = BENEFIT_EXTRACTION_CONTRACTS[benefitType];
  const allowedPaths = contract.allowedPaths as [string, ...string[]];
  return RequirementCandidateOutputSchema.extend({
    benefitType: z.literal(benefitType),
    path: z.enum(allowedPaths),
  }).superRefine((candidate, context) => {
    const requirement = BENEFIT_REQUIREMENTS_REGISTRY[benefitType].fields.find(
      (field) => field.path === candidate.path,
    );
    if (
      candidate.state === "known" &&
      candidate.value === null &&
      candidate.valueJson === null
    )
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "A known candidate needs value or valueJson.",
      });
    if (candidate.valueJson !== null) {
      try {
        JSON.parse(candidate.valueJson);
      } catch {
        context.addIssue({
          code: "custom",
          path: ["valueJson"],
          message: "valueJson must contain valid JSON.",
        });
      }
    }
    if (candidate.state === "explicit_none") {
      const accepted = requirement?.acceptedExplicitNoneReasons || [];
      if (!candidate.reasonCode || !accepted.includes(candidate.reasonCode))
        context.addIssue({
          code: "custom",
          path: ["reasonCode"],
          message: `Unsupported explicit_none reason for ${candidate.path}.`,
        });
    }
    if (candidate.state === "not_applicable") {
      const accepted = requirement?.acceptedNotApplicableReasons || [];
      if (!candidate.reasonCode || !accepted.includes(candidate.reasonCode))
        context.addIssue({
          code: "custom",
          path: ["reasonCode"],
          message: `Unsupported not_applicable reason for ${candidate.path}.`,
        });
    }
  });
}

export const BENEFIT_REQUIREMENT_CANDIDATE_SCHEMAS = Object.fromEntries(
  BENEFIT_TYPE_VALUES.map((benefitType) => [
    benefitType,
    candidateSchema(benefitType),
  ]),
) as Record<BenefitType, ReturnType<typeof candidateSchema>>;

export function validateRequirementCandidateOutput(
  candidate: RequirementCandidateOutput,
) {
  return BENEFIT_REQUIREMENT_CANDIDATE_SCHEMAS[
    candidate.benefitType
  ].safeParse(candidate);
}

function pathSignature(path: string) {
  return path.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const REQUIREMENT_PATH_ALIASES = new Map(
  Object.entries({
    "std.definition": "std.disabilityDefinition",
    "std.earnings": "std.coveredEarningsDefinition",
    "std.formula": "std.benefitFormula",
    "std.duration": "std.maximumBenefitDuration",
    "std.offsets": "std.deductibleIncomeAndOffsets",
    "std.access": "std.claimOrAccess",
    "std.limitation-preexistingCondition.terms":
      "std.limitations.preexistingCondition.terms",
    "std.limitation-mentalNervous.terms":
      "std.limitations.mentalNervous.terms",
    "std.limitation-mentalNervous":
      "std.limitations.mentalNervous.terms",
    "std.limitation-substanceUse.terms":
      "std.limitations.substanceUse.terms",
    "std.limitation-substanceUse":
      "std.limitations.substanceUse.terms",
    "std.limitation-selfReportedSymptoms.terms":
      "std.limitations.selfReportedSymptoms.terms",
    "std.limitation-selfReportedSymptoms":
      "std.limitations.selfReportedSymptoms.terms",
    "ltd.definition": "ltd.disabilityDefinition",
    "ltd.earnings": "ltd.coveredEarningsDefinition",
    "ltd.offsets": "ltd.deductibleIncomeAndOffsets",
    "ltd.limitation-preexistingCondition.terms":
      "ltd.limitations.preexistingCondition.terms",
    "ltd.limitation-mentalNervous.terms":
      "ltd.limitations.mentalNervous.terms",
    "ltd.limitation-mentalNervous":
      "ltd.limitations.mentalNervous.terms",
    "ltd.limitation-substanceUse.terms":
      "ltd.limitations.substanceUse.terms",
    "ltd.limitation-substanceUse":
      "ltd.limitations.substanceUse.terms",
    "ltd.limitation-selfReportedSymptoms.terms":
      "ltd.limitations.selfReportedSymptoms.terms",
    "ltd.limitation-selfReportedSymptoms":
      "ltd.limitations.selfReportedSymptoms.terms",
    "ltd.formalClaimsReference":
      "ltd.formalDisclosure.claimsAndAppealsReference",
    "std.formalClaimsReference":
      "std.formalDisclosure.claimsAndAppealsReference",
    "hra.integration.linked_group_health_plans":
      "hra.integration.linkedGroupHealthPlanIds",
    "hsa.eligibility.linked_medical_plans":
      "hsa.eligibility.linkedMedicalPlanIds",
    "voluntary.safeBookletSummary":
      "voluntary.products[].safeBookletSummary",
    "voluntary.booklet-summary":
      "voluntary.products[].safeBookletSummary",
    "voluntary.access": "voluntary.claimOrAccess",
    "life.access": "life.claimOrAccess",
    "eap.access": "eap.claimOrAccess",
    "telemedicine.access": "telemedicine.claimOrAccess",
    "life.formal-claims-reference":
      "life.formalDisclosure.claimsAndAppealsReference",
  }).map(([alias, canonical]) => [pathSignature(alias), canonical]),
);

/**
 * Recover a unique case/punctuation-equivalent registry path when a model
 * restyles camelCase as snake_case or kebab-case. Semantic aliases still fail
 * closed instead of being guessed.
 */
export function canonicalizeRequirementCandidatePath(
  candidate: RequirementCandidateOutput,
): RequirementCandidateOutput {
  const allowedPaths =
    BENEFIT_EXTRACTION_CONTRACTS[candidate.benefitType].allowedPaths;
  if (allowedPaths.includes(candidate.path)) return candidate;
  const signature = pathSignature(candidate.path);
  const explicitAlias = REQUIREMENT_PATH_ALIASES.get(signature);
  if (explicitAlias && allowedPaths.includes(explicitAlias))
    return { ...candidate, path: explicitAlias };
  const matches = allowedPaths.filter(
    (allowedPath) => pathSignature(allowedPath) === signature,
  );
  return matches.length === 1 ? { ...candidate, path: matches[0] } : candidate;
}
