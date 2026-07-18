# HSA source document examples

Five public, real Health Savings Account (HSA) documents selected to exercise materially different benefits-booklet extraction paths. The set includes federal tax guidance, a 2026 Marketplace consumer guide, a public-employer HDHP/HSA enrollment guide with employer funding, a payroll contribution-change form, and an employer-to-custodian agreement. These files are source examples, not plan, tax, legal, or enrollment advice.

Retrieval date for every file: **2026-07-17**.

## 1. IRS Publication 969 for 2025 returns

- **Organization:** Internal Revenue Service (IRS), U.S. Department of the Treasury
- **Jurisdiction / market:** United States federal tax guidance for individuals and employers
- **Plan / program design:** General HSA and HDHP eligibility, contribution, distribution, rollover, employer-participation, and tax treatment rules; also discusses Archer MSAs, Medicare Advantage MSAs, health FSAs, and HRAs
- **Document subtype:** Official federal tax publication, Publication 969
- **Why distinct:** This is the authoritative rules source in the set. It tests extraction from a dense regulatory publication containing eligibility tests, federal definitions, tax reporting, contribution and distribution rules, and interactions among multiple tax-favored health arrangements rather than a single employer plan.
- **Source page URL:** <https://www.irs.gov/forms-pubs/about-publication-969>
- **Direct file URL:** <https://www.irs.gov/pub/irs-pdf/p969.pdf>
- **Retrieved:** 2026-07-17
- **Local filename:** `01_irs_2025_publication_969_hsa_tax_guidance.pdf`
- **File facts:** PDF 1.7; 1,306,073 bytes (1.2 MiB); 22 pages; US Letter; tagged; not encrypted
- **Fields supported:** source authority, tax year, HSA definition, eligible-individual requirements, HDHP minimum-deductible and out-of-pocket rules, disqualifying coverage, preventive-care exceptions, contribution rules, catch-up contributions, employer contributions, rollovers and transfers, excess contributions, distributions, qualified medical expenses, tax forms, account-holder death treatment, Medicare interaction, employer participation, and HSA/FSA/HRA/MSA coordination.
- **Verification:** The direct URL returned HTTP 200 with `application/pdf`; `file` identified a PDF rather than HTML; `pdfinfo` opened it and reported 22 unencrypted pages; extracted text identified Publication 969, the 2025-return edition, HSA/HDHP rules, and 2025 statutory updates. Page 1 was rendered with Poppler and visually inspected as complete, sharp, and legible. SHA-256: `d51681ecae43d517415500efe6f7dcc1bba65fed09b48d416f18d6407a5b522f`.
- **Known limitations:** This is federal tax guidance, not a plan document, SBC, employer contribution schedule, or custodial agreement. It is labeled for preparing 2025 returns and should not be used to infer a particular employer's plan year, contribution amount, administrator, fees, or state tax treatment. Poppler emitted non-fatal metadata-type warnings, but the document opens, extracts, and renders correctly.

## 2. CMS 2026 Marketplace HSA consumer guide

- **Organization:** Centers for Medicare & Medicaid Services (CMS), Health Insurance Marketplace
- **Jurisdiction / market:** U.S. individual and small-group Marketplace consumers, including SHOP and coverage outside the Marketplace
- **Plan / program design:** HSA-eligible health plans, including the 2026 expansion to more Marketplace Bronze and Catastrophic plans; contrasts HSA eligibility with Medicare and first-dollar coverage
- **Document subtype:** Official three-page consumer education fact sheet, CMS Product No. 11951
- **Why distinct:** Tests concise, visually designed consumer material rather than a technical plan contract. It explicitly connects HSAs to 2026 Bronze and Catastrophic Marketplace plans and includes contribution-limit, portability, withdrawal, qualified-expense, and Medicare guidance in plain language.
- **Source page URL:** <https://www.cms.gov/marketplace/in-person-assisters/outreach-education/new>
- **Direct file URL:** <https://www.cms.gov/marketplace/outreach-and-education/health-savings-account.pdf>
- **Retrieved:** 2026-07-17
- **Local filename:** `02_cms_2026_marketplace_hsa_consumer_guide.pdf`
- **File facts:** PDF 1.7; 882,238 bytes (862 KiB); 3 pages; US Letter; tagged; AcroForm present; not encrypted
- **Fields supported:** program identity, HSA definition, HSA-eligible-plan/HDHP linkage, 2026 Bronze and Catastrophic availability, Medicare and first-dollar-coverage exclusions, qualified-expense examples, rollover, portability, employer/household contributions, self-only and family limits for 2025 and 2026, age-55 catch-up contribution, tax advantages, nonqualified-withdrawal tax and penalty rules, retirement use, recordkeeping, Marketplace plan-search instructions, and consumer support contacts.
- **Verification:** The direct URL returned HTTP 200 with `application/pdf`; `file` identified a PDF; `pdfinfo` reported three unencrypted pages; extracted text identified the HSA title, 2026 Bronze/Catastrophic callout, 2025/2026 contribution table, Medicare rules, and CMS product number. Page 1 was rendered with Poppler and visually inspected as complete, legible, and free of clipping or missing-font blocks. SHA-256: `552f9d6884a80465aefa82f5fc66bc721b9a0fe99c2553e253fa038c1a35b342`.
- **Known limitations:** This is general consumer education, not an SBC, Evidence of Coverage, employer-sponsored HSA description, rate sheet, or bank agreement. It does not identify a specific carrier, network, premium, employer contribution, custodian, account fee, or state tax treatment. The presence of an AcroForm is publisher metadata; the document behaves as a read-only fact sheet for this use.

## 3. Wisconsin ETF 2026 HDHP/HSA decision guide

- **Organization:** Wisconsin Department of Employee Trust Funds (ETF)
- **Jurisdiction / market:** Wisconsin state employees enrolled in the State of Wisconsin Group Health Insurance Program
- **Plan / program design:** Public-employer HDHP options paired with an HSA administered by TASC for 2026, including state employer contributions and employee enrollment/re-enrollment information
- **Document subtype:** Official annual insurance benefits decision and open-enrollment guide, ET-2107
- **Why distinct:** Supplies the employer-specific funding layer that generic HSA guidance lacks. It connects medical plan design to HSA eligibility, states annual employer funding by coverage tier, shows employee contribution limits and carryover, and places the account alongside medical, FSA, LPFSA, dental, vision, and other enrollment choices.
- **Source page URL:** <https://etf.wi.gov/resource/2026-insurance-benefits-decision-guide-state-wisconsin-group-health-insurance-employees>
- **Direct file URL:** <https://etf.wi.gov/publications/26et-2107/download>
- **Retrieved:** 2026-07-17
- **Local filename:** `03_wisconsin_etf_2026_hdhp_hsa_decision_guide.pdf`
- **File facts:** PDF 1.5; 1,436,125 bytes (1.4 MiB); 20 pages; US Letter; tagged; not encrypted
- **Fields supported:** employer/program identity, plan year, open-enrollment dates, offered medical designs, HDHP-to-HSA linkage, HSA administrator, enrollment/re-enrollment requirement, self-only and family contribution limits, age-based catch-up limit, employer contribution by coverage tier, installment funding description, account ownership and portability, unlimited carryover, funds-availability rule, investment threshold, HSA/LPFSA relationship, plan comparison, premiums, enrollment process, and payroll/benefits contact routing.
- **Verification:** The direct URL returned HTTP 200 with `application/pdf`; `file` identified a PDF; `pdfinfo` reported 20 unencrypted pages; extracted text identified the 2026 State of Wisconsin decision guide, HDHP-only HSA rule, TASC administration, annual individual/family limits, and employer contributions of $852/$1,704. Page 1 was rendered with Poppler and visually inspected as a complete and legible official ETF cover. SHA-256: `a85be27e34fae78f61fc9c852f4ab9068f2a7706179b453581ccc9951686739b`.
- **Known limitations:** This is a broad benefits decision guide, so the HSA content is one part of a larger employee booklet and is not the bank's controlling custodial agreement. The contribution, eligibility, administrator, and enrollment facts are specific to Wisconsin state employment and the 2026 plan year. Employer funding for other groups must not be inferred from it.

## 4. Minnesota SEGIP 2026 HSA contribution-change form

- **Organization:** Minnesota Management and Budget (MMB), State Employee Group Insurance Program (SEGIP)
- **Jurisdiction / market:** Minnesota state employees eligible for the Advantage High Deductible Health Plan and associated HSA
- **Plan / program design:** Employee-directed annual HSA payroll contribution change, with health-plan-specific financial institutions overseeing the account
- **Document subtype:** Official blank enrollment/payroll authorization form with private-data notice, MMB-EIE-0004
- **Why distinct:** Adds a transactional form rather than narrative guidance. It tests extraction of writable fields, authorization language, effective timing, contribution limits, employer-contribution coordination, submission instructions, and a state privacy notice.
- **Source page URL:** <https://mn.gov/mmb/segip/find-a-form-3.jsp>
- **Direct file URL:** <https://mn.gov/mmb-stat/segip/doc/hsa-contribution-change-form.pdf>
- **Retrieved:** 2026-07-17
- **Local filename:** `04_minnesota_segip_2026_hsa_contribution_change_form.pdf`
- **File facts:** PDF 1.6; 1,122,231 bytes (1.1 MiB); 2 pages; US Letter; tagged; AcroForm and JavaScript present; not encrypted
- **Fields supported:** employee name, masked SSN structure, employee ID, address, work/home phone, email, requested annual personal HSA contribution, single/family coverage limits, age-55 catch-up rule, employer-versus-personal contribution warning, HDHP linkage, custodian-selection description, requested-change effective timing, employee authorization, signature/date, submission channels, support contact, private-data purpose, refusal consequences, and authorized data-sharing recipients.
- **Verification:** The direct URL returned HTTP 200 with `application/pdf`; `file` identified a PDF; `pdfinfo` reported two unencrypted pages; extracted text identified the 2026 limits, payroll-election purpose, employer-contribution warning, Advantage HDHP link, authorization, and Minnesota private-data notice. Page 1 was rendered with Poppler and visually inspected; all labels, blank fields, limit table, signature line, and submission instructions are visible and legible. SHA-256: `7d0714b7ac617538c8bcbc5ca6b8447156e586ea2ab8dfebfd3c236ba511b9a5`.
- **Known limitations:** The blank form requests sensitive personal data and must be used only as a structural test fixture, never populated with real employee information in an unsecured test system. It does not state the employer's actual contribution amount and says the financial institution varies by health plan. Interactive form behavior and JavaScript should be treated as untrusted and disabled during automated ingestion. Poppler emitted a non-fatal metadata warning, but the file opens, extracts, and renders correctly.

## 5. Optum Bank HSA enrollment and contribution agreement

- **Organization:** Optum Bank, Inc., a Utah-chartered FDIC-insured financial institution
- **Jurisdiction / market:** U.S. employer-sponsored HSA programs using Optum Bank; governing-law provisions reference Utah
- **Plan / program design:** Employer-sponsored qualified HDHP paired with employee-owned HSAs; employer may assist with enrollment and transmit employer or payroll-deduction contributions to the custodian
- **Document subtype:** Blank employer-to-HSA-custodian legal agreement with batch-enrollment and authorized-agent provisions
- **Why distinct:** Tests a formal operational and legal source rather than employee education. It describes how an employer and custodian divide enrollment, contribution, reporting, privacy, communication, authorized-agent, batch-file, termination, and compliance responsibilities.
- **Source page URL:** <https://business.optum.com/en/financial-solutions/health-benefit-accounts/health-savings-accounts.html>
- **Direct file URL:** <https://www.optum.com/content/dam/optum/consumer-activation/unknown/HSA_Enrollment_and_Contribution_Agreement.pdf>
- **Retrieved:** 2026-07-17
- **Local filename:** `05_optum_bank_hsa_enrollment_contribution_agreement.pdf`
- **File facts:** PDF 1.4; 279,370 bytes (273 KiB); 7 pages; US Letter; tagged; not encrypted
- **Fields supported:** employer identity, effective date, custodian identity, qualified-HDHP representation, employee HSA eligibility, Medicare representation, account opening, payroll and employer contribution transmission, reports, account ownership and nonforfeitability, batch-enrollment method, identity verification, authorized-agent appointment, debit-card issuance, required data exchange, employer contacts/authorized personnel, privacy safeguards, indemnification, communications, term and termination, governing law, signatures/titles/dates, and associated employee authorized-agent language.
- **Verification:** The direct URL returned HTTP 200 with `application/pdf`; `file` identified a PDF; `pdfinfo` reported seven unencrypted pages; extracted text identified Optum Bank, the employer blank, HSA/HDHP recitals, custodial services, enrollment, contribution transmission, and the numbered agreement sections. Page 1 was rendered with Poppler and visually inspected as complete, readable, and free of clipping or missing content. SHA-256: `22ac2a5bc82f2311d48c086c60aa693846acc844482daa34f82d44fe8d5d26f5`.
- **Known limitations:** The agreement is dated 2017 and should be treated as a historical-but-real format example, not assumed to be Optum's current contracting form. It is not an individual account's controlling deposit/custodial agreement, an employee enrollment guide, or a medical plan document. Legal obligations and current Optum processes require confirmation from the publisher.

## Coverage matrix

| Example | Role in an input package | Market / jurisdiction | Document form | Extraction edge represented |
| --- | --- | --- | --- | --- |
| IRS Publication 969 | Federal eligibility and tax authority | United States | Tax publication | Dense rules, definitions, reporting, and cross-account coordination |
| CMS Marketplace guide | Employee/consumer explanation and HSA-plan linkage | U.S. Marketplace/SHOP | Three-page fact sheet | Bronze/Catastrophic linkage, plain-language eligibility, limits, Medicare |
| Wisconsin ETF guide | Employer offering, HDHP selection, and employer funding | Wisconsin public employer | Annual decision guide | HSA embedded in a broader benefit package, tiered employer contribution |
| Minnesota SEGIP form | Employee election and payroll instruction | Minnesota public employer | Blank interactive form | Structured fields, authorization, effective date, privacy notice |
| Optum Bank agreement | Custodian setup and contribution operations | U.S. employer group / Utah bank | Legal agreement | Employer-custodian duties, batch enrollment, data/privacy, signatures |

## Verification method

Every direct URL was retrieved on 2026-07-17 and returned HTTP 200 with an `application/pdf` content type. Each saved file was identified as a PDF by `file`, opened by `pdfinfo`, sampled with `pdftotext`, and rendered on page 1 with `pdftoppm`. All five page-one renders were visually inspected and showed authentic publisher identity, readable content, and no HTML/error-page substitution, corruption, clipping, overlap, or missing-font blocks. The SHA-256 checksums above identify the exact downloaded originals.
