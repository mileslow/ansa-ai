# Source-Document AI Test Integration Plan

## Goal

Turn `source-docs/` into a manifest-driven evaluation corpus that exercises the
same raw-file classification, extraction, assembly, question, content, and PDF
paths used by the production booklet pipeline.

The corpus should not become a folder of PDFs that a test loops over blindly.
Each source needs machine-readable expectations, an explicit authority/scope
role, and deterministic scoring rules. Mixed-file tests must use coherent case
recipes rather than randomly combining documents from unrelated employers.

## Current state

### Corpus

The audited corpus now contains:

- 48 artifact-bearing primary buckets;
- 149 unique primary source artifacts;
- PDF, XLS, XLSX, CSV, TXT, EDI, DOCX, and ZIP inputs;
- 88 retained verification artifacts excluded from primary sampling;
- six intended leaves that are still empty;
- one archived duplicate binary excluded from the corpus: the second copy of
  IRS Publication 969;
- six content-based audit/acquisition reports under `docs/`;
- a README in every artifact-bearing primary bucket.

The original 125 files were audited individually and rehomed by intrinsic
source role. Twenty-five valuable sources were then added: a replacement fifth
medical plan plus 24 targeted additions across benefit authority, rates,
enrollment, templates, instructions, amendments, and legal references. The
five-example target no longer overrides honest classification; incomplete
buckets are explicit gaps rather than containers for mislabeled substitutes.

### Existing machine-readable extraction

The backend already converts several source types into validated structured
objects. This plan should extend those paths, not replace them:

- `extractBookletDocument()` uses an OpenAI structured response validated by
  `BookletDocumentExtractionSchema`. It extracts employer details, plan year,
  eligibility, offered benefits, selected plans, contributions, contacts,
  HSA/HRA/FSA administrators, section order, confidence, page, and quote.
- `extractMedicalPlan()` performs transcript, identity, cost, and coverage
  phases and validates the combined result with
  `MedicalPlanAttributesSchema`.
- `extractRateSheet()` deterministically converts supported spreadsheets into
  structured plan rates, contribution rules, and extracted facts.
- `factsFromDocumentExtraction()` and `factsFromMedicalPlan()` normalize those
  results into `ExtractedFact` records with source references.
- the package assembler then converts those extracted objects and manual
  answers into the machine-readable `BenefitsPackage` used downstream.

The missing layer is **machine-readable evaluation truth for the corpus**. The
proposed manifest records the expected document family, benefit type, role,
scope, anchor facts, and forbidden facts for each test file. It is a test
oracle; it is not a second extraction system. Corpus tests should feed the raw
file through the existing production extractor wherever that extractor is
appropriate, compare its structured output with the manifest expectations, and
only introduce a new benefit-specific schema where the current medical or
generic schemas cannot represent the source.

### Existing automated tests

The deterministic suite currently passes:

```text
16 test files passed
5 test files skipped
199 tests passed
84 tests skipped
```

The paid/live test command currently runs:

- `tests/plan-extractor.live.test.ts`
- `tests/booklet-document-extractor.live.test.ts`
- `tests/booklet-pipeline.live.test.ts`
- `tests/booklet-content-agent.live.test.ts`

Those live tests provide useful foundations, but most do not start from the new
raw source corpus:

- the medical extractor uses three fixed medical fixtures;
- the prior-guide extractor uses two files from `notion-call-transcripts/`;
- the end-to-end pipeline uses one medical PDF, an in-test generated workbook,
  and synthetic email text;
- the content-agent matrix starts from hand-built `BenefitsPackage` objects.

As a result, the current suite verifies several downstream behaviors without
proving that varied real-world files can reach those behaviors.

### Known issues found by paid/live AI extraction tests

The seeded dental and vision regression run on 2026-07-18 sampled four source
documents and failed after 79.68 seconds with three critical findings. The
NYSHIP dental certificate passed. The remaining failures represent production
extraction defects; they are not acceptable expected failures:

- **MetLife FEDVIP dental option collapse:** the brochure visibly defines
  separate High and Standard options, each with Self Only, Self Plus One, and
  Self and Family enrollment tiers. Extraction returned one generic MetLife
  dental plan and did not preserve High and Standard as distinct plan options.
  This was a plan-identity defect that could merge materially different
  benefits. Fixed on 2026-07-18 with a focused plan-option index, deterministic
  option-subject reconciliation, and a pinned paid regression that requires
  exactly two page-1-backed identities with all three enrollment types.
- **CalHR VSP conditional copay omission:** page 6 states that CCPOA Supervisors
  enrolled in the Premier plan pay a $35 copay for the second-pair benefit.
  Extraction preserved the Basic and Premier plan names but omitted this
  conditional copay. It also inferred a Premier employee cost of zero from text
  stating only that the state pays a portion equal to the Basic plan. That quote
  does not support a zero employee cost.
- **Washington PEBB vision comparison incompleteness:** extraction preserved
  the Davis Vision by MetLife, EyeMed, and MetLife Vision identities but omitted
  material values from the three-page comparison table, including eye-exam
  costs, frame allowances, lens and progressive-lens costs, contact-lens
  allowances and fitting fees, and related benefit limits. Earlier runs also
  produced candidates whose evidence quotes did not support all combined
  multi-page values.

The paid test itself has one known reliability issue:

- **LLM-judge false negatives are possible:** the latest judge did not report
  the CalHR $35 omission even though the sampled page contained the term and the
  structured extraction did not. Previous runs did report it. An LLM judge is
  therefore useful for discovery but cannot be the sole pass/fail oracle for
  these known facts.

Keep the regression red until the extraction defects are fixed. Add pinned,
deterministic assertions for the MetLife option identities, the conditional
CalHR $35 copay and nonzero-cost safety rule, and the Washington per-option
comparison fields and page-level evidence. The paid judge should remain as a
second layer for finding new issues rather than replacing those assertions.

## Important codebase gaps found

### 1. The classification model is too narrow

`DocumentType` currently has only:

```text
employer_application
carrier_rate_sheet
plan_summary
sbc
spd
benefit_guide
prior_booklet
census
renewal_spreadsheet
email_export
unknown
```

It cannot express:

- benefit type: dental, vision, life, STD, LTD, HSA, HRA, FSA, EAP,
  telemedicine, or voluntary;
- document subtype: certificate, EOC, policy, claim guide, administrator guide,
  enrollment form, legal notice, formulary, or payroll layout;
- factual scope: current employer, prior employer, generic reference, template,
  regulation, or blank form;
- authority: employer decision, official plan terms, carrier rate source,
  template structure, or educational language.

The classifier therefore needs multi-label output instead of one flat enum.

### 2. Raw PDF classification depends heavily on the model fallback

A diagnostic run of the existing heuristic classifier against the original 125 primary
corpus files produced:

```text
15 accepted by heuristics
110 sent to the model fallback
```

Even after locally extracting the first three PDF pages before classification,
the existing rules produced:

```text
44 accepted by heuristics
81 sent to the model fallback
```

The model fallback is constrained to the same narrow document-type enum, so it
still cannot classify most benefit-module roles correctly.

### 3. All plan documents are routed through a medical schema

The pipeline currently routes `sbc`, `spd`, and `plan_summary` into
`extractMedicalPlan()`. A dental certificate, LTD SPD, HRA SPD, or life policy
can therefore be sent to the medical extractor if classified as one of those
types.

Documents classified as `unknown` are not extracted at all.

### 4. The generic booklet extractor lacks benefit-detail fields

`BookletDocumentExtractionSchema` captures:

- employer setup;
- plan year;
- eligibility;
- offered benefit flags;
- selected plan identity;
- contributions;
- contacts;
- accounts;
- section order and template role.

It does not capture actual dental, vision, life, disability, HSA/HRA/FSA, EAP,
telemedicine, voluntary, census, or legal-notice details.

### 5. `BenefitPlan.attributes` is medical-only

The normalized package assigns `MedicalPlanAttributes` to every plan. There is
no discriminated attribute schema for ancillary benefits or account programs.
This prevents the assembler, content agent, and renderer from carrying actual
source-backed details for those sections.

### 6. Several rendered sections still use generic unsourced copy

The legacy adapter passes real medical plan data and medical/dental/vision rate
tables, but most other modules are reduced to an `offered: true` signal. The
renderer then supplies generic content for eligibility, telemedicine, accounts,
life/disability, EAP, and voluntary benefits.

This means a PDF can pass the current quality checker even though material text
was not derived from an uploaded source.

### 7. File intake does not cover the corpus

The API accepts PDF, XLS/XLSX, CSV, EML, and text. It currently rejects DOCX and
ZIP, both of which are present in the corpus.

The Cloud Run JSON body defaults to 30 MiB. The corpus includes a 36 MiB ZIP,
which cannot fit after base64 expansion. Large source batches therefore need
storage/file-ID based ingestion rather than JSON-base64 upload.

### 8. Long documents make naive raw-model tests expensive

The corpus includes documents with 399, 217, 215, and 168 pages. The medical
extractor currently sends the full PDF to the model four times: transcript,
identity, costs, and coverage.

Running all long documents through that pattern would be slow and expensive.
The production implementation and the test harness both need preprocessing,
page selection, and caching.

## Target architecture

```text
source-docs manifest
  -> corpus loader and integrity checks
  -> file normalization / text / OCR / archive inspection
  -> multi-label document classifier
  -> extractor router
  -> benefit-specific extractors
  -> normalized facts with page/sheet evidence
  -> BenefitsPackage assembler
  -> conflict and question engine
  -> grounded content agent
  -> renderer and PDF quality checks
  -> evaluation scorer and report
```

## Step 1: Add a machine-readable corpus manifest

Add:

```text
source-docs/manifest.jsonl
source-docs/scenarios/
```

Every primary source artifact should have one manifest record:

```ts
type CorpusDocument = {
  id: string;
  path: string;
  sha256: string;
  mimeType: string;
  phase: string;
  category: string;
  scope:
    | "current_employer"
    | "prior_employer"
    | "blank_form"
    | "master_template"
    | "generic_reference"
    | "regulatory";
  authority:
    | "employer_decision"
    | "official_plan"
    | "carrier_rate"
    | "administrator"
    | "template_structure"
    | "educational"
    | "legal_model";
  expectedClassification: {
    family: string;
    subtype: string;
    benefitTypes: BenefitType[];
    roles: string[];
  };
  variationTags: {
    jurisdiction?: string[];
    market?: string[];
    planDesign?: string[];
    funding?: string[];
    documentShape?: string[];
    sourceQuality?: string[];
    specialFeatures?: string[];
  };
  testCapabilities: string[];
  mustExtract: Array<{
    path: string;
    value?: unknown;
    pattern?: string;
    sourcePage?: number;
    sourceSheet?: string;
  }>;
  mustNotExtract: Array<{
    path: string;
    reason: string;
  }>;
  minimumCounts?: Record<string, number>;
  costTier: "small" | "medium" | "large";
  notes?: string[];
};
```

Do not attempt to gold-label every sentence. Start with three to eight important
anchor facts per document plus explicit forbidden facts. The existing category
READMEs contain enough provenance and field inventories to bootstrap the
manifest, but the final expectations should be human-reviewed.

Examples of forbidden facts:

- a blank employer application must not produce an employer name;
- a master template must not become the current employer;
- an HSA-qualified medical plan must not prove that an employer offers or funds
  an HSA;
- a generic IRS account guide must not produce employer contribution amounts;
- a prior booklet must not silently become current-year plan evidence.

### Step 1A: Test the meaningful variables, not merely every file

Running all 149 documents is necessary but not sufficient. Each category's examples
examples were chosen to be materially different, so the manifest must preserve
those differences as testable variables. A corpus report should fail when all
files ran but a variation was never asserted.

For every document, record and test applicable dimensions from four groups:

1. **Source shape:** PDF/XLS/XLSX/CSV/DOCX/ZIP/TXT, short versus long, embedded
   text versus OCR, table/form/narrative, multiple sheets or attachments, and
   clean versus ambiguous input.
2. **Factual role:** current/prior/blank/template/generic/regulatory,
   employer-specific versus generally applicable, authoritative versus
   educational, and selected-plan evidence versus merely available options.
3. **Benefit variation:** jurisdiction, market, plan or program design,
   carrier/administrator, funding, employer-paid versus voluntary, tier and
   contribution shape, limits, eligibility linkage, and category-specific
   special features.
4. **Pipeline behavior:** expected route, facts that must be found, facts that
   must remain absent, ambiguity warnings, conflicts, precedence, questions or
   blockers created, booklet sections enabled, and claims allowed in final copy.

Generate a coverage ledger from `variationTags` and `testCapabilities` showing:

- every document was classified and routed;
- every document's distinguishing variables were asserted;
- each populated category has positive, negative, missing-data, and ambiguity
  coverage where applicable;
- every benefit section is tested with one document, multiple documents, and a
  document that must not activate that section;
- overlapping facts, contradictory facts, prior/current precedence, duplicate
  documents, and plan-to-rate matching are exercised in coherent scenarios;
- no variation tag exists without a corresponding assertion or explicitly
  documented future capability.

Do not build the full Cartesian product of all variables. Run every document in
isolation, then use deterministic pairwise scenario recipes to cover meaningful
interactions. For example, combine multiple medical plan documents with a rate
sheet, or an HSA-qualified HDHP with an HSA administrator guide and an employer
contribution decision. Do not randomly combine unrelated employers.

The evaluation report should include per-document, per-category, per-variable,
and per-capability scores. This makes it possible to see that the system handles
both five medical files and the distinct variables represented by those files.

## Step 2: Separate document family, subtype, benefit, scope, and authority

Replace the single-role classification assumption with a richer contract:

```ts
type DocumentClassification = {
  fileId: string;
  family:
    | "employer_setup"
    | "plan_document"
    | "rate_cost"
    | "census_enrollment"
    | "booklet_template"
    | "instruction_decision"
    | "legal_notice"
    | "contact_brand"
    | "unknown";
  subtype: string;
  benefitTypes: BenefitType[];
  scope: CorpusDocument["scope"];
  authority: CorpusDocument["authority"];
  confidence: number;
  evidence: SourceRef[];
  reasoningSummary: string;
};
```

Keep a compatibility mapping to the existing `DocumentType` values during the
migration so the pipeline can be changed incrementally.

Add a routing registry rather than hard-coded type sets:

```ts
route(classification) ->
  employerSetupExtractor |
  rateExtractor |
  censusExtractor |
  medicalExtractor |
  dentalExtractor |
  visionExtractor |
  lifeDisabilityExtractor |
  accountExtractor |
  programExtractor |
  priorGuideExtractor |
  instructionExtractor |
  legalNoticeExtractor |
  genericFactExtractor
```

## Step 3: Normalize files before sending them to the model

Add `lib/document-ingestion.ts` with support for:

- PDF embedded-text extraction with page boundaries;
- OCR fallback when extracted text is absent or corrupted;
- XLS/XLSX workbook sheet and used-range summaries;
- CSV parsing and delimiter/column detection;
- DOCX text and table extraction;
- EML body and attachment extraction;
- safe ZIP inspection with file-count, expanded-size, and nested-file limits;
- MIME sniffing instead of trusting the request header or extension;
- PII detection/redaction metadata for census and enrollment data.

The normalized result should preserve original bytes plus page/sheet/row
coordinates. Classification should normally use filename, metadata, first-page
samples, table of contents, and workbook headers. Extractors should receive only
relevant page/sheet chunks unless the document is small.

## Step 4: Add benefit-specific extraction schemas

Generalize `BenefitPlan.attributes` to a discriminated union:

```ts
type BenefitPlanAttributes =
  | MedicalPlanAttributes
  | DentalPlanAttributes
  | VisionPlanAttributes
  | LifePlanAttributes
  | DisabilityPlanAttributes
  | VoluntaryPlanAttributes;
```

Add structured account and program details outside plan attributes:

- `HsaProgramDetails`
- `HraProgramDetails`
- `FsaProgramDetails`
- `EapProgramDetails`
- `TelemedicineProgramDetails`
- `LegalNoticeDetails`
- `EnrollmentSummary`

Minimum useful extraction fields:

### Dental

- plan identity, carrier, network/design;
- deductible and annual maximum;
- preventive/basic/major coverage;
- orthodontia;
- frequencies, waiting periods, and exclusions.

### Vision

- exam copay/frequency;
- lenses and frame allowances/frequencies;
- contacts allowance;
- network and reimbursement rules.

### Life and AD&D

- employer-paid or voluntary;
- benefit amount/formula and maximum;
- AD&D amount;
- guarantee issue and EOI;
- age reductions and dependent coverage.

### STD and LTD

- benefit percentage;
- weekly/monthly maximum;
- elimination period;
- maximum duration;
- definition of disability;
- pre-existing condition and offsets;
- funding and employee cost.

### HSA/HRA/FSA

- account subtype;
- administrator;
- eligibility linkage;
- employee and employer contributions;
- annual limits;
- carryover/grace/runout rules;
- eligible expenses and claim/access instructions.

### EAP, telemedicine, and voluntary

- vendor/carrier;
- eligibility;
- services/products;
- session or visit limits;
- member cost;
- access channels and contacts;
- important limitations.

## Step 5: Build five levels of tests

### Level 0: Corpus integrity - no model calls

Add `tests/source-corpus.test.ts`.

Validate:

- every manifest path exists;
- SHA-256 matches;
- MIME and file signature match;
- every populated category has five primary examples;
- no HTML/error page is mislabeled as a source file;
- no unapproved verification/temp artifact is treated as a fixture;
- duplicate hashes are explicitly aliased rather than double-weighted;
- no known real employee PII appears in public fixtures.

This runs in normal `npm test`.

### Level 1: Classification and routing evals

Add:

```text
tests/source-classifier.corpus.live.test.ts
tests/source-router.test.ts
```

For each manifest record, score:

- document family;
- subtype;
- benefit-type precision/recall;
- scope;
- authority;
- route selected;
- confidence calibration;
- evidence presence.

Do not compare the model's explanation text exactly.

### Level 2: Raw extraction evals

Add:

```text
tests/employer-extractor.corpus.live.test.ts
tests/rate-census-extractor.corpus.test.ts
tests/benefit-module-extractor.corpus.live.test.ts
tests/template-instruction-extractor.corpus.live.test.ts
```

Each test should load its cases dynamically from the manifest and score:

- schema validity;
- required anchor-fact recall;
- value correctness;
- source page/sheet/row validity;
- quote/evidence support;
- forbidden-fact count;
- warning quality for unreadable or ambiguous files;
- model usage, latency, and estimated cost.

Exact JSON snapshots should not be the main assertion because harmless wording
and ordering changes would make them brittle.

### Level 3: Normalization and assembly scenarios

Add deterministic scenario recipes in `source-docs/scenarios/*.json`.

Each recipe should list source IDs, a minimal current-employer instruction
overlay when needed, expected offered sections, expected blockers/conflicts, and
expected provenance.

Initial scenarios:

1. Blank employer form does not fabricate company facts.
2. HSA-qualified medical plan triggers an HSA offering/funding question.
3. Multiple medical plans remain distinct and match the intended rate rows.
4. Dental/vision/life/STD/LTD documents produce their own plan details rather
   than medical-shaped output.
5. Master template changes structure but cannot leak employer facts.
6. Prior booklet versus current employer waiting-period conflict.
7. Missing contribution creates one specific blocker per necessary tier.
8. Non-blocking missing ancillary detail produces warnings, not a generic
   failure.
9. OCR document preserves lower-confidence source evidence.
10. DOCX/ZIP/unknown input is safely processed or explicitly rejected.

Public files from unrelated employers must not be combined as if they were one
coherent factual case. Use generic/reference documents only for their correct
role, and add a minimal controlled current-employer overlay for end-to-end cases.

### Level 4: Raw end-to-end pipeline tests

Replace the single synthetic mixed-file case in
`tests/booklet-pipeline.live.test.ts` with a manifest-driven scenario matrix.

Run real:

```text
files
 -> classification
 -> extraction
 -> assembly
 -> blocker/resume
 -> outline
 -> content agent
 -> HTML/PDF
 -> text and provenance checks
```

Assertions should cover:

- expected status and blocker paths;
- offered sections and omitted sections;
- selected plan identities;
- plan/rate matches;
- source references for important fields;
- no template-employer leakage;
- no unsupported numbers, contacts, URLs, or legal claims;
- required text in the PDF;
- absence of placeholders and unsourced generic benefit claims;
- PDF validity, page size, and section presence.

### Level 5: Grounded content and renderer evals

Keep the current synthetic content-agent matrix because it isolates grounding
logic, but add tests using `BenefitsPackage` results produced from raw corpus
scenarios.

The content agent and deterministic renderer should both be held to the closed
fact set. Generic claims currently hard-coded in renderer pages must either:

- come from approved-language sources with provenance;
- be represented as explicitly versioned boilerplate with a legal/content
  owner; or
- be omitted when unsupported.

The final PDF scorer should extract text and verify every material number,
email, phone, URL, eligibility deadline, and benefit claim against the package
or approved boilerplate registry.

## Step 6: Make live tests dynamic but reproducible

Dynamic should mean manifest-driven and filterable, not random and
non-reproducible.

Add shared helpers:

```text
tests/helpers/source-corpus.ts
tests/helpers/ai-eval.ts
tests/helpers/scenario-loader.ts
scripts/run-booklet-evals.ts
scripts/summarize-booklet-evals.ts
```

Useful controls:

```text
AI_EVAL_CATEGORY=medical-insurance
AI_EVAL_IDS=id1,id2
AI_EVAL_SAMPLE=1
AI_EVAL_SEED=20260717
AI_EVAL_CONCURRENCY=2
AI_EVAL_MODEL=<model>
AI_EVAL_MAX_COST_USD=<budget>
AI_EVAL_UPDATE_BASELINE=1
```

Cache expensive raw results by:

```text
sha256 + model + promptVersion + schemaVersion + preprocessingVersion
```

Never reuse a cache entry after any of those inputs change.

Store evaluation artifacts under:

```text
output/evals/<run-id>/
├── results.jsonl
├── summary.json
├── summary.md
├── failures/
├── extractions/
└── generated-pdfs/
```

Each result should record model, prompt/schema versions, token usage, latency,
estimated cost, scores, warnings, and failure evidence.

## Step 7: Split test commands by cost and purpose

Recommended scripts:

```json
{
  "test": "deterministic unit and corpus-integrity tests",
  "test:ai:smoke": "one small document per populated category",
  "test:ai:category": "all documents in selected categories",
  "test:ai:scenarios": "mixed-file raw pipeline scenarios",
  "test:ai:full": "all 149 primary source documents",
  "test:ai:release": "full corpus plus end-to-end PDF scenarios"
}
```

Suggested cadence:

- every PR: deterministic tests and corpus integrity;
- opt-in local/PR label: AI smoke set;
- nightly: one representative per populated category plus scenario tests;
- weekly or before release: full 149-document corpus;
- model/prompt/schema change: selected-category comparison, then full release
  evaluation before rollout.

## Scoring and initial gates

Use score-based reports plus a small number of hard invariants.

Hard failures:

- invalid structured output;
- wrong extractor route;
- unsupported file crash;
- fabricated fact from a blank form;
- template or prior-employer fact leakage;
- material value without valid evidence;
- unresolved blocker followed by PDF generation;
- unsupported number/contact/URL in final copy;
- invalid or missing PDF section.

Initial quality targets:

```text
Document-family accuracy                 >= 95%
Benefit-type recall                      >= 95%
Scope/authority accuracy                 >= 95%
Structured-output validity               = 100%
Anchor-fact recall                       >= 90%
Material value correctness               >= 95%
Valid page/sheet evidence                >= 95%
Blank/template forbidden-fact count      = 0
Template employer leakage                = 0
Unsupported final-copy material facts    = 0
```

Treat these as starting gates. Tighten them after the first full baseline shows
which failures are annotation problems versus implementation problems.

An optional LLM judge may help score semantic equivalence or readability, but it
must not be the only pass/fail oracle. Gold anchors, evidence validation, and
deterministic invariants should remain primary.

## Concrete code changes by iteration

### Iteration 1: Evaluation foundation

Add:

- `source-docs/manifest.jsonl`
- `tests/helpers/source-corpus.ts`
- `tests/source-corpus.test.ts`
- `tests/source-classifier.corpus.live.test.ts`
- `scripts/run-booklet-evals.ts`
- evaluation output/report types

Modify:

- `package.json` test scripts

Do not change production extraction behavior in this iteration. Establish the
first honest baseline and failure report.

### Iteration 2: Classification and ingestion

Add:

- `lib/document-ingestion.ts`
- `lib/document-router.ts`
- richer classification schemas
- DOCX/ZIP safe handling
- local text/OCR preprocessing

Modify:

- `lib/booklet-types.ts`
- `lib/document-classifier.ts`
- `lib/booklet-pipeline.ts`
- `api/booklet-pipeline.ts`

### Iteration 3: Benefit-specific extraction

Add extractors and schemas in this order:

1. dental and vision;
2. life, STD, and LTD;
3. HSA, HRA, and FSA;
4. EAP, telemedicine, and voluntary;
5. legal notices, enrollment/census, and instructions.

This ordering reaches high-value booklet sections while reusing similar schema
and evidence patterns.

### Iteration 4: Package and renderer integration

Modify:

- `lib/booklet-types.ts`
- `lib/extracted-facts.ts`
- `lib/benefits-package-assembler.ts`
- `lib/booklet-content-agent.ts`
- `lib/booklet-package-adapter.ts`
- `lib/booklet.ts`
- `lib/booklet-quality-checker.ts`

Replace ancillary `offered: true` placeholders with actual structured facts and
source-backed content.

### Iteration 5: End-to-end scenario suite

Add the raw mixed-file scenario matrix, blocker/resume tests, generated PDF text
checks, model/cost reporting, and nightly/release commands.

## Recommended first implementation slice

Start with the corpus manifest and classifier/router evaluation only.

That first slice is valuable because it will:

1. convert the 149 files into auditable test cases;
2. show the exact classification failures before extractor work begins;
3. prevent new extractors from being built behind an unreliable router;
4. establish caching, cost controls, and reporting once;
5. avoid changing production behavior until there is a measurable baseline.

After that, implement dental and vision as the first non-medical extraction
vertical, carrying both from raw files through classification, structured facts,
booklet sections, content, and rendered PDF. This provides a reusable pattern
for life/disability and the account/program sections.
