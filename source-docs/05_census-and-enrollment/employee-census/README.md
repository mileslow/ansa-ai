# Employee Census Source Documents

This folder contains exactly five public employee-benefits census examples from four carriers and one benefits administrator. The set is deliberately varied by purpose, jurisdiction, file format, and data model: ancillary-benefit quoting, medical quoting, full small-group enrollment, benefits-administration onboarding, and a printable census/rating form.

All five files are blank templates or contain only generic instructional sample rows. None contains a completed employer census or real employee personal data. The sources were retrieved on 2026-07-17.

## Coverage matrix

| # | Organization | Market and purpose | Format | Distinctive extraction coverage |
|---|---|---|---|---|
| 01 | Guardian | Group life, disability, and other benefits quote census | XLS | Salary, employee class, job title, home/work ZIP |
| 02 | Blue Cross Blue Shield of Arizona (AZ Blue) | Minimal online group-quote upload | CSV | Relationship, DOB, gender, salary, occupation |
| 03 | Health Net Oregon | 2026 small-business enrollment and waiver census | XLSX | Multiple medical/dental/vision/life elections, dependents, COBRA, Medicare, waivers |
| 04 | Nurture Benefits | Benefits-administration employee onboarding census | XLSX | Eligibility class, pay basis, hours, ACA classification, payroll group |
| 05 | Kaiser Permanente Northwest | Oregon small-group census and rating form | PDF | Eligibility, coverage tier, spouse/dependent ages, waiver reason |

Across the set, the documents exercise DOB/age, employee and dependent relationships, home/work ZIP or region, employee class, hours-based eligibility, coverage tier, current elections, salary/pay inputs, COBRA, Medicare, and waiver handling. No single source is expected to contain every field.

## 01 - Guardian group-benefits quote census

- **Organization:** The Guardian Life Insurance Company of America.
- **Jurisdiction / market:** United States group employee benefits; the template is not state-specific.
- **Plan or program design:** Quote census for group benefits where salary, occupation, or class may influence life and disability benefits or rating.
- **Document subtype:** Legacy Excel member census template with a separate instruction sheet.
- **Why it is distinct:** This example is centered on ancillary and salary-based benefits rather than medical plan enrollment. It carries both home and work ZIP, employee class, annual salary, and job title.
- **Source webpage URL:** https://www.guardianlife.com/business/employee-benefits-quote
- **Direct file URL:** https://go.pardot.com/l/503851/2019-09-17/3t7ncb/503851/103773/guardian_census_template.xls
- **Retrieved:** 2026-07-17.
- **Local filename:** `01_guardian_group-benefits-quote-census.xls`
- **File metadata:** Microsoft Compound File Binary / Excel 97-2003 (`.xls`); 53,248 bytes; SHA-256 `57d2752b26428fb89e441b743585e8a8e3ce217ae13b81efa55bce9b186349ee`.
- **Worksheets and used ranges:** 2 worksheets: `Instructions` (29 rows x 14 columns) and `Member Template` (1 row x 14 columns).
- **Column / field inventory:** last name; first name; middle initial; gender; date of birth; address lines 1-2; city; state; home ZIP; annual salary; class; job title; work ZIP.
- **Potential `BenefitsPackage` mappings:** `employees[].name`, `employees[].gender`, `employees[].date_of_birth`, `employees[].home_address`, `employees[].work_location.zip`, `employees[].annual_salary`, `employees[].employee_class`, `employees[].job_title`; salary and class can support life/disability benefit calculations and class-based eligibility.
- **Verification:** File signature is a real OLE/Compound Excel workbook, not HTML. The workbook opened with `xlrd`; both sheets and their populated ranges were enumerated. `Member Template` is blank except for its header. `Instructions` includes clearly generic sample rows such as John Doe and Jane Jones-Doe for format illustration, not a real completed census.
- **Known limitations:** Old binary format; instructions date from 2015. It has no dependent rows, coverage-tier election, medical plan selection, premiums, or contribution amounts. The template expects personal identifiers when completed, so production ingestion requires appropriate privacy controls.

## 02 - AZ Blue full online-quoting census

- **Organization:** Blue Cross Blue Shield of Arizona, branded AZ Blue.
- **Jurisdiction / market:** Arizona group health insurance broker quoting.
- **Plan or program design:** Minimal upload schema for an online group-quoting workflow.
- **Document subtype:** Header-only CSV template.
- **Why it is distinct:** It is the smallest machine-ingestion example in the set and demonstrates that a valid census may arrive as a bare schema rather than a styled workbook. `Relationship` makes it possible to represent subscriber and dependent rows.
- **Source webpage URL:** https://www.azblue.com/brokers/resources/forms
- **Direct file URL:** https://edge.sitecorecloud.io/bluecross-6f8ea2ea/media/project/bcbs-az/azblue/data/media/files/brokers/forms/group-quote-tools/census-template-full-for-online-quoting.csv
- **Retrieved:** 2026-07-17.
- **Local filename:** `02_azblue_full-online-quoting-census.csv`
- **File metadata:** ASCII CSV with CRLF line endings; 60 bytes; SHA-256 `5ce11bce025818711f5695190f95a832afcb7ebf94ec87a6a9c28d7793e848dc`.
- **Rows and columns:** 1 header row x 6 columns; no worksheets and no participant rows.
- **Column / field inventory:** relationship; last name; date of birth; gender; annual salary; occupation.
- **Potential `BenefitsPackage` mappings:** `people[].relationship_to_employee`, `people[].last_name`, `people[].date_of_birth`, `people[].gender`, `employees[].annual_salary`, `employees[].occupation`; relationship plus DOB can support subscriber/dependent grouping and age rating.
- **Verification:** Parsed as a six-column CSV. The only row is the official header row; there is no embedded HTML, error message, or personal data.
- **Known limitations:** Despite the official filename containing "full," this public template is intentionally minimal. It omits first name, ZIP, employee class, hire date, plan election, coverage tier, premium, and contribution fields. The source is useful for testing sparse-input handling and clarification requirements, not for generating a complete enrollment record by itself.

## 03 - Health Net Oregon 2026 small-business enrollment census

- **Organization:** Health Net Health Plan of Oregon / Centene.
- **Jurisdiction / market:** Oregon small-business group coverage, 2026 effective dates.
- **Plan or program design:** Full new-group and renewal enrollment across medical, dental, vision, group term life, COBRA, waivers, and Medicare coordination.
- **Document subtype:** Structured multi-sheet Excel enrollment workbook with validations, lookup tables, formulas, summaries, and blank enrollee rows.
- **Why it is distinct:** This is the richest multi-benefit example. It models one person per row, separates enrolled members from waivers, supports multiple plan lines, and derives enrollment and participation summaries.
- **Source webpage URL:** https://www.healthnetoregon.com/brokers/forms-brochures/oregon-small-groups.html
- **Direct file URL:** https://www.healthnetoregon.com/content/dam/centene/healthnet/pdfs/broker/or/2026/hnor-broker-employee-enrollment-2026.xlsx
- **Retrieved:** 2026-07-17.
- **Local filename:** `03_healthnet-oregon_2026-sbg-enrollment-census.xlsx`
- **File metadata:** Office Open XML Excel workbook (`.xlsx`); 274,417 bytes; SHA-256 `2d5d9768fb1ba380affbed429e5be3bf4be6eedb2ed5c20eec724a1273a87363`.
- **Worksheets and used ranges:** 6 worksheets: `TIPS` (`A1:D134`), `Tables` (`A1:AE301`), `Employees & COBRA Enrollees` (`A1:BV303`), `Waivers` (`A1:V160`), `Enrollment Summary` (`A1:U264`), and `Enrollee Summary` (`A1:R296`).
- **Column / field inventory:** group effective date, group name, total eligible employees; medical plan type/name; dental and vision plan; group term life amount and beneficiaries; activity/effective date; employee/member identifiers; member type/relationship; marital status; name; gender; DOB; hire date; employee type; department; COBRA indicator, qualifying event and dates; written/spoken language; disability indicator; residential and mailing addresses; ZIP and ZIP+4; phone/email; PCP and provider IDs; other health coverage and carrier dates; Medicare Parts A/B/D and beneficiary identifier; signed-enrollment indicator; hours worked; waiver product, member type, hire date, ZIP, hours, and declination reason.
- **Potential `BenefitsPackage` mappings:** employer and plan-year metadata; `employees[]` and `dependents[]`; medical/dental/vision/life plan elections; life beneficiaries; employee eligibility and hours; residence/rating area; COBRA and Medicare status; waiver reasons; eligible/enrolled/waived counts; coverage participation by product; enrollee summaries for booklet cost and participation calculations.
- **Verification:** The OOXML ZIP container passed `unzip -t`. The workbook opened with `openpyxl`; all six sheet names and ranges were inspected. The official instructions, lookup values, formulas, and blank input areas are present. No real participant record was found; visible nonblank rows in input areas are headers, placeholders, defaults, formulas, and validation content.
- **Known limitations:** The workbook requests highly sensitive identifiers such as SSN and Medicare IDs when used in production; those are unnecessary for many booklet-generation tasks and should be excluded or redacted unless explicitly required. Formula results may require Excel recalculation. The workbook is Oregon- and 2026-specific and should not be treated as a universal eligibility rule source.

## 04 - Nurture Benefits employee census

- **Organization:** Nurture Benefits (administrator); hosted in the MiFuture/Nurture Benefits support portal.
- **Jurisdiction / market:** Employer benefits administration and onboarding; the public article is not limited to a single state.
- **Plan or program design:** Employee master-data import focused on eligibility, payroll, compensation, and ACA classification rather than carrier-specific plan elections.
- **Document subtype:** Excel import template with a data sheet and a field-requirements/data-dictionary sheet.
- **Why it is distinct:** This is the employer/HR-system side of a census. It supplies employee class, pay basis, hours, and payroll grouping that may be absent from carrier quote forms.
- **Source webpage URL:** https://mifuture.freshdesk.com/en/support/solutions/articles/150000215838-employee-census
- **Direct file URL:** https://mifuture.freshdesk.com/helpdesk/attachments/150138414226
- **Retrieved:** 2026-07-17.
- **Local filename:** `04_nurture-benefits_employee-census.xlsx`
- **File metadata:** Office Open XML Excel workbook (`.xlsx`); 25,713 bytes; SHA-256 `0361295e5bed39e79ed7f59245c82af7f5f6f72a4a5a7930d0339c97aacc8999`.
- **Worksheets and used ranges:** 2 worksheets: `employee census` (`A1:CE2`; meaningful headers occupy `A1:AD1`, with later columns styled/reserved) and `Field Requirements` (`A1:L33`).
- **Column / field inventory:** employee SSN; last, first, and middle name; suffix; DOB; sex; hire date; class; work/personal email; payroll group; annual base salary; hourly rate; hours per week; salary effective date; ACA classification; address lines; city; state; ZIP; county; country; home/mobile/work phone; job title; marital status; race/ethnicity. The companion sheet labels fields as required, optional, or conditional and describes import mapping.
- **Potential `BenefitsPackage` mappings:** employer employee roster; `employees[].employee_class`; hire date and hours-based eligibility; ACA status; salary/hourly compensation inputs; payroll group; work location and contact data; class/subgroup-based contribution or plan availability.
- **Verification:** The OOXML ZIP container passed `unzip -t`. The workbook opened with `openpyxl`; both sheets, their ranges, and the requirements dictionary were inspected. The employee-data row is blank and contains no participant information.
- **Known limitations:** This is an administrator import schema, not a plan-election census; it lacks dependents, coverage tiers, plan names, premiums, and employer contributions. It asks for SSN and demographic attributes that should be minimized or redacted for booklet generation. The sheet's formatted range extends farther than the meaningful header range.

## 05 - Kaiser Permanente Oregon employee census form

- **Organization:** Kaiser Foundation Health Plan of the Northwest.
- **Jurisdiction / market:** Oregon small-group health coverage.
- **Plan or program design:** Printable census for new or renewing small groups, including eligible employees, waivers, family enrollment status, and rating inputs for spouses and children.
- **Document subtype:** One-page blank PDF census form with 12 employee rows and an enrollment/status code key.
- **Why it is distinct:** It represents a paper-first census whose compact tier codes directly express employee-only, employee-plus-spouse, employee-plus-children, and family enrollment, plus waiver and waiting-period statuses.
- **Source webpage URL:** https://business.kaiserpermanente.org/business/broker/oregon-sw-washington/client-support/renewals/oregon--renewal-response
- **Direct file URL:** https://business.kaiserpermanente.org/business/shared/nw/resource-library/sb-employee-census-form-or-nw-en.pdf
- **Retrieved:** 2026-07-17.
- **Local filename:** `05_kaiser-oregon_employee-census-form.pdf`
- **File metadata:** PDF 1.6; 127,586 bytes; SHA-256 `982d910dfde2937c37d63bf2a124f4d100e6312aa9d08e5f7700c4e56ec57fef`.
- **Pages:** 1 US-letter page; tagged; AcroForm present; unencrypted; no JavaScript.
- **Column / field inventory:** company name/address; current carrier and producer; proposed effective date; company contact; employee name; DOB; gender; hours per week; hire date; eligibility indicator; employee ZIP; enrollment code; spouse/domestic-partner DOB and gender; dependent ages. Enrollment codes cover employee only, employee + spouse, employee + spouse + children, and employee + children. Other codes cover waiver due to comparable coverage, waiting period, insufficient hours/ineligible class, and waiver without other coverage.
- **Potential `BenefitsPackage` mappings:** employer identity and contact; current carrier; plan effective date; eligible employee roster; age/rating inputs; employee work-hours eligibility; residence/rating ZIP; coverage tier; spouse/dependent composition; waiver and ineligibility reasons.
- **Verification:** `pdfinfo` confirmed a valid one-page, unencrypted PDF with no JavaScript. `pdftotext` confirmed the title, instructions, field labels, and code key. Page 1 was rendered at 150 DPI and visually inspected; the form is legible, complete, and blank with no personal data or rendering defects.
- **Known limitations:** The form was originally produced in 2013 and later modified in 2021, so it is valuable as a format example rather than proof of current underwriting rules. It captures dependent ages rather than full dependent records and does not include plan names, premiums, contributions, or payroll deductions.

## Privacy and ingestion notes

- Treat employee censuses as sensitive even when a template is blank. Completed versions may contain SSNs, Medicare IDs, DOBs, addresses, compensation, and dependent information.
- For benefits-booklet generation, collect only fields needed for eligibility, tier counts, costs, and plan presentation. Redact direct identifiers whenever aggregate counts are sufficient.
- Preserve the source document and provenance, but separate raw sensitive uploads from normalized booklet facts and generated outputs.
- A document may support several booklet sections at once: employer information, eligibility, medical/dental/vision/life elections, account eligibility, enrollment counts, and cost calculations.
