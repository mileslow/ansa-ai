# Same-employer prior booklet examples

This folder contains five real, publicly retrievable employee benefits guides from official employer-controlled sources. They are deliberately different in employer type, jurisdiction, plan portfolio, document depth, and visual/structural treatment. These are useful as examples of a prior booklet that could provide employer-specific wording, section order, contacts, plan-selection clues, cost-table conventions, and design context for a new benefits booklet.

These guides are reference inputs, not authoritative sources for another employer. Facts from a prior booklet must be reconciled against the current employer application, current carrier documents, current rates, census, and broker instructions before reuse.

Retrieved: **2026-07-17** (America/New_York)

## Coverage matrix

| # | Employer | Employer type / industry | Jurisdiction or market | Guide year | Structural distinction |
|---|---|---|---|---|---|
| 01 | University of Arizona | Public university | Arizona | 2026 | Broad new-hire guide combining health, retirement, payroll, tuition, leave, and legal content |
| 02 | City of Houston | Municipal government | Houston, Texas | Undated; PDF metadata dates it to 2018 | Compact, highly visual new-hire guide with medical costs, forms, and employer-specific administrative pages |
| 03 | Intel Corporation | Private semiconductor / technology employer | New Mexico employees | 2026 benefits; enrollment held in 2025 | Short, state-specific annual-enrollment decision guide with plan comparisons, payroll deductions, and HSA funding |
| 04 | JPMorganChase | Private financial-services employer | U.S. active employees, with regional plan variations | Effective 2025-01-01 | 399-page SPD-style guide with detailed plan rules, life-event administration, and legal material |
| 05 | Adobe | Private software / technology employer | U.S. employees, with California, Washington, Hawaii, Utah, and other location rules | 2025 | Design-forward total-rewards guide combining benefit comparisons, employer funding, payroll costs, leave, perks, and contacts |

## 01 - University of Arizona 2026 Benefits Guide

- **Local file:** `01_university-of-arizona_2026-benefits-guide.pdf`
- **Title:** *2026 Benefits Guide*
- **Organization:** University of Arizona / Arizona Board of Regents
- **Jurisdiction and population:** Arizona; benefits-eligible university employees, with university and State of Arizona plan options
- **Plan year:** 2026
- **Document subtype:** Comprehensive employee benefits / new-hire orientation guide
- **Why it is distinct:** This public-university example treats a benefits guide as a broad employment reference. It combines insurance with mandatory and voluntary retirement plans, enrollment, paycheck treatment, tuition reduction, paid leave, wellness, and legal notices. It also separates State of Arizona options from university alternative plans.
- **Sections detected:** introduction; retirement plans; eligibility and enrollment; medical PPO and HDHP options; pharmacy; dental; vision; FSA; international coverage; university alternative medical/dental/vision plans; life and AD&D; short- and long-term disability; paycheck deductions and imputed income; tuition reduction; paid time off and leave; wellness; legal notices.
- **Potential `BenefitsPackage` fields:** employer name and branding; employee population; eligibility thresholds; enrollment deadlines and workflow; medical/dental/vision plan names and designs; deductibles, copays, coinsurance, and premiums; FSA rules; life/AD&D amounts; STD/LTD design; payroll tax treatment; carrier/administrator contacts; leave and tuition-benefit summaries; legal disclaimer language.
- **Official source page:** https://hr.arizona.edu/benefits/benefits-overview
- **Direct PDF URL:** https://hr.arizona.edu/sites/default/files/2026-Guidebook.pdf
- **File metadata:** PDF 1.7; 4,702,102 bytes; 54 letter-size pages; created 2025-11-05 by Adobe InDesign 21.0.
- **SHA-256:** `3f22ef90713594b16ff82110cdf5cf144944102a41b90df7ffe2754cb59ce33b`
- **Verification:** `%PDF`/PDF signature confirmed with `file`; `pdfinfo` opened the file and reported 54 pages; text extracted successfully with `pdftotext`; page 1 and page 19 (PPO cost table) rendered with Poppler and were visually inspected for identity, legibility, and intact layout.
- **Limitations:** This is a guide, not the governing certificate/SPD for every plan. Several benefits are administered through Arizona state programs, and the source itself says current online plan information controls. Retirement and university-specific employment programs may be outside a booklet generator's intended scope.

## 02 - City of Houston New-Hire Employee Benefit Guide

- **Local file:** `02_city-of-houston_new-hire-employee-benefits-guide.pdf`
- **Title:** *Employee Benefit Guide - Your Life. Your Health. Your Benefits. Your Choice.*
- **Organization:** City of Houston
- **Jurisdiction and population:** Houston, Texas; municipal new hires
- **Plan year:** Not printed. Embedded PDF creation/modification metadata is 2018-03-29, so it should be treated as a historical/legacy example rather than current plan data.
- **Document subtype:** Compact new-hire employee benefit guide with embedded administrative forms
- **Why it is distinct:** This municipal example is only 24 pages but combines benefit summaries, employee cost tables, pharmacy guidance, wellness content, employer forms, and contacts. It demonstrates how a prior booklet may contain administrative pages that are neither plan documents nor pure benefit summaries.
- **Sections detected:** enrollment and eligibility; medical-plan selection; three-plan medical comparison; medical rates and employer/employee cost; prescriptions and specialty-drug savings; dental options and cost; wellness; vision; life and voluntary life; supplemental insurance; health care FSA; City notary and death-termination-pay material; acknowledgment/waiver form; eligibility-processing form; EAP; contacts.
- **Potential `BenefitsPackage` fields:** employer identity and branding; eligibility/enrollment language; medical/dental/vision plan offerings; coverage tiers and payroll costs; employer contribution examples; deductibles, out-of-pocket maximums, copays, and network types; prescription program details; life/voluntary offerings; FSA offering; wellness/EAP programs; HR and carrier contacts; employer form references.
- **Official source page:** https://www.houstontx.gov/hr/benefits/benefits.html
- **Direct PDF URL:** https://www.houstontx.gov/hr/hrfiles/benefits/guide_new_hire.pdf
- **File metadata:** PDF 1.4; 8,169,375 bytes; 24 letter-size pages; created 2018-03-29 by Adobe InDesign CS6.
- **SHA-256:** `fe30326223754085fde4718b44967834cf414ed94f65b5226b2c8fc4c95d43ca`
- **Verification:** PDF signature confirmed with `file`; `pdfinfo` opened the file and reported 24 pages; text extracted successfully; page 1 and page 4 (medical comparison table) rendered with Poppler and were visually inspected. The download is an actual PDF, not an HTML/error page.
- **Limitations:** The document is historical and does not print an explicit plan year. Rates, plan names, links, contacts, and forms should be considered stale. The current City benefits experience is increasingly web-based, so this PDF is best used to test legacy prior-booklet extraction and design inference.

## 03 - Intel 2026 Annual Enrollment New Mexico Guide

- **Local file:** `03_intel_2026-new-mexico-annual-enrollment-guide.pdf`
- **Title:** *2026 Annual Enrollment New Mexico Guide*
- **Organization:** Intel Corporation
- **Jurisdiction and population:** Intel employees in New Mexico
- **Plan year:** 2026; annual enrollment October 13-31, 2025
- **Document subtype:** State-specific annual-enrollment decision guide
- **Why it is distinct:** This private-employer example is intentionally short and regional. It focuses on year-over-year changes and decisions rather than restating every governing plan provision. It compares several medical designs, shows annual paycheck deductions and HSA contributions, and links employees to deeper resources.
- **Sections detected:** enrollment workflow; changes for 2026; virtual visits; EAP transition; New Mexico wellness/vendor program; medical deductible and premium changes; dental, vision, and life changes; health-option comparison; annual paycheck deductions; HSA contributions; benefit resources and contacts. The guide also references FSA and dependent-care elections.
- **Potential `BenefitsPackage` fields:** employer and regional audience; plan year and enrollment window; plan names; HMO, HDHP, PCP/copay, and connected-care designs; deductibles and coinsurance; annual employee payroll deductions; dental/vision/life offering indicators; HSA employer funding and limits; FSA/DCAP election reminders; EAP/wellness programs; provider and administrator resources.
- **Official source page:** https://www.intel.com/content/www/us/en/employee/services-benefits.html
- **Direct PDF URL:** https://www.intel.com/content/dam/www/central-libraries/us/en/documents/2025-10/intel-annual-enrollment-benefits-guide-nm.pdf
- **File metadata:** PDF 1.7; 985,067 bytes; 8 letter-size pages; title metadata matches the guide; created 2025-09-25 and modified 2025-10-08 by Adobe InDesign 20.0.
- **SHA-256:** `04d4b6dd0eca4116efdf08d9bf0222cb6df91c840caca92642d95b8d4437c613`
- **Verification:** PDF signature confirmed; `pdfinfo` opened the file and reported 8 pages; text extracted successfully; page 1 and page 4 (benefit changes) rendered with Poppler and were visually inspected. The file is not HTML despite `file` emitting an inaccurate secondary “0 pages” heuristic; Poppler consistently reports and renders all 8 pages.
- **Limitations:** This is a change/enrollment guide, not a full SPD or full total-rewards booklet. It is specific to New Mexico and depends heavily on linked internal resources, the Pay, Stock and Benefits Handbook, and the enrollment portal. It provides annual paycheck deductions rather than every possible monthly/per-pay-period presentation.

## 04 - JPMorganChase 2025 U.S. Benefits Guide

- **Local file:** `04_jpmorganchase_2025-us-benefits-guide.pdf`
- **Title:** *Your JPMC Benefits Guide*
- **Organization:** JPMorgan Chase & Co. / JPMorganChase
- **Jurisdiction and population:** Most U.S.-payroll employees regularly scheduled for at least 20 hours per week; includes regional Kaiser, Centivo, Hawaii, and expatriate variations
- **Plan year / effective date:** Effective 2025-01-01
- **Document subtype:** Combined employee benefits guide, summary plan description, and (for many plans) plan document
- **Why it is distinct:** This is the legal/deep-detail extreme of the sample set. At 399 pages, it demonstrates a prior guide that is assembled from reusable plan modules and package-wide administrative sections. It also shows how one employer guide can carry several geographic plan variants and cross-plan life-event rules.
- **Sections detected:** about the guide; qualified status/life events; health-care participation; U.S. medical plan; Kaiser HMO; Centivo Select; dental; vision; health, dependent-care, and transportation spending accounts; STD and LTD; life and accident insurance; health/wellness centers; group legal; personal excess liability; child care; expatriate medical/dental; Hawaii medical; plan administration; claims/appeals; contacts.
- **Potential `BenefitsPackage` fields:** employer and eligible employee classes; plan effective date; dependent eligibility; enrollment and midyear-change rules; region-specific plan availability; medical/dental/vision designs; carrier networks and administrators; spending-account rules; life/AD&D and disability designs; child-care and voluntary programs; plan numbers; claims and appeal contacts; legal notices and governing-document hierarchy.
- **Official source page:** https://www.jpmcbenefitsguide.com/
- **Direct PDF URL:** https://www.jpmcbenefitsguide.com/content/dam/jpmorganchase/jpmc-benefits-guide/documents/jpmc-benefits-guide-full.pdf
- **File metadata:** PDF 1.4; 2,470,149 bytes; 399 letter-size pages; title metadata `Your JPMC Benefits Guide`; created/modified 2025-06-25.
- **SHA-256:** `8d76131545fb59676446940eec12d6374fa24ef36b38904cf73e5cd4b0bcc4a2`
- **Verification:** PDF signature confirmed; `pdfinfo` opened the file and reported 399 pages; approximately 1.3 MB of layout-preserving text extracted successfully; page 1 and page 52 (regional U.S. medical-plan options) rendered with Poppler and were visually inspected for intact text, tables, headers, and footers.
- **Limitations:** It is much closer to a governing SPD than a concise enrollment booklet and is not a source of personalized employee costs. Retirement savings and retiree benefits are maintained as separate complete SPDs and are expressly excluded from this “Entire Guide” PDF. Many facts require interpretation across package-wide and plan-specific modules.

## 05 - Adobe 2025 Rewards Guide

- **Local file:** `05_adobe_2025-rewards-guide.pdf`
- **Title:** *Adobe Rewards Guide 2025*
- **Organization:** Adobe Inc.
- **Jurisdiction and population:** U.S. regular employees generally working at least 24 hours per week; location-specific options for California, Washington, Hawaii, Utah, and other states
- **Plan year:** 2025
- **Document subtype:** Total-rewards and employee benefits enrollment guide
- **Why it is distinct:** This guide combines booklet-ready plan comparisons and costs with a broader total-rewards narrative. It covers geographic medical availability, HSA funding, payroll contributions, retirement/equity, disability, leave, family services, perks, and vendor contacts in a highly designed 33-page format.
- **Sections detected:** eligibility/enrollment; location-based medical options; Aetna EPO and HealthSave plans; Kaiser HMO; Hawaii bundled medical/dental/vision; Delta Dental; VSP vision; wellbeing; health FSA; HSA; 401(k), ESPP, and RSUs; life and disability; financial coaching; role-specific programs; PTO and leaves; personal/family services; learning fund; commuter benefits; discounts; matching grants; legal services; travel support; amenities; per-pay-period medical/dental/vision contributions; supplemental life/AD&D and child-life rates; contacts.
- **Potential `BenefitsPackage` fields:** employer branding; eligibility and dependent rules; enrollment deadline/default elections; state/location availability; medical/dental/vision plan designs; deductibles, copays, coinsurance, OOP maximums, and networks; employer HSA funding; FSA/HSA eligibility; per-pay-period rate tiers; life/AD&D pricing; disability/leave offerings; retirement and voluntary programs; administrator and vendor contacts.
- **Official source page:** https://benefits.adobe.com/us/enrollment-and-changes/new-to-adobe
- **Direct PDF URL:** https://benefits.adobe.com/document/458
- **File metadata:** PDF 1.7; 1,833,885 bytes; 33 letter-size pages; title metadata `Adobe Rewards Guide 2025`; created/modified 2025-05-14 by Adobe InDesign 20.3.
- **SHA-256:** `5d53cda5ff1d2aed690cb888f635a6ab7082b5bc52779a5592e5c25b8398215c`
- **Verification:** Official route returned `application/pdf` with filename `Adb-tr-gd-25_051425.pdf`; PDF signature confirmed; `pdfinfo` opened the file and reported 33 pages; text extracted successfully; page 1 and page 5 (Aetna plan comparison and HSA-funding table) rendered with Poppler and were visually inspected.
- **Limitations:** The PDF is publicly retrievable from Adobe's official benefits site but every page is marked `Adobe Confidential`; confirm licensing and permitted use before redistributing or using it beyond controlled evaluation. It is a summary guide rather than the governing SPD, and several programs are location- or employee-class-specific.

## Verification summary

All five downloads were checked as actual PDFs rather than HTML, login, or error responses. Poppler opened every file, extracted text, and rendered representative pages. Visual review covered each cover/page 1 and at least one interior medical or benefit-comparison page. No corruption, password protection, clipped rendering, or substituted error page was found.

Text extracts and representative page renders were created temporarily for verification and were not retained in the final source corpus.
