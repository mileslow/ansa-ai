# ansa

Benefit guide generator — one structure file → HTML → PDF.

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
verification is 183 deterministic tests passing, 82 paid/live tests gated, a passing production
build, and a passing backend TypeScript check.

The booklet pipeline requires Firebase authentication and enforces owner IDs on
threads, uploads, runs, answers, and status reads. Booklet inputs and generated
PDFs deny direct client Storage access; the authenticated API issues a
short-lived signed PDF URL. Detailed Life/AD&D, STD, LTD, voluntary/Aflac, HSA,
HRA, and FSA generation remains incomplete; ancillary sections can be present
without full source-backed policy detail.

The `ansa-booklet-backend` Cloud Run service is deployed in `flux-ebfb0`. A
live backend run generated and independently verified a corrected 12-page PDF
using 26 payroll deductions. The Vercel frontend has not been rebuilt since
`VITE_BACKEND_API_URL` was added, so the current production frontend still uses
its previous Vercel-function architecture. Deployment work is currently paused.

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
