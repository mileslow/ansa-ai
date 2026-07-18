# Eligibility and enrollment source documents

Five public, real-world examples for the employer-setup **eligibility and enrollment** input category. The set deliberately spans a transactional election form, a dependent re-verification notice, a new-hire guide, an annual enrollment guide, and an administrator-level qualifying-life-event rules manual. It is therefore useful for testing both structured-form extraction and narrative/table-heavy policy extraction.

All sources were accessed on **2026-07-17**. No document contains actual employee records: the OPM file is a blank federal form, the CalPERS letter uses merge placeholders, and the remaining files are public guides with generic or simulated examples.

## Inventory and provenance

### 01 - OPM SF 2809 Health Benefits Election Form

- **Local file:** `01_opm_sf2809_health-benefits-election-form.pdf`
- **Document subtype:** Enrollment/change/cancellation/waiver form with instructions.
- **Publisher:** U.S. Office of Personnel Management (OPM), Federal Employees Health Benefits Program.
- **Jurisdiction/market:** United States federal employees, former employees, and other FEHB-eligible populations covered by SF 2809.
- **Official landing page:** <https://www.opm.gov/healthcare-insurance/healthcare/plan-information/enroll/>
- **Original PDF:** <https://www.opm.gov/forms/pdf_fill/sf2809.pdf>
- **Document date:** Revised November 2019; PDF metadata creation/modification dates are June 2020.
- **Metadata:** 18 pages; US Letter; PDF 1.6; 1,835,759 bytes; tagged; interactive AcroForm; not encrypted.
- **SHA-256:** `10ba6030b6f853c6e205e70b1d3bfee6a6d242e804e5c2fe930bc421a19ccbd6`
- **Fields supported:** enrollee and family-member identities; relationship and dependent eligibility; Medicare and other coverage; current and elected plan names/codes; Self Only/Self Plus One/Self and Family tier; qualifying event and date; non-enrollment, cancellation, or suspension election; signature; agency processing information; permissible change windows.
- **Why distinct:** This is the only blank, fillable election artifact in the set. It tests form controls, dense instructions, event-code tables, affirmative enrollment, and explicit waiver/cancellation paths.
- **Verification notes:** The official OPM URL remains search-indexed as the SF 2809 form, and the local file has a valid `%PDF-1.6` signature, an 18-page unencrypted AcroForm, meaningful text on all pages, and a visually legible first page titled “Health Benefits Election Form.” OPM's CDN returned `403` to an automated HEAD request from this environment on the retrieval date, so URL identity was cross-checked through OPM-indexed search content rather than a fresh byte-for-byte download.
- **Known limitations:** This November 2019 revision is useful as a form-ingestion fixture but is not the latest OPM form for every federal population. Federal eligibility, event codes, and processing fields do not represent a typical private-employer enrollment workflow.

### 02 - CalPERS State Employee Dependent Verification Letter

- **Local file:** `02_calpers_state-dependent-verification-letter.pdf`
- **Document subtype:** Dependent eligibility re-verification notification/requirements letter.
- **Publisher:** California Public Employees' Retirement System (CalPERS).
- **Jurisdiction/market:** California state public employees enrolled in CalPERS-sponsored health coverage.
- **Official landing page:** <https://www.calpers.ca.gov/employers/benefit-programs/health-benefits/dependent-eligibility-verification>
- **Original PDF:** <https://www.calpers.ca.gov/documents/dev-letter-state-verification-letter/download?inline>
- **Document date:** 2021 according to the title/metadata; PDF created January 26, 2021 and modified February 10, 2021.
- **Metadata:** 3 pages; US Letter; PDF 1.6; 132,603 bytes; tagged; not encrypted.
- **SHA-256:** `f980606fa1101f9bcda35f418b542c433bf19c4568601921a129e7d50e94e33b`
- **Fields supported:** participant and CalPERS identifiers as merge placeholders; notice type; due and cancellation-effective dates; dependents requiring verification; eligible relationship categories and age limit; accepted evidence by relationship; evidence recency rules; submission channel; consequences of missing the deadline.
- **Why distinct:** Unlike an enrollment form or general guide, this is a short employer-issued compliance communication. It tests merge-field placeholders, required-proof matrices, deadlines, and dependent-specific continuation/cancellation logic.
- **Verification notes:** The direct CalPERS URL returned `200 application/pdf` and 132,603 bytes, exactly matching the local file size. The local file has a valid `%PDF-1.6` signature, three unencrypted pages, meaningful extracted text, and a visually complete first page showing the CalPERS letterhead and dependent re-verification instructions.
- **Known limitations:** This is a 2021 mail-merge template, not a completed notice. It focuses on periodic dependent re-verification for state employees and does not describe the full initial enrollment process.

### 03 - University of Minnesota New Employees Guide for Benefits Enrollment

- **Local file:** `03_university-of-minnesota_new-employee-benefits-enrollment-guide.pdf`
- **Document subtype:** Initial/new-hire enrollment and eligibility guide.
- **Publisher:** University of Minnesota Office of Human Resources.
- **Jurisdiction/market:** Minnesota public-university employees who are newly hired or newly benefits-eligible.
- **Official landing page:** <https://hr.umn.edu/Benefits/Benefits-Enrollment-and-Changes/New-Employee-or-Newly-Eligible-Enrollment>
- **Official PDF:** <https://hr.umn.edu/sites/hr.umn.edu/files/2022-11/2023_new_employees_10-24-22-final_accessible.pdf>
- **Document date:** 2023 plan year; PDF created October 19, 2022 and modified November 1, 2022.
- **Metadata:** 32 pages; US Letter; PDF 1.7; 1,929,030 bytes; tagged; AcroForm container; not encrypted.
- **SHA-256:** `1a231ddb57083efd9616c741b8d65eb97a8beb592dce0ec1f4c4e40dfe420cf1`
- **Fields supported:** new-hire action checklist and enrollment timing; employee/dependent eligibility; dependent documentation; location-based plan availability; medical, pharmacy, dental, account, life, disability, EAP, retirement, and Medicare-creditable-coverage information; plan comparisons; coverage tiers; biweekly employee rates; contact and enrollment channels.
- **Why distinct:** This is an initial-enrollment package rather than annual enrollment. It combines onboarding deadlines, geographic plan availability, broad benefit elections, costs, and detailed dependent definitions in an employee-facing design.
- **Verification notes:** The direct University of Minnesota URL returned `200 application/pdf` and 1,929,030 bytes, exactly matching the local file size. The local file has a valid `%PDF-1.7` signature, 32 unencrypted pages, meaningful extracted text, and a visually intact first-page cover reading “New Employees Guide for Benefits Enrollment.”
- **Known limitations:** Rates, carriers, deadlines, and plan availability are for the 2023 University of Minnesota plan year and may be obsolete. The guide is unusually broad and mixes eligibility/enrollment data with plan, rate, account, and retirement content that a classifier should route to multiple sections.

### 04 - American University 2025 Benefit Options & Enrollment Guide

- **Local file:** `04_american-university_2025-benefits-options-enrollment-guide.pdf`
- **Document subtype:** Annual/open-enrollment benefit options guide for a defined employee class.
- **Publisher:** American University Office of Human Resources.
- **Jurisdiction/market:** Washington, DC private-university full-time staff and faculty.
- **Official landing page:** <https://www.american.edu/hr/benefits/eligibility.cfm>
- **Official PDF:** <https://www.american.edu/hr/benefits/upload/i-b-oe-2025-fte-guide.pdf>
- **Document date:** 2025 plan year; PDF created and modified November 6, 2024.
- **Metadata:** 26 pages; US Letter; PDF 1.7; 675,554 bytes; tagged; not encrypted.
- **SHA-256:** `8751d5074c7e5e18db940a802325acda66283c4fd688ff8b7da5e506d91446d1`
- **Fields supported:** employee class; plan year and benefit changes; new-hire, open-enrollment, and qualifying-event rules; HIPAA special enrollment; employee and dependent eligibility; salary-banded contribution/rate tables; medical, dental, vision, FSA, life/AD&D, legal, retirement, tuition, disability, and work-life options; waiting-period waiver rules; contacts.
- **Why distinct:** This is the set's annual/open-enrollment example. It exercises plan-year deltas and salary-banded cost tables while also showing that eligibility can vary across benefit types and employee classes.
- **Verification notes:** The direct American University URL returned `200 application/pdf` and 675,554 bytes, exactly matching the local file size. The local file has a valid `%PDF-1.7` signature, 26 unencrypted pages, meaningful extracted text, and a visually complete first-page cover identifying the 2025 full-time staff and faculty guide.
- **Known limitations:** This guide is limited to American University's 2025 full-time employee population. Its salary bands, plan changes, costs, and Workday instructions are employer- and year-specific rather than reusable rules.

### 05 - Wisconsin ETF Qualifying Life Event and Change Reason Companion Guide

- **Local file:** `05_wisconsin-etf_qualifying-life-event-companion-guide.pdf`
- **Document subtype:** HR administrator guide for off-cycle enrollment and qualifying-life-event processing.
- **Publisher:** Wisconsin Department of Employee Trust Funds (ETF), documented jointly with Benefitfocus.
- **Jurisdiction/market:** Wisconsin public employees and HR administrators using the My Insurance Benefits/Benefitplace system.
- **Official landing page:** <https://etf.wi.gov/resource/my-insurance-benefits-qualifying-life-event-and-change-reason-companion-guide>
- **Original PDF:** <https://etf.wi.gov/publications/et-1141>
- **Document date:** ET-1141 revision February 13, 2026; version 1.47.
- **Metadata:** 96 pages; US Letter; PDF 1.7; 1,393,694 bytes; tagged; optimized; not encrypted.
- **SHA-256:** `aca9cac1395ff30618af7415018a899384b46ac1de8b1e36b32161d0d5c9c46a`
- **Fields supported:** initial/open/off-cycle enrollment period; event/change-reason taxonomy; event, change, notification, effective, and end dates; required QLE and dependent-verification documentation; allowed benefit actions; member versus HR responsibilities; adoption, birth, marriage, divorce, loss/gain of coverage, residence, death, job/status, Medicare/Medicaid, leave, court-order, HSA/FSA, and appeal scenarios; payroll confirmation and system workflow.
- **Why distinct:** This is a rules-engine-like administrator manual rather than an employee notice. Its repeated event-specific workflows, date triggers, documentation requirements, and action constraints are useful for extracting normalized QLE policy logic.
- **Verification notes:** The official ETF publication URL redirected to an inline PDF response with `200 application/pdf` and 1,393,694 bytes, exactly matching the local file size. The local file has a valid `%PDF-1.7` signature, 96 unencrypted pages, meaningful extracted text, and a visually intact first-page cover identifying ET-1141 revision 2/13/2026, version 1.47.
- **Known limitations:** This is an HR-administrator system guide, not a concise employee QLE notice. Its event taxonomy, system steps, Wisconsin program rules, and revision-sensitive dates should not be generalized to other employers.

## Coverage of document shapes

| Example | Primary extraction challenge | Main normalized use |
|---|---|---|
| OPM SF 2809 | Fillable fields plus long instruction/event tables | Election or waiver transaction rules |
| CalPERS DEV letter | Mail-merge placeholders plus evidence matrix | Dependent proof and deadline rules |
| Minnesota new-hire guide | Designed booklet with comparisons, rates, and regional variation | Initial enrollment and eligibility |
| American University 2025 guide | Plan-year changes and salary-banded tables | Annual/open enrollment |
| Wisconsin ETF QLE guide | Ninety-six-page administrator workflow manual | Off-cycle event logic and documentation |

## Verification performed

### Reclassified enrollment form

`06_city_of_savannah_2026_benefits_enrollment_form.pdf` is a blank,
employee-facing medical, dental, vision, FSA, life, and beneficiary election
form. It was moved from `current-enrollment-exports` because it is an enrollment
input form, not an exported enrollment roster. Blank fields and checkboxes must
not be treated as completed employee elections.

- Confirmed each download begins as a real PDF and is identified by `file` as a PDF, not HTML or an error page.
- Ran `pdfinfo` on every file to verify page count, dimensions, encryption status, and document metadata.
- Extracted text from every page with `pdftotext -layout`; all five produced meaningful text.
- Rendered page 1 of every PDF with Poppler `pdftoppm` and visually inspected the PNG. All five first pages were legible, complete, and consistent with their publisher/title; no clipping, blank-page substitution, or error content was observed.
- Calculated SHA-256 digests so later replacements or upstream changes can be detected.

These files are examples for ingestion/parser testing, not current benefit advice for a particular employer or employee. Time-sensitive rules and rates must be sourced from the employer's actual plan-year documents.
