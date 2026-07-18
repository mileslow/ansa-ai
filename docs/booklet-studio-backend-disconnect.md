# Booklet Studio and Backend Generation: Current Disconnect

Last reviewed: July 17, 2026

## Executive summary

The `/booklet-studio` frontend and the new booklet backend currently describe two different products.

The frontend presents generation as six sequential source steps. Each step appears to upload, classify, extract, and immediately add pages to the booklet. In reality, those actions are simulated in the browser with timers and hardcoded Big Tows data.

The new backend accepts a mixed collection of files, classifies all of them, builds one normalized `BenefitsPackage`, resolves cross-document conflicts, asks any blocking questions, and only then creates a dynamic outline and final PDF. It does not currently generate the booklet one frontend tab at a time.

The most important integration decision is therefore:

> Keep the six steps as an input-collection interface, but make the backend run—not the tabs—the source of truth for processing, completion, missing information, pages, sources, and the final PDF.

## Primary disconnect

The frontend treats each source category as an independently completed generation unit. The backend treats every source as evidence in one global generation run.

This is more than a missing `fetch()` call. The state models are different:

| Concept | Booklet Studio today | Backend today |
| --- | --- | --- |
| Intake | Six ordered tabs | One thread with a mixed set of attached files |
| File handling | Buttons and drops trigger simulated processing | Files are decoded, hashed, stored, and classified |
| Processing | Five fixed timer stages per tab | Fourteen evidence and rendering pipeline stages |
| Facts | Hardcoded arrays | Extracted facts with field paths, confidence, and source references |
| Completion | Completed tabs divided by six | Run status, pipeline events, blockers, and quality checks |
| Missing information | One hardcoded HSA scenario | Dynamic blocker questions derived from the normalized package |
| Page creation | Static pages appear after selected tabs | Outline is selected after all evidence and blockers are resolved |
| Preview | CSS-rendered demo pages | Generated HTML and a real PDF |
| Result | Downloaded JSON prototype | Persisted PDF with a signed Storage URL |
| Persistence | React component state; lost on refresh | Firestore threads, messages, runs, facts, events, and Storage objects |

## How the Booklet Studio frontend is defined

The studio is implemented in [`src/BookletStudio.jsx`](../src/BookletStudio.jsx), with its static definitions in [`src/bookletStudioData.js`](../src/bookletStudioData.js).

### Frontend state

The component owns local state for:

- `phaseState`
- active phase
- selected preview page
- HSA answer
- company profile
- preview mode

A phase has an implicit local status of `idle`, `processing`, or `complete`. Tabs unlock when every previous tab is either processing or complete.

Completion is calculated as:

```js
Math.round((completed.size / phaseDefinitions.length) * 100)
```

That percentage does not use backend events, extracted-field coverage, blockers, quality checks, or PDF status.

### Simulated processing

`runPhase()` loops over five labels from `parsingStages` and waits between each stage. When the timer finishes, it copies fact counts and page mappings from static definitions.

No source is uploaded or parsed in this path. In particular:

- The company website button calls `runPhase()` but does not call `/api/company-profile`.
- The employer-document button is not connected to a file input.
- Other upload buttons do not read selected files.
- The drop handler ignores `event.dataTransfer.files`.
- The extracted facts come from `phaseDefinitions`, not a server response.

### Static pages and blockers

The preview uses a fixed `bookletPages` array. Pages become available when their hardcoded `phase` is marked complete.

The missing-information behavior is also local. Completing the official-documents phase always opens the same HSA blocker until a local `hsaAnswer` is set. This is a useful visual prototype, but it is not derived from source evidence.

The current HSA choices also do not match the backend question model. The frontend asks about contribution/section behavior, while the backend first asks whether the employer offers an HSA at all and may separately ask contribution questions by plan and coverage tier.

### Current download

The Draft button creates a JSON blob containing the local company profile, static page list, and local HSA answer. It does not request, open, or download the backend PDF.

## How the new backend is defined

The primary agent endpoint is [`api/booklet-pipeline.ts`](../api/booklet-pipeline.ts). Its shared orchestration lives in [`lib/booklet-pipeline.ts`](../lib/booklet-pipeline.ts), and the contract types live in [`lib/booklet-types.ts`](../lib/booklet-types.ts).

### API actions

`/api/booklet-pipeline` currently exposes five actions:

1. `create_thread`
   - Creates a persistent company thread.
   - Accepts new base64-encoded files or existing file IDs.
   - Stores an optional initial user message.
2. `add_message`
   - Adds more instructions and files to an existing thread.
3. `start`
   - Creates a generation run and executes the full pipeline.
   - Returns HTTP `202` when blocked and `200` when complete.
4. `answer`
   - Accepts one blocker answer or a batch keyed by field path.
   - Reruns the pipeline with those manual answers.
5. `status`
   - Returns a persisted run and its ordered event history.

Uploads support PDF, XLSX, XLS, CSV, EML, and plain text. Each file is size-checked, hashed, persisted to Cloud Storage, and represented by an `UploadedFile` record.

### Pipeline behavior

The backend performs the following global flow:

1. Load all attached files.
2. Classify every document.
3. Extract employer applications and email exports.
4. Parse rate and contribution workbooks.
5. Parse medical plan documents.
6. Extract prior booklets and guides.
7. Convert evidence into source-linked facts.
8. Assemble one normalized `BenefitsPackage`.
9. Match selected plans to rate rows.
10. Detect offered benefits.
11. Resolve source-priority conflicts.
12. Return blocker questions when required fields are missing or ambiguous.
13. Build a conditional booklet outline.
14. Generate grounded employee-facing copy when the model is available.
15. Render and preflight HTML.
16. Render the PDF and run post-render quality checks.
17. Save the PDF and return a signed URL.

The normalized `BenefitsPackage` is the important backend boundary. It contains employer facts, plan year, eligibility, offerings, plans, rates, contributions, contacts, accounts, booklet style, a source map, and a confidence report.

### Dynamic missing-information behavior

Blockers are created in [`lib/question-engine.ts`](../lib/question-engine.ts). They are not limited to HSA information. Current blockers include:

- Missing employer name
- Missing plan-year start or end
- Missing eligibility waiting period
- Missing selected plans
- Unknown HSA offering status
- Unmatched plan and rate rows
- Missing employer contribution rules by tier
- Unresolved conflicts between similarly authoritative sources

Every blocker includes a field path, question, reason, possible options, source references, and an optional recommended answer.

### Persistence

[`lib/booklet-thread-store.ts`](../lib/booklet-thread-store.ts) persists:

- `bookletThreads`
- `bookletMessages`
- `bookletUploadedFiles`
- `bookletGenerationRuns`
- extracted facts
- ordered pipeline-event subcollections
- source documents and generated PDFs in Cloud Storage

This persistent model is entirely absent from the Booklet Studio component today.

## The older generator path

There is also an older endpoint at [`api/generate-booklet.ts`](../api/generate-booklet.ts), used by the existing company screen in [`src/main.jsx`](../src/main.jsx).

This path expects the frontend to supply an already assembled `company` object. It validates a small set of required fields, emits newline-delimited page/rendering events, generates a PDF, and sends the PDF back as base64.

This older path is connected to a frontend, but it bypasses the new mixed-file intake, classification, source maps, confidence report, dynamic blocker questions, and thread/run model. It should not become the Booklet Studio integration target.

## Website enrichment is a separate path

`/api/company-profile` can currently research a public company website and return a profile. The Booklet Studio website field does not call it, and `/api/booklet-pipeline` does not accept a URL as an evidence source.

To support the interface as designed, one of these contracts must be made explicit:

1. Call `/api/company-profile` first, display the result for review, and submit accepted fields as manual answers/evidence to the booklet thread; or
2. Extend `/api/booklet-pipeline` so a website URL is a first-class source with its own provenance and confidence.

The second approach is cleaner long-term because document and website evidence can then participate in one conflict-resolution model.

## Event-streaming mismatch

The UI visually streams progress and pages, but the new pipeline endpoint does not currently stream its response.

`start` creates a run and then waits for the entire pipeline to become blocked or complete before returning the run ID. Although events are persisted and `status` can read them, the browser cannot begin polling that run during the original request because it does not know the run ID yet.

To make the studio animations truthful, the backend should do one of the following:

- Return `202` with the run ID immediately and process the run as a durable background job; or
- Stream pipeline events over NDJSON or Server-Sent Events while also persisting them.

The durable-job option is the better production model because current runs can include multiple model calls, document parsing, Chromium rendering, and Storage writes.

## Recommended integration model

The six tabs should remain a friendly collection and review experience, but they should stop owning generation truth.

### Frontend responsibilities

- Collect website, files, and user instructions.
- Show which inputs have been supplied.
- Upload files through `create_thread` and `add_message`.
- Start a backend run when the minimum input set exists.
- Render progress from backend `PipelineEvent` records.
- Render facts and source evidence from `benefitsPackageSnapshot`, `sourceMap`, and `confidenceReport`.
- Render missing-information cards from `run.questions`.
- Submit answers using the exact backend `fieldPath`.
- Render page navigation from `bookletOutline`, not `bookletPages`.
- Open/download the backend `pdfUrl` when complete.
- Restore an existing thread/run after refresh.

### Backend responsibilities

- Own document classification and source category assignment.
- Own extracted facts, confidence, conflicts, and source priority.
- Own the definition of blockers and completion.
- Own outline selection and page/section availability.
- Own the final content, quality checks, PDF, and persisted result.
- Expose a streamable or asynchronously pollable run lifecycle.

### Mapping the current interface to backend state

| Existing UI area | Backend source of truth |
| --- | --- |
| Employer | Classified employer applications, email exports, accepted website/manual evidence |
| Rates | Classified carrier rate sheets and renewal spreadsheets |
| Plans | SBC, SPD, and plan-summary classifications and extractions |
| Template | Prior booklet/benefit-guide extraction and `bookletStyle` |
| Census | Census classification and future enrollment normalization |
| Notes | Thread messages and manual answers |
| Progress | Pipeline events plus blocker/quality status |
| Checks | Confidence report, conflicts, warnings, and quality report |
| Sources | Extracted facts and `sourceMap` |
| Pages | Dynamic `bookletOutline` and final PDF |

## Recommended implementation sequence

1. Add a typed Booklet Studio API client for `create_thread`, `add_message`, `start`, `answer`, and `status`.
2. Replace visual upload buttons with real multi-file inputs and drag/drop handling.
3. Persist `threadId` and `runId` in route state or the URL so refreshes recover.
4. Make backend start asynchronous or stream its events.
5. Replace the five simulated stages with mapped backend pipeline events.
6. Replace static fact cards with normalized extracted facts and source references.
7. Replace the fixed HSA blocker with backend-generated blocker cards.
8. Replace static completion with run-derived completion that accounts for blockers and QA.
9. Replace static pages with the backend outline and final PDF preview.
10. Integrate website enrichment into the same evidence contract.
11. Remove the prototype JSON download once the signed PDF result is connected.
12. Add authentication and tenant ownership before processing sensitive production documents.

## Definition of connected

Booklet Studio should be considered connected only when all of the following are true:

- A selected or dropped file is actually persisted and receives a backend file ID.
- Progress labels come from real pipeline events.
- Displayed facts include real source references.
- Missing-information cards come from `run.questions`.
- Answers are sent back by field path and resume the same run.
- Completion reflects blockers, generation, and quality checks—not tab count.
- The page list is derived from the generated outline.
- The final action opens or downloads the backend-generated PDF.
- Reloading the route restores the thread, run, questions, progress, and result.

Until then, `/booklet-studio` should be treated as a high-fidelity interaction prototype rather than the live booklet-generation product.
