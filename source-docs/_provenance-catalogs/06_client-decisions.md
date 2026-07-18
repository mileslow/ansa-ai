# Employer and Client Benefit Decisions: Five Public Examples

This folder contains exactly five public, blank employer/client decision forms. The examples are deliberately different: they test initial plan selection, renewal acceptance or change, employer contribution and offering changes, voluntary-benefit inclusion, and implementation of a standalone EAP. None contains completed employer or employee information.

All files were retrieved on **2026-07-17**. These are extraction and classification fixtures, not current legal, pricing, or compliance advice.

## Coverage summary

| # | Decision pattern | Organization | Jurisdiction / market | Distinct extraction value |
|---|---|---|---|---|
| 1 | Multi-benefit plan selection | Members Health Plan New Jersey | New Jersey MEWA employer plan | Selects among many medical/Rx designs plus dental, FSA/HRA, COBRA administrator, and waiting periods in one compact form. |
| 2 | Renewal acceptance or replacement | Kaiser Permanente | Oregon small-group renewal | Distinguishes “renew as offered” from “change,” supports multiple plans, and records HSA administration, dental, eligibility, and contribution decisions. |
| 3 | Employer contribution and offering change | Covered California for Small Business | California small-group marketplace | Changes metal tiers, reference plans, medical/dental contribution percentages, dependent availability, infertility coverage, and COBRA status. |
| 4 | Voluntary-benefit inclusion | Concordia Plan Services | U.S. employer/ministry voluntary benefits | Explicitly opts into critical-illness and/or accidental-injury insurance and authorizes payroll deduction. |
| 5 | Standalone program implementation | Providence Health Plan | U.S. employer EAP implementation | Selects an EAP visit design, links or separates medical billing, supplies headcount, and calculates implementation cost. |

## 1. Members Health Plan NJ Employer Plan Selection Form

- **Title:** Employer Plan Selection Form
- **Organization:** Members Health Plan New Jersey; prepared/processed by Concord Management Resources
- **Jurisdiction / market:** New Jersey; employer-sponsored Multiple Employer Welfare Arrangement (MEWA), 2021 plan menu
- **Decision type:** Initial or revised multi-plan selection and program inclusion
- **Why distinct:** This single-page form captures a dense, many-to-many employer decision: one employer may select one or more medical plans, pair each with an Rx option, add or omit dental, add an FSA or HRA, choose a COBRA administrator, and set new-hire and rehire waiting periods.
- **Source webpage:** <https://membershealthplannj.com/employers/employer-documents/>
- **Direct file URL:** <https://membershealthplannj.com/wp-content/uploads/2020/10/2021-Employer-Plan-Selection-Form.pdf>
- **Retrieved:** 2026-07-17
- **Local filename:** `01_members-health-plan-nj_employer-plan-selection.pdf`
- **File metadata:** PDF 1.7; 568,274 bytes; 1 US Letter page; unencrypted; AcroForm; no JavaScript
- **SHA-256:** `a6189c1ea36e3df4a02935de249724604c8505a8cdc067cc238fcc36c92581e7`
- **Fields / overrides supported:** employer/group/account identifiers; effective date; employer contact; new-hire and rehire waiting period; COBRA administrator; selected medical plans; Rx option per medical plan; HSA-compatible plan flag; dental inclusion/exclusion and selected dental plans; FSA/HRA inclusion; employer authorization date.
- **Verification:** `%PDF` content was identified as PDF 1.7; `pdfinfo` opened the file; Poppler extracted 718 words from the single page; page 1 was rendered to PNG and visually inspected. The title, blank fields, plan matrix, checkboxes, and signature line are legible. The file is not HTML or an error page.
- **Known limitations:** The plan menu and version are from 2021 and should not be treated as current. It identifies whether an FSA or HRA is desired but not detailed account funding or plan-design rules. HSA administration is explicitly outside the MEWA. A completed form would need the related enrollment/waiver evidence and current plan documents.

## 2. Kaiser Permanente Oregon Small Group Renewal Decision Form

- **Title:** Oregon Small Group Renewal Decision Form
- **Organization:** Kaiser Foundation Health Plan of the Northwest
- **Jurisdiction / market:** Oregon; small groups of 1-50 employees
- **Decision type:** Renewal acceptance, replacement-plan selection, and renewal configuration
- **Why distinct:** Unlike the initial plan-selection example, this is explicitly a renewal response. It records whether each current medical, dental, and pediatric dental offering is renewed unchanged, replaced, or supported by an outside-coverage attestation; it also captures renewal-time eligibility and contribution changes.
- **Source webpage:** <https://business.kaiserpermanente.org/business/broker/oregon-sw-washington/client-support/renewals/oregon-renewal-response>
- **Direct file URL:** <https://business.kaiserpermanente.org/business/shared/nw/resource-library/renewal-decision-form-or-nw-en.pdf>
- **Retrieved:** 2026-07-17
- **Local filename:** `02_kaiser-oregon_small-group-renewal-decision.pdf`
- **File metadata:** PDF 1.7; 225,326 bytes; 2 US Letter pages; unencrypted; AcroForm; no JavaScript
- **SHA-256:** `c425682bcec3442d7aa9d793c3d45ba71e8909fb1d0df858745c903f30e2f286`
- **Fields / overrides supported:** group number and renewal date; one/two/three-plan offering count; renew-versus-change decision per medical and dental plan; new plan name; vision and massage additions; HSA/HRA/FSA selection flags; Kaiser HSA administration choice; pediatric dental renewal/change/outside-coverage attestation; weekly hours requirement; employee and dependent employer contribution as percentage or dollars; employee-only-plan rule; employer/producer signature and contact.
- **Verification:** The file has a valid PDF signature; `pdfinfo` confirms an unencrypted 2-page PDF; Poppler extracted 793 words across both pages; page 1 was rendered and visually inspected. Renewal-choice tables, account selections, and medical/dental fields are readable. It is not HTML or an error response.
- **Known limitations:** Form code `399234528_SBG_10-24` reflects a 2024 publication and references the 2025 underwriting policy. Rates and the existing renewal offering are supplied in a separate group-specific renewal packet. A blank row by itself cannot identify the incumbent or replacement plan without that packet.

## 3. Covered California for Small Business Change Request Form for Employers

- **Title:** Change Request Form for Employers (CCSB0284, version 10/01/2025)
- **Organization:** Covered California for Small Business
- **Jurisdiction / market:** California; small-business marketplace groups
- **Decision type:** Employer contribution, plan-level, reference-plan, coverage, and administration override
- **Why distinct:** This is a post-setup change/override document rather than a sold-case selection or renewal packet. It can modify the employer's reference plan, metal-tier range, medical and dental contribution percentages, dependent availability, infertility offering, COBRA classification, and business/contact data, with many plan changes restricted to renewal.
- **Source webpage:** <https://www.coveredca.com/forsmallbusiness/applications-and-forms/employers/>
- **Direct file URL:** <https://www.coveredca.com/pdfs/CCSB%20Employer-Change-Request-Form_ENG-10.28.2025-FINAL.pdf>
- **Retrieved:** 2026-07-17
- **Local filename:** `03_covered-california_employer-change-request.pdf`
- **File metadata:** PDF 1.7; 168,376 bytes; 5 US Letter pages; unencrypted; AcroForm with JavaScript
- **SHA-256:** `63037187922fd386f7395179b726ad9300dff243577c32802731bc26edc67024`
- **Fields / overrides supported:** employer name, FEIN/SIC, phone, and CCSB group number; effective-at-renewal flag; reason for change; legal/DBA/address/ownership/contact updates; employee terminations; offered metal-tier combination; medical reference carrier/plan/tier; employee and dependent monthly medical contribution percentages; employee-only/dependent coverage; infertility benefit inclusion; dental inclusion, reference plan, and contribution percentages; Cal-COBRA versus federal COBRA; insurance-agent details; authorized officer signature and attestation.
- **Verification:** The download is a valid PDF rather than HTML; `pdfinfo` opens all 5 pages and identifies the interactive form; text extraction confirms the title, change reasons, contribution fields, and attestations; page 1 was rendered and visually inspected with all sections and checkboxes legible.
- **Known limitations:** This records changes, not the employer's complete original configuration; unchanged values must be obtained from the existing CCSB record or prior application. The form does not contain actual carrier rate tables or benefit details. Because it contains document-level JavaScript, automated ingestion should parse it in a non-executing/sandboxed manner. Completed copies can contain FEINs and employee identifiers and must be handled as sensitive data.

## 4. Concordia Critical Illness / Accidental Injury Employer Election

- **Title:** Critical Illness/Accidental Injury Employer Election (form 12110-1120)
- **Organization:** Concordia Plan Services, The Lutheran Church-Missouri Synod
- **Jurisdiction / market:** United States; participating employers/ministries
- **Decision type:** Voluntary-benefit inclusion and payroll-deduction authorization
- **Why distinct:** This narrow decision form tests an explicit include/exclude signal for voluntary products. The employer can elect critical-illness insurance, accidental-injury insurance, or both, specify the effective date, acknowledge receipt of plan documents, and authorize payroll deductions.
- **Source webpage:** <https://www.concordiaplans.org/employers/resources/forms>
- **Direct file URL:** <https://www.concordiaplans.org/docs/default-source/forms/adoption-and-elections/12110.pdf?sfvrsn=4e19d2d0_5>
- **Retrieved:** 2026-07-17
- **Local filename:** `04_concordia_voluntary-benefits-employer-election.pdf`
- **File metadata:** PDF 1.6; 215,391 bytes; 1 US Letter page; unencrypted; AcroForm with JavaScript
- **SHA-256:** `4c73c36a7a8b2fa0ed2f34529a954b9e8ce2f42e5bd9f1a1b6b1a7fc2efdd64e`
- **Fields / overrides supported:** employer name/number/address; voluntary critical-illness inclusion; voluntary accidental-injury inclusion; effective date; employer-paid versus employee-paid inference from payroll-deduction acknowledgement; authorized representative name/title/contact; employer signature and date; implementation follow-up required.
- **Verification:** The file has a valid PDF signature; `pdfinfo` confirms a one-page unencrypted interactive PDF; Poppler extracted 172 words; page 1 was rendered and visually inspected. Both product checkboxes, effective-date field, acknowledgements, and signature fields are clear. It is not HTML or an error page.
- **Known limitations:** The form is dated November 2020 and contains no rates, benefit amounts, eligibility classes, or certificate terms. The payroll language establishes that the products are voluntary but does not define per-pay-period deductions. The file contains interactive JavaScript and should be ingested without executing embedded actions.

## 5. Providence Employee Assistance Program Implementation Form

- **Title:** Employee Assistance Program Implementation Form
- **Organization:** Providence Health Plan
- **Jurisdiction / market:** United States; standalone employer EAP, with group-size price bands
- **Decision type:** Program implementation, product-design selection, and cost approval input
- **Why distinct:** This form implements a standalone service rather than insurance coverage. It records whether to reuse an existing medical billing contact, selects a 3-visit or 6-visit EAP, applies a group-size PEPM rate to total headcount, and produces an estimated annual premium.
- **Source webpage:** <https://www.providencehealthplan.com/producers/forms-and-documents>
- **Direct file URL:** <https://www.providencehealthplan.com/-/media/providence/website/pdfs/producers/2026/employee-assistance-program-implementation-form.pdf?hash=2FEA595807BD63567A79E179841FE657&rev=0c08cdcd6312482e95a2839bf60827a0>
- **Retrieved:** 2026-07-17
- **Local filename:** `05_providence_eap-implementation-form.pdf`
- **File metadata:** PDF 1.7; 198,679 bytes; 1 US Letter page; unencrypted; AcroForm; no JavaScript
- **SHA-256:** `3ac6781c6beb1bff9ce468c61c2f71cf0549b1e2431d1e976c9f7d57ed4b04dd`
- **Fields / overrides supported:** company name; requested effective date; current Providence medical-client flag and group number; medical-policy renewal month; reuse-medical-billing-contact decision; billing contact name/title/address/phone/email; total employee headcount; 3-visit versus 6-visit product; PEPM rate band; 12-month estimated annual premium; availability of additional CISM, presentation, and training services.
- **Verification:** `pdfinfo` opens the one-page unencrypted PDF and Poppler extracted 290 words; page 1 was rendered and visually inspected with all form lines, product checkboxes, rate table, and cost formula legible. The download is not HTML or an error page. macOS `file` identifies it as PDF 1.7 but incorrectly displays “0 pages”; Poppler independently confirms one valid page and successfully renders it.
- **Known limitations:** The form is labeled `25_PHP_01188 10/25`; pricing can change and must not be reused operationally without confirmation. It estimates premium from total headcount and the published band but does not capture enrolled-member names. It has no signature line, so a completed form demonstrates implementation inputs but not necessarily final contractual acceptance.

## Verification summary

- Exactly five originals are present, numbered `01` through `05`.
- Every download has a PDF file signature and opens successfully with Poppler; no HTML, login, or error page was accepted.
- `pdfinfo` confirms page count, page size, encryption status, form type, and PDF version.
- Identifying text was extracted from every file.
- Page 1 of every PDF was rendered to PNG and visually inspected for identity, legibility, clipping, and corruption.
- SHA-256 values above were calculated from the retained original downloads for future fixture-integrity checks.

## Pipeline use note

These documents are authoritative for **what the employer selected, changed, or requested** only when completed and properly authorized. They are not authoritative for benefit terms. The pipeline should continue to source deductibles, copays, exclusions, limits, and covered services from the applicable SBC, SPD, certificate, policy, or EOC; rates should come from the accepted quote or carrier rate source. Conflicts should be preserved and surfaced rather than silently resolved.
