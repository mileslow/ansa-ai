# Valuable benefit-source additions

Retrieved and verified on **2026-07-17**.

This report covers eight high-value additions under
`source-docs/03_benefit-source-documents/`. The acceptance rule was based on
what each document says it is internally, not merely the title of the linking
web page. All source files are preserved as downloaded.

## Result

| Benefit area | Accepted subtype | Local destination |
| --- | --- | --- |
| Dental | Exact DHMO Schedule of Benefits / ADA-code copayment schedule | `dental/companion-schedules/01_western-dental_2026-california-state-dhmo-schedule-of-benefits.pdf` |
| Life and AD&D | Employer group life and AD&D certificate / ERISA SPD | `life-and-add/governing-certificates/01_plexus-corp_unum-basic-life-and-add-certificate-2026.pdf` |
| Short-term disability | Contributory group STD certificate | `short-term-disability/governing-certificates/01_caltech_unum-short-term-disability-certificate-2026.pdf` |
| Long-term disability | Employer-paid group LTD certificate / ERISA SPD | `long-term-disability/governing-certificates/01_middlebury-college_unum-employer-paid-ltd-certificate-2026.pdf` |
| Long-term disability | Employer-paid Core plus employee-paid Buy-Up LTD SPD with embedded carrier certificate | `long-term-disability/governing-certificates/02_university-of-missouri-system_metlife-core-buy-up-ltd-spd-and-certificate-2026.pdf` |
| Vision | Full standalone vision certificate | `vision/governing-certificates/01_washington-hca-pebb_metlife-davis-vision-certificate-2026.pdf` |
| Prescription and pharmacy | Standalone prescription-drug plan SPD | `prescription-and-pharmacy/benefit-summaries/01_kentucky-kehp_livingwell-ppo-prescription-drug-spd-2026.pdf` |
| Prescription and pharmacy | PBM/member administration and claims guide | `prescription-and-pharmacy/member-and-claims-guides/01_new-jersey-shbp-sehbp_prescription-drug-member-guidebook-2026.pdf` |

## 1. Western Dental 2026 Schedule of Benefits

- **Authority:** California Department of Human Resources (CalHR), the official
  State of California employee-benefits source.
- **Source page:**
  https://benefits.calhr.ca.gov/open-enrollment/virtual-library/dental-bookshelf/
- **Direct PDF:**
  https://benefits.calhr.ca.gov/wp-content/uploads/sites/362/2025/12/2026-Western-Dental-Benefits-Schedule.pdf
- **Exact subtype:** DHMO Schedule of Benefits and member copayment schedule,
  organized by ADA procedure code.
- **Bucket decision:** Dental, under `companion-schedules`. This is the exact
  schedule companion to the Western Dental EOC, not a general dental brochure
  and not a medical-plan document.
- **Distinct test value:** Supplies granular procedure codes, descriptions, and
  member copayments that are not reliably recoverable from a high-level EOC.
  It supports EOC-plus-schedule joins and code-level extraction tests.
- **File facts:** PDF 1.7; 29 pages; 2,090,989 bytes; not encrypted.
- **SHA-256:**
  `c07c622e018a58d06a7e68876c00a3e8147912cbbf8cfc7b0a5edfbe7213a3c5`
- **Verification:** `file` identified a real PDF; `pdfinfo` opened it; text
  extraction identified “2026 Western Dental Benefits Schedule,” “STANDARD
  PLAN,” ADA codes, and copayments; the first benefit-schedule page rendered
  correctly.

## 2. Plexus Corp. / Unum 2026 Basic Life and AD&D Certificate

- **Authority:** Plexus Corp.'s official employee-benefits site, hosted on
  UnitedHealthcare infrastructure; certificate issued by Unum Life Insurance
  Company of America.
- **Source page:**
  https://plexusbenefits.uhc.com/finances/life-insurance/
- **Direct PDF:**
  https://plexusbenefits.uhc.com/wp-content/uploads/2025/12/Basic-Life-and-ADD-Salary.pdf
- **Exact subtype:** Employer group basic life and AD&D certificate of coverage,
  including the ERISA SPD provisions. It also describes contribution rules when
  supplemental group life is elected.
- **Bucket decision:** `life-and-add/governing-certificates`. The internal table
  of contents has separate Life Insurance and AD&D benefit, claim, and feature
  sections; this is not an AD&D-only contract.
- **Distinct test value:** Provides current employer-paid basic life, shared-cost
  supplemental logic, salary-multiple benefits, age reductions, accelerated
  benefits, premium waiver, conversion, portability, claims, and AD&D terms in a
  single governing source.
- **Currentness evidence:** Cover dated November 13, 2025; certificate forms and
  state variations dated January 1, 2026. The PDF's legacy creation metadata is
  not used as the plan-year authority.
- **File facts:** PDF 1.5; 54 pages; 211,553 bytes; not encrypted.
- **SHA-256:**
  `adeca7893de077e8aabca354b847484f44783fa212a885ef1a3ab6389e914c18`
- **Verification:** Text extraction identified Plexus Corp., policy 912097 012,
  “Your Group Life and Accidental Death and Dismemberment Plan,” a life-insurance
  table of contents, 2026 form dates, and contribution rules. The table-of-
  contents page rendered correctly.

## 3. Caltech / Unum 2026 Short-Term Disability Certificate

- **Authority:** California Institute of Technology Human Resources; certificate
  issued by Unum Life Insurance Company of America.
- **Direct PDF:**
  https://hr.caltech.edu/documents/7273/2026_Short_Term_Disability_STD_Certificate_Outside_of_CA.pdf
- **Exact subtype:** Governing contributory group STD certificate for eligible
  Caltech employees outside CA, HI, NJ, NY, and RI.
- **Bucket decision:** `short-term-disability/governing-certificates`. The
  certificate explicitly identifies a Short Term Disability Plan, not combined
  STD/LTD coverage.
- **Distinct test value:** Tests employee-paid coverage, jurisdictional
  eligibility exclusions, a seven-day elimination period, partial disability,
  60-percent income replacement, weekly maximums, claims, appeals, and state
  variations.
- **Currentness evidence:** Issued January 2, 2026; certificate forms dated
  January 1, 2026.
- **File facts:** PDF 1.5; 43 pages; 180,216 bytes; not encrypted.
- **SHA-256:**
  `24791e0ce0bbc922b917325446aa425295487eda9906a109f61130e2ebbb24bb`
- **Verification:** Text extraction identified Caltech, policy 943495 011,
  “CERTIFICATE OF COVERAGE,” STD-only schedule and benefit sections, 2026 dates,
  and employee contribution requirements. The Schedule of Benefits rendered
  correctly.

## 4. Middlebury College / Unum 2026 Employer-Paid LTD Certificate

- **Authority:** Middlebury College Human Resources; certificate issued by Unum
  Life Insurance Company of America.
- **Source page:**
  https://www.middlebury.edu/human-resources/benefits/2026-benefits-information/2026-benefits-plan-details-and-resources
- **Direct PDF:** https://www.middlebury.edu/media/39825
- **Exact subtype:** Employer-paid group long-term disability certificate of
  coverage with ERISA SPD provisions.
- **Bucket decision:** `long-term-disability/governing-certificates`.
- **Distinct test value:** A clean employer-paid LTD case: 60 percent of monthly
  earnings, $10,000 monthly maximum, 180-day elimination period, age-based
  maximum payment period, offsets, own-occupation terms, claims, conversion, and
  return-to-work provisions.
- **Currentness evidence:** Certificate cover dated October 20, 2025; operative
  certificate forms dated January 1, 2026; Middlebury publishes it on the 2026
  plan-resources page.
- **File facts:** PDF 1.7; 42 pages; 225,674 bytes; not encrypted.
- **SHA-256:**
  `67f6ecb60ebfe5a9fff3e9d01ab5f1dca2a9c80bb913423af451640f0f55b54f`
- **Verification:** Text extraction identified policy 469869 012, a full LTD
  certificate, “Your Employer pays the cost of your coverage,” the 60-percent
  benefit, $10,000 maximum, and 180-day elimination period. The Benefits at a
  Glance page rendered correctly.

## 5. University of Missouri System / MetLife 2026 Core and Buy-Up LTD SPD

- **Authority:** University of Missouri System Office of Human Resources;
  insured by MetLife.
- **Source page:**
  https://www.umsystem.edu/departments-staff/human-resources/benefits-retirement/insurance/life-disability-plans/long-term-disability-plans
- **Official SPD index:**
  https://www.umsystem.edu/departments-staff/human-resources/benefits-retirement/plan-documents-required-notices/summary-plan-description-spd
- **Direct PDF:**
  https://www.umsystem.edu/sites/default/files/media/documents/general/spd-ltd.pdf
- **Exact subtype:** 2026 employer LTD SPD containing an embedded MetLife
  certificate of coverage, with employer-paid Core and employee buy-up options.
- **Bucket decision:** `long-term-disability/governing-certificates`.
- **Distinct test value:** Contrasts two funding and benefit configurations in
  one authoritative document. Core is fully university-paid at 60 percent with
  a $7,500 monthly maximum; Buy Up is partially employee-paid at 66-2/3 percent
  with an $8,333 maximum. It also exercises auto-enrollment, evidence of
  insurability, opt-out, pretax/after-tax elections, and governing-document
  precedence.
- **Currentness evidence:** SPD effective January 1, 2026 and modified in June
  2026.
- **File facts:** PDF 1.7; 77 pages; 835,011 bytes; not encrypted.
- **SHA-256:**
  `bffca09f597fb99cdd2b7b8513c4f7e7911835980098c3a9f86eeeb25a17995a`
- **Verification:** Text extraction identified the 2026 effective date, Core
  and Buy Up options, payer rules, benefit amounts, certificate precedence, and
  the embedded “MetLife Certificate of Coverage” section. The funding and option
  comparison page rendered correctly.

## 6. Washington HCA PEBB / Davis Vision by MetLife 2026 Certificate

- **Authority:** Washington State Health Care Authority Public Employees
  Benefits Board (PEBB); underwritten by Metropolitan Life Insurance Company.
- **Source page:**
  https://www.hca.wa.gov/pebb-benefits-admins/pebb-benefits/vision
- **Direct PDF:**
  https://www.metlife.com/content/dam/metlifecom/us/homepage/WSHCA/pdf/2024/new-v1/164995-wa-state-health-care-authority-pebb-164995-2-g-cert4-davis-vision-01-01-26.pdf
- **Exact subtype:** Full standalone Davis Vision group certificate, not a
  one-page benefit summary or comparison chart.
- **Bucket decision:** `vision/governing-certificates`.
- **Distinct test value:** Adds a complete 86-page vision contract with schedule,
  adult and under-19 coverage, network rules, claims, exclusions, low-vision
  services, and state notices. This creates a materially richer vision input than
  a benefit flyer.
- **Currentness evidence:** Certificate date January 1, 2026.
- **File facts:** PDF 1.7; 86 pages; 1,183,847 bytes; not encrypted.
- **SHA-256:**
  `154bb54dac20f5339cec76a54fa7f5a02ce001bfd26d7c5f15c249c9fd9f85e6`
- **Verification:** Text extraction identified WA HCA PEBB, Davis Vision by
  MetLife, Certificate Number 4, and the January 1, 2026 date. The certificate
  cover rendered correctly.

## 7. Kentucky KEHP 2026 LivingWell PPO Prescription Drug SPD

- **Authority:** Commonwealth of Kentucky Personnel Cabinet, Kentucky Employees'
  Health Plan (KEHP).
- **Source page:**
  https://extranet.personnel.ky.gov/Pages/KEHP-Forms-for-members.aspx
- **Plan page:**
  https://extranet.personnel.ky.gov/Pages/LivingWellPPO.aspx
- **Direct PDF:**
  https://extranet.personnel.ky.gov/KEHP/2026%20RX%20SPD%20LivingWell%20PPO.pdf
- **Exact subtype:** Standalone prescription-drug plan Summary Plan Description.
- **Bucket decision:** `prescription-and-pharmacy/benefit-summaries`. It defines
  pharmacy plan coverage and cost sharing; it is not a list of covered drugs and
  therefore does not belong under `formularies`.
- **Distinct test value:** Exercises a pharmacy carve-out with plan definitions,
  cost-sharing schedule, retail and mail rules, value benefits, formulary
  references, utilization controls, exclusions, claims, and appeals.
- **Currentness evidence:** Effective January 1, 2026.
- **File facts:** PDF 1.7; 39 pages; 594,302 bytes; not encrypted.
- **SHA-256:**
  `548fd5a4f641dbdf7c84b1738c954a76d52bbc3828d6aa7367de3541cbda857f`
- **Verification:** Text extraction identified “SUMMARY PLAN DESCRIPTION,”
  “LIVINGWELL PPO PRESCRIPTION DRUG PLAN,” Commonwealth sponsorship, the 2026
  effective date, Schedule of Benefits, and prescription cost-sharing sections.
  The cover rendered correctly.

## 8. New Jersey SHBP/SEHBP July 2026 Prescription Drug Member Guidebook

- **Authority:** State of New Jersey Department of the Treasury, Division of
  Pensions & Benefits.
- **Source page:**
  https://www.nj.gov/treasury/pensions/member-guidebooks.shtml
- **Active-member page:**
  https://www.nj.gov/treasury/pensions/hb-active-shbp.shtml
- **Direct PDF:**
  https://www.nj.gov/treasury/pensions/documents/guidebooks/hp0506.pdf
- **Exact subtype:** Prescription Drug Plans Member Guidebook for SHBP and
  SEHBP, administered through OptumRx.
- **Bucket decision:** `prescription-and-pharmacy/member-and-claims-guides`. It
  explains use and administration of the pharmacy benefit; it is not a formulary
  and not a complete medical plan.
- **Distinct test value:** Adds retail, mail-order, specialty, eligibility,
  utilization-management, claims, appeals, fraud, contact, and privacy content.
  It is meaningfully different from both a formulary and the Kentucky governing
  Rx SPD.
- **Currentness evidence:** July 2026 edition; includes changes effective July 1,
  2026.
- **File facts:** PDF 1.4; 23 pages; 1,061,113 bytes; not encrypted.
- **SHA-256:**
  `030792accba61918046e846d78ca3b8a86de65026b6ba117b8cf1ab1838d59ec`
- **Verification:** Text extraction identified the SHBP/SEHBP Prescription Drug
  Plans Member Guidebook, July 2026 page footers, OptumRx administration, plan
  benefits, retail and mail-order service, claims, and appeals. The cover
  rendered correctly.

## Cross-file verification

- All eight files passed PDF signature/type checks and opened with `pdfinfo`.
- All are non-encrypted and have extractable text.
- Key classification pages were rendered with Poppler and visually reviewed;
  no malformed or blank source was accepted.
- SHA-256 comparison against the rest of `source-docs` found no duplicate copy
  of any of these eight files.
- The documents are public plan materials. No completed employee form, member
  account data, personal claim, or other individual PII was found.

## Rejected mislabeled source

The Washington HCA forms page labels
`PEBB_Life-Insurance-Certificate_012026.pdf` as “Life insurance Certificate of
Coverage (COC) - 2026.” The downloaded PDF internally identifies itself as an
**Accidental Death and Dismemberment Certificate of Insurance** and states that
it “only describes” AD&D insurance. It was therefore rejected as a life source
and the temporary corpus copy was deleted. The Plexus/Unum life-and-AD&D
certificate replaced it.

This is the same classification principle that keeps a CVS Caremark Performance
Drug List under prescription/pharmacy formularies rather than medical insurance:
related content is not enough; the document's operative role must match the
bucket.
