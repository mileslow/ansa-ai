# Voluntary and Supplemental Benefit Source Documents

This folder contains exactly five real, publicly accessible examples spanning five distinct voluntary benefit products and five distinct carriers or carrier organizations. The set is intentionally varied by product, document subtype, jurisdiction, audience, language, and plan design so it can exercise document classification, extraction, plan normalization, and booklet-section generation.

## Coverage summary

| # | Product | Carrier / organization | Document subtype | Distinctive test dimension |
|---|---|---|---|---|
| 1 | Accident insurance | Aflac | State-specific outline of coverage | California plan language and detailed scheduled benefits |
| 2 | Critical illness insurance | MetLife | Employee benefit overview | Consumer-facing education, claim scenario, and covered-condition summaries |
| 3 | Hospital indemnity insurance | Sun Life | Employer/product design flyer | Low/high plan comparison, confinement schedules, and claim examples |
| 4 | Cancer and specified disease insurance | The Standard / American Heritage Life | State-program enrollment brochure | South Carolina, Spanish-language, three plan levels, rates, and benefit schedule |
| 5 | Universal life with long-term-care benefits | Trustmark | Broker/employer product overview | Two permanent-life designs with living-benefit and age-based comparisons |

## 1. Aflac California Accident Outline of Coverage

- **Organization:** American Family Life Assurance Company of Columbus (Aflac)
- **Jurisdiction / market:** California; supplemental accident coverage
- **Plan / program design:** Accident-only coverage with wellness benefit, hospital admission and confinement benefits, ICU benefits, scheduled injury/treatment benefits, accidental death, and related limitations
- **Document subtype:** Regulatory outline of coverage (Form A36025CA / document A36225CAW)
- **Why it is distinct:** This is a state-specific, policy-adjacent coverage outline rather than a general marketing brochure. It has dense legal language and detailed dollar schedules that test benefit-table and limitation extraction.
- **Source webpage:** https://www.aflac.com/individuals/products/accident-insurance.aspx
- **Direct file:** https://www.aflac.com/products/accident/docs/A36225CAW.pdf
- **Retrieved:** 2026-07-17
- **Local filename:** `aflac-california-accident/outline-of-coverage.pdf`
- **File metadata:** PDF 1.3; 496,945 bytes; 6 pages; US Letter
- **SHA-256:** `ac44272538ffeea1c1bf18160e562e26fec8fb1c25e69138d698f6a85d84e327`
- **Potential `BenefitsPackage` fields:** carrier; product type; jurisdiction; policy/form identifiers; supplemental/not-major-medical disclosure; wellness benefit; eligibility definitions; covered-person definitions; accident treatment benefits; emergency-room and office-visit amounts; hospital admission, confinement, ICU, ambulance, rehabilitation, surgical, injury, follow-up, accidental-death, and dismemberment benefits; benefit timing; exclusions; limitations; continuation/termination language; carrier contacts
- **Verification:** The file signature is PDF, `pdfinfo` parses all six pages, and text extraction identifies Aflac, California form identifiers, scheduled accident benefits, limitations, and disclosures. Page 1 was rendered and visually inspected; headings, two-column content, dollar values, and footer/form numbers are legible with no clipping or rendering defects.
- **Known limitations:** The document is dated 2014 and represents a California-specific product form, not a current employer-specific election or rate sheet. It is an outline, not the controlling policy. Rates or payroll deductions are not included.

## 2. MetLife Critical Illness Insurance Benefit Overview

- **Organization:** Metropolitan Life Insurance Company (MetLife)
- **Jurisdiction / market:** United States group/workplace supplemental health market; general multi-state overview
- **Plan / program design:** Lump-sum critical illness coverage with examples involving cancer, heart attack, stroke, recurrence, and health-screening benefits; employee and dependent coverage concepts
- **Document subtype:** Employee-facing benefit overview / educational brochure
- **Why it is distinct:** This is a polished employee communication with narrative claim examples, icons, and educational language rather than a certificate or legal outline. It tests extraction from visually designed pages and separates example amounts from guaranteed plan terms.
- **Source webpage:** https://www.metlife.com/insurance/accident-health/critical-illness-insurance/
- **Direct file:** https://www.metlife.com/content/dam/metlifecom/us/homepage/regional/critical-illness-insurance-benefit-overview.PDF
- **Retrieved:** 2026-07-17
- **Local filename:** `metlife-critical-illness/benefit-overview.pdf`
- **File metadata:** PDF 1.7; 307,314 bytes; 5 pages; US Letter
- **SHA-256:** `a6ee80f7ecbf39f4d9e30c76a022345c7f1e8693f8aa1825bb406bd099e08348`
- **Potential `BenefitsPackage` fields:** carrier; product type; purpose/employee-facing description; covered illness categories; initial benefit; recurrence benefit; health-screening benefit; employee/spouse/child coverage; guaranteed-issue language; portability; benefit-use explanation; enrollment guidance; claim scenario; exclusions/disclosures; carrier contacts
- **Verification:** The file signature is PDF, `pdfinfo` parses five pages, and extracted text confirms MetLife Critical Illness Insurance, employee education, example claim use, covered-condition references, and enrollment messaging. Page 1 was rendered and visually inspected; the MetLife branding, image, headings, body copy, callout, and footnotes are sharp and unobstructed.
- **Known limitations:** This is a generic overview, not an employer-specific plan summary or certificate. Any benefit amounts shown in examples are illustrative and should not be treated as selected plan values without corroborating documents. Availability and terms can vary by plan and state.

## 3. Sun Life Hospital Indemnity Insurance Product Flyer

- **Organization:** Sun Life Assurance Company of Canada (U.S.)
- **Jurisdiction / market:** United States group supplemental health market; not available in New York and the flyer states additional state restrictions
- **Plan / program design:** Low and high hospital-indemnity options with first-day hospital, daily hospital, ICU, rehabilitation, extended hospitalization, and wellness benefits; confinement triggers include accident, sickness, pregnancy, newborn complications, mental/nervous disorders, and substance abuse
- **Document subtype:** Employer/broker product design and benefit-schedule flyer
- **Why it is distinct:** It provides side-by-side configurable plan levels, an explicit benefit schedule, implementation dates, and cumulative claim examples. This tests table extraction, scenario math, HSA-adjacent product rules, and plan-option comparison.
- **Source webpage:** https://www.sunlife.com/us/en/employers/products-and-services/supplemental-health/
- **Direct file:** https://www.sunlife.com/content/dam/sunlife/regional/usa/documents/hifl-9445-p.pdf
- **Retrieved:** 2026-07-17
- **Local filename:** `sun-life-hospital-indemnity/low-and-high-options.pdf`
- **File metadata:** PDF 1.4; 97,158 bytes; 2 pages; US Letter
- **SHA-256:** `c93516d692b8e8c852493c10dfbfa7fff2aff4b50caf6caa7746334bb73a6cb9`
- **Potential `BenefitsPackage` fields:** carrier; product type; plan level/name; first-day hospital amount; daily confinement amount and day maximum; ICU amount and day maximum; rehabilitation amount and day maximum; extended hospitalization amount and trigger; wellness benefit; covered confinement reasons; employee eligibility/hours; enrollment minimum; guaranteed-issue status; rate guarantee; portability; HSA compatibility; example claim calculations; policy form series; exclusions and state availability
- **Verification:** The file signature is PDF, `pdfinfo` parses both pages, and extracted text confirms the low/high schedules, confinement categories, extended-hospitalization logic, plan-design details, and underwriting disclosures. Page 1 was rendered and visually inspected; all benefit tables, chart labels, scenario figures, logo, and footnotes are legible without overlap or clipping.
- **Known limitations:** This is an employer-oriented product flyer dated 2020/2021, not an employer-specific election document or current certificate. It states that availability varies by state and that the illustrated results depend on elected plan design. It contains no group-specific payroll rates.

## 4. South Carolina Cancer and Specified Disease Enrollment Brochure

- **Organization:** The Standard (marketing name of StanCorp Financial Group); underwritten by American Heritage Life Insurance Company
- **Jurisdiction / market:** South Carolina schools and state agencies; group voluntary cancer and specified-disease coverage
- **Plan / program design:** Three cancer plan levels covering cancer and 29 specified diseases, with hospitalization, radiation/chemotherapy, surgery, related services, initial diagnosis, ICU, wellness, waiver-of-premium, and employee/dependent tiers
- **Document subtype:** State-program employee enrollment brochure with benefit and premium schedules
- **Why it is distinct:** It is a South Carolina-specific Spanish-language enrollment document containing three plan choices, monthly employee/family tier rates, fixed benefit schedules, definitions, a claim scenario, and state/program branding. It tests multilingual classification and extraction as well as rate-to-plan association.
- **Source webpage:** https://allstatevoluntary.com/scenrollmentCancer-wICU/
- **Direct file:** https://allstatevoluntary.com/scenrollmentCancer-wICU/pdf/scenrollmentcancer-wicu_cancer.pdf
- **Retrieved:** 2026-07-17
- **Local filename:** `south-carolina-cancer-specified-disease/three-plan-levels-enrollment-brochure.pdf`
- **File metadata:** PDF 1.7; 216,510 bytes; 6 pages; US Letter
- **SHA-256:** `839fa4554135a01e20e01472d5580fad3dcd1660adad009591a2273cebf2ee5c`
- **Potential `BenefitsPackage` fields:** carrier/underwriter/marketing name; product type; jurisdiction; employee population; language; plan levels; employee/spouse/child/family tiers; monthly premiums; initial diagnosis; hospital confinement; government/charity hospital; private duty nursing; extended care; hospice; home nursing; radiation/chemotherapy; blood/plasma/platelets; hematologic drugs; imaging; surgery; anesthesia; transplant; outpatient surgery; second opinion; transportation; lodging; physical/speech therapy; experimental treatment; prostheses; anti-nausea medication; wellness; ICU; covered specified diseases; waiver of premium; eligibility ages; portability; limitations and exclusions
- **Verification:** The file signature is PDF, `pdfinfo` parses six pages, and text extraction confirms Spanish-language South Carolina cancer coverage, 29 specified diseases, three benefit plans, tiered premiums, benefit definitions, and underwriter/marketing-name disclosures. Page 1 was rendered and visually inspected; branding, Spanish headings, imagery, explanatory panels, and footnotes are clear and properly positioned.
- **Known limitations:** The hosting domain retains an Allstate-era name while the current document identifies The Standard as the marketing name and American Heritage Life Insurance Company as underwriter; downstream normalization should preserve all three provenance signals instead of assuming the carrier from the URL. It is a specific public-program design, not a universal plan. The first-page visual content and the extracted document are in Spanish.

## 5. Trustmark Universal Life and Universal LifeEvents Product Overview

- **Organization:** Trustmark Insurance Company / Trustmark Voluntary Benefit Solutions
- **Jurisdiction / market:** United States workplace voluntary-benefits market; national product overview with state variations
- **Plan / program design:** Two permanent life products (Universal Life and Universal LifeEvents) with long-term-care and terminal-illness living benefits, optional restoration/extension designs, simplified underwriting, cash value, and age-based benefit differences
- **Document subtype:** Employer/broker product comparison overview
- **Why it is distinct:** This is a hybrid permanent-life and long-term-care voluntary product rather than supplemental medical cash coverage. It introduces age-based death/living-benefit changes, rider combinations, underwriting options, and product-design comparisons.
- **Source webpage:** https://trustmarkbenefits.com/voluntary-benefits/products/universal-life
- **Direct file:** https://trustmarkbenefits.com/Trustmark-Benefits-Web/media/Files/VB/A112-129_PCUL.pdf
- **Retrieved:** 2026-07-17
- **Local filename:** `trustmark-universal-life-ltc/universal-life-and-lifeevents-options.pdf`
- **File metadata:** PDF 1.4; 863,067 bytes; 3 pages; US Letter
- **SHA-256:** `bc86a0abaec78c217daad11b58bb49e956059cc52b449ab763b32b9f7d2d4e02`
- **Potential `BenefitsPackage` fields:** carrier; product type/subtype; product names; permanent-life status; death benefit; living benefit; long-term-care acceleration; terminal-illness benefit; death-benefit restoration; extension of long-term-care benefits; rider combinations; age-based benefit reductions; premium/cash-value flexibility; EZ Value increases; underwriting method; issue ages; smoker/gender assumptions; illustrative premium and face amounts; employee portability/ownership; exclusions/disclosures; policy/rider form identifiers; state variations
- **Verification:** The file signature is PDF, `pdfinfo` parses three pages, and extracted text confirms both Universal Life designs, long-term-care living benefits, age-70 comparison, underwriting options, riders, and product disclosures. Page 1 was rendered and visually inspected; the product comparison, age/benefit table, headings, icons, and Trustmark branding are crisp and fully legible.
- **Known limitations:** This is a product-design overview, not an employee certificate or employer-specific rate sheet. Dollar figures are illustrative and not guarantees. Long-term-care rider treatment and policy forms vary by state, and some features require separate elected riders.

## Verification artifacts

The hidden `.verification/` directory contains one `pdfinfo` report, a text-extraction sample, and a rendered first-page PNG for each source PDF. Those files document the checks described above and are not additional source examples.
