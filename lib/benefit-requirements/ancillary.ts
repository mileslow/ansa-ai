import {
  employerOfferingAuthorities,
  employerPlanAuthorities,
  planDesignAuthorities,
  regulatoryAuthorities,
  requirement,
  type BenefitFieldRequirement,
  type BenefitRequirementDefinition,
  type GateLevels,
  type RequirementPredicate,
  type SourceAuthority,
} from "./types";

const administratorAuthorities: SourceAuthority[] = [
  "current_plan_document",
  "current_amendment_or_rider",
  "administrator_material",
  "employer_selection",
  "manual_answer",
];

const rateAuthorities: SourceAuthority[] = [
  "rate_or_contribution",
  "employer_selection",
  "current_plan_document",
  "manual_answer",
];

const formalAuthorities: SourceAuthority[] = [
  "current_plan_document",
  "current_amendment_or_rider",
  "administrator_material",
  "regulatory_source",
  "manual_answer",
];

const allGatesRequired: GateLevels = {
  complete_extraction: "required",
  safe_booklet: "required",
  formal_disclosure: "required",
};

const extractionAndBooklet: GateLevels = {
  complete_extraction: "required",
  safe_booklet: "required",
  formal_disclosure: "optional",
};

const extractionOnly: GateLevels = {
  complete_extraction: "required",
  safe_booklet: "optional",
  formal_disclosure: "optional",
};

const formalOnly: GateLevels = {
  formal_disclosure: "required",
};

function anyFieldContains(path: string, values: string[]): RequirementPredicate {
  return {
    op: "any",
    predicates: values.map((value) => ({
      op: "field_contains" as const,
      path,
      value,
    })),
  };
}

function anyFieldEquals(path: string, values: unknown[]): RequirementPredicate {
  return { op: "field_in", path, values };
}

type FieldInput = Omit<
  BenefitFieldRequirement,
  "material" | "evidenceRequired" | "acceptedAuthorities" | "renderPolicy"
> & {
  material?: boolean;
  evidenceRequired?: boolean;
  acceptedAuthorities?: SourceAuthority[];
  renderPolicy?: BenefitFieldRequirement["renderPolicy"];
};

function field(value: FieldInput): BenefitFieldRequirement {
  return requirement({
    material: value.material ?? true,
    evidenceRequired: value.evidenceRequired ?? true,
    acceptedAuthorities: value.acceptedAuthorities ?? planDesignAuthorities,
    renderPolicy: value.renderPolicy ?? "render",
    ...value,
  });
}

function commonPlanFields(prefix: string): BenefitFieldRequirement[] {
  return [
    field({
      id: `${prefix}.offering-status`,
      path: `${prefix}.offeringStatus`,
      label: "Employer offering status",
      description:
        "Current employer-specific evidence that the benefit is offered; carrier marketing alone cannot activate it.",
      levels: allGatesRequired,
      acceptedAuthorities: employerOfferingAuthorities,
      validatorIds: ["offering_status_is_offered", "evidence_matches_employer_and_period"],
      blockerCode: "ANCILLARY_OFFERING_UNCONFIRMED",
      renderPolicy: "never_render",
    }),
    field({
      id: `${prefix}.effective-period`,
      path: `${prefix}.effectivePeriod`,
      label: "Effective period",
      description: "Coverage start/end dates and benefit reset period where different.",
      levels: allGatesRequired,
      acceptedAuthorities: employerPlanAuthorities,
      validatorIds: ["valid_effective_period", "evidence_matches_plan_period"],
      blockerCode: "ANCILLARY_EFFECTIVE_PERIOD_MISSING",
      renderPolicy: "render",
    }),
    field({
      id: `${prefix}.administrator`,
      path: `${prefix}.administrator`,
      label: "Carrier or administrator",
      description:
        "Legal carrier/provider and the claims or program administrator when they differ.",
      levels: allGatesRequired,
      acceptedAuthorities: administratorAuthorities,
      validatorIds: ["administrator_identity_complete"],
      blockerCode: "ANCILLARY_ADMINISTRATOR_MISSING",
    }),
    field({
      id: `${prefix}.eligibility`,
      path: `${prefix}.eligibility`,
      label: "Eligibility",
      description:
        "Eligible classes, minimum hours, service waiting period, active-work rule, and dependent eligibility or an inherited employer rule reference.",
      levels: allGatesRequired,
      acceptedAuthorities: [
        "current_plan_document",
        "current_amendment_or_rider",
        "employer_eligibility",
        "employer_selection",
        "manual_answer",
      ],
      acceptedNotApplicableReasons: ["no_dependent_coverage", "eligibility_inherited_from_employer_rule"],
      validatorIds: ["eligibility_has_class_and_entry_rule"],
      blockerCode: "ANCILLARY_ELIGIBILITY_INCOMPLETE",
    }),
    field({
      id: `${prefix}.funding`,
      path: `${prefix}.fundingArrangement`,
      label: "Funding arrangement",
      description: "Employer-paid, employee-paid, or shared funding, kept distinct from tax treatment.",
      levels: allGatesRequired,
      acceptedAuthorities: rateAuthorities,
      validatorIds: ["funding_enum_valid"],
      blockerCode: "ANCILLARY_FUNDING_UNKNOWN",
    }),
    field({
      id: `${prefix}.employee-cost`,
      path: `${prefix}.employeeCost`,
      label: "Employee cost",
      description:
        "Exact employee rate/formula and payroll unit, or source-backed zero cost for employer-paid coverage.",
      levels: extractionAndBooklet,
      acceptedAuthorities: rateAuthorities,
      acceptedExplicitNoneReasons: ["employer_pays_full_cost", "program_has_no_employee_cost"],
      validatorIds: ["cost_matches_funding", "money_and_payroll_unit_complete"],
      blockerCode: "ANCILLARY_EMPLOYEE_COST_MISSING",
    }),
    field({
      id: `${prefix}.access`,
      path: `${prefix}.claimOrAccess`,
      label: "Claim or access instructions",
      description: "Current claim/access channel, contact, URL/app, and required identifier or form reference.",
      levels: allGatesRequired,
      acceptedAuthorities: administratorAuthorities,
      validatorIds: ["contact_has_reachable_channel", "contact_evidence_current"],
      blockerCode: "ANCILLARY_ACCESS_MISSING",
    }),
    field({
      id: `${prefix}.governing-document`,
      path: `${prefix}.governingDocumentReference`,
      label: "Governing document reference",
      description: "Current policy, certificate, plan document, or program terms that control over the booklet summary.",
      levels: {
        complete_extraction: "required",
        safe_booklet: "optional",
        formal_disclosure: "required",
      },
      acceptedAuthorities: formalAuthorities,
      validatorIds: ["reference_resolves_to_current_document"],
      blockerCode: "ANCILLARY_GOVERNING_DOCUMENT_MISSING",
      renderPolicy: "reference_governing_document",
    }),
    field({
      id: `${prefix}.formal-applicability`,
      path: `${prefix}.formalDisclosure.applicability`,
      label: "Formal disclosure applicability",
      description:
        "Separate legal/compliance determination of ERISA, insurance, state, and notice applicability; a booklet gate never decides this.",
      levels: formalOnly,
      acceptedAuthorities: formalAuthorities,
      validatorIds: ["formal_applicability_determined"],
      blockerCode: "ANCILLARY_FORMAL_APPLICABILITY_UNRESOLVED",
      renderPolicy: "never_render",
    }),
    field({
      id: `${prefix}.formal-claims-reference`,
      path: `${prefix}.formalDisclosure.claimsAndAppealsReference`,
      label: "Formal claims and appeals reference",
      description: "Applicable claims, review, and appeal procedures or an authoritative incorporated reference.",
      levels: formalOnly,
      acceptedAuthorities: formalAuthorities,
      validatorIds: ["formal_claims_reference_complete"],
      blockerCode: "ANCILLARY_FORMAL_CLAIMS_MISSING",
      renderPolicy: "reference_governing_document",
    }),
  ];
}

const disabilityStatePredicate = {
  op: "any",
  predicates: ["CA", "HI", "NJ", "NY", "RI"].map((value) => ({
    op: "field_contains" as const,
    path: "employment.workStates",
    value,
  })),
} satisfies RequirementPredicate;

export const lifeRequirements: BenefitRequirementDefinition = {
  benefitType: "life",
  title: "Life and accidental death & dismemberment",
  entityKind: "product_collection",
  fields: [
    ...commonPlanFields("life"),
    field({
      id: "life.product-subtypes",
      path: "life.productSubtypes",
      label: "Separate life and AD&D product subtypes",
      description:
        "Separate basic employee life, basic AD&D, supplemental employee life, spouse life, child life, and voluntary AD&D records.",
      levels: allGatesRequired,
      acceptedAuthorities: employerPlanAuthorities,
      validatorIds: ["life_subtypes_allowed", "life_subtype_records_not_collapsed"],
      blockerCode: "LIFE_SUBTYPE_UNRESOLVED",
      renderPolicy: "never_render",
    }),
    field({
      id: "life.coverage-lifecycle",
      path: "life.coverageLifecycle",
      label: "Coverage lifecycle",
      description:
        "Automatic/elective status, initial eligibility window, active-work/effective-state rules, late entry, termination, and continuation events.",
      levels: extractionOnly,
      acceptedAuthorities: employerPlanAuthorities,
      validatorIds: ["coverage_lifecycle_complete"],
      blockerCode: "LIFE_LIFECYCLE_INCOMPLETE",
      renderPolicy: "omit_when_absent",
    }),
    field({
      id: "life.formula",
      path: "life.products[].benefitFormula",
      label: "Life benefit formula",
      description: "Per-product flat amount, salary multiple, graded schedule, rounding, minimum, and maximum.",
      levels: allGatesRequired,
      acceptedAuthorities: planDesignAuthorities,
      validatorIds: ["life_formula_complete", "life_amounts_nonnegative"],
      blockerCode: "LIFE_FORMULA_INCOMPLETE",
    }),
    field({
      id: "life.salary-definition",
      path: "life.products[].salaryDefinition",
      label: "Covered salary definition",
      description: "The earnings definition used by every salary-based life formula.",
      levels: {
        complete_extraction: "conditional",
        safe_booklet: "conditional",
        formal_disclosure: "conditional",
      },
      when: { op: "field_equals", path: "life.hasSalaryBasedFormula", value: true },
      acceptedAuthorities: planDesignAuthorities,
      validatorIds: ["salary_definition_has_inclusions_exclusions_period"],
      blockerCode: "LIFE_SALARY_DEFINITION_MISSING",
    }),
    field({
      id: "life.eoi-status",
      path: "life.evidenceOfInsurability.status",
      label: "Evidence-of-insurability status",
      description:
        "Source-backed status showing whether guaranteed issue, EOI, or no underwriting applies; absence is not no EOI.",
      levels: extractionOnly,
      acceptedAuthorities: planDesignAuthorities,
      acceptedExplicitNoneReasons: ["no_eoi_required_for_any_available_amount"],
      validatorIds: ["eoi_status_enum_valid"],
      blockerCode: "LIFE_EOI_STATUS_UNKNOWN",
      renderPolicy: "never_render",
    }),
    field({
      id: "life.eoi-rules",
      path: "life.evidenceOfInsurability.rules",
      label: "Guaranteed issue and EOI rules",
      description:
        "Guaranteed-issue/non-medical maximum, EOI threshold, late-entry and increase events, and approval-dependent effective date.",
      levels: {
        complete_extraction: "conditional",
        safe_booklet: "conditional",
        formal_disclosure: "conditional",
      },
      when: anyFieldContains("life.productSubtypes", [
        "supplemental_employee_life",
        "supplemental_spouse_life",
        "voluntary_life",
      ]),
      acceptedAuthorities: planDesignAuthorities,
      acceptedExplicitNoneReasons: ["no_eoi_required_for_any_available_amount"],
      validatorIds: ["guaranteed_issue_not_above_maximum", "eoi_triggers_complete"],
      blockerCode: "LIFE_EOI_RULES_INCOMPLETE",
    }),
    field({
      id: "life.dependent-options",
      path: "life.dependentOptions",
      label: "Spouse and child life options",
      description: "Eligible dependents, employee-coverage prerequisite, increments, maxima, EOI, and termination ages.",
      levels: {
        complete_extraction: "conditional",
        safe_booklet: "conditional",
        formal_disclosure: "conditional",
      },
      when: anyFieldContains("life.productSubtypes", ["supplemental_spouse_life", "supplemental_child_life"]),
      acceptedAuthorities: planDesignAuthorities,
      validatorIds: ["dependent_options_complete", "dependent_max_not_above_employee_limit"],
      blockerCode: "LIFE_DEPENDENT_OPTIONS_INCOMPLETE",
    }),
    field({
      id: "life.adnd-schedule",
      path: "life.adnd.coveredLossSchedule",
      label: "AD&D covered-loss schedule",
      description:
        "AD&D principal sum, covered-loss percentages/amounts, loss timing, caps, and material exclusions; never infer equality to life coverage.",
      levels: {
        complete_extraction: "conditional",
        safe_booklet: "conditional",
        formal_disclosure: "conditional",
      },
      when: anyFieldContains("life.productSubtypes", ["basic_adnd", "voluntary_adnd"]),
      acceptedAuthorities: planDesignAuthorities,
      validatorIds: ["adnd_schedule_rows_complete", "adnd_principal_sum_explicit"],
      blockerCode: "ADND_SCHEDULE_INCOMPLETE",
      renderPolicy: "reference_governing_document",
    }),
    ...[
      ["ageReduction", "Age-reduction schedule", "age_reduction_present"],
      ["acceleratedBenefit", "Accelerated death benefit", "accelerated_benefit_present"],
      ["waiverOfPremium", "Waiver of premium", "waiver_of_premium_present"],
      ["portability", "Portability", "portability_present"],
      ["conversion", "Conversion", "conversion_present"],
    ].map(([key, label, validator]) =>
      field({
        id: `life.feature-${key}`,
        path: `life.features.${key}.terms`,
        label,
        description: `${label} qualifying events, limits, deadlines, and termination conditions when the current contract includes the feature.`,
        levels: {
          complete_extraction: "conditional",
          safe_booklet: "conditional",
          formal_disclosure: "conditional",
        },
        when: { op: "field_equals", path: `life.features.${key}.offered`, value: true },
        acceptedAuthorities: planDesignAuthorities,
        validatorIds: [validator, "feature_terms_complete"],
        blockerCode: `LIFE_${key.toUpperCase()}_TERMS_MISSING`,
        renderPolicy: "reference_governing_document",
      }),
    ),
    field({
      id: "life.age-reduction-statuses",
      path: "life.features.statuses",
      label: "Life optional-feature statuses",
      description:
        "Explicit offered/not-offered status for age reductions, accelerated benefit, waiver, portability, and conversion.",
      levels: extractionOnly,
      acceptedAuthorities: planDesignAuthorities,
      acceptedExplicitNoneReasons: ["feature_not_in_current_contract"],
      validatorIds: ["feature_statuses_cover_registry"],
      blockerCode: "LIFE_FEATURE_STATUS_INCOMPLETE",
      renderPolicy: "never_render",
    }),
  ],
  invariants: [
    {
      id: "life.products-separate",
      description: "Life, AD&D, employee, spouse, and child coverages remain separate records with independent amounts and evidence.",
      gates: ["complete_extraction", "safe_booklet", "formal_disclosure"],
    },
    {
      id: "life.adnd-not-inferred",
      description: "AD&D principal sum may equal life only when current plan evidence says so.",
      gates: ["complete_extraction", "safe_booklet"],
    },
    {
      id: "life.cost-funding-consistent",
      description: "Employer-paid coverage resolves employee cost to source-backed zero; contributory coverage has complete rates and units.",
      gates: ["complete_extraction", "safe_booklet"],
    },
  ],
  researchSources: [
    {
      title: "29 CFR 2520.102-3 — welfare plan SPD contents",
      url: "https://www.law.cornell.edu/cfr/text/29/2520.102-3",
      authority: "federal",
    },
    {
      title: "The Standard — Group Life Insurance certificate",
      url: "https://www.standard.com/eforms/21646_135262.pdf",
      authority: "official_plan",
    },
    {
      title: "Unum — Group Life Insurance plan features",
      url: "https://www.unum.com/employers/employee-benefits/life-insurance",
      authority: "official_program",
    },
  ],
  formalDisclosureRequiresSeparateApplicability: true,
};

function disabilityBaseFields(kind: "std" | "ltd"): BenefitFieldRequirement[] {
  const label = kind === "std" ? "STD" : "LTD";
  return [
    ...commonPlanFields(kind),
    field({
      id: `${kind}.product-subtype`,
      path: `${kind}.productSubtype`,
      label: `${label} product subtype`,
      description: `Employer-paid, shared, voluntary, or statutory/private-plan ${label} identity.`,
      levels: allGatesRequired,
      acceptedAuthorities: employerPlanAuthorities,
      validatorIds: [`${kind}_subtype_valid`],
      blockerCode: `${label}_SUBTYPE_UNKNOWN`,
      renderPolicy: "never_render",
    }),
    field({
      id: `${kind}.definition`,
      path: `${kind}.disabilityDefinition`,
      label: "Definition of disability",
      description: "Covered disability definition, occupation standard, earnings-loss threshold, and regular-care requirements.",
      levels: allGatesRequired,
      acceptedAuthorities: planDesignAuthorities,
      validatorIds: ["disability_definition_complete"],
      blockerCode: `${label}_DEFINITION_MISSING`,
      renderPolicy: "reference_governing_document",
    }),
    field({
      id: `${kind}.earnings`,
      path: `${kind}.coveredEarningsDefinition`,
      label: "Covered earnings definition",
      description: "Pay components, averaging period, exclusions, and pre-disability measurement used by the formula.",
      levels: allGatesRequired,
      acceptedAuthorities: planDesignAuthorities,
      validatorIds: ["earnings_definition_complete"],
      blockerCode: `${label}_EARNINGS_DEFINITION_MISSING`,
    }),
    field({
      id: `${kind}.formula`,
      path: `${kind}.benefitFormula`,
      label: "Disability benefit formula",
      description: `Benefit percentage/formula plus ${kind === "std" ? "weekly" : "monthly"} minimum and maximum before and after offsets.`,
      levels: allGatesRequired,
      acceptedAuthorities: planDesignAuthorities,
      acceptedExplicitNoneReasons: ["policy_has_no_minimum_benefit"],
      validatorIds: ["benefit_percentage_valid", "benefit_maximum_has_period", "formula_qualifiers_complete"],
      blockerCode: `${label}_FORMULA_INCOMPLETE`,
    }),
    field({
      id: `${kind}.elimination-period`,
      path: `${kind}.eliminationPeriod`,
      label: kind === "std" ? "Benefit waiting periods" : "Elimination period",
      description:
        kind === "std"
          ? "Separate injury and sickness waiting periods, including hospitalization exceptions."
          : "Continuous-disability period before LTD benefits begin and any interruption rules.",
      levels: allGatesRequired,
      acceptedAuthorities: planDesignAuthorities,
      validatorIds: ["elimination_period_has_unit", `${kind}_elimination_qualifiers_complete`],
      blockerCode: `${label}_ELIMINATION_PERIOD_MISSING`,
    }),
    field({
      id: `${kind}.duration`,
      path: `${kind}.maximumBenefitDuration`,
      label: "Maximum benefit duration",
      description: "Maximum period, end conditions, and any age-based duration schedule.",
      levels: allGatesRequired,
      acceptedAuthorities: planDesignAuthorities,
      validatorIds: ["duration_has_unit_or_age_schedule", "duration_end_conditions_complete"],
      blockerCode: `${label}_DURATION_MISSING`,
    }),
    field({
      id: `${kind}.offsets`,
      path: `${kind}.deductibleIncomeAndOffsets`,
      label: "Deductible income and offsets",
      description: "Named offset sources, order/formula, minimum benefit interaction, and integration with wages or other benefits.",
      levels: allGatesRequired,
      acceptedAuthorities: planDesignAuthorities,
      acceptedExplicitNoneReasons: ["policy_has_no_deductible_income_or_offsets"],
      validatorIds: ["offsets_have_source_and_calculation"],
      blockerCode: `${label}_OFFSETS_UNRESOLVED`,
      renderPolicy: "reference_governing_document",
    }),
    field({
      id: `${kind}.partial-recurrent`,
      path: `${kind}.partialAndRecurrentDisability`,
      label: "Partial and recurrent disability",
      description: "Partial/residual calculation and recurrent-disability reset period.",
      levels: extractionOnly,
      acceptedAuthorities: planDesignAuthorities,
      acceptedExplicitNoneReasons: ["no_partial_or_residual_benefit", "no_recurrent_disability_rule"],
      validatorIds: ["partial_recurrent_terms_complete"],
      blockerCode: `${label}_PARTIAL_RECURRENT_UNRESOLVED`,
      renderPolicy: "omit_when_absent",
    }),
    field({
      id: `${kind}.limitation-statuses`,
      path: `${kind}.limitationStatuses`,
      label: "Disability limitation statuses",
      description: "Explicit status for preexisting-condition, mental/nervous, substance-use, and self-reported-symptom limitations.",
      levels: extractionOnly,
      acceptedAuthorities: planDesignAuthorities,
      acceptedExplicitNoneReasons: ["limitation_not_in_current_contract"],
      validatorIds: ["disability_limitation_statuses_complete"],
      blockerCode: `${label}_LIMITATION_STATUS_INCOMPLETE`,
      renderPolicy: "never_render",
    }),
    ...[
      ["preexistingCondition", "Preexisting-condition limitation"],
      ["mentalNervous", "Mental or nervous-condition limitation"],
      ["substanceUse", "Substance-use limitation"],
      ["selfReportedSymptoms", "Self-reported-symptom limitation"],
    ].map(([key, fieldLabel]) =>
      field({
        id: `${kind}.limitation-${key}`,
        path: `${kind}.limitations.${key}.terms`,
        label: fieldLabel,
        description: `${fieldLabel} definitions, look-back or duration, exceptions, and benefit impact when present.`,
        levels: {
          complete_extraction: "conditional",
          safe_booklet: "conditional",
          formal_disclosure: "conditional",
        },
        when: { op: "field_equals", path: `${kind}.limitations.${key}.present`, value: true },
        acceptedAuthorities: planDesignAuthorities,
        validatorIds: ["limitation_terms_complete"],
        blockerCode: `${label}_${key.toUpperCase()}_TERMS_MISSING`,
        renderPolicy: "reference_governing_document",
      }),
    ),
    field({
      id: `${kind}.eoi-lifecycle`,
      path: `${kind}.eoiAndEnrollmentLifecycle`,
      label: "Voluntary disability EOI and lifecycle",
      description: "Election options, guaranteed issue, EOI triggers, late enrollment, approval, and coverage-effective state.",
      levels: {
        complete_extraction: "conditional",
        safe_booklet: "conditional",
        formal_disclosure: "conditional",
      },
      when: anyFieldEquals(`${kind}.productSubtype`, [`voluntary_${kind}`, `buy_up_${kind}`]),
      acceptedAuthorities: employerPlanAuthorities,
      acceptedExplicitNoneReasons: ["no_eoi_required_for_available_options"],
      validatorIds: ["eoi_triggers_complete", "coverage_effective_state_complete"],
      blockerCode: `${label}_VOLUNTARY_EOI_INCOMPLETE`,
    }),
    field({
      id: `${kind}.statutory-integration`,
      path: `${kind}.statutoryIntegration`,
      label: "State statutory-disability integration",
      description:
        "State plan versus approved private/voluntary plan, contribution, claim route, job-protection distinction, and exact offset/integration.",
      levels: {
        complete_extraction: "conditional",
        safe_booklet: "conditional",
        formal_disclosure: "conditional",
      },
      when: disabilityStatePredicate,
      acceptedAuthorities: [
        "current_plan_document",
        "current_amendment_or_rider",
        "employer_selection",
        "rate_or_contribution",
        "regulatory_source",
        "manual_answer",
      ],
      acceptedNotApplicableReasons: ["employee_class_not_subject_to_state_tdi", "long_term_benefit_has_no_state_program_interaction"],
      validatorIds: ["state_rule_matches_work_state", "statutory_integration_complete"],
      blockerCode: `${label}_STATE_INTEGRATION_UNRESOLVED`,
    }),
    field({
      id: `${kind}.taxability-basis`,
      path: `${kind}.taxabilityBasis`,
      label: "Disability benefit taxability basis",
      description: "Funding split and pre-/after-tax premium basis supporting any taxability statement.",
      levels: {
        complete_extraction: "optional",
        safe_booklet: "conditional",
        formal_disclosure: "optional",
      },
      when: { op: "field_equals", path: `${kind}.rendersTaxabilityStatement`, value: true },
      acceptedAuthorities: rateAuthorities,
      validatorIds: ["taxability_claim_has_funding_and_tax_basis"],
      blockerCode: `${label}_TAXABILITY_BASIS_MISSING`,
    }),
  ];
}

export const stdRequirements: BenefitRequirementDefinition = {
  benefitType: "std",
  title: "Short-term disability",
  entityKind: "plan",
  fields: disabilityBaseFields("std"),
  invariants: [
    {
      id: "std.weekly-units",
      description: "STD amounts use weekly units and preserve separate injury/sickness waiting-period qualifiers.",
      gates: ["complete_extraction", "safe_booklet"],
    },
    {
      id: "std.taxability-grounded",
      description: "No taxability statement is rendered without premium funding and tax-basis evidence.",
      gates: ["safe_booklet"],
    },
    {
      id: "std.state-not-job-protection",
      description: "State wage replacement is not represented as job protection without separate authority.",
      gates: ["complete_extraction", "safe_booklet", "formal_disclosure"],
    },
  ],
  researchSources: [
    {
      title: "The Standard — Group STD Certificate and SPD",
      url: "https://www.standard.com/eforms/14576_642438.pdf",
      authority: "official_plan",
    },
    {
      title: "DOL — Disability benefit claims procedures",
      url: "https://www.dol.gov/node/63361",
      authority: "federal",
    },
    {
      title: "California EDD — Voluntary Plan requirements",
      url: "https://edd.ca.gov/en/disability/Employer_Voluntary_Plans/",
      authority: "state",
    },
    {
      title: "New Jersey DOL — Temporary Disability private plans",
      url: "https://www.nj.gov/labor/myleavebenefits/worker/tdi/index.shtml",
      authority: "state",
    },
  ],
  formalDisclosureRequiresSeparateApplicability: true,
};

export const ltdRequirements: BenefitRequirementDefinition = {
  benefitType: "ltd",
  title: "Long-term disability",
  entityKind: "plan",
  fields: [
    ...disabilityBaseFields("ltd"),
    field({
      id: "ltd.occupation-transition",
      path: "ltd.occupationDefinitionTransition",
      label: "Own-occupation to any-occupation transition",
      description: "Each occupation definition, transition duration, earnings threshold, and indexed-earnings qualifier.",
      levels: allGatesRequired,
      acceptedAuthorities: planDesignAuthorities,
      acceptedNotApplicableReasons: ["single_occupation_definition_for_full_duration"],
      validatorIds: ["occupation_transition_complete"],
      blockerCode: "LTD_OCCUPATION_TRANSITION_MISSING",
      renderPolicy: "reference_governing_document",
    }),
    field({
      id: "ltd.age-duration-schedule",
      path: "ltd.ageBasedDurationSchedule",
      label: "Age-based duration schedule",
      description: "Complete age-at-disability to maximum-duration table when duration varies by age.",
      levels: {
        complete_extraction: "conditional",
        safe_booklet: "conditional",
        formal_disclosure: "conditional",
      },
      when: { op: "field_equals", path: "ltd.maximumBenefitDuration.variesByAge", value: true },
      acceptedAuthorities: planDesignAuthorities,
      validatorIds: ["age_duration_schedule_complete_and_nonoverlapping"],
      blockerCode: "LTD_AGE_DURATION_SCHEDULE_MISSING",
      renderPolicy: "reference_governing_document",
    }),
  ],
  invariants: [
    {
      id: "ltd.monthly-units",
      description: "LTD amounts use monthly units and every duration such as retirement age resolves to an exact schedule.",
      gates: ["complete_extraction", "safe_booklet"],
    },
    {
      id: "ltd.occupation-definitions-sequenced",
      description: "Own-occupation and any-occupation definitions retain their separate time windows and earnings tests.",
      gates: ["complete_extraction", "safe_booklet", "formal_disclosure"],
    },
    {
      id: "ltd.taxability-grounded",
      description: "No taxability statement is rendered without premium funding and tax-basis evidence.",
      gates: ["safe_booklet"],
    },
  ],
  researchSources: [
    {
      title: "The Standard — Group LTD plan design and disability definitions",
      url: "https://www.standard.com/eforms/16544.pdf",
      authority: "official_plan",
    },
    {
      title: "DOL — Final rule protections for disability claims",
      url: "https://www.dol.gov/sites/dolgov/files/EBSA/about-ebsa/our-activities/resource-center/fact-sheets/fact-sheet-final-rule-disability-benefits.pdf",
      authority: "federal",
    },
    {
      title: "IRS — Life and disability insurance proceeds",
      url: "https://www.irs.gov/faqs/interest-dividends-other-types-of-income/life-insurance-disability-insurance-proceeds/life-insurance-disability-insurance-proceeds-1",
      authority: "federal",
    },
  ],
  formalDisclosureRequiresSeparateApplicability: true,
};

const limitedBenefitPredicate = anyFieldContains("voluntary.productSubtypes", [
  "accident_indemnity",
  "critical_illness",
  "specified_disease",
  "hospital_indemnity",
]);

export const voluntaryRequirements: BenefitRequirementDefinition = {
  benefitType: "voluntary",
  title: "Voluntary and supplemental products",
  entityKind: "product_collection",
  fields: [
    ...commonPlanFields("voluntary"),
    field({
      id: "voluntary.product-subtypes",
      path: "voluntary.productSubtypes",
      label: "Separate voluntary product subtypes",
      description:
        "Separate accident indemnity, critical illness, specified disease, hospital indemnity, voluntary life, voluntary STD, and voluntary LTD records.",
      levels: allGatesRequired,
      acceptedAuthorities: employerPlanAuthorities,
      validatorIds: ["voluntary_subtypes_allowed", "voluntary_products_not_collapsed"],
      blockerCode: "VOLUNTARY_SUBTYPES_UNRESOLVED",
      renderPolicy: "never_render",
    }),
    field({
      id: "voluntary.product-lifecycle",
      path: "voluntary.products[].coverageLifecycle",
      label: "Product election and effective-state lifecycle",
      description:
        "Election window, guaranteed/evidence-required state, approval, effective date, late entry, termination, and portability for each product.",
      levels: extractionOnly,
      acceptedAuthorities: employerPlanAuthorities,
      acceptedExplicitNoneReasons: ["no_underwriting_or_eoi", "no_portability"],
      validatorIds: ["coverage_lifecycle_complete_per_product"],
      blockerCode: "VOLUNTARY_LIFECYCLE_INCOMPLETE",
      renderPolicy: "omit_when_absent",
    }),
    field({
      id: "voluntary.rate-table",
      path: "voluntary.products[].rateTable",
      label: "Voluntary product rates",
      description: "Tier, coverage amount, age/tobacco basis where used, payroll unit, and effective period for every product.",
      levels: extractionAndBooklet,
      acceptedAuthorities: rateAuthorities,
      validatorIds: ["rate_rows_have_all_dimensions", "rate_evidence_matches_product_period"],
      blockerCode: "VOLUNTARY_RATES_INCOMPLETE",
    }),
    field({
      id: "voluntary.schedule-rows",
      path: "voluntary.products[].scheduleRows",
      label: "Complete row-level benefit schedules",
      description:
        "Every benefit row retains event/condition, amount or percentage, frequency, per-person/per-accident/per-year basis, treatment window, setting, and combination rule.",
      levels: extractionOnly,
      acceptedAuthorities: planDesignAuthorities,
      validatorIds: ["schedule_rows_have_amount_and_qualifiers", "schedule_rows_unique_within_product"],
      blockerCode: "VOLUNTARY_SCHEDULE_ROWS_INCOMPLETE",
      renderPolicy: "reference_governing_document",
    }),
    field({
      id: "voluntary.booklet-summary",
      path: "voluntary.products[].safeBookletSummary",
      label: "Safe product summary",
      description:
        "Source-backed principal benefits plus an authoritative full-schedule reference; safe rendering does not require reproducing every schedule row.",
      levels: {
        complete_extraction: "optional",
        safe_booklet: "required",
        formal_disclosure: "optional",
      },
      acceptedAuthorities: planDesignAuthorities,
      validatorIds: ["booklet_summary_claims_map_to_schedule", "full_schedule_reference_present"],
      blockerCode: "VOLUNTARY_BOOKLET_SUMMARY_UNSAFE",
    }),
    field({
      id: "voluntary.limited-benefit-notice",
      path: "voluntary.limitedBenefitNotice",
      label: "Limited-benefit notice",
      description: "Applicable source or approved notice that the product is supplemental/limited and not major medical coverage.",
      levels: {
        safe_booklet: "conditional",
        formal_disclosure: "conditional",
      },
      when: limitedBenefitPredicate,
      acceptedAuthorities: [
        "current_plan_document",
        "current_amendment_or_rider",
        "administrator_material",
        ...regulatoryAuthorities,
      ],
      validatorIds: ["limited_benefit_notice_matches_product_and_jurisdiction"],
      blockerCode: "VOLUNTARY_LIMITED_BENEFIT_NOTICE_MISSING",
    }),
    field({
      id: "voluntary.accident-scope",
      path: "voluntary.accident.scope",
      label: "Accident coverage scope",
      description: "On-job, off-job, or 24-hour scope, covered persons, accident timing, and principal exclusions.",
      levels: {
        complete_extraction: "conditional",
        safe_booklet: "conditional",
        formal_disclosure: "conditional",
      },
      when: { op: "field_contains", path: "voluntary.productSubtypes", value: "accident_indemnity" },
      acceptedAuthorities: planDesignAuthorities,
      validatorIds: ["accident_scope_complete"],
      blockerCode: "ACCIDENT_SCOPE_INCOMPLETE",
    }),
    field({
      id: "voluntary.ci-condition-schedule",
      path: "voluntary.criticalIllness.conditionSchedule",
      label: "Critical illness condition schedule",
      description: "Condition names, diagnostic definition references, initial/partial percentages, survival rule, recurrence, and aggregate maximum.",
      levels: {
        complete_extraction: "conditional",
        safe_booklet: "conditional",
        formal_disclosure: "conditional",
      },
      when: anyFieldContains("voluntary.productSubtypes", ["critical_illness", "specified_disease"]),
      acceptedAuthorities: planDesignAuthorities,
      validatorIds: ["ci_conditions_have_percent_and_definition", "recurrence_separation_complete"],
      blockerCode: "CRITICAL_ILLNESS_SCHEDULE_INCOMPLETE",
      renderPolicy: "reference_governing_document",
    }),
    field({
      id: "voluntary.hospital-schedule",
      path: "voluntary.hospitalIndemnity.hospitalSchedule",
      label: "Hospital indemnity schedule",
      description:
        "Admission, confinement, ICU, observation, frequency/day limits, readmission/transfer, and injury/sickness qualifiers.",
      levels: {
        complete_extraction: "conditional",
        safe_booklet: "conditional",
        formal_disclosure: "conditional",
      },
      when: { op: "field_contains", path: "voluntary.productSubtypes", value: "hospital_indemnity" },
      acceptedAuthorities: planDesignAuthorities,
      validatorIds: ["hospital_schedule_rows_complete", "confinement_units_complete"],
      blockerCode: "HOSPITAL_INDEMNITY_SCHEDULE_INCOMPLETE",
      renderPolicy: "reference_governing_document",
    }),
    field({
      id: "voluntary.life-options",
      path: "voluntary.voluntaryLife.options",
      label: "Voluntary life election options",
      description: "Employee/dependent amounts, increments, maxima, guaranteed issue, EOI, rates, and effective-state rules.",
      levels: {
        complete_extraction: "conditional",
        safe_booklet: "conditional",
        formal_disclosure: "conditional",
      },
      when: { op: "field_contains", path: "voluntary.productSubtypes", value: "voluntary_life" },
      acceptedAuthorities: employerPlanAuthorities,
      acceptedExplicitNoneReasons: ["no_eoi_required_for_available_options"],
      validatorIds: ["voluntary_life_options_complete", "guaranteed_issue_not_above_maximum"],
      blockerCode: "VOLUNTARY_LIFE_OPTIONS_INCOMPLETE",
    }),
    field({
      id: "voluntary.disability-options",
      path: "voluntary.voluntaryDisability.options",
      label: "Voluntary disability election options",
      description:
        "STD/LTD benefit formula, earnings definition, maximum, elimination period choices, duration, offsets, rates, EOI, and base-plan interaction.",
      levels: {
        complete_extraction: "conditional",
        safe_booklet: "conditional",
        formal_disclosure: "conditional",
      },
      when: anyFieldContains("voluntary.productSubtypes", ["voluntary_std", "voluntary_ltd"]),
      acceptedAuthorities: employerPlanAuthorities,
      acceptedExplicitNoneReasons: ["no_eoi_required_for_available_options", "no_base_plan_interaction"],
      validatorIds: ["voluntary_disability_options_complete", "combined_income_replacement_limit_valid"],
      blockerCode: "VOLUNTARY_DISABILITY_OPTIONS_INCOMPLETE",
    }),
    field({
      id: "voluntary.material-limitations",
      path: "voluntary.products[].materialLimitations",
      label: "Material product limitations",
      description: "Preexisting, waiting, age reduction, frequency, lifetime/aggregate, and state-specific limitations per product.",
      levels: allGatesRequired,
      acceptedAuthorities: planDesignAuthorities,
      acceptedExplicitNoneReasons: ["current_contract_has_no_material_limitation_in_registry"],
      validatorIds: ["limitations_tied_to_product_and_schedule"],
      blockerCode: "VOLUNTARY_LIMITATIONS_INCOMPLETE",
      renderPolicy: "reference_governing_document",
    }),
    field({
      id: "voluntary.formal-notice-applicability",
      path: "voluntary.formalDisclosure.productNoticeApplicability",
      label: "Product-specific formal notice applicability",
      description: "Separate determination of federal/state limited-benefit, fixed-indemnity, or insurance notice requirements.",
      levels: formalOnly,
      acceptedAuthorities: formalAuthorities,
      validatorIds: ["product_notice_applicability_determined"],
      blockerCode: "VOLUNTARY_FORMAL_NOTICE_APPLICABILITY_UNRESOLVED",
      renderPolicy: "never_render",
    }),
  ],
  invariants: [
    {
      id: "voluntary.products-separate",
      description: "Accident, critical illness, hospital indemnity, voluntary life, STD, and LTD remain separate products.",
      gates: ["complete_extraction", "safe_booklet", "formal_disclosure"],
    },
    {
      id: "voluntary.schedule-no-flattening",
      description: "Schedule amounts never lose frequency, timing, setting, per-event, recurrence, or combination qualifiers.",
      gates: ["complete_extraction", "safe_booklet"],
    },
    {
      id: "voluntary.no-major-medical-implication",
      description: "Limited products are not described as substitutes for major medical insurance.",
      gates: ["safe_booklet", "formal_disclosure"],
    },
  ],
  researchSources: [
    {
      title: "29 CFR 2510.3-1(j) — voluntary group insurance safe harbor",
      url: "https://www.law.cornell.edu/cfr/text/29/2510.3-1",
      authority: "federal",
    },
    {
      title: "45 CFR 146.145 — excepted benefit conditions",
      url: "https://www.law.cornell.edu/cfr/text/45/146.145",
      authority: "federal",
    },
    {
      title: "MetLife — Accident insurance certificate",
      url: "https://www.metlife.com/content/dam/metlifecom/us/homepage/Phillips66-DCP/pdfs/Accident_Low_Plan_Certificate.PDF",
      authority: "official_plan",
    },
    {
      title: "MetLife — Critical illness certificate",
      url: "https://www.metlife.com/content/dam/metlifecom/us/homepage/Phillips66-DCP/pdfs/Critical_Illness_Plan_Certificate.PDF",
      authority: "official_plan",
    },
    {
      title: "MetLife — Hospital indemnity certificate",
      url: "https://www.metlife.com/content/dam/metlifecom/us/homepage/doordash/pdf/DoorDash-Inc-CERT-HI16-CA-1-HII1-01-01-2022-POL-Effect-Date-01-01-2022.PDF",
      authority: "official_plan",
    },
  ],
  formalDisclosureRequiresSeparateApplicability: true,
};

export const eapRequirements: BenefitRequirementDefinition = {
  benefitType: "eap",
  title: "Employee assistance program",
  entityKind: "program",
  fields: [
    ...commonPlanFields("eap"),
    field({
      id: "eap.scope",
      path: "eap.serviceScope",
      label: "EAP service scope",
      description: "Assessment, brief counseling, referral/follow-up, crisis, work-life, legal, financial, and manager services actually included.",
      levels: allGatesRequired,
      acceptedAuthorities: administratorAuthorities,
      validatorIds: ["eap_scope_categories_explicit"],
      blockerCode: "EAP_SCOPE_INCOMPLETE",
    }),
    field({
      id: "eap.eligible-users",
      path: "eap.eligibleUsers",
      label: "Eligible EAP users",
      description: "Employee, spouse, dependent, household-member, retiree, and location rules without assuming family access.",
      levels: allGatesRequired,
      acceptedAuthorities: administratorAuthorities,
      validatorIds: ["eap_eligible_user_groups_explicit"],
      blockerCode: "EAP_ELIGIBLE_USERS_MISSING",
    }),
    field({
      id: "eap.counseling-limit",
      path: "eap.counselingLimit",
      label: "Counseling session limit and basis",
      description: "Exact count or unlimited status plus per-person/per-issue/per-year basis, reset period, and modality inclusion.",
      levels: allGatesRequired,
      acceptedAuthorities: administratorAuthorities,
      acceptedExplicitNoneReasons: ["program_has_no_session_limit"],
      validatorIds: ["eap_limit_has_count_and_complete_basis"],
      blockerCode: "EAP_COUNSELING_LIMIT_INCOMPLETE",
    }),
    field({
      id: "eap.modalities-hours",
      path: "eap.modalitiesAndHours",
      label: "EAP modalities and availability",
      description: "Phone, video, in-person, chat, appointment availability, and crisis availability kept distinct.",
      levels: extractionAndBooklet,
      acceptedAuthorities: administratorAuthorities,
      validatorIds: ["modalities_have_service_specific_hours"],
      blockerCode: "EAP_MODALITIES_HOURS_INCOMPLETE",
    }),
    field({
      id: "eap.confidentiality",
      path: "eap.confidentiality",
      label: "Confidentiality and exceptions",
      description: "Source-backed confidentiality statement, disclosure exceptions/reference, and privacy contact or notice path.",
      levels: allGatesRequired,
      acceptedAuthorities: [
        "current_plan_document",
        "administrator_material",
        "current_amendment_or_rider",
        "regulatory_source",
        "manual_answer",
      ],
      validatorIds: ["eap_confidentiality_has_exception_reference"],
      blockerCode: "EAP_CONFIDENTIALITY_INCOMPLETE",
    }),
    field({
      id: "eap.brief-care-boundary",
      path: "eap.briefCareBoundary",
      label: "Brief-care and referral boundary",
      description: "Whether EAP provides assessment/brief counseling rather than ongoing diagnosis/treatment and what referred care may cost.",
      levels: extractionAndBooklet,
      acceptedAuthorities: administratorAuthorities,
      validatorIds: ["eap_boundary_and_referral_cost_complete"],
      blockerCode: "EAP_CARE_BOUNDARY_MISSING",
    }),
    field({
      id: "eap.crisis-instructions",
      path: "eap.crisisInstructions",
      label: "Crisis and emergency instructions",
      description: "Program crisis route plus clear emergency/911 or appropriate local emergency direction.",
      levels: extractionAndBooklet,
      acceptedAuthorities: ["administrator_material", "current_plan_document", ...regulatoryAuthorities],
      validatorIds: ["eap_crisis_instructions_complete"],
      blockerCode: "EAP_CRISIS_INSTRUCTIONS_MISSING",
    }),
    field({
      id: "eap.excepted-benefit-status",
      path: "eap.formalDisclosure.exceptedBenefitStatus",
      label: "EAP excepted-benefit status",
      description:
        "Legal determination based on medical-care significance, coordination/gatekeeping, employee premium, and cost-sharing criteria.",
      levels: formalOnly,
      acceptedAuthorities: formalAuthorities,
      validatorIds: ["eap_excepted_status_uses_all_four_federal_factors"],
      blockerCode: "EAP_EXCEPTED_STATUS_UNRESOLVED",
      renderPolicy: "never_render",
    }),
  ],
  invariants: [
    {
      id: "eap.limit-basis-not-lost",
      description: "A session count is invalid unless person/issue/time-period and modality qualifiers are retained.",
      gates: ["complete_extraction", "safe_booklet"],
    },
    {
      id: "eap.no-confidentiality-absolute",
      description: "The booklet does not promise absolute confidentiality without the program's exceptions or authoritative reference.",
      gates: ["safe_booklet", "formal_disclosure"],
    },
    {
      id: "eap.excepted-not-inferred",
      description: "Free/confidential marketing language alone does not establish federal excepted-benefit status.",
      gates: ["formal_disclosure"],
    },
  ],
  researchSources: [
    {
      title: "OPM — What is an Employee Assistance Program?",
      url: "https://www.opm.gov/frequently-asked-questions/work-life-faq/employee-assistance-program-eap/what-is-an-employee-assistance-program-eap/",
      authority: "federal",
    },
    {
      title: "45 CFR 146.145(b)(3)(vi) — EAP excepted-benefit criteria",
      url: "https://www.law.cornell.edu/cfr/text/45/146.145",
      authority: "federal",
    },
    {
      title: "ComPsych — EAP informed consent, scope and confidentiality",
      url: "https://www.compsych.com/informedconsent/",
      authority: "official_program",
    },
    {
      title: "Cigna — Employee Assistance Program services",
      url: "https://www.cigna.com/employers/behavioral-health/eap",
      authority: "official_program",
    },
  ],
  formalDisclosureRequiresSeparateApplicability: true,
};

export const telemedicineRequirements: BenefitRequirementDefinition = {
  benefitType: "telemedicine",
  title: "Telemedicine and virtual care",
  entityKind: "product_collection",
  fields: [
    ...commonPlanFields("telemedicine"),
    field({
      id: "telemedicine.service-lines",
      path: "telemedicine.serviceLines",
      label: "Separate virtual-care service lines",
      description:
        "Separate general medical, primary care, behavioral health, dermatology, nutrition, and other specialty records.",
      levels: allGatesRequired,
      acceptedAuthorities: employerPlanAuthorities,
      validatorIds: ["telemedicine_service_lines_allowed", "service_lines_not_collapsed"],
      blockerCode: "TELEMEDICINE_SERVICE_LINES_INCOMPLETE",
      renderPolicy: "never_render",
    }),
    field({
      id: "telemedicine.plan-relationship",
      path: "telemedicine.planRelationship",
      label: "Relationship to medical coverage",
      description: "Embedded network benefit, vendor carve-out, employer program, or standalone access, including eligibility dependency.",
      levels: allGatesRequired,
      acceptedAuthorities: employerPlanAuthorities,
      validatorIds: ["telemedicine_plan_relationship_explicit"],
      blockerCode: "TELEMEDICINE_PLAN_RELATIONSHIP_UNKNOWN",
    }),
    field({
      id: "telemedicine.states",
      path: "telemedicine.serviceLines[].stateAvailability",
      label: "State and geographic availability",
      description: "Service-line availability by member location and an authoritative current lookup when a static matrix is unavailable.",
      levels: allGatesRequired,
      acceptedAuthorities: administratorAuthorities,
      validatorIds: ["state_availability_has_lookup_or_matrix", "state_rule_not_based_only_on_employer_hq"],
      blockerCode: "TELEMEDICINE_STATE_AVAILABILITY_MISSING",
    }),
    field({
      id: "telemedicine.modalities-hours",
      path: "telemedicine.serviceLines[].modalitiesAndHours",
      label: "Modality and hours by service line",
      description: "Video, audio-only, asynchronous messaging, scheduled/on-demand status, and service-specific hours.",
      levels: allGatesRequired,
      acceptedAuthorities: administratorAuthorities,
      validatorIds: ["telemedicine_modalities_hours_per_service"],
      blockerCode: "TELEMEDICINE_MODALITY_HOURS_MISSING",
    }),
    field({
      id: "telemedicine.cost",
      path: "telemedicine.serviceLines[].memberCost",
      label: "Member cost by service line",
      description: "Copay/coinsurance/full cost, deductible applicability, OOP interaction, and visit unit for each service line.",
      levels: allGatesRequired,
      acceptedAuthorities: [
        "current_plan_document",
        "current_amendment_or_rider",
        "employer_selection",
        "rate_or_contribution",
        "administrator_material",
        "manual_answer",
      ],
      acceptedExplicitNoneReasons: ["service_line_has_zero_member_cost"],
      validatorIds: ["telemedicine_cost_has_deductible_and_unit", "cost_evidence_employer_specific"],
      blockerCode: "TELEMEDICINE_COST_MISSING",
    }),
    field({
      id: "telemedicine.provider-scope",
      path: "telemedicine.serviceLines[].providerAndClinicalScope",
      label: "Provider and clinical scope",
      description: "Provider types, appropriate conditions, age rules, in-person escalation, referrals, labs, and follow-up boundaries.",
      levels: extractionAndBooklet,
      acceptedAuthorities: administratorAuthorities,
      validatorIds: ["telemedicine_scope_complete_per_service"],
      blockerCode: "TELEMEDICINE_CLINICAL_SCOPE_INCOMPLETE",
    }),
    field({
      id: "telemedicine.prescribing-status",
      path: "telemedicine.serviceLines[].prescribingStatus",
      label: "Prescribing status",
      description: "Whether prescribing is possible, unavailable, or varies by service/state; missing does not mean available.",
      levels: extractionOnly,
      acceptedAuthorities: administratorAuthorities,
      acceptedExplicitNoneReasons: ["service_line_does_not_prescribe"],
      validatorIds: ["prescribing_status_explicit_per_service"],
      blockerCode: "TELEMEDICINE_PRESCRIBING_STATUS_UNKNOWN",
      renderPolicy: "never_render",
    }),
    field({
      id: "telemedicine.prescribing-rules",
      path: "telemedicine.serviceLines[].prescribingRules",
      label: "Prescription limitations",
      description: "Medication categories, state restrictions, controlled-substance status, and pharmacy routing when prescribing is available.",
      levels: {
        complete_extraction: "conditional",
        safe_booklet: "conditional",
        formal_disclosure: "conditional",
      },
      when: { op: "field_equals", path: "telemedicine.anyServiceLinePrescribes", value: true },
      acceptedAuthorities: administratorAuthorities,
      validatorIds: ["prescribing_rules_have_state_and_drug_qualifiers"],
      blockerCode: "TELEMEDICINE_PRESCRIBING_RULES_MISSING",
      renderPolicy: "reference_governing_document",
    }),
    field({
      id: "telemedicine.emergency-warning",
      path: "telemedicine.emergencyWarning",
      label: "Emergency warning",
      description: "Current source or approved language that virtual care is not a substitute for emergency services.",
      levels: {
        complete_extraction: "optional",
        safe_booklet: "required",
        formal_disclosure: "optional",
      },
      acceptedAuthorities: ["current_plan_document", "administrator_material", ...regulatoryAuthorities],
      validatorIds: ["emergency_warning_not_overbroad"],
      blockerCode: "TELEMEDICINE_EMERGENCY_WARNING_MISSING",
    }),
    field({
      id: "telemedicine.privacy-tech",
      path: "telemedicine.privacyAndTechnology",
      label: "Privacy and technology access",
      description: "Privacy-notice path, device/app requirements, registration steps, accessibility, and technical support.",
      levels: extractionAndBooklet,
      acceptedAuthorities: administratorAuthorities,
      validatorIds: ["privacy_notice_and_technology_access_complete"],
      blockerCode: "TELEMEDICINE_PRIVACY_TECH_INCOMPLETE",
    }),
    field({
      id: "telemedicine.formal-medical-incorporation",
      path: "telemedicine.formalDisclosure.medicalPlanIncorporation",
      label: "Formal medical-plan incorporation",
      description: "Determination of whether and how each virtual service must appear in the medical SBC/SPD or other formal disclosure.",
      levels: formalOnly,
      acceptedAuthorities: formalAuthorities,
      validatorIds: ["telemedicine_formal_incorporation_determined"],
      blockerCode: "TELEMEDICINE_FORMAL_INCORPORATION_UNRESOLVED",
      renderPolicy: "never_render",
    }),
  ],
  invariants: [
    {
      id: "telemedicine.no-global-24-7",
      description: "A 24/7 claim is service-line specific and cannot be propagated to scheduled specialties.",
      gates: ["complete_extraction", "safe_booklet"],
    },
    {
      id: "telemedicine.no-generic-zero-cost",
      description: "Zero-dollar cost requires employer-plan-specific evidence, not a carrier statement that visits may be as low as zero.",
      gates: ["complete_extraction", "safe_booklet"],
    },
    {
      id: "telemedicine.state-and-location",
      description: "Availability and prescribing use the member's location and current state rules, not employer headquarters alone.",
      gates: ["complete_extraction", "safe_booklet", "formal_disclosure"],
    },
  ],
  researchSources: [
    {
      title: "HHS Telehealth — Introducing patients to telehealth",
      url: "https://telehealth.hhs.gov/providers/preparing-patients-for-telehealth/introducing-patients-to-telehealth",
      authority: "federal",
    },
    {
      title: "HHS Telehealth — Licensing across state lines",
      url: "https://telehealth.hhs.gov/licensure/licensing-across-state-lines",
      authority: "federal",
    },
    {
      title: "HHS Telehealth — Privacy and security",
      url: "https://telehealth.hhs.gov/providers/best-practice-guides/privacy-and-security-telehealth",
      authority: "federal",
    },
    {
      title: "Teladoc Health — Member service, cost, prescribing, and emergency FAQ",
      url: "https://www.teladochealth.com/start/faq",
      authority: "official_program",
    },
    {
      title: "UnitedHealthcare — 24/7 Virtual Visits member FAQ",
      url: "https://e-i.uhc.com/content/dam/ei/microsites-content/adp/pdfs/virtual-visits/virtual-visits-member-faq.pdf",
      authority: "official_plan",
    },
  ],
  formalDisclosureRequiresSeparateApplicability: true,
};
