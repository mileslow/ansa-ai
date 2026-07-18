# Source-docs bucket audit and corrections

Date: 2026-07-17

## Outcome

Every one of the original 125 primary artifacts received a content-based audit.
The files were checked by intrinsic document type and source role rather than
filename or intended downstream use. Confirmed mismatches were rehomed, and 25
high-value sources were added to cover missing authority and data shapes.

Current primary corpus:

- 149 unique primary artifacts;
- 48 artifact-bearing buckets;
- 131 PDFs plus XLS, XLSX, CSV, TXT, EDI, DOCX, and ZIP inputs;
- a README in every artifact-bearing bucket;
- 88 verification artifacts excluded from primary sampling;
- one exact duplicate binary archived outside primary sampling;
- six intentionally empty leaves whose gaps remain explicit.

## Structural corrections applied

### Benefit sources

- Renamed phase 03 from `official-plan-documents` to
  `benefit-source-documents`. Benefit sections legitimately receive contracts,
  official summaries, forms, notices, program guides, and FAQs, but their exact
  source roles must be scored separately.
- Split `medical-and-prescription` into `medical-insurance` and
  `prescription-and-pharmacy`. The CVS formulary no longer counts as a health
  plan.
- Added a fifth real medical plan: the University of Rochester 2026 private-
  employer PPO SBC.
- Moved the combined Duke STD/LTD certificate to `combined-disability` so one
  binary can feed both sections.
- Moved the 399-page JPMC combined guide/SPD/plan document to
  `package-wide-plan-documents`.
- Added precise subleaves for governing certificates, dental companion
  schedules, prescription SPDs, member/claims guides, and formularies.

### Rates, enrollment, and census

- Distributed the mixed rate folder into carrier rates, employer
  contributions, and employee-cost/payroll inputs.
- Separated interface specifications from actual exports. Five layout/
  companion-guide sources are now under
  `benefit-admin-and-payroll-interface-specifications`.
- Kept only member-level data samples in `current-enrollment-exports`.
- Moved aggregate Medicare/Medicaid statistics into public reference data so
  they cannot populate employer elections.
- Separated raw employee censuses, blank tier-reporting templates, and completed
  tier-count analyses.
- Populated previously empty proposal and renewal buckets with completed public
  employer artifacts.

### Booklets, references, and instructions

- Reclassified five completed employer guides as style references rather than
  master templates.
- Replaced the intrinsic `same-employer-prior` label with scenario fixtures and
  added a real Seminole County 2025/2026 same-employer pair.
- Split authoritative references, educational references, and employer
  collateral. None is labeled pre-approved booklet language.
- Renamed blank client-decision artifacts as decision-form templates.
- Reclassified carrier/vendor checklists and implementation forms as
  operational materials, then added three actual broker/general-agency-authored
  checklists.
- Added a real Summary of Material Modifications under overrides/corrections.
- Added an editable federal SBC component template without misrepresenting it
  as a full multi-benefit booklet template.
- Quarantined the Adobe guide under `restricted-use` because every page is
  marked confidential.

### Deduplication and safety

- Kept the HSA copy of IRS Publication 969 as the canonical evaluation artifact.
  The byte-identical reference-language copy was moved to
  `_provenance-catalogs/duplicate-binaries` and excluded from sampling.
- Preserved original scrape catalogs for split categories under
  `_provenance-catalogs`.
- Flagged macro-enabled rate packages, large ZIP expansion, PDF JavaScript,
  blank sensitive forms, historical sources, synthetic member records, and
  employer-specific leakage risks in the audit reports.

## Valuable additions

### Medical replacement

- University of Rochester 2026 employer PPO SBC.

### Eight benefit-authority additions

- Western Dental DHMO companion Schedule of Benefits;
- Plexus/Unum basic life and AD&D certificate;
- Caltech/Unum STD certificate;
- Middlebury/Unum employer-paid LTD certificate;
- University of Missouri/MetLife Core and Buy-Up LTD SPD/certificate;
- Washington PEBB Davis Vision certificate;
- Kentucky KEHP prescription-drug SPD; and
- New Jersey SHBP/SEHBP prescription member guidebook.

### Eight rate/enrollment additions

- two completed employer proposals;
- two renewal-rate/contribution documents;
- two synthetic employee-level X12 834 export shapes; and
- two completed tier-count time-series reports.

### Eight booklet/instruction additions

- editable DOL SBC component template;
- Seminole County 2025 prior guide paired with its 2026 guide;
- three broker/general-agency instruction checklists;
- one completed Summary of Material Modifications;
- current CMS Part D guidance; and
- DOL No Surprises Act model-notice DOCX.

## Remaining honest gaps

- A reusable full benefits-booklet template with explicit adaptation rights.
- Safe completed employer decisions, approval/sign-off records, and broker/
  client email or override threads. These should be controlled synthetic
  fixtures or authorized redacted client records, not public personal data.
- A populated first-party CSV/XLSX benefit-admin export that is demonstrably
  synthetic or de-identified. The safe additions are currently X12 834 shapes.
- Additional employer branding, contacts/support, email-export, carrier/vendor
  directory, and explicit classifier-edge fixtures.
- Production-current legal review remains necessary even for official model
  resources; templates with placeholders or stale OMB dates are not ready for
  participant output merely because they are official.

## Verification result

- All 131 primary PDFs open successfully with `pdfinfo`.
- All expected ZIP/OOXML artifacts have the correct container signature.
- Every primary artifact-bearing directory has a README.
- No duplicate hash remains in the primary corpus.
- The Healthfirst PDF is a valid parser edge case: it contains leading
  whitespace before its `%PDF` marker but opens and extracts normally.
- The deterministic suite passes: 16 test files passed, 5 skipped; 199 tests
  passed, 84 skipped.

## Detailed reports

- `docs/source-docs-audit-setup-rates-enrollment.md`
- `docs/source-docs-audit-benefit-sections.md`
- `docs/source-docs-audit-booklets-instructions.md`
- `docs/source-docs-valuable-rate-enrollment-additions.md`
- `docs/source-docs-valuable-benefit-additions.md`
- `docs/source-docs-valuable-booklet-instruction-additions.md`
