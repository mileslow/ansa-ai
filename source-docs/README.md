# Benefits booklet source-document corpus

This directory contains public, representative source documents that can be
used to develop and live-test the benefits booklet intake pipeline.

The top-level numbered folders mirror the guided frontend intake phases. Their
subfolders represent specific source-document or benefit categories. A source
document can support several categories, and a benefit category can contain
several plans or programs, each backed by several documents.

## Corpus standard

Each category should contain:

- five meaningfully different examples;
- original downloaded files when a stable public download is available;
- a category `README.md` recording title, organization, jurisdiction, plan or
  program variation, original URL, retrieval date, and verification result;
- no private employee data, credentials, or access-controlled material;
- descriptive filenames prefixed `01_` through `05_`.

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
├── 03_official-plan-documents/
│   ├── medical-and-prescription/
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
│   └── telemedicine/
├── 04_prior-booklet-or-template/
│   ├── same-employer-prior-booklets/
│   ├── master-booklet-templates/
│   ├── approved-language-patterns/
│   └── legal-and-required-notices/
├── 05_census-and-enrollment/
│   ├── employee-census/
│   ├── current-enrollment-exports/
│   ├── tier-count-files/
│   └── benefit-admin-and-payroll-exports/
├── 06_extra-instructions/
│   ├── broker-instructions/
│   ├── client-decisions/
│   ├── emails-and-exported-messages/
│   └── overrides-and-corrections/
└── 07_shared-supporting-materials/
    ├── carrier-and-vendor-contact-directories/
    ├── employer-brand-assets/
    ├── standalone-legal-notices/
    └── unknown-and-classifier-edge-cases/
```

The seventh folder is for cross-cutting or classifier-test material that does
not cleanly belong to only one frontend phase. The first six folders correspond
directly to the six explicit source phases in the frontend seed.

The final corpus catalog will summarize cross-category sources, variations, and
any examples that are represented by links rather than downloadable artifacts.
