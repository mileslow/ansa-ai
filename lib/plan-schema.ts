import { z } from "zod";

const nullableText = z.string().nullable();
const nullableBoolean = z.boolean().nullable();
const sourcePages = z.array(z.number().int().positive());

export const TranscriptSchema = z.object({
  pages: z.array(
    z.object({
      pageNumber: z.number().int().positive(),
      text: z.string(),
    }),
  ),
});

const ContactSchema = z.object({
  label: z.string(),
  organization: nullableText,
  phone: nullableText,
  email: nullableText,
  url: nullableText,
  purpose: nullableText,
});

const LimitSchema = z.object({
  individual: nullableText,
  family: nullableText,
  embeddedIndividual: nullableText,
  period: nullableText,
  raw: z.string(),
});

export const IdentityPhaseSchema = z.object({
  identity: z.object({
    documentType: z.string(),
    carrier: nullableText,
    planName: z.string(),
    planId: nullableText,
    groupName: nullableText,
    coverageStart: nullableText,
    coverageEnd: nullableText,
    coverageFor: nullableText,
    planType: nullableText,
    networkName: nullableText,
    market: nullableText,
    state: nullableText,
    fundingType: nullableText,
    metalTier: nullableText,
    hsaEligible: nullableBoolean,
    sourcePages,
  }),
  financial: z.object({
    deductible: LimitSchema,
    familyDeductibleRule: nullableText,
    servicesBeforeDeductible: z.array(z.string()),
    servicesBeforeDeductibleNotes: nullableText,
    specificDeductibles: z.array(
      z.object({
        service: z.string(),
        individual: nullableText,
        family: nullableText,
        notes: nullableText,
      }),
    ),
    outOfPocketLimit: LimitSchema,
    familyOutOfPocketRule: nullableText,
    excludedFromOutOfPocket: z.array(z.string()),
    sourcePages,
  }),
  network: z.object({
    usesProviderNetwork: nullableBoolean,
    outOfNetworkCoverage: nullableText,
    referralRequired: nullableBoolean,
    referralNotes: nullableText,
    balanceBillingWarning: nullableText,
    emergencyCoverageNotes: nullableText,
    providerDirectoryUrl: nullableText,
    sourcePages,
  }),
  contacts: z.array(ContactSchema),
});

const CostShareSchema = z.object({
  networkTier: z.string(),
  cost: z.string(),
  deductibleApplies: nullableBoolean,
  notes: nullableText,
});

const ServiceSchema = z.object({
  medicalEvent: z.string(),
  service: z.string(),
  inNetwork: z.array(CostShareSchema),
  outOfNetwork: z.array(CostShareSchema),
  limitations: nullableText,
  preauthorization: nullableText,
  visitOrUnitLimit: nullableText,
  ageLimit: nullableText,
  rawNotes: nullableText,
  sourcePage: z.number().int().positive(),
});

export const CostsPhaseSchema = z.object({
  services: z.array(ServiceSchema),
  prescriptions: z.object({
    drugListUrl: nullableText,
    pharmacyNetworkNotes: nullableText,
    retailSupply: nullableText,
    mailOrderSupply: nullableText,
    priorAuthorizationNotes: nullableText,
    stepTherapyNotes: nullableText,
    specialtyDrugNotes: nullableText,
    tiers: z.array(
      z.object({
        name: z.string(),
        description: nullableText,
        retailCost: nullableText,
        mailOrderCost: nullableText,
        outOfNetworkCost: nullableText,
        deductibleApplies: nullableBoolean,
        limitations: nullableText,
        sourcePage: z.number().int().positive(),
      }),
    ),
    sourcePages,
  }),
});

const CoverageExampleSchema = z.object({
  name: z.string(),
  scenario: z.string(),
  assumptions: z.array(z.object({ label: z.string(), value: z.string() })),
  includedServices: z.array(z.string()),
  totalExampleCost: nullableText,
  memberPays: z.object({
    deductibles: nullableText,
    copayments: nullableText,
    coinsurance: nullableText,
    limitsOrExclusions: nullableText,
    total: nullableText,
  }),
  sourcePage: z.number().int().positive(),
});

export const CoveragePhaseSchema = z.object({
  exclusions: z.array(
    z.object({
      service: z.string(),
      notes: nullableText,
      sourcePages,
    }),
  ),
  otherCoveredServices: z.array(
    z.object({
      service: z.string(),
      limitations: nullableText,
      sourcePages,
    }),
  ),
  legal: z.object({
    continuationRights: nullableText,
    grievanceAndAppealsRights: nullableText,
    minimumEssentialCoverage: nullableBoolean,
    minimumValueStandard: nullableBoolean,
    marketplaceNotes: nullableText,
    contacts: z.array(ContactSchema),
    sourcePages,
  }),
  languageAccess: z.array(
    z.object({
      language: z.string(),
      message: z.string(),
      phone: nullableText,
      sourcePage: z.number().int().positive(),
    }),
  ),
  coverageExamples: z.array(CoverageExampleSchema),
  notices: z.array(
    z.object({
      heading: z.string(),
      text: z.string(),
      sourcePages,
    }),
  ),
  extractionWarnings: z.array(z.string()),
});

export const MedicalPlanAttributesSchema = IdentityPhaseSchema.merge(
  CostsPhaseSchema,
).merge(CoveragePhaseSchema);

export type Transcript = z.infer<typeof TranscriptSchema>;
export type IdentityPhase = z.infer<typeof IdentityPhaseSchema>;
export type CostsPhase = z.infer<typeof CostsPhaseSchema>;
export type CoveragePhase = z.infer<typeof CoveragePhaseSchema>;
export type MedicalPlanAttributes = z.infer<typeof MedicalPlanAttributesSchema>;

export const PLAN_ATTRIBUTE_GROUPS = [
  "identity",
  "financial",
  "network",
  "contacts",
  "services",
  "prescriptions",
  "exclusions",
  "otherCoveredServices",
  "legal",
  "languageAccess",
  "coverageExamples",
  "notices",
  "extractionWarnings",
] as const;
