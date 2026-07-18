# Source-docs bucket audit: employer setup, rates, census, and enrollment

Date: 2026-07-17  
Scope: every primary artifact in `source-docs/01_employer-setup`, `source-docs/02_plan-and-rate-source`, and `source-docs/05_census-and-enrollment`. Category READMEs, hidden QA material, and `_verification` files were excluded as artifacts but used as audit context. No source file was moved or edited.

## Result

The employer-setup branches and the five-file employee-census branch are honestly labeled. The rate branch contains valid cost sources but should be distributed into the more precise leaves that already exist. The largest classification problem is under census/enrollment: four artifacts called “exports” are specifications or layouts, five artifacts in `current-enrollment-exports` are a mixture of templates, public aggregate datasets, and a companion guide, and two `tier-count-files` do not themselves contain completed tier counts.

Of 35 artifacts, 18 can remain in their present leaf and 17 require rehoming for the directory name to describe their primary role honestly. This is a taxonomy finding, not a quality finding: the rehomed files are still useful fixtures.

## Method

- Read all seven category READMEs.
- Verified file signatures, sizes, and SHA-256 hashes.
- Ran `pdfinfo` and `pdftotext -layout` on all 22 PDFs; rendered and visually checked pages where the primary role depended on a table, form, or embedded exhibit.
- Inspected workbook sheet names, ranges, headers, representative values, and formulas for XLS/XLSX files. Inspected all four nested XLSM workbooks in the Anthem ZIP without enabling macros.
- Parsed the CSV/TXT headers and representative records, and inspected both ZIP inventories and their embedded readmes/data headers.
- Scanned the complete primary corpus for byte-identical files.

Verdicts below use **Keep** when the current leaf is honest, and **Move** when the primary role conflicts with the leaf name. Secondary roles should be represented as manifest tags rather than duplicate files.

## 01 - Employer setup

### `employer-and-group-information`

| File | Exact subtype / primary role | Verdict | Notes |
|---|---|---|---|
| `01_kaiser_ca_2026_small_group_employer_application.pdf` | Blank California small-group carrier employer application | **Keep** | Direct employer/group setup input; encrypted against editing but permits text extraction/copying. |
| `02_excellus_ny_annual_group_information_renewal.pdf` | Blank annual group-information renewal and regulatory recertification | **Keep** | Renewal-stage employer/group facts; also contains HSA/HRA and dental/vision contribution fields. |
| `03_premera_wa_2026_small_group_employer_application.pdf` | Blank Washington small-group carrier employer application | **Keep** | Direct setup input with eligibility, participation, contribution, and regulatory fields. |
| `04_highmark_pa_balanced_funding_stop_loss_group_application.pdf` | Blank level-funded/ASO medical and stop-loss group application | **Keep** | Correctly broadens the branch beyond fully insured applications; historical 2020 revision must be tagged. |
| `05_cms_healthcaregov_employer_coverage_tool.pdf` | Blank employee/household-facing employer coverage-offer worksheet | **Keep** | Not a carrier group application, but its primary content is employer identity, offer eligibility, minimum value, and lowest-cost employee premium. Add secondary tags `eligibility` and `employee_cost`. |

### `eligibility-and-enrollment`

| File | Exact subtype / primary role | Verdict | Notes |
|---|---|---|---|
| `01_opm_sf2809_health-benefits-election-form.pdf` | Blank fillable FEHB enrollment/change/cancellation/waiver form plus instructions | **Keep** | Genuine election transaction form; valuable AcroForm and dense event-code fixture. |
| `02_calpers_state-dependent-verification-letter.pdf` | Dependent eligibility re-verification notice template | **Keep** | Eligibility proof, deadline, and cancellation rules; not a general enrollment form but squarely within this leaf. |
| `03_university-of-minnesota_new-employee-benefits-enrollment-guide.pdf` | New-hire eligibility and multi-benefit enrollment guide | **Keep** | Also resembles a benefits booklet and contains rates/plan summaries, but enrollment onboarding is its stated primary purpose. Use multi-label tags rather than duplicating it into prior booklets. |
| `04_american-university_2025-benefits-options-enrollment-guide.pdf` | Annual/open-enrollment options guide | **Keep** | Multi-benefit booklet with salary-banded costs; still primarily an employer annual-enrollment guide. |
| `05_wisconsin-etf_qualifying-life-event-companion-guide.pdf` | HR-administrator QLE/change-reason processing manual | **Keep** | Correct eligibility/enrollment rules fixture; tag `administrator_instructions`, `historical_or_time_sensitive`, and high-cost/long-document. |

## 02 - Plan and rate source

The current leaf `rates-contributions-and-payroll-examples` is an honest umbrella, but it duplicates the purpose of five more precise sibling leaves that already exist. Keeping the combined leaf would make category-level tests ambiguous. Distribute the files as follows and retire the combined leaf after its README is replaced by leaf-specific READMEs.

| File | Exact subtype / primary role | Verdict | Required destination |
|---|---|---|---|
| `01_opm_2026_fehb_payroll-rates.xlsx` | FEHB payroll withholding and government-contribution rate table by enrollment code/pay frequency | **Move** | `02_plan-and-rate-source/employee-cost-and-payroll/` |
| `02_wisconsin-etf_2027_state-full-premium-rates.xlsx` | Total carrier/plan monthly premium workbook, with/without dental | **Move** | `02_plan-and-rate-source/carrier-rate-sheets/` |
| `03_nyship_2026_active-employee-contribution-rates.pdf` | Employee payroll contribution schedule by plan, tier, and salary grade | **Move** | `02_plan-and-rate-source/employee-cost-and-payroll/` |
| `04_washington-pebb_fy2026-27_composite-rates.pdf` | Employer base contribution plus plan/tier composite premium memo | **Move** | `02_plan-and-rate-source/employer-contributions/`; secondary tag `carrier_rate_sheet` |
| `05_anthem-ny_2026_small-group-approved-rates.zip` | Regulator-published carrier approved-rate package containing four macro-enabled XLSM templates | **Move** | `02_plan-and-rate-source/carrier-rate-sheets/`, preferably a `regulatory-filings/` subtype |

Important distinctions:

- The OPM workbook is a payroll **rate input**, not an employee payroll export, and needs a separate plan-code key to resolve names.
- The Anthem package is approved market rate data, not an employer quote or renewal. Never enable its macros during ingestion.
- None of these five fills the currently empty `quotes-and-proposals` or `renewal-rates` leaves.

## 05 - Census and enrollment

### Current `benefit-admin-and-payroll-exports`

Only the Benefits 24/7 TXT is an actual export sample. The other four are interface specifications or layout documentation. Rename/rebuild the leaf as `benefit-admin-and-payroll-interface-specifications`, place the WAHBE guide from the next table there as its fifth example, and move the TXT to the actual export leaf.

| File | Exact subtype / primary role | Verdict | Required destination |
|---|---|---|---|
| `01_cms_ffe-834-companion-guide.pdf` | Technical companion guide for FFE X12 834 enrollment transactions | **Move** | `05_census-and-enrollment/benefit-admin-and-payroll-interface-specifications/` |
| `02_washington-hca_sebb-navia-payroll-file-specs.xlsx` | Payroll/contribution feed layout and field dictionary for FSA/DCAP/HSA/HRA/commuter accounts | **Move** | `05_census-and-enrollment/benefit-admin-and-payroll-interface-specifications/` |
| `03_washington-hca_benefits247-sample-enrollment-export.txt` | Synthetic, pipe-delimited, member-level annual medical enrollment export | **Move** | `05_census-and-enrollment/current-enrollment-exports/` |
| `04_alaska-drb_bears-payroll-layout-example.pdf` | Schematic payroll import record-layout example | **Move** | `05_census-and-enrollment/benefit-admin-and-payroll-interface-specifications/` |
| `05_nyc-olr_group-life-eligibility-billing-file-layouts.pdf` | Procurement package containing group-life eligibility, reconciliation, billing, and remittance interface layouts | **Move** | `05_census-and-enrollment/benefit-admin-and-payroll-interface-specifications/` |

### Current `current-enrollment-exports`

None of the five current artifacts is an employer current-enrollment export. Files 03 and 04 are real exports, but they are public Medicare/Medicaid aggregate reference datasets rather than employer elections or a benefits-administration snapshot.

| File | Exact subtype / primary role | Verdict | Required destination |
|---|---|---|---|
| `01_oca_master_pretax_enrollment_census_template.xlsx` | Blank bulk enrollment/census intake template for HRA/HSA/FSA/DCA/commuter elections | **Move** | `05_census-and-enrollment/employee-census/` with tags `account_elections` and `template`; alternatively create `enrollment-forms-and-templates/` |
| `02_city_of_savannah_2026_benefits_enrollment_form.pdf` | Blank per-employee new-hire medical/dental/vision/FSA/life election and beneficiary form | **Move** | `01_employer-setup/eligibility-and-enrollment/` |
| `03_cms_medicare_cpsc_enrollment_2026_07.zip` | Monthly aggregate Medicare contract/plan/state/county enrollment reference dataset | **Move** | New `07_shared-supporting-materials/public-enrollment-reference-data/`, or exclude from core employer-input runs and retain as a negative/scale fixture |
| `04_cms_medicaid_managed_care_enrollment_2024.csv` | Multi-year aggregate Medicaid program/plan enrollment reference dataset | **Move** | New `07_shared-supporting-materials/public-enrollment-reference-data/`, or exclude from core employer-input runs and retain as a negative fixture |
| `05_wahbe_2026_834_companion_guide.pdf` | Technical X12 834 companion guide with mocked transactions | **Move** | `05_census-and-enrollment/benefit-admin-and-payroll-interface-specifications/` |

After these moves, `current-enrollment-exports` will contain the Benefits 24/7 synthetic TXT and still needs four more honest examples if the five-example invariant is retained.

### `employee-census`

| File | Exact subtype / primary role | Verdict | Notes |
|---|---|---|---|
| `01_guardian_group-benefits-quote-census.xls` | Blank ancillary-benefits quote census template | **Keep** | Correct census fixture; salary/class/job fields make it life/disability oriented. Legacy XLS and formatting extend beyond meaningful cells. |
| `02_azblue_full-online-quoting-census.csv` | Header-only group medical quoting census CSV | **Keep** | Correct sparse census fixture; six columns and no participant rows. |
| `03_healthnet-oregon_2026-sbg-enrollment-census.xlsx` | Multi-sheet small-group enrollment/waiver census workbook | **Keep** | Correct rich census fixture spanning medical, dental, vision, life, COBRA, Medicare, and waivers. |
| `04_nurture-benefits_employee-census.xlsx` | Blank benefit-admin employee master-data import template | **Keep** | Correct employee census, although it lacks plan elections/dependents. |
| `05_kaiser-oregon_employee-census-form.pdf` | Blank printable small-group census/rating form with tier and waiver codes | **Keep** | Correct census fixture; historical format rather than current-rule authority. |

### `tier-count-files`

Three files contain completed aggregate tier counts/analyses. The first is a person-level input from which counts can be derived, and the second is a blank reporting guide/template. Those two should not count as completed tier-count examples.

| File | Exact subtype / primary role | Verdict | Required destination / note |
|---|---|---|---|
| `01_s4_wired_quote_census_waiver_codes.xlsx` | Person-level quote census with fictional sample rows and status/waiver codes | **Move** | `05_census-and-enrollment/employee-census/`; tag `tier_counts_derivable`, not `tier_counts_present` |
| `02_opm_fehb_table1_enrollment.pdf` | Blank FEHB tier-count reporting instructions and example UI | **Move** | New `05_census-and-enrollment/tier-count-reporting-templates/` |
| `03_houston_county_census_summary.pdf` | Completed RFP aggregate census summary by benefit, status class, and tier | **Keep** | True tier-count source; also a quote/procurement fixture. |
| `04_nc_state_health_plan_tier_premiums.pdf` | Historical board analysis linking four-tier counts to employer/employee/dependent premium receipts | **Keep** | True completed aggregate analysis, not an employer upload template. |
| `05_crook_county_plan_tier_cost_analysis.pdf` | Completed multi-plan renewal analysis with five-tier enrollment, rates, and costs | **Keep** | True tier-count/cost source; relevant material is concentrated near PDF pages 88-92 of a 93-page agenda packet. |

Optionally rename the remaining leaf to `tier-count-reports-and-analyses` so it does not imply that templates or raw censuses belong there. It then needs two additional completed examples to return to five.

## Duplicate and overlap findings

- No byte-identical primary artifact exists within the audited scope.
- A complete-corpus hash scan found one byte-identical pair, both outside this scope: IRS Publication 969 under HSA and approved-language patterns.
- The CMS FFE and WAHBE PDFs are not byte duplicates, but they are the same document family (X12 834 companion guides) and should be co-located, not presented as examples of two different source types.
- OPM SF 2809 and the Savannah form are both employee election forms but materially differ by market and breadth; keep both as variations in the same family.
- S4, OCA, and the five existing employee-census files overlap as census/template inputs. Store each once and express `quote`, `enrollment`, `account_election`, `waiver`, and `tier_counts_derivable` as tags.
- The Minnesota and American University guides legitimately overlap eligibility/enrollment and prior-booklet semantics. Their primary role can remain eligibility/enrollment; multi-label classification should capture the booklet role without copying the files.

## Privacy, safety, and test-suitability flags

| Risk | Affected examples | Required test treatment |
|---|---|---|
| PII-heavy schemas | Employer applications, election forms, censuses, 834 guides, payroll layouts | Mark blank/template/synthetic status explicitly; do not log extracted SSNs, DOBs, addresses, bank fields, beneficiaries, or salaries. Assert that booklet output excludes them. |
| Synthetic records that resemble PII | Benefits 24/7 TXT and S4 workbook | Tag `synthetic`; keep raw values out of snapshots and model traces unless redacted. |
| Macro-enabled nested workbooks | Anthem ZIP | Never execute or enable macros. Inspect workbook values/formulas only; use safe archive and workbook readers. |
| Archive expansion and request size | Medicare CPSC ZIP: about 34 MiB compressed and 171 MiB expanded | Enforce entry count, expanded-byte, compression-ratio, and path traversal limits. Run as an explicit scale fixture, not a default per-PR LLM test. |
| Encrypted/restricted PDFs | Kaiser employer application; Alaska BEARS layout | Keep as parser compatibility cases and distinguish permission encryption from unreadable/password-protected content. |
| Long or diluted documents | Wisconsin QLE 96 pages; WAHBE 102; NYC 67; Crook County 93; CMS FFE 46 | Add relevant-page hints and test page/chunk selection. Do not send entire documents repeatedly to an LLM. |
| Historical/time-sensitive content | Highmark 2020, CalPERS 2021, Minnesota 2023, CMS FFE 2013, Navia 2018, NYC 2016, Kaiser Oregon legacy form, NC historical analysis, Crook 2023 | Tag `historical`; assert that old rates/rules cannot override a current employer source. |
| Aggregate public data mistaken for employer facts | Medicare CPSC and Medicaid managed-care CSV | Use as negative classification/scale/reference fixtures. Assert that they do not populate an employer's offered plans, elections, or contribution tables. |

## Required structural corrections

1. Distribute all five combined rate examples into the existing precise rate leaves and retire `rates-contributions-and-payroll-examples`.
2. Create/rename `benefit-admin-and-payroll-interface-specifications` and place the CMS FFE, Navia, Alaska, NYC, and WAHBE specifications there.
3. Move the Benefits 24/7 TXT into `current-enrollment-exports`; it is the only actual employer-program enrollment export in these two current export-related leaves.
4. Rehome the OCA census template and Savannah election form; move the two CMS aggregate datasets to public reference/negative-fixture material.
5. Move the S4 workbook to employee census and the OPM Table 1 guide to a reporting-template leaf. Keep the three completed tier-count analyses together and rename their leaf if necessary.
6. Update each affected README and the future machine-readable manifest after moves. Record a single primary subtype plus secondary roles/tags; do not copy files into every applicable category.
7. Add the safety/privacy tags above before using these artifacts in raw LLM tests.

## Missing examples after correction

These are corpus gaps and require new source artifacts; they are not reasons to keep a misclassified file in place.

- **Current employer enrollment exports:** four additional de-identified or officially synthetic examples are needed after moving in Benefits 24/7. Target a benefits-admin plan-election CSV/XLSX, a payroll deduction export, a physical 834 sample file (not a guide), and a plan-by-tier current-enrollment snapshot.
- **Completed tier-count reports/analyses:** two more examples are needed after retaining Houston County, North Carolina, and Crook County.
- **Tier-count reporting templates:** four more are needed if the OPM guide starts a five-example template leaf.
- **Quotes and proposals:** the existing leaf remains empty; none of the rate files is an employer-specific quote/proposal.
- **Renewal rates:** the existing leaf remains empty; the Crook County analysis is a renewal cost exhibit but belongs primarily with tier counts unless the category model permits a secondary-role scenario reference.
- **Public enrollment reference data:** three more are needed only if this becomes a first-class five-example leaf. Otherwise keep the Medicare/Medicaid datasets as explicitly non-core negative/scale fixtures.

## Bottom line

The scraped artifacts themselves are generally valid and useful. The correction is to stop treating “related to enrollment” as equivalent to “current enrollment export,” and to stop treating “contains a file layout” as equivalent to “is an export.” Primary-role folders should be narrow; secondary booklet uses belong in manifest tags and mixed-document scenarios.
