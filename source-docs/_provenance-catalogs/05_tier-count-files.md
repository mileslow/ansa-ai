# Tier-count files: five public examples

Five meaningfully different, public examples of documents that can supply or derive enrollment counts by plan and coverage tier for benefits-booklet cost calculations. The set deliberately spans person-level census input, blank regulatory reporting, cross-benefit count summaries, a four-tier premium allocation report, and a multi-plan renewal cost analysis.

Retrieved: **2026-07-17**

## Coverage matrix

| Example | Main role | Tier designs represented | Count/cost dimensions |
|---|---|---|---|
| 01 S4 Wired quote census | Raw census input | Person/dependent rows that derive coverage tiers | Enrolling, waiving, declining, COBRA, ineligible, probationary |
| 02 OPM FEHB Table 1 | Blank regulatory summary | 3 tier: Self, Self Plus One, Self & Family | Employees vs. annuitants; contracts, persons covered, disenrollments |
| 03 Houston County census summary | Cross-benefit aggregate | 1 tier (Life), 2 tier (Dental/Vision), 5 tier (Health) | Active, COBRA, retiree under 65, retiree over 65; counts and employer/employee cost rows |
| 04 North Carolina State Health Plan | Premium-receipt analysis | 4 tier: EE Only, EE + Child(ren), EE + Spouse, EE + Family | Subscriber counts and monthly employer, employee, and dependent premium receipts |
| 05 Crook County renewal analysis | Plan-by-tier cost model | 5 tier: Employee, Employee + Spouse, Family, Employee + Child, Employee + Children | Three current plans, HSA enrollment, tier rates, monthly/annual premium totals, reimbursement scenarios |

Together, the examples cover one-, two-, three-, four-, and five-tier layouts. The labels vary across sources, which is useful for testing tier normalization.

## 01 - S4 Wired Quote Form census and waiver codes

- **Organization:** S4 Benefits
- **Jurisdiction/market:** U.S. group benefits quoting; public broker resource
- **Plan/program design:** Person-level member census with employee, spouse, and child relationships; customer profile for medical, dental, vision, and account-based benefits
- **Document subtype:** Blank/sample quoting census workbook
- **Why distinct:** The only raw spreadsheet in the set. It includes dummy Doe-family sample rows and explicit status codes for active enrollment, waiver to other group coverage, decline/opt-out, COBRA/state continuation, ineligibility, and probationary status. The workbook summary formula counts employees and enrolling employees.
- **Source webpage:** https://www.s4benefits.com/premera-forms/
- **Direct file URL:** https://www.s4benefits.com/media/e3wbbjqr/s4-wired-quote-form_08212023.xlsx
- **Local filename:** `01_s4_wired_quote_census_waiver_codes.xlsx`
- **File metadata:** Microsoft Excel 2007+; 48,074 bytes; SHA-256 `685f73fdab71c36f5f458f7d336b53b5fcb366645fad65e688170ebfb8d1f564`
- **Workbook structure:** `Census` (`B1:K108`, 15 non-empty rows, one formula cell); `Customer Profile` (`A1:K54`, 16 non-empty rows)
- **Key fields/tier logic:** Relationship (`E`, `SP`, `CH`), date of birth, sex, ZIP, enrollment status; employee count; enrolled count; waived/declined count; COBRA count; dependent composition; employer information; current carriers; requested effective date
- **BenefitsPackage uses:** Employer profile, employee/dependent counts, enrollment/waiver status, coverage-tier derivation, participation rate, carrier and effective-date context
- **Verification:** ZIP/XLSX signature confirmed; opened successfully; both sheet names and used ranges inspected; formula `COUNTIF`/`COUNTIFS` summary inspected; Quick Look render visually reviewed; no real PII detected
- **Limitations:** This is a person-level input template, not an already-aggregated plan-by-tier summary. The sample contains fictional John/Jane/JR Doe records. Coverage-tier counts must be derived from relationship and status rows. It has no tier premiums.

## 02 - OPM Table 1: Summary of FEHB Program Enrollment

- **Organization:** U.S. Office of Personnel Management
- **Jurisdiction/market:** Federal Employees Health Benefits Program
- **Plan/program design:** FEHB plan-option reporting for active employees and annuitants
- **Document subtype:** Blank annual enrollment reporting instructions with example data-entry screen
- **Why distinct:** A federal three-tier reporting pattern that separates employees from annuitants and distinguishes contracts, persons covered, and disenrollments for each plan option.
- **Source webpage:** https://www.opm.gov/healthcare-insurance/carriers/fehb/reports/
- **Direct file URL:** https://www.opm.gov/healthcare-insurance/carriers/fehb/reports/summary-of-fehbp-enrollment.pdf
- **Local filename:** `02_opm_fehb_table1_enrollment.pdf`
- **File metadata:** PDF 1.5; 2 pages; 359,497 bytes; letter; unencrypted; SHA-256 `62d1743446d6c42b3770555a992ded410fd055c57a18f1ebcf79c24f6ead955a`
- **Tier scheme:** Self, Self & Family, Self Plus One; repeated for employee and annuitant populations and by FEHB option/plan code
- **BenefitsPackage uses:** Plan option, coverage tier, employee/retiree class, contract count, covered-person count, disenrollment count, plan totals, reporting date
- **Verification:** PDF signature and `pdfinfo` metadata confirmed; text extracted; page 1 and the page 2 Table 1 example rendered and visually reviewed; document identity and three-tier fields confirmed
- **Limitations:** Blank/example reporting guidance rather than a completed employer report. It reports federal contracts and persons covered, not employer payroll costs. “Disenrollments” are transfers out during Open Season, not necessarily benefit waivers.

## 03 - Houston County, Texas census summary

- **Organization:** Houston County, Texas
- **Jurisdiction/market:** Texas county public-employer group benefits
- **Plan/program design:** Fully insured group medical, retiree medical, vision, dental, and life/AD&D procurement
- **Document subtype:** Completed RFP census summary plus contribution and rate-submission forms
- **Why distinct:** One document demonstrates different tier structures by benefit and status-class splits. Health uses five tiers, vision uses two completed tiers, dental provides a two-tier template, and life/AD&D uses employee-only enrollment. Counts are separated across Active, COBRA, Retiree under 65, and Retiree over 65.
- **Source webpage:** https://www.co.houston.tx.us/page/houston.Bids
- **Direct file URL:** https://www.co.houston.tx.us/upload/page/8788/2025%20Bids/RFP%202.pdf
- **Local filename:** `03_houston_county_census_summary.pdf`
- **File metadata:** PDF 1.7; 17 pages; 1,219,064 bytes; letter; unencrypted; SHA-256 `4642333f1b03bb996be4173bc2a4c9d3ada2c07e87c77be41a829b0fd88a0927`
- **Tier/count examples:** Life employee-only = 127; vision employee-only = 56 and employee + family = 15; health includes employee only, employee + one child, employee + children, employee + spouse, and employee + family, with active/retiree counts
- **BenefitsPackage uses:** Offered benefits, tier definitions, tier enrollment counts, active/COBRA/retiree classifications, total participants, employer contributions, employee contributions, retiree contributions, monthly rate fields
- **Verification:** PDF signature and metadata confirmed; text extracted; page 1 and census-summary page 14 (document page 13) rendered and visually reviewed; aggregate tables contain no names or individual identifiers
- **Limitations:** Some dental rows are `N/A`/blank because dental coverage was not populated. Totals are partly left for the proposer/group to complete. The health count table and adjacent contribution form require normalization before calculating full package cost.

## 04 - North Carolina State Health Plan subscriber enrollment and premium receipts

- **Organization:** North Carolina State Health Plan for Teachers and State Employees
- **Jurisdiction/market:** North Carolina public employees and non-Medicare retirees
- **Plan/program design:** Four-tier medical enrollment and premium allocation
- **Document subtype:** Public board presentation with completed enrollment and monthly premium-receipt analysis
- **Why distinct:** Connects exact four-tier subscriber counts to employer contributions, employee/retiree premiums, dependent premiums, and total monthly premiums. It is an unusually complete example for validating weighted cost calculations.
- **Source webpage:** https://www.shpnc.gov/documents/board-trustees/5-2018-benefit-design-changes-finalpdf/open
- **Direct file URL:** https://www.shpnc.gov/documents/board-trustees/5-2018-benefit-design-changes-finalpdf/open
- **Local filename:** `04_nc_state_health_plan_tier_premiums.pdf`
- **File metadata:** PDF 1.5; 25 pages; 298,890 bytes; 720 x 540 pt slides; unencrypted; SHA-256 `130e3b194d7a5c9b95764c91463767213b8da12b037e9e2da66936647f994162`
- **Tier scheme:** EE Only; EE + Child(ren); EE + Spouse; EE + Family
- **Count/cost fields:** Subscribers, tier percentage, employer contributions, employee/retiree premiums, dependent premiums, total premiums, column/row percentages, grand totals
- **BenefitsPackage uses:** Four-tier plan enrollment, enrollment distribution, employer and employee contribution totals, dependent premium share, total monthly premium, cost-allocation percentages
- **Verification:** PDF signature and metadata confirmed; text extracted; cover, tier chart (page 16), and detailed premium table (page 17) rendered and visually reviewed; source note inside the table identifies membership reports and Medicare Advantage invoices
- **Limitations:** Historical 2016/2017 analysis presented for 2018 benefit decisions; not a reusable blank template. The “EE” population combines employees and retirees. It is a statewide plan aggregate, not one employer’s current census.

## 05 - Crook County multi-plan tier cost analysis

- **Organization:** Crook County, Oregon
- **Jurisdiction/market:** Oregon county public-employer medical renewal
- **Plan/program design:** Three current medical plans, including an HSA plan, compared with several $5,000 deductible/reimbursement alternatives
- **Document subtype:** Completed renewal enrollment and cost-analysis exhibit inside a public court agenda packet
- **Why distinct:** The most detailed plan-by-tier example. It ties five-tier enrollment counts for three plan options to tier premiums, monthly/annual totals, employer/employee cost shares, deductible reimbursement exposure, and alternative-plan savings.
- **Source webpage:** https://towncloud-core-prod.s3.amazonaws.com/uploads/crook-county-or/meetings/agenda_packet/pdf_packet/49/crook-county-court-agenda_2023-05-03_205130_combined.pdf
- **Direct file URL:** https://towncloud-core-prod.s3.amazonaws.com/uploads/crook-county-or/meetings/agenda_packet/pdf_packet/49/crook-county-court-agenda_2023-05-03_205130_combined.pdf
- **Local filename:** `05_crook_county_plan_tier_cost_analysis.pdf`
- **File metadata:** PDF 1.7; 93 pages; 7,623,746 bytes; letter; unencrypted; SHA-256 `df36dd8d385fd7e29cb936da77f71bc674216d999ceb448081a860562da0bf45`
- **Tier scheme:** Employee, Employee + Spouse, Family, Employee + Child, Employee + Children
- **Plan/count examples:** Navigator $1,500, Navigator $3,000, and Navigator HSA $2,000 plan counts; plan totals 86, 107, and 6 respectively
- **BenefitsPackage uses:** Multiple plan options, HSA linkage, plan-by-tier enrollment counts, tier rates, total employees, monthly/annual premium by tier, total annual premium, employer/employee contribution split, alternative-plan cost and savings
- **Verification:** PDF signature and metadata confirmed; text extracted; agenda cover and detailed renewal page 89 rendered and visually reviewed; the displayed tier counts, rates, and total-cost rows are legible and internally structured; aggregate data contains no PII
- **Limitations:** The source is a full 93-page agenda packet; relevant benefits analysis is concentrated near pages 88-92. It is a renewal scenario model, not a blank upload template, and some labels use “Family” separately from child tiers in a way that requires normalization.

## Normalization notes

- Map synonymous labels (`Self`, `EE Only`, `Employee`, `Employee Only`) to a canonical employee-only tier while retaining the original label.
- Do not infer a four-tier model when a benefit deliberately uses one or two tiers; store the source tier scheme per plan/benefit.
- Keep subscriber/contract counts separate from covered-person counts.
- Keep active, COBRA, retiree/annuitant, waived, declined, ineligible, and probationary statuses separate until a reporting rule explicitly combines them.
- Cost totals should preserve the original period (per pay period, monthly, annual) and payer (employer, employee/retiree, dependent).
- For person-level census inputs, derive tier counts only after grouping dependents under the subscriber and applying the source enrollment-status codes.
