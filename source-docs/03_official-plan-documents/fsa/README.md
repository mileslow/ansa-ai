# Flexible Spending Account source documents

This folder contains exactly five real, public FSA documents selected to exercise materially different booklet-generation inputs. Together they cover a general-purpose health care FSA, dependent care rules, a formal limited-purpose FSA plan with carryover provisions, an administrator-oriented employee and claims guide, and a combined enrollment/change form.

All files were retrieved on 2026-07-17. Each file was checked by file signature, inspected with `pdfinfo`, text-extracted with `pdftotext`, rendered with Poppler, and visually reviewed on page 1. None is HTML or an error page.

## Coverage map

| File | Primary FSA design or role | Organization | Market or jurisdiction | Why it is distinct |
| --- | --- | --- | --- | --- |
| `01_calhr_2026_medical-reimbursement-account-flyer.pdf` | Health care FSA / Medical Reimbursement Account | California Department of Human Resources (CalHR), administered by ASIFlex | California state employees | A short, employee-facing health care FSA flyer with eligible expenses, grace-period language, and reimbursement channels. |
| `02_irs_2025_publication-503-dependent-care-expenses.pdf` | Dependent care FSA / federal tax rules | Internal Revenue Service | United States federal tax jurisdiction | Primary federal guidance on qualifying people, work-related care, dependent care benefits, tax limits, and interaction with the dependent care credit. |
| `03_washington-sebb_2025_salary-reduction-plan-limited-purpose-fsa.pdf` | Limited-purpose FSA, general FSA, and DCAP formal plan document | Washington State Health Care Authority / School Employees' Benefits Board | Washington charter-school employees | A legal plan instrument defining elections, claims, forfeiture, carryover, COBRA, LPFSA/HSA coordination, and DCAP. |
| `04_wex_fsa-employee-guide.pdf` | FSA administrator and claims/member guide | WEX Benefits You / Mercer Marketplace 365+ | National employer-sponsored benefits market | A visual employee guide spanning Medical, Combination/Post-Deductible, and Dependent Care FSAs, card use, claims, substantiation, and mobile/online administration. |
| `05_nyc_2026_fsa-enrollment-change-form.pdf` | Enrollment and midyear change form for HCFSA and DeCAP | City of New York Office of Labor Relations | New York City public employees | A fillable operational form containing participant, dependent, election, payroll, qualifying-event, direct-deposit, and authorization fields. |

## 01 - CalHR 2026 Medical Reimbursement Account Flyer

- **Local file:** `01_calhr_2026_medical-reimbursement-account-flyer.pdf`
- **Title:** 2026 Medical Reimbursement Account Flyer
- **Organization:** California Department of Human Resources (CalHR); program administrator ASIFlex
- **Jurisdiction / market:** California state employees
- **FSA design:** General-purpose health care FSA, called a Medical Reimbursement Account (MRA) in the document
- **Document subtype:** Employee education flyer
- **Why distinct:** This is the smallest employee-facing example in the set. It emphasizes eligible medical, dental, vision, hearing, prescription, and over-the-counter expenses; a 2.5-month post-plan-year grace period; claim-submission routes; and direct deposit rather than formal plan-law language.
- **Source page:** https://benefits.calhr.ca.gov/open-enrollment/virtual-library/coben-flex-accounts-bookshelf/
- **Direct file URL:** https://benefits.calhr.ca.gov/wp-content/uploads/sites/362/2025/12/2026-Medical-Reimbursement-Account-Flyer.pdf
- **Retrieved:** 2026-07-17
- **File metadata:** PDF 1.7; 2 pages; 191,504 bytes; US Letter portrait
- **SHA-256:** `d19788494e8f6dd9986e90ecec1d9c07327eddc83b67622418188f3318dd3a29`
- **Potential booklet / BenefitsPackage fields:** account type and display name; eligible participants and dependents; eligible expense categories; grace-period duration; claim methods; documentation examples; reimbursement timing; direct-deposit availability; administrator name, website, phone, fax, email, and mailing address.
- **Verification:** `file` identified a 2-page PDF; `pdfinfo` reported an unencrypted PDF with no JavaScript; `pdftotext` recovered the MRA explanation, expense categories, grace period, claims process, and ASIFlex contacts; page 1 rendered cleanly and visibly identified CalHR and the 2026 MRA flyer.
- **Known limitations:** It is a promotional summary, not an SPD or governing plan document. The flyer says the contribution limit is set annually and directs the reader to the employer plan rather than stating the plan-specific limit. Its internal footer is `CA_06_2024`, despite the 2026 cover.

## 02 - IRS Publication 503, Child and Dependent Care Expenses

- **Local file:** `02_irs_2025_publication-503-dependent-care-expenses.pdf`
- **Title:** Publication 503 (2025), Child and Dependent Care Expenses
- **Organization:** U.S. Department of the Treasury, Internal Revenue Service
- **Jurisdiction / market:** United States federal tax rules; 2025 tax returns
- **FSA design:** Dependent Care Flexible Spending Account / dependent care assistance benefits
- **Document subtype:** Government tax publication
- **Why distinct:** This is the primary-law-adjacent federal rules example. It explains qualifying-person tests, earned-income and work-related-expense tests, eligible and ineligible care, provider identification, dependent care benefits, exclusions, and coordination with the child and dependent care credit.
- **Source page:** https://www.irs.gov/forms-pubs/about-publication-503
- **Direct file URL:** https://www.irs.gov/pub/irs-pdf/p503.pdf
- **Retrieved:** 2026-07-17
- **File metadata:** PDF 1.7; 20 pages; 1,326,038 bytes; US Letter portrait; tagged
- **SHA-256:** `3a00d0c1a1d6d3a88afdf418b79873f95f6d2de584c330ec67647139c09c5532`
- **Potential booklet / BenefitsPackage fields:** dependent care account type; qualifying-person definition; age and incapacity rules; work-related expense criteria; eligible care categories; ineligible provider relationships; earned-income constraints; federal exclusion/credit interaction; tax-year limits and filing references.
- **Verification:** `file` and `pdfinfo` identified a valid, unencrypted 20-page IRS PDF; `pdftotext` recovered Publication 503 headings and detailed dependent-care rules; page 1 rendered cleanly with the IRS mark, publication number, 2025 tax-year label, and publication date.
- **Known limitations:** This is federal tax guidance, not an employer's plan document or enrollment guide. It does not identify an employer contribution, payroll frequency, plan administrator, run-out period, or employer-specific election maximum. Tax-year values must not be reused for another plan year without validation.

## 03 - Washington SEBB Charter Schools Salary Reduction Plan

- **Local file:** `03_washington-sebb_2025_salary-reduction-plan-limited-purpose-fsa.pdf`
- **Title:** State of Washington Salary Reduction Plan for the School Employees' Benefits Board: Charter Schools, Fifth Restatement
- **Organization:** Washington State Health Care Authority / School Employees' Benefits Board (SEBB)
- **Jurisdiction / market:** Washington charter-school employees; effective 2025-01-01
- **FSA design:** General FSA, Limited Purpose FSA, and Dependent Care Assistance Program under a Section 125 salary-reduction plan
- **Document subtype:** Formal governing plan document
- **Why distinct:** This is the legal-plan example and the strongest source for exact plan provisions. Article VII establishes the LPFSA, sets election and claim rules, defines forfeiture and continuation coverage, states the 2025-to-2026 carryover mechanics, coordinates an FSA carryover with an HSA/LPFSA election, and prohibits simultaneous general FSA and LPFSA enrollment.
- **Source page:** https://www.hca.wa.gov/sebb-benefits-admins/sebb-benefits/flexible-spending-arrangements-and-dependent-care-assistance-program
- **Direct file URL:** https://www.hca.wa.gov/assets/pebb/sebb-charter-school-salary-reduction-plan-2025.pdf
- **Retrieved:** 2026-07-17
- **File metadata:** PDF 1.6; 46 pages; 580,631 bytes; US Letter portrait; tagged; AcroForm present
- **SHA-256:** `22cd977bf6d6c1cf7bc1739279a91cef165e9364bc15102cdc31805450333ca7`
- **Potential booklet / BenefitsPackage fields:** formal plan name and effective date; eligible employee definitions; FSA/LPFSA/DCAP offerings; annual minimums and maximums; salary-reduction election rules; LPFSA eligible expense scope; claim deadline and required substantiation; forfeiture and run-out rules; carryover amount and minimum-balance condition; HSA coordination; COBRA/continuation coverage; leave and termination rules; DCAP contribution constraints.
- **Verification:** `file` and `pdfinfo` identified a valid, unencrypted 46-page tagged PDF; `pdftotext` recovered the table of contents and complete Articles VI-VIII. Text inspection confirmed Article VII's LPFSA establishment, $3,200 2025 maximum, March 31 run-out deadline, $660 2025-to-2026 carryover ceiling, HSA conversion rule, and general-FSA/LPFSA enrollment prohibition. Page 1 rendered cleanly with the Washington plan title and effective date.
- **Known limitations:** It is a dense legal plan for a specific Washington SEBB charter-school population, not a general employee summary. Monetary limits are explicitly tied to the 2025 plan year and may be superseded by later amendments or cost-of-living adjustments. Some booklet-friendly explanations must be synthesized from multiple provisions without changing their legal meaning.

## 04 - WEX Flexible Spending Account Employee Guide

- **Local file:** `04_wex_fsa-employee-guide.pdf`
- **Title:** Flexible Spending Account Employee Guide, Mercer Marketplace 365+
- **Organization:** WEX Benefits You / Mercer Marketplace 365+
- **Jurisdiction / market:** National employer-sponsored benefits administration
- **FSA design:** Medical FSA, Combination/Post-Deductible FSA, and Dependent Care FSA
- **Document subtype:** Administrator employee/member and claims guide
- **Why distinct:** This is the broad operational guide. It explains how several FSA designs work, includes a tax-savings example, discusses carryover/grace-period possibilities, and shows card, mobile-app, online-account, reimbursement, recurring dependent-care, and claims-substantiation workflows.
- **Source page:** https://www.wexbenefitsyou.com/resource_document_list/mmx-employee-guides/page/4/
- **Direct file URL:** https://www.wexbenefitsyou.com/wp-content/uploads/2021/02/fsa-employee-guide.pdf
- **Retrieved:** 2026-07-17
- **File metadata:** PDF 1.6; 12 pages; 3,760,842 bytes; US Letter landscape; document footer dated 2022-07-29
- **SHA-256:** `eee06c69f2ac1de7ff5f8a8fc904d00bae8c54d98cf71b1868e7849c9db24364`
- **Potential booklet / BenefitsPackage fields:** available FSA design labels and descriptions; HSA compatibility; eligible expense examples; fund-availability timing; use-it-or-lose-it language; optional carryover/grace-period flag; qualifying-event examples; benefits-card availability; reimbursement and recurring-care methods; medical and dependent-care documentation requirements; mobile and online administration channels; HIPAA representative language.
- **Verification:** `file` and `pdfinfo` identified a valid, unencrypted 12-page PDF; `pdftotext` recovered the Medical, Combination, and Dependent Care FSA explanations plus claims and substantiation sections; page 1 rendered cleanly with the employee-guide title and Mercer Marketplace 365+ branding.
- **Known limitations:** This is educational administrator material, not the controlling SPD. It is branded for Mercer Marketplace 365+ and dated 2022, so interface names, contacts, tax examples, and app instructions may not represent a current employer plan. It states that an employer may offer carryover or a grace period but does not establish either option for a specific plan.

## 05 - New York City 2026 FSA Enrollment/Change Form

- **Local file:** `05_nyc_2026_fsa-enrollment-change-form.pdf`
- **Title:** Plan Year 2026 Enrollment/Change Form, Flexible Spending Accounts Program
- **Organization:** City of New York Office of Labor Relations, Flexible Spending Accounts Program
- **Jurisdiction / market:** New York City public employees; 2026 plan year
- **FSA design:** Health Care Flexible Spending Account (HCFSA) and Dependent Care Assistance Program (DeCAP)
- **Document subtype:** Fillable enrollment and midyear election-change form with plan notices
- **Why distinct:** This is the structured-input example. It captures the data an ingestion system may need to extract from a blank or completed form: participant and dependent demographics, account selection, annual elections, payroll treatment, qualifying events, banking data, authorizations, and signatures.
- **Source page:** https://www.nyc.gov/site/olr/fsa/fsa-forms-and-downloads.page
- **Direct file URL:** https://www.nyc.gov/assets/olr/downloads/pdf/fsa/2026-fsa-ec-form.pdf
- **Retrieved:** 2026-07-17
- **File metadata:** PDF 1.6; 4 pages; 415,714 bytes; US Letter portrait; tagged; AcroForm and JavaScript present
- **SHA-256:** `b65c4186ab0045798a3dabe5836c3dff5e6edfe8719ca584bc676800a84ec630`
- **Potential booklet / BenefitsPackage fields:** plan year; HCFSA/DeCAP offering and participant selection; enrollment reason; qualifying event and date; hire and benefit-effective dates; participant, spouse, and dependent data; coverage/election amount; plan minimum and maximum; payroll frequency note; employer/agency; continuation coverage; direct-deposit choice; salary-reduction authorization; administrative fee; grace/run-out/forfeiture language; signature date.
- **Verification:** `file` and `pdfinfo` identified a valid, unencrypted 4-page PDF with an AcroForm; `pdftotext` recovered the HCFSA/DeCAP choices, 2026 election limits, qualifying-event section, direct-deposit section, and authorizations; page 1 rendered cleanly and showed intact form fields, labels, tables, and City of New York branding.
- **Known limitations:** This is a blank form and therefore contains no real employee elections. It includes sensitive fields such as SSN, date of birth, home address, and bank details; completed instances require strict privacy controls and should not be included in public test corpora. Embedded JavaScript supports form behavior and should be handled safely by ingestion pipelines. It is specific to New York City and the 2026 plan year.

## Ingestion notes

- Treat these as five separate document classes, not interchangeable plan summaries.
- Never infer an employer-specific election, contribution, carryover, grace period, or administrator from federal guidance or a generic vendor guide.
- Date-stamp extracted limits and preserve their source because FSA limits and plan options change by year.
- Route completed enrollment forms through PII-sensitive processing and storage.
- A single FSA booklet section may legitimately need several of these roles at once: a governing plan or SPD, an employee summary, an enrollment form, an administrator claims guide, and federal eligibility guidance.
