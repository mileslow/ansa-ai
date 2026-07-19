# FCPS 2026 Medicare-retiree medical options

Retrieved and verified on 2026-07-17.

## Offering scope

Fairfax County Public Schools lists exactly two medical choices for Medicare-eligible retirees and dependents for the 2026 plan year:

- Aetna Medicare Advantage (PPO ESA)
- Kaiser Permanente Medicare Advantage Group Plan (HMO), available only within Kaiser's Medicare Advantage service area

The FCPS retiree medical page and 2026 open-enrollment materials confirm that both plans continued for 2026. The folder therefore contains one official, employer-specific plan document for each medical choice.

### Inclusion and exclusion logic

- Included Aetna and Kaiser because they are the two medical options in FCPS's `Plans for Medicare-eligible Retirees` section.
- Excluded CareFirst BlueChoice Advantage and Kaiser Permanente HMO Signature because FCPS lists them for non-Medicare-eligible retirees.
- Excluded SilverScript as a separate option because FCPS describes it as prescription coverage included with Aetna medical coverage, not a third medical plan.
- Did not create separate PDFs for enrollment coverage tiers or service-area variants. Those are enrollment/eligibility dimensions within a plan, not additional FCPS medical choices.
- Document types differ because the official FCPS-linked Aetna artifact is a Summary of Benefits, while the available Kaiser artifact is the full Evidence of Coverage. Both identify FCPS-specific 2026 coverage.

## Official sources

- FCPS retiree medical options page: <https://www.fcps.edu/about-fcps/employees/retirees/medical-insurance-retirement/medical-insurance-options>
- FCPS 2026 retiree open-enrollment page: <https://www.fcps.edu/benefits-open-enrollment-for-retirees>
- FCPS 2026 Aetna Summary of Benefits: <https://www.fcps.edu/sites/default/files/2026_Aetna%20Medicare_Summary_of_Benefits_10_30_25.pdf>
- Kaiser FCPS plans and services page: <https://myhealth.kaiserpermanente.org/fcps/plans-and-services/>
- Kaiser FCPS 2026 Evidence of Coverage: <https://myhealth.kaiserpermanente.org/fcps/wp-content/uploads/sites/3/2025/10/FCPS-EOC-2026_ADA.pdf>

## Local files and verification

### `aetna-medicare-advantage-ppo-esa-summary-of-benefits.pdf`

- Official title: `2026 Summary of Benefits`
- Plan identification: Fairfax County Public Schools; Aetna Medicare Plan (PPO); Medicare (C04) ESA PPO Plan
- Coverage period: January 1-December 31, 2026
- PDF 1.7; 13 pages; 394,513 bytes
- SHA-256: `b9f868bff6a1ed45c3ed82762c8984ed4728edde22235a5ebb929da0ad8a52d3`
- Verification: `%PDF-` signature confirmed; `pdfinfo` opened the document; first-page text extraction identified FCPS, Aetna, PPO ESA, and the 2026 term. Page 1 was rendered with Poppler and visually checked; the title, employer, plan type, dates, eligibility text, and Aetna branding are intact and legible.

### `kaiser-permanente-medicare-advantage-group-hmo-eoc.pdf`

- Official title: `Evidence of Coverage`
- Plan identification: Kaiser Permanente Medicare Advantage Group Plan (HMO)
- Coverage period: January 1-December 31, 2026
- PDF 1.6; 215 pages; 1,310,984 bytes
- SHA-256: `ab9d7438df4b637a6771a1366a65700b436a60e593e98917a4450c32dfea0746`
- Verification: `%PDF-` signature confirmed; `pdfinfo` opened the document; first-page text extraction identified the group HMO, Medicare medical and prescription coverage, and the 2026 term. Page 1 was rendered with Poppler and visually checked; the EOC title, plan designation, dates, contact information, document code, and Kaiser branding are intact and legible.
