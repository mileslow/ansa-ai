# Benefits Booklet Generator Implementation Plan

## Product goal

Build a pure files-in, booklet-out benefits booklet generator.

The user should be able to drop in whatever information they have, watch the agent process it, and receive a generated benefits booklet. The system should only ask the user for input when it cannot confidently proceed from the uploaded materials.

Primary flow:

```txt
Files in
  -> animated agent processing
  -> extraction, matching, inference, and quality checks
  -> generated benefits booklet
  -> exception questions only when required
```

This is not primarily a manual CRM or form-entry workflow. Manual fields and editors can exist for review/debugging, but the main product experience should be autonomous.

## Operating principle

The app should never ask the user to enter data that exists somewhere in the uploaded files.

The agent should:

1. Classify every uploaded file.
2. Extract structured facts from each file.
3. Merge facts into a normalized benefits package.
4. Resolve conflicts using recency, source quality, and confidence.
5. Generate the booklet from the normalized package.
6. Ask the user only when missing or conflicting information blocks reliable generation.

When the agent asks a question, it should be specific, minimal, and tied to a concrete blocker.

Good:

```txt
I found two different eligibility waiting periods:
- Employer application: first of month after 30 days
- Prior booklet: first of month after 60 days

Which should be used for this booklet?
```

Bad:

```txt
Please fill out the eligibility section.
```

## Target backend experience

### 1. Backend-first chat/thread interface

For now, do not build UI.

The product surface should be a backend chat/thread API that can later power a UI or email workflow. For implementation and testing, the thread can be driven by API calls, scripts, or live tests.

The backend should support a user message like:

```txt
Here are the files for Big Tows. Generate the benefits booklet.
```

The backend thread model should support:

- File attachments
- Freeform instructions
- Agent progress events
- Agent blocker questions
- User answers
- Generated booklet links
- Final confidence report

No frontend chat surface is required in this iteration. Existing frontend screens can remain untouched unless a backend contract requires a small compatibility change.

Near-term backend flow:

```txt
Client/test creates thread
  -> client/test attaches or references files
  -> agent records received files
  -> agent classifies documents
  -> agent extracts and assembles benefits package
  -> agent creates only blocker questions in thread state
  -> client/test submits answers if needed
  -> agent generates booklet
  -> agent stores final PDF link and confidence report
```

### 2. Universal file intake

The backend API should accept a batch of files or existing uploaded file IDs:

```txt
Upload everything you have for this employer
```

Supported inputs should include:

- Employer applications
- Carrier rate spreadsheets
- Prior benefit guides
- Prior booklets
- Plan SBCs
- Plan summaries
- SPDs
- Census files
- Renewal spreadsheets
- Broker/client emails or exported email attachments, later

The user should not need to choose the document type before upload.

### 3. Streamed agent processing

The backend should stream or persist real pipeline stages. These events can later be animated in a UI, but no UI animation work should be done now.

Required stages:

```txt
Uploading files
Classifying documents
Extracting employer setup
Reading carrier rate sheets
Parsing plan documents
Reading prior booklets/guides
Matching rates to plans
Detecting offered benefits
Resolving conflicts
Building booklet outline
Writing booklet content
Rendering PDF
Running quality checks
Complete
```

Each stage should stream useful progress events:

- Files recognized
- Document types detected
- Plans found
- Rates extracted
- Benefits detected
- Sections selected
- Warnings/conflicts found
- Source confidence
- Final PDF URL

### 4. Exception-only questions

If the agent has enough information, it should continue without asking.

If it does not have enough information, it should pause or create only the missing decision required to continue.

Examples of valid questions:

- Which waiting period should be used when sources conflict?
- Which plan document matches an unmatched rate row?
- Should an inferred benefit section be included when evidence is weak?
- What employer contribution should be used when no contribution appears in any file?

The system should prefer best-effort generation with clear source labels over unnecessary interruption.

### 5. Future email interface

The long-term workflow should support email, but email should be treated as a second interface to the same agent pipeline, not a separate product.

Future email flow:

```txt
Broker forwards carrier/client email with attachments
  -> system creates or updates a booklet generation thread
  -> agent processes attachments and email body
  -> agent replies with blocker questions if needed
  -> broker replies by email
  -> agent generates booklet and sends final link
```

Email-specific future requirements:

- Ingest email body text as a source document.
- Ingest email attachments as uploaded files.
- Detect employer/company from sender, subject, body, and attachments.
- Attach email messages to the correct company/booklet thread.
- Ask blocker questions by email when the user is not in the app.
- Parse email replies as user answers.
- Send generated booklet links by email.
- Preserve email source references for extracted facts.

Do not implement email before the backend thread pipeline works end to end.

## Architecture

```txt
Uploaded files
  -> File classifier
  -> Specialized extractors
  -> Fact store + source map
  -> Benefits package assembler
  -> Conflict resolver
  -> Booklet outline generator
  -> Booklet content generator
  -> PDF renderer
  -> Quality checker
  -> Generated booklet + confidence report
```

## Core data model

### UploadedFile

Represents one raw uploaded file.

Required fields:

- `id`
- `companyId`
- `fileName`
- `storagePath`
- `mimeType`
- `uploadedAt`
- `sha256`
- `processingStatus`

### ClassifiedDocument

Classification result for each file.

Required fields:

- `fileId`
- `documentType`
- `confidence`
- `detectedEmployer`
- `detectedCarrier`
- `detectedPlanYear`
- `reasoningSummary`

Supported `documentType` values:

- `employer_application`
- `carrier_rate_sheet`
- `plan_summary`
- `sbc`
- `spd`
- `benefit_guide`
- `prior_booklet`
- `census`
- `renewal_spreadsheet`
- `email_export`
- `unknown`

### ExtractedFact

Every important extracted value should be stored as a fact with source information.

Required fields:

- `id`
- `companyId`
- `fileId`
- `documentType`
- `path`
- `value`
- `normalizedValue`
- `confidence`
- `source`
- `extractionMethod`
- `createdAt`

Example:

```ts
{
  path: "medicalPlans[0].deductible.individual",
  value: "$3,000",
  normalizedValue: 3000,
  confidence: 0.91,
  source: {
    fileName: "2025 Benefit Guide.pdf",
    page: 8,
    textRange: "Deductible Individual $3,000"
  },
  extractionMethod: "pdf_text"
}
```

### BenefitsPackage

The normalized object used to generate the booklet.

Required top-level fields:

- `employer`
- `planYear`
- `eligibility`
- `offeredBenefits`
- `plans`
- `rates`
- `contributions`
- `contacts`
- `accounts`
- `bookletStyle`
- `sourceMap`
- `confidenceReport`

This is the most important object in the system. The booklet should be generated from this package, not directly from raw uploaded files or loose UI fields.

### CompanyOffering

Represents one benefit line offered by the employer.

Required fields:

- `benefitType`
- `offered`
- `selectedPlans`
- `eligibilityRule`
- `contributionRules`
- `contacts`
- `sourceRefs`
- `confidence`

Supported `benefitType` values:

- `medical`
- `dental`
- `vision`
- `life`
- `std`
- `ltd`
- `eap`
- `voluntary`
- `telemedicine`
- `hsa`
- `hra`
- `fsa`

### ContributionRule

Employer contributions must support both percentage and fixed-dollar logic.

Required fields:

- `benefitType`
- `planId`
- `tier`
- `employeeClass`
- `mode`
- `value`
- `payPeriods`
- `sourceRefs`

Supported `mode` values:

- `percent`
- `flat_monthly`
- `flat_per_pay`

The current `erPercent`-only model is not sufficient.

### CarrierRatePlan

Normalized row from carrier rate spreadsheets.

Required fields:

- `carrier`
- `state`
- `marketSegment`
- `quarter`
- `effectiveDate`
- `planName`
- `productType`
- `metalTier`
- `network`
- `rateArea`
- `tiers`
- `sourceFile`
- `sourceSheet`
- `sourceRow`
- `confidence`

### BookletGenerationRun

Represents one end-to-end generation attempt.

Required fields:

- `id`
- `companyId`
- `status`
- `uploadedFileIds`
- `stages`
- `questions`
- `answers`
- `benefitsPackageSnapshot`
- `bookletOutline`
- `pdfStoragePath`
- `confidenceReport`
- `createdAt`
- `completedAt`

## Required pipeline components

### 1. File classifier

Add a classifier that labels each uploaded file before extraction.

Output example:

```ts
{
  fileName: "Employer application.pdf",
  documentType: "employer_application",
  confidence: 0.94,
  detectedCarrier: "Excellus",
  detectedEmployer: "Big Tows"
}
```

Classifier should use:

- File extension
- Filename
- PDF metadata
- Extracted text sample
- Spreadsheet sheet names and headers
- Model-based classification when heuristic confidence is low

### 2. Employer application extractor

Extract:

- Employer legal name
- Group name
- Address
- Effective date
- Carrier
- Selected products
- Subgroups
- Employee classes
- Eligibility and waiting period
- Employer contribution rules
- HSA/HRA/FSA details
- Contacts
- Signers
- Source references

This should be separate from plan document extraction.

### 3. Carrier rate spreadsheet extractor

Extract:

- Carrier
- State
- Quarter/year
- Market segment
- Plan names
- Product/network type
- Tier rates
- Renewal or change percentages, if present
- Source sheet and row references

This extractor must handle different carrier spreadsheet formats over time.

### 4. Plan document extractor

The current OpenAI-backed plan extractor is a strong foundation. The next implementation needs to make its output operational in booklet generation.

Extract and use:

- Carrier
- Plan name
- Product/network type
- Coverage period
- Deductibles
- Out-of-pocket maximums
- PCP/specialist copays
- Urgent care
- Emergency room
- Hospital services
- Prescription tiers
- Coinsurance
- Exclusions
- Legal notices
- Contacts

### 5. Prior guide/booklet extractor

Prior guides and booklets should be treated as high-value context.

Extract:

- Offered benefit sections
- Section order
- Employer-specific language
- Eligibility descriptions
- Contact blocks
- Carrier links and phone numbers
- Style/layout cues
- Legal/disclaimer language
- Plan names
- Cost table structure

Image-based prior booklets should be OCRed and treated with lower confidence unless verified by stronger sources.

### 6. Benefits package assembler

The assembler merges all extracted facts into one normalized `BenefitsPackage`.

Responsibilities:

- Detect offered benefits.
- Match plan documents to rate rows.
- Match prior booklet sections to current offerings.
- Select the most reliable value when multiple sources agree or conflict.
- Preserve all source references.
- Produce a confidence report.
- Produce specific user questions only for unresolved blockers.

Resolution priority should generally be:

1. Current employer application
2. Current carrier rate spreadsheet
3. Current plan documents/SBCs/SPDs
4. Current benefit guide
5. Prior booklet/guide
6. Filename or weak inference
7. Manual user answer

This priority can vary by field. For example, plan deductibles should usually trust the plan document over the employer application.

### 7. Question engine

The question engine decides whether the agent can continue.

It should create questions only when:

- A required field is missing.
- Sources conflict and no safe resolution rule applies.
- A plan/rate match is ambiguous.
- A generated booklet section would be materially misleading without the answer.

Questions must include:

- `fieldPath`
- `reason`
- `options`, when known
- `recommendedAnswer`, when available
- `sourceRefs`
- `blocking`

If a question is not blocking, the agent should continue and mark the field as inferred or low confidence.

### 8. Booklet outline generator

Generate the booklet section list from the `BenefitsPackage`.

Required base sections:

- Cover
- Welcome or introduction
- Eligibility
- How to enroll
- Medical, if offered
- Dental, if offered
- Vision, if offered
- Life, if offered
- STD/LTD, if offered
- HSA/HRA/FSA, if offered
- Telemedicine, if offered
- EAP, if offered
- Voluntary benefits, if offered
- Contacts
- Legal notices

The outline should include only relevant sections unless a prior booklet strongly indicates a section should remain.

### 9. Booklet content generator

Generate human-readable section content from the normalized package.

Important requirements:

- Do not fabricate benefits.
- Mark inferred values internally.
- Preserve source references.
- Prefer concise employee-facing language.
- Use official plan documents for plan details.
- Use employer application/prior guide for employer-specific eligibility and contribution language.

### 10. PDF renderer

The current renderer can remain, but the data input should shift from `company` to `BenefitsPackage` plus `BookletOutline`.

Required renderer improvements:

- Render actual plan attributes, not generic summaries.
- Support multiple medical plan options.
- Support flat-dollar and percentage contributions.
- Support configurable pay periods.
- Include all selected benefit modules.
- Avoid rendering empty sections.
- Produce stable output suitable for automated testing.

### 11. Quality checker

Before final completion, run automated checks:

- Required booklet sections exist.
- No unresolved blocking questions remain.
- Every important field has a source reference or explicit manual answer.
- Cost totals are arithmetically correct.
- Offered benefits match detected benefits.
- No placeholder text remains.
- PDF renders successfully.
- PDF has expected page count range.

## Current code changes needed

### Frontend/UI

No frontend UI work is required for the current iteration.

Rules:

- Do not build a chat UI yet.
- Do not spend time polishing existing tabs.
- Do not introduce new manual-first frontend workflows.
- Keep current frontend behavior unless a backend contract change requires a minimal compatibility update.
- Backend/live tests should drive the pipeline directly.

Known future frontend tasks:

- Chat thread UI.
- File attachment composer.
- Streamed progress display.
- Blocking-question answer controls.
- Final booklet preview/download.
- Confidence report viewer.

These are future tasks, not part of the backend-first implementation slice.

### `api/generate-booklet.ts`

Needed changes:

- Either replace or wrap this with a new pipeline endpoint.
- Stream structured stage events.
- Accept uploaded file IDs or a generation run ID, not just a prebuilt company object.
- Generate from `BenefitsPackage`.

### New `api/booklet-pipeline.ts`

Suggested endpoint for the autonomous pipeline.

Responsibilities:

- Create or resume a backend booklet/generation thread.
- Load uploaded files.
- Classify documents.
- Run extractors.
- Assemble package.
- Generate questions if blocked.
- Build outline.
- Render PDF.
- Save generation run state.
- Stream progress events.

### New backend thread/message API

Required backend operations:

- Create booklet thread.
- Add user message.
- Attach uploaded files or file IDs to a message/thread.
- Start generation run.
- Read generation run status.
- Read pipeline events.
- Read blocker questions.
- Submit user answer.
- Resume generation run.
- Read final PDF link.
- Read confidence report.

These operations can be implemented as API routes, server functions, or internal library calls first. They must be testable without a frontend UI.

### New thread/message persistence

Recommended collections or tables:

- `bookletThreads`
- `bookletMessages`
- `bookletGenerationRuns`

The backend thread/message model should support:

- User messages
- Agent messages
- File attachments
- Pipeline stage events
- Blocking questions
- User answers
- Generated booklet links
- Confidence reports

The backend thread should be the primary product surface for now. The same thread model should later support UI chat messages and email messages, so do not hard-code assumptions that every message originated inside the web app.

### `lib/booklet.ts`

Needed changes:

- Add a renderer entry point that accepts `BenefitsPackage`.
- Render parsed plan attributes.
- Replace `erPercent` logic with `ContributionRule`.
- Add support for flat monthly and flat per-pay contributions.
- Add section rendering from generated outline.

### `lib/plan-extractor.ts`

Needed changes:

- Keep existing plan extraction.
- Add stronger matching metadata for plan/rate matching.
- Ensure extracted attributes are easy to consume in booklet pages.

### New libraries

Recommended files:

- `lib/document-classifier.ts`
- `lib/employer-application-extractor.ts`
- `lib/rate-sheet-extractor.ts`
- `lib/prior-booklet-extractor.ts`
- `lib/benefits-package-assembler.ts`
- `lib/question-engine.ts`
- `lib/booklet-outline.ts`
- `lib/booklet-quality-checker.ts`
- `lib/source-map.ts`

## Live test requirements

Testing should steer toward live tests rather than isolated code tests.

This product succeeds or fails based on messy real files, agent behavior, streamed/persisted thread state, document extraction quality, and generated PDFs. Those cannot be validated well by mocks alone.

Default testing rule:

```txt
If a feature affects the booklet pipeline, it needs a live test.
```

Unit/code tests are still useful for deterministic internals, but they are supporting tests, not the main acceptance standard.

Use unit tests for:

- Pure cost calculations
- Schema validation
- Source-priority sorting
- Small parser helpers
- Formatting utilities
- Non-AI deterministic edge cases

Use live tests for:

- File upload/intake
- Document classification
- PDF text/OCR extraction
- Spreadsheet extraction
- AI extraction
- Benefits package assembly
- Conflict detection
- Chat blocker questions
- Booklet outline generation
- Booklet content generation
- PDF rendering
- End-to-end generation

Every relevant pipeline segment must have live coverage before it is considered complete. Add unit tests where they help, but do not substitute them for live tests.

Existing scripts:

```bash
npm test
npm run test:live
```

Add new live tests behind environment flags so normal CI can run quickly, while live validation can be run intentionally.

Suggested pattern:

```bash
RUN_LIVE_BOOKLET_PIPELINE_TESTS=1 npm run test:live
```

Live tests should use real representative files from `notion-call-transcripts/` when available:

- `Employer application.pdf`
- `2025 Benefit Guide.pdf`
- `Big Tows Benefit Booklet.pdf`
- Excellus rate spreadsheets
- Healthy NY renewal spreadsheet
- ER/EE cost spreadsheet

Do not rely only on mocked fixtures for the core pipeline. Mock tests are useful for fast iteration, but they do not prove the product works.

Acceptance should be based on live tests using real or realistic files and the actual agent pipeline.

## Required live test inventory

The test suite should grow into a broad inventory of required live cases. At minimum, it should include:

- [ ] Happy path: complete file set generates booklet without questions.
- [ ] Missing required information: agent asks a specific blocker question.
- [ ] Conflicting information: agent identifies conflict and asks or resolves with cited reasoning.
- [ ] Suspicious but non-blocking issue: agent continues and records warning.
- [ ] Multiple medical plan options.
- [ ] Single medical plan option.
- [ ] Medical plus dental.
- [ ] Medical plus dental plus vision.
- [ ] Employer has no dental.
- [ ] Employer has no vision.
- [ ] HSA offered.
- [ ] HRA offered.
- [ ] FSA offered.
- [ ] Life offered.
- [ ] STD offered.
- [ ] LTD offered.
- [ ] EAP offered.
- [ ] Voluntary/Aflac offered.
- [ ] Telemedicine offered.
- [ ] Percentage employer contribution.
- [ ] Flat monthly employer contribution.
- [ ] Flat per-pay employer contribution.
- [ ] Weekly payroll.
- [ ] Biweekly payroll.
- [ ] Semimonthly payroll.
- [ ] Monthly payroll.
- [ ] Different contribution by tier.
- [ ] Different contribution by employee class.
- [ ] Current rate sheet plus prior booklet.
- [ ] Employer application plus rate sheets.
- [ ] Prior guide plus plan PDFs.
- [ ] Image-based prior booklet requiring OCR.
- [ ] Text-based PDF extraction.
- [ ] Spreadsheet format variation across quarters.
- [ ] Flower City master-template reference.
- [ ] Tailored prior employer booklet reference.
- [ ] Unknown/unsupported file included in upload batch.
- [ ] Generation resumes after user answers a backend-thread question.
- [ ] Generated PDF passes text extraction sanity checks.
- [ ] Confidence report includes source references and warnings.

## Live test checklist

### File intake

- [ ] Live test creates a backend booklet thread.
- [ ] Live test sends a user message with multiple attachments.
- [ ] Live test uploads or loads multiple mixed file types in one run.
- [ ] Live test preserves filename, MIME type, hash, storage path, and company association.
- [ ] Live test rejects unsupported file types with a clear error.

### Document classification

- [ ] Live test classifies employer application PDF as `employer_application`.
- [ ] Live test classifies carrier spreadsheets as `carrier_rate_sheet`.
- [ ] Live test classifies prior benefit guide as `benefit_guide`.
- [ ] Live test classifies prior booklet as `prior_booklet`.
- [ ] Live test emits confidence and reasoning summary for each classification.
- [ ] Live test handles an unknown file without crashing the pipeline.

### PDF text and OCR extraction

- [ ] Live test extracts embedded text from text-based PDFs.
- [ ] Live test OCRs image-based PDFs when embedded text is missing.
- [ ] Live test records extraction method as `pdf_text` or `ocr`.
- [ ] Live test marks OCR-derived facts with lower confidence than embedded-text facts.

### Employer application extraction

- [ ] Live test extracts employer/group name.
- [ ] Live test extracts effective date or plan year when present.
- [ ] Live test extracts selected products/benefit lines when present.
- [ ] Live test extracts eligibility/waiting period when present.
- [ ] Live test extracts employee classes/subgroups when present.
- [ ] Live test extracts contribution information when present.
- [ ] Live test attaches source page/text references to all extracted facts.

### Carrier rate spreadsheet extraction

- [ ] Live test reads each provided Excellus/Healthy NY spreadsheet.
- [ ] Live test detects carrier, quarter/year, and market segment when present.
- [ ] Live test extracts plan names.
- [ ] Live test extracts tier premiums.
- [ ] Live test records source sheet and row for each rate.
- [ ] Live test handles workbook format differences across quarters.

### Plan document extraction

- [ ] Live test extracts plan identity.
- [ ] Live test extracts deductible and out-of-pocket maximums.
- [ ] Live test extracts common service costs.
- [ ] Live test extracts Rx tiers when present.
- [ ] Live test stores text pages and structured attributes.
- [ ] Live test validates extracted output against schema.

### Prior guide/booklet extraction

- [ ] Live test detects offered benefit sections.
- [ ] Live test extracts section order.
- [ ] Live test extracts contacts.
- [ ] Live test extracts eligibility language.
- [ ] Live test extracts plan names.
- [ ] Live test extracts style/template cues.
- [ ] Live test recognizes Flower City as the strongest master-template reference when included.
- [ ] Live test handles OCR-based prior booklet with reduced confidence.

### Benefits package assembly

- [ ] Live test assembles a complete `BenefitsPackage` from mixed uploaded files.
- [ ] Live test matches rate rows to plan documents.
- [ ] Live test detects offered benefits from prior guide/booklet/application.
- [ ] Live test resolves non-conflicting facts automatically.
- [ ] Live test preserves source references for generated package fields.
- [ ] Live test produces a confidence report.

### Conflict resolution and question engine

- [ ] Live test records blocking questions on the backend thread/run.
- [ ] Live test creates a blocking question when required data is missing.
- [ ] Live test creates a blocking question when two high-confidence sources conflict.
- [ ] Live test continues without blocking on low-impact missing data.
- [ ] Live test includes source references in each question.
- [ ] Live test resumes generation after a user answer is supplied through the backend.

### Contribution engine

- [ ] Live test calculates percentage employer contributions.
- [ ] Live test calculates flat monthly employer contributions.
- [ ] Live test calculates flat per-pay employer contributions.
- [ ] Live test supports weekly, biweekly, semimonthly, and monthly pay periods.
- [ ] Live test calculates employer annual, employee annual, and total annual premium.
- [ ] Live test supports per-tier contributions.

### Booklet outline generation

- [ ] Live test includes sections for detected offered benefits.
- [ ] Live test omits sections for benefits not offered.
- [ ] Live test includes HSA/HRA/FSA sections only when offered or strongly inferred.
- [ ] Live test follows prior booklet/guide section order when confidence is high.
- [ ] Live test produces no empty sections.

### Booklet content generation

- [ ] Live test renders actual extracted plan attributes.
- [ ] Live test renders multiple medical plan options.
- [ ] Live test renders costs using selected contribution rules.
- [ ] Live test includes eligibility and enrollment language.
- [ ] Live test includes contacts.
- [ ] Live test does not include placeholder text.
- [ ] Live test does not fabricate missing benefits.

### PDF rendering

- [ ] Live test renders a valid PDF.
- [ ] Live test verifies PDF metadata/page count.
- [ ] Live test extracts text back from the PDF and verifies expected sections.
- [ ] Live test verifies cost table values appear in the rendered PDF.
- [ ] Live test verifies generated PDF storage/download URL when using Firebase storage.

### End-to-end pipeline

- [ ] Live test runs from a backend thread/message with mixed files to generated booklet without manual setup.
- [ ] Live test streams or persists all required progress stages on the backend thread/run.
- [ ] Live test returns backend-thread questions instead of failing when blocked.
- [ ] Live test completes after answering required questions through the backend.
- [ ] Live test saves a generation run record.
- [ ] Live test saves final PDF.
- [ ] Live test saves confidence report.

## Required scenario tests

These are mandatory product-level tests. They should be implemented as live tests, not only unit tests, because they validate real backend agent behavior.

### Scenario 1: Missing required information

Purpose: verify that the agent detects a true blocker and asks the user for exactly what is missing.

Setup:

- Provide an incomplete file set.
- Omit one required piece of information needed for reliable booklet generation.

Examples:

- Missing employer contribution information.
- Missing plan year/effective date.
- Missing rate sheet for selected medical plans.
- Missing plan document for a rate row that appears in a spreadsheet.
- Missing eligibility/waiting-period information.

Expected behavior:

- [ ] Agent does not fail generically.
- [ ] Agent identifies the missing field.
- [ ] Agent explains why the field is required.
- [ ] Agent records a specific blocker question on the backend thread/run.
- [ ] Agent includes source context showing what it did find.
- [ ] Agent resumes generation after the user answers.
- [ ] Final confidence report marks the answered field as user-provided.

Example agent response:

```txt
I can generate most of the booklet, but I could not find the employer contribution rule for the medical plans in any uploaded file.

What should the employer contribution be for medical coverage?
```

### Scenario 2: Conflicting or suspicious information

Purpose: verify that the agent handles cases where all documents are present, but the details are off.

Setup:

- Provide a full file set.
- Include at least one conflicting or suspicious field across documents.

Examples:

- Employer application says waiting period is first of month after 30 days; prior booklet says first of month after 60 days.
- Rate spreadsheet has one premium value; prior guide has a different employee cost.
- Plan document says PCP copay is `$25`; prior booklet says `$30`.
- Employer application lists HSA contribution, but prior booklet omits HSA entirely.
- Plan name appears in the rate sheet but differs slightly from the plan PDF name.

Expected behavior:

- [ ] Agent detects the conflict.
- [ ] Agent does not silently choose a value when the conflict is material and unresolved by source priority.
- [ ] Agent cites the conflicting sources.
- [ ] Agent recommends a value when source priority supports one.
- [ ] Agent asks the user only if the conflict blocks reliable generation.
- [ ] Agent continues automatically if the conflict is non-blocking and records the assumption.
- [ ] Final confidence report includes the conflict and resolution.

Example agent response:

```txt
I found two different eligibility waiting periods:
- Employer application: first of month after 30 days
- Prior booklet: first of month after 60 days

The employer application appears more current, but this affects employee eligibility language. Should I use first of month after 30 days?
```

### Scenario 3: Complete booklet generation with multiple plan options

Purpose: verify that the generator can produce a real booklet when the employer offers multiple plan options.

Setup:

- Provide a complete file set with multiple medical plans.
- Include rates and plan documents for every selected plan.
- Include dental, vision, and at least one account or ancillary benefit where possible.

Expected behavior:

- [ ] Agent detects all offered benefit lines.
- [ ] Agent matches each plan document to the correct rate row.
- [ ] Agent generates a booklet with multiple medical options.
- [ ] Agent renders plan comparison content for all selected plans.
- [ ] Agent renders cost tables for all selected plans.
- [ ] Agent includes actual extracted plan attributes, not generic placeholders.
- [ ] Agent includes contribution calculations for each plan/tier.
- [ ] Agent includes contacts, eligibility, enrollment, and legal notices.
- [ ] Generated PDF text includes all selected plan names.
- [ ] Generated PDF has no placeholder text or empty sections.

### Scenario 4: Every supported benefit/option type

Purpose: verify coverage for every possible booklet section and option type.

The test suite should include at least one case for each benefit type:

- [ ] Medical
- [ ] Dental
- [ ] Vision
- [ ] Life
- [ ] STD
- [ ] LTD
- [ ] EAP
- [ ] Voluntary/Aflac
- [ ] Telemedicine
- [ ] HSA
- [ ] HRA
- [ ] FSA
- [ ] Contacts
- [ ] Eligibility
- [ ] Legal notices

The test suite should include at least one case for each plan/cost configuration:

- [ ] One medical plan
- [ ] Multiple medical plans
- [ ] Medical plus dental
- [ ] Medical plus dental plus vision
- [ ] Ancillary-only section inclusion
- [ ] HSA-eligible medical plan with HSA section
- [ ] HRA offered with employer contribution
- [ ] FSA offered without HSA conflict
- [ ] Percentage employer contribution
- [ ] Flat monthly employer contribution
- [ ] Flat per-pay employer contribution
- [ ] Weekly payroll
- [ ] Biweekly payroll
- [ ] Semimonthly payroll
- [ ] Monthly payroll
- [ ] Different contribution by tier
- [ ] Different contribution by employee class

Expected behavior:

- [ ] Every offered benefit type can render a booklet section.
- [ ] Benefits not offered are omitted.
- [ ] Each cost/contribution option calculates correctly.
- [ ] Each generated section has source-backed content.
- [ ] No unsupported option silently falls back to incorrect default behavior.

### Scenario 5: Flower City master-template reference

Purpose: verify that the agent uses the best available template reference.

Known product assumption:

Flower City is the best master-template reference from the provided materials. It should be used as the preferred source for broad booklet structure, section ordering, and complete benefit-section coverage when available.

Expected behavior:

- [ ] Agent identifies Flower City as a master-template style/source document.
- [ ] Agent uses Flower City for booklet structure when employer-specific documents do not provide a better tailored structure.
- [ ] Agent does not copy Flower City employer-specific facts into another employer's booklet.
- [ ] Agent uses employer-specific files for actual employer facts, plans, rates, eligibility, and contacts.
- [ ] Agent records Flower City as a template/style source, not as a factual source for another employer.
- [ ] Generated booklet follows Flower City's complete-section structure where appropriate.

### Scenario 6: Tailored prior booklet reference

Purpose: verify that a prior employer-specific booklet is used differently from a master template.

Setup:

- Provide a prior booklet for the same employer.
- Provide current rate/plan documents.

Expected behavior:

- [ ] Agent treats the prior booklet as employer-specific context.
- [ ] Agent reuses relevant employer language where still current.
- [ ] Agent updates plans, rates, and year-specific details from current documents.
- [ ] Agent does not preserve obsolete sections when current evidence shows the benefit is no longer offered.
- [ ] Agent records which content came from prior booklet context versus current source documents.

## Definition of done for the next major iteration

The next major iteration is complete when:

1. A backend client/test can start a booklet thread and attach or reference a mixed batch of files for one employer.
2. The system classifies the files automatically.
3. The system extracts employer setup, plan details, rates, prior booklet context, and contacts.
4. The system builds a normalized `BenefitsPackage`.
5. The system asks only specific blocker questions through backend thread state when necessary.
6. The system generates a booklet outline automatically.
7. The system renders a complete booklet PDF from the package.
8. The generated booklet includes actual plan attributes and cost calculations.
9. Every important generated field has a source reference, confidence score, or manual answer.
10. Live tests exist for every relevant segment listed above.

## Start checklist

Before implementation begins, complete this checklist once. The goal is to make sure the first build slice is concrete and testable.

### Inputs and fixtures

- [ ] Identify the first canonical live fixture company.
- [ ] Put all fixture files in a stable local folder or test fixture location.
- [ ] Include at least one employer application PDF.
- [ ] Include at least one carrier rate spreadsheet.
- [ ] Include at least one prior benefit guide or prior booklet.
- [ ] Include at least one plan PDF/SBC/SPD if available.
- [ ] Include the Flower City master-template reference if available.
- [ ] Document which files are current factual sources versus template/style references.
- [ ] Document any known expected missing fields in the fixture set.
- [ ] Document any known expected conflicts in the fixture set.

### First working slice scope

The first working slice should be intentionally narrow but end to end.

Required first slice:

- [ ] Test/script creates a booklet thread through the backend.
- [ ] Test/script attaches or references multiple files.
- [ ] System stores the files.
- [ ] System classifies the files.
- [ ] System extracts enough facts to identify employer, plan year, offered benefits, plans, and costs where present.
- [ ] System assembles a preliminary `BenefitsPackage`.
- [ ] System either asks a blocker question or proceeds.
- [ ] System generates a booklet outline.
- [ ] System renders a PDF.
- [ ] System stores the final PDF link and confidence report on the backend thread/run.

Do not build every extractor perfectly before proving this vertical slice.

### Data and persistence

- [ ] Decide where booklet threads are stored.
- [ ] Decide where backend thread messages/events are stored.
- [ ] Decide where uploaded files are stored.
- [ ] Decide where extracted facts are stored.
- [ ] Decide where generation runs are stored.
- [ ] Decide where generated PDFs are stored.
- [ ] Add source references to every extracted fact from the beginning.
- [ ] Add pipeline run IDs to all logs and generated artifacts.
- [ ] Preserve raw extraction outputs for debugging.

### Agent behavior

- [ ] Agent can continue autonomously when confidence is sufficient.
- [ ] Agent asks only blocker questions.
- [ ] Agent gives specific missing-field questions.
- [ ] Agent gives specific conflict questions.
- [ ] Agent cites source documents when asking questions.
- [ ] Agent can resume after the user answers through the backend.
- [ ] Agent records user answers as manual source facts.
- [ ] Agent produces a confidence report at the end.

### Rendering

- [ ] Renderer can generate from `BenefitsPackage`.
- [ ] Renderer supports at least medical plan options.
- [ ] Renderer supports cost tables.
- [ ] Renderer supports eligibility/enrollment language.
- [ ] Renderer supports contacts/legal notices.
- [ ] Renderer omits empty sections.
- [ ] Renderer produces extractable PDF text for test verification.

### Test readiness

- [ ] Add a live test command for the booklet pipeline.
- [ ] Add environment flags for live tests that call external services.
- [ ] Add fixture-path configuration for local live files.
- [ ] Add a live happy-path test.
- [ ] Add a live missing-info test.
- [ ] Add a live conflict test.
- [ ] Add a live generated-PDF sanity test.
- [ ] Require live tests to pass before marking the slice complete.

## Agent completion checklist

For each implementation pass, the coding agent should complete this checklist in one sweep before handing off.

### Scope check

- [ ] Confirm the change serves the backend-first files-in/booklet-out flow.
- [ ] Confirm the change does not introduce a manual-first workflow.
- [ ] Confirm the change does not depend on email integration.
- [ ] Confirm the change does not require new UI.

### Pipeline check

- [ ] Files can be attached or referenced from a backend thread.
- [ ] Files are persisted with stable IDs.
- [ ] Classification runs for every file.
- [ ] Extraction runs for every supported classified document.
- [ ] Unsupported files are reported without crashing.
- [ ] Extracted facts include source references.
- [ ] Benefits package assembly runs.
- [ ] Blocking questions are generated only when needed.
- [ ] Pipeline can resume from a user answer.
- [ ] Generation run state is saved.

### Booklet check

- [ ] Booklet outline is generated from the package.
- [ ] Rendered sections match offered benefits.
- [ ] Multiple plan options render when present.
- [ ] Cost calculations render correctly.
- [ ] Missing sections are omitted.
- [ ] No placeholder text appears.
- [ ] Final PDF is saved.
- [ ] Final PDF link is stored on the thread/run.
- [ ] Confidence report is stored on the thread/run.

### Source and confidence check

- [ ] Important generated fields have source references.
- [ ] User-provided answers are recorded as manual sources.
- [ ] Conflicts are recorded.
- [ ] Assumptions are recorded.
- [ ] Low-confidence OCR facts are marked lower confidence.
- [ ] Flower City is treated as template/style reference, not employer fact source.

### Live test check

- [ ] Relevant live tests were added or updated.
- [ ] Existing live tests still pass, or failures are documented with cause.
- [ ] At least one real-file fixture was used for changed extraction/generation behavior.
- [ ] Generated PDF was inspected by extracting text or equivalent automated verification.
- [ ] Unit tests were added only where useful for deterministic logic.

### Handoff check

- [ ] Summarize what works.
- [ ] Summarize what still falls back to questions.
- [ ] Summarize live tests run.
- [ ] Summarize known gaps.
- [ ] Link generated artifacts if produced.

## First acceptance gate

The first version is acceptable only when this command or equivalent live run proves the full loop:

```txt
Create backend thread -> attach fixture files -> agent processes -> agent asks required blockers if any -> answer through backend -> agent generates PDF -> PDF passes sanity checks
```

Minimum acceptance checks:

- [ ] The backend thread/run contains pipeline progress events.
- [ ] The agent does not require manual setup forms.
- [ ] The agent can identify missing required data.
- [ ] The agent can identify at least one conflict.
- [ ] The agent can generate a PDF from a complete fixture.
- [ ] The PDF contains employer name, plan year, eligibility, offered benefits, plan names, costs, contacts, and legal notices where source data exists.
- [ ] The final confidence report lists sources, warnings, assumptions, and user-provided answers.

## Implementation priority

Recommended build order:

1. Add booklet thread/message persistence.
2. Add backend operations for thread creation, messages, attachments, generation runs, questions, answers, and status.
3. Add `BenefitsPackage`, `ExtractedFact`, `ClassifiedDocument`, and `BookletGenerationRun` types.
4. Add the autonomous pipeline endpoint with streamed or persisted stage events.
5. Add the file classifier.
6. Add employer application extraction.
7. Add rate spreadsheet extraction.
8. Add prior guide/booklet extraction.
9. Add the benefits package assembler.
10. Add the question engine that records blocker questions on the backend thread/run.
11. Replace `erPercent` with contribution rules.
12. Update booklet rendering to consume `BenefitsPackage`.
13. Add live tests for each segment before treating the segment as complete.

## Non-goals for this iteration

Avoid spending time on these until the autonomous pipeline works:

- CRM dashboards
- Renewal reporting
- Carrier website automation
- Polished template marketplace
- Deep plan recommendation logic
- SPD generation
- Employer application autofill
- Email ingestion and outbound email replies
- Chat UI or other frontend UI work

Those are valuable later, but the immediate product should prove:

```txt
Call backend with files -> the app generates a usable benefits booklet.
```
