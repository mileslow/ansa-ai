# Benefit-section source documents

This phase stores sources by their primary benefit section. It intentionally
includes more than governing insurance contracts: official summaries, program
guides, forms, FAQs, and notices can all be valid section inputs. Every leaf
README identifies the exact source role so tests do not count supporting
material as a governing plan document.

Cross-benefit governing documents are stored once in `combined-disability/` or
`package-wide-plan-documents/` and should receive multiple benefit-section tags.
Medical insurance and prescription/pharmacy support are separate categories.

## Directory convention

Each benefit category is organized as:

```text
benefit-type/
  carrier-or-program-offering/
    option-tier-or-document.pdf
```

The middle directory represents a coherent carrier, employer, or public-program
offering. The PDF filename identifies the actual option or metal tier when the
source publishes one. When one authoritative document covers several options,
the combined source is stored once with a filename that names the included
options; it is not duplicated merely to force one file per tier. Reference
guidance, forms, EAPs, account benefits, and other sources without tiers use
their honest document role as the filename.

## Option expansion scope

- `medical-insurance/`, `dental/`, and `vision/` were audited for complete
  sibling options within each original carrier/program offering. Their leaf
  READMEs and offering-level `SOURCES.md` files record the boundaries.
- Life/AD&D, disability, and voluntary-product sources use option names in the
  filename when one governing document covers several choices, such as FEGLI
  Basic and Options A/B/C, Core and Buy-Up LTD, or Low and High hospital
  indemnity. Combined authoritative documents remain single-copy.
- EAP, HSA, HRA, FSA, telemedicine, and prescription-support materials do not
  use medical metal tiers. They are grouped by the actual sponsor or program
  and named by document role.
- Cross-benefit documents remain in `combined-disability/` or
  `package-wide-plan-documents/` to avoid duplicate binaries and conflicting
  authority.

## Why this reorganization was necessary

The original medical corpus contained five useful but unrelated examples:
one Kaiser Bronze plan, one Healthfirst Essential Plan, one FCPS Kaiser
Medicare plan, one BCBS federal brochure, and one University of Rochester PPO.
That collection tested document variety, but it could easily be mistaken for a
set of comparable employer plan choices. It also could not test whether an
extractor preserves all sibling options within one offering.

The reorganization changed the unit of organization from "interesting PDF" to
"coherent offering family." For the original medical examples, that meant
finding the official sibling options belonging to the same sponsor, market,
product family, and plan year. The same review was applied to dental and
vision. Other benefit categories were grouped by their actual sponsor or
program, even when the category does not use plan tiers.

The resulting corpus contains 94 PDFs:

| Category | PDFs |
| --- | ---: |
| Combined disability | 1 |
| Dental | 8 |
| EAP | 5 |
| FSA | 5 |
| HRA | 5 |
| HSA | 5 |
| Life and AD&D | 6 |
| Long-term disability | 6 |
| Medical insurance | 25 |
| Package-wide plan documents | 1 |
| Prescription and pharmacy | 3 |
| Short-term disability | 6 |
| Telemedicine | 5 |
| Vision | 8 |
| Voluntary and supplemental benefits | 5 |
| **Total** | **94** |

For medical, dental, and vision, each offering-level `SOURCES.md` records the
official lineup, included options, excluded products, source URLs, retrieval
date, checksums, and PDF verification. Those manifests define the intended
offering boundary; filenames alone do not.

## Terms that must not be conflated

- **Offering family:** A coherent set published for the same sponsor or
  program, market, jurisdiction, product family, and plan year.
- **Plan option:** A distinct selectable benefit design, such as FEP Blue
  Standard versus FEP Blue Basic.
- **Metal tier:** An ACA actuarial-value label such as Bronze, Silver, Gold, or
  Platinum. Metal tiers are plan attributes, not a universal hierarchy used by
  every benefit.
- **Enrollment tier:** A coverage level such as Employee Only, Self Plus One,
  or Family. Enrollment tiers are not separate plan options.
- **Network tier:** A cost-sharing level inside a plan, such as preferred,
  in-network, or out-of-network. Network tiers are not separate plans unless
  the official source explicitly publishes them as selectable products.
- **Document role:** The purpose and authority of a PDF, such as an SBC, EOC,
  certificate, rate sheet, enrollment form, formulary, or marketing overview.
  Several documents can describe one plan, and one document can describe
  several options.

## How an attribute can be known exactly

Certainty is determined per field, not per document. A PDF can be authoritative
for one field and insufficient for another. For example, an SBC can establish
a deductible but generally cannot prove that a specific employer selected the
plan.

A field may be labeled **verified exact** only when all of the following are
true:

1. The source has the correct authority for that field.
2. The source applies to the exact sponsor, carrier, market, jurisdiction,
   product family, option, and plan year being described.
3. The value is stated directly rather than inferred from a filename, nearby
   option, unchecked form field, or generic carrier description.
4. A page number and short supporting quotation identify the evidence.
5. Every material qualifier is preserved, including individual versus family,
   in-network versus out-of-network, employee class, age, frequency, unit,
   duration, coverage tier, and effective period.
6. The value does not conflict with a more authoritative or later applicable
   source.
7. The source binary is traceable through its local path, official URL,
   retrieval date, and checksum.

If any condition is missing, the field must be represented as one of:

- **verified composite:** Exact only after joining two compatible authoritative
  sources, such as an official offering index plus an option-specific SBC.
- **conflicted:** Two applicable sources disagree and precedence does not
  resolve the conflict safely.
- **uncertain:** Evidence exists but applicability, meaning, or qualifiers are
  ambiguous.
- **not found:** The reviewed source is silent; silence is not evidence of
  absence.
- **explicit none:** The applicable source directly states that the benefit or
  attribute does not exist.
- **not applicable:** The source directly establishes that the field does not
  apply to the plan or population.

### Source authority by attribute

| Attribute | Preferred evidence | Sources that are insufficient by themselves |
| --- | --- | --- |
| Offering membership and employer selection | Signed employer decision, accepted renewal, enrollment configuration, or explicit employer benefits menu | Generic carrier brochure, SBC, certificate, or compatibility statement |
| Plan identity, carrier, product type, and plan ID | Applicable SBC, EOC, certificate, policy, official plan brochure, or employer-specific plan document | Filename or directory name alone |
| Deductibles, copays, coinsurance, out-of-pocket limits, benefit formulas, waiting periods, and duration | Applicable governing plan document; SBC or official benefit schedule when it is the intended summary authority | Rate sheet, marketing flyer, or another sibling option |
| Premiums and coverage-tier rates | Accepted quote, renewal, carrier rate sheet, or official rate schedule for the same option and period | SBC or benefit certificate without rates |
| Employer and employee contributions | Employer decision, contribution schedule, payroll source, or accepted proposal | Total premium table without contribution evidence |
| Eligibility and employee classes | Employer plan/SPD, authorized decision form, enrollment configuration, or applicable employer guide | Generic carrier eligibility language |
| HSA, HRA, or FSA offering and funding | Employer account plan, authorized election/configuration, contribution record, or governing account document | A medical plan being HSA-compatible or HDHP-qualified |
| Formulary status and pharmacy controls | Applicable dated formulary and pharmacy plan document | Drug-list presence without plan applicability |
| Legal or regulatory requirement | Current official agency source plus plan-specific applicability evidence | Old notice, generic summary, or another jurisdiction |
| Contact information | Current official sponsor, administrator, or carrier source | Historical brochure without revalidation |

### Source precedence

When sources conflict, do not merge values silently. Apply field-specific
precedence and record the conflict:

1. Signed or authorized employer selection and amendment documents control what
   the employer chose.
2. Current governing policies, certificates, EOCs, SPDs, and plan amendments
   control plan terms.
3. Accepted quotes, renewals, and official rate schedules control premiums and
   contribution inputs within their stated scope.
4. SBCs and official benefit schedules provide standardized summaries but do
   not override the governing document when the source says the contract
   controls.
5. Employer guides and member guides provide supporting operational context.
6. Generic marketing materials provide product context only.

A later publication does not automatically win if it describes a different
option, population, jurisdiction, or document role.

## Proposed field-level ground truth

Before claiming that the PDF extractor knows the exact attributes from all 94
PDFs, create a reviewed ground-truth record for each material field in scope.
The record should use a stable structure similar to:

```json
{
  "corpusPath": "medical-insurance/example-offering/example-option.pdf",
  "benefitType": "medical",
  "planOrProgramName": "Exact published option name",
  "attributePath": "plans.medical.costSharing.deductible",
  "state": "known",
  "value": { "individual": 1000, "family": 2000 },
  "qualifiers": {
    "network": "in-network",
    "period": "calendar year",
    "unit": "USD"
  },
  "evidence": {
    "page": 1,
    "quote": "Direct source wording containing the value",
    "authority": "current_plan_document"
  },
  "certainty": "verified_exact",
  "reviewedBy": "human reviewer",
  "reviewedAt": "YYYY-MM-DD"
}
```

Ground truth must be created from the rendered PDF and extracted text together.
Text extraction alone can lose table structure, columns, checkboxes, footnotes,
and visual grouping. A second reviewer should verify material fields and every
document containing multiple options.

The first annotation pass should cover:

- exact document role and authority;
- sponsor, carrier, employer or program, plan year, jurisdiction, and market;
- every visible plan option and identifier;
- enrollment and network tiers without promoting them to plan options;
- all material benefit amounts, formulas, limits, periods, and qualifiers;
- explicit none or not-applicable statements;
- source conflicts and superseding amendments;
- whether the document can prove employer offering, selection, or contribution;
- evidence page and quotation for every material known value.

## PDF extractor test plan

**Status: plan only. This section does not claim that the live extractor has
passed the corpus.**

### Phase 1 - Corpus and file integrity

1. Discover all PDFs recursively and require the
   `category/offering/document.pdf` hierarchy.
2. Assert the expected count of 94 and the category counts listed above.
3. Verify PDF signatures, page counts, checksums, nonempty content, and Poppler
   rendering.
4. Confirm that offering manifests reference existing files and official
   sources.
5. Fail on loose PDFs, duplicate binaries presented as separate options, or
   undocumented additions.

### Phase 2 - Document classification

For every PDF, test that the extractor identifies:

- primary and secondary benefit families;
- document subtype and authority;
- sponsor, carrier, employer, and administrator without mixing their roles;
- current, historical, template, regulatory, or generic scope;
- whether the source can prove an employer offering or only describe a plan.

Any wrong benefit family, wrong authority, or generic-plan-to-employer
inference is a critical failure.

### Phase 3 - Option identity and hierarchy

Run exhaustive identity tests across all medical, dental, and vision PDFs.
Compare extracted option entities with the offering manifests and annotated
ground truth.

The extractor must:

- return every distinct published option exactly once;
- preserve exact option names and IDs;
- attach enrollment tiers to the correct option;
- preserve network levels as qualifiers;
- keep sibling option facts separate;
- retain one combined source when it legitimately covers several options;
- avoid inventing missing tiers or treating translated/rider copies as new
  options.

### Phase 4 - Exact material attributes

Compare structured output with field-level ground truth. Every known material
attribute must include an evidence locator and all qualifiers. Tests should
normalize harmless formatting differences, but not units, periods, tiers,
network scope, employee class, or option identity.

Use hard failures for:

- unsupported material values;
- correct values attached to the wrong option;
- lost qualifiers;
- collapsed option-specific schedules;
- page or quote evidence that does not support the value;
- an explicit-none state inferred from silence;
- a material annotated fact missing from output.

### Phase 5 - Safety and non-inference

Create negative assertions for the most dangerous mistakes:

- a plan document must not prove employer selection;
- an HSA-qualified medical plan must not create an employer HSA offering;
- pediatric dental or vision inside medical coverage must not create a
  standalone employer benefit;
- a blank form must not create filled facts;
- a carrier address must not become the employer address;
- a formulary entry must not guarantee coverage;
- one sibling option must not donate attributes to another;
- historical or generic materials must not become current employer truth.

### Phase 6 - Cross-source assembly

After single-document extraction is reliable, test controlled document bundles
that require joining authority correctly:

- employer selection plus plan document;
- plan document plus rate sheet;
- medical HDHP plus separate employer HSA evidence;
- EOC plus benefit schedule;
- governing document plus amendment;
- conflicting current and historical sources.

The assembled result must preserve provenance for each field and surface
unresolved conflicts instead of selecting a convenient value.

### Phase 7 - Full-corpus regression strategy

Use two complementary suites:

1. **Deterministic contract tests:** Run on every change. They verify corpus
   shape, schema, safety rules, pinned option families, and curated exact
   attributes without a model judge.
2. **Paid live extraction audits:** Run a reproducible seeded sample across all
   categories, always including page 1 and selected material pages. Rotate seeds
   until every PDF has been exercised. Use the human-reviewed ground truth as
   the primary oracle; an independent model judge may flag omissions but cannot
   replace ground truth.

Identity and safety checks should eventually run against all 94 PDFs. Page
sampling is useful for cost control, but it cannot establish full-document
attribute recall. Each gold-standard document must also receive at least one
full-document extraction run.

## Proposed release gates

The extractor is ready for this corpus only when:

- 100% of PDFs pass corpus integrity and classification checks;
- 100% of annotated plan options are preserved without duplicates or collapse;
- 100% of known material outputs have a supporting page and quotation;
- there are zero unsupported employer offering, selection, or contribution
  claims;
- there is zero cross-option or cross-employer attribute leakage;
- there are zero critical ground-truth mismatches;
- all unresolved source conflicts are surfaced;
- non-material precision and recall meet a separately agreed threshold;
- failures produce a durable report containing corpus path, extracted value,
  expected value, evidence, qualifiers, and severity.

## Proposed execution order

1. Freeze the 94-file corpus and manifests for the test run.
2. Define the exact material-field scope per benefit type.
3. Annotate a small pilot set containing one single-option source, one
   multi-option source, one combined document, one form, and one conflicting
   source pair.
4. Review and revise the annotation schema.
5. Annotate the remaining material fields, with second-reviewer checks.
6. Implement deterministic contract tests against that ground truth.
7. Run a small paid smoke test across medical, dental, and vision.
8. Fix critical extractor defects before broadening the sample.
9. Run stratified live audits across all categories.
10. Complete at least one full-document extraction for every gold-standard PDF.
11. Publish the final audit report and freeze passing outputs as regression
    fixtures.
