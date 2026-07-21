# ansa

Benefit guide generator — one structure file → HTML → PDF.

## Purpose of the benefits booklet generator

The generator is used after a company has received and supplied the information
required to describe its benefits, including the applicable employer, plan,
rate, contribution, and enrollment information. It turns those source materials
into a concise, employee-facing benefits booklet.

The booklet is a summary. It is not intended to reproduce 100% of the
information contained in the SBCs, SPDs, certificates, Evidence of Coverage
documents, or other governing plan materials, and it does not replace those
documents.

Flower City is the reference for the intended breadth of the finished booklet:
the generator should apply the full relevant set of employer benefits and
produce a complete collection of useful summary sections at a similar level of
detail. It must use the current company's source-backed facts and omit benefits
that the company does not offer.

The generator is not a plan-comparison or plan-shopping tool. Each booklet
summarizes one finalized benefits package for one defined employee or
participant population. Competing packages or plans intended for different
populations must not be placed in one booklet for comparison. For example, a
company offering UHC coverage to active employees and separate Medicare
coverage to retirees should receive two separate booklets. Multiple plan
options may appear together only when they are finalized offerings for the same
booklet audience.

Source documents are evidence, not a checklist of document titles that must all
be present. The current generator asks for enough authoritative, source-backed
facts to write each summary section; it does not separately require redundant
SBCs, SPDs, Evidence of Coverage documents, carrier guides, formularies, or
duplicate versions when the necessary facts are already supported. Uploaded
source PDFs are not appended in full to the generated booklet.

Flower City has no standalone HSA or short-term disability section. HSA and STD
remain supported for other employers, but each section is included only when
the employer explicitly offers that benefit. An HSA-qualified medical plan does
not by itself establish an employer HSA offering, and missing HSA or STD
materials do not block a booklet when the corresponding benefit is not offered.

## Remaining product work

At the product-definition level, the remaining work is concentrated in two
areas: comprehensive generation testing and a simpler, benefit-organized source
upload experience.

### 1. Comprehensive generation testing

The generation pipeline must be exercised with realistic combinations of
employers, benefits, source documents, rates, and missing information. Testing
should prove that the system consistently produces a concise, source-backed
employee booklet with Flower City-level breadth without requiring or reproducing
every governing source document.

The test matrix should cover:

- medical-only packages and packages containing several benefit types;
- medical, dental, vision, Life/AD&D, LTD, HRA, FSA, telemedicine, EAP, and
  voluntary-benefit combinations represented by Flower City;
- HSA and STD when explicitly offered, and their omission when not offered;
- different supported source-document types and file formats;
- complete inputs, partially complete inputs, missing required facts, and
  conflicting sources;
- rates with different coverage tiers, contribution methods, and payroll
  schedules;
- plan documents with and without separate rate files;
- separate booklets for different participant populations or finalized benefit
  packages;
- blocker questions, user-supplied answers, resumed runs, and corrected source
  uploads;
- final section selection, employee costs, source provenance, placeholder
  rejection, PDF structure, and readable output.

Testing is complete when the same input package produces a stable booklet,
missing required facts produce specific actionable questions, unsupported facts
are never invented, benefits that are not offered are omitted, and every
included summary section can be traced to a source or confirmed answer.

### 2. Benefit-organized plan and rate uploads

The current Plans and Rates steps behave too much like unorganized document
drop zones. The frontend should make it immediately clear which benefit a file
belongs to and whether the user is supplying plan information or cost
information.

Both steps should use the same benefit organization:

- Medical
- Dental
- Vision
- Life and AD&D
- Short-term disability
- Long-term disability
- HSA
- HRA
- FSA
- Telemedicine
- Employee assistance program
- Voluntary benefits

The Plans step should accept the source documents that describe coverage, such
as SBCs, SPDs, plan summaries, certificates, Evidence of Coverage documents,
and carrier materials. The Rates step should accept premiums, employer
contributions, employee deductions, coverage-tier rates, and payroll schedules.

The interface should remain simple:

1. Choose a benefit.
2. Add one or more plan or rate files for that benefit.
3. Show the files, processing status, and extracted plan or rate identity in the
   selected benefit area.
4. Show only the missing information or conflicts that require a user decision.

Files may still be classified automatically, but the result should be presented
inside the appropriate benefit area rather than as one undifferentiated upload
list. A user should be able to see at a glance which benefits have plan
information, which have rates, and which still need attention.

## File

`2025-benefit-guide-structure.txt` — single master document containing:

1. **BROKER_CONFIG** — swap phones, emails, employer names, dates per client
2. **PAGE STRUCTURE** — all 19 pages with layout, copy, and plan tables
3. **Agent instructions** — how to generate print-ready HTML

An agent reads this file, replaces `[BROKER:key]` tokens from the config block,
and outputs HTML for PDF conversion in seconds.

## Product design system

Ansa uses a restrained workspace interface inspired by Attio's information
hierarchy and Clerk's component polish. The product should feel quiet, precise,
lightweight, and consistent. It is not a colorful dashboard or a collection of
individually styled cards.

The canonical design layers are:

- `src/design-system.css` — application shell and reusable component behavior.
- `src/clean-pass.css` — canonical tokens, typography scale, final visual rules,
  and intentional overrides. It is imported last and is the source of truth.
- `src/inline.css` — legacy and feature-specific layout. Do not add new global
  design decisions here.

### Tokens

Always use the variables in `src/clean-pass.css`. If a needed value does not
exist, add a reusable token before using the value in a component.

| Category | Tokens / values |
| --- | --- |
| Brand | `--accent: #0B5FFF`, `--accent-strong: #0047CC` |
| Supporting blue | `#8EB3FF`, only for secondary chart series |
| Soft blue | `--accent-soft`, `#EEF4FF`, and transparent `#0B5FFF` borders |
| Text | `--ink`, `--muted`, `--subtle` |
| Type sizes | `--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`, `--text-2xl` |
| Spacing | `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-5`, `--space-6`, `--space-8` |
| Controls | `--control-sm`, `--control` |
| Corners | `--radius-sm`, `--radius-md`, `--radius-lg` |
| Surfaces | `--canvas`, `--surface`, `--surface-selected` |
| Structure | `--border`, `--border-strong`, `--shadow-sm` |

### Typography

- Use Inter through `--font-sans` everywhere in the application UI.
- Page titles use `--text-2xl`; section titles use `--text-lg`; numeric summary
  values use `--text-xl`; normal controls and body copy use `--text-sm`; labels
  and table copy use `--text-xs`.
- Use `--weight-semibold` for headings, `--weight-medium` for controls, and
  `--weight-normal` for supporting copy.
- Keep headings short. Do not repeat the company name, section name, or editing
  instructions in adjacent elements.

### Color

- `#0B5FFF` is the only product accent. Use it for primary actions, active
  navigation indicators, selected controls, focus states, and the current chart
  series.
- Use `#0047CC` for hover/pressed accent states.
- Use `#8EB3FF` only when a second blue is required to distinguish comparison
  data.
- Most UI must remain neutral: dark text, warm off-white canvas, translucent
  white surfaces, and hairline neutral borders.
- Semantic red, amber, and green are allowed only for real destructive, warning,
  and success states. They are never decorative.

### Glass surfaces

- Glass is created with translucent white, `backdrop-filter: blur(...)`, a
  hairline border, and a restrained shadow.
- Use glass for the primary workspace, dialogs, comparison panels, and important
  content surfaces—not for every nested element.
- Nested content should normally be separated by spacing or a divider instead of
  another floating card.
- Glass must remain readable when blur is unsupported. Always provide a usable
  translucent or solid background.

### Buttons and controls

- All standard controls are `--control` high; compact controls use
  `--control-sm`.
- Use `.primary` or `.companyAction` for the single dominant action in a region.
  Primary actions use `#0B5FFF`; hover uses `#0047CC`.
- Use `.outline` for secondary actions. Low-priority actions should be quiet
  icon or text buttons with the same height, radius, and focus treatment.
- Every interactive control must have hover, focus-visible, active, disabled,
  and loading behavior where relevant.
- Icons use Lucide, inherit the control color, and must not introduce a separate
  decorative color.
- Icons inside blue or soft-blue controls/surfaces must never be gray. They
  should inherit white from primary blue buttons or use `--accent-strong` on
  soft-blue backgrounds.
- Do not place two visually dominant primary buttons in the same panel.

### Highlighting and selection

- Hover uses a slight increase in white surface opacity. It must not move or
  resize the element.
- Active navigation uses the blue indicator and otherwise stays neutral.
- Selected tabs and year controls use a soft blue surface, blue border, and dark
  readable text.
- Editable numeric cells use the soft blue input treatment. Focus uses a
  `#0B5FFF` border and transparent blue ring.
- Comparison charts use `#0B5FFF` for the current series and `#8EB3FF` for the
  earlier series. Labels render as normal text without blend modes.

### Layout and hierarchy

- Preserve the persistent left workspace rail and responsive mobile header.
- Prefer one page title, one contextual subtitle, one navigation row, and one
  active work surface.
- Company overview data must be compact and derived from the selected company.
  Optional values are omitted instead of filled with sample content.
- Year-over-year costs use year tabs for editing one year at a time and a shared
  comparison chart for cross-year context.
- Tables may scroll horizontally but the page itself must not overflow.

## Absolutely not allowed

These rules are hard constraints, not suggestions:

- **No gradients anywhere.** This includes backgrounds, buttons, charts,
  skeletons, decorative effects, and PDF-preview placeholders.
- **No accent colors other than the approved blue scale.** Do not introduce
  coral, orange, teal, purple, or green for branding, categories, benefit types,
  icons, or selected states.
- **No arbitrary font sizes, spacing, radii, or control heights.** Use the
  documented tokens. Do not add values such as `13px`, `18px`, or a new radius
  directly to a feature component.
- **No one-off button styling.** New actions must use an existing button variant
  or extend the shared component rules.
- **No layout-shifting interactions.** Hover and selection must never change
  padding, dimensions, position, or cause surrounding content to move.
- **No colored shadows, glow effects, mix-blend modes, or glassmorphism noise.**
  Shadows are neutral and subtle; text must use normal blending.
- **No card-inside-card stacks.** Do not wrap every subsection in another
  bordered, rounded, elevated surface.
- **No decorative pills.** Pills are reserved for statuses, counts, and compact
  filters with real meaning.
- **No color-coded benefit icons.** Medical, dental, vision, and company icons
  use the same neutral icon treatment.
- **No hardcoded company content or customer-specific fallback data.** Never use
  another company's description, URL, phone, email, location, founding year, or
  plan values as defaults. Missing optional data is omitted or shown as an
  explicit empty state.
- **No duplicated labels or headings.** Do not repeat a page title as a card
  title, restate obvious instructions, or add badges such as “Editable input”
  when the input styling already communicates editability.
- **No global visual rules in feature JSX or legacy CSS.** Visual decisions go
  through tokens and shared component selectors.
- **No inaccessible interaction.** Never remove focus visibility, rely on color
  alone, create icon-only actions without accessible labels, or use contrast
  below WCAG AA for body text and controls.

## Review checklist

Before merging UI changes:

1. Confirm every value uses an existing token or justified new shared token.
2. Search the CSS for `gradient`, unapproved color literals, `mix-blend-mode`,
   and new arbitrary pixel values.
3. Verify hover, keyboard focus, active, disabled, loading, and empty states.
4. Check desktop, collapsed-sidebar, and mobile layouts.
5. Confirm optional company data is not replaced by sample data.
6. Run `npm run build` and resolve all errors before handoff.

## Backend booklet generator status

As of July 17, 2026, the backend-first booklet flow is a connected MVP. It can
create a thread, accept mixed files, classify and extract them, assemble a
source-aware benefits package, ask blocker questions, resume from answers,
stream and persist modular HTML pages as their sections become ready, compose
those pages into a PDF, and persist the run and output. The current local
verification includes the deterministic suite, gated paid/live tests, a
production build, backend TypeScript checks, and rendered HSA and STD PDFs from
real public source documents.

The implementation is not yet ready for unrestricted use with sensitive real
employer data. The booklet pipeline requires Firebase authentication and enforces owner IDs on
threads, uploads, runs, answers, and status reads. Booklet inputs and generated
PDFs deny direct client Storage access; the authenticated API issues a
short-lived signed PDF URL. Detailed Life/AD&D, STD, LTD, voluntary/Aflac, HSA,
HRA, and FSA generation remains incomplete; ancillary sections can be present
without full source-backed policy detail. The grounded content agent covers HSA
and STD, and HSA-qualified medical plans require separate employer-offering
evidence or a blocker answer.

The authenticated `start` action accepts a `generationMode`. The default,
`registry_strict`, enforces the exhaustive formal-plan registry. Use
`employee_booklet` for a conservative source-backed summary when the supplied
package is suitable for an employee guide but does not contain every governing
policy field. This is the mode used by Booklet Studio and the email booklet
workflow. The selected mode is stored on the run and reused when blocker answers
resume it.
The `start` action also accepts a bounded `initialAnswers` object for known
employer selections or other accountable manual facts that should be applied
before the first run; these values are persisted on the run and recorded in the
thread audit trail.
Completed runs normally return a short-lived signed PDF URL. Environments whose
application-default credentials cannot sign URLs can retrieve the same owned
artifact through the authenticated `download` action instead.

The `ansa-booklet-backend` Cloud Run service is deployed in `flux-ebfb0`. A
live backend run generated and independently verified a corrected 12-page PDF
using 26 payroll deductions. The Vercel frontend has not been rebuilt since
`VITE_BACKEND_API_URL` was added, so the current production frontend still uses
its previous Vercel-function architecture. The current HSA/STD content and
question-engine fixes are local-only. Deployment work is currently paused.

The canonical, exhaustive implementation and verification record is
[`BENEFITS_BOOKLET_GENERATOR_IMPLEMENTATION_REPORT.md`](BENEFITS_BOOKLET_GENERATOR_IMPLEMENTATION_REPORT.md).

The detailed and authoritative gap list is maintained in
[`docs/booklet-generation-issues.md`](docs/booklet-generation-issues.md).
Do not treat a section being renderable as proof that its extraction and
source-completeness requirements are finished.

## Medical plan parser

The complete field and provenance inventory is documented in
[`docs/medical-plan-extraction.md`](docs/medical-plan-extraction.md).

Uploaded PDFs are stored at
`benefitsCompanies/{companyId}/plans/{planId}/{fileName}` in Firebase Storage.
The Firestore record lives at
`benefitsCompanies/{companyId}/plans/{planId}`. The parser writes `parsingState`,
`parsingPct`, and partial `attributes` to that record. Page-level source text is
kept in the `textPages` subcollection so long text does not consume the plan
document's 1 MiB Firestore limit.

The deployed `api/parse-plan.ts` function requires:

- `OPENAI_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `FIREBASE_PROJECT_ID` or `VITE_FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET` or `VITE_FIREBASE_STORAGE_BUCKET`

`FIREBASE_SERVICE_ACCOUNT_JSON` is the complete service-account JSON encoded as
a single environment-variable value. Never expose it through a `VITE_` variable.

Run deterministic tests with `npm test`. The live suite is opt-in because it
makes paid API calls:

```bash
RUN_LIVE_PLAN_TESTS=1 npm run test:live
```
