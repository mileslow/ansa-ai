# Benefit Administration and Payroll Export Source Documents

This folder contains exactly five public, official examples of benefit-administration and payroll interface documents. The set is deliberately varied by system, purpose, file direction, benefit type, and physical format: a federal ASC X12 834 companion guide, an FSA/DCAP payroll-feed workbook, a synthetic benefits-administration enrollment export, a retirement-system payroll/deduction layout, and a group-life carrier eligibility/billing specification.

The source files were retrieved on **2026-07-17** and were not modified. None contains real participant-level personal information. Documents that name fields such as SSN describe production schemas; the only populated member export is an official synthetic scenario file using obvious sample identities.

## Coverage matrix

| # | Organization / system | Interface pattern | Format | Distinctive extraction coverage |
|---|---|---|---|---|
| 01 | CMS Federally-facilitated Exchange | ASC X12 834 enrollment and maintenance | PDF | Medical/dental enrollment, policy, premium, employer contribution, APTC/CSR, lifecycle events |
| 02 | Washington HCA / Navia | FSA, DCAP, HSA, HRA and commuter contribution feed | XLSX | Employee deductions, employer contributions, annual elections, plan dates, pay intervals |
| 03 | Washington HCA Benefits 24/7 | Synthetic annual medical-enrollment export | Pipe-delimited TXT | Member coverage months, carrier, eligibility, enrollment, dependents, Medicare, record status |
| 04 | Alaska DRB BEARS | Employer payroll import layout | PDF | Earnings, deduction plan/code/amount, contribution basis, service units and pay-cycle context |
| 05 | New York City OLR / Management Benefits Fund | Group-life eligibility, reconciliation, billing and carrier payment layouts | PDF | Coverage amounts, deduction amounts, pay cycles, status changes, spouse/dependent coverage |

## 01 - CMS FFE ASC X12 834 companion guide

- **Title:** *CMS Standard Companion Guide Transaction Information - ASC X12 Benefit Enrollment and Maintenance (834)*, version 1.5.
- **Organization:** Centers for Medicare & Medicaid Services (CMS), Center for Consumer Information and Insurance Oversight.
- **Jurisdiction / market:** United States; Federally-facilitated Exchange individual and SHOP medical/dental enrollment transactions between the exchange, state-based exchanges, and qualified plan issuers.
- **Plan / program design:** Batch EDI enrollment lifecycle covering initial enrollment, confirmation/effectuation, cancellation, termination, reinstatement, coverage changes, and reconciliation.
- **Document subtype:** Official technical companion guide supplementing the ASC X12 005010X220/X220A1 834 implementation guide.
- **Why it is distinct:** It is the only EDI transaction standard in the set and the broadest example of one machine file representing several plans, policies, members, coverage events, and financial values.
- **Official source page:** https://www.cms.gov/priorities/key-initiatives/burden-reduction/administrative-simplification/transactions/health-plan-enrollment-disenrollment
- **Direct file URL:** https://www.cms.gov/cciio/resources/regulations-and-guidance/downloads/companion-guide-for-ffe-enrollment-transaction-v15.pdf
- **Retrieved:** 2026-07-17.
- **Local filename:** `01_cms_ffe-834-companion-guide.pdf`
- **File metadata:** PDF 1.5; 1,326,794 bytes; 46 US-letter pages; tagged; unencrypted; no JavaScript; SHA-256 `c2056094165ea56c10b69a8966888af2e99c8166a7a28fe530d68dc7ca13d5c7`.
- **Field / layout inventory:** interchange and functional-group controls; trading-partner and issuer identifiers; subscriber/member identifiers and relationships; member demographics and addresses; policy and assigned QHP identifiers; medical and dental policy loops; plan and coverage-level changes; enrollment, cancellation and termination dates; premium rate and total premium amounts; tobacco and rating-area inputs; advance premium tax credit and cost-sharing reduction values; SHOP employer contribution and member-responsibility reporting categories; acknowledgement and reconciliation instructions.
- **Potential `BenefitsPackage` mappings:** `plans[].carrier`, `plans[].plan_id`, `plans[].coverage_type`, `plans[].coverage_tier`, `employees[]`, `dependents[]`, `enrollments[].effective_date`, `enrollments[].termination_date`, `enrollments[].status`, `rates[].member_premium`, `contributions[].employer_amount`, `contributions[].employee_amount`, and plan/member counts by policy or coverage level.
- **Verification:** File signature and `pdfinfo` confirm a real 46-page PDF rather than HTML. Text extraction confirmed the 834 title, individual/SHOP rate calculations, member-reporting loops, and detailed business-use tables. Page 1 rendered cleanly and was visually inspected; the cover is complete and legible.
- **Known limitations:** The companion guide dates from 2013 and is specific to the FFE implementation of 834, not every employer/carrier integration. The underlying complete ASC X12 TR3 is copyrighted and is not included. EDI files commonly contain highly sensitive member data and require secure ingestion and minimization.

## 02 - Washington SEBB / Navia consolidated payroll file specifications

- **Title:** *SEBB Navia File Specifications* (workbook metadata notes a last specification update of September 19, 2018).
- **Organizations:** Washington State Health Care Authority (HCA) and Navia Benefit Solutions.
- **Jurisdiction / market:** Washington School Employees Benefits Board organizations; payroll reporting for FSA, Limited Purpose FSA, dependent care assistance, HSA, HRA, commuter, and related reimbursement benefits.
- **Plan / program design:** Employer-to-administrator contribution feed capable of carrying employee payroll deductions, employer funding, elections, benefit dates, and related participant setup fields.
- **Document subtype:** Official Excel file-layout workbook with a machine-feed header layout plus a detailed field requirements/data dictionary.
- **Why it is distinct:** It is the only spreadsheet specification in the set and explicitly separates employee deductions, employer per-period contributions, and employee/employer plan-year elections for account-based benefits.
- **Official source page:** https://www.hca.wa.gov/sebb-benefits-admins/sebb-benefits/flexible-spending-arrangements-and-dependent-care-assistance-program
- **Direct file URL:** https://www.hca.wa.gov/assets/perspay/sebb-navia-file-specs.xlsx
- **Retrieved:** 2026-07-17.
- **Local filename:** `02_washington-hca_sebb-navia-payroll-file-specs.xlsx`
- **File metadata:** Office Open XML workbook; 23,676 bytes; 2 worksheets: `Layout` (`A1:BH2`) and `Details` (`A1:U68`); SHA-256 `3568ad7fca06069719fca053a279b7204f894c9729651f2222e17393c9840b47`.
- **Field / layout inventory:** employer code; record type; SSN or unique ID; employee and dependent names, relationship, DOB, sex, address and contacts; pay code and department; benefit code; employee deduction; employer contribution; total annual election; employee and employer plan-year elections; plan start/end and benefit effective/termination dates; leave status; payroll interval; COBRA dates; debit-card and direct-deposit fields; employer subsidy attributes.
- **Potential `BenefitsPackage` mappings:** `employer.group_code`, `employees[]`, `dependents[]`, `accounts[].type`, `accounts[].administrator`, `accounts[].annual_election`, `accounts[].employer_contribution`, `accounts[].employee_deduction`, `accounts[].effective_date`, `accounts[].termination_date`, `payroll.frequency`, and class or department associations useful for account and cost sections.
- **Verification:** The file identifies as Microsoft Excel 2007+ and its OOXML ZIP integrity check passed with no errors. Workbook XML confirmed both sheet names and ranges. The `Layout` sheet contains 60 schema columns and no populated participant row; its only second-row value is the generic record type `CONTRIB`. The `Details` sheet contains 68 rows of field requirements, accepted values, and notes. No HTML or personal record was present.
- **Known limitations:** The workbook is an older specification and should not be treated as proof of the current Navia production schema without administrator confirmation. It contains an external reference to a dropdown-list workbook that is not bundled. A completed production file would contain SSNs, bank details, and other sensitive data that are unnecessary for most booklet-generation tasks and should be redacted or omitted.

## 03 - Washington Benefits 24/7 synthetic full-year enrollment export

- **Title:** *SEBB Sample Full Year EG File*.
- **Organization / system:** Washington State Health Care Authority; Benefits 24/7 / PAY1 medical-enrollment reporting.
- **Jurisdiction / market:** Washington SEBB employer groups; annual medical-enrollment data supporting employer ACA information reporting.
- **Plan / program design:** Pipe-delimited, month-by-month enrollment history for subscribers and dependents, including changes in eligibility and carrier during a coverage year.
- **Document subtype:** Official synthetic flat-file export with three documented scenarios: an employee retiring during the year, an employee adding a spouse, and a new enrollee starting late in the year.
- **Why it is distinct:** This is the only actual machine-readable export sample in the set rather than a guide or schema. Repeated monthly records test aggregation, state transitions, subscriber/dependent grouping, and plan changes.
- **Official source page:** https://www.hca.wa.gov/sebb-benefits-admins/administrative-tools-and-resources/aca-and-tax-related-reporting
- **Direct file URL:** https://www.hca.wa.gov/assets/perspay/sebb-sample-full-year-eg-file.txt
- **Retrieved:** 2026-07-17.
- **Local filename:** `03_washington-hca_benefits247-sample-enrollment-export.txt`
- **File metadata:** ASCII text with CRLF line endings; 8,428 bytes; 28 records, each with 28 pipe-delimited fields; SHA-256 `c72ba3384c7f7d0d529b94c4b95a1f2fb4869b9ac0158b554e77a9f54c7e7832`.
- **Field / layout inventory:** subscriber and member identifiers; coverage year/month; agency/subagency; member type; member name and birthdate; enrollment indicator; carrier code; eligibility type; coverage-offer indicator; medical effective date; member address/country; Medicare indicator; split-account indicator; subscriber ID; record status; and PEBB/SEBB indicator.
- **Potential `BenefitsPackage` mappings:** `employees[]`, `dependents[]`, `enrollments[].coverage_month`, `enrollments[].carrier`, `enrollments[].plan_code`, `enrollments[].eligibility_type`, `enrollments[].status`, `enrollments[].effective_date`, `enrollment_counts.by_plan`, `enrollment_counts.by_member_type`, and plan-change or retirement events. These records can supply participation counts but not premiums on their own.
- **Verification:** Parsed as 28 lines with a consistent 28 fields per line; no HTML/error markers were present. Names and scenarios match the source page's explicitly identified synthetic examples (Jonathan Q Public, Jane A Doe / John B Doe, and Sheila S Newby). The file contains no header row, so its order was cross-checked against HCA's linked Medical Enrollment Data Dictionary.
- **Known limitations:** The sample uses synthetic identifier values but still models an SSN-based production layout; ingestion should never assume such identifiers are safe in a real upload. It has enrollment/carrier information but no premiums, employee payroll deductions, or employer contribution amounts. Carrier codes and yearly eligibility rules are Washington-program specific.

## 04 - Alaska BEARS payroll file layout example

- **Title:** *BEARS File Layout Examples - Payroll File Layout*.
- **Organization / system:** Alaska Division of Retirement and Benefits; Benefits and Retirement System (BEARS).
- **Jurisdiction / market:** Alaska public employers reporting retirement and related payroll/contribution data.
- **Plan / program design:** One employer-file header followed by grouped employee earnings, deduction, and service records for each payroll period.
- **Document subtype:** One-page visual example of a multi-record CSV/import layout, using schematic `Employee 1` and `Employee 2` rows rather than participant data.
- **Why it is distinct:** It shows how payroll exports split one employee across record types and pairs benefit deductions with earnings basis, employer retirement/HRA context, and service units.
- **Official source page:** https://drb.alaska.gov/help/employer.html
- **Direct file URL:** https://drb.alaska.gov/docs/materials/BEARSPayrollLayoutExample.pdf
- **Retrieved:** 2026-07-17.
- **Local filename:** `04_alaska-drb_bears-payroll-layout-example.pdf`
- **File metadata:** PDF 1.7; 130,008 bytes; 1 landscape US-letter page; tagged; AES-256 permission encryption (printing allowed, copying restricted); no JavaScript; SHA-256 `6e7eedfd5f16b4381a43c0c1862b15f57062e2dff1ec4640682dff064373658f`.
- **Field / layout inventory:** organization code; payroll run ID; interface run date and version; employee SSN/ID and appointment; retirement system and pay cycle; pay-period end and issue dates; transaction type; regular earnings; paycheck number; ending leave balance; deduction type; deduction plan code; deduction amount; basis and geographic-differential basis amounts; service date, type, and units.
- **Potential `BenefitsPackage` mappings:** `employer.group_code`, `employees[].employment_id`, `employees[].employee_class_or_appointment`, `payroll.pay_cycle`, `payroll.pay_period_end`, `deductions[].benefit_code`, `deductions[].employee_amount`, `contributions[].basis_amount`, `employees[].earnings`, and account/contribution summaries by plan code.
- **Verification:** `pdfinfo` confirmed a valid one-page PDF. Text extraction confirmed the payroll, earnings, deduction, and service record labels. The full page rendered cleanly and was visually inspected; all tables and the Employee 1 / Employee 2 legend are legible. No participant values are present.
- **Known limitations:** This is a schematic layout example, not a downloadable CSV or a populated payroll report. The companion employer page provides additional record-count and code rules that are not repeated on the one-page artifact. The schema is retirement-system centered, so deductions require code mapping before they can be associated with health, HRA, or other booklet sections.

## 05 - NYC Management Benefits Fund group-life interface layouts

- **Title:** *Request for Proposals to Provide Group Universal Life Insurance Benefits*, including Exhibits I-IV file layouts.
- **Organization / system:** City of New York Office of Labor Relations, Management Benefits Fund.
- **Jurisdiction / market:** New York City management employees and retirees; group universal life, AD&D, and optional term life administration.
- **Plan / program design:** Bidirectional employer/carrier administration: member eligibility and salary updates, carrier reconciliation, employer billing, and monthly payment/remittance status.
- **Document subtype:** Official procurement specification containing four fixed-width carrier interface layouts on PDF pages 38-41.
- **Why it is distinct:** It is the only example that connects eligibility, coverage amounts, payroll deductions, carrier billing, reconciliation, and remittance/status in one source, and it is specific to life insurance rather than medical or spending accounts.
- **Official source context:** https://www.nyc.gov/assets/olr/downloads/pdf/rfp/notice-of-solicitation-gul-2016.pdf
- **Direct file URL:** https://www.nyc.gov/assets/olr/downloads/pdf/rfp/MBF-12-29-2016-RFP-GUL-214150000431.pdf
- **Retrieved:** 2026-07-17.
- **Local filename:** `05_nyc-olr_group-life-eligibility-billing-file-layouts.pdf`
- **File metadata:** PDF 1.5; 567,971 bytes; 67 US-letter pages; tagged; unencrypted; no JavaScript; SHA-256 `3107da937e8fec2bb728bbe4f308850fecc11e7184ddc8472b2204014cda5cb4`.
- **Field / layout inventory:** employee and spouse identifiers/demographics; address; hire date; payroll and agency codes; bill type and pay period; salary; smoking indicator; employee/spouse/child effective and termination dates; employee/spouse/child coverage amounts; life-insurance and cash amounts; deduction amount; carrier reconciliation billing amount; coverage frequency; new/change/delete action; deduction date; and active, termination, deduction-shortage, transfer, leave, and retired status codes.
- **Potential `BenefitsPackage` mappings:** `life_plans[].type`, `life_plans[].coverage_amount`, `life_plans[].employee_cost`, `life_plans[].spouse_cost`, `life_plans[].dependent_coverage`, `employees[].salary`, `enrollments[].effective_date`, `enrollments[].termination_date`, `payroll.frequency`, `billing.amount`, and reconciliation/status exceptions that may require broker clarification.
- **Verification:** File signature and `pdfinfo` confirmed a valid 67-page PDF. Text extraction located all four interface exhibits and their deduction/pay-cycle fields. Page 1 and PDF pages 38-41 were rendered and visually inspected; the cover and every file-layout table are complete and legible. The layouts are schemas only; later census figures are aggregated and contain no individual records.
- **Known limitations:** The procurement package dates from 2016 and should be treated as a realistic historical schema, not a current NYC production specification. It is group-life specific and requests SSNs in production. Several codes and field names reflect older terminology and require normalization before use.

## Privacy and ingestion notes

- Treat real benefit-administration and payroll exports as restricted data. They may contain SSNs, DOBs, addresses, compensation, bank details, coverage elections, and dependent information.
- For booklet generation, prefer aggregate tier counts, plan codes, contribution amounts, and payroll frequencies. Redact direct identifiers whenever participant-level linkage is unnecessary.
- Preserve original source files separately from normalized facts. Associate one upload with every section it supports: eligibility, medical enrollment, HSA/HRA/FSA, life insurance, employee cost tables, employer contributions, and contact/clarification workflows.
- Apply explicit code mapping. Values such as carrier codes, benefit codes, deduction plan codes, status codes, and EDI qualifiers are system-specific and should never be interpreted without the source dictionary.

