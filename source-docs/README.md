# Benefits booklet source-document corpus

This directory contains public, representative source documents that can be
used to develop and live-test the benefits booklet intake pipeline.

The top-level numbered folders mirror the guided frontend intake phases. Their
subfolders represent an artifact's primary source type or benefit section. A
source can support several booklet sections, but it is stored once according
to its intrinsic primary role; secondary roles belong in manifest metadata and
scenario recipes rather than duplicate or misleading folders.

## Corpus standard

Each populated evaluation category should target:

- five meaningfully different examples;
- original downloaded files when a stable public download is available;
- a category `README.md` recording title, organization, jurisdiction, plan or
  program variation, original URL, retrieval date, and verification result;
- no private employee data, credentials, or access-controlled material;
- descriptive filenames prefixed `01_` through `05_`.

Content-based auditing takes precedence over the numeric target. A misclassified
file must be moved even when that leaves a category short; the category README
must state the gap until a genuinely different, correctly typed replacement is
found. Companion files may also make one plan example a multi-file bundle.

Official government, carrier, employer, administrator, and educational sources
are preferred. A public blank form or clearly identified sample/template is used
when real completed documents would expose personal or employer-confidential
information.

## Frontend-phase hierarchy

```text
source-docs/
├── 01_employer-setup/
│   ├── employer-and-group-information/
│   ├── eligibility-and-enrollment/
│   ├── contacts-and-support/
│   └── branding-and-company-content/
├── 02_plan-and-rate-source/
│   ├── carrier-rate-sheets/
│   ├── renewal-rates/
│   ├── employer-contributions/
│   ├── employee-cost-and-payroll/
│   └── quotes-and-proposals/
├── 03_benefit-source-documents/
│   ├── medical-insurance/
│   ├── prescription-and-pharmacy/
│   ├── dental/
│   ├── vision/
│   ├── hsa/
│   ├── hra/
│   ├── fsa/
│   ├── life-and-add/
│   ├── short-term-disability/
│   ├── long-term-disability/
│   ├── voluntary-and-aflac/
│   ├── eap/
│   ├── telemedicine/
│   ├── combined-disability/
│   └── package-wide-plan-documents/
├── 04_prior-booklet-or-template/
│   ├── completed-employer-guides/
│   │   ├── style-references/
│   │   └── prior-booklet-scenario-fixtures/
│   ├── reusable-booklet-templates/
│   ├── booklet-content-reference-materials/
│   └── legal-and-required-notices/
├── 05_census-and-enrollment/
│   ├── employee-census/
│   ├── current-enrollment-exports/
│   ├── tier-count-reports-and-analyses/
│   ├── tier-count-reporting-templates/
│   └── benefit-admin-and-payroll-interface-specifications/
├── 06_extra-instructions/
│   ├── broker-authored-instructions/
│   ├── employer-decision-form-templates/
│   ├── carrier-and-enrollment-operational-materials/
│   ├── emails-and-exported-messages/
│   └── overrides-and-corrections/
├── 07_shared-supporting-materials/
│   ├── carrier-and-vendor-contact-directories/
│   ├── employer-brand-assets/
│   ├── standalone-legal-notices/
│   ├── public-enrollment-reference-data/
│   └── unknown-and-classifier-edge-cases/
├── restricted-use/
│   └── completed-employer-guides/
└── _provenance-catalogs/
```

The seventh folder is for cross-cutting or classifier-test material that does
not cleanly belong to only one frontend phase. The first six folders correspond
directly to the six explicit source phases in the frontend seed.

The final corpus catalog will summarize cross-category sources, variations, and
any examples that are represented by links rather than downloadable artifacts.

## Bucket rules

- Folder placement describes the file itself, not what a future case might do
  with it. For example, `prior_same_employer` is a scenario relationship, not
  an intrinsic document type.
- Benefit-source folders may contain contracts, official summaries, forms, or
  program guides, but each README must label the exact source role. Tests must
  not count a form, formulary, FAQ, or flyer as a governing plan document.
- Medical insurance and prescription/pharmacy sources are separate. A
  formulary may support a medical section but is not a health-insurance plan.
- Blank decision forms are templates, not client decisions. Carrier checklists
  addressed to brokers are not broker-authored instructions.
- Completed employer guides are structure or scenario fixtures, never reusable
  master templates and never sources of facts for another employer.
- Confidential-marked or otherwise restricted public files are quarantined
  from ordinary evaluation and export bundles.

The content-based audit reports are in `docs/source-docs-audit-*.md`. Original
scrape catalogs for categories that were split are preserved under
`source-docs/_provenance-catalogs/`.
