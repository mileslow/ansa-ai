# Rates, Contributions, and Payroll Source Examples

Five real, public source-document examples showing materially different ways benefit costs arrive. These are originals downloaded from official government or public-employer sources; the spreadsheets were not edited. Retrieval date for every file: **2026-07-17**.

## Coverage at a glance

| # | Source pattern represented | Example |
|---|---|---|
| 01 | Payroll withholding and employer-contribution workbook | U.S. OPM FEHB payroll rates |
| 02 | Full carrier/plan premium workbook | Wisconsin ETF state employee health rates |
| 03 | Employee contribution and renewal/open-enrollment rate schedule | New York NYSHIP active employee rates |
| 04 | Employer base contribution plus composite plan/tier rates | Washington PEBB employer-group memo |
| 05 | Carrier-filed, regulator-approved small-group rate package | Anthem New York approved rates |

## 01 - 2026 FEHB Payroll Rates

- **Title:** 2026 FEHB Payroll Rates_100525
- **Organization:** U.S. Office of Personnel Management (OPM)
- **Jurisdiction / market:** United States; Federal Employees Health Benefits (FEHB) Program; agency payroll offices
- **Subtype:** Payroll-withholding and government-contribution workbook
- **Why it is distinct:** This is machine-readable payroll input rather than a member-facing premium flyer. It separates government, employee, spouse-enrollee, and Temporary Continuation of Coverage amounts at biweekly, monthly, and semimonthly frequencies across 396 enrollment-code rows.
- **Official source page:** https://www.opm.gov/healthcare-insurance/healthcare/transparency-in-healthcare/public-use-files/
- **Direct file URL:** https://www.opm.gov/healthcare-insurance/healthcare/transparency-in-healthcare/public-use-files/2026/fehb/2026-fehb-payroll-rates-100525.xlsx
- **Local file:** `01_opm_2026_fehb_payroll-rates.xlsx`
- **File details:** XLSX; 66,077 bytes; 1 sheet (`FEHBPayroll Rates_2026`), used range `A1:M397`
- **Verification:** Server reported the XLSX MIME type and matching content length; file identified as Microsoft Excel 2007+; OOXML ZIP integrity passed; workbook XML was inspected and contained the documented headers and populated rate rows. SHA-256: `d6a76de1ac34a152e114cceba468e07171938e7af66f4b2196065a3a3f72c077`.
- **Fields supported:** enrollment code; government-paid amount; employee-paid amount; spouse-enrollee amount; TCC amount; biweekly, monthly, and semimonthly versions of each amount
- **Important dependency:** Plan names are not in this payroll file; an FEHB plan-key file is needed to resolve enrollment codes to plan/option names.

## 02 - 2027 Wisconsin State Employee Full Premium Rates

- **Title:** 2027 State Employee Health Plan with Dental / without Dental
- **Organization:** Wisconsin Department of Employee Trust Funds (ETF)
- **Jurisdiction / market:** Wisconsin; state employee group health; participants without Medicare
- **Subtype:** Full premium carrier/plan rate workbook
- **Why it is distinct:** This workbook provides total monthly premiums before isolating employee payroll deductions. It compares many regional carriers and plan designs, including Choice, HDHP, Access, and Access HDHP, with both individual/family tiers and with/without-dental variants.
- **Official source page:** https://etf.wi.gov/employers/insurance-programs/group-health-insurance
- **Direct file URL:** https://etf.wi.gov/insmedia/2027/state-full-premium-rates
- **Local file:** `02_wisconsin-etf_2027_state-full-premium-rates.xlsx`
- **File details:** XLSX; 14,489 bytes; 2 sheets: `With Dental` (`A1:F30`) and `Without Dental` (`A1:G30`)
- **Verification:** Redirect resolved to an official ETF download with the XLSX MIME type and filename `2027StateEmployeeHealthPlan.xlsx`; file identified as Microsoft Excel 2007+; OOXML ZIP integrity passed; both sheets and populated carrier/rate rows were inspected. SHA-256: `4c6564c816dd95ad1b4fc6007f9d540ab24759d18dccb39bcdcae9b228f7c858`.
- **Fields supported:** carrier/health-plan name; plan design; individual premium; family premium; HDHP premium; Access-plan premium; with-dental premium; without-dental premium; monthly frequency; non-Medicare population

## 03 - NYSHIP 2026 Rates and Deadlines for Active Employees

- **Title:** NYSHIP Rates and Deadlines for 2026 - Enrollee Contributions for Employees of New York State
- **Organization:** New York State Department of Civil Service, Employee Benefits Division
- **Jurisdiction / market:** New York; active state employees and covered dependents; Empire Plan and regional NYSHIP HMOs
- **Subtype:** Employee contribution, payroll-deduction, and annual renewal/open-enrollment rate schedule
- **Why it is distinct:** It varies employee contributions by salary-grade band, individual/family coverage, plan, and HMO service area. It also documents the State's contribution percentages, payroll timing, deadlines, and pre-tax contribution election context.
- **Official source page:** https://www.cs.ny.gov/employee-benefits/nyship/shared/option-transfer/guide/cost-coverage.cfm
- **Direct file URL:** https://www.cs.ny.gov/employee-benefits/nyship/shared/publications/rates/2026/ny-active-rates-2026.pdf
- **Local file:** `03_nyship_2026_active-employee-contribution-rates.pdf`
- **File details:** PDF 1.7; 2,254,351 bytes; 7 pages
- **Verification:** Server reported `application/pdf` and the matching content length; PDF signature and Poppler structure checks passed; text extraction confirmed contribution tables and plan codes; all seven pages were rendered and visually reviewed as legible. SHA-256: `8e07996958f47c9c9190dc2525c8fa3d62bfab832a42c4e011a7be360435d82b`.
- **Fields supported:** plan code and name; individual/family employee contribution; salary grade band; State premium contribution percentages; HMO service area; biweekly frequency; payroll/deadline dates; pre-tax election information; contact information

## 04 - Washington PEBB FY 2026-27 Composite Rates

- **Title:** Fiscal Year (FY) 2026-27 PEBB Program Rates - Composite
- **Organization:** Washington State Health Care Authority, Public Employees Benefits Board (PEBB)
- **Jurisdiction / market:** Washington; counties, municipalities, political subdivisions, and tribal governments participating in PEBB
- **Subtype:** Employer base-rate/contribution memo with plan- and tier-level composite premiums
- **Why it is distinct:** It begins with an employer base rate per employee per month, then supplies total premiums by carrier plan and enrollment tier, plus tobacco and spouse-waiver surcharges. It explicitly describes the employer's role in collecting employee contributions and remitting the total billed amount.
- **Official source page:** https://www.hca.wa.gov/employee-retiree-benefits/employer-group-monthly-premiums
- **Direct file URL:** https://www.hca.wa.gov/assets/perspay/pebb-counties-july-dec-2026.pdf
- **Local file:** `04_washington-pebb_fy2026-27_composite-rates.pdf`
- **File details:** PDF 1.7; 370,547 bytes; 2 pages
- **Verification:** Server reported `application/pdf` and the matching content length; PDF signature and Poppler structure checks passed; extracted text confirmed the $1,334 employer base rate, plan/tier premium table, and surcharges; both pages were rendered and visually reviewed as legible. SHA-256: `843cdf754887450d74c327b75994039e75933ec553520a3154b01dd44a9dd511`.
- **Fields supported:** effective period; employer base rate; medical plan; subscriber-only premium; subscriber-and-spouse premium; subscriber-and-children premium; full-family premium; tobacco surcharge; spouse-waiver surcharge; employer billing/remittance instructions

## 05 - Anthem New York 2026 Small-Group Approved Rates

- **Title:** Anthem HealthChoice Assurance, Inc. 2026 Small Group Approved Rates Template package, SERFF `AWLP-134513697`
- **Organizations:** Anthem HealthChoice Assurance, Inc.; published by the New York State Department of Financial Services (NYSDFS)
- **Jurisdiction / market:** New York; ACA-compliant small-group, both on- and off-exchange EPO market
- **Subtype:** Regulator-approved carrier rate-data package
- **Why it is distinct:** This is an actual carrier filing artifact rather than an employer summary. The package contains four populated macro-enabled rate templates with HIOS issuer and plan identifiers, quarterly effective/expiration dates, New York rating areas, and detailed individual/family-tier premiums. The NYSDFS index also records requested versus approved year-over-year rate changes.
- **Official source page:** https://myportal.dfs.ny.gov/web/prior-approval/ind-and-sg-medical/additional-information-2026
- **Direct file URL:** https://myportal.dfs.ny.gov/documents/538523/45010883/Anthem_HCA_SG_BOTHX_AWLP-134513697_ApprRatesTemplate
- **Local file:** `05_anthem-ny_2026_small-group-approved-rates.zip`
- **File details:** ZIP; 2,411,906 bytes; 4 XLSM workbooks. Each workbook has 7 sheets (`EnableMacros`, `Master`, four rate-table sheets, and `names`); populated rate-table ranges extend from 265 to 3,645 rows.
- **Verification:** Server reported `application/zip`, matching content length, and the official attachment filename; outer ZIP integrity passed; all four embedded XLSM files identified as Microsoft Excel 2007+ and passed nested OOXML ZIP integrity; workbook XML was inspected and contained populated plan/rating-area/rate records. SHA-256: `ad1351ae17ac02ea6bda99ae99026635523231d7f7cb62e181d63b9c5ab5ae29`.
- **Fields supported:** HIOS issuer ID; 14-character plan ID; rate effective/expiration dates; rating method; rating area; tobacco basis; age/family option; individual rate; individual tobacco rate; couple rate; subscriber-plus-dependent rates; couple-plus-dependent rates
- **Safety note:** These are macro-enabled carrier workbooks. They were inspected without enabling or executing macros.

## Known gap

Commercial group renewal quotes, broker proposal worksheets, employer contribution workbooks, invoices, and payroll-system exports are usually customer-specific and not published publicly. The five examples above cover their major data shapes with authentic public analogues, but they do not include a confidential employer-specific renewal packet or a live payroll export.
