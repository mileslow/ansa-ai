# Source-document audit: booklets, templates, notices, and instructions

Audited: 2026-07-17

Scope: every primary artifact under `source-docs/04_prior-booklet-or-template` and `source-docs/06_extra-instructions`. READMEs, hidden QA folders, and `_verification` artifacts were excluded as primary artifacts but every category README was read and compared with the retained originals.

Method: `pdfinfo`, `pdftotext`, file metadata, and the actual DOCX XML/text were used to identify each file's primary role. The image-heavy South Metro Fire Rescue cover and table of contents were rendered and visually checked because its first pages did not extract useful text. No corpus file was moved or edited.

## Executive finding

The corpus has 30 valid primary artifacts, but four leaf names describe intended test use rather than the files' intrinsic document types:

- `master-booklet-templates` contains five completed, employer-specific benefits guides and **zero reusable templates**.
- `same-employer-prior-booklets` contains five public guides from unrelated employers. A file is a “same-employer prior booklet” only after it is attached to a case for that same employer; that cannot be asserted by a permanent corpus bucket.
- `broker-instructions` contains carrier/administrator forms and checklists plus one vendor planning checklist. It contains **zero broker-authored instructions, emails, sold-case summaries, or decision memos**.
- `client-decisions` contains five blank decision-capture form templates and **zero completed or otherwise genuine employer decisions**.

`approved-language-patterns` also overstates the sources: it mixes standardized federal terminology, federal tax guidance, educational brochures, and one copyrighted employer/carrier flyer. “Approved” is not established by any of those roles.

## Required bucket corrections

These corrections are required to prevent the classifier, prompt authors, and test expectations from learning false source roles.

1. Retire `master-booklet-templates` as a leaf name. Reclassify its five files under `completed-employer-guides/style-references`. Keep a separate `reusable-booklet-templates` bucket empty until actual editable or licensed templates are obtained.
2. Retire `same-employer-prior-booklets` as an intrinsic file bucket. Reclassify ordinary guides under `completed-employer-guides/prior-booklet-scenario-fixtures`; assign `same_employer_prior=true` only in case-level fixture metadata. Reclassify the JPMC file as a package-wide SPD/plan document, and quarantine Adobe because the PDF is marked confidential.
3. Split `approved-language-patterns` into `authoritative-reference-material`, `educational-reference-material`, and `completed-employer-collateral`. Do not label any source “approved language” without a separate approval record and permitted-use basis.
4. Rename the DOL “HIPAA special enrollment” file to identify it as an eleven-model-notice collection. It is not a single HIPAA notice.
5. Replace `broker-instructions` with source-type buckets such as `carrier-submission-checklists`, `employer-decision-form-templates`, `carrier-implementation-form-templates`, and `enrollment-planning-references`.
6. Rename `client-decisions` to `employer-decision-form-templates`. A blank form expresses possible fields, not an employer's actual decision.
7. Quarantine or remove the Adobe PDF from a generally distributable fixture set. Its public URL does not override the `Adobe Confidential` marking on every page.

## Per-file audit: approved-language-patterns

| File | Exact subtype / primary role | Current leaf fit | Required correction and precise recommended path |
|---|---|---|---|
| `01_cms_uniform_health_coverage_glossary.pdf` | CMS standardized consumer glossary used with the SBC program; educational definitions plus a cost-sharing example. It explicitly says the policy/plan governs. | Partial. It is authoritative standardized terminology, but no corpus evidence makes it “approved” booklet copy. | **Required:** `04_prior-booklet-or-template/authoritative-reference-material/standardized-terms/01_cms_2023-uniform-health-coverage-glossary.pdf`. Record the expired 2026-05-31 OMB date and refresh before production use. |
| `02_dol_life_changes_enrollment_options.pdf` | DOL EBSA consumer educational guide for marriage, birth/adoption, aging out, death, separation, divorce, special enrollment, Marketplace, and COBRA actions. | No. It is useful education, not model notice text or approved employer language. | **Required:** `04_prior-booklet-or-template/educational-reference-material/qualifying-life-events/02_dol_life-changes-require-health-choices.pdf`. |
| `03_irs_publication_969_hsa_fsa_hra.pdf` | IRS Publication 969 for 2025 returns; technical federal tax guidance covering HSA, MSA, health FSA, and HRA rules. | No. It is authoritative tax guidance, not an employee booklet pattern or plan/account document. | **Required:** `04_prior-booklet-or-template/authoritative-reference-material/tax-guidance/03_irs_2025-publication-969_hsa-fsa-hra.pdf`. Preserve edition/year metadata and never use it as plan-specific account evidence. |
| `04_ut_life_disability_enrollment_highlights.pdf` | Completed UT System/BCBSTX employee enrollment flyer summarizing employer-specific basic/voluntary life, AD&D, STD, and LTD offerings. Copyrighted and explicitly illustrative. | No. It is employer-specific collateral, not authoritative or approved language. | **Required:** `04_prior-booklet-or-template/completed-employer-collateral/section-style-references/04_ut-system_2026-life-add-std-ltd-enrollment-flyer.pdf`. Use only for structural testing. |
| `05_dol_top_10_health_benefits_tips.pdf` | DOL EBSA benefits-literacy brochure: plan choice, SPD/SBC literacy, use of coverage, wellness, claims/appeals, COBRA, and life events. | No. It is general educational material, not source-backed booklet language for a specific employer. | **Required:** `04_prior-booklet-or-template/educational-reference-material/benefits-literacy/05_dol_2022-top-10-health-benefits-tips.pdf`. |

## Per-file audit: legal-and-required-notices

The parent leaf is substantively correct. These are official model notices or an official model-notice collection, but none is production-ready without applicability and currency checks.

| File | Exact subtype / primary role | Current leaf fit | Required or optional correction |
|---|---|---|---|
| `01_dol_chip_medicaid_premium_assistance_model_notice.pdf` | Current DOL Employer CHIP/Medicaid Premium Assistance Model Notice with state program directory, current in the file through 2026-01-31. | Yes. | **Optional:** add version date to name: `01_dol_2026-chip-medicaid-premium-assistance-model-notice.pdf`. Re-download before every production run because state contacts change. |
| `02_cms_medicare_part_d_creditable_coverage_model_notice.pdf` | CMS Model Individual Creditable Coverage Disclosure Notice Language, updated 2011, with entity/plan/contact placeholders and optional personalization block. | Yes, as a model legal notice fixture. | **Optional filename correction:** `02_cms_2011-part-d-creditable-coverage-model-notice-language.pdf`. **Required operational control:** mark historical/versioned and validate against current CMS requirements before use. |
| `03_dol_cobra_general_model_notice.docx` | Editable DOL Model General Notice of COBRA Continuation Coverage Rights for single-employer plans; not the post-event COBRA election notice. | Yes. | **Required operational control:** mark the displayed 2026-02-28 OMB expiration and refresh before use. **Optional filename:** `03_dol_cobra-general-model-notice_single-employer.docx`. |
| `04_dol_hipaa_special_enrollment_model_notice_collection.pdf` | DOL Appendix C, *Model Notices for Group Health Plans*. It contains 11 model notice/form types: special enrollment, wellness disclosure, Newborns' Act, WHCRA enrollment, WHCRA annual, initial/final adverse-benefit determinations, final external review, grandfathered-plan disclosure, and patient-protection disclosure. HIPAA special enrollment is only one page within it. | Parent leaf yes; filename and README primary-label framing are misleading. | **Required:** rename/reclassify as `04_prior-booklet-or-template/legal-and-required-notices/04_dol_group-health-model-notices-collection.pdf`; store page ranges and embedded subtypes in the manifest. Do not publish the collection wholesale. |
| `05_dol_marketplace_coverage_options_model_notice.pdf` | DOL/HHS Marketplace Coverage Options model for employers offering coverage; employee education plus structured employer, eligibility, minimum-value, and cost fields. | Yes, as a historical structural fixture. | **Required operational control:** replace with the latest model before production. The retained file includes stale 2023 affordability and 2023-2024 Medicaid/CHIP unwinding language. **Optional filename:** add `2024-model` to expose the version. |

## Per-file audit: master-booklet-templates

All five are completed employer publications with employer facts, plan terms, contacts, rates, branding, and copyright interests. None is a blank, editable, licensed, or reusable master template.

| File | Exact subtype / primary role | Current leaf fit | Required correction and precise recommended path |
|---|---|---|---|
| `01_city-of-lawrence_2026_employee-benefits-guide.pdf` | Completed 2026 City of Lawrence comprehensive annual benefits guide; PowerPoint-origin PDF. | No: style reference, not template. | **Required:** `04_prior-booklet-or-template/completed-employer-guides/style-references/01_city-of-lawrence_2026-employee-benefits-guide.pdf`. |
| `02_seminole-county_2026_employee-benefits-guide.pdf` | Completed 2026 Seminole County comprehensive enrollment guide with costs, voluntary benefits, glossary, and embedded annual notices. | No: style/content reference, not template. | **Required:** `04_prior-booklet-or-template/completed-employer-guides/style-references/02_seminole-county_2026-employee-benefits-guide.pdf`. Tag `contains_legal_notices=true`. |
| `03_northeastern-university_2026_benefits-guide.pdf` | Completed landscape interactive-style 2026 total-rewards/benefits guide for Northeastern faculty and staff. | No: employer-specific digital guide, not template. | **Required:** `04_prior-booklet-or-template/completed-employer-guides/style-references/03_northeastern-university_2026-benefits-guide.pdf`. |
| `04_atrium-health_2026_benefits-guide.pdf` | Completed Advocate/Atrium 2026 annual-enrollment decision guide focused on changes, actions, salary-banded costs, and vendor transitions. | No: completed enrollment guide, not template. | **Required:** `04_prior-booklet-or-template/completed-employer-guides/style-references/04_atrium-health_2026-annual-enrollment-guide.pdf`. The more precise filename distinguishes it from a full SPD-style guide. |
| `05_south-metro-fire-rescue_2026_benefits-guide.pdf` | Completed 2026 public-safety benefits guide with SMFR identity, plan/premium comparisons, HSA/FSA, protection products, retirement, leave, and contacts. | No: completed branded guide, not template. | **Required:** `04_prior-booklet-or-template/completed-employer-guides/style-references/05_south-metro-fire-rescue_2026-benefits-guide.pdf`. Image-heavy opening pages require OCR/vision fallback. |

## Per-file audit: same-employer-prior-booklets

“Prior booklet” is a case relationship, not an intrinsic subtype. These public files can simulate that relationship, but they are not from a common current employer and must not be globally labeled same-employer.

| File | Exact subtype / primary role | Current leaf fit | Required correction and precise recommended path |
|---|---|---|---|
| `01_university-of-arizona_2026-benefits-guide.pdf` | Completed 2026 public-university new-hire/comprehensive benefits guide, including retirement, insurance, payroll treatment, tuition, leave, and notices. | Partial only as a scenario fixture; not inherently same-employer. | **Required:** `04_prior-booklet-or-template/completed-employer-guides/prior-booklet-scenario-fixtures/01_university-of-arizona_2026-benefits-guide.pdf`. |
| `02_city-of-houston_new-hire-employee-benefits-guide.pdf` | Historical completed City of Houston new-hire benefits guide with medical rates, benefit summaries, contacts, and embedded administrative forms; metadata dates it to 2018. | Partial only as a historical scenario fixture. Current name hides age. | **Required:** `04_prior-booklet-or-template/completed-employer-guides/prior-booklet-scenario-fixtures/02_city-of-houston_2018-historical-new-hire-benefits-guide.pdf`. Tag `historical=true`. |
| `03_intel_2026-new-mexico-annual-enrollment-guide.pdf` | Completed short, regional 2026 annual-enrollment change/decision guide for Intel New Mexico employees. | Partial only as a scenario fixture. | **Required:** `04_prior-booklet-or-template/completed-employer-guides/prior-booklet-scenario-fixtures/03_intel_2026-new-mexico-annual-enrollment-guide.pdf`. |
| `04_jpmorganchase_2025-us-benefits-guide.pdf` | 399-page combined benefits guide, SPD, and for many plans the plan document. Its governing-document role is primary; it is not merely a prior enrollment booklet. | No. The current bucket understates its legal/plan-document role. | **Required:** `source-docs/03_official-plan-documents/package-wide-spd-plan-documents/04_jpmorganchase_2025-combined-benefits-spd-plan-document.pdf`. A phase-04 scenario should reference it by manifest link rather than duplicate the binary. |
| `05_adobe_2025-rewards-guide.pdf` | Completed 2025 Adobe total-rewards/benefits guide with plan comparisons, costs, leave, perks, and contacts; every page is marked `Adobe Confidential`. | No for a normal public reference bucket; high leakage/licensing risk. | **Required:** quarantine at `source-docs/restricted-use/completed-employer-guides/05_adobe_2025-rewards-guide_CONFIDENTIAL.pdf` or remove it. Do not include it in distributable fixtures or model-training/evaluation bundles without explicit permission. |

## Per-file audit: broker-instructions

This leaf contains no broker-authored instruction artifact. “For brokers” describes audience, not authorship.

| File | Exact subtype / primary role | Current leaf fit | Required correction and precise recommended path |
|---|---|---|---|
| `01_qualchoice_broker-new-group-submission-checklist.pdf` | QualChoice carrier checklist of mandatory new-group submission documents and binder-payment methods; Arkansas, 2021. | No: carrier-authored implementation requirement/checklist. | **Required:** `06_extra-instructions/carrier-submission-checklists/01_qualchoice_2021-new-group-submission-checklist.pdf`. |
| `02_health-net-oregon_2026-small-group-renewal-election-form.pdf` | Blank Health Net carrier renewal-election form capturing accepted quote, eligibility, plan offerings, contribution percentages, dental, and vision. | No: carrier-provided employer decision form template. A completed signed copy could become a client decision. | **Required:** `06_extra-instructions/employer-decision-form-templates/renewal/02_health-net-oregon_2026-small-group-renewal-election-form.pdf`. |
| `03_qualchoice_2026-product-selection-sold-rate-form.pdf` | Blank QualChoice carrier product-selection/sold-rate form for new and renewing groups, including eligibility, contributions, plan IDs/rates, ancillary elections, riders, ACH, and authorization. | No: carrier decision/implementation form, not broker instruction. | **Required:** `06_extra-instructions/employer-decision-form-templates/plan-selection-and-rates/03_qualchoice_2026-product-selection-and-sold-rate-form.pdf`. Completed copies require bank-data controls. |
| `04_benefitfocus_open-enrollment-planning-checklist.pdf` | Benefitfocus vendor educational planning checklist covering assessment, stakeholder objectives, branding, communications, timeline, launch, and metrics. | No: workflow reference, not a case instruction or employer decision. | **Required:** `06_extra-instructions/enrollment-planning-references/04_benefitfocus_2020-open-enrollment-planning-checklist.pdf`. |
| `05_metlife_specialty-business-new-group-submission-form.pdf` | Blank MetLife specialty-benefits carrier implementation form for life, AD&D, dental, disability, vision, legal, pet, and identity protection; captures broker/GA/TPA/customer contacts and class/contribution/admin rules. | No: carrier implementation form template. | **Required:** `06_extra-instructions/carrier-implementation-form-templates/05_metlife_2022-specialty-business-new-group-submission-form.pdf`. Completed copies may contain SSNs, TINs, billing data, and health-risk information. |

## Per-file audit: client-decisions

All five originals are blank templates. They model how decisions may be captured, but none contains an actual employer selection, change, signature, or instruction.

| File | Exact subtype / primary role | Current leaf fit | Required correction and precise recommended path |
|---|---|---|---|
| `01_members-health-plan-nj_employer-plan-selection.pdf` | Blank 2021 MEWA employer plan-selection form for medical/Rx, dental, FSA/HRA, COBRA administrator, and waiting periods. | No as “client decision”; yes as a decision-form template. | **Required:** `06_extra-instructions/employer-decision-form-templates/plan-selection/01_members-health-plan-nj_2021-employer-plan-selection-form.pdf`. |
| `02_kaiser-oregon_small-group-renewal-decision.pdf` | Blank 2024-published Oregon small-group renewal decision form for medical/dental/pediatric dental, accounts, eligibility, contributions, and signature. | No as actual decision; yes as renewal decision template. | **Required:** `06_extra-instructions/employer-decision-form-templates/renewal/02_kaiser-oregon_2024-small-group-renewal-decision-form.pdf`. |
| `03_covered-california_employer-change-request.pdf` | Blank 2025 Covered California employer change request for business data, metal tiers, reference plan, medical/dental contributions, dependent availability, infertility coverage, and COBRA status. | No as actual decision; yes as change-request template. | **Required:** `06_extra-instructions/employer-decision-form-templates/change-request/03_covered-california_2025-employer-change-request-form.pdf`. Parse without executing embedded JavaScript. |
| `04_concordia_voluntary-benefits-employer-election.pdf` | Blank 2020 employer election form for critical-illness and/or accidental-injury voluntary coverage and payroll deduction. | No as actual election; yes as voluntary-benefit election template. | **Required:** `06_extra-instructions/employer-decision-form-templates/voluntary-benefits/04_concordia_2020-critical-illness-accident-employer-election-form.pdf`. Parse without executing embedded JavaScript. |
| `05_providence_eap-implementation-form.pdf` | Blank 2025 standalone EAP implementation/pricing form selecting 3- or 6-visit design, billing contact, total headcount, PEPM band, and estimated annual premium. It has no signature line. | No as final client decision; implementation-input template only. | **Required:** `06_extra-instructions/carrier-implementation-form-templates/programs/05_providence_2025-eap-implementation-form.pdf`. |

## Required safety and leakage controls

- **Confidential marking:** quarantine the Adobe guide. Public retrievability is not sufficient permission to retain or redistribute a document marked confidential.
- **Employer-specific leakage:** the other completed employer guides are public but copyrighted and contain rates, contacts, plan names, logos, photographs, legal language, and employer-specific policies. They may support structure/extraction testing only; generated facts must never default from them.
- **Sensitive completed forms:** a completed QualChoice sold-rate form can contain bank details; MetLife can contain SSNs, TINs, billing and health-risk information; Covered California can contain FEINs and employee data; the remaining election forms can contain group IDs, contacts, signatures, and account numbers. Keep public blank forms as fixtures. Route completed uploads through PII/PHI detection, encryption, access controls, retention limits, and redaction for testing.
- **Embedded actions:** Covered California and Concordia PDFs contain JavaScript. Extract in a non-executing parser/sandbox.
- **Stale legal content:** CMS Part D, DOL COBRA, DOL Marketplace, and CMS glossary artifacts have old/expired dates or stale paragraphs. Their presence in an official current source page does not make every embedded date current.
- **Governing-document precedence:** the JPMC combined SPD/plan document and official plan documents generally must outrank prior booklets and blank decision templates for benefit terms. Signed decisions may establish what was selected but not what the selected plan covers.

## Duplicate and overlap audit

- No exact binary duplicates were found across the 30 primary artifacts.
- There are useful semantic overlaps that should be tagged rather than mistaken for distinct source classes:
  - Health Net and Kaiser are both blank small-group renewal-election templates.
  - QualChoice and Members Health Plan NJ are both blank product/plan-selection templates.
  - QualChoice's submission checklist references its product-selection form, so those two form a packet relationship rather than independent evidence of the same fact.
  - The DOL multi-notice collection contains eleven embedded notice types and must be segmented at page/section level to avoid treating it as one HIPAA record.
- Use `document_subtype`, `issuer`, `jurisdiction`, `version_date`, `completed_status`, `authoring_party`, and `case_relationship` metadata for fixture selection. Folder name alone is insufficient.

## Future coverage gaps (not bucket corrections)

These are missing examples to add later; they should not delay the required taxonomy corrections above.

1. **True reusable templates:** no blank/editable/licensed master booklet template, component template, or design-system source exists. Add an owned template (DOCX/PPTX/HTML/JSON) with explicit reuse rights rather than relabeling completed employer guides.
2. **Case-paired prior booklets:** add fixtures in which a current case and its genuine prior-year booklet share the same employer identity, with explicit case metadata. Public guides alone cannot test same-employer matching.
3. **Broker-authored instructions:** add redacted or synthetic broker instruction emails, sold-case summaries, implementation memos, contribution override notes, plan-selection confirmations, content checklists, and submission cover letters. Clearly label synthetic fixtures.
4. **Genuine completed decisions:** public blank forms do not test handwriting, checkbox state, signatures, conflicting amendments, or precedence. Add synthetic completed forms and decision emails with fake employers/data, or properly authorized/redacted real examples.
5. **Broker/client conflict fixtures:** add a current plan selection plus a later dated override, and a conflict between a decision memo and carrier form, to test provenance and escalation.
6. **Current legal replacements:** obtain the latest CMS glossary/OMB edition, current COBRA model, current Marketplace notice, and current Part D guidance/model language before testing production notice generation.
7. **Explicit restricted-use tier:** create manifest-level `reuse_scope`, `copyright_status`, `confidentiality_marking`, and `redistribution_allowed` fields so restricted style references cannot enter outputs or exported fixture bundles.

## Recommended classification rule

Classify intrinsic type first, then case role:

```text
intrinsic_type:
  completed_employer_guide | reusable_template | model_legal_notice |
  official_guidance | educational_reference | carrier_checklist |
  employer_decision_form_template | carrier_implementation_form |
  broker_authored_instruction | completed_employer_decision | plan_document

case_role:
  current_authoritative | prior_same_employer | style_reference |
  decision_override | educational_only | historical_fixture

completion_status:
  blank | completed | redacted | synthetic
```

This prevents a completed public guide from becoming a “template,” a blank carrier form from becoming a “client decision,” or a broker-audience carrier checklist from becoming a “broker-authored instruction.”
