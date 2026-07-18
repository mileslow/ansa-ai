# Vision plan document examples

Five public, real vision-benefit documents selected to exercise materially different extraction paths. The set spans a nationwide federal PPO, New York and California public-employer plan books, a Washington public-employer group certificate, and an individual/family plan comparison. These files are source examples, not plan recommendations or current eligibility determinations.

Retrieval date for every file: **2026-07-17**.

## 1. The MetLife Federal Vision Plan (2026)

- **Organization:** Metropolitan Life Insurance Company (MetLife); authorized for distribution by the U.S. Office of Personnel Management (OPM)
- **Jurisdiction / market:** United States nationwide and overseas; Federal Employees Dental and Vision Insurance Program (FEDVIP) for eligible federal employees, annuitants, and certain TRICARE-eligible people
- **Plan design:** Nationwide vision PPO with in-network, out-of-network, limited-access-area, and international benefits
- **Document subtype:** Official annual FEDVIP plan brochure and statement of benefits; High and Standard options with Self Only, Self Plus One, and Self and Family enrollment tiers
- **Why distinct:** Tests a long federal brochure containing two benefit options, nationwide and overseas access, federal eligibility and enrollment rules, benefit tables, summaries, and premiums in one authoritative document.
- **Source page URL:** <https://www.opm.gov/healthcare-insurance/dental-vision/plan-information/plans/vision>
- **Direct file URL:** <https://www.opm.gov/healthcare-insurance/healthcare/plan-information/plans/pdf/2026/brochures/02AP-12.pdf>
- **Local filename:** `01_metlife_2026_fedvip_nationwide_ppo_vision_brochure.pdf`
- **File facts:** PDF 1.7; 1,441,710 bytes (1.38 MiB); 40 pages; US Letter; not encrypted
- **Fields supported:** carrier and plan identity, plan year, PPO design, service geography, High/Standard option, enrollment tier, eligibility, enrollment/change rules, effective date, provider/network rules, out-of-network and limited-access allowances, exam coverage, frame and contact-lens allowances, lens types and enhancements, benefit frequencies, international benefits, exclusions, claims and disputes, definitions, option comparison, and premiums.
- **Verification:** The source returned HTTP 200 with `application/pdf`; `file` identified a PDF rather than HTML; `pdfinfo` opened it and reported 40 unencrypted pages; extracted text identified the title, 2026 plan year, nationwide PPO design, OPM authorization, and all six option/tier combinations. Page 1 was rendered with Poppler and visually inspected as complete, legible, and free of clipping or missing-font artifacts. SHA-256: `3f093fefc31e08f293dad978afe90e49b79c4c29149961c7e8652b36c1353341`.
- **Known limitations:** This is a federal FEDVIP source, not an employer-specific group certificate. It supplies negotiated FEDVIP premiums but not an employer contribution or payroll-deduction schedule. It also explicitly separates FEDVIP vision coverage from FEHB and PSHB medical coverage.

## 2. New York State Participating Employer Vision Plan (2024)

- **Organization:** New York State Department of Civil Service / New York State Health Insurance Program (NYSHIP); administered by Davis Vision, Inc.
- **Jurisdiction / market:** New York public-employer group coverage for participating-employer employees, enrolled dependents, and eligible COBRA enrollees
- **Plan design:** Standard allowance-based vision plan with participating and non-participating provider benefits, individual/family coverage, Davis Vision collection options, and medical-exception and occupational benefits
- **Document subtype:** Public-employer vision plan book with benefit summary, eligibility, claims, COBRA, glossary, contacts, and forms
- **Why distinct:** Tests a New York public-employer booklet whose benefit frequency branches by age: covered people age 19 and older generally receive benefits every 24 months, while dependents under 19 receive benefits every 12 months. It also contains an occupational-eyewear benefit and a medical-exception pathway absent from the other examples.
- **Source page URL:** <https://www.cs.ny.gov/employee-benefits/group/2/13/2/other-benefits.cfm>
- **Direct file URL:** <https://www.cs.ny.gov/employee-benefits/nyship/shared/publications/vision/2024/pe-vision-2024.pdf>
- **Local filename:** `02_nyship_2024_pe_davis_vision_plan_book.pdf`
- **File facts:** PDF 1.6; 828,023 bytes (808.62 KiB); 17 pages; US Letter; not encrypted
- **Fields supported:** employer-program and administrator identity, jurisdiction, plan edition, eligible classes and dependents, waiting-period source, individual/family coverage, in/out-of-network procedures, exam and materials frequencies, frame and contact-lens allowances, Davis Vision collection levels, standard lens coverage and upgrades, copayments, reimbursements, pediatric frequency, occupational eyewear, medical-exception conditions, cataract coordination, exclusions, continuation/COBRA, contact information, and embedded claim/authorization forms.
- **Verification:** The source returned HTTP 200 with `application/pdf`; `file` identified a PDF; `pdfinfo` opened it and reported 17 unencrypted pages; extracted text identified the New York State Participating Employer plan, Davis Vision administration, January 2024 edition, individual/family coverage, and benefit summary. Page 1 was rendered with Poppler and visually inspected as complete and legible. SHA-256: `d14958763bdcbf5a7c205baa5360c56fc069892da76901ec3aa3bdc75a999edb`.
- **Known limitations:** The cover identifies this as the January 2024 edition even though the embedded PDF creation/modification metadata is from November 2025; the publisher's edition label is retained as authoritative. Waiting periods can vary by participating employer and must be obtained from the employer's benefits administrator. The plan book includes benefit information and forms but is not a carrier-issued individual policy.

## 3. California State VSP Evidence of Coverage (2026)

- **Organization:** California Department of Human Resources (CalHR); plan administered by Vision Service Plan (VSP)
- **Jurisdiction / market:** California state-sponsored employee and dependent group coverage
- **Plan design:** Basic employer-paid vision plan plus an employee-elected Premier upgrade; network benefits, frame allowances, copayments, out-of-network reimbursement, and continuation coverage
- **Document subtype:** Combined disclosure statement and evidence of coverage for Basic Plan 30052011 and Premier Plan 30034581
- **Why distinct:** Exercises two related employer-group designs in one EOC. It distinguishes the state-paid Basic plan from the upgraded Premier plan, including different material copays, frame allowances, lens options, second-pair provisions, and plan/service frequencies.
- **Source page URL:** <https://benefits.calhr.ca.gov/open-enrollment/virtual-library/vision-bookshelf/>
- **Direct file URL:** <https://benefits.calhr.ca.gov/wp-content/uploads/sites/362/2025/12/2026-VSP-Evidence-of-Coverage.pdf>
- **Local filename:** `03_calhr_2026_vsp_basic_premier_vision_eoc.pdf`
- **File facts:** PDF 1.7; 316,115 bytes (308.71 KiB); 22 pages; 261.12 x 612 points; not encrypted
- **Fields supported:** employer-program and administrator identity, plan numbers, effective date, Basic/Premier option, employer-paid and employee-upgrade status, eligibility and enrollment, exam/material copays, service frequencies, frame allowance, lens and enhancement coverage, contact lenses, low-vision services, network/provider process, reimbursements, exclusions, claims and appeals, COBRA/continuation, summary comparison, contacts, and nondiscrimination/language assistance.
- **Verification:** The source returned HTTP 200 with `application/pdf`; `file` identified a PDF; `pdfinfo` opened it and reported 22 unencrypted pages; extracted text identified the 2026 VSP EOC, both plan numbers, employer payment structure, copay differences, and separate Basic/Premier frequencies. Page 1 was rendered with Poppler and visually inspected; the narrow portrait cover, CalHR identity, title, and year are complete and legible. SHA-256: `f7c8f32464db0786d23a1b82910927c51413cb4e6a34839f20cf7d355baeed36`.
- **Known limitations:** This EOC is specific to California state-sponsored groups and includes bargaining-unit and employee-class exceptions that should not be generalized. Its unusual narrow page geometry is part of the original publisher file. A Poppler text-extraction warning reports one mismatched marked-content operator, but the file opens, renders, and extracts readable text correctly.

## 4. Washington PEBB EyeMed Group Vision Certificate (2026)

- **Organization:** Washington State Health Care Authority, Public Employees Benefits Board (PEBB) Program; underwritten by Fidelity Security Life Insurance Company and administered/marketed through EyeMed
- **Jurisdiction / market:** Washington public employees, participating employer groups, retirees, survivors, continuation enrollees, and eligible dependents; national PPO provider access
- **Plan design:** Fully insured group vision PPO with adult and pediatric schedules of benefits, allowances, copayments, in-network coverage, and out-of-network reimbursements
- **Document subtype:** Group vision insurance certificate with policy terms, eligibility/enrollment rules, benefit schedules, limitations, claims, and legal provisions
- **Why distinct:** Tests a formal carrier certificate rather than an enrollment brochure. It combines Washington PEBB-specific eligibility and appeals language with national PPO definitions and separate adult versus under-age-19 benefit schedules.
- **Source page URL:** <https://www.hca.wa.gov/pebb-benefits-admins/pebb-benefits/vision>
- **Direct file URL:** <https://content.eyemedvisioncare.com/contentPROD/mw/assets/wahca/PEBB_Program_Cert_2026.pdf>
- **Local filename:** `04_washington_pebb_2026_eyemed_group_vision_certificate.pdf`
- **File facts:** PDF 1.7; 742,558 bytes (725.15 KiB); 38 pages; US Letter; not encrypted
- **Fields supported:** insurer, administrator and policyholder identity, policy number, renewal/effective dates, group plan type, Washington and national service area, definitions, employee/retiree/survivor/continuation eligibility, dependent definitions, enrollment events and deadlines, Medicare interaction, PPO network rules, adult and pediatric benefit schedules, exam/material copayments, frame and contact-lens allowances, lens enhancements, frequencies, medically necessary contacts, exclusions, termination, premiums, claims, appeals, and general legal provisions.
- **Verification:** The source returned HTTP 200 with `application/pdf`; `file` identified a PDF; `pdfinfo` opened it and reported 38 unencrypted pages; extracted text identified Fidelity Security Life, Washington HCA/PEBB, policy VC-19, the 2026 renewal date, and the group vision certificate and schedules. Page 1 was rendered with Poppler and visually inspected as complete, legible, and free of obvious rendering defects. SHA-256: `51e0eba4edb98f419da624dad417bdbbb2112063765efa3488f0075b38a143da`.
- **Known limitations:** The certificate is specific to Washington PEBB/SEBB administration and includes extensive public-program eligibility rules that are not portable to ordinary employer groups. It states that Medicare-enrolled PEBB retirees generally receive vision through their Medicare medical plan, so this certificate must not be treated as their Medicare vision benefit document.

## 5. EyeMed Individual and Family Vision Plan Comparison

- **Organization:** Fidelity Security Life Insurance Company; administered by First American Administrators and InsuranceTPA.com; marketed and serviced by EyeMed
- **Jurisdiction / market:** Individual and family direct-purchase market in most states
- **Plan design:** Three allowance/cost-share levels - Bright, Bold, and Healthy - using the EyeMed Advantage network and out-of-network reimbursements where applicable
- **Document subtype:** One-page summary-of-benefits comparison
- **Why distinct:** Adds a non-employer individual/family input and places three plan designs side by side. It includes a richer insured option, a mid-level insured option, and a discount-oriented option, plus adult-versus-under-19 polycarbonate lens treatment.
- **Source page URL:** <https://www.eyemed.com/en-us/member/individual/>
- **Direct file URL:** <https://media.eyemed.com/cms/caas/v1/media/280264/data/845395f07b8e4f9828e83582bbdbb36e/broker-individual-plan-comparison-overview.pdf>
- **Local filename:** `05_eyemed_individual_family_bright_bold_healthy_summary.pdf`
- **File facts:** PDF 1.6; 124,768 bytes (121.84 KiB); 1 page; US Letter; not encrypted
- **Fields supported:** plan/administrator identity, individual/family market, Bright/Bold/Healthy option, network name, exam copay, frame allowance, standard and progressive lens costs, lens enhancements, adult and under-age-19 polycarbonate treatment, contact-lens fitting and material allowances, medically necessary contacts, out-of-network reimbursements, benefit frequencies, discounts, exclusions, termination summary, and policy/form identifiers.
- **Verification:** The source returned HTTP 200 with `application/pdf`; `file` identified a PDF; `pdfinfo` opened it and reported one unencrypted page; extracted text identified all three plan names, EyeMed Advantage network, benefit rows, underwriting/administration, limitations, and policy form. The full page was rendered with Poppler and visually inspected; all comparison columns, benefit rows, and footnotes are visible and legible at full resolution. SHA-256: `9ff6947cab4b14e148b4845f0f21d01933aa04ed4ec09c2b42f3e1f9c8bf3d7f`.
- **Known limitations:** This is a summary, not the full policy or a state-specific contract. The footer labels it for most states and uses older policy-form/production dates, while the official EyeMed individual page currently links to it; state availability, rates, exclusions, and controlling policy terms require the applicable quote and policy. Its under-age-19 lens row does not by itself establish Affordable Care Act pediatric essential-health-benefit status.

## Coverage matrix

| Example | Market | Design | Document form | Extraction edge represented |
| --- | --- | --- | --- | --- |
| MetLife FEDVIP | Federal nationwide/international | PPO; High and Standard | Official annual brochure | Federal eligibility, multiple tiers/options, international care, premiums |
| NYSHIP / Davis Vision | New York public employer | Allowance-based standard plan | Public-employer plan book | Age-based frequencies, occupational and medical-exception benefits, embedded forms |
| CalHR / VSP | California public employer | Basic plus Premier upgrade | Evidence of coverage | Employer-paid base versus employee-paid upgrade and class exceptions |
| Washington PEBB / EyeMed | Washington public employer | Group PPO | Insurance certificate | Formal policy terms and separate adult/pediatric schedules |
| EyeMed Individual | Most-states individual/family | Bright, Bold, and Healthy allowances | One-page summary | Direct-purchase market and side-by-side multi-plan comparison |

## Verification method

Every direct URL was retrieved on 2026-07-17 and returned HTTP 200 with an `application/pdf` content type. Each saved file was identified as a PDF by `file`, opened by `pdfinfo`, sampled with `pdftotext`, and rendered on page 1 with `pdftoppm`. All five page-one renders were visually inspected and showed authentic plan identity, readable content, and no HTML/error-page substitution, corruption, clipping, overlap, or missing-font blocks. SHA-256 checksums above identify the exact downloaded originals.
