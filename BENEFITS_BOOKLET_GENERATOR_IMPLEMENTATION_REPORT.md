# Benefits Booklet Generator and Agent — Detailed Implementation Report

Status captured: July 17, 2026, America/Los_Angeles  
Cloud timestamps in this report may appear as July 18, 2026 UTC.  
Repository: ansa-ai  
Branch at the beginning of this report: main

## Purpose of this report

This is the canonical, detailed record of the benefits booklet generator and agent work completed in the current working session.

It documents:

- The product and workflow requirements reviewed before implementation.
- The backend-first agent architecture that was added.
- The existing frontend generation path and how it differs from the new agent path.
- Document intake, classification, extraction, normalization, conflict handling, questions, content generation, rendering, persistence, and quality checking.
- Medical, dental, vision, HSA, HRA, FSA, Life/AD&D, disability, EAP, telemedicine, voluntary, contact, and legal-section behavior.
- The exact deterministic and paid/live test inventory.
- Real source fixtures and generated PDF artifacts.
- The latest live Cloud Run generation run and its verified output.
- Cloud Run and Vercel work completed before deployment was explicitly paused.
- Defects found during live testing and the fixes applied.
- Known limitations, security risks, architectural gaps, and unfinished product wiring.

This report supersedes the status claims in DONE_REPORT.md and LIVE_BACKEND_PDF_TEST_REPORT.md when those earlier point-in-time reports disagree with this file. The earlier files remain useful historical records, but they do not contain the complete current state.

## Executive summary

The repository now contains a credible working backend-first benefits booklet generation pipeline. It can accept a mixed batch of source files, classify the documents, extract structured facts, parse medical plan documents, normalize rate workbooks, calculate contributions, assemble a source-aware BenefitsPackage, identify blocking questions, resume after answers, generate a dynamic outline, request grounded employee-facing copy from OpenAI, render a real US Letter PDF with Chromium, validate the result, and persist the thread, run, events, facts, source files, and final PDF.

The latest backend proof is a completed Cloud Run generation using:

- A completed employer setup PDF.
- A real UnitedHealthcare Bronze 2026 Summary of Benefits and Coverage.
- A generated but realistic medical and dental rate/contribution workbook.
- Four coverage tiers.
- A 26-pay-period payroll basis.
- HRA and FSA configuration.
- A real OpenAI content generation call using the configured content model.
- Firestore persistence.
- Firebase Storage persistence.
- A downloaded and independently inspected final PDF.

That run produced a valid 12-page, 140,917-byte, portrait US Letter PDF. Its extracted text contains the expected employer, UnitedHealthcare medical and dental plans, HealthEquity account administration, 26 payroll deductions, the expected employee-only medical deduction of $123.45, and the correctly calculated family medical deduction of $547.98. The run remains queryable and currently reports complete with 31 persisted pipeline events.

The work should still be described as a strong working MVP, not a fully production-complete benefits platform. Important limitations remain:

- The current React company screen still calls the older assembled-company PDF endpoint, not the new mixed-file thread agent.
- The grounded content agent covers the 17 conceptual sections requested in the section matrix, but does not yet generate grounded copy for HSA or STD.
- Dental and vision costs are supported more fully than their plan-design attributes.
- Rich Life/AD&D, STD, LTD, EAP, telemedicine, voluntary, HSA, HRA, and FSA details do not all survive the normalized package-to-renderer path.
- Some deterministic ancillary tests construct the legacy renderer input directly and therefore do not prove the full extraction-to-PDF path.
- Authentication, tenant authorization, and private-by-default data access are intentionally not implemented.
- The current Cloud Run endpoint is public and accepts CORS requests from every origin, following the explicit request for a low-security development configuration.
- The Vercel frontend was not redeployed after its Cloud Run API base variable was added. No further deployment is being performed now.

## Current status at a glance

| Area | Current status | Evidence |
| --- | --- | --- |
| Mixed-file backend intake | Implemented | api/booklet-pipeline.ts and lib/booklet-thread-store.ts |
| Document classification | Implemented | Heuristics plus OpenAI fallback |
| Employer/prior-guide/email extraction | Implemented | Structured OpenAI extraction with provenance |
| Medical SBC/SPD extraction | Implemented | Four-phase OpenAI parser |
| Rate and contribution workbook parsing | Implemented | Cost-summary, wide-table, and matrix layouts |
| Normalized BenefitsPackage | Implemented | Source map, confidence, conflicts, plans, rates, accounts |
| Exception-only blocker flow | Implemented for core blockers | Employer, dates, eligibility, selected plans, matches, contributions, conflicts |
| Batched grounded content | Implemented for 17 requested IDs | Ready, blocked, and omitted states with grounding guards |
| Dynamic outline | Implemented for up to 19 IDs | Includes HSA and STD when offered |
| Real HTML/PDF rendering | Implemented | Puppeteer or Sparticuz Chromium |
| PDF preflight and structural QA | Implemented | Required sections, placeholders, dimensions, page count |
| Firestore and Storage persistence | Implemented | Threads, messages, uploads, runs, facts, events, signed PDF URL |
| Deterministic tests | Passing | 178 passed across 15 files |
| Paid/live suite | Previously completed | 74 section/extraction/pipeline assertions, with timeout detail documented below |
| Targeted GPT-5.6 content test | Passing | 17 complete-evidence section assertions |
| Latest Cloud Run live PDF | Passing | Complete run, 12 pages, 140,917 bytes, 31 events |
| Visual inspection | Completed for current live PDFs | Poppler rendering and page review |
| Cloud Run backend | Deployed before pause | Ready revision in flux-ebfb0 |
| Vercel frontend using Cloud Run | Not completed | Environment variable added, frontend not rebuilt/redeployed |
| Authentication and tenant isolation | Not implemented | Public development posture |
| Full ancillary source fidelity | Partial | Detailed gaps listed later |

## Scope language used in this report

To avoid overstating progress, this report uses the following meanings:

- Implemented means code exists and the described behavior is available in the working tree.
- Deterministically tested means a local test exercises the behavior without a paid external model call.
- Live tested means a real OpenAI call, real source document, or real deployed backend was used.
- Render tested means the HTML renderer or a real PDF generator was exercised.
- Visually inspected means PDF pages were rendered to images and reviewed for layout problems.
- Wired into the product means the current React application actually calls that backend path.
- Production-hardened means authenticated, tenant-isolated, private, observable, recoverable, and appropriate for sensitive data. The current system does not meet this definition.

## Source material reviewed

The implementation was based on and checked against the following repository material:

- implementation.md
- notion-call-transcripts/call-transcripts.md
- notion-call-transcripts/pdf-information-extraction.md
- notion-call-transcripts/flower-city-section-classification.md
- The existing backend handlers in api/
- The existing plan schema and four-stage medical parser in lib/
- The current React company and booklet workflow in src/main.jsx
- The current renderer in lib/booklet.ts
- Existing Firebase Admin, Firestore, Storage, and Vercel configuration
- Real source files in notion-call-transcripts/
- Real plan fixtures in tests/fixtures/plans/
- The new public source corpus under source-docs/

Only a small portion of call-transcripts.md is about this product. The relevant sessions reviewed were:

- Insurance Benefits Broker Workflow Discovery Call
- Benefits Booklet Generator - Working Session & Planning
- AI Benefits Platform Dev Session & Strategy Discussion
- Ben, Miles, and Akhil working session

The remainder of the large transcript file is primarily unrelated Overlap work and was not treated as product requirements.

## Product requirements extracted from the source material

The central requirement is a files-in, booklet-out workflow:

    Uploaded source files
      -> agent processes the files
      -> agent asks only necessary questions
      -> agent generates a personalized booklet

The important operating rule is that the user should not be asked to manually enter information that already exists somewhere in the uploaded materials.

The source requirements call for the system to:

1. Accept mixed files without requiring the user to classify them first.
2. Classify every input.
3. Extract employer, eligibility, plan, rate, contribution, account, contact, and prior-booklet information.
4. Store extracted facts with their source document and page, sheet, or row.
5. Prefer current and authoritative sources over old or generic template sources.
6. Detect conflicting high-confidence facts.
7. Ask narrow questions tied to concrete blockers.
8. Continue without interruption when a missing fact is nonessential.
9. Build a section outline based on benefits actually offered.
10. Generate source-grounded employee-facing copy.
11. Render medical and ancillary benefits with costs and relevant details.
12. Support percentage, flat monthly, and flat per-pay employer contributions.
13. Support different payroll schedules.
14. Render a real, print-ready PDF.
15. Check the finished booklet for missing sections, unresolved questions, invalid values, placeholders, and PDF defects.
16. Preserve the backend thread as the foundation for a later UI or email workflow.

The call transcripts add concrete broker workflow requirements:

- Booklets are manually personalized today.
- The broker decides which employee deductions and employer contributions should be displayed.
- Employers may contribute percentages or flat dollars.
- Weekly, biweekly, semimonthly, and monthly deduction schedules all occur.
- Multiple medical options must be rendered when the employer offers more than one.
- Medical, dental, and vision should appear only when their plan and cost information are provided.
- Eligibility must be personalized from employer material.
- HSA, HRA, and FSA need employer/account configuration rather than generic assumptions.
- Prior booklets can provide layout and section-order context, but must not leak old employer facts into a new booklet.

## What the Flower City 17-section baseline means

The Flower City guide has 19 physical PDF pages, but medical spans multiple pages. It therefore represents 17 conceptual section IDs:

1. Cover
2. Table of contents
3. Welcome
4. Open enrollment
5. Eligibility
6. Medical
7. Telemedicine
8. HRA
9. FSA
10. Dental
11. Vision
12. Basic Life and AD&D
13. Long-term disability
14. Employee assistance program
15. Voluntary benefits
16. Contacts
17. Legal notices

This exact 17-ID baseline is what the grounded content-agent test matrix covers with insufficient, partial, complete, and multiple-value scenarios.

The broader generator supports two additional conditional sections:

- HSA
- Short-term disability

Therefore, the maximum outline/rendering universe currently contains 19 conceptual section IDs. The distinction matters because the outline and deterministic renderer support all 19, while the grounded content agent currently contains only the 17-ID baseline.

## Major implementation outcomes

The work completed can be grouped into eleven major outcomes:

1. A backend thread and message model for benefits generation.
2. Universal mixed-file upload and storage.
3. A classification layer with deterministic signals and model fallback.
4. Structured employer, guide, booklet, email, rate, and medical-plan extraction.
5. A normalized, source-aware BenefitsPackage.
6. Contribution arithmetic and plan/rate matching.
7. Core exception-only blocker questions and batch answer/resume.
8. A conditional booklet outline plus a grounded content agent.
9. A real HTML-to-PDF renderer and quality gate.
10. A repeatable deployed-backend smoke workflow using real source information.
11. Cloud Run packaging and infrastructure suited to long-running document work.

The following sections describe each outcome in detail.

## Two generation paths now exist

The repository currently contains two distinct generation paths. They share renderer code, but they solve different workflow problems.

### Path A: existing assembled-company generator

The current React company screen calls POST /api/generate-booklet with a company object that has already been assembled in the browser and Firestore.

This path:

- Reads company plan/setup data already stored in the product.
- Produces preview-page events.
- Renders a PDF.
- Returns the PDF as base64 in the final NDJSON event.
- Lets the browser upload the finished PDF to Firebase Storage.
- Writes lastGeneratedBooklet back onto the company record.

Primary files:

- src/main.jsx
- api/generate-booklet.ts
- lib/booklet.ts
- lib/benefits-booklet-generator.ts

This is still the path used by the main React company screen.

### Path B: backend-first mixed-file agent

The new agent path starts with source documents rather than a preassembled company object.

It:

- Creates a persistent thread.
- Accepts inline file uploads or existing uploaded-file IDs.
- Records a user message and attachments.
- Creates a generation run.
- Loads the source files from Storage.
- Classifies and extracts them.
- Builds the normalized package.
- Pauses for specific blockers when required.
- Accepts one answer or a batch of answers.
- Reruns and completes the generation.
- Saves the final PDF through the backend.
- Returns a signed result URL.

Primary files:

- api/booklet-pipeline.ts
- lib/booklet-pipeline.ts
- lib/booklet-thread-store.ts
- lib/booklet-types.ts
- The classifier, extractors, assembler, question engine, content agent, renderer, and quality checker described below.

This backend path is implemented and live-tested, but there is not yet a React client for its thread, blocker, status, confidence, and source-map workflow.

## End-to-end backend architecture

The implemented backend flow is:

    Client or test
      -> create booklet thread
      -> upload or attach source files
      -> add user message
      -> start generation run
      -> load files from Storage
      -> classify documents
      -> extract employer and prior-guide facts
      -> parse rates and contributions
      -> parse medical plan documents
      -> write ExtractedFact records
      -> assemble BenefitsPackage
      -> match plans and rates
      -> detect conflicts
      -> create blocker questions if needed
      -> accept answers and resume
      -> build conditional outline
      -> generate grounded section copy
      -> render HTML
      -> preflight HTML and package
      -> render PDF with Chromium
      -> validate final PDF
      -> save PDF and signed URL
      -> mark run and thread complete

The normalized BenefitsPackage is the main boundary between document-specific extraction and booklet generation. This separates knowledge of PDFs, emails, spreadsheets, and source authority from the renderer.

## Backend API surface

### POST /api/booklet-pipeline with action create_thread

Purpose:

- Create a persistent booklet thread for a company.
- Optionally upload a batch of files immediately.
- Optionally attach existing file IDs.
- Optionally record the initial user message.

Important behavior:

- companyId is syntax-validated.
- New files must contain fileName, mimeType, and base64.
- Each decoded file is limited to 50 MiB by the API handler.
- The accepted MIME types are PDF, modern and legacy Excel, CSV, EML, and text.
- Every stored upload receives a UUID, SHA-256 hash, Storage path, MIME type, uploaded timestamp, and processing status.
- The response is HTTP 201 with the thread and newly stored files.

### POST /api/booklet-pipeline with action add_message

Purpose:

- Add a user message to an existing thread.
- Upload additional files.
- Attach existing uploaded file IDs.

Important behavior:

- The thread must exist.
- The message records its attachment file IDs.
- New file IDs are appended to the thread with Firestore array union semantics.
- The thread update timestamp is refreshed.

### POST /api/booklet-pipeline with action start

Purpose:

- Create and execute a generation run.

Important behavior:

- The thread must exist.
- At least one file must be attached.
- The run begins with queued status.
- The endpoint executes the current pipeline synchronously.
- It returns HTTP 202 when blocked and HTTP 200 when complete.
- A failed pipeline records the failure in the run and an error message in the thread before returning an error response.

### POST /api/booklet-pipeline with action answer

Purpose:

- Resolve one or more current blocker questions and resume the same run.

Supported input forms:

- One answer identified by questionId or fieldPath.
- A batch answers object keyed by blocking field path.

Batch behavior was added after live testing showed that one-answer-per-rerun was wasteful. Only paths matching the run's current blocker questions are accepted. Accepted answers are written to the thread as user answer messages, merged into run.answers, and the full run resumes once.

The current implementation reruns classification and extraction rather than resuming from a cached intermediate checkpoint. This preserves correctness but can repeat model cost and latency.

### GET or POST /api/booklet-pipeline with action status

Purpose:

- Read the generation run.
- Read the persisted event history in order.

The response includes the run snapshot and the event subcollection. The event subcollection is currently more reliable than run.stages because the final in-memory run object can overwrite its embedded stages array.

### POST /api/generate-booklet

This is the older assembled-company generator used by the current product UI.

It streams newline-delimited JSON events:

- start
- one page event for each preview page
- rendering
- complete with filename and base64 PDF
- error when generation fails after streaming begins

The route now uses the shared booklet renderer rather than the old customer-specific Big Tows script. Dental rates are required only when a dental plan has actually been uploaded.

Known implementation detail:

- It intentionally delays each preview event by 650 milliseconds to make progress visible.
- The frontend currently supplies 52 pay periods on this path.
- The live backend-first path obtains the payroll basis from the normalized contribution evidence.

### POST /api/parse-plan

This existing endpoint:

- Reads a company plan record.
- Downloads its PDF from Firebase Storage.
- Runs the four-phase medical plan extractor.
- Writes progress and structured attribute patches.
- Stores page-level transcript text separately.

It remains the current frontend's plan-parsing endpoint and is also reused conceptually by the universal pipeline.

### POST /api/company-profile

This existing endpoint:

- Fetches a public company website.
- Reduces the HTML to usable text.
- Uses OpenAI to produce company profile metadata.

It is not part of the core benefits document agent, but remains part of the frontend company-creation workflow.

## Core type system added

lib/booklet-types.ts defines the shared backend contract.

### UploadedFile

Tracks:

- ID
- Company ID
- File name
- Storage path
- MIME type
- Upload time
- SHA-256
- Processing status

LoadedUploadedFile adds the in-memory Buffer and optional pre-extracted text.

### ClassifiedDocument

Tracks:

- File ID
- Document type
- Confidence
- Detected employer
- Detected carrier
- Detected plan year
- Reasoning summary

The supported document types are:

- employer_application
- carrier_rate_sheet
- plan_summary
- sbc
- spd
- benefit_guide
- prior_booklet
- census
- renewal_spreadsheet
- email_export
- unknown

### SourceRef

SourceRef provides provenance:

- File ID and file name
- Document type
- Page
- Sheet
- Row
- Text range or quote
- Extraction method

Supported extraction-method labels are:

- pdf_text
- ocr
- spreadsheet
- model
- manual

### ExtractedFact

Each fact contains:

- Stable fact ID
- Company and source file
- Document type
- Normalized field path
- Original and normalized values
- Confidence
- SourceRef
- Extraction method
- Creation time

### CarrierRatePlan and RateTier

These types normalize:

- Benefit type
- Carrier
- State and market hints
- Quarter and effective date
- Plan name and product type
- Metal tier, network, and rate area
- Employer-specific versus carrier-catalog origin
- Source sheet and row
- Four common coverage tiers
- Monthly premium
- Employer monthly amount
- Employee monthly amount
- Enrollment count

### ContributionRule

ContributionRule supports:

- Percent employer contribution
- Flat monthly employer contribution
- Flat per-pay employer contribution
- Benefit and plan association
- Coverage tier
- Optional employee class
- Pay-period count
- Source references
- Confidence

### BenefitPlan and CompanyOffering

BenefitPlan connects a selected plan to:

- Benefit type
- Name and carrier
- Plan year
- Matched rate plan ID
- Medical attributes when available
- Source references
- Confidence

CompanyOffering tracks whether a benefit is offered, its selected plans, eligibility, contribution rules, contacts, sources, and confidence.

### BenefitsPackage

BenefitsPackage contains:

- Employer identity
- Plan-year start, end, and label
- Eligibility waiting period, description, and employee classes
- Offered benefits
- Selected plans
- All normalized rates
- All normalized contribution rules
- Contacts
- HSA, HRA, and FSA account records
- Prior/master booklet style context and section order
- Field-level source map
- Confidence report

The confidence report includes:

- Overall confidence
- Field-specific confidence
- Sources
- Warnings
- Assumptions
- Conflicts
- Manual answers

### BookletGenerationRun

A run records:

- Run, thread, and company IDs
- Queued, processing, blocked, complete, or failed status
- Uploaded file IDs
- Stage events
- Current blocker questions
- Answers
- BenefitsPackage snapshot
- Outline
- PDF Storage path and URL
- Confidence report
- Created/completed timestamps
- Error message

## Firestore persistence model

The backend Admin SDK writes:

| Collection or path | Purpose |
| --- | --- |
| bookletThreads/{threadId} | Thread identity, company, status, attached files, latest run |
| bookletMessages/{messageId} | User and agent messages, questions, answers, results, errors |
| bookletUploadedFiles/{fileId} | Upload metadata and Storage location |
| bookletGenerationRuns/{runId} | Current run state and package snapshot |
| bookletGenerationRuns/{runId}/events/{eventId} | Ordered progress-event history |
| bookletExtractedFacts/{runId}_{factId} | Source-backed normalized facts |
| benefitsCompanies/{companyId}/plans/{planId} | Existing frontend plan document and parser state |
| benefitsCompanies/{companyId}/plans/{planId}/textPages/{page} | Medical transcript text |

Extracted facts are written in Firestore batches of up to 400 records.

Firestore rejects undefined values at any nesting depth. A shared toFirestoreDocument helper now passes records through JSON serialization at the persistence boundary. This was added after real blocker and event records failed because optional nested properties were present with undefined values.

## Firebase Storage paths

The implemented Storage layout is:

| Path | Purpose |
| --- | --- |
| benefitsCompanies/{companyId}/plans/{planId}/{fileName} | Existing frontend plan uploads |
| benefitsCompanies/{companyId}/booklet-inputs/{fileId}/{fileName} | Backend pipeline source files |
| benefitsCompanies/{companyId}/booklets/{fileName} | Generated PDFs |

Generated backend PDFs receive a signed read URL. The current expiry is January 1, 2035, which is convenient for development but far too long for a sensitive production workflow.

## Pipeline stages and implementation detail

The shared pipeline defines 14 named stages:

1. Uploading files
2. Classifying documents
3. Extracting employer setup
4. Reading carrier rate sheets
5. Parsing plan documents
6. Reading prior booklets/guides
7. Matching rates to plans
8. Detecting offered benefits
9. Resolving conflicts
10. Building booklet outline
11. Writing booklet content
12. Rendering PDF
13. Running quality checks
14. Complete

Quality checks appear before and after rendering, so a completed run normally has more than 14 individual persisted events.

### Event behavior

Every event contains:

- Stable run-scoped event ID
- Run ID
- Stage name
- started, progress, complete, or warning status
- Message
- Timestamp
- Optional details

The event creation code now omits details entirely when no details exist. The persistence layer also strips nested undefined values.

### Stage 1: files ready

The pipeline requires at least one file. It records the file IDs, names, and SHA-256 hashes in the first event.

### Stage 2: classification

Files are classified in parallel. The completion event records file ID, document type, and confidence for every input.

### Stage 3: employer setup

Employer applications and email exports use the structured booklet-document extractor.

### Stage 4: rate sheets

Carrier rate sheets and renewal spreadsheets use deterministic workbook parsing. Extraction warnings do not immediately fail the pipeline.

### Stage 5: plan documents

SBC, SPD, and plan-summary documents use the medical plan extraction path. The universal pipeline uses an in-memory plan store for incremental patches and transcript pages, retaining the final extracted attributes but not persisting those intermediate pages through this path.

### Stage 6: prior guides and booklets

Benefit guides and prior booklets use the structured booklet-document extractor. Template role is used to distinguish current facts, prior-employer context, and master layout context.

### Fact assembly

The pipeline converts:

- Employer/guide/email extraction results
- Rate workbook results
- Medical plan attributes
- Manual answers

into ExtractedFact records with provenance.

### Stages 7 through 9: normalization and blockers

The assembler builds BenefitsPackage, matches selected plans to rates, detects offered benefits, applies source priority, records warnings and conflicts, and then invokes the question engine.

If any blocker questions remain, the pipeline returns a blocked result before outline, copy, or PDF rendering.

### Stages 10 and 11: outline and copy

The outline is built from the package and prior order evidence. The content agent is invoked when an OpenAI key is available.

Content generation failure is nonfatal. The pipeline records a warning and continues with deterministic source-backed renderer content. This prevents an optional prose failure from losing an otherwise valid booklet.

### Preflight

The pipeline renders HTML before starting Chromium. It then checks required sections, source presence, placeholders, employer and plan names, and page identifiers.

Blocking preflight issues throw an error and prevent the PDF from being stored.

### Stages 12 through 14: PDF and final QA

The renderer generates a Buffer. The quality checker parses it with pdf-lib, verifies page count and US Letter dimensions, and returns a final report. A valid run emits Complete with confidence and page count.

The API then:

- Saves extracted facts.
- Saves the generated PDF.
- Writes the PDF Storage path and signed URL.
- Marks the run complete.
- Writes a result message to the thread.

## Document classification

The classifier uses deterministic signals first.

It recognizes:

- Employer or group application language.
- Workbook extensions and MIME types.
- Renewal and year-over-year workbook markers.
- Carrier rate headers.
- Census headers.
- SBC wording.
- SPD wording.
- Plan-summary wording.
- Prior booklet or guide names.
- Benefit-guide language.
- EML or email-export markers.

It also extracts simple employer, carrier, and year hints.

If heuristic confidence is below 0.8 and an API key is available, it sends the file or text to a structured OpenAI classification call. The model fallback defaults to gpt-5.4-mini through OPENAI_BOOKLET_MODEL.

Unknown and census files are classified and persisted in the flow, but no specialized downstream extraction is currently performed for them.

## General booklet-document extraction

The structured document extractor covers:

- Employer name, legal name, address, and website
- Plan-year start, end, and label
- Eligibility waiting period, description, and classes
- Offered benefit lines
- Selected medical, dental, vision, life, STD, and LTD plans
- Contribution rules
- Contacts
- HSA, HRA, and FSA accounts and administrator
- Prior section order
- Template role
- Extraction method
- Warnings

Each important evidence value includes:

- Value
- Page
- Supporting quote
- Confidence

The extraction prompt explicitly instructs the model:

- Not to treat blank application labels as filled facts.
- Not to infer unchecked offerings.
- To separate master-template content from employer facts.
- To return source pages and concise quotes.
- To mark image-only work as OCR.
- To expose uncertainty in warnings.

Text and email inputs are wrapped with explicit BEGIN SOURCE DOCUMENT and END SOURCE DOCUMENT labels. This fixed a live extraction problem where email instructions could otherwise be treated like unsourced conversational context.

## Medical plan extraction

The existing medical extractor was retained and integrated.

It performs four sequential structured OpenAI phases:

1. Full page transcript.
2. Identity, financial, network, and contact extraction.
3. Services and prescription extraction.
4. Exclusions, legal material, language access, examples, and notices.

It supports:

- Incremental parsing state and percentage.
- Page-level text storage.
- Carrier, plan name, plan ID, coverage dates, product type, and HSA eligibility.
- Deductibles and out-of-pocket limits.
- Network and service details.
- Prescription coverage.
- Exclusions.
- Legal notices.
- Coverage examples.
- Footer plan-ID recovery from transcript text.
- An 850 KB safeguard for structured attributes before plan-document persistence.

The model defaults to gpt-5.4-mini through OPENAI_PLAN_MODEL.

The medical schema is the richest benefit schema in the repository. Equivalent source-backed structured schemas do not yet exist for dental, vision, Life/AD&D, STD, LTD, EAP, telemedicine, or each voluntary product.

## Workbook and rate extraction

The deterministic rate extractor supports three workbook families.

### Employer cost-summary layout

Expected concepts include:

- Plan
- Tier
- Monthly premium
- Employer or ER cost
- Optional employee or EE cost
- Optional ER percentage
- Optional enrollment

The parser groups continuation rows under the current plan, normalizes tiers, and creates both rate plans and contribution rules.

If a supplied percentage reproduces the employer-dollar amount within two cents, the contribution is stored as percent. Otherwise, the actual employer dollar amount is treated as authoritative flat monthly support.

This specifically handles spreadsheets where a displayed percentage is rounded or inconsistent with the saved employer cost.

### Wide carrier table

The parser recognizes rows with plan name plus single, subscriber-and-spouse, subscriber-and-children, and family rates.

It also reads common plan detail columns when present, including:

- Primary care
- Specialist
- Deductible
- Coinsurance
- Hospital benefits
- Emergency room
- Prescription coverage
- Out-of-pocket maximum

### Matrix carrier table

The parser recognizes plan names across columns and tier labels down rows. It supports plan type, effective date, HSA-eligible hints, four tiers, and multiple plans in one sheet.

### Shared normalization

Tier normalization maps common labels to:

- employee
- employee_spouse
- employee_children
- family

The benefit classifier identifies dental, vision, Life/AD&D, STD, and LTD by plan/sheet text and otherwise defaults to medical.

Carrier hints currently recognize Excellus, Healthy NY, UnitedHealthcare/UHC, Cigna, Aetna, MVP, and Oxford.

Unsupported layouts return a warning rather than inventing rows.

## Contribution calculation

lib/contribution-engine.ts calculates:

- Monthly premium
- Monthly employer amount
- Monthly employee amount
- Per-pay premium
- Per-pay employer amount
- Per-pay employee amount
- Annual premium
- Annual employer amount
- Annual employee amount

It supports:

- Percentage contribution
- Flat monthly contribution
- Flat per-pay contribution
- 52, 26, 24, and 12 deduction schedules in deterministic coverage
- Premium caps so employer contribution cannot exceed premium
- Negative-value rejection
- Exact tier matching
- Plan and benefit fallback matching

The family medical value in the latest live PDF demonstrates the formula:

    $1,187.29 monthly employee cost x 12 months / 26 deductions = $547.98

The source workbook contained a hand-entered $548.00 approximation. The generator's formula-derived $547.98 is the correct rounded value.

## BenefitsPackage assembly

lib/benefits-package-assembler.ts merges every extraction family into one normalized package.

### Source authority

The current document priority is:

1. Employer application
2. Carrier rate sheet or renewal spreadsheet
3. SBC
4. SPD
5. Plan summary
6. Benefit guide
7. Prior booklet
8. Email export
9. Census
10. Unknown

Manual answers override extracted values and receive confidence 1.0.

This is a useful first field-authority model, but it is not yet sensitive to document recency within every type. In particular, an explicit new email instruction can rank below an older prior booklet unless a blocker or manual answer resolves the difference.

### Employer and plan-year selection

The assembler:

- Collects employer name, legal name, address, and website candidates.
- Collects plan-year start, end, and label candidates.
- Collects eligibility waiting period and description candidates.
- Excludes master-template employer facts.
- Sorts candidates by source authority and confidence.
- Normalizes natural-language dates to YYYY-MM-DD.
- Rejects unparseable dates rather than allowing Invalid Date into the PDF.
- Can derive a calendar year from a matched rate row when no direct date exists.

### Plan selection and deduplication

Selected plan evidence can come from:

- Employer documents
- Prior/current guide context
- Manual answers
- Medical plan identity when no explicit medical selection exists
- Newest employer-specific rate rows when nothing else selects a plan

An important live defect was fixed here. When employer instructions selected a short plan name and the SBC used a longer carrier marketing identity, the assembler originally created two medical plans. It now treats an explicit employer plan selection as authoritative and attaches the differently named SBC attributes to that selection when similarity, carrier, year, or the single-plan context supports the match.

Selection IDs are stable SHA-1-derived values scoped to company, benefit type, and plan name.

### Plan-to-rate matching

Matching currently uses normalized token similarity:

- Candidate rate rows are limited to the same benefit type.
- The best similarity score is selected.
- A score of at least 0.45 is required.
- Carrier and year evidence also help attach extracted medical attributes.
- A user can answer a blocker with a specific rate plan ID.

This is intentionally explainable but remains less reliable than matching carrier contract IDs, plan IDs, group numbers, or explicit workbook keys.

### Contribution merging

Contribution rules come from:

- General document extraction
- Deterministic rate workbook extraction
- Manual answers

Percent values over 1 are normalized from whole percentages to decimals. Tiers are normalized. Rules not plausibly associated with a selected plan are filtered.

### Benefit offering detection

The package considers:

- Selected plans
- Positive offering evidence
- HSA eligibility on selected medical attributes

It can detect:

- Medical
- Dental
- Vision
- Life
- STD
- LTD
- EAP
- Voluntary
- Telemedicine
- HSA
- HRA
- FSA

One important limitation is that HSA eligibility of a medical plan currently implies an HSA offering. A plan being HSA-qualified does not prove the employer actually sponsors or administers an HSA, so this should eventually become an evidence-aware distinction.

### Contact and account assembly

Contacts preserve role, person, organization, phone, email, website, and source.

Accounts currently preserve:

- HSA, HRA, or FSA type
- Administrator
- Source references

They do not yet have rich typed fields for employer contributions, limits, carryover, grace periods, runout, HRA tier funding, or HSA/FSA compatibility.

### Style and prior booklet context

A master template or employer prior-context guide can supply:

- Template name
- Section order
- Style source references

It cannot supply current employer identity because master-template factual candidates are filtered out.

### Confidence and source map

The assembler records confidence for:

- Employer name
- Plan-year start
- Plan-year end
- Eligibility waiting period
- Plans
- Contributions

Overall confidence is the average of those current fields.

The source map currently has strongest direct coverage for:

- employer.name
- employer.legalName
- employer.address
- employer.website
- planYear.start
- planYear.end
- eligibility.waitingPeriod
- Every manual answer path

Plan, rate, offering, contribution, contact, and account records also carry their own SourceRefs. A future package should expand the central field source map to every rendered material fact.

## Conflict detection

The assembler detects multiple strong values for:

- Employer name
- Plan-year start
- Plan-year end
- Eligibility waiting period

Only candidates with confidence at least 0.75 participate.

When conflicting sources differ substantially in source authority, the higher-authority value is used and the conflict receives a resolution explanation.

When the priority gap is less than 20, the conflict remains blocking. A manual answer changes it to nonblocking and records that the thread resolved the conflict.

The current conflict layer does not yet compare:

- Plan attributes
- Premiums
- Contribution rules
- Account elections and funding
- Carrier and vendor contacts
- Benefit-offered flags
- Legal notices

## Exception-only question engine

lib/question-engine.ts creates stable question IDs from field paths.

Implemented blockers are:

- Missing employer name
- Missing or invalid plan-year start
- Missing or invalid plan-year end
- Missing eligibility waiting period
- No selected plans
- Selected plan without a confident rate match
- Rate tier without a contribution rule
- Unresolved high-confidence conflicts

Questions include:

- Field path
- Narrow employee/broker-facing prompt
- Reason the value blocks generation
- Related source references
- Optional choices
- Optional recommended answer
- Blocking flag

Examples include:

- Asking which waiting period should be used when sources disagree.
- Asking which uploaded rate row matches a selected plan.
- Asking which contribution mode/value applies to a specific plan and tier.

The question engine intentionally does not ask for an entire section to be manually rewritten.

Current limitations:

- Every generated question is blocking; warning-only clarification is not implemented.
- Ancillary-only packages can be incorrectly blocked by the general no-selected-plans rule.
- It does not yet ask for missing rich Life, STD, LTD, account, voluntary, EAP, or telemedicine details.
- It does not detect HSA/FSA compatibility questions.
- It does not convert a content-agent blocked status into a thread question.

## Batch answer and resume

The answer endpoint originally accepted one blocker answer and then reran the full extraction pipeline.

Live testing exposed the cost and latency problem when a run had several blockers. The route now accepts:

    answers:
      employer.name: Example Company
      planYear.start: 2026-01-01
      planYear.end: 2026-12-31
      eligibility.waitingPeriod: First of the month after 30 days

Only paths that match current blocker questions are accepted. All accepted answers are:

- Added to the thread as answer messages.
- Merged into the run.
- Converted into manual ExtractedFacts.
- Assigned manual SourceRefs.
- Applied in the assembler.
- Used in one resumed pipeline execution.

## Booklet outline generation

lib/booklet-outline.ts maintains this maximum order:

1. Cover
2. Table of contents
3. Welcome
4. Eligibility
5. How to enroll
6. Medical
7. Dental
8. Vision
9. Life and AD&D
10. Short-term disability
11. Long-term disability
12. Health savings account
13. Health reimbursement account
14. Flexible spending account
15. Telemedicine
16. Employee assistance program
17. Voluntary benefits
18. Contacts
19. Legal notices

Core sections are retained. Benefit sections are included only when the package says the benefit is offered.

Prior section order is normalized and prepended ahead of the remaining base order without creating duplicates.

Each section carries source references:

- Benefit sections use the offering sources.
- Eligibility uses eligibility evidence.
- Cover uses employer and plan-year evidence.
- Other structural sections currently fall back to style-source evidence.

## Grounded booklet content agent

lib/booklet-content-agent.ts makes one batched structured OpenAI Responses API request.

### Model configuration

The default content model was changed from gpt-5.4-mini to gpt-5.6.

Selection order is:

1. Explicit model passed by a caller
2. OPENAI_BOOKLET_CONTENT_MODEL
3. gpt-5.6

The request uses low reasoning effort and a Zod structured output format.

Extraction and classification continue to default to gpt-5.4-mini because they are high-volume structured parsing tasks.

### Actual key and model verification

The valid OpenAI credential was located in the Flux project environment and verified without printing its value.

It was used to:

- Replace the invalid production Vercel OpenAI credential.
- Configure the Cloud Run Secret Manager secret.
- Make a direct successful gpt-5.6 verification call.
- Run the targeted live section scenario.
- Run the live backend generation.

The direct model check returned the service model identifier gpt-5.6-sol and the expected MODEL_OK output.

No API key value is stored in this report, committed files, command output, or generated PDFs.

### Content status model

Every content result has:

- Variant
- Model
- One result per supported section

Every section result has:

- Section ID
- Title
- ready, blocked, or omitted status
- Missing field paths
- Source paths
- Generated copy

The states mean:

- ready: the section is included and has enough facts for copy.
- blocked: the section is included but required section facts are missing.
- omitted: the outline does not include the section.

Blocked and omitted sections must return empty copy and empty model-supplied source paths. The deterministic status layer attaches available known paths to blocked results for diagnosis.

### Current 17 section IDs

The content agent currently covers:

- Cover
- Table of contents
- Welcome
- Enrollment
- Eligibility
- Medical
- Telemedicine
- HRA
- FSA
- Dental
- Vision
- Life and AD&D
- LTD
- EAP
- Voluntary
- Contacts
- Legal

It does not yet include HSA or STD. Those sections can be outlined and rendered deterministically, but do not receive source-grounded generated copy.

### Closed fact sets

The prompt tells the model to use only supplied facts and prohibits:

- Invention
- Estimation
- Outside facts
- Unsupported coverage claims
- Unsupported legal claims
- Unsupported deadlines
- Unsupported costs
- Unsupported eligibility rules
- Unsupported carrier capabilities
- Unsupported contact instructions

The requested content variant changes tone only. It cannot change facts or section selection.

### Section readiness rules

Current readiness examples:

- Cover needs employer name and some plan-year evidence.
- TOC needs outline sections.
- Welcome needs employer name.
- Enrollment needs an enrollment or HR contact.
- Eligibility needs a waiting period or description.
- Medical, dental, and vision need a matching plan.
- HRA and FSA need an account or offering.
- Telemedicine, Life, LTD, EAP, and voluntary need an offering or plan.
- Contacts need at least one material contact value.
- Legal needs extracted legal or notice content from plan attributes.

### Grounding validation

Post-processing rejects:

- A missing section response.
- Duplicate section IDs.
- Copy for blocked or omitted sections.
- Empty copy for ready sections.
- Ready copy without citations.
- Source paths outside the available fact paths.
- Email addresses absent from the closed fact corpus.
- URLs absent from the closed fact corpus.
- Numeric values absent from the closed fact corpus.

The numeric parser supports:

- Integers
- Decimals
- Negative values
- Comma-formatted amounts such as $1,500.25
- Percent values expressed as decimal source values

A live defect was fixed because the prior regular expression treated $1,187.29 as the number 1,187 and rejected otherwise grounded GPT-5.6 copy.

Current grounding limitations:

- Numeric, URL, email, and path validation cannot prove that every free-form textual claim is supported.
- Validation currently compares against the combined batch fact set, so a fact supplied for another section can satisfy literal validation.
- A blocked content section does not automatically block deterministic PDF rendering.

## Package-to-renderer adapter

lib/booklet-package-adapter.ts converts the normalized package into the legacy Company shape expected by lib/booklet.ts.

It currently maps:

- Employer name and website
- Plan-year dates
- Eligibility waiting period
- HR/enrollment contact
- Medical, dental, and vision plans with matched rates
- Carrier labels
- Cost and contribution tables
- Account presence and one administrator
- Offered flags for telemedicine, EAP, voluntary, Life, STD, and LTD
- Booklet outline

### Pay-period selection fix

packagePayPeriods originally allowed a general extracted default of 52 to win over an active spreadsheet rule of 26.

It now:

1. Locates active selected plans.
2. Prefers contribution rules associated with those active rate plan IDs.
3. Prefers spreadsheet-sourced evidence.
4. Uses the selected rule's pay-period count.

A deterministic regression test confirms that an active 26-period spreadsheet rule beats:

- A 52-period model-derived default.
- A 24-period rule for an unrelated plan.

### Lossy mappings still present

The adapter currently loses important detail:

- Selected plans without matched rate rows do not reach plan tables.
- Life, STD, and LTD usually become offered flags instead of rich policy fields.
- HRA contribution tiers are not mapped.
- One administrator can be reused across account types.
- Dental and vision plan-design fields are not rich structured types.
- Carrier mappings are less precise for combined life/disability structures.

This adapter is the main boundary where richer normalized ancillary data should eventually be preserved.

## Deterministic booklet renderer

lib/booklet.ts contains the actual page-building system.

The older customer-specific generator call was replaced with the shared renderer in:

- api/generate-booklet.ts
- vite.config.mjs
- lib/benefits-booklet-generator.ts

The renderer:

- Creates individual preview-page HTML.
- Wraps pages in print CSS.
- Uses portrait US Letter page dimensions.
- Renders with Puppeteer Core.
- Uses local Chromium when available.
- Uses Sparticuz Chromium in the deployed environment.
- Returns a real PDF Buffer.

### Rendering behavior by section

| Section | Current renderer behavior |
| --- | --- |
| Cover | Employer name and plan year |
| TOC | Built dynamically from rendered pages |
| Welcome | Employer-facing introductory page |
| Open enrollment | Enrollment dates/contact when present plus deterministic guidance |
| Eligibility | Waiting period plus deterministic eligibility/dependent language |
| Medical | Multiple plan pages, structured attributes, costs, and contributions |
| Dental | Plan/carrier and cost table; detailed dental design remains limited |
| Vision | Plan/carrier and cost table; detailed vision design remains limited |
| Telemedicine | Conditional deterministic page |
| HSA | Conditional generic account page |
| HRA | Conditional page; can render contribution rows if supplied in legacy shape |
| FSA | Conditional generic account page |
| Life/AD&D | Can render rich legacy coverage details, but package adapter usually supplies only offered |
| STD | Can render rich legacy details, but normalized path is limited |
| LTD | Can render rich legacy details, but normalized path is limited |
| EAP | Conditional services/access page |
| Voluntary | Conditional benefit and contact page |
| Contacts | Employer, enrollment, carrier, vendor, and broker-style contact cells |
| Legal | Deterministic legal/disclaimer page |

### Dynamic LLM copy injection

Only content sections with ready status and nonempty copy are injected.

Blocked and omitted model copy is excluded, preventing missing-evidence LLM output from appearing in the booklet.

The deterministic renderer still includes generic boilerplate in several sections. That content is not equivalent to full per-employer source grounding and remains a known product gap.

## Quality checker

lib/booklet-quality-checker.ts performs pre-render and post-render checks.

### Pre-render checks

It verifies:

- Plan-year dates parse correctly.
- Cover exists.
- TOC exists.
- Welcome exists.
- Eligibility exists.
- Enrollment exists.
- Contacts exist.
- Legal exists.
- Every offered benefit has an outline section.
- No blocker questions remain when questions are supplied.
- Employer name has a source or manual answer.
- Plan-year start has a source or manual answer.
- Plan-year end has a source or manual answer.
- HTML has no blocked placeholder pattern.
- Employer name appears in HTML.
- Every selected plan name appears in HTML.
- Every outline section produced a data-page-id.

The placeholder scan blocks:

- placeholder
- example.com
- pending confirmation
- to be confirmed
- not set
- invalid date
- lorem ipsum

### Post-render checks

It:

- Loads the PDF with pdf-lib.
- Requires between 6 and 80 pages.
- Requires every page to be approximately 612 by 792 points.
- Reports an invalid PDF as blocking.

### Quality gaps

The checker does not yet automatically verify:

- PDF text contains each expected value.
- Contribution arithmetic.
- Visual clipping or overlap.
- Empty tables and sections.
- Font fallback.
- Blank pages.
- Rich ancillary field completeness.
- HSA/FSA compatibility.
- Current legal-notice precedence.
- Every rendered factual statement has a source.
- Cross-employer or stale template text.
- OCR confidence and page-image agreement.

The production smoke script adds independent PDF-text assertions that are stronger than the shared quality checker.

## Section-level production fidelity

The following table distinguishes page presence from full source fidelity.

| Section | Presence/rendering | Grounded LLM copy | Source-detail fidelity |
| --- | --- | --- | --- |
| Cover | Strong | Yes | Strong for employer/year |
| TOC | Strong | Yes | Structural |
| Welcome | Strong | Yes | Partial because renderer has generic language |
| Open enrollment | Strong | Yes | Partial; normalized model lacks full enrollment method detail |
| Eligibility | Strong | Yes | Partial; generic dependent/QLE language remains |
| Medical | Strong | Yes | Strongest benefit path |
| Telemedicine | Present when offered | Yes | Partial; vendor/access detail often lost |
| HSA | Present when inferred/offered | No | Partial and inference is too aggressive |
| HRA | Present when offered | Yes | Partial; funding tiers do not traverse adapter |
| FSA | Present when offered | Yes | Partial; limits/types/rules not modeled |
| Dental | Cost page supported | Yes | Partial; plan-design attributes not structured |
| Vision | Cost page supported | Yes | Partial; plan-design attributes not structured |
| Life/AD&D | Present when offered | Yes | Partial; rich attributes lost in adapter |
| STD | Present when offered | No | Partial; rich attributes lost |
| LTD | Present when offered | Yes | Partial; rich attributes lost |
| EAP | Present when offered | Yes | Partial; services/access detail limited |
| Voluntary | Present when offered | Yes | Partial; products collapsed into one type |
| Contacts | Present | Yes | Partial; arbitrary contact association can be lost |
| Legal | Present | Yes when extracted | Partial; deterministic legal boilerplate still used |

## Frontend and existing product workflow changes

Although implementation.md prioritized the backend, the existing product workflow also received compatibility and usability work.

### Company plan-year defaults

The frontend now derives a likely company plan year from:

- Benefit plan years
- Uploaded plan years
- Renewal date
- Current year fallback

The guide setup defaults:

- Cover name to company name
- Plan-year start to January 1
- Plan-year end to December 31
- Open-enrollment start to November 1 of the preceding year
- Open-enrollment end to November 15 of the preceding year

These are editable product defaults on the existing assembled-company path, not facts extracted by the new backend agent.

### Plan setup tab

A Plan setup tab was added to the company workspace.

It lets the user edit:

- Cover name
- Plan-year start
- Plan-year end
- Open-enrollment start
- Open-enrollment end

The booklet screen links to this tab when required existing-path fields are missing.

### Plan document management

The plan workflow now includes:

- Benefit-type selection
- Plan-document list
- PDF upload modal
- Parser progress
- Retry behavior
- Detailed structured attribute editor
- Recursive editing of nested attribute values
- Plan display-name and plan-year normalization

### Cost summary management

The company workspace now includes:

- Cost summary sections by uploaded plan
- Four-tier cost editing
- Employer and employee monthly amounts
- Pay-period basis
- Enrollment counts
- Year comparison behavior
- A cost comparison chart
- A direct route back to upload a missing plan source

Number inputs were changed to text-plus-decimal validation so a focused zero can be cleared naturally without producing invalid controlled-input behavior.

### Workbook import improvements

src/AddCompany.jsx no longer assumes the first worksheet row is the header.

It now:

- Reads the first sheet as a matrix.
- Locates the row containing Plan and Tier.
- Builds named row objects from that header.
- Normalizes EE+Spouse style tiers.
- Distinguishes dental and vision plans.
- Supports continuation rows under a plan.
- Throws a clear error if no plan/tier header or plan rows exist.

### Booklet generation UX

The existing generation UI now:

- Checks plan/setup requirements before enabling generation.
- Merges parsed uploaded plan rates into the company passed to the renderer.
- Shows a three-step generation rail.
- Shows the latest completed page rather than an unbounded scrolling page list.
- Shows recently completed pages.
- Shows a rendering overlay.
- Handles streamed error events.
- Supports regenerate behavior.
- Loads a previously saved lastGeneratedBooklet.
- Saves the final PDF to Firebase Storage.
- Saves filename, Storage path, URL, and generated timestamp to Firestore.

### Important wiring limitation

The React UI described above still calls /api/generate-booklet.

It does not yet provide:

- Thread creation
- Universal mixed-file upload
- Agent messages
- Blocker questions
- Batch answers
- Run polling
- Confidence report
- Source-map inspection
- Backend-first result history

The backend agent is therefore implemented and live-tested but not yet the main product interaction.

### Booklet Studio prototype

The former GammaBookletPrototype files were replaced by:

- src/BookletStudio.jsx
- src/bookletStudio.css
- src/bookletStudioData.js

The /booklet-studio route now presents an interactive prototype of the intended agent experience:

- Six source phases for employer, rates, official documents, template, census, and extra instructions.
- Simulated classification/extraction/matching stages.
- Extracted fact summaries.
- Progressive booklet-page availability.
- Quality/checklist indicators.
- A specific HSA decision blocker.
- Page and source views.
- Mobile preview behavior.
- A local reset/sample workflow.
- A downloadable JSON draft.

This is prototype-only UI with hardcoded Big Tows demonstration data and simulated waits. It does not call /api/booklet-pipeline and must not be confused with the live backend agent.

## PDF design and rendering work

The shared renderer and frontend preview styles were updated to:

- Remove dependence on the former Big Tows-specific script.
- Create employer-specific generation messaging.
- Support dynamic page lists.
- Include optional benefit sections only when offered.
- Improve consistent print layout.
- Preserve portrait US Letter sizing.
- Improve rate and contribution tables.
- Support multiple medical plans.
- Support dental and vision tables.
- Add HSA, HRA, FSA, telemedicine, Life/AD&D, STD, LTD, EAP, voluntary, contacts, and legal pages.
- Inject grounded LLM copy only when status is ready.
- Avoid placeholder values.

CSS work is contained primarily in:

- src/clean-pass.css
- src/inline.css

The existing project design constraints remain:

- No gradients.
- One approved blue accent scale.
- Neutral surfaces.
- Shared spacing, type, radius, and control tokens.
- Accessible focus behavior.
- No customer-specific fallback copy.

## Public source-document corpus added

source-docs/ was created as a public, representative benefits-source corpus.

It currently contains approximately 67 to 70 MiB and 86 files:

- 57 PDFs
- 2 XLSX workbooks
- 1 ZIP archive
- 11 Markdown catalog or instruction files
- 10 verification PNGs
- 5 verification text files

The corpus standard requires:

- Public material only
- No private employee information
- Descriptive filenames
- Original source URLs and retrieval context in category README files where completed
- Multiple meaningfully different examples per category
- Official government, carrier, employer, administrator, or educational sources

### Employer and group information

Five examples were collected:

- Kaiser California 2026 small-group employer application
- Excellus New York annual group information renewal
- Premera Washington 2026 small-group employer application
- Highmark Pennsylvania balanced-funding/stop-loss group application
- CMS/HealthCare.gov employer coverage tool

### Eligibility and enrollment

Five examples were collected:

- OPM health benefits election form
- CalPERS dependent-verification letter
- University of Minnesota new-employee enrollment guide
- American University 2025 benefits options guide
- Wisconsin ETF qualifying-life-event guide

### Rates, contributions, and payroll

Five examples were collected:

- OPM 2026 FEHB payroll rates workbook
- Wisconsin ETF 2027 full premium rates workbook
- NYSHIP 2026 active employee contribution rates
- Washington PEBB fiscal-year composite rates
- Anthem New York 2026 small-group approved rate archive

### Medical and prescription

Five examples were collected:

- Kaiser California Bronze 60 HDHP HMO SBC
- Healthfirst New York Essential Plan summary
- Kaiser Medicare Advantage HMO evidence/coverage material
- BCBS Federal Employee PPO brochure
- CVS Caremark formulary

### Dental

Five examples were collected:

- MetLife FEDVIP nationwide dental PPO
- Dominion FEDVIP Mid-Atlantic dental EPO
- NYSHIP dental certificate
- Western Dental California DHMO evidence of coverage
- Delta Dental New Jersey family PPO/pediatric EHB policy

### Vision

Five examples were collected:

- MetLife FEDVIP nationwide PPO vision
- NYSHIP/Davis Vision plan book
- CalHR VSP basic/premier evidence of coverage
- Washington PEBB EyeMed certificate
- EyeMed individual/family plan summary

### HSA

Five examples were collected:

- IRS Publication 969
- CMS 2026 HSA consumer guide
- Wisconsin ETF HDHP/HSA decision guide
- Minnesota HSA contribution change form
- Optum Bank HSA enrollment/contribution agreement

### HRA

Five examples were collected:

- City of Cincinnati integrated HRA plan description
- JPMorgan Chase Medicare retiree HRA plan description
- IRS QSEHRA guidance
- CMS ICHRA model notice
- Optum HRA reimbursement administration FAQ

This addresses the earlier request to find HRA material. The source wording uses HRA; references to HOA in conversation were interpreted as HRA based on the benefits context.

### FSA

Five examples were collected:

- CalHR medical reimbursement account flyer
- IRS Publication 503
- Washington SEBB limited-purpose FSA plan
- WEX FSA employee guide
- New York City FSA enrollment/change form

### Life and AD&D

Five examples were collected:

- OPM FEGLI handbook
- State of Minnesota group term life certificate
- City of Seattle voluntary AD&D certificate
- Fairfax County Public Schools Life/AD&D certificate
- Syracuse University evidence-of-insurability form

### Short-term disability

Five examples were collected:

- Yale/Hartford employer-administered STD plan
- University of Texas system voluntary STD certificate
- New York statutory disability statement of rights
- University of Hartford/Reliance group STD certificate
- University of California basic disability summary

### Long-term disability

Five examples were collected:

- University of Michigan basic LTD booklet
- Duke Health voluntary LTD certificate
- Indiana University medical resident LTD certificate/SPD
- State of California voluntary LTD guide
- University of Alabama system LTD claim FAQ

### Corpus verification status

The LTD and STD folders contain page-one verification images and, for LTD, extracted text used during source review.

The corpus is committed as development material, but it is not currently referenced by automated tests. Its addition expands the available real inputs substantially without automatically increasing tested product coverage.

## Existing real source fixtures

The repository already contained the following high-value inputs.

### Medical plan fixtures

| Fixture | Size | Pages | Notes |
| --- | ---: | ---: | --- |
| UHC Bronze 2026 | 217,354 bytes | 6 | Landscape US Letter SBC |
| Cigna Silver 2026 | 990,733 bytes | 9 | Landscape US Letter SBC |
| Aetna Silver 2025 | 518,918 bytes | 10 | Landscape US Letter SBC |

### Notion/transcript fixtures

| Fixture | Size | Pages | Notes |
| --- | ---: | ---: | --- |
| Employer application.pdf | 375,976 bytes | 6 | Embedded text |
| 2025 Benefit Guide.pdf | 2,992,006 bytes | 19 | Flower City conceptual baseline |
| Big Tows Benefit Booklet.pdf | 13,328,031 bytes | 25 | Image-only; approximately 25 extractable characters without OCR |
| ER and EE cost per month spreadsheet.xlsx | 53,923 bytes | Workbook | Employer-specific medical and dental costs |
| Q1/Q3/Q4 Excellus workbooks | About 15 KB each | Workbook | Carrier rate catalogs |
| Healthy NY renewal workbook | 187,775 bytes | Workbook | Multi-sheet rate material |

notion-call-transcripts/flower-city-section-classification.md was added to preserve the exact mapping between physical pages and conceptual section IDs.

## Files added for the backend agent

### api/booklet-pipeline.ts

Adds:

- Thread actions
- Upload decoding and validation
- Run lifecycle
- Batch blocker answers
- Status retrieval
- PDF and fact persistence
- Error handling

### lib/booklet-types.ts

Adds all common backend types, document types, benefit types, pipeline stages, events, and run state.

### lib/document-classifier.ts

Adds deterministic classification, spreadsheet sampling, metadata hints, and structured OpenAI fallback.

### lib/booklet-document-extractor.ts

Adds general employer/guide/email extraction with Zod, evidence pages/quotes, offerings, selections, contributions, contacts, accounts, and template roles.

### lib/rate-sheet-extractor.ts

Adds normalized workbook parsing for cost-summary, wide, and matrix layouts.

### lib/extracted-facts.ts

Adds conversion from document extraction, medical attributes, workbook rows, and manual answers into source-backed fact records.

### lib/benefits-package-assembler.ts

Adds authority-based merging, date normalization, plan deduplication, rate matching, offering detection, conflicts, source maps, and confidence.

### lib/contribution-engine.ts

Adds percent, flat-monthly, and flat-per-pay arithmetic and rule lookup.

### lib/question-engine.ts

Adds narrow blocking questions and contribution-answer conversion.

### lib/booklet-outline.ts

Adds dynamic section ordering and source attachment.

### lib/booklet-content-agent.ts

Adds one-call batched GPT content generation, readiness states, source-path enforcement, and literal grounding guards.

### lib/booklet-package-adapter.ts

Adds the bridge from BenefitsPackage to the existing renderer and active-plan pay-period selection.

### lib/benefits-booklet-generator.ts

Adds BenefitsPackage-oriented preview, HTML, and PDF entry points.

### lib/booklet-quality-checker.ts

Adds package, outline, HTML, and PDF checks.

### lib/booklet-pipeline.ts

Adds orchestration across all stages.

### lib/booklet-thread-store.ts

Adds Firestore/Storage persistence and safe serialization.

## Scripts added

### scripts/generate-booklet-agent-fixture.ts

Creates local agent-generated fixture outputs for development and inspection.

### scripts/production-backend-smoke.ts

Creates and executes the strongest repeatable deployed-backend verification in the repository.

It:

- Creates a completed employer setup PDF with pdf-lib.
- Loads the real UHC SBC fixture.
- Creates a realistic XLSX workbook.
- Calls the public backend create_thread action.
- Starts the run.
- Supports batch blocker answers.
- Confirms the run reaches complete.
- Reads persisted status and events.
- Downloads the signed PDF.
- Parses it with pdf-lib.
- Requires at least eight pages.
- Requires every page to be US Letter.
- Saves the local QA artifact.
- Runs pdftotext.
- Asserts expected employer, plan, account, payroll, and cost values.
- Rejects invalid, placeholder, undefined, null, NaN, and 52-payroll output.

This script creates real Firestore/Storage records and incurs model usage. It is intentionally not part of the standard deterministic test command.

## Test suite overview

The current Vitest discovery contains:

- 19 test files total
- 15 deterministic files executed by npm test
- 4 live-gated files skipped by normal npm test
- 252 test assertions discovered
- 178 deterministic assertions passing
- 74 live-gated assertions skipped in the standard command

The exact deterministic arithmetic is:

    18 + 4 + 1 + 1 + 4 + 27 + 17 + 43 + 1 + 7 + 15 + 14 + 6 + 3 + 17 = 178

The exact live arithmetic is:

    68 + 2 + 1 + 3 = 74

## Deterministic tests by file

### tests/benefits-package-assembler.test.ts — 18 tests

Covers:

- Source priority
- Current employer data beating prior context
- Master-template fact exclusion
- Equal-authority waiting-period conflict
- Manual conflict resolution
- Plan/year/date normalization
- Dental offering
- HRA detection
- HSA inference
- Differently named SBC attachment
- Duplicate-plan prevention
- Newest employer-specific rate fallback
- Missing employer/year/eligibility/plan blockers
- Ambiguous rate blockers
- Missing tier-contribution blockers
- Complete package with no blockers
- Manual selected plans
- Dynamic dental/HRA outline
- Trusted prior order

### tests/booklet-content-agent.test.ts — 4 tests

Covers:

- One structured batch for the full section list
- Ready, blocked, and omitted state merge
- Unknown source-path rejection
- Unsupported numeric-literal rejection
- Grounded date and comma-formatted amount acceptance

The OpenAI client is mocked. These tests validate prompt inputs and guardrails, not live prose quality.

### tests/booklet-document-extractor.test.ts — 1 test

Confirms text input is clearly labeled as source-document evidence. It does not make a real model call.

### tests/booklet-package-adapter.test.ts — 1 test

Confirms the active spreadsheet's 26-payroll rule beats a 52-period model default and an unrelated 24-period plan.

### tests/booklet-pipeline.test.ts — 4 tests

Covers:

- Real ER/EE workbook parsing
- Contribution-mode behavior
- Blocked pipeline behavior
- Resume after answers
- All-stage event flow
- Complete pipeline with injected grounded content

The employer PDF bytes and final six-page PDF are synthetic in this deterministic file. It proves orchestration rather than real Chromium layout.

### tests/booklet-quality-checker.test.ts — 27 tests

Covers:

- Valid case
- Seven required section omissions
- Offered benefit missing from outline
- Unresolved blocker
- Missing source paths
- Six placeholder variants
- Missing employer
- Missing plan
- Missing rendered section
- Invalid PDF
- Invalid dates
- Unexpected page count
- Non-Letter page

The PDF fixtures are blank pdf-lib pages; visual layout is outside this unit test.

### tests/booklet-section-core-scenarios.test.ts — 43 tests

Covers:

- Cover, TOC, welcome, enrollment, and eligibility variants
- Missing core sections
- Unoffered benefit omission
- Missing medical/dental/vision rate failures
- Telemedicine/HRA/FSA partial inputs
- Complete medical
- Complete dental
- Complete vision
- Multiple medical plans
- Medical plus dental plus vision
- Complete and combined account cases

These tests exercise outline, preview HTML, and quality logic rather than a fresh Chromium PDF in every case.

### tests/booklet-section-ancillary-scenarios.test.ts — 17 tests

Covers:

- Life/AD&D
- STD
- LTD
- EAP
- Voluntary
- All-unoffered omission
- Offered-but-incomplete behavior
- No invented policy/contact data
- Direct legacy carrier/policy/contact rendering
- Complete direct-renderer variants
- Contact deduplication
- Disclaimer precedence
- Nonempty ancillary pages

Several complete cases construct the legacy Company input directly. They prove the renderer can display rich fields but do not prove the normalized backend path supplies them.

### tests/booklet-thread-store.test.ts — 1 test

Confirms nested undefined values are removed before Firestore persistence.

### tests/booklet.test.ts — 7 tests

Covers:

- Enrollment-weighted totals
- Multiple medical, dental, and vision plans
- Dental absent/present behavior
- Natural-language date normalization
- No Invalid Date
- Ready LLM copy injection
- Blocked copy exclusion
- Ancillary modules without placeholder text

### tests/contribution-engine.test.ts — 15 tests

Covers:

- 52, 26, 24, and 12 pay periods
- Percent contribution
- Flat monthly contribution
- Flat per-pay contribution
- Premium cap
- Negative-value rejection
- Annual arithmetic
- Exact tier matching
- Benefit fallback
- Wrong-benefit no-match behavior

### tests/document-classifier.test.ts — 14 tests

Covers:

- Employer application
- Carrier rate sheet
- Renewal workbook
- Census
- SBC
- SPD
- Plan summary
- Prior booklet
- Benefit guide
- Email export
- Carrier and year hints
- CSV/workbook behavior
- Renewal precedence
- Invalid workbook fallback

### tests/extracted-facts.test.ts — 6 tests

Covers:

- Employer provenance
- Page provenance
- Employee classes
- Offered benefits
- Selected plans
- Manual answer confidence
- Medical attribute grouping

### tests/plan-extractor.test.ts — 3 tests

Covers:

- Four mocked OpenAI phases
- Ordered progress
- Text-page writes
- Partial structured patches
- Failure state
- Footer plan-ID backfill

### tests/rate-sheet-extractor.test.ts — 17 tests

Uses the real notion workbooks and covers:

- Seven tier label variants
- Q1, Q3, and Q4 Excellus catalogs
- Healthy NY multi-sheet input
- Dental detection in employer cost workbook
- Percent-versus-dollar inconsistency
- Reconciled percentage
- Flat-dollar contribution
- Sheet and row provenance
- Unsupported-layout warning

## Live-gated tests by file

The normal npm test command does not spend money or require an OpenAI key. The following files are skipped unless their environment gates and OPENAI_API_KEY are present.

### tests/booklet-content-agent.live.test.ts — 68 assertions

The 68 total is:

    17 supported content section IDs x 4 package scenarios

The four scenarios are:

- Insufficient information
- Partial information
- Complete information
- Multiple plans or variants

The test caches one generated batch per scenario, so the 68 assertions represent four OpenAI generation calls rather than 68 separate calls.

It verifies:

- Every requested section has the correct ready, blocked, or omitted state.
- Ready sections have concise copy.
- Ready sections cite source paths.
- Blocked and omitted sections do not contain copy.
- Copy does not contain placeholders.
- Multiple medical, dental, and vision names survive the multiple-plan scenario.
- Content remains grounded to the closed fact set.

The 17 section IDs are:

- cover
- toc
- welcome
- enrollment
- eligibility
- medical
- telemedicine
- hra
- fsa
- dental
- vision
- life
- ltd
- eap
- voluntary
- contacts
- legal

HSA and STD are not included in this live matrix.

### tests/booklet-document-extractor.live.test.ts — 2 tests

The Flower City test:

- Sends the real 2025 Benefit Guide to OpenAI.
- Extracts section order and benefit evidence.
- Confirms dental and HRA.
- Re-labels the guide as master-template context.
- Combines it with synthetic current employer/rate facts.
- Renders a real PDF.
- Runs shared quality checks.
- Writes output/pdf/live/flower-city-input-derived-benefits-guide.pdf.

The Big Tows test:

- Sends the real 25-page image-only booklet.
- Exercises model visual/OCR reading.
- Confirms employer and medical/dental/vision evidence.
- Combines extracted facts with rate/date/eligibility support.
- Renders a real PDF.
- Runs shared quality checks.
- Writes output/pdf/live/big-tows-input-derived-benefits-guide.pdf.

The Big Tows case is intentionally slow because the source has almost no embedded text.

### tests/booklet-pipeline.live.test.ts — 1 test

This test:

- Loads the real UHC Bronze 2026 SBC.
- Creates an in-memory employer instruction email.
- Creates a 26-pay-period rate workbook.
- Runs the full local pipeline.
- Uses real medical extraction.
- Uses real grounded section generation.
- Requires no blocker questions.
- Requires more than 15 extracted medical services.
- Requires a quality pass.
- Requires a valid PDF signature.
- Requires a Complete event.
- Can write the Northstar fixture artifact.

It does not call the deployed API or Firestore/Storage; that is covered by the production smoke script.

### tests/plan-extractor.live.test.ts — 3 tests

The live medical tests cover:

- UHC Bronze 2026
- Cigna Silver 2026
- Aetna Silver 2025

Each requires:

- Carrier
- Plan name
- Plan ID
- At least 20 services
- Deductible evidence
- At least three coverage examples
- At least six transcript pages
- Complete progress
- A real Chromium PDF
- Shared quality pass
- A written output artifact

## Paid/live execution history

The paid/live matrix was run with the actual Flux OpenAI key.

The aggregate outcome is:

- 68 content-section assertions passed.
- 3 real medical extraction/PDF tests passed.
- 2 real guide/booklet extraction/PDF tests passed.
- 1 full mixed-file local pipeline/PDF test passed.
- 74 live assertions passed in total.

One combined execution reported 73 of 74 before the original 600-second timeout expired on the 25-page image-only Big Tows case.

That test was given a 900-second OCR ceiling and rerun by itself. It passed in 286.79 seconds. Therefore, every one of the 74 live assertions passed on the current implementation, but not all 74 completed inside one original 10-minute combined process.

## Targeted gpt-5.6 content-model verification

After changing the content default to gpt-5.6, the complete-evidence scenario was run against the actual model.

Result:

- 17 section assertions passed.
- 51 other live matrix assertions were skipped by the targeted filter.
- Execution completed in approximately 22.29 seconds.

This proves the current output schema, prompt, grounding validation, comma-formatted number fix, and complete-evidence section results work with gpt-5.6.

## Real generated PDF artifacts

Generated PDFs are intentionally ignored by Git. They remain local QA artifacts under output/pdf/live/.

| Artifact | Approximate pages | Origin |
| --- | ---: | --- |
| aetna-silver-2025-benefits-guide.pdf | 8 | Real Aetna SBC extraction plus booklet rendering |
| cigna-silver-2026-benefits-guide.pdf | 8 | Real Cigna SBC extraction plus booklet rendering |
| uhc-bronze-2026-benefits-guide.pdf | 9 | Real UHC SBC extraction, including HSA-qualified plan behavior |
| flower-city-input-derived-benefits-guide.pdf | 11 | Real Flower City guide extraction plus current synthetic employer/rates |
| big-tows-input-derived-benefits-guide.pdf | 10 | Real image-only Big Tows visual/OCR extraction |
| northstar-fabrication-2026-benefits-guide.pdf | 9 | Full mixed-file local pipeline |
| production-backend-live-benefits-guide.pdf | 12 | Deployed Cloud Run, Firestore, Storage, OpenAI, and Chromium path |

All of the generated artifacts were checked for:

- Valid PDF structure
- US Letter page size
- Expected page range
- Employer and plan-year text
- No Invalid Date
- No obvious placeholders
- Offered benefit pages
- Consistent header/footer/page numbering
- Table fit
- Copy fit

The live PDF pages were rendered to images with Poppler for visual inspection. That review caught a date-normalization issue that structure-only tests did not catch.

## Latest live Cloud Run generation

The strongest current evidence is the completed deployed run:

| Field | Value |
| --- | --- |
| Service | ansa-booklet-backend |
| Run ID | 7126854d-1958-41a5-bb5a-3e36977d815b |
| Thread ID | 54a8a830-e7fd-4174-af76-fbcd1dffbe41 |
| Company ID | production-verification-1784342214615 |
| Created | 2026-07-18T02:37:02.778Z |
| Completed | 2026-07-18T02:38:49.087Z |
| Current status | complete |
| Persisted event documents | 31 |
| Ready grounded content sections | 11 |
| Confidence | 0.9866666666666667 |
| PDF pages | 12 |
| PDF bytes | 140,917 |
| Page size | 612 x 792 points |
| PDF producer | Chromium / Skia PDF m149 |
| Storage path | benefitsCompanies/production-verification-1784342214615/booklets/ansa-production-verification-llc-7126854d-1958-41a5-bb5a-3e36977d815b-benefits-guide.pdf |
| Local QA copy | output/pdf/live/production-backend-live-benefits-guide.pdf |

The run status was rechecked read-only while preparing this report.

The final persisted events include:

- Writing booklet content started.
- 11 grounded dynamic sections ready.
- Pre-render quality checks passed.
- PDF rendering started.
- 140,917 PDF bytes rendered.
- Rendered PDF quality checks passed with 12 pages.
- Complete event emitted.

The embedded run.stages array is empty because of the current persistence overwrite behavior. The 31-document event subcollection is the authoritative progress history.

## Live test input package

### Employer setup PDF

The script creates a real PDF containing:

- Employer: Ansa Production Verification LLC
- Plan year: January 1, 2026 through December 31, 2026
- Full-time eligibility: first of the month after 30 days
- Medical offering
- Dental offering
- HRA offering
- FSA offering
- HealthEquity as the HRA/FSA administrator
- HR/enrollment contact information

Using a completed PDF instead of a free-form email makes the employer setup an authoritative source under the current priority system.

### Medical plan document

The run uploads the real tests/fixtures/plans/uhc-bronze-2026.pdf SBC.

This provides:

- UnitedHealthcare carrier identity
- Bronze plan identity
- Plan year
- Medical benefit attributes
- HSA-qualified identity
- Service and prescription information
- Notices and plan document evidence

### Rate and contribution workbook

The generated XLSX contains two selected plans:

- UHC Bronze 2026 medical
- 2026 Dental - UnitedHealthcare National Options PPO 20 Network

It contains:

- Four coverage tiers
- Monthly premium
- Employer monthly cost
- Employee monthly cost
- Enrollment count
- A 26-pay-period basis

## Verified live cost values

### Medical employee per-pay values

| Coverage tier | Employee per-pay value |
| --- | ---: |
| Employee | $123.45 |
| Employee + spouse | $362.28 |
| Employee + children | $302.17 |
| Family | $547.98 |

### Dental employee per-pay values

| Coverage tier | Employee per-pay value |
| --- | ---: |
| Employee | $10.38 |
| Employee + spouse | $20.77 |
| Employee + children | $18.46 |
| Family | $31.15 |

The PDF text explicitly says per-pay amounts use 26 payroll deductions and are rounded to cents.

## Independent PDF verification

pdfinfo reports:

- 12 pages
- Portrait US Letter
- 612 x 792 points
- 140,917 bytes
- PDF 1.4
- Chromium creator
- Skia producer
- Tagged PDF
- No encryption
- No forms
- No embedded JavaScript

pdftotext confirms:

- Dental appears in the table of contents and section content.
- UnitedHealthcare appears.
- $123.45 appears.
- $547.98 appears.
- The exact 26 payroll deduction statement appears.
- HealthEquity appears.
- The medical plan appears.
- The dental plan appears.
- HRA content appears.
- FSA content appears.
- No targeted 52-payroll text appears.

Visual inspection was performed through:

- A full contact sheet.
- Individual inspection of the medical cost page.
- Individual inspection of the dental cost page.
- Individual inspection of the final page.

No visible clipping, overlap, broken page dimensions, or table overflow was found in those inspections.

## Live-test defect chronology and fixes

### Defect 1: event details contained undefined

Observed behavior:

- Firestore rejected the Classifying documents event.
- The optional details property existed with value undefined.

Fix:

- Event creation conditionally omits details.
- Persistence applies deep JSON-safe serialization.
- Regression tests verify both absent and populated details behavior.

### Defect 2: blocker options contained nested undefined

Observed behavior:

- A run reached conflict resolution.
- Firestore rejected questions[0].options.

Fix:

- All generation-run snapshots are normalized before persistence.
- Extracted facts use the same normalization.
- A dedicated thread-store regression test was added.

### Defect 3: one answer caused one expensive rerun

Observed behavior:

- Several blockers required several complete extraction reruns.

Fix:

- answer accepts a batch answers object.
- Unknown/nonblocking paths are ignored.
- Accepted answers are persisted.
- The run resumes once.

### Defect 4: email employer facts were not authoritative

Observed behavior:

- The initial live smoke used EML-style instructions.
- Email authority was lower than the required employer setup evidence.
- The run created avoidable blockers.

Fix:

- Text/email evidence is explicitly framed as a source document.
- The live test now uses a completed employer setup PDF for authoritative employer facts.
- The batch blocker path remains covered independently.

### Defect 5: duplicate medical plan

Observed behavior:

- Employer selection used one plan name.
- SBC identity used a longer carrier plan name.
- Both became selected plans.
- One lacked a rate match.

Fix:

- Explicit employer medical selection wins.
- The carrier SBC attributes attach to that selection when evidence supports the relationship.
- A regression test covers the differently named SBC case.

### Defect 6: natural-language date produced Invalid Date

Observed behavior:

- A generated booklet contained invalid date output.
- Existing structural checks did not originally catch the layout artifact.

Fix:

- Plan dates normalize before package/rendering.
- Invalid plan-year values become blocking quality issues.
- Tests cover natural-language date input and Invalid Date rejection.

### Defect 7: dental and account offerings were not detected completely

Observed behavior:

- Dental rate rows and HRA/HSA/FSA evidence did not consistently create sections.

Fix:

- Dental workbook detection was added.
- Offering evidence includes HRA, HSA, and FSA.
- HSA-qualified medical evidence can currently create HSA offering behavior.
- Outline and renderer tests cover conditional inclusion.

### Defect 8: 52 deductions overrode authoritative 26

Observed behavior:

- The first live production PDF used 52 deductions.
- The workbook clearly specified 26.
- Monthly values were correct but per-pay values were wrong.

Root cause:

- A general model-derived contribution default appeared before the active spreadsheet rule.

Fix:

- packagePayPeriods now prefers the active selected plan's spreadsheet-sourced rule.
- A regression test covers active and unrelated plans.
- The latest deployed PDF explicitly contains 26 payroll deductions.

### Defect 9: comma-formatted GPT amount failed grounding

Observed behavior:

- GPT-5.6 wrote $1,187.29.
- The number parser interpreted only 1,187.
- The otherwise grounded section was rejected.

Fix:

- Numeric matching now supports comma groups followed by optional decimals.
- The unit regression uses $1,500.25.
- The targeted GPT-5.6 test passed.

### Defect 10: first Cloud Build source upload stalled

Observed behavior:

- Cloud Build attempted to upload approximately 23.8 MiB across 137 files.
- The initial submission did not progress reliably.

Fix:

- .gcloudignore was added.
- Build context dropped to approximately 464.4 KiB and 34 files.
- The corrected Cloud Build completed and pushed the image.

### Defect 11: production text assertion expected a rounded approximation

Observed behavior:

- The smoke script expected $548.00.
- The generator produced $547.98.

Resolution:

- The generator was correct.
- $1,187.29 x 12 / 26 rounds to $547.98.
- The assertion was corrected to $547.98.
- The existing completed PDF was independently rechecked with pdftotext and visual rendering.

## What normal tests do and do not prove

The deterministic suite strongly proves:

- Pure contribution arithmetic
- Workbook normalization
- Classification signals
- Source priority
- Core conflicts and questions
- Outline behavior
- Content post-processing
- HTML page presence
- Firestore-safe object normalization
- Pipeline orchestration with injected dependencies

The paid/live suite adds proof for:

- Real OpenAI structured outputs
- Real SBC extraction
- Image-only prior booklet reading
- Real Chromium PDF generation
- The 17-section LLM scenario matrix
- A complete local mixed-file pipeline

The production smoke adds proof for:

- Public deployed API routing
- Firestore threads, runs, facts, messages, and events
- Firebase Storage source inputs
- Secret-backed OpenAI access
- Cloud Run execution
- Real PDF persistence and signed download
- Final PDF page size/count
- Final PDF text values
- Exact payroll basis

No current automated suite fully proves:

- Authentication
- Tenant isolation
- Cross-company file ownership
- Concurrent answer safety
- Job recovery after process death
- Idempotency
- Retry deduplication
- Every public source corpus file
- Full typed ancillary extraction
- Visual layout on every scenario
- Sensitive-data protection

## Cloud Run packaging implemented

The long-running backend was packaged for Google Cloud Run because document extraction, multiple OpenAI calls, Chromium rendering, and OCR-like visual reading are a better fit there than in a short serverless frontend function.

### cloud-run/server.ts

The server:

- Uses the Node HTTP server.
- Binds to 0.0.0.0 on Cloud Run's PORT.
- Adapts IncomingMessage and ServerResponse to the Vercel handler shape.
- Adds res.status and res.json.
- Parses query strings.
- Parses JSON request bodies.
- Enforces a configurable body limit.
- Handles CORS.
- Handles OPTIONS preflight.
- Exposes all four existing handlers.
- Exposes root and health endpoints.
- Handles trailing slashes.
- Returns JSON 404s and errors.
- Handles SIGTERM and SIGINT for graceful shutdown.

Exposed routes are:

- POST /api/company-profile
- POST /api/generate-booklet
- POST /api/parse-plan
- GET or POST /api/booklet-pipeline
- GET /
- GET /healthz in local server code

The body limit defaults to 30 MiB.

The API route itself allows one decoded file up to 50 MiB. Base64 expansion plus the Cloud Run JSON body limit means direct inline upload is practically much smaller, approximately 22 MiB for one request. Existing uploaded file IDs are the preferred path for larger material.

### cloud-run/Dockerfile

The Docker build is multi-stage.

Build stage:

- Node 22 Bookworm slim
- npm ci
- Copies api, lib, and server source
- Bundles server.ts with esbuild to ESM
- Preserves a source map
- Leaves packages external

Runtime stage:

- Node 22 Bookworm slim
- NODE_ENV production
- Source maps enabled
- Installs Chromium shared libraries and fonts
- Installs production-only Node dependencies
- Copies the bundled server
- Runs as the non-root node user
- Exposes port 8080

The system is therefore using Docker locally as a packaging definition and Cloud Build to build that image in Google Cloud. It is not relying on a manually maintained local binary deployment.

One maintenance concern is that esbuild is currently available transitively through the toolchain rather than declared as a direct dependency.

### cloud-run/cloudbuild.yaml

Cloud Build:

- Invokes Docker.
- Uses cloud-run/Dockerfile.
- Tags the requested Artifact Registry image.
- Pushes the built image.
- Uses an E2_HIGHCPU_8 machine.

### cloud-run/vite-api-base-plugin.mjs

The Vite plugin:

- Normalizes VITE_BACKEND_API_URL.
- Requires HTTPS outside localhost.
- Fails Vercel builds when the value is required but missing.
- Rewrites literal fetch calls beginning with /api/ inside source files.
- Leaves local relative API calls unchanged when no base URL is configured.

This allows the same React source to use local Vite middleware during development and Cloud Run in a Vercel production build.

### Vercel build separation

.vercelignore now excludes api/.

vercel.json now contains only the SPA rewrite needed for company routes.

The intended architecture is:

    Vercel
      -> static React frontend

    Google Cloud Run
      -> backend APIs
      -> OpenAI
      -> Firestore
      -> Firebase Storage
      -> Chromium PDF renderer

## Google Cloud infrastructure completed before deployment pause

No additional deployment will be performed as part of the current report/commit step. The following infrastructure was completed earlier in the session.

### Google configuration

- gcloud configuration: ansa-flux
- Google project: flux-ebfb0
- Region: us-east1
- Active deployment account used: mileslow2@gmail.com

The Firebase Admin service account did not have Cloud Run, Artifact Registry, Secret Manager, IAM, and build administration permissions, so the user account was used for infrastructure deployment.

### Enabled services

The target project had the required services enabled:

- Artifact Registry
- Cloud Build
- Cloud Run
- Secret Manager

### Artifact Registry

Repository:

- Name: ansa
- Format: Docker
- Region: us-east1
- Project: flux-ebfb0

### Runtime service account

Identity:

- ansa-booklet-backend@flux-ebfb0.iam.gserviceaccount.com

Granted runtime access:

- roles/datastore.user on the project
- roles/storage.objectAdmin on gs://flux-ebfb0.firebasestorage.app
- roles/secretmanager.secretAccessor on OPENAI_API_KEY
- roles/iam.serviceAccountTokenCreator on itself for signed URLs

### Secret Manager

- Secret: OPENAI_API_KEY
- Version created: 1
- Value sourced from the actual Flux project environment
- Value never printed or committed

### Cloud Build history

Initial completed image build:

- Build ID: 01ee4605-ffbc-4222-bc19-07f8b76985af
- Image tag: 20260717-2210
- Digest begins: sha256:d56ea

Corrected build after final backend fixes:

- Build ID: 8ca80ec5-7de7-447b-8774-7ca4042f0bb1
- Image tag: 20260717-2233
- Digest: sha256:40c4df5bea76f1c5b58ba0fa063321025844e9c58cc765053124edc18da0123

### Cloud Run service

- Service: ansa-booklet-backend
- Region: us-east1
- URL: https://ansa-booklet-backend-15044436863.us-east1.run.app
- Latest deployed revision: ansa-booklet-backend-00003-bqr
- Image tag: 20260717-2233
- CPU: 2
- Memory: 2 GiB
- Concurrency: 2
- Request timeout: 900 seconds
- Maximum instances: 5
- Minimum instances: 0
- Execution environment: second generation
- Traffic: 100 percent to the latest revision

Runtime environment includes:

- FIREBASE_PROJECT_ID=flux-ebfb0
- FIREBASE_STORAGE_BUCKET=flux-ebfb0.firebasestorage.app
- CORS_ALLOWED_ORIGINS=*
- MAX_JSON_BODY_BYTES around 30 MiB
- OPENAI_PLAN_MODEL=gpt-5.4-mini
- OPENAI_BOOKLET_CONTENT_MODEL=gpt-5.6
- OPENAI_API_KEY from Secret Manager

### Cloud Run route checks

Verified:

- GET / returns HTTP 200 with service/revision JSON.
- GET /api/booklet-pipeline?action=status returns the expected HTTP 400 when runId is missing.
- CORS preflight from the Vercel origin returns HTTP 204.
- The full generation route completed the 12-page live run.

Known route anomaly:

- The deployed /healthz path returned a Google Frontend 404 during one check even though the container code handles it and / works.
- The root route is the currently proven health check.

## Vercel state

The frontend remains hosted in:

- Vercel workspace: miles-lows-projects
- Project: ansa-benefits-studio
- Production alias: https://ansa-benefits-studio.vercel.app

The last known working production deployment before Cloud Run frontend rewiring:

- Deployment ID: dpl_9xXDDq9gCoz348yQa3Pywy87cAQj
- Deployment URL: https://ansa-benefits-studio-bz23kx594-miles-lows-projects.vercel.app
- Status: Ready

A later Vercel deployment attempt failed because the newly added build guard correctly required VITE_BACKEND_API_URL while the deployment was already in progress.

VITE_BACKEND_API_URL was then added for:

- Production
- Preview
- Development

Its value points to the Cloud Run service.

However, the frontend was not redeployed after those variables were added. Therefore:

- The current production alias still represents the earlier architecture.
- It still contains the Vercel serverless API functions from that build.
- It has not been proven to contain the static fetch rewrites to Cloud Run.
- The current working tree would exclude api/ on a future Vercel deployment.

Deployment was explicitly paused by the user. No Vercel redeploy is being performed now.

## Deliberately low current security posture

The current development posture follows the explicit instruction to make security very low for now.

### Public Cloud Run invocation

Cloud Run grants allUsers the run invoker role.

No bearer authentication is required.

### CORS

CORS_ALLOWED_ORIGINS is set to *.

The server echoes an allowed request Origin and permits:

- GET
- POST
- OPTIONS
- Authorization header
- Content-Type header
- X-Requested-With header

CORS is not authorization.

### API authorization

The backend currently validates only identifier syntax.

It does not verify:

- Signed-in user
- Clerk session
- Company ownership
- Thread ownership
- Run ownership
- Uploaded-file ownership
- Organization membership
- Cross-company file attachment

Any caller who knows or guesses a valid ID may be able to:

- Add a message to a thread.
- Attach an existing file ID.
- Read a run's status and package snapshot.
- Answer a run's blocker questions.
- Receive the generated PDF URL.

### Firestore rules

Current Firestore rules allow public reads and writes under benefitsCompanies.

The new Admin SDK backend collections bypass client rules. They depend entirely on backend authorization, which is currently absent.

### Storage rules

Current rules:

- Allow public reads for plan PDFs and generated booklets.
- Allow constrained direct PDF writes for those paths.
- Deny direct client access to booklet-inputs.

The unauthenticated Admin SDK API can still read/write booklet inputs.

### Signed URLs

Backend PDF URLs expire in 2035.

This is acceptable only for low-security development.

### Security conclusion

The current service must not be considered safe for sensitive employer, plan, census, enrollment, or employee documents.

Before real sensitive use, the project needs:

- Authentication
- Organization and user ownership
- Per-resource authorization
- Cross-tenant tests
- Private Firestore rules
- Private Storage rules
- Short-lived or authenticated PDF download
- Audit logging
- Request limits and abuse controls

## Operational and persistence limitations

### Synchronous requests

start and answer keep the HTTP request open until blocked, complete, or failed.

There is no:

- Queue
- Worker lease
- Durable checkpoint
- Resumable job
- Request cancellation
- Idempotency key
- Retry deduplication

### Re-extraction on answer

Every answer reruns classification and extraction.

The pipeline does not cache:

- Classifications
- Document extraction
- Medical plan extraction
- Workbook extraction

### Event history overwrite behavior

Two related issues remain:

- savePipelineEvent writes the event subcollection and appends to run.stages.
- A later saveGenerationRun using the original in-memory run can overwrite stages with an empty array.

The event subcollection remains intact and is what status consumers should currently use.

Event IDs restart at 001 for each rerun of the same run. Answer/resume can therefore overwrite prior event documents rather than retaining a complete multi-attempt history.

### Concurrent writes

Thread, message, upload, run, and fact writes are not wrapped in one transaction.

Concurrent answer requests can race.

### Firestore document size

The generation-run snapshot can embed:

- Full BenefitsPackage
- Full medical attributes
- All rates
- Confidence data

Several rich medical plans could approach or exceed Firestore's 1 MiB document limit even though individual plan parsing has an 850 KB safeguard.

### Request-size mismatch

- API decoded-file limit: 50 MiB per file
- Cloud Run JSON-body default: 30 MiB total
- Base64 expansion: approximately one third larger

The effective inline file limit is therefore much less than the API's nominal limit.

### Concurrency

Each request can perform:

- Several model calls
- Large PDF transfers
- Spreadsheet parsing
- Chromium launch/rendering

Cloud Run concurrency is 2. This is intentionally conservative but still allows two resource-heavy requests per instance.

## Dependency audit observations

During the container build:

- Production dependency audit reported 7 vulnerabilities: 6 moderate and 1 high.
- The full build dependency audit reported 17 vulnerabilities: 10 moderate and 7 high.

They were not remediated during this implementation.

The frontend build also reports the existing large JavaScript chunk warning, approximately 1.09 MB uncompressed and 340 KB gzip.

## Known product and technical gaps

### Priority 0: source-fidelity correctness

1. Create one canonical 19-ID section registry used by outline, content, renderer, adapter, and tests.
2. Add HSA and STD to grounded content generation.
3. Make the package-to-renderer path lossless or render directly from BenefitsPackage.
4. Prevent a content-blocked material section from silently receiving unsupported deterministic claims.
5. Distinguish an HSA-qualified plan from an employer-sponsored HSA.
6. Expand field-level provenance to every material rendered value.

### Priority 1: typed benefit models

Dental should model:

- Preventive
- Basic
- Major
- Orthodontia
- Deductible
- Annual maximum
- Waiting periods
- Network and out-of-network behavior

Vision should model:

- Exam
- Lenses
- Frames
- Contacts
- Frequency
- Allowances
- Network behavior

Life/AD&D should model:

- Benefit amount or formula
- AD&D amount
- Guarantee issue
- Age reductions
- Funding
- Employee cost
- Beneficiary details

STD should model:

- Benefit percentage
- Weekly maximum
- Elimination period
- Maximum duration
- Funding
- Employee cost

LTD should model:

- Benefit percentage
- Monthly maximum
- Elimination period
- Maximum duration
- Pre-existing condition rules
- Funding
- Employee cost

EAP and telemedicine should model:

- Vendor
- Access method
- Services
- Cost
- Contact data

Voluntary benefits should be a collection of actual offered products rather than one broad flag. Product types may include accident, critical illness, hospital indemnity, voluntary life, and voluntary disability.

### Priority 1: account fidelity

HSA should model:

- Employer offering versus plan qualification
- Administrator
- Employer contribution
- Coverage-tier or class differences
- Current-year limits and source
- Limited-purpose FSA interaction

HRA should model:

- Administrator
- Plan association
- Employee-only, spouse, children, and family funding
- Class differences
- Eligible expense and reimbursement rules

FSA should model:

- Healthcare FSA
- Dependent-care FSA
- Limited-purpose FSA
- Election limit
- Carryover
- Grace period
- Runout
- Employer contribution
- HSA compatibility

### Priority 1: questions and conflicts

Add:

- Ancillary-specific required-field questions
- HRA funding questions
- HSA-offering confirmation
- FSA/HSA compatibility questions
- Rate and contribution conflicts
- Plan attribute conflicts
- Account administrator conflicts
- Contact conflicts
- Offering true/false conflicts
- Blocking versus warning distinction
- Ancillary-only package support

### Priority 1: quality

Add:

- Independent cost recomputation
- PDF-text checks in the shared checker
- Expected value assertions
- Empty table/cell checks
- Minimum section richness
- Source coverage per rendered value
- Template employer leakage detection
- Current legal notice precedence
- Visual overflow detection
- Blank-page detection
- OCR confidence requirements

### Priority 1: frontend agent integration

Build a React client for:

- New thread
- Multi-file upload
- User message
- Live persisted events
- Blocker cards
- Batch answer form
- Resume
- Confidence report
- Source map
- Download history

### Priority 1: security

Before sensitive use:

- Integrate Clerk or equivalent authentication.
- Associate every company, file, thread, message, run, fact, and PDF with an authorized organization.
- Validate ownership on every action.
- Deny public Firebase access.
- Shorten signed URL lifetime.
- Add cross-tenant negative tests.

### Priority 2: operations

Add:

- Queue-backed jobs
- Durable stage checkpoints
- Cached extractions
- Idempotency keys
- Retry policies
- Job cancellation
- Structured request/run correlation
- Concurrency/load tests
- Cost/latency monitoring
- Dead-letter or manual recovery

### Priority 2: corpus coverage

Turn the new source-docs corpus into gated live tests for:

- Dental plan design
- Vision plan design
- HSA contribution variants
- Tiered HRA
- Multiple FSA variants
- Life/AD&D
- STD
- LTD
- Different payroll schedules
- Multiple voluntary products

## Recommended next implementation sequence

1. Preserve and merge the current working MVP.
2. Wire a minimal frontend client to /api/booklet-pipeline.
3. Add HSA and STD to the content-agent registry and four-state live matrix.
4. Define typed account, dental, vision, life, and disability schemas.
5. Extend extraction and package assembly for those schemas.
6. Replace lossy adapter behavior.
7. Add per-benefit blocker rules.
8. Add PDF-text and arithmetic checks to shared QA.
9. Add source-docs live scenarios.
10. Add authentication and tenant ownership before sensitive use.
11. Move long runs to a durable job model.
12. Redeploy the static frontend to Cloud Run wiring only when deployment work is resumed.

## Safe local verification commands

Install dependencies:

    npm install

Run the deterministic suite:

    npm test

Build the frontend:

    npm run build

Run paid/live tests only when intentionally authorizing model cost:

    OPENAI_API_KEY=... npm run test:live

Run the deployed smoke only when intentionally authorizing:

- New Firestore and Storage records
- OpenAI usage
- A real backend generation

    OPENAI_API_KEY=... npx tsx scripts/production-backend-smoke.ts

Do not place the key in shell history or source files. Prefer loading it from an ignored environment file.

## Files intentionally excluded from version control

The final commit should not include:

- .env
- .env.local
- cloud-run/env.yaml
- cloud-run/dist/
- dist/
- node_modules/
- output/
- temporary PDF renders
- .playwright-cli/
- .vercel/
- .agents/
- skills-lock.json

The first items are ignored because they contain secrets, generated artifacts, dependencies, or local environment state. .agents and skills-lock.json are local Codex/plugin metadata and are unrelated to the benefits implementation.

## Current completion assessment

### Completed

- Backend thread/run/file/message API
- Mixed-file intake
- Classification
- Employer/guide/email extraction
- Real medical extraction
- Workbook parsing
- Contribution math
- Source-aware package
- Core conflicts and blockers
- Batch answer/resume
- Conditional outline
- 17-ID grounded content agent
- GPT-5.6 default and verification
- Real HTML/PDF generation
- Preflight and PDF structure QA
- Firestore and Storage persistence
- Repeatable production smoke
- Real Cloud Run generation
- Public source corpus
- 178 deterministic tests
- 74 previously completed live assertions
- Latest 12-page corrected live PDF
- Docker/Cloud Build/Cloud Run packaging

### Partially complete

- Full source grounding of deterministic copy
- Dental and vision plan-design extraction
- Life/AD&D, STD, LTD, EAP, telemedicine, and voluntary detail
- HSA, HRA, and FSA configuration and funding
- Conflict coverage
- Question coverage
- Shared PDF-text and visual QA
- Frontend generation experience
- Cloud Run frontend wiring

### Not complete

- Frontend thread-agent UI
- HSA and STD LLM copy
- Rich typed ancillary schemas
- Lossless package-to-renderer mapping
- Durable background jobs
- Authentication
- Tenant isolation
- Private Firebase rules
- Short-lived protected downloads
- Production-safe security
- Current Vercel frontend redeployment to Cloud Run

## Final factual status

The backend-first benefits booklet agent is implemented as a functioning MVP and has generated a real, source-informed PDF through the deployed Cloud Run, Firestore, Firebase Storage, OpenAI, and Chromium path.

The current code is substantially beyond the original 20 to 30 percent generator state, especially for:

- Medical plan extraction
- Rate and contribution handling
- Thread orchestration
- Questions and resume
- Dynamic section selection
- Source-grounded 17-section content
- Real PDF rendering
- Live infrastructure verification

It is not accurate to call the entire product complete or production-secure. The most important remaining engineering work is source-fidelity for ancillary/account benefits, HSA/STD content consistency, frontend integration of the backend agent, durable execution, and security.

Deployment work is paused. The next action for this session is limited to local verification, committing the relevant working-tree changes, and pushing them to the configured GitHub remote.

## Report maintenance note

This file should be updated whenever any of the following change:

- Test counts
- Supported section IDs
- Content model
- Cloud Run revision
- Live run evidence
- Frontend/backend wiring
- Security posture
- Known acceptance gaps

Earlier reports should link to this file rather than independently claiming complete/deployed status.
