# Current Enrollment and Election Export Examples

Five public, non-production examples for testing current benefit enrollment and election ingestion. The set deliberately covers different stages of the enrollment data lifecycle: a benefits-administrator census template, an employer election form, two de-identified aggregate enrollment exports, and a member-level X12 834 interchange specification with mocked transactions.

Retrieved: **2026-07-17**

## Privacy and use notes

- None of the downloaded files contains known real person-level PII.
- Files 01 and 02 are blank templates. Their schemas include fields that would hold PII in production, but the downloaded copies are uncompleted.
- Files 03 and 04 contain aggregate public-use enrollment counts. Small Medicare cells are suppressed in file 03.
- File 05 contains explicitly mocked transaction examples with synthetic names, identifiers, addresses, and contact values.
- These examples are extraction and classification fixtures, not instructions to collect or retain unnecessary PII. A production pipeline should minimize, encrypt, redact, and access-control member data.

## Inventory

| # | Local file | Organization / market | Subtype | Native format | Size | Structural extent |
|---|---|---|---|---:|---:|---|
| 01 | `01_oca_master_pretax_enrollment_census_template.xlsx` | OCA / employer pre-tax benefits administration | Blank multi-benefit enrollment census | XLSX | 117,916 bytes | 1 worksheet; header row A2:AF2; formatted dimension A1:HB840 |
| 02 | `02_city_of_savannah_2026_benefits_enrollment_form.pdf` | City of Savannah, Georgia / public employer | Blank new-hire benefit election and beneficiary form | PDF | 530,623 bytes | 2 US Letter pages; AcroForm |
| 03 | `03_cms_medicare_cpsc_enrollment_2026_07.zip` | CMS / nationwide Medicare Advantage and Part D | De-identified monthly contract-plan-state-county enrollment export | ZIP containing CSV/TXT | 36,065,979 bytes | 2 CSVs plus readme; 3,386,787 enrollment CSV lines including header |
| 04 | `04_cms_medicaid_managed_care_enrollment_2024.csv` | CMS / nationwide Medicaid managed care | De-identified annual program-and-plan enrollment export | CSV | 1,845,379 bytes | 10 columns; 7,805 lines including header; 2016-2024 |
| 05 | `05_wahbe_2026_834_companion_guide.pdf` | Washington Health Benefit Exchange / Washington individual market | X12 834 enrollment transaction layout and mocked examples | PDF | 1,423,816 bytes | 102 US Letter pages |

## 01 - OCA Master Pre-Tax Enrollment Census Template

- **Title:** OCA Pre-Tax Master Enrollment Census Template
- **Organization:** OCA (benefits administrator)
- **Jurisdiction / market:** United States employer-sponsored pre-tax benefits
- **Document subtype:** Blank spreadsheet enrollment/census template
- **Why it is distinct:** This is a row-oriented administrator intake workbook for several account-based benefits in one file. It differs from a carrier 834, an employee-facing election form, and an aggregate enrollment report.
- **Source webpage:** https://oca125.com/submit-enrollments/
- **Public share page:** https://workdrive.zohoexternal.com/external/a96c9ae0783e4fbaa05b3e3a7d8c3f62576825d495236d9571ad04f1af7013e0
- **Direct file URL:** https://files-accl.zohoexternal.com/public/workdrive-external/download/swe9j5d90b772c95e44879a0c655f164ac24f?x-cli-msg=null
- **Local filename:** `01_oca_master_pretax_enrollment_census_template.xlsx`
- **File type / size:** Microsoft Excel 2007+ OOXML workbook; 117,916 bytes
- **Worksheets / ranges:** One visible worksheet, `Master Enrollment File`. The workbook dimension is A1:HB840 because formatting extends beyond the data-entry columns. The only populated row in the blank source is the field header row A2:AF2.
- **Field inventory:** Subscriber SSN, subscriber first/last name; member SSN and first/last name; initial; relationship; address; city/state/ZIP; phone; birth date; gender; email; division; payroll schedule; HRA benefit, coverage tier, and effective date; HSA coverage tier and effective date; FSA annual election and effective date; dependent-care account annual election and effective date; transit and parking monthly elections and effective dates.
- **Potential `BenefitsPackage` population:** Offered HRA/HSA/FSA/DCA/commuter programs; member relationship and dependent structure; coverage tiers; effective dates; annual or monthly election amounts; employer division/class; payroll cadence. Person identifiers should be segregated from booklet-generation data and not exposed in generated content.
- **Verification:** File signature identifies XLSX; OOXML ZIP CRC test passed for all 17 members; workbook XML, relationships, styles, shared strings, comments, drawing, and worksheet parse successfully. The six header comments were inspected and the workbook contains no populated participant rows.
- **Known limitations:** It is an intake template, not a completed export. It does not include medical/dental/vision carrier plan elections. The displayed range is much larger than the meaningful A2:AF2 schema because of preformatted blank cells. The direct Zoho download URL may rotate.
- **SHA-256:** `6499ddf2dd7b1b67977b89d09868f9576b945c9fb4287327904ae7fef8a9c800`

## 02 - City of Savannah 2026 Benefits Enrollment Form

- **Title:** New Hire Benefits Enrollment Form / City of Savannah Beneficiary Form
- **Organization:** City of Savannah Human Resources
- **Jurisdiction / market:** Savannah, Georgia public employer; 2026 new-hire benefit elections
- **Document subtype:** Blank employee-facing benefit election form
- **Why it is distinct:** This example captures plan choices and coverage tiers directly from an employee, spanning medical, dental, vision, flexible spending, life insurance, dependents, and beneficiaries in a compact multi-section form.
- **Source webpage:** https://www.savannahga.gov/3145/New-Hire-Benefits-Enrollment
- **Direct file URL:** https://www.savannahga.gov/3971/Benefits-Enrollment-Form
- **Local filename:** `02_city_of_savannah_2026_benefits_enrollment_form.pdf`
- **File type / size:** PDF 1.7; 530,623 bytes; unencrypted AcroForm; 2 US Letter pages
- **Field inventory:** Employee name, ID, department, email, phone, position, and date; medical option (Health Plan Plus, Health Plan Basic, or waive); medical tier (employee only, employee + 1, or employee + family); dental option and tier; vision election and tier; medical FSA and dependent-care FSA waive/elect status and annual contribution; supplemental life elections for employee, spouse, and children; dependent name, relationship, SSN, birth date, and benefit coverage flags; life and pension beneficiary details.
- **Potential `BenefitsPackage` population:** Selected medical/dental/vision options; tier elections; FSA/DCA participation and annual amounts; voluntary life participation and coverage amount; dependent/member counts by selected benefit. PII and beneficiary data should remain outside booklet output.
- **Verification:** PDF signature, metadata, text extraction, and page count passed. Both pages are blank. Page 1 was rendered to PNG and visually inspected: the form is legible, correctly branded, and contains no completed entries. No JavaScript or encryption is present.
- **Known limitations:** It is a per-employee input form rather than a bulk export, so plan/tier counts require aggregation across submissions. It is new-hire oriented rather than a system snapshot of all active elections. The embedded footer revision history ends in 2024 even though PDF metadata and its official source presentation identify the current 2026 form.
- **SHA-256:** `89ba670aa4c2e0a039f3b72b4ec4ab526670e9b14e549337bd2436475fc0f382`

## 03 - CMS Medicare CPSC Enrollment, July 2026

- **Title:** Monthly Enrollment by Contract/Plan/State/County (CPSC), 2026-07
- **Organization:** Centers for Medicare & Medicaid Services
- **Jurisdiction / market:** United States Medicare Advantage, Part D, cost, PACE, demonstration, and employer-sponsored plan markets
- **Document subtype:** De-identified monthly public-use enrollment export
- **Why it is distinct:** This is a real current plan-level count export rather than a blank form or file specification. It supports joins from contract/plan attributes to monthly geography-level enrollment counts at national scale.
- **Source webpage:** https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-advantagepart-d-contract-and-enrollment-data/monthly-enrollment-contract/plan/state/county/monthly-enrollment-cpsc-2026-07
- **Direct file URL:** https://www.cms.gov/files/zip/cpsc-enrollment-2026-07-zip.zip
- **Local filename:** `03_cms_medicare_cpsc_enrollment_2026_07.zip`
- **File type / size:** ZIP; 36,065,979 bytes
- **Archive inventory:**
  - `CPSC_Contract_Info_2026_07.csv`: 1,479,525 uncompressed bytes; 7,591 lines including header.
  - `CPSC_Enrollment_Info_2026_07.csv`: 169,821,843 uncompressed bytes; 3,386,787 lines including header.
  - `Read_Me_CPSC_Enrollment_2026.txt`: 4,654 uncompressed bytes.
- **Field inventory:** Contract ID/number; plan ID; organization type; plan type; Part D indicator; special-needs-plan indicator; employer-group-health-plan indicator; organization name and marketing name; plan name; parent organization; contract effective date; SSA and FIPS state/county codes; state; county; enrollment count.
- **Potential `BenefitsPackage` population:** Carrier and parent-organization normalization; plan identifiers and names; Medicare plan type; Part D/SNP/EGHP flags; geography; active enrollment count by contract, plan, state, and county; month-specific member-count comparisons.
- **Verification:** ZIP signature and CRC test passed for every member. The two CSV members decode and parse successfully. Their headers were checked and representative first records were inspected. The contract file contains 7,590 data rows; the enrollment file contains 3,386,786 data rows. The bundled CMS readme was inspected for column definitions and privacy rules.
- **Known limitations:** This is aggregate Medicare data, not employer-group employee elections. Enrollment values of 10 or fewer are represented by `*`, so exact totals cannot always be reconstructed from the public file. CMS notes that county reflects the beneficiary's legal/payment residence and may be outside a plan's approved service area. The archive is large when uncompressed.
- **SHA-256:** `7a5d053219e8725b620927a0ad59a35853ca4c237bf1296a247670dc03d21bbd`

## 04 - CMS Medicaid Managed Care Enrollment by Program and Plan

- **Title:** Managed Care Enrollment by Program and Plan, 2024 table
- **Organization:** Centers for Medicare & Medicaid Services / Medicaid.gov
- **Jurisdiction / market:** United States Medicaid managed care programs and plans
- **Document subtype:** De-identified annual public-use program-and-plan enrollment export
- **Why it is distinct:** This file is program-centric Medicaid enrollment data with separate Medicaid-only and dual-enrollment counts. It contrasts with the Medicare monthly contract/plan/county export and with member-level 834 data.
- **Source webpage:** https://catalog.data.gov/dataset/managed-care-enrollment-by-program-and-plan
- **Direct file URL:** https://download.medicaid.gov/data/managed-care-enrollment-by-program-and-plan2024-table4.csv
- **Local filename:** `04_cms_medicaid_managed_care_enrollment_2024.csv`
- **File type / size:** UTF-8 CSV; 1,845,379 bytes; 10 columns; 7,805 lines including header
- **Coverage:** 7,804 data rows spanning 2016-2024; 921 rows for 2024.
- **Field inventory:** State; notes; program name; plan name; geographic region; Medicaid-only enrollment; dual enrollment; total enrollment; year; parent organization.
- **Potential `BenefitsPackage` population:** Medicaid program and plan identification; parent organization; market/geographic region; annual member counts; Medicaid-only versus dual-eligible mix; program-type comparisons.
- **Verification:** File signature identifies CSV text; UTF-8 decoding and CSV parsing passed; all 10 headers and row widths parse; representative records were inspected; year distribution was checked through 2024. The file contains aggregate counts and no member identifiers.
- **Known limitations:** The file is not a current employer benefits election roster and has annual rather than monthly granularity. The source metadata notes that a state may report zero in place of a value under 10 for confidentiality, so zeros are not always literal. It combines nine reporting years in one file despite the 2024 filename.
- **SHA-256:** `5de41a08f10bf3cb39135d63e224fec77283f502ab0907774263a03a45bf887c`

## 05 - Washington Health Benefit Exchange 2026 834 Companion Guide

- **Title:** Washington Health Benefit Exchange Individual Market Companion Guide - 834 Enrollment Transaction - 2026 Plan Year
- **Organization:** Washington Health Benefit Exchange (Washington Healthplanfinder)
- **Jurisdiction / market:** Washington individual health insurance marketplace
- **Document subtype:** X12 005010X220A1 834 benefit enrollment and maintenance companion guide with mocked transactions
- **Why it is distinct:** This is a member-level carrier interchange specification. It shows the precise segments, qualifiers, business rules, and transaction examples used for add, change, term, cancel, reinstate, renewal, and carrier confirmation flows.
- **Source webpage:** https://www.wahbexchange.org/about-the-exchange/committees-and-workgroups/plan-certification-workgroup/
- **Direct file URL:** https://www.wahbexchange.org/content/dam/wahbe-assets/plan-certification-workgroup/WAHBE_834_Companion_Guide_2026.pdf
- **Local filename:** `05_wahbe_2026_834_companion_guide.pdf`
- **File type / size:** Tagged PDF 1.7; 1,423,816 bytes; 102 US Letter pages; unencrypted
- **Field / segment inventory:** Sponsor, payer/carrier, broker, subscriber, and dependent loops; member relationship and benefit-status codes; maintenance action and reason codes; subscriber and carrier identifiers; member dates; name, address, demographics, language, race and ethnicity; health coverage type; CMS plan identifier and plan description; coverage level; coverage start/end dates; policy/enrollment identifier; premium total; advance premium tax credit; Cascade Care Savings/state subsidy; total member responsibility; cost-sharing reduction category and amount; special-enrollment reason; transaction timestamps.
- **Transaction examples:** Appendix D contains explicitly mocked WAHBE add, change, term, cancel, reinstate, passive renewal, carrier confirm, carrier term, carrier cancel, and carrier reinstate transactions.
- **Potential `BenefitsPackage` population:** Current plan and coverage enrollment; subscriber/dependent relationships; coverage level/tier; effective and termination dates; carrier, broker, and plan IDs; add/change/term status; premium, subsidy, and member-responsibility amounts; medical versus dental coverage; enrollment event provenance.
- **Verification:** PDF signature, metadata, tagged status, text extraction, and 102-page count passed. The cover page was rendered to PNG and visually inspected with no layout or rendering defects. The table of contents, file-format section, core member/coverage fields, and Appendix D mocked transaction examples were text-checked. No JavaScript or encryption is present.
- **Known limitations:** It is a companion guide, not a standalone physical `.834` sample file; the guide says physical samples are available on request. It is specific to Washington's individual marketplace and includes marketplace subsidy fields not normally present in an employer benefits export. Although examples look realistic, the document explicitly labels them mocked up.
- **SHA-256:** `dba3edb0e8cc3dc576deda2c43d7e81607a6d5bc9f06295a5ee174e3b7ce18a0`

## Diversity coverage

The examples are meaningfully different along several axes:

1. **Source system:** benefits administrator, public employer, CMS Medicare, CMS Medicaid, and state exchange.
2. **Data grain:** blank bulk member rows, one employee election, aggregate monthly plan/geography counts, aggregate annual program/plan counts, and member-level EDI transactions.
3. **Market:** employer pre-tax accounts, employer medical/dental/vision/life/FSA elections, Medicare, Medicaid, and ACA individual-market coverage.
4. **Format:** XLSX, fillable PDF, ZIP of CSV/TXT, standalone CSV, and technical PDF.
5. **Intended extraction:** plan/tier/election data, benefit-specific elections and dependents, plan/member counts, program enrollment mix, and detailed enrollment lifecycle events.
