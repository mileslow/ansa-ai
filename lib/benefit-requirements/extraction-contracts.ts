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
