# Employer and Group Information - 5 Public Examples

This folder contains five blank, public, official examples of employer/group information documents that can feed benefits setup or booklet generation. Blank forms are used because completed employer applications normally contain confidential business, employee, tax, and coverage information.

The set intentionally varies by workflow, market, and funding arrangement: two state-specific new-group applications, a New York annual group renewal form, a Pennsylvania level-funded/stop-loss application, and a federal employer coverage disclosure worksheet. It should not be treated as a current compliance packet; the source organization must confirm which version is required for a live case.

## Inventory

| # | Organization | Jurisdiction / market | Document subtype | Local file |
|---|---|---|---|---|
| 01 | Kaiser Permanente | California small group | New fully insured group employer application | `01_kaiser_ca_2026_small_group_employer_application.pdf` |
| 02 | Excellus BlueCross BlueShield | New York commercial group | Annual group information / renewal certification | `02_excellus_ny_annual_group_information_renewal.pdf` |
| 03 | Premera Blue Cross | Washington small group (1-50) | New small-group employer application | `03_premera_wa_2026_small_group_employer_application.pdf` |
| 04 | Highmark Blue Shield and HM Life Insurance Company | Pennsylvania small group | Balanced funding and stop-loss group application | `04_highmark_pa_balanced_funding_stop_loss_group_application.pdf` |
| 05 | Health Insurance Marketplace / CMS | Federal Marketplace | Employer coverage disclosure worksheet | `05_cms_healthcaregov_employer_coverage_tool.pdf` |

## 01 - Kaiser Permanente California Small Group Employer Application

- **Title:** California Small Group Employer Application
- **Organization:** Kaiser Foundation Health Plan, Inc. / Kaiser Permanente Insurance Company
- **Jurisdiction / market:** California small-group coverage; 2026 effective dates
- **Document subtype:** New fully insured group employer application
- **Why it is distinct:** A detailed carrier intake for a California small employer. It combines business identity, state small-group eligibility, current coverage, regulatory status, contributions, and product setup in one eight-page form.
- **Source page:** [Kaiser Permanente Forms and Documents for Brokers and Employers](https://business.kaiserpermanente.org/california/legacy/forms-and-documents)
- **Direct file:** [Official 2026 employer application PDF](https://business.kaiserpermanente.org/content/dam/kp/ccp/documents/sb-employer-application-en-ca-2026.pdf)
- **Retrieved:** 2026-07-17
- **Filename:** `01_kaiser_ca_2026_small_group_employer_application.pdf`
- **File facts:** PDF 1.6; 311,101 bytes (about 304 KiB); 8 letter-size pages
- **Verification:** The download begins as a real PDF and `pdfinfo` identifies the title above. The PDF is encrypted against editing but permits printing and copying. Page 1 was rendered with Poppler and visually inspected: the official logo, form controls, labels, footer, and pagination are legible with no clipping or overlap. `pdftotext` emits non-blocking font-weight warnings, but text remains extractable. SHA-256: `4222ea01337e87903dc58a245a1c37f99c6f9aad7a17e91085e583216f6855a8`.
- **Important BenefitsPackage inputs:** Legal and DBA names; physical address, county, phone, website; entity type; date established; EIN; NAICS; workers' compensation status; affiliated entities; current/prior group coverage; requested effective date; nationwide and eligible employee counts; minimum work hours; enrolling employee count; dependent and domestic-partner offering; COBRA, ERISA, and Medicare Secondary Payer/TEFRA status; employer contribution percentage or fixed amount; offered plan/product choices; broker and authorized signer details.

## 02 - Excellus BlueCross BlueShield Annual Group Information Form

- **Title:** B-8418 Annual Group Information Form (AGIF), Version 2025
- **Organization:** Excellus BlueCross BlueShield
- **Jurisdiction / market:** New York commercial group renewal; the form states that it is required by New York State
- **Document subtype:** Annual group information renewal / regulatory recertification
- **Why it is distinct:** This is a one-page renewal-stage document rather than a new-group application. It focuses on annual group-size classification, ownership/common control, and employer contributions, including account-based benefits.
- **Source page:** [Excellus Annual Group Information Form](https://employer.excellusbcbs.com/enroll-update/group/annual-group-form)
- **Direct file:** [Official AGIF PDF](https://employer.excellusbcbs.com/documents/20152/127544/EXC-EMP-BRK-Annual%2BGroup%2BInformation%2BForm.pdf/cd3b3884-a6eb-7a45-13fb-ede30ee370b9?t=1553111245833)
- **Retrieved:** 2026-07-17
- **Filename:** `02_excellus_ny_annual_group_information_renewal.pdf`
- **File facts:** PDF 1.7; 106,444 bytes (about 104 KiB); 1 letter-size page
- **Verification:** The official source page actively offers the downloadable form. The file is an unencrypted PDF with matching title metadata. Page 1 was rendered with Poppler and visually inspected; all sections, fields, certification language, and the 2025 footer are readable without rendering defects. SHA-256: `1a760787aec74ce7cb5dfdb6c9103ae8944f2828dbc48950f2f6581ecac92e38`.
- **Important BenefitsPackage inputs:** Group number; legal entity; EIN/TIN; business ZIP; PEO/leasing-company relationship; owners/partners/shareholders and ownership percentages; commonly owned or related businesses; prior-calendar-year FTE count; average full-time, part-time, and owner count; dental-eligible population; annual single-tier employer HSA and HRA contributions; single-tier dental and vision contribution percentages; employer authorized representative and contact email.

## 03 - Premera Blue Cross Washington Small Group Employer Application

- **Title:** Employer Group Application - Small Group (1-50)
- **Organization:** Premera Blue Cross
- **Jurisdiction / market:** Washington small group (1-50); 2026 application
- **Document subtype:** New small-group employer application
- **Why it is distinct:** This illustrates Washington-specific carrier onboarding, including a Washington Unified Business Identifier, state-specific group eligibility rules, explicit contribution/participation tables, multiple employee classes, and federal-status questions.
- **Source page:** [Premera Washington Producer Forms](https://www.premera.com/wa/producer/resources/forms/)
- **Direct file:** [Official 2026 small-group application PDF](https://www.premera.com/documents/012121_2026.pdf)
- **Retrieved:** 2026-07-17
- **Filename:** `03_premera_wa_2026_small_group_employer_application.pdf`
- **File facts:** PDF 1.6; 935,542 bytes (about 914 KiB); 8 letter-size pages
- **Verification:** The current Premera forms page labels this as the 2026 fully insured small-group Employer Group Application. It is an unencrypted PDF, and its physical page count matches the printed 1-of-8 through 8-of-8 pagination. Page 1 was rendered with Poppler and visually inspected; logo, radio buttons, tables, field labels, and footer are sharp and complete. SHA-256: `9279982f98a2f4af73be40a69dceda5140872c7358ba304b2df82ca44100c365`.
- **Important BenefitsPackage inputs:** Requested effective date; legal/DBA name; physical, mailing, and billing addresses; EIN; NAICS; Washington UBI; ownership type; group and billing contacts; COBRA administrator; replacing/current medical and dental coverage; employee count and group qualification; medical and dental contribution/participation; eligible employee classes; work-hour and waiting-period rules; dependent contribution; total payroll, eligible, enrolling, and waiving counts; Hawaii employee flag; COBRA, Medicare Secondary Payer, and ERISA status; producer and contract signer.

## 04 - Highmark Balanced Funding and Stop Loss Group Application

- **Title:** Group Application for Balanced Funding and Stop Loss Coverage
- **Organization:** Highmark Blue Shield / Highmark Administrative Services and HM Life Insurance Company
- **Jurisdiction / market:** Pennsylvania small-group Balanced Funding; the form includes Pennsylvania Act 4 dependent fields
- **Document subtype:** Level-funded/ASO medical plus stop-loss application, with optional fully insured ancillary products
- **Why it is distinct:** Unlike a conventional fully insured application, this form sets up a balanced-funded arrangement and separate stop-loss coverage. It also captures current self-funded/TPA status and fully insured dental/vision selections.
- **Source page:** [Highmark Central Pennsylvania Small Business Medical Plans](https://www.highmark.com/employer/solutions/small-business/cpa/medical-plans)
- **Direct file:** [Official group application PDF](https://www.highmark.com/content/dam/digital-marketing/en/highmark/highmarkdotcom/employer/small-group/cpa/forms-checklists/Group%20Application%20for%20Balanced%20Funding%20and%20Stop%20Loss%20Coverage.pdf)
- **Retrieved:** 2026-07-17
- **Filename:** `04_highmark_pa_balanced_funding_stop_loss_group_application.pdf`
- **File facts:** PDF 1.6; 1,006,336 bytes (about 983 KiB); 5 letter-size pages
- **Verification:** The file is an unencrypted, official Highmark/HM Life PDF. Page 1 was rendered with Poppler and visually inspected; both organizations' marks, funding/product blocks, eligibility fields, disclosures, and 1-of-5 footer render clearly. The form revision is `06/20`, so a live implementation must confirm that Highmark still accepts it even though it remains publicly hosted. SHA-256: `e084ca5e47648a3a96623b7c1a0626472ff43b80409a287a598474d1c4a9f976`.
- **Important BenefitsPackage inputs:** Applicant legal name and authorized representative; EIN; physical/mailing address; contract signer; nature and years of business; SIC; ERISA/government/church/public-school sponsorship; ownership type and incorporation state; effective date and Balanced Funding medical products; current carrier and self-funded/TPA status; dental and vision selections; domestic-partner and Pennsylvania Act 4 dependent offering; eligibility hours and probationary period; employee/enrollment counts; Medicare Secondary Payer details; COBRA/ERISA status; stop-loss and producer/application signatures.

## 05 - Health Insurance Marketplace Employer Coverage Tool

- **Title:** Employer Coverage Tool
- **Organization:** Health Insurance Marketplace, Centers for Medicare & Medicaid Services (CMS), U.S. Department of Health and Human Services
- **Jurisdiction / market:** Federal Marketplace; used for a household member with an offer of traditional job-based coverage
- **Document subtype:** Employer coverage disclosure worksheet supporting a Marketplace application
- **Why it is distinct:** This is not a carrier group-enrollment application. It records the employer's coverage offer from the employee/household perspective, including household eligibility, minimum value, and the lowest-cost employee premium - information that can complement employer onboarding and cost sources.
- **Source page:** [HealthCare.gov - People with coverage through a job](https://www.healthcare.gov/have-job-based-coverage/change-to-marketplace-plan/)
- **Direct file:** [Official Employer Coverage Tool PDF](https://www.healthcare.gov/downloads/employer-coverage-tool.pdf)
- **Retrieved:** 2026-07-17
- **Filename:** `05_cms_healthcaregov_employer_coverage_tool.pdf`
- **File facts:** PDF 1.7; 169,995 bytes (about 166 KiB); 2 letter-size pages
- **Verification:** The current HealthCare.gov page links the worksheet. The download is an unencrypted PDF titled `Employer Coverage Tool`. Page 1 was rendered with Poppler and visually inspected; the Marketplace branding, employee/household table, employer fields, help line, and page margins are intact. SHA-256: `1a3797db34df0d60d5337f2737ecb50c5d279d60d1b103d87d2dec8b6a732c15`.
- **Important BenefitsPackage inputs:** Employee and household members; which household members are eligible through the employer; employer name, address, EIN, contact, phone, and email; current/future employee eligibility date; spouse/dependent offer; whether the plan meets minimum value; lowest-cost employee-only premium and payroll frequency; known next-plan-year coverage or premium changes and effective date.

## Coverage notes and gaps

- These are reference examples, not five interchangeable versions of one form. Their field sets reflect different states, organizations, funding models, and stages of the benefits lifecycle.
- No completed employer applications were collected because they would commonly expose EINs, employee data, ownership details, signatures, and coverage information.
- The Highmark example is the oldest source in the set (revision 06/20). It is useful for schema breadth and remains on Highmark's public domain, but current acceptance was not independently confirmed.
- A public HealthEquity/Blue Cross Blue Shield of Massachusetts HSA/HRA/FSA Group Setup Form was evaluated as an employer account-onboarding example, but its host returned HTTP 403 to direct automated retrieval on 2026-07-17. It was not saved. The current CMS Employer Coverage Tool was used as the fifth verified example instead.
- This category does not attempt to cover every employer-side artifact. Census files, rate/contribution workbooks, eligibility policies, plan-selection worksheets, account-specific HSA/HRA/FSA setup forms, payroll files, and legal notices belong in their own source-document categories.

## Verification method

Each saved file was downloaded directly from an official organization domain, identified by the operating system as a PDF, inspected with Poppler `pdfinfo`, and rendered at least on page 1 with `pdftoppm`. The five rendered first pages were visually checked on 2026-07-17 for readable text, intact tables and form controls, correct branding, and the absence of obvious clipping, overlap, or blank/error pages.
