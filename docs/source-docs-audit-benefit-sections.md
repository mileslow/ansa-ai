# Source-docs audit: official benefit documents

Date: 2026-07-17

## Scope and method

This audit covers all **60 primary PDFs** in the 12 populated leaves under `source-docs/03_official-plan-documents`. It excludes `README.md`, hidden QA files, `_verification`, and render artifacts. Each category README and each source PDF were checked with `pdfinfo` and `pdftotext`. The two-page Tulane/Lucet EAP PDF has a broken embedded character map, so both pages were rendered and visually inspected; it is a genuine, legible EAP brochure and should be OCR-routed.

Two independent questions are recorded below:

- **Benefit fit:** does the file actually concern the benefit section named by the leaf?
- **`03` role fit:** is it honestly an official/authoritative plan-coverage document, rather than a form, notice, general guide, FAQ, formulary, or sales sheet?

This distinction matters. A form can be an excellent life-insurance classifier fixture while still not being a fifth life **plan** example.

## Executive conclusion

The only unequivocal wrong benefit grouping is the CVS Caremark formulary: it is prescription/pharmacy support, not a medical-insurance plan. The medical set therefore contains **four**, not five, medical plans.

The larger problem is source-role mixing. The directory contains many useful, correctly benefit-related documents that are not official plan documents: EOI and contribution forms, regulatory notices, tax publications, FAQs, enrollment guides, vendor flyers, and program brochures. They should be retained as test fixtures but tagged and counted by their real source role. EAP and telemedicine especially are often non-insurance programs, so forcing them into a “governing plan contract” model would be conceptually wrong.

Recommended canonical destinations used below:

- Governing or authoritative coverage sources: `03_official-plan-documents/<benefit>/`
- Employee/program guides: `07_shared-supporting-materials/benefit-program-guides/<benefit>/`
- Generic vendor/product material: `07_shared-supporting-materials/vendor-product-materials/<benefit>/`
- Tax/regulatory guidance: `07_shared-supporting-materials/regulatory-and-tax-guidance/<benefit>/`
- Standalone required notices: `07_shared-supporting-materials/standalone-legal-notices/<benefit>/`
- Enrollment, payroll, and underwriting forms: `05_census-and-enrollment/enrollment-and-underwriting-forms/<benefit>/`
- Prescription support: `07_shared-supporting-materials/prescription-and-pharmacy/<subtype>/`
- Cross-benefit governing disability documents: `03_official-plan-documents/combined-disability/`

A machine-readable manifest can express these destinations without physically duplicating files. Cross-benefit files should have multiple `benefitSections` values and one `primaryBenefitSection`.

## Per-file audit

### Dental

All five are honestly dental coverage documents. No required re-bucketing.

| File | Exact subtype | Benefit section(s) | Source role | Benefit fit | `03` role fit | Recommended action |
|---|---|---|---|---|---|---|
| `metlife-fedvip-2026/high-and-standard-options/official-plan-brochure.pdf` | 2026 FEDVIP annual PPO brochure and official statement of benefits | Dental | Authoritative federal plan brochure with options, rates, and coverage terms | Yes | Yes | Keep in `dental` |
| `dominion-national-fedvip-2026/high-and-standard-options/official-plan-brochure.pdf` | 2026 FEDVIP regional copay-EPO brochure and official statement of benefits | Dental | Authoritative federal plan brochure | Yes | Yes | Keep in `dental` |
| `nyship-nys-dental-plan-2024/standard-plan/certificate-of-insurance.pdf` | Group dental certificate of insurance | Dental | Employer-group certificate/coverage contract summary | Yes | Yes | Keep in `dental` |
| `calhr-western-dental-2026/standard-dhmo/evidence-of-coverage.pdf` | DHMO evidence of coverage and disclosure form | Dental | Official EOC, but procedure copays are in a separate Schedule of Benefits | Yes | Yes, incomplete alone | Keep; add the matching Schedule of Benefits as a companion file in the same example bundle |
| `delta-dental-nj-family-ehb/basic-family-ppo-plan-i/policy.pdf` | Individual/family dental insurance policy with separate adult and pediatric schedules | Dental; pediatric EHB | Governing individual policy | Yes | Yes | Keep in `dental` |

### Employee Assistance Program

All five honestly fit EAP, but none is an insurance contract or governing plan document. That is normal for EAPs. Keep the five as EAP input examples, but do not score them as five plan contracts.

| File | Exact subtype | Benefit section(s) | Source role | Benefit fit | `03` role fit | Recommended action |
|---|---|---|---|---|---|---|
| `nih-federal-inhouse-eap/program-brochure.pdf` | Long-form internal federal EAP program brochure | EAP | Sponsor-authored employee program guide | Yes | No contract | Move/tag as `benefit-program-guides/eap` |
| `washington-state-public-employee-eap/program-brochure.pdf` | Employee onboarding tri-fold program brochure | EAP | Public-employer employee guide | Yes | No contract | Move/tag as `benefit-program-guides/eap` |
| `tulane-university-lucet-eap/program-brochure.pdf` | Employer-customized two-page vendor EAP brochure | EAP | Employee access/benefit guide; OCR required | Yes | No contract | Move/tag as `benefit-program-guides/eap`; set `requiresOcr: true` |
| `guardian-uprise-health-eap/employee-overview.pdf` | Employer/group-customized EAP overview flyer | EAP | Illustrative employee communication; explicitly not a contract or insurance benefit | Yes | No | Move/tag as `benefit-program-guides/eap` |
| `optum-eap/employer-manager-overview.pdf` | Employer/manager-facing EAP product infographic and sales fact sheet | EAP | Generic vendor product material | Yes | No | Move/tag as `vendor-product-materials/eap` |

### FSA and dependent care

The five files are useful FSA/DCAP inputs, but only the Washington Salary Reduction Plan is a governing plan document. IRS Publication 503 is specifically tax guidance for dependent-care expenses and the tax credit; it must not be classified as a health FSA plan.

| File | Exact subtype | Benefit section(s) | Source role | Benefit fit | `03` role fit | Recommended action |
|---|---|---|---|---|---|---|
| `calhr-medical-reimbursement-account/2026-health-care-fsa-flyer.pdf` | Employee education flyer for a salary-reduction Medical Reimbursement Account | Health FSA | Employee FSA guide | Yes. Despite “MRA,” employee pretax payroll funding makes this an FSA, not an HRA | No | Move/tag as `benefit-program-guides/fsa` |
| `irs-dependent-care-tax-guidance/2025-publication-503.pdf` | IRS Publication 503, child/dependent-care tax guidance | DCAP/dependent-care FSA; tax credit | Federal tax publication | Partial: DCAP-related, not health FSA | No | Move/tag as `regulatory-and-tax-guidance/dependent-care`; never use as evidence that an employer offers DCAP |
| `washington-sebb-fsa-program/2025-plan-general-limited-purpose-dependent-care.pdf` | Governing cafeteria/salary-reduction plan restatement | Health FSA; LPFSA; DCAP; HSA; premium payment | Governing multi-account plan document | Yes, multi-benefit | Yes | Keep, but assign all five section labels |
| `wex-fsa-program/employee-guide-medical-combination-dependent-care.pdf` | Generic administrator employee/member and claims guide | Health FSA; combination/limited FSA; DCAP | Operational education and claims guide | Yes | No | Move/tag as `benefit-program-guides/fsa` |
| `nyc-fsa-program/2026-enrollment-change-form-health-care-dependent-care.pdf` | Blank fillable enrollment/midyear-change form with notices | HCFSA; DCAP; enrollment/payroll | Transactional enrollment form | Yes | No | Move/tag as `enrollment-and-underwriting-forms/fsa`; mark blank/template and sensitive-field risk |

### HRA

All five are HRA-related. Two are actual employer plan documents; the others are guidance, a model notice, and a general FAQ.

| File | Exact subtype | Benefit section(s) | Source role | Benefit fit | `03` role fit | Recommended action |
|---|---|---|---|---|---|---|
| `city-of-cincinnati-integrated-hra/active-plan-spd.pdf` | Integrated HRA governing plan document and SPD | HRA; medical opt-out/other group coverage | Employer governing plan/SPD | Yes | Yes | Keep in `hra` |
| `jpmorgan-chase-medicare-retiree-hra/plan-spd.pdf` | Retiree HRA plan document and SPD | Retiree HRA; Medicare; medical/Rx/dental/vision reimbursement | Employer governing plan/SPD | Yes | Yes | Keep in `hra` |
| `irs-qsehra-guidance/notice-2017-67.pdf` | IRS Notice 2017-67 | QSEHRA | Federal tax/administrative guidance | Yes | No | Move/tag as `regulatory-and-tax-guidance/hra` |
| `cms-ichra-guidance/model-notice.pdf` | Uncompleted federal ICHRA model participant notice | ICHRA; individual medical coverage/Marketplace | Regulatory notice template | Yes | No | Move/tag as `standalone-legal-notices/hra`; mark template/blank, not employer evidence |
| `optum-hra-administration/faq.pdf` | General participant FAQ and reimbursement guide | HRA | Vendor educational/administration guide | Yes | No | Move/tag as `benefit-program-guides/hra` |

### HSA

All five are genuinely HSA-related, but an HSA is an individually owned custodial account, not an insurance plan. The current root taxonomy is the mismatch. The set should be evaluated as varied HSA **source roles**, not five HSA plan contracts.

| File | Exact subtype | Benefit section(s) | Source role | Benefit fit | `03` role fit | Recommended action |
|---|---|---|---|---|---|---|
| `irs-hsa-tax-guidance/2025-publication-969.pdf` | IRS Publication 969 | HSA; HDHP; FSA; HRA; Archer/Medicare Advantage MSA | Federal tax guidance | Yes, primarily HSA | No | Move/tag as `regulatory-and-tax-guidance/hsa`; multi-label the other accounts |
| `cms-marketplace-hsa-guide/2026-consumer-guide.pdf` | CMS HSA consumer fact sheet | HSA; HSA-eligible medical/HDHP; Marketplace | Consumer education | Yes | No | Move/tag as `benefit-program-guides/hsa` |
| `wisconsin-etf-hdhp-hsa/2026-decision-guide.pdf` | Annual employer benefits decision/open-enrollment guide | Medical; HSA; FSA/LPFSA; dental; vision; enrollment | Current cross-benefit employer guide | Yes, but not HSA-only | No | Move/tag as `benefit-program-guides/cross-benefit`; multi-label all sections |
| `minnesota-segip-hsa/2026-contribution-change-form.pdf` | Blank HSA payroll contribution-change authorization with privacy notice | HSA; payroll/enrollment | Transactional form | Yes | No | Move/tag as `enrollment-and-underwriting-forms/hsa`; mark blank/template and sensitive fields |
| `optum-bank-hsa/enrollment-contribution-agreement.pdf` | Blank employer-to-custodian enrollment and contribution services agreement | HSA; vendor administration | Employer-bank operational contract; not the participant custodial agreement | Yes | No employee plan | Move/tag as `vendor-product-materials/hsa-administration` or a dedicated `vendor-agreements/hsa` role |

### Life and AD&D

Four files are authoritative life/AD&D coverage sources. The Oregon file is a blank medical-underwriting form, not a fifth plan.

| File | Exact subtype | Benefit section(s) | Source role | Benefit fit | `03` role fit | Recommended action |
|---|---|---|---|---|---|---|
| `fegli/handbook-basic-option-a-b-c.pdf` | Detailed federal group life program handbook | Basic/optional/dependent life; AD&D; retiree life | Authoritative government program handbook | Yes | Yes, with historical-date caveat | Keep in `life-and-add`; authority=`program_handbook` |
| `minnesota-group-term-life/certificate.pdf` | Full group term-life certificate with specifications and supplements | Basic/additional/dependent life; AD&D | Group insurance certificate | Yes | Yes | Keep |
| `seattle-voluntary-add/certificate.pdf` | Standalone group AD&D certificate | Voluntary employee/dependent AD&D | Group insurance certificate | Yes | Yes | Keep |
| `fcps-life-add/certificate.pdf` | Group term-life, AD&D, and dependent-life certificate | Basic/optional/dependent life; AD&D | Group insurance certificate | Yes | Yes | Keep |
| `oregon-optional-life/evidence-of-insurability-form.pdf` | Blank optional-life Evidence of Insurability/medical-history application | Optional employee/spouse life; underwriting/enrollment | Underwriting form | Yes | No | Move/tag as `enrollment-and-underwriting-forms/life-and-add`; mark blank/template, PII/health-data risk |

### Long-term disability

Two are standalone governing LTD documents. The Duke file is a valid combined STD/LTD certificate, while the CalHR guide and Alabama FAQ are supporting communications.

| File | Exact subtype | Benefit section(s) | Source role | Benefit fit | `03` role fit | Recommended action |
|---|---|---|---|---|---|---|
| `university-of-michigan-basic-ltd/2025-plan-booklet.pdf` | Employer plan booklet for a self-insured Basic LTD plan | LTD; continuation of related benefits | Authoritative employer plan booklet | Yes | Yes | Keep in `long-term-disability` |
| `combined-disability/duke-health-system-voluntary-std-ltd/combined-certificate-2017.pdf` | Combined STD and LTD group certificate/booklet with schedule | STD; LTD | Governing carrier certificate, cross-benefit | Partial as an LTD-only leaf | Yes as plan document | Move/tag primary destination `combined-disability`; feed both STD and LTD tests |
| `indiana-university-resident-med-plus-ltd/2026-certificate-spd.pdf` | LTD certificate and SPD under an AMA group trust | LTD | Governing certificate/SPD | Yes | Yes | Keep |
| `california-voluntary-ltd/2026-benefits-guide.pdf` | Employee enrollment, cost, and benefits guide | LTD; accident; critical illness | Current cross-benefit employee guide, not certificate | Partial as LTD-only | No | Move/tag as `benefit-program-guides/voluntary-cross-benefit`; multi-label three products |
| `university-of-alabama-standard-ltd/2026-claim-faq.pdf` | Carrier claim FAQ and filing guide | LTD; claims/support | Operational claims guide | Yes as LTD support | No | Move/tag as `benefit-program-guides/long-term-disability/claims` |

### Medical insurance and prescription

The first four are true health-insurance plan documents. The CVS file is not; it is a supporting formulary and must not count as a medical plan.

| File | Exact subtype | Benefit section(s) | Source role | Benefit fit | `03` role fit | Recommended action |
|---|---|---|---|---|---|---|
| `kaiser-permanente-ca-small-group-2025-hmo/bronze-60-hdhp-hmo-6650-0-pcp.pdf` | SBC for Bronze 60 HDHP deductible HMO with child dental | Medical; HSA-eligible/HDHP; pediatric dental; prescription | Official standardized medical plan summary | Yes, medical-primary | Yes | Keep under renamed `medical-insurance` leaf; multi-label HSA/dental/Rx features |
| `healthfirst-ny-essential-plan-2026/essential-plan-1.pdf` | SBC for New York Essential Plan 1 HMO | Medical; prescription; telemedicine; adult dental/vision references | Official standardized medical plan summary | Yes | Yes | Keep under `medical-insurance` |
| `fcps-2026-medicare-retiree-medical/kaiser-permanente-medicare-advantage-group-hmo-eoc.pdf` | Group Medicare Advantage HMO Evidence of Coverage with Part D | Medical; Medicare Advantage; prescription drug | Governing EOC | Yes | Yes | Keep under `medical-insurance`; multi-label Medicare/Rx |
| `bcbs-fep-service-benefit-plan-2026/fep-blue-standard-and-basic-options-brochure.pdf` | FEHB fee-for-service/PPO official plan brochure | Medical; prescription; Medicare coordination | Authoritative federal plan brochure/contract summary | Yes | Yes | Keep under `medical-insurance` |
| `cvs-caremark-performance-drug-list/july-2026-formulary.pdf` | Performance Drug List / formulary | Prescription and pharmacy only | PBM formulary support; explicitly not a coverage guarantee | **No: not medical insurance** | No | **Required:** move/tag as `prescription-and-pharmacy/cvs-caremark-performance-drug-list`; replace it with a real fifth medical plan document |

The replacement should be a **current, employer-specific commercial group medical SBC, EOC, SPD, or plan document**. To add a genuinely missing dimension, prefer a conventional private-employer, non-HSA PPO or POS plan (insured or self-funded) with group-specific eligibility and coverage terms, rather than another public program or a pharmacy-only artifact.

### Short-term disability

Three files are authoritative STD program/certificate documents. The New York file is a statutory notice and the UC/Lincoln file is a concise summary.

| File | Exact subtype | Benefit section(s) | Source role | Benefit fit | `03` role fit | Recommended action |
|---|---|---|---|---|---|---|
| `yale-salary-continuation/employer-administered-plan.pdf` | Employer salary-continuation program document; explicitly non-ERISA | STD/salary continuation | Authoritative employer program document | Yes | Yes | Keep |
| `ut-system-voluntary-std/dearborn-certificate.pdf` | Group voluntary STD insurance certificate/booklet | STD | Governing carrier certificate | Yes | Yes | Keep |
| `new-york-statutory-disability/statement-of-rights.pdf` | One-page statutory disability rights notice and claim guide | State disability/STD; NY Paid Family Leave interaction | Required government notice | Yes as section support | No | Move/tag as `standalone-legal-notices/short-term-disability` |
| `university-of-hartford-group-std/reliance-standard-certificate.pdf` | Group weekly-income/STD certificate | STD | Governing carrier certificate, historical | Yes | Yes | Keep; mark historical/current-authority low |
| `university-of-california-basic-disability/lincoln-summary.pdf` | Two-page carrier benefit summary | Basic STD; state disability/PFL and other-income offsets | Employee plan summary, explicitly nonbinding | Yes | No controlling role | Move/tag as `benefit-program-guides/short-term-disability` |

### Telemedicine and virtual care

All five honestly fit virtual care, and all five are support/activation materials rather than insurance contracts. This is appropriate for testing telemedicine section generation; the directory role should reflect it.

| File | Exact subtype | Benefit section(s) | Source role | Benefit fit | `03` role fit | Recommended action |
|---|---|---|---|---|---|---|
| `sisc-eden-virtual-primary-care/taft-college-flyer.pdf` | One-page member enrollment/benefit flyer | Virtual primary care; mental-health support; medical-plan eligibility | Employer/member activation guide | Yes | No | Move/tag as `benefit-program-guides/telemedicine` |
| `sisc-mdlive-medical-behavioral/resig-10-copay-flyer.pdf` | One-page member benefit/activation flyer | General telemedicine; behavioral health | Employer/member flyer | Yes | No | Move/tag as `benefit-program-guides/telemedicine` |
| `guidestone-teladoc/member-faq.pdf` | Two-page member FAQ | General telemedicine | Operational member FAQ | Yes | No | Move/tag as `benefit-program-guides/telemedicine` |
| `city-of-mesa-cigna-mdlive-dermatology/member-flyer.pdf` | Two-page specialty virtual-care flyer | Teledermatology; medical | Employer/member specialty guide | Yes | No | Move/tag as `benefit-program-guides/telemedicine` |
| `wittenberg-livehealth-psychology/member-guide-faq.pdf` | Two-page setup guide and FAQ | Virtual behavioral health/therapy | Employer/member service guide | Yes | No | Move/tag as `benefit-program-guides/telemedicine`; multi-label behavioral health |

### Vision

All five honestly fit vision. Four are official program/certificate/EOC-style sources; the EyeMed comparison is a non-controlling product summary.

| File | Exact subtype | Benefit section(s) | Source role | Benefit fit | `03` role fit | Recommended action |
|---|---|---|---|---|---|---|
| `metlife-fedvip-2026/high-and-standard-options/official-plan-brochure.pdf` | FEDVIP annual PPO brochure and official statement of benefits | Vision | Authoritative federal plan brochure | Yes | Yes | Keep |
| `nyship-pe-davis-vision-2024/standard-plan/plan-book.pdf` | Public-employer vision plan book with summary, eligibility, COBRA, claims, and forms | Vision | Official employer-program plan guide | Yes | Yes as authoritative summary | Keep; authority=`plan_guide`, not carrier policy |
| `calhr-vsp-2026/basic-and-premier-options/evidence-of-coverage.pdf` | Combined disclosure statement/EOC for Basic and Premier plans | Vision | Official EOC-style summary; document says contract terms control | Yes | Yes as plan summary | Keep; authority=`eoc_summary` |
| `washington-pebb-2026/eyemed/certificate-of-coverage.pdf` | Group vision insurance certificate | Vision | Governing carrier certificate | Yes | Yes | Keep |
| `eyemed-individual-family/bright-bold-healthy-options/summary-of-benefits.pdf` | One-page individual/family plan comparison | Vision | Non-controlling product summary | Yes | Supporting only | Move/tag as `benefit-program-guides/vision` if `03` is kept strict; otherwise retain with `authority=summary` |

### Voluntary and Aflac-style benefits

All five fit the broad voluntary-benefits section, but they are five different products and mostly supporting sales/enrollment material, not five governing policies. The Trustmark file must also be multi-labeled life and long-term care.

| File | Exact subtype | Benefit section(s) | Source role | Benefit fit | `03` role fit | Recommended action |
|---|---|---|---|---|---|---|
| `aflac-california-accident/outline-of-coverage.pdf` | California regulatory accident outline of coverage | Voluntary accident; AD&D-related scheduled benefits | Policy-adjacent regulatory coverage outline, not controlling policy | Yes | Conditional | Keep/tag as `authority=outline_of_coverage`; do not call it a policy |
| `metlife-critical-illness/benefit-overview.pdf` | Generic employee critical-illness benefit overview | Critical illness | Educational/product brochure | Yes | No | Move/tag as `vendor-product-materials/voluntary/critical-illness` |
| `sun-life-hospital-indemnity/low-and-high-options.pdf` | Employer/broker product-design and benefit-schedule flyer | Hospital indemnity | Generic vendor product flyer | Yes | No | Move/tag as `vendor-product-materials/voluntary/hospital-indemnity` |
| `south-carolina-cancer-specified-disease/three-plan-levels-enrollment-brochure.pdf` | Spanish state-program enrollment brochure with benefits and premiums | Cancer/specified disease; ICU; voluntary supplemental | Employer/program enrollment guide | Yes | No controlling role | Move/tag as `benefit-program-guides/voluntary/cancer`; **rename metadata/file** to identify The Standard / American Heritage Life rather than Allstate-only provenance |
| `trustmark-universal-life-ltc/universal-life-and-lifeevents-options.pdf` | Employer/broker comparison of Universal Life and Universal LifeEvents | Voluntary life; long-term-care living benefits; terminal illness | Generic product comparison | Yes, cross-benefit | No | Move/tag as `vendor-product-materials/voluntary/life-ltc`; multi-label life and LTC |

## Required corrections

1. Split `medical-and-prescription` into a medical-plan classification and prescription/pharmacy support classification. Move/tag the CVS drug list as a formulary and add a real fifth medical plan.
2. Add machine-readable `sourceRole`, `authority`, `benefitSections[]`, `primaryBenefitSection`, `isTemplate`, `isCurrent`, and `sensitivity` fields. A file's leaf name must not be its only classification.
3. Do not count forms, notices, FAQs, formularies, vendor flyers, or general tax publications as plan contracts in test coverage reports.
4. Multi-label the combined/cross-benefit sources: Washington Salary Reduction Plan; Wisconsin decision guide; Duke STD/LTD certificate; CalHR LTD/accident/critical-illness guide; medical plans with Rx/dental/HSA/Medicare features; FEGLI; and Trustmark life/LTC.
5. Correct the South Carolina cancer artifact's Allstate-only filename/provenance. The document identifies The Standard as marketing name and American Heritage Life as underwriter; the legacy hosting domain is not the carrier identity.
6. Route Tulane/Lucet EAP to OCR and tag the blank FSA, HSA, and life forms for PII/health-data handling. Blank forms must be negative tests for fabricated employee elections.

## Optional improvements

- Add the Western Dental Schedule of Benefits as a companion to its EOC so copays can be tested without fabrication.
- Either rename `03_official-plan-documents` to a broader `03_benefit-source-documents`, or move/tag the supporting roles into the destinations above. Renaming preserves the useful five-example diversity without pretending every source is a contract.
- Keep historical and stale documents as drift/conflict fixtures, but record `effectiveDate`, `retrievedDate`, `currentAuthority`, and `supersededBy` explicitly.
- Treat a multi-file plan example as one scenario bundle: contract/EOC + SBC/summary + rate sheet + formulary + enrollment guide can all describe one plan without being interchangeable.

## Which five-example sets become short after honest role correction?

The answer depends on what “five” means:

| Category | If five means meaningful section inputs | If five means governing/authoritative plan documents | Exact replacement needed |
|---|---:|---:|---|
| Dental | 5 | 5, although Western needs its companion schedule | No replacement; add Western's procedure-level Schedule of Benefits |
| EAP | 5 | 0 | Do not manufacture insurance contracts. Keep five program guides; optionally add employer EAP policy/service description or administration agreement as separate roles |
| FSA/DCAP | 5 | 1 | If contract purity is required, add employer-specific health FSA SPD/plan, LPFSA plan, DCAP plan, and another current cafeteria-plan restatement |
| HRA | 5 | 2 | Add an employer ICHRA plan/SPD, employer QSEHRA plan plus completed notice, and a current active-employee HRA plan/SPD |
| HSA | 5 | Not applicable as insurance plans | Add a participant deposit/custodial agreement and current account fee schedule as missing controlling account roles; do not call them insurance plans |
| Life/AD&D | 5 | 4 | Add one actual employer group life/AD&D certificate or SPD, preferably current voluntary/dependent life with EOI thresholds |
| LTD | 5 | 2 standalone, plus 1 combined STD/LTD certificate | Add three standalone current LTD coverage sources: conventional employer-paid group certificate, voluntary/buy-up certificate with EOI, and another employer/public-plan SPD |
| Medical | **4 medical plans + 1 formulary** | **4** | Add one current employer-specific commercial group medical SBC/EOC/SPD/plan document, preferably a non-HSA PPO/POS |
| STD | 5 | 3 | Add a current state statutory disability policy/approved plan or certificate and a current employer group STD SPD/certificate |
| Telemedicine | 5 | 0 | Do not require insurance contracts. Keep five program guides; optionally add a medical-plan telehealth rider or formal service description as another role |
| Vision | 5 | 4 authoritative plan sources; 1 product summary | Add one full individual/group vision policy or certificate if five governing sources are required |
| Voluntary/Aflac | 5 products | 0 full policies; 1 policy-adjacent outline | Preserve the five product-diversity fixtures. If five governing sources are required, separately add certificates/policies for accident, critical illness, hospital indemnity, cancer, and universal-life/LTC products |

For the intended dynamic AI tests, the strongest rule is: **sample across benefit type and source role separately**. A test matrix should be able to ask for five medical plans, five medical supporting documents, five enrollment forms, or five regulatory notices without conflating those populations.
