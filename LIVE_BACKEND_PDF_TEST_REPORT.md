# Live Backend PDF Test Report

> Historical point-in-time report. A later Cloud Run run produced and verified
> the corrected 26-pay-period PDF. See
> BENEFITS_BOOKLET_GENERATOR_IMPLEMENTATION_REPORT.md for the current run IDs,
> artifact metadata, visual review, deployment state, and known gaps.

Date: July 17, 2026  
Production frontend/API tested: https://ansa-benefits-studio.vercel.app  
Google project confirmed: `flux-ebfb0` (`ansa-flux` gcloud configuration)  
Vercel workspace/project: `miles-lows-projects/ansa-benefits-studio`

## Objective

Verify the deployed backend with a true production generation request using real plan material and realistic employer choices—not mocked extraction or a synthetic empty PDF. The test must upload source documents, run the OpenAI-backed agent pipeline, persist its state in Firestore, render a real PDF, store it in Firebase Storage, download it, and independently inspect the result.

## Repeatable live test

Added [`scripts/production-backend-smoke.ts`](scripts/production-backend-smoke.ts).

The script sends these inputs to the deployed backend:

1. A completed employer-benefits setup PDF containing:
   - Employer: Ansa Production Verification LLC
   - Plan year: January 1, 2026 through December 31, 2026
   - Full-time eligibility: first of the month after 30 days
   - Medical, dental, HRA, and FSA offerings
   - HealthEquity as the HRA/FSA administrator
   - A real HR/enrollment contact
2. The real UnitedHealthcare Bronze 2026 SBC fixture at `tests/fixtures/plans/uhc-bronze-2026.pdf`.
3. A generated XLSX contribution workbook with current medical and dental selections, four coverage tiers, employer/employee monthly costs, enrollment counts, and a 26-pay-period basis.

The test also exercises the agent workflow. If the first run is blocked, it submits answers for every recognized blocker in one resume request and requires the resumed run to complete.

## Production defects found and fixed

### 1. Pipeline events contained `details: undefined`

The first live run failed when Firestore rejected the `Classifying documents` event. The optional `details` property was always materialized even when no value existed.

Fix:

- Pipeline events now omit `details` when absent.
- The Firestore event persistence boundary also serializes records to remove nested undefined values.
- Regression assertions verify that events without details do not own the property while detailed events retain it.

### 2. Blocker questions contained nested `options: undefined`

The next live run reached conflict resolution, then Firestore rejected the run snapshot because `questions[0].options` was undefined.

Fix:

- Generation-run snapshots are normalized before persistence.
- Extracted-fact writes use the same Firestore-safe normalization.
- Added `tests/booklet-thread-store.test.ts` for nested undefined values.

### 3. Agent resume accepted only one answer per full rerun

The live agent correctly returned blocking questions when an email instruction file was not treated as authoritative employer setup. Answering them one at a time would rerun the expensive extraction pipeline repeatedly.

Fix:

- The `answer` API action now accepts an `answers` object.
- Only fields matching the run's current blocking questions are accepted.
- All accepted answers are persisted as thread messages, then the run resumes once.
- The smoke test supports employer, dates, eligibility, selected plans, rate matching, and contribution blockers.

### 4. PDF used 52 deductions despite a 26-pay-period workbook

Independent text inspection of the first completed PDF found that monthly premiums and employer/employee shares were correct, but the PDF's per-pay calculations used 52 deductions. A model-derived contribution default appeared before the authoritative spreadsheet rule.

Fix:

- `packagePayPeriods` now prefers the active plan's spreadsheet-sourced payroll basis.
- Added `tests/booklet-package-adapter.test.ts` to ensure a 26-period spreadsheet beats a 52-period model default and an unrelated 24-period plan.
- The live smoke test now extracts text with Poppler and requires `26 payroll deductions`, `$123.45`, and the formula-derived family deduction `$547.98`, while rejecting `52 payroll deductions` and placeholder/invalid text. The workbook's hand-entered `$548.00` value is a two-cent approximation; `$1,187.29 × 12 ÷ 26` correctly rounds to `$547.98`.

## Completed production run evidence

The production run completed all 14 pipeline stages:

- Thread ID: `b42c356c-3beb-40aa-b473-1fa26cf3a7e4`
- Run ID: `71f98f47-0ed7-4887-8409-320d7210a4cb`
- Status: `complete`
- Stored object: `benefitsCompanies/production-verification-1784339719164/booklets/ansa-production-verification-llc-71f98f47-0ed7-4887-8409-320d7210a4cb-benefits-guide.pdf`
- Local QA artifact: `output/pdf/live/production-backend-live-benefits-guide.pdf`
- Size: 115,810 bytes
- Pages: 12
- Page size: 612 x 792 points (US Letter)
- Persisted events: 31

The generated guide contained:

- Cover and table of contents
- Welcome, open enrollment, and eligibility
- UHC Bronze 2026 medical coverage and four-tier costs
- 2026 UnitedHealthcare dental coverage and four-tier costs
- HSA, HRA, and FSA sections
- HealthEquity administration
- HR contact list
- Legal notices

The PDF text contained no `undefined`, `null`, placeholder, invalid-date, or `NaN` output.

## Verification status

Passed before the payroll-basis correction:

- Full deterministic suite: 177 passed, 74 paid live scenarios skipped in the standard run
- Focused Firestore/pipeline tests: passed
- Production server typecheck: passed
- Vite production build: passed
- Production backend upload, extraction, generation, Firestore persistence, Storage persistence, download, PDF parsing, page count, and US Letter validation: passed
- Independent extracted-text coverage check: passed except for the payroll-basis defect described above

The 26-pay-period correction and exact text assertions have been implemented locally. The final redeploy, repeat live run, and rendered-page visual review are the remaining verification steps; this section will be updated with the final deployment and run identifiers after they pass.

## Hosting direction

The frontend remains appropriate for Vercel. The long-running document extraction, OpenAI generation, Chromium rendering, and PDF QA backend is being separated for deployment to Google Cloud Run in `flux-ebfb0`, where request duration, memory/CPU sizing, backend logs, and container dependencies are a better fit.

The Cloud Run configuration uses `gpt-5.6` for employee-facing booklet content, following current OpenAI model guidance, while retaining `gpt-5.4-mini` for plan extraction and classification.

For the current development phase, the Cloud Run API is publicly callable without authentication and accepts CORS requests from any origin. Secrets remain private in Google Secret Manager.
