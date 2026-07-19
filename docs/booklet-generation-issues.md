# Booklet Generation Issues

This document tracks known backend booklet-generation gaps. It intentionally
excludes frontend and manual UI configuration work.

## Scope

The generator recognizes these benefit types:

- Medical
- Dental
- Vision
- Life and AD&D
- Short-term disability (STD)
- Long-term disability (LTD)
- Voluntary/Aflac benefits
- Health savings account (HSA)
- Health reimbursement account (HRA)
- Flexible spending account (FSA)
- Telemedicine
- Employee assistance program (EAP)

The outline and deterministic renderer can include pages for these benefits.
The remaining problem is generating complete, source-backed content instead of
generic sections that only establish that a benefit is offered.

## Current implementation status

Status reviewed July 17, 2026.

The core backend is a credible working MVP:

- Thread creation, mixed-file intake, classification, extraction, package
  assembly, blocker questions, answer/resume behavior, outline generation, PDF
  rendering, persistence, and signed result links are implemented.
- A production smoke run generated a valid 12-page US Letter PDF from employer
  setup, a real medical SBC, and a contribution workbook.
- Current local checks pass: 187 deterministic tests, the Vite production
  build, a targeted backend TypeScript check, and a freshly rendered/inspected
  pair of real-document 8-page US Letter HSA/STD PDFs. All 84 paid/live tests
  now have passing execution evidence across the recorded live runs.
- Medical and dental plan/rate generation is the strongest part of the current
  system.

This should not yet be described as complete production support:

- A corrected Cloud Run production smoke generated a 12-page US Letter PDF
  using the authoritative 26-pay-period workbook basis. PDF text and rendered
  pages were independently checked. The current run evidence is recorded in
  `BENEFITS_BOOKLET_GENERATOR_IMPLEMENTATION_REPORT.md`.
- The `ansa-booklet-backend` Cloud Run service is deployed and
  `VITE_BACKEND_API_URL` exists in the Vercel project. The Vercel frontend has
  not been rebuilt since the variable was added, so frontend migration remains
  incomplete and deployment is currently paused.
- The 19-section content, HSA confirmation, and ancillary-only blocker fixes in
  the current working tree are local-only and have not been deployed to the
  paused Cloud Run service.
- The content agent now covers the full 19-section outline, including HSA and
  STD. All eight added paid/live HSA/STD matrix cases passed, as did two new
  real-document classification/extraction/content/PDF tests.
- A canonical, researched requirements registry now defines 339 required,
  conditional, and optional fields across all 12 benefit types. Its structural
  validator and gate evaluator are tested, but it is not yet wired through the
  extractor router, question engine, content agent, and quality checker.
- Authentication, tenant isolation, and private data access are not complete.
  Real sensitive employer data must not be treated as safely isolated yet.

## Known issues

### 1. Ancillary plan attributes are not modeled

`BenefitPlan.attributes` is based on the medical-plan schema. There are no
type-specific attribute models for Life/AD&D, STD, LTD, or voluntary products.

Required models should cover at least:

- Life/AD&D: benefit amount or formula, AD&D amount, guarantee issue, age
  reductions, funding, and employee cost.
- STD: benefit percentage, weekly maximum, elimination period, maximum
  duration, funding, and employee cost.
- LTD: benefit percentage, monthly maximum, elimination period, maximum
  duration, pre-existing-condition rules, funding, and employee cost.
- Voluntary/Aflac: product subtype, carrier, benefit amounts, eligibility,
  funding, and enrollment/contact information.

### 2. Document extraction detects offerings but not full policy details

The general booklet extractor can detect that Life, STD, LTD, or voluntary
benefits are offered and can extract selected plan names. It does not extract
the detailed policy fields required to populate the existing benefit tables.

Add source-backed extractor schemas and provenance for every required
type-specific field. Do not infer values from generic template language.

### 3. Voluntary/Aflac products are collapsed into one category

The normalized model currently represents all voluntary products as
`voluntary`. It cannot separately represent or render employer offerings such
as:

- Accident insurance
- Critical illness or specified-disease coverage
- Hospital indemnity
- Voluntary life insurance
- Voluntary disability products

The package needs a structured voluntary-product collection so each offered
product can be sourced and rendered without implying that every possible
voluntary product is available.

### 4. Account details do not reach the final booklet completely

Account support is incomplete even when HSA, HRA, or FSA is detected.

- HSA employer contributions are not reliably represented and rendered.
- HRA contribution tiers can exist in legacy renderer data but are not fully
  mapped from `BenefitsPackage` into the final renderer.
- FSA healthcare/dependent-care types, election limits, carryover, grace
  period, and runout rules are not modeled.
- Account administrators and contribution rules must remain associated with
  the correct account when multiple account types are offered.

### 5. The package-to-renderer adapter discards ancillary detail

The current adapter primarily converts Life, STD, and LTD offerings to an
`offered` flag. It does not carry full policy details into the renderer's
`coverageDetails` fields. This causes generic pages even when richer source data
could be available.

Replace the flag-only mapping with type-specific mappings and ensure every
rendered value retains its source reference.

### 6. The grounded content agent omitted STD and HSA (resolved locally)

STD and HSA are now included in the grounded content agent's section inventory,
readiness logic, closed fact sets, deterministic coverage, and expanded
four-scenario live matrix.

The eight new section-matrix assertions and two real-document pipelines now
pass with the live models. The generated HSA and STD PDFs were independently
checked with `pdfinfo`, `pdftotext`, Poppler rendering, and visual inspection.
This resolves content-section presence, but not the typed policy-detail gaps in
issues 1-5.

### 7. Blocker questions do not cover incomplete ancillary benefits

The question engine handles missing employer identity, dates, eligibility,
plan/rate matches, and contribution rules. It does not ask targeted questions
when an offered Life, STD, LTD, voluntary, HSA, HRA, or FSA section lacks facts
required for accurate generation.

Use the canonical rules in `lib/benefit-requirements/` to generate
benefit-specific blocker questions. Questions should remain exception-only and
should cite the source documents that established the offering.

### 8. Quality checks verify presence rather than completeness

The quality checker confirms that an offered benefit has an outline/rendered
section, but it does not verify that the section contains the required
source-backed policy fields.

Add per-benefit completeness checks, including:

- Required attributes for each offered ancillary benefit.
- Source references or an explicit manual answer for every rendered value.
- No generic list of possible voluntary products presented as an employer's
  actual offering.
- Account contribution calculations and account-specific rules render when
  supplied.

The deterministic renderer also contains general eligibility, account, and
legal boilerplate that is not always derived from the uploaded source set.
Quality checks should distinguish approved reusable legal copy from factual
employer/plan claims and reject unsupported factual statements.

### 9. Real-file end-to-end coverage is incomplete

Renderer unit tests cover many optional sections, but each supported benefit
type still needs a live test proving the complete path:

```txt
Source document
  -> classification and extraction
  -> normalized BenefitsPackage
  -> blocker decision, if required
  -> booklet outline and content
  -> rendered PDF
  -> text/source sanity checks
```

Required live fixtures include Life/AD&D, STD, LTD, at least two distinct
voluntary/Aflac products, HSA with an employer contribution, tiered HRA funding,
and healthcare/dependent-care FSA variants.

Current real-file progress:

- A Minnesota SEGIP HSA contribution form now passes live classification,
  extraction, 19-section content generation, PDF rendering, text checks, and
  visual inspection. It proves the HSA section path, but not extraction of a
  concrete employer-contribution amount or account rules.
- A University of California/Lincoln STD summary now passes the same full path
  and preserves the sourced plan name, carrier, eligibility, and $0 employee
  contribution. The source also contains a 55% benefit, $800 weekly maximum,
  24-week duration, and elimination periods; those details remain absent from
  the normalized schema and rendered table.

### 10. The corrected payroll basis is verified, but needs durable regression automation

The production smoke test found a PDF using 52 deductions when the active
spreadsheet contribution rule specified 26. `packagePayPeriods` now prefers an
active spreadsheet-sourced rule, and a deterministic regression test covers
that selection.

The corrected Cloud Run run completed with 26 deductions, exact per-pay text
assertions, and visual table inspection. The remaining work is to move these
checks from a manual/destructive smoke script into a controlled deployment or
staging gate and preserve run evidence automatically.

### 11. The Cloud Run backend migration is incomplete

`cloud-run/` contains a Node server, Dockerfile, build configuration, CORS
handling, and deployment instructions. The Cloud Run service is deployed and
has completed a real generation. The Vercel project has
`VITE_BACKEND_API_URL`, but the production frontend has not been rebuilt with
the new API base.

Do not deploy the current Vercel configuration—which excludes `api/`—until the
Cloud Run service is healthy and the frontend API base is configured. After
migration, verify every backend route, CORS behavior, long OCR/PDF requests,
logging, and rollback behavior.

### 12. Authentication and tenant isolation are missing

The generation API accepts company, thread, run, and uploaded-file identifiers
without authenticating the caller or verifying ownership. CORS is not an
authorization boundary.

The current Firebase rules also permit public access to benefit-company data:

- Firestore allows public reads and writes under `benefitsCompanies`.
- Storage allows public reads and direct writes for plan PDFs and generated
  booklets.
- Generated PDFs receive signed URLs that currently expire in 2035.

Before using sensitive employer data:

- Require authenticated backend requests.
- Associate every company, thread, run, message, upload, and output with an
  authorized organization/user.
- Verify ownership when attaching file IDs, reading status, answering
  questions, and loading runs.
- Make Firestore and Storage rules deny public access by default.
- Use appropriately short-lived download links or authenticated downloads.
- Add cross-tenant access tests for every API action.

## Definition of done

Generation support for these benefits is complete when:

- [x] One canonical registry defines required, conditional, and optional fields
  for every supported benefit and keeps extraction, safe-booklet, and formal
  disclosure gates separate.
- [ ] Extraction, questions, rendering, and quality checks all enforce that
  registry rather than maintaining separate completeness lists.
- [ ] Every offered benefit has a type-specific normalized schema.
- [ ] Detailed values are extracted with page/text provenance.
- [ ] The package-to-renderer adapter preserves all supported attributes.
- [x] The content agent supports every rendered section, including STD and HSA.
- [ ] Missing material details create specific blocker questions.
- [ ] Quality checks reject incomplete or unsourced benefit sections.
- [ ] Voluntary products render only the products actually offered.
- [ ] HSA, HRA, and FSA contributions and rules appear correctly in the PDF.
- [ ] Real-file live tests pass for each benefit and account type.
- [x] The 26-pay-period correction is deployed and passes a fresh production
  smoke/visual check.
- [ ] The deployed Cloud Run backend is connected to a freshly built and
  route-verified production frontend.
- [ ] Authentication and tenant ownership are enforced for every generation
  resource and action.
- [ ] Firestore, Storage, and generated PDF access are private by default.
