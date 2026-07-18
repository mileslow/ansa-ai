# Canonical Benefit Requirements Wiring Guide

## Goal

Wire the canonical registry in `lib/benefit-requirements/` through the complete
backend path so that a booklet cannot be generated from an offered-benefit flag
alone.

When this work is finished:

- every supported benefit is extracted into type-specific, source-backed
  fields;
- registry evaluation determines whether extraction and booklet generation may
  continue;
- missing or conflicting applicable fields produce specific blocker questions;
- content and rendering may use only fields that passed the safe-booklet gate;
- every rendered material claim has a field path and evidence record; and
- final quality checks fail if the generated booklet bypasses the registry.

Read [canonical-benefit-requirements.md](./canonical-benefit-requirements.md)
before starting. The registry is an operational completeness contract. Formal
disclosure applicability and delivery remain a separate compliance workflow.

## What has already been done, and why

The completed registry work created:

- one definition for each of the 12 supported benefit types;
- 338 required, conditional, and optional field requirements;
- separate extraction, safe-booklet, and formal-disclosure gates;
- explicit resolution states instead of treating every missing value as
  `null`;
- field-level evidence and accepted-authority rules;
- serializable conditional predicates and a fail-closed evaluator; and
- structural tests for completeness, authority, predicates, and serialization.

This was done first because extraction prompts, blocker questions, renderers,
and quality checks cannot agree on completeness unless they share one contract.
The registry says what must be known and what evidence is acceptable. The
wiring work makes every pipeline stage enforce that contract.

## Wiring framework at a glance

Someone implementing the wiring should work through six phases:

1. **Represent:** add benefit-specific normalized models and a requirement
   subject for each actual plan, account, program, or product collection.
2. **Extract:** classify document scope and authority, then extract candidates
   for registry paths with page/cell evidence.
3. **Resolve:** deterministically convert candidates into `FieldResolution`
   states, preserving conflicts, explicit absence, applicability, and manual
   evidence.
4. **Gate and ask:** run `complete_extraction`; turn evaluator issues into
   blocker questions; rerun after answers.
5. **Generate:** build a safe render manifest, run `safe_booklet`, give only
   approved facts to content and rendering, and record a claim ledger.
6. **Verify and persist:** rerun the gate using actual rendered paths, reject
   unsupported claims in final quality checks, and save the evidence and gate
   reports with the generation run.

Complete one benefit vertically—medical is the best starting point—before
repeating the pattern for the other 11 benefit types.

## Current pipeline and target pipeline

The current main path is `runBookletPipeline()` in
`lib/booklet-pipeline.ts`:

```text
classify
  -> generic/medical extraction
  -> extracted facts
  -> assemble BenefitsPackage
  -> hand-written blocker questions
  -> outline
  -> content
  -> legacy adapter / HTML
  -> PDF
  -> presence-oriented quality checks
```

The target path is:

```text
classify scope + authority + benefit type
  -> benefit-specific candidate extraction
  -> resolve candidates into FieldResolution values
  -> build one requirement subject per plan/program/product collection
  -> evaluate complete_extraction
  -> generate blocker questions from evaluator issues
  -> build typed BenefitsPackage projection
  -> build outline and intended render manifest
  -> evaluate safe_booklet before content
  -> generate grounded copy and claim ledger
  -> evaluate safe_booklet again with actual rendered paths
  -> render HTML/PDF
  -> audit rendered claims, evidence, sections, and PDF structure
```

Do not connect the registry only to the final quality checker. By that point the
pipeline has already selected facts and generated copy. Enforcement belongs at
each boundary.

## Core architecture

### Use requirement subjects

Registry definitions describe a benefit domain, but an employer may offer
multiple plans. Evaluate each actual plan or program separately.

Add a type such as:

```ts
type BenefitRequirementSubject = {
  id: string;
  benefitType: BenefitType;
  entityKind: "plan" | "account" | "program" | "product_collection";
  displayName: string;
  employerOrGroupId: string;
  planOrProgramId?: string;
  effectiveStart?: string;
  effectiveEnd?: string;
  resolutions: ResolutionMap;
};

type BenefitGateReport = {
  subjectId: string;
  benefitType: BenefitType;
  gate: RequirementGate;
  passed: boolean;
  applicableRequirementIds: string[];
  issues: RequirementIssue[];
};
```

Create one subject for each medical, dental, vision, life, STD, or LTD plan.
Create one subject for each HSA/HRA program. Use a product-collection subject
for FSA arrangements and voluntary products, while retaining a stable subtype
identifier for each product inside the collection.

Do not combine multiple medical options into one resolution map. Otherwise a
deductible from one option can accidentally satisfy another option.

### Carry a requirements sidecar

`BenefitsPackage` is currently a rendering-oriented projection. Add a sidecar
rather than treating that projection as the evidence store:

```ts
type BenefitsPackageRequirements = {
  registryVersion: string;
  subjects: BenefitRequirementSubject[];
  extractionReports: BenefitGateReport[];
  safeBookletReports: BenefitGateReport[];
  renderedPathsBySubject: Record<string, string[]>;
};
```

Add it to `BenefitsPackage` or return it alongside the package in
`PipelineResult`. Adding it to the package makes persistence and downstream
enforcement harder to forget. Keep the existing normalized package fields as a
typed convenience projection; keep resolution state, evidence, and conflicts
in the sidecar.

Add and persist a registry version. A generated booklet must be traceable to
the requirements version that approved it.

## Step 1: Enrich document classification

### Files

- `lib/booklet-types.ts`
- `lib/document-classifier.ts`
- `tests/document-classifier.test.ts`

`ClassifiedDocument` currently has one flat `documentType`. Add orthogonal
classification fields:

```ts
type DocumentScope =
  | "current_employer"
  | "prior_employer"
  | "generic_reference"
  | "master_template"
  | "regulatory"
  | "unknown";

type ClassifiedDocument = {
  // existing fields
  documentType: DocumentType;
  benefitTypes: BenefitType[];
  documentSubtype: string;
  scope: DocumentScope;
  authority: SourceAuthority;
  employerOrGroupId?: string | null;
  planOrProgramIds: string[];
  effectiveStart?: string | null;
  effectiveEnd?: string | null;
};
```

The classifier should answer what the document is, what benefits it concerns,
whose facts it contains, its period, and what it can authoritatively prove.
Those are separate decisions.

Required behavior:

- a generic carrier brochure is `generic_reference`, even if it describes a
  real plan design;
- a prior booklet is `prior_employer` or prior-year context, never current
  employer evidence;
- an employer election or eligibility file can prove an offering;
- a plan document can prove plan design but does not alone activate an employer
  offering;
- pediatric dental/vision rows in a medical source do not activate standalone
  dental or vision; and
- uncertain scope or authority remains `unknown` and cannot satisfy a material
  field.

The heuristic and model fallback must return the same enriched schema. Do not
derive authority later from filename alone.

## Step 2: Add benefit-specific extraction contracts

### Files

- `lib/booklet-document-extractor.ts`
- `lib/plan-extractor.ts`
- new `lib/benefit-extractors/` modules
- `lib/extracted-facts.ts`
- extractor tests and reviewed fixtures

`BookletDocumentExtractionSchema` currently captures offerings and a small set
of general facts. `BenefitPlan.attributes` currently accepts only
`MedicalPlanAttributes`. Neither can carry the registry.

Create one structured extraction schema per benefit family. The model output
should contain candidate facts, not final truth:

```ts
type ExtractedRequirementCandidate = {
  subjectHint: {
    benefitType: BenefitType;
    planOrProgramName?: string;
    planOrProgramId?: string;
  };
  path: string;
  state: "known" | "explicit_none" | "not_applicable" | "not_found";
  value?: unknown;
  reasonCode?: string;
  evidence: RequirementEvidence;
  confidence: number;
};
```

The extractor prompt should receive the applicable registry fields, allowed
reason codes, and expected value shape. The registry—not the model—determines
which fields are required or optional.

Extraction rules:

- return a page, sheet/cell, or text locator for every known material value;
- keep raw source wording as well as normalized value where useful;
- never emit `explicit_none` merely because a table cell is blank;
- never decide `requires_legal_determination` with a guess;
- never merge two plans because their names are similar;
- preserve table row and column qualifiers such as network, tier, frequency,
  member category, unit, and period basis;
- record derived values only with parent evidence IDs and a transform ID; and
- reject model output paths that are not in the selected registry definition or
  declared conditional-dependency set.

Route documents using the enriched classification. Stop routing every SBC,
SPD, and plan summary through the medical schema.

## Step 3: Build the resolution layer

### New module

Create `lib/benefit-resolution-builder.ts` with a deterministic API:

```ts
function buildBenefitRequirementSubjects(input: {
  companyId: string;
  classifications: ClassifiedDocument[];
  candidates: ExtractedRequirementCandidate[];
  manualAnswers: Record<string, unknown>;
}): BenefitRequirementSubject[];
```

This module is the authority boundary between extraction candidates and
resolved facts.

For every registry path, it must:

1. scope candidates to the same employer/group, plan/program, and effective
   period;
2. discard sources whose authority is not accepted by that field;
3. normalize values without losing the source representation;
4. group equivalent values;
5. produce `conflicting` when acceptable current sources disagree and no
   deterministic precedence rule resolves them;
6. validate `explicit_none` and `not_applicable` reason codes;
7. preserve `not_found`, `unknown`, and
   `requires_legal_determination` as distinct states;
8. attach accountable manual answers as `manual_answer` evidence; and
9. populate all paths returned by `collectPredicateDependencies()` or leave
   them explicitly unresolved.

Do not select the highest-confidence candidate before checking scope and
authority. Confidence is not authority.

The existing `sourcePriority()` and `pick()` logic in
`lib/benefits-package-assembler.ts` can inform migration, but one global
document-type ranking is insufficient. The registry's
`acceptedAuthorities` is field-specific.

## Step 4: Add type-specific normalized models

### Files

- `lib/booklet-types.ts`
- new benefit schema modules
- `lib/benefits-package-assembler.ts`
- assembler tests

Replace the medical-only `BenefitPlan.attributes?: MedicalPlanAttributes` with
a discriminated model. For example:

```ts
type BenefitPlan =
  | MedicalBenefitPlan
  | DentalBenefitPlan
  | VisionBenefitPlan
  | LifeBenefitPlan
  | StdBenefitPlan
  | LtdBenefitPlan
  | TelemedicineProgram
  | EapProgram
  | VoluntaryProduct;
```

Define HSA, HRA, and FSA program models separately instead of storing only
`type` and `administrator`.

Build these projections only from `known`, accepted `explicit_none`, or
accepted `not_applicable` resolutions. Never translate `unknown` into `null`
and then let downstream code guess what `null` means.

Preserve stable subject IDs in every projected plan/program so renderer paths
can be mapped back to the correct resolution map.

## Step 5: Insert the extraction gate into the pipeline

### File

- `lib/booklet-pipeline.ts`

After candidate extraction and before `assembleBenefitsPackage()` is treated as
complete:

1. build requirement subjects;
2. find each definition in `BENEFIT_REQUIREMENTS_REGISTRY`;
3. run `evaluateBenefitRequirements()` with `complete_extraction`;
4. collect all reports;
5. generate questions from report issues; and
6. return `status: "blocked"` if any blocking issue is user-resolvable.

Suggested insertion point:

```ts
const subjects = buildBenefitRequirementSubjects(...);
const extractionReports = subjects.map((subject) =>
  evaluateBenefitRequirements({
    definition: BENEFIT_REQUIREMENTS_REGISTRY[subject.benefitType],
    gate: "complete_extraction",
    resolutions: subject.resolutions,
  }),
);

const questions = buildRequirementQuestions({ subjects, extractionReports });
if (questions.length) return { status: "blocked", ... };
```

Distinguish three outcomes:

- user-resolvable: ask a blocker question;
- source-processing failure: retry/reprocess or report an extraction error;
- legal/compliance determination: route to review, not an ordinary factual
  question.

Do not allow the existing hand-written question list to waive registry issues.
During migration, combine both sets and deduplicate by subject ID plus blocker
code. Remove hand-written completeness rules only after equivalent registry
tests exist.

## Step 6: Generate blocker questions from registry issues

### File

- `lib/question-engine.ts`

Add:

```ts
function buildRequirementQuestions(input: {
  subjects: BenefitRequirementSubject[];
  reports: BenefitGateReport[];
}): BlockerQuestion[];
```

Extend `BlockerQuestion` with:

```ts
subjectId: string;
benefitType: BenefitType;
requirementId: string;
blockerCode: string;
expectedAnswerKind?: string;
```

Question behavior:

- use the registry label and description to identify the exact missing fact;
- name the specific plan/program when more than one exists;
- include sources that established the offering and sources searched for the
  missing field;
- use stable answer keys such as
  `requirements.<subjectId>.<requirementId>`;
- do not ask about optional omitted fields;
- do not ask a conditional field when its predicate is false;
- ask for the predicate input first when applicability is unknown;
- offer explicit-none/not-applicable choices only when the registry permits
  their reason codes; and
- merge duplicate questions only when they concern the same subject and fact.

On resume, convert the answer into `FieldResolution` with manual evidence, then
rerun resolution and evaluation. Do not patch the gate report directly.

Update `api/booklet-pipeline.ts` so answer acceptance uses stable requirement
answer keys and persists the resulting evidence.

## Step 7: Build a pre-content render manifest

### Files

- `lib/booklet-outline.ts`
- new `lib/booklet-render-manifest.ts`
- outline tests

The outline currently includes a benefit whenever `offered === true`. Keep that
selection behavior only after the offering requirement has passed.

Create a render manifest before content generation:

```ts
type RenderField = {
  subjectId: string;
  requirementId: string;
  path: string;
  value: unknown;
  evidenceIds: string[];
};

type BookletRenderManifest = {
  sections: Array<{
    id: string;
    subjectIds: string[];
    fields: RenderField[];
  }>;
};
```

Populate it from applicable `safe_booklet` fields:

- include required and true-conditional fields;
- include optional fields only when a deterministic section policy selects
  them;
- exclude `never_render` fields;
- omit absent `omit_when_absent` fields;
- treat `reference_governing_document` as a sourced reference, not copied legal
  text; and
- retain subject ID, requirement ID, path, and evidence IDs for every field.

Run the safe-booklet evaluator using the manifest's intended field paths before
calling the content model.

## Step 8: Restrict content generation to approved fields

### File

- `lib/booklet-content-agent.ts`

Replace the separate `factsAndMissing()` completeness logic with the render
manifest and safe-booklet reports.

The model should receive only approved `RenderField` values. Use stable
registry paths plus subject IDs instead of array-index paths such as
`plans[0]`, which change when input order changes.

Extend generated section output into a claim ledger:

```ts
type GeneratedClaim = {
  text: string;
  subjectId: string;
  requirementIds: string[];
  sourcePaths: string[];
  evidenceIds: string[];
};
```

Validate deterministically that:

- every cited path was present in the manifest;
- the path belongs to the cited subject;
- evidence IDs belong to that path's accepted resolution;
- every numeric, date, contact, plan, and cost literal is supported;
- blocked or omitted sections contain no copy; and
- the model did not add legal certainty or generic benefit claims.

After content generation, collect the paths actually used and rerun
`safe_booklet`. This promotes any optional-but-used field to required. Reject
the output if this second evaluation fails.

The current pipeline catches content-agent failure and continues with the
deterministic renderer. That fallback may remain only if the deterministic
renderer produces and passes the same claim ledger. A fallback must not bypass
the registry.

## Step 9: Replace flag-only adapter mappings

### Files

- `lib/booklet-package-adapter.ts`
- `lib/benefits-booklet-generator.ts`
- `lib/booklet.ts`
- renderer tests

The adapter currently reduces many benefits to `{ offered: true }` and a plan
name. Replace those mappings with explicit type-specific values from the render
manifest.

Required changes:

- map life/AD&D formula, amount, age reduction, guarantee issue, funding, and
  cost fields;
- map STD/LTD percentage, maximum, elimination period, duration, limitations,
  funding, and cost;
- keep every voluntary product subtype separate;
- map HSA/HRA/FSA contributions, limits, timing, administrator, eligibility,
  and interaction rules;
- map dental and vision plan-design schedules rather than rates alone;
- map EAP and telemedicine service, access, cost, scope, and contact details;
  and
- retain a claim/field identifier on rendered blocks or table cells.

Prefer removing the legacy adapter once the renderer can consume the typed
package and render manifest directly. Until then, make the adapter return both
legacy data and a deterministic mapping from every rendered legacy property to
its registry field.

Do not render generic factual copy for an offered benefit when its material
details are unresolved. Approved reusable boilerplate must be identified as
`approved_boilerplate`, kept separate from employer facts, and limited to the
fields that accept that authority.

## Step 10: Enforce the registry in quality checks

### File

- `lib/booklet-quality-checker.ts`

Extend `checkBookletQuality()` to accept subjects, gate reports, render
manifest, claim ledger, and rendered paths.

Add blocking checks for:

- any failed `safe_booklet` report;
- unresolved condition inputs;
- any outlined benefit without a passed offering requirement;
- any rendered path missing from the manifest;
- any material rendered field without evidence;
- evidence whose authority is not accepted by the field;
- claim subject, employer/group, plan/program, or effective-period mismatch;
- optional fields used without being included in the second gate evaluation;
- unresolved conflicts or legal determinations represented as facts;
- flag-only/generic sections with no material field claims;
- an unsupported contact, number, date, cost, plan name, or eligibility rule;
  and
- missing rendered sections and invalid PDF structure, which the checker
  already handles.

Call the checker twice as today—before and after PDF rendering—but pass the
same requirements artifacts both times. The post-render pass should also
confirm that each claim marker expected by the manifest appears in the HTML/PDF
output.

Do not pass `formal_disclosure` merely because `safe_booklet` passed. If formal
documents are later generated, build a separate applicability, delivery, and
timing engine and then evaluate that gate.

## Step 11: Persist auditable results

### Files

- `lib/booklet-types.ts`
- `lib/booklet-thread-store.ts`
- `api/booklet-pipeline.ts`

Persist with each run:

- registry version;
- requirement subjects and resolutions;
- evidence IDs and locators;
- extraction and safe-booklet reports;
- generated blocker codes and answers;
- render manifest and actual rendered paths;
- content claim ledger;
- model and prompt versions; and
- final quality report.

Do not persist evidence only inside prose or logs. A later audit must be able to
answer: “Which source, location, extraction version, resolution rule, and
registry version authorized this sentence?”

Because saved runs already contain `BenefitsPackage` snapshots, introduce a
snapshot schema version and handle older runs explicitly. Do not silently treat
an old snapshot with no registry reports as approved.

## Recommended implementation sequence

Keep each slice deployable and tested:

1. Add subject/report/sidecar types and registry versioning without changing
   runtime behavior.
2. Enrich classification with scope, authority, benefit types, and effective
   period.
3. Add the deterministic resolution builder and manual-answer conversion.
4. Wire medical into `complete_extraction` and `safe_booklet` gates end to end.
5. Replace medical content completeness with the render manifest and claim
   ledger.
6. Wire dental and vision.
7. Add life, STD, and LTD schemas and renderer mappings.
8. Add HSA, HRA, and FSA schemas, including interaction rules.
9. Add EAP, telemedicine, and voluntary product collections.
10. Make the quality checker require registry artifacts for every run.
11. Remove duplicated hand-written completeness lists and flag-only adapter
    fallbacks.
12. Enable release-gate live scenarios only after deterministic fixtures pass.

Do not start by wiring all 338 paths directly into the renderer. Complete one
benefit vertically from raw file to final quality report, then reuse that
pattern.

## Tests required for each vertical slice

For each benefit type, add deterministic tests for:

1. complete required evidence -> both gates pass;
2. one required field missing -> expected blocker code;
3. conditional predicate true -> field required;
4. conditional predicate false -> field skipped;
5. conditional predicate unresolved -> `condition_unknown` blocker;
6. optional field omitted -> no blocker;
7. optional field rendered -> evidence required;
8. supported explicit-none and not-applicable reasons -> accepted;
9. unsupported reason code -> rejected;
10. two acceptable current sources disagree -> conflict;
11. generic/prior/wrong-employer/wrong-year evidence -> rejected;
12. manual answer -> accepted with manual provenance;
13. multiple plans -> no cross-plan field leakage;
14. content claim cites the correct field and evidence;
15. renderer output includes the selected material values; and
16. quality check rejects a deliberately injected unsupported claim.

Then add one coherent raw-file-to-PDF live scenario and one negative scenario
that must block. Use the corpus manifest approach in
[source-docs-ai-test-integration-plan.md](./source-docs-ai-test-integration-plan.md).

Useful commands:

```bash
npx vitest run tests/benefit-requirements.test.ts
npx vitest run tests/document-classifier.test.ts
npx vitest run tests/benefits-package-assembler.test.ts
npx vitest run tests/booklet-pipeline.test.ts
npx vitest run tests/booklet-content-agent.test.ts
npx vitest run tests/booklet-quality-checker.test.ts
npm test
npm run build
```

Do not make paid model tests part of the default deterministic command. Record
the model snapshot, prompt version, source hashes, outputs, cost, and judge
result for every live run.

## Migration rules

- Keep old hand-written blockers while the corresponding registry slice is not
  wired; delete them only after parity tests pass.
- Mark every benefit subject as `legacy_unenforced` or `registry_enforced`
  during rollout. Quality checks must reject a production-complete claim if any
  offered subject remains legacy-unenforced.
- Never manufacture successful resolutions from existing nullable package
  values without reconstructing their evidence and authority.
- Never infer an employer offering merely because a plan document was uploaded.
- Never convert source silence into explicit none.
- Never let an AI judge override deterministic evidence, authority, conflict,
  or gate failures.
- Never treat passing `safe_booklet` as formal disclosure compliance.

## Definition of done

The wiring is complete only when all of the following are true:

- [ ] All 12 benefit types have benefit-specific extraction schemas.
- [ ] Every offered plan/program/product collection has a stable requirement
  subject.
- [ ] Every registry path can resolve to a typed state with field-level
  evidence.
- [ ] All conditional dependencies are produced or fail closed.
- [ ] `complete_extraction` runs before blocker questions.
- [ ] Questions are generated from evaluator issues and resume through manual
  evidence.
- [ ] `BenefitsPackage` has type-specific ancillary and account models.
- [ ] Outline inclusion requires a proven employer offering.
- [ ] Content receives only safe-booklet-approved fields.
- [ ] Content returns a validated claim ledger.
- [ ] Optional rendered fields are included in the final gate evaluation.
- [ ] The renderer no longer relies on offered-only generic sections.
- [ ] Preflight and post-render quality checks enforce registry reports and
  rendered paths.
- [ ] Requirement artifacts, evidence, versions, and reports are persisted.
- [ ] Deterministic positive, negative, conditional, authority, contamination,
  multi-plan, and renderer tests pass for every benefit.
- [ ] Coherent live raw-file-to-PDF scenarios pass for every benefit.
- [ ] No downstream component maintains a conflicting private list of required
  benefit fields.

At that point the backend may be described as registry-enforced. It should be
called production-complete only after the separate authentication, tenant
isolation, privacy, operational, and formal-compliance work is also complete.
