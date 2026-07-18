# Legal and Required Notice Source Documents

Five distinct, public, official model notice examples for benefits-booklet ingestion, classification, extraction, and template testing. The set covers Medicaid/CHIP premium assistance, Medicare Part D creditable coverage, COBRA, HIPAA special enrollment, and Marketplace coverage options.

Retrieved: **2026-07-17**

These files are research and test fixtures, not ready-to-send legal notices. A plan sponsor, administrator, broker, or counsel must confirm applicability, current law, current agency language, recipient population, delivery method, and timing before publication. This README is not legal advice.

## Inventory

| # | Notice type | Authority | Jurisdiction | Format | Pages | Size | SHA-256 |
|---|---|---|---|---:|---:|---:|---|
| 01 | Employer CHIP/Medicaid premium assistance | U.S. Department of Labor, EBSA | U.S. federal; state-specific contacts | PDF | 4 | 375,850 bytes | `6490b54c9d94a7b814e5331741cb045773ba3424bce55c4513ec92d41c814f4f` |
| 02 | Medicare Part D creditable coverage disclosure | Centers for Medicare & Medicaid Services | U.S. federal Medicare Part D | PDF | 4 | 108,267 bytes | `1edf183d631c1ebde8521b627b5a2ed9a6dea07caf846da17ad7371a59f6689f` |
| 03 | COBRA continuation coverage general notice | U.S. Department of Labor, EBSA | U.S. federal COBRA; single-employer group health plans | DOCX | 5* | 49,318 bytes | `768221d70a274daa89e4887eab9b590632c5b748084ce93d05cd4cb6c43834d9` |
| 04 | HIPAA special enrollment notice | U.S. Department of Labor, EBSA | U.S. federal group health plans | PDF | 14 | 808,153 bytes | `7e5a9a6e57953b7e94195b0cdfddd9732923bbd74f516daf84c3e98bf6c16438` |
| 05 | Health Insurance Marketplace coverage-options notice | U.S. Department of Labor and U.S. Department of Health and Human Services | U.S. federal; employers subject to the applicable notice requirement | PDF | 4 | 322,619 bytes | `5f7080ca047a6f00dca8b3cfc3e605629f85c886f01717c6d73e36405f5912a4` |

\* The DOCX page count is the value stored in its Office metadata and can vary after editing or opening with a different renderer.

## 01 - DOL Employer CHIP/Medicaid Premium Assistance Model Notice

- **Local file:** `01_dol_chip_medicaid_premium_assistance_model_notice.pdf`
- **Notice type:** Premium Assistance Under Medicaid and the Children's Health Insurance Program (CHIP)
- **Authority:** U.S. Department of Labor, Employee Benefits Security Administration
- **Applicability/trigger:** Employers maintaining a group health plan in a state that offers Medicaid or CHIP premium assistance generally provide the Employer CHIP Notice to employees annually. It can be included with enrollment or open-season materials when the applicable distribution requirements are met.
- **Recipient population:** Employees, regardless of whether they are enrolled in or eligible for the employer plan, when the statutory conditions apply.
- **Jurisdiction:** Federal notice with a state-by-state directory of premium-assistance programs.
- **Source page:** https://www.dol.gov/agencies/ebsa/employers-and-advisers/plan-administration-and-compliance/health-plans
- **Direct file:** https://www.dol.gov/sites/dolgov/files/EBSA/laws-and-regulations/laws/chipra/model-notice.pdf
- **Retrieved:** 2026-07-17
- **Metadata:** PDF 1.6; 4 letter-size pages; 375,850 bytes; title `Model Notice`; author `Employee Benefits Security Administration - United States Department of Labor`; created 2026-02-04; modified 2026-05-28; OMB Control Number 1210-0137, shown as expiring 2029-05-31.
- **Current-as-of statement:** The document says its state list is current as of 2026-01-31.
- **Fields/data available for extraction:** notice type; federal authority; annual timing; 60-day special-enrollment window after premium-assistance eligibility; state name; Medicaid/CHIP/HIPP program name; program URL; phone; email; mailing/fax details; EBSA and CMS contacts; source-current date; OMB number and expiration.
- **BenefitsPackage mapping:** `legalNotices[].type`, `legalNotices[].authority`, `legalNotices[].recipientPopulation`, `legalNotices[].deliveryCadence`, `legalNotices[].specialEnrollmentWindowDays`, `legalNotices[].jurisdictions[]`, `legalNotices[].programContacts[]`, and `source.versionDate`.
- **Verification:** `%PDF`/PDF 1.6 signature confirmed; `pdfinfo` opened it without errors; text extracted successfully; first page rendered to PNG and visually inspected; content is a real DOL model notice rather than HTML or an access-denied page.
- **Currency/legal limitations:** The state directory changes periodically. Always re-download from DOL before production rather than treating this fixture's contacts as permanent. Employer coverage, employee residence, delivery rules, and plan-specific facts still require review.

## 02 - CMS Medicare Part D Creditable Coverage Model Notice

- **Local file:** `02_cms_medicare_part_d_creditable_coverage_model_notice.pdf`
- **Notice type:** Model Individual Creditable Coverage Disclosure Notice Language
- **Authority:** Centers for Medicare & Medicaid Services
- **Applicability/trigger:** Entities offering prescription drug coverage to Medicare Part D-eligible individuals must determine whether it is creditable and provide the required disclosure. CMS says the individual notice is provided annually before October 15 and at other required times, including when a Medicare-eligible individual joins the plan.
- **Recipient population:** Medicare-eligible active employees and dependents, COBRA individuals and dependents, covered disabled individuals, and retirees/dependents when covered by the entity's prescription-drug plan.
- **Jurisdiction:** U.S. federal Medicare Part D.
- **Source page:** https://www.cms.gov/medicare/employers-plan-sponsors/creditable-coverage/model-notice-letters
- **Direct file:** https://www.cms.gov/medicare/prescription-drug-coverage/creditablecoverage/downloads/modelcreditablecoveragedisclosurenotice051711.pdf
- **Retrieved:** 2026-07-17
- **Metadata:** PDF 1.5; 4 letter-size pages; 108,267 bytes; title `Important Notice to those Covered under Sponsor Plans`; author `CMS`; created/modified 2011-05-17; CMS Form 10182-CC; OMB 0938-0990.
- **Placeholders/fields:** entity name; plan name; whether Medicare enrollment affects current coverage; whether dropped coverage can be regained; alternate contact; contact position/office; street address; phone; optional individual name, DOB or member ID, creditable-coverage date ranges, notice date, and sender.
- **BenefitsPackage mapping:** prescription-drug plan identity; creditable/non-creditable status; plan effect/coordination wording; annual notice date; recipient eligibility; entity/contact data; optional personalized coverage history; legal-notice content and source provenance.
- **Verification:** PDF signature confirmed; `pdfinfo` opened it without errors; all 4 pages were recognized; text extracted successfully; first page rendered and visually inspected; the file is not HTML.
- **Currency/legal limitations:** The PDF itself is dated 2011, although CMS still links it on the current model-letter page. CMS issued CY 2026 creditable-coverage guidance and states that existing model language may continue only when all required data elements are present. Confirm the plan's creditable status, current CMS requirements, required timing, current URLs, and all plan-specific inserts before use.

## 03 - DOL COBRA Continuation Coverage General Notice

- **Local file:** `03_dol_cobra_general_model_notice.docx`
- **Notice type:** Model General Notice of COBRA Continuation Coverage Rights
- **Authority:** U.S. Department of Labor, Employee Benefits Security Administration
- **Applicability/trigger:** A COBRA-covered group health plan generally provides the general notice to covered employees and covered spouses within the first 90 days after coverage begins. This is the general notice, not the later COBRA election notice sent after a qualifying event.
- **Recipient population:** Covered employees and covered spouses under applicable COBRA group health plans.
- **Jurisdiction:** U.S. federal COBRA; the file explicitly targets single-employer group health plans.
- **Source page:** https://www.dol.gov/agencies/ebsa/laws-and-regulations/laws/cobra/tools-resources
- **Direct file:** https://www.dol.gov/sites/dolgov/files/EBSA/laws-and-regulations/laws/cobra/model-general-notice.docx
- **Retrieved:** 2026-07-17
- **Metadata:** Office Open XML DOCX; 49,318 bytes; internal Office properties report 5 pages, 1,998 words, title `Model COBRA Continuation Coverage General Notice`, company `Department of Labor`, and OMB Control Number 1210-0123 displayed in the document.
- **Placeholders/fields:** plan name; whether beneficiaries must pay for COBRA; retiree coverage/bankruptcy language; employer name; qualifying-event notice period; notice recipient; plan notice procedures and required documentation; disability-extension procedures; plan administrator/contact name or position; address; phone; applicable plan-specific options.
- **BenefitsPackage mapping:** `employer.name`; `plans[].name`; plan administrator contacts; COBRA applicability; qualifying events; general-notice deadline; participant notice procedures; continuation durations; retiree coverage; premium responsibility; coverage alternatives; plan contact data; source provenance.
- **Verification:** ZIP/Office signature confirmed by `file`; `unzip -t` found no package errors; Word XML and Office properties were present; macOS `textutil` extracted the expected model-notice text; Quick Look rendered a first-page preview that was visually inspected.
- **Currency/legal limitations:** The DOCX displays an OMB expiration of 2026-02-28, which predates retrieval, even though DOL still links this file as its Model General Notice. This fixture must not be sent without checking DOL for a renewed model, completing every applicable option and placeholder, removing inapplicable instructions, and verifying federal/state continuation rules. It is not a COBRA election notice.

## 04 - DOL HIPAA Special Enrollment Model Notice Collection

- **Local file:** `04_dol_hipaa_special_enrollment_model_notice_collection.pdf`
- **Primary notice type for this example:** Model Special Enrollment Notice under HIPAA group-health-plan portability/special-enrollment rules.
- **Authority:** U.S. Department of Labor, Employee Benefits Security Administration
- **Applicability/trigger:** The special-enrollment notice is generally provided to employees eligible to enroll in a group health plan at or before the first opportunity to enroll. It explains rights after loss of other coverage or employer contributions and after marriage, birth, adoption, or placement for adoption.
- **Recipient population:** Employees eligible to enroll in the group health plan.
- **Jurisdiction:** U.S. federal group health plan requirements.
- **Source page:** https://www.dol.gov/agencies/ebsa/about-ebsa/our-activities/resource-center/publications/compliance-assistance-guide
- **Direct file:** https://www.dol.gov/sites/dolgov/files/EBSA/about-ebsa/our-activities/resource-center/publications/compliance-assistance-guide-appendix-c.pdf
- **Retrieved:** 2026-07-17
- **Metadata:** PDF 1.6; 14 letter-size pages; 808,153 bytes; title `Model Notices for Group Health Plans`; author `U.S. Department of Labor`; created 2014-11-19; modified 2024-08-08; contains an AcroForm.
- **Relevant location:** PDF page 2 (printed page 138) contains the Model Special Enrollment Notice.
- **Placeholders/fields:** enrollment-request period (30 days or longer if the plan allows); plan representative name; title; telephone number; other contact details; triggering loss of other coverage/contributions; marriage, birth, adoption, and placement-for-adoption events.
- **Additional classification value:** The same official appendix also contains model wellness, Newborns' Act, WHCRA enrollment and annual, and adverse-benefit-determination notices. It is useful for testing a classifier that must split one multi-notice PDF into separate legal-notice records.
- **BenefitsPackage mapping:** notice type; eligible population; notice timing; special-enrollment event taxonomy; enrollment-window duration; plan representative contact; source page range; related embedded notice types.
- **Verification:** PDF signature confirmed; `pdfinfo` opened it without errors; all 14 pages were recognized; text extracted from the cover and special-enrollment page; both the first page and the relevant special-enrollment page were rendered to PNG and visually inspected; no HTML/error content found.
- **Currency/legal limitations:** This is a multi-notice appendix, not a single ready-to-send form. Some later model forms in the appendix display old OMB dates, so do not publish the appendix wholesale. Confirm the current enrollment window, CHIP-related 60-day rights when relevant, state protections, plan procedures, and the latest DOL model language.

## 05 - DOL/HHS Marketplace Coverage Options Notice

- **Local file:** `05_dol_marketplace_coverage_options_model_notice.pdf`
- **Notice type:** Health Insurance Marketplace Coverage Options and Your Health Coverage - model for an employer that offers a health plan to some or all employees.
- **Authority:** U.S. Department of Labor and U.S. Department of Health and Human Services
- **Applicability/trigger:** DOL identifies this as a model notice for employers that offer a health plan to some or all employees. The applicable employer notice requirement is tied to hiring/new employees; applicability should be verified for the employer.
- **Recipient population:** Employees covered by the applicable employer notice rule, regardless of whether they are eligible for or enrolled in the employer's health plan.
- **Jurisdiction:** U.S. federal Marketplace/employee coverage-options notice.
- **Source page:** https://www.dol.gov/agencies/ebsa/laws-and-regulations/laws/affordable-care-act/for-employers-and-advisers/coverage-options-notice
- **Direct file:** https://www.dol.gov/sites/dolgov/files/EBSA/laws-and-regulations/laws/affordable-care-act/for-employers-and-advisers/health-insurance-marketplace-coverage-options-complete.pdf
- **Retrieved:** 2026-07-17
- **Metadata:** PDF 1.6; 4 letter-size pages; 322,619 bytes; title `Health Insurance Marketplace Coverage Options and Your Health Coverage`; authorship metadata names HHS and DOL; created 2023-12-14; modified 2024-08-21; AcroForm present; OMB 1210-0149 shown as expiring 2026-12-31.
- **Placeholders/fields:** employer name; EIN; address; phone; city/state/ZIP; health-coverage contact; contact phone/email; employee eligibility categories; eligible dependents; whether coverage is offered; minimum-value/affordability representation; lowest-cost employee-only premium; payroll frequency; optional plan-year changes and employee data.
- **BenefitsPackage mapping:** employer identity and contacts; benefits contact; plan-offer status; eligible employee classes/dependents; minimum-value status; lowest-cost employee premium and payroll frequency; Marketplace explanation; source version/OMB data.
- **Verification:** PDF signature confirmed; `pdfinfo` opened it without errors; all 4 pages were recognized; text extracted successfully; first page rendered to PNG and visually inspected; file is not HTML.
- **Currency/legal limitations:** DOL labels the model as updated February 2024, but the downloaded PDF contains indexed 2023 affordability language and temporary Medicaid/CHIP unwinding dates. Those figures and date-specific paragraphs are stale for a 2026 production notice. Treat this as an authoritative structural example only and obtain the latest DOL model/current indexed values before use.

## Verification Artifacts

The hidden `.verification/` subfolder contains first-page PNGs, the visually inspected special-enrollment page, and extracted COBRA text used only to validate these source files. The five numbered files above are the original source-document examples.

## Coverage Rationale

The examples are meaningfully different in purpose, recipient population, trigger, source agency, and format:

1. A federal notice containing a nationwide state-program directory.
2. A Medicare-specific, plan-status disclosure with optional personalized fields.
3. An editable continuation-coverage rights template with extensive plan-specific branching.
4. A multi-notice compliance PDF whose relevant HIPAA notice is embedded on a later page.
5. An employer/coverage-information form that combines employee-facing education with structured employer and cost fields.
