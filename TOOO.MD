# Booklet Generator TODO

The highest-priority work is the randomized AI test system and legitimate
end-to-end validation. The backend must be complete and trustworthy before the
Studio UI or MCP integration is treated as production-ready.

## Definition of “backend complete”

The backend is complete when it can reliably accept every supported document
type, preserve source provenance, detect conflicts and missing facts, ask only
the necessary blocker questions, resume after answers, generate a grounded
booklet, and return a durable result without relying on frontend-only state.

At minimum, completion requires:

- Type-specific extraction and normalized models for every supported benefit.
- Complete package-to-renderer mappings with no silently discarded facts.
- Source references or explicit user answers for every employer-specific claim.
- Reliable conflict detection, blocker generation, answer/resume, retries, and
  idempotency.
- Durable run, event, question, answer, artifact, and failure records.
- Deterministic quality checks that reject unsupported or incomplete output.
- Passing unit, integration, randomized, live-model, and real-document E2E
  suites.

## Priority: randomized AI document and generation tests

Create a legitimate randomized test harness that generates many different
source packages and attempts complete booklet runs against them. Tests must be
reproducible from a recorded seed and save enough evidence to debug failures.

### Document matrix

Cover every input category, individually and in mixed packages:

- Employer setup, eligibility, enrollment, and client/broker instructions.
- Medical and prescription plan documents.
- Rate, contribution, payroll, census, and enrollment spreadsheets.
- Dental, vision, life/AD&D, STD, LTD, voluntary/Aflac, HSA, HRA, FSA,
  telemedicine, and EAP documents.
- Prior employer booklets, master templates, approved language, and legal
  notices.
- PDF, XLSX, CSV, DOCX, image/OCR, email-like text, malformed files, duplicate
  files, partial files, and unsupported files.

### Randomized scenarios

- Vary employer names, plan years, effective dates, carriers, plan names,
  payroll frequencies, tiers, contributions, enrollment counts, and benefits.
- Randomly omit required facts so the exact expected blocker questions can be
  asserted.
- Introduce contradictions between authoritative and lower-priority sources.
- Introduce near-matches: similar plan names, stale prior-year documents,
  duplicate plans, renamed tiers, inconsistent dates, and mismatched carriers.
- Include multiple medical plans, multiple account types, ancillary-only
  packages, no-medical packages, and benefits marked not offered.
- Exercise ambiguous contribution rules, HSA/HRA/FSA mix-ups, family versus
  employee-only contribution differences, and payroll/monthly conversion
  errors.
- Randomize file order, upload order, answer order, retry timing, duplicate
  requests, interrupted runs, and resume attempts.
- Include adversarial source text and prompt-injection-like instructions inside
  documents; document content must never override system rules or provenance.
- Test conflicting manual answers and later authoritative corrections.

### Assertions for every generated case

- Classification is correct for every file.
- Extracted facts match the generated ground truth.
- Every normalized fact retains its source and confidence/provenance metadata.
- Source priority resolves conflicts correctly and surfaces genuine ambiguity.
- Questions are necessary, specific, answerable, and complete—no missing
  blockers and no unnecessary blockers.
- Answer/resume reaches the same final state as a package that originally
  contained the answered facts.
- Calculations are exact for premiums, employer/employee shares, tier totals,
  annual totals, and per-pay deductions.
- The outline contains exactly the benefits actually offered.
- The rendered booklet contains no invented employer or plan facts.
- Quality checks fail closed when required evidence is absent.
- Repeating a run with the same inputs and answers is idempotent.
- Every failure records the random seed, fixture manifest, model/version,
  prompts, extracted package, questions/answers, events, PDF, and quality report.

### Harness requirements

- Separate deterministic synthetic tests from paid live-model tests.
- Use seeded generators and a shrinker/minimizer to reduce failing cases.
- Maintain a permanent regression corpus from every discovered failure.
- Support configurable case counts, concurrency, retry policy, and cost limits.
- Produce a machine-readable summary and a human-readable failure report.
- Run a small deterministic randomized suite in CI and a larger scheduled suite
  against authorized live models.
- Track pass rate, unsupported rate, blocker accuracy, extraction accuracy,
  generation success, hallucination count, latency, token use, and cost.

## Priority: legitimate end-to-end test

Build a real, repeatable test that proves the complete production-shaped path,
not just mocked helpers or isolated renderer behavior.

The test should:

1. Start with a new authenticated tenant and booklet thread.
2. Upload a representative mixed set of real or privacy-safe source documents.
3. Exercise classification, extraction, assembly, questions, answers, resume,
   content generation, quality checks, persistence, and PDF rendering.
4. Poll or stream durable backend status rather than depending on one long HTTP
   request.
5. Reload the frontend midway through the run and confirm it reconstructs the
   same state from the backend.
6. Verify the final normalized package and every important calculation against
   known expected values.
7. Extract PDF text and render every page for automated layout checks.
8. Visually inspect a saved review artifact for clipping, overlap, missing
   pages, broken fonts, incorrect branding, and unsupported claims.
9. Confirm retry, duplicate-submit, interrupted-run, expired-link, and failed
   generation behavior.
10. Save a complete evidence bundle that can be reviewed without rerunning the
    test.

Add several canonical E2E fixtures: a standard medical package, a multi-plan
package, an ancillary-heavy package, an account-heavy package, and an
intentionally conflicting/incomplete package.

## Fix backend/frontend desynchronization

Make the backend the source of truth for the Studio. Remove frontend-only
simulation and any completion state inferred solely from local timers or local
component state.

- Define one versioned run/event/question/artifact contract shared by backend
  and frontend.
- Persist phase status, uploaded sources, extraction results, conflicts,
  unresolved decisions, answers, progress, warnings, and generated artifacts.
- Give every run, phase, question, answer, and artifact a stable ID.
- Make create/upload/start/answer/retry operations idempotent.
- Use durable polling or event streaming with reconnect and cursor support.
- Rehydrate the Studio correctly after refresh, navigation, reconnect, or a
  second browser session.
- Ensure a phase cannot display a completion check while it has an unresolved
  decision or failed quality check.
- Prevent stale responses from overwriting newer backend state.
- Define terminal states and recovery actions for blocked, failed, canceled,
  expired, and complete runs.
- Add contract tests that run the frontend client against the real backend
  schema.

## Adapt the Studio UI to the real workflow

The current Studio interaction model is the preferred UI direction. Connect it
to actual backend data and preserve its clearer source → decision → booklet
flow.

- Replace prototype timers, hard-coded facts, and local HSA state with real run
  events, extracted facts, questions, and answers.
- Keep processed sources visible while marking phases with unresolved decisions
  as incomplete.
- Show provenance, confidence, conflicts, missing details, and quality results
  from the backend.
- Support upload progress, extraction progress, reconnecting, retrying, and
  recoverable failures without losing work.
- Render booklet pages and final readiness from persisted artifacts.
- Make question cards schema-driven so any backend blocker type can render
  without adding one-off frontend code.
- Add focused UI tests for phase completion, conflicting sources, blocker
  resolution, refresh/rehydration, stale events, retries, and completed runs.
- Do not call the Studio production-ready until the legitimate E2E suite passes
  against the deployed backend.

## Integrate the Studio with the existing company model

The Booklet Studio must be part of the existing company workspace, not a
separate prototype with its own duplicate company state. Use the selected
`benefitsCompanies/{companyId}` record and the existing `/companies/:companyId`
flow as the root context for every booklet action.

- Launch the Studio from the selected company and always pass its stable
  `companyId` into thread creation, uploads, runs, questions, and artifacts.
- Replace the hard-coded Big Tows `initialCompanyProfile` with fields derived
  from the current company record.
- Reuse the existing company name, website, description, industry,
  headquarters, employee counts, renewal/plan-year details, benefit plans,
  rates, and uploaded plan records where available.
- Define one explicit mapping between the frontend company record, the
  normalized backend `BenefitsPackage`, and the legacy renderer company shape.
  Do not create a fourth competing company schema inside the Studio.
- Decide and document which fields are canonical company data, which are
  booklet-run snapshots, and which are extracted suggestions awaiting review.
- Do not silently overwrite canonical company data with lower-confidence AI
  extraction. Present differences for review and save accepted changes through
  the existing company update path.
- Snapshot the relevant company data on each run so an old booklet remains
  reproducible after the company record changes.
- Store booklet threads, input sources, questions, answers, runs, quality
  reports, and artifacts under or indexed by the same `companyId`.
- Show prior and active booklet runs inside the company workspace, including
  status, plan year, creation date, unresolved decisions, and final artifacts.
- Let existing plan documents and rates be selected as booklet sources without
  forcing users to upload the same files again.
- Ensure navigation between companies fully resets/rehydrates Studio state and
  cannot display another company’s sources, decisions, or generated pages.
- Make the company context available to both the Studio client and the future
  MCP tools so they operate on the same records and identifiers.

Add integration tests for opening Studio from a company, prepopulation,
accepted company-profile edits, stale company updates, switching companies,
reusing existing plan files, run snapshots, and viewing historical artifacts.

## Create a booklet-generation MCP server

Create the MCP only after the backend API and state model are stable. The MCP
should be a thin, authenticated interface to the same backend used by the
Studio so a general agent can create booklets without reproducing business
logic.

Suggested tools:

- `create_booklet_thread`
- `upload_booklet_source` or a resource-based file attachment flow
- `list_booklet_sources`
- `start_booklet_generation`
- `get_booklet_status`
- `list_booklet_questions`
- `answer_booklet_questions`
- `retry_booklet_run`
- `get_booklet_package`
- `get_booklet_quality_report`
- `get_booklet_artifacts`
- `download_booklet_pdf`

MCP requirements:

- Use stable structured schemas and return actionable errors.
- Accept and preserve the existing `companyId` on every company-scoped tool.
- Design every operation for tenant-scoped authorization from the start; the
  final auth phase must enforce those boundaries before production use.
- Never expose one company’s sources, answers, or artifacts from a request
  scoped to another company.
- Support long-running work through status/resources rather than blocking tool
  calls indefinitely.
- Make mutating calls idempotent and safe to retry.
- Expose unresolved decisions clearly so an agent can ask the user and resume.
- Preserve source provenance and quality warnings in tool results.
- Include a dry-run or validation path before expensive generation where useful.
- Add MCP contract, auth, retry, malformed-input, and full creation-flow tests.
- Provide concise agent instructions and an example workflow from thread
  creation through final PDF retrieval.

## Final phase: add authentication and authorization

Add auth after the backend workflow, randomized tests, legitimate E2E tests,
company-model integration, Studio synchronization, and MCP tool flow are
working. Auth is still a hard production gate: neither the Studio nor MCP may
handle real customer data before this phase passes.

- Choose one identity provider and establish a stable internal user ID.
- Model organization/company membership and explicit roles instead of trusting
  a client-supplied `companyId`.
- Authorize every company, plan, source, booklet thread, run, question, answer,
  quality report, and artifact read/write on the server.
- Apply the same authorization policy to frontend APIs and MCP tools.
- Propagate user and organization identity into audit records for all mutations.
- Secure Firebase/Firestore and Storage rules; do not rely only on hidden UI or
  route checks.
- Use short-lived signed URLs for private uploads and generated PDFs.
- Prevent insecure direct-object-reference access by guessing company, thread,
  run, file, or artifact IDs.
- Define owner/admin/member/read-only capabilities for creating booklets,
  answering decisions, retrying runs, downloading artifacts, and editing
  canonical company data.
- Handle login, logout, session expiry, revoked membership, invitation, and
  account switching without leaking cached company state.
- Add rate limiting, upload limits, audit logs, secret handling, and safe error
  responses for both HTTP and MCP surfaces.
- Add negative authorization tests across two users, two organizations, and
  multiple companies. Every cross-tenant read and mutation must fail.
- Re-run the canonical E2E suite through both Studio and MCP while authenticated.

## Recommended execution gates

1. Complete backend schemas, extraction, mappings, provenance, and quality
   checks.
2. Build the seeded randomized AI harness and permanent regression corpus.
3. Pass legitimate production-shaped E2E tests across the canonical fixtures.
4. Fix backend/frontend state synchronization and connect the Studio UI.
5. Integrate Studio and booklet history with the existing company model.
6. Re-run E2E tests through the deployed Studio.
7. Build the MCP as a thin client over the proven backend.
8. Run the same canonical creation flows through both Studio and MCP and assert
   equivalent backend packages and artifacts.
9. Add authentication and authorization across the frontend, backend, storage,
   and MCP, then rerun all canonical and cross-tenant tests.

## Done means

- Randomized and real-document tests find no unsupported factual claims.
- The legitimate E2E suite is repeatable and produces reviewable evidence.
- Backend state survives reloads, retries, reconnects, and duplicate requests.
- Studio and MCP produce equivalent results from the same sources and answers.
- Studio uses the existing company record and stable `companyId` without a
  duplicate frontend-only company model.
- No section is marked complete while a decision or quality blocker remains.
- A general agent can create, inspect, resolve, and retrieve a booklet entirely
  through MCP tools with authenticated, tenant-safe access.
- Cross-tenant access is denied and covered by automated negative tests.
