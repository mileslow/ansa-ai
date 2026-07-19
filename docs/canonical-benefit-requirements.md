# Canonical Benefit Requirements Registry

Status: implemented as a backend registry; not yet wired into every extractor,
question, content, and quality-check path.

## Purpose

The registry is the single machine-readable definition of what the backend must
know for every supported benefit. It replaces scattered notions of "complete"
with explicit fields, conditional dependencies, evidence rules, source
authority, blocker codes, render policy, and cross-field invariants.

It covers all 12 `BenefitType` values and 339 field requirements:

| Benefit | Fields | Benefit | Fields |
| --- | ---: | --- | ---: |
| Medical | 33 | Life/AD&D | 24 |
| Dental | 30 | STD | 26 |
| Vision | 26 | LTD | 28 |
| EAP | 18 | Voluntary products | 23 |
| Telemedicine | 21 | HSA | 31 |
| HRA | 39 | FSA | 40 |

The implementation is in `lib/benefit-requirements/`:

- `types.ts`: statuses, evidence, authorities, gates, predicates, and registry
  types.
- `core-plans.ts`: medical, dental, and vision.
- `ancillary.ts`: life/AD&D, STD, LTD, EAP, voluntary, and telemedicine.
- `accounts.ts`: HSA, HRA, and FSA.
- `evaluator.ts`: fail-closed runtime gate evaluation.
- `index.ts`: the canonical registry, definition validation, and conditional
  dependency inventory.

## Three different completeness gates

These gates must never be collapsed into one boolean:

1. `complete_extraction`: enough information has been extracted or explicitly
   resolved to represent the source faithfully.
2. `safe_booklet`: enough source-backed information exists to publish the field
   in an employee booklet without guessing.
3. `formal_disclosure`: the field inventory needed for a formal document is
   present, subject to a separate legal applicability and delivery analysis.

Passing `safe_booklet` does not certify an SBC, SPD, certificate, notice, or
delivery process. Formal plan disclosures have their own content and delivery
rules; for example, the federal SPD content rules are specified in
[29 CFR 2520.102-3](https://www.ecfr.gov/current/title-29/section-2520.102-3),
and SBC structure is governed by the official
[CMS group instructions](https://www.cms.gov/files/document/group-instructions-060723.pdf)
and [SBC template](https://www.cms.gov/CCIIO/Resources/Forms-Reports-and-Other-Resources/Downloads/SBC-Template-Accessible-Format-11-2019.pdf).

Every field is `required`, `conditional`, or `optional` for a gate:

- `required`: unresolved means the gate fails.
- `conditional`: a serializable predicate determines applicability. An
  unresolved predicate fails closed; it is not treated as false.
- `optional`: omission is safe, but rendering the field promotes it to required
  and its value must pass the same evidence checks.
- An absent gate entry means the field belongs only to another gate, such as a
  formal-disclosure-only field.

## Resolution states

A missing value is not a single state. Each field resolves to one of:

- `known`
- `explicit_none`
- `not_applicable`
- `not_found`
- `unknown`
- `conflicting`
- `requires_legal_determination`
- `not_offered`

`explicit_none` and `not_applicable` are accepted only when the field defines
the specific allowed reason code. Source silence is never equivalent to a
documented "none." Conflicts and unresolved legal determinations block a
required or applicable conditional field.

## Evidence and authority rules

Material fields require field-level evidence. Evidence records the source,
authority and authority domain, effective period, employer/group and plan
scope, PDF page or spreadsheet cell, extraction method, confidence, and any
derivation lineage.

The accepted authority is field-specific. In particular:

- A carrier plan document can establish plan design, but it does not by itself
  establish that the current employer selected that plan.
- Current employer offering fields accept employer selection, eligibility,
  contribution/rate, or accountable manual evidence—not prior guides, generic
  marketing, or a plan document alone.
- Prior-year material is context, not current-year factual truth.
- Generic marketing may help route a document but cannot substantiate a
  current material booklet claim.
- Derived values must retain parent evidence and a transform identifier.

The domain definitions are based on primary rules and official materials,
including [IRS Publication 969](https://www.irs.gov/publications/p969) for
HSA/HRA/FSA concepts, the
[CMS ICHRA resources](https://www.cms.gov/marketplace/technical-assistance-resources/individual-coverage-hra),
[HHS telehealth guidance](https://telehealth.hhs.gov/providers/preparing-patients-for-telehealth/introducing-patients-to-telehealth),
and official federal plan materials. These field lists are an operational
product-completeness contract, not legal advice or a substitute for plan
counsel.

## Backend integration contract

The remaining backend wiring should use the registry in this order:

```text
document classification and scope
  -> benefit-specific extraction
  -> field resolutions with provenance
  -> conditional dependency resolution
  -> complete_extraction evaluation
  -> blocker questions for failed applicable requirements
  -> safe_booklet evaluation using the actual rendered paths
  -> content grounding and rendering
  -> post-render claim/evidence audit
  -> separate formal-disclosure applicability/delivery checks
```

The question engine should generate one narrow question per blocker code, merge
questions that share the same missing source, and never ask the user to re-enter
a fact already established by acceptable evidence. The renderer must report
the paths it used so an optional-but-rendered field cannot bypass validation.

`collectPredicateDependencies()` publishes the routing/context facts needed by
conditional rules. Those dependencies are not necessarily printable fields.
At runtime, any missing dependency evaluates to `unknown` and blocks the
conditional gate.

## AI evaluation suite

The deterministic registry tests are necessary but not sufficient. The AI
suite should score structured outputs against a reviewed manifest, not compare
free-form prose.

### 1. Single-document extraction tests

For every benefit and major document subtype, maintain reviewed expectations
for:

- classification, benefit type, scope, authority, and effective period;
- must-extract field paths and values;
- evidence page/cell and a short supporting span;
- fields that must remain `not_found` rather than be inferred;
- forbidden benefit offerings and forbidden cross-employer facts.

Score field precision/recall, normalized-value accuracy, locator accuracy,
authority accuracy, and unsupported-claim rate separately. A high aggregate
score must not hide a material hallucination.

### 2. State-distinction tests

Use paired or triplet fixtures whose only change forces a different state:

- blank table cell -> `not_found`;
- "not covered" -> `explicit_none` with the allowed reason;
- condition does not apply -> `not_applicable` with its allowed reason;
- two authoritative current sources disagree -> `conflicting`;
- applicability depends on legal/factual analysis ->
  `requires_legal_determination`;
- generic brochure exists without employer selection -> benefit remains
  unconfirmed, not offered.

### 3. Authority and contamination tests

Adversarial bundles should combine:

- a current employer selection with a prior booklet containing different
  values;
- a generic carrier brochure with no employer selection;
- two employers' files with similar plan names;
- current and expired plan years;
- medical pediatric dental/vision rows without standalone dental/vision
  selections;
- a plan marketed as an HDHP without proof of HSA eligibility or HSA offering.

The judge fails the case if prior, generic, wrong-employer, wrong-plan, or
wrong-period content becomes a current booklet fact.

### 4. Conditional-branch coverage

Generate a case for every dependency returned by
`collectPredicateDependencies()`: true, false, and unresolved. Assert that the
field becomes required, is safely skipped, or blocks with `condition_unknown`,
respectively. Important branches include medical network designs, dental
orthodontia and out-of-network coverage, voluntary product subtypes, disability
limitations, HRA subtype, all FSA arrangement types, and account interaction
rules.

### 5. Cross-field invariant tests

Each registry invariant should become at least one passing and one failing
fixture. Examples:

- plan names, rates, and employer contributions join to the same plan ID;
- per-pay values reconcile to the declared pay-period basis;
- HSA compatibility is not inferred from deductible arithmetic;
- HSA/FSA/HRA interaction statements match the offered arrangements;
- STD/LTD percentages, caps, elimination periods, and durations remain tied to
  the correct product;
- voluntary product subtypes are not collapsed or invented;
- rendered contacts belong to the correct administrator and benefit.

### 6. Question-engine tests

For each required and conditional field, remove or conflict the field and
assert:

- the expected blocker code appears;
- the question names the benefit and missing fact;
- cited context identifies what was found and where;
- optional omitted facts do not generate questions;
- supplying an acceptable manual answer resolves the blocker with provenance;
- an answer to one benefit cannot resolve a similarly named field on another.

### 7. Grounded content and judge tests

Have the generator emit both booklet copy and a claim ledger mapping each
material claim to registry paths and evidence IDs. Use two independent checks:

1. deterministic claim-ledger validation; and
2. a model judge that sees the source excerpts, registry requirements, and
   generated copy but not the generator's reasoning.

The judge scores entailment, omission of applicable material facts,
contradictions, plan/employer/year contamination, misleading compression, and
unsupported legal certainty. Calibrate the judge on human-reviewed pass/fail
examples and periodically measure judge-human agreement. A model judge may add
failures; it must not waive deterministic blockers.

### 8. Metamorphic and repeatability tests

- Reorder input files: structured facts and gate result must not change.
- Rename files: content-based classification must remain stable.
- Add an irrelevant generic brochure: current facts must not change.
- Add a higher-authority amendment: only superseded fields should change.
- Run the same fixture repeatedly at fixed model/version settings: material
  values and states must remain stable even if wording varies.

### 9. Full raw-file-to-PDF scenarios

Maintain coherent employer case recipes—not random document mixtures—for all
12 benefit types. Each test should execute raw intake, classification,
extraction, resolution, blockers, answers where expected, safe-booklet
evaluation, content, rendering, and a PDF claim/evidence audit. Include at
least one negative scenario that must not generate a booklet.

## Release thresholds

A backend release should require:

- zero unresolved registry-definition issues;
- zero unsupported material claims in the reviewed release corpus;
- 100% recall for offering confirmation and other release-blocking fields;
- 100% expected blocker-code accuracy on negative scenarios;
- zero wrong-employer, wrong-plan, or wrong-period contamination;
- deterministic invariant and renderer-path checks passing;
- model-judge scores reported separately from deterministic results;
- a reviewed exception for any fixture not run because of cost or environment.

Live model tests should pin the exact model snapshot and record prompt version,
extractor version, source hashes, structured response, token/cost metrics, and
judge result so failures are reproducible and model upgrades are comparable.
