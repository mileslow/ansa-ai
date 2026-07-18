# Approved Language Patterns - Public Reference Set

Five public, authoritative examples of employee-facing benefits language patterns. These
documents are references for information architecture, plain-language phrasing, extraction,
and booklet-module testing. They are **not** a blanket license to copy text, design, logos,
rates, limits, deadlines, or employer-specific facts into a generated booklet.

Retrieved: **2026-07-17**

## Coverage map

| File | Primary reusable pattern | Organization / market |
|---|---|---|
| `01_cms_uniform_health_coverage_glossary.pdf` | Plain-language health coverage terms and a visual cost-sharing example | CMS / U.S. health coverage |
| `02_dol_life_changes_enrollment_options.pdf` | Eligibility changes, special enrollment, and action/deadline language | U.S. DOL EBSA / employment-based coverage |
| `03_irs_publication_969_hsa_fsa_hra.pdf` | HSA, FSA, and HRA explanations and distinctions | IRS / U.S. tax-favored health plans |
| `04_ut_life_disability_enrollment_highlights.pdf` | Life, AD&D, STD, and LTD comparison blocks | UT System and BCBSTX / public-university employees |
| `05_dol_top_10_health_benefits_tips.pdf` | Plan choice, document literacy, plan use, claims, and life-event decision support | U.S. DOL EBSA / employment-based coverage |

These are meaningfully different examples: each owns a separate booklet-language job rather
than repeating five versions of the same guide.

## 1. CMS Glossary of Health Coverage and Medical Terms

- **Local file:** `01_cms_uniform_health_coverage_glossary.pdf`
- **Organization:** Centers for Medicare & Medicaid Services (CMS), with the federal SBC and
  Uniform Glossary program
- **Jurisdiction / market:** United States; group and individual health coverage
- **Document subtype:** Standardized consumer glossary with illustrated cost-sharing example
- **Language pattern / sections:** Short term-definition blocks; cross-linked terms; allowed
  amount, appeal, balance billing, claim, coinsurance, copayment, cost sharing, deductible,
  network, out-of-pocket limit, premium, referral, and related terms; final worked example of
  deductible, coinsurance, and out-of-pocket-limit progression
- **Why distinct and reusable:** It is the strongest of the five examples for neutral,
  plan-agnostic vocabulary and for explaining abstract cost-sharing concepts with a staged
  employee scenario. It supports glossary callouts throughout a booklet without importing any
  employer plan values.
- **BenefitsPackage fields / modules supported:** `glossary`, `medical.costSharing`,
  `medical.network`, `medical.claimsAndAppeals`, `medical.planComparison`, educational
  tooltips, and cost-sharing examples
- **Source webpage:**
  https://www.cms.gov/marketplace/health-plans-issuers/summary-benefits-coverage
- **Direct file URL:**
  https://www.cms.gov/files/document/uniform-glossary-english-060723.pdf
- **Metadata:** PDF 1.6; 6 pages; US Letter; 128,430 bytes; title metadata "Glossary of
  Health Coverage and Medical Terms"; modified 2023-07-29
- **SHA-256:** `eed7385dbca723c7172f0d3da27af5c3c62e9bc5031fa63f4a87ea85f17c9e6d`
- **Verification:** `%PDF`/Poppler recognized; `pdfinfo` completed; all 6 pages extract text;
  page 1 was rendered and visually checked for headings, definitions, links, illustrations,
  and legibility; page 6 was rendered and visually checked as the representative
  cost-sharing example. No HTML/error response or visible clipping was found.
- **Known limitations:** Definitions are educational and explicitly defer to the governing
  policy or plan. The footer's OMB expiration date is 2026-05-31, so production language and
  regulatory status must be revalidated. Terms do not provide plan-specific eligibility,
  benefits, exclusions, rates, or contributions.
- **Copyright / reuse:** U.S. federal government works are generally not protected by U.S.
  copyright under 17 U.S.C. 105, but federal seals, logos, trademarks, links, and any
  third-party material remain separately restricted. Preserve attribution and do not imply CMS
  endorsement. Revalidate definitions rather than treating this archived file as current law.

## 2. DOL Life Changes Require Health Choices

- **Local file:** `02_dol_life_changes_enrollment_options.pdf`
- **Organization:** U.S. Department of Labor, Employee Benefits Security Administration
  (EBSA)
- **Jurisdiction / market:** United States; workers and families using employment-based or
  Marketplace health coverage
- **Document subtype:** Consumer enrollment and life-event action guide
- **Language pattern / sections:** Repeating "What You Need to Know" and "What You Need to
  Do" blocks for marriage, pregnancy/childbirth/adoption, a child aging out, death, legal
  separation, and divorce; special-enrollment and COBRA timing language
- **Why distinct and reusable:** It demonstrates an action-oriented pattern that separates a
  life event's explanation from the employee's next step and deadline. That is directly useful
  for eligibility, qualifying-life-event, and changing-coverage pages.
- **BenefitsPackage fields / modules supported:** `eligibility.lifeEvents`,
  `enrollment.specialEnrollment`, `enrollment.deadlines`, `dependents.ageLimit`,
  `continuationCoverage`, `medical.maternity`, and qualifying-life-event callouts
- **Source webpage:**
  https://www.dol.gov/agencies/ebsa/about-ebsa/our-activities/resource-center/publications/life-changes-require-health-choices
- **Direct file URL:**
  https://www.dol.gov/sites/dolgov/files/ebsa/about-ebsa/our-activities/resource-center/publications/life-changes-require-health-choices.pdf
- **Metadata:** PDF 1.7; 6 pages; narrow 264.24 x 612 point page; 174,146 bytes; title metadata
  "Life Changes Require Health Choices"; modified 2024-08-09
- **SHA-256:** `f49d7b3b7c06e2aa89fb4498ea5818220a0232e57140772d5b31e9f88ab9263b`
- **Verification:** `%PDF`/Poppler recognized; `pdfinfo` completed with a non-fatal malformed
  metadata-object warning; text extraction confirmed special-enrollment, dependent, and COBRA
  content; page 1 was rendered and checked as the cover; page 3 was rendered and checked as a
  representative marriage/pregnancy/adoption content page. The pages are legible with no
  visible clipping or error content.
- **Known limitations:** Federal timing rules can change and may interact with state law, plan
  rules, Marketplace rules, and the employee's exact event. Do not transfer the stated 30- or
  60-day periods into a booklet without validating the employer plan and current law.
- **Copyright / reuse:** U.S. federal government works are generally not protected by U.S.
  copyright under 17 U.S.C. 105, but seals, logos, trademarks, and third-party components may
  be restricted. Treat the "Know / Do" structure as the reusable pattern; independently verify
  every legal statement, deadline, and coverage consequence.

## 3. IRS Publication 969 - HSAs and Other Tax-Favored Health Plans

- **Local file:** `03_irs_publication_969_hsa_fsa_hra.pdf`
- **Organization:** Internal Revenue Service, U.S. Department of the Treasury
- **Jurisdiction / market:** United States; taxpayers and employer-sponsored tax-favored
  health arrangements
- **Document subtype:** 2025 federal tax publication, issued 2026-02-11
- **Language pattern / sections:** Definitions, eligibility and qualification tests, benefits,
  contributions, distributions, qualified medical expenses, employer participation, and
  interactions for HSA, Archer MSA, Medicare Advantage MSA, health FSA, and HRA
- **Why distinct and reusable:** It clearly separates HSA, FSA, and HRA ownership, funding,
  eligibility, portability, contribution, reimbursement, and tax-treatment concepts. It is a
  strong reference for preventing the account types from being collapsed into one generic
  booklet section.
- **BenefitsPackage fields / modules supported:** `accounts.hsa.eligibility`,
  `accounts.hsa.hdhpRequirements`, `accounts.hsa.contributions`, `accounts.hsa.distributions`,
  `accounts.fsa.contributions`, `accounts.fsa.carryover`, `accounts.fsa.reimbursements`,
  `accounts.hra.funding`, `accounts.hra.reimbursements`, and account comparison content
- **Source webpage:**
  https://www.irs.gov/forms-pubs/about-publication-969
- **Direct file URL:**
  https://www.irs.gov/pub/irs-pdf/p969.pdf
- **Metadata:** PDF 1.7; 22 pages; US Letter; 1,306,073 bytes; title metadata "2025
  Publication 969"; created 2026-02-11
- **SHA-256:** `d51681ecae43d517415500efe6f7dcc1bba65fed09b48d416f18d6407a5b522f`
- **Verification:** `%PDF`/Poppler recognized; `pdfinfo` completed with non-fatal malformed
  metadata-object warnings; text extraction confirmed distinct HSA, FSA, and HRA sections;
  page 1 was rendered and checked; pages 3, 15, and 17 were rendered and checked as
  representative HSA, FSA, and HRA pages. Text, bullets, columns, headings, and links are
  legible and unclipped.
- **Known limitations:** This edition is for 2025 returns. Dollar limits, tax treatment,
  preventive-care safe harbors, and other rules are year-specific. It is a technical tax
  publication, not a substitute for the employer's plan document, SPD, custodian/administrator
  material, or tax advice. Employee-facing copy should be simplified and legally reviewed.
- **Copyright / reuse:** U.S. federal government works are generally not protected by U.S.
  copyright under 17 U.S.C. 105, but federal marks and third-party material remain restricted.
  Do not reproduce the IRS seal or imply IRS endorsement. Recheck the current revision and
  annual limits before using any substantive language.

## 4. UT Life, AD&D, and Disability Insurance Enrollment Highlights

- **Local file:** `04_ut_life_disability_enrollment_highlights.pdf`
- **Organization:** The University of Texas System Employee Benefits; insurance products
  issued by Dearborn Life Insurance Company and presented under Blue Cross and Blue Shield of
  Texas branding
- **Jurisdiction / market:** Texas public-university active employees and retirees; 2026 annual
  enrollment
- **Document subtype:** One-page enrollment highlights / product comparison flyer
- **Language pattern / sections:** Side-by-side summary blocks for basic and voluntary life,
  AD&D, retiree life, voluntary short-term disability (STD), and voluntary long-term disability
  (LTD); concise labels for benefit amount, elimination period, maximum period payable,
  evidence of insurability, and other-income offsets
- **Why distinct and reusable:** It is the only example in the set that shows how to compress
  four related protection products into scannable, parallel employee-facing blocks. It also
  demonstrates the field differences between life/AD&D and income-replacement coverage.
- **BenefitsPackage fields / modules supported:** `life.basic`, `life.voluntary`,
  `life.dependent`, `life.evidenceOfInsurability`, `add`, `disability.std.weeklyBenefit`,
  `disability.std.eliminationPeriod`, `disability.std.maximumDuration`,
  `disability.ltd.monthlyBenefit`, `disability.ltd.eliminationPeriod`, and enrollment dates
- **Source webpage:**
  https://www.utsystem.edu/documents/docs/publication/2024/life-add-and-disability-insurance-overview
- **Direct file URL:**
  https://www.utsystem.edu/sites/default/files/documents/publication/2026/life-add-and-disability-insurance-overview/ut-life-enrollment-flyer-bcbstx-2026.pdf
- **Metadata:** PDF 1.6; 1 page; US Letter; 188,516 bytes; title metadata "UT Life AD&D
  Disability Enrollment Info"; modified 2026-05-14
- **SHA-256:** `6177add62f9ee4a217e47f847cb2484076dfc9758bf3b6788495cbc73253264c`
- **Verification:** `%PDF`/Poppler recognized; `pdfinfo` completed; text extraction confirmed
  life, AD&D, STD, LTD, eligibility/evidence, and benefit-period content; the single page was
  rendered and checked both as page 1 and the representative content page. Headings, columns,
  notes, contact details, and disclaimers are legible with no visible overlap or clipping.
- **Known limitations:** Every date, amount, percentage, duration, eligibility condition,
  evidence-of-insurability rule, offset, administrator, and contact detail is specific to UT's
  2026 offering. The flyer explicitly says it is illustrative and that the issued policy
  controls. It is not a certificate or complete plan description.
- **Copyright / reuse:** Unlike the federal examples, this university/carrier document should
  be assumed copyrighted. It is retained for internal research, extraction testing, and
  structural comparison. Do not copy its prose, layout, logos, brand elements, or plan values
  into generated booklets without permission. Use only the abstract field taxonomy and
  side-by-side comparison concept.

## 5. DOL Top 10 Ways to Make Your Health Benefits Work for You

- **Local file:** `05_dol_top_10_health_benefits_tips.pdf`
- **Organization:** U.S. Department of Labor, Employee Benefits Security Administration
  (EBSA)
- **Jurisdiction / market:** United States; workers and families with employment-based health
  benefits
- **Document subtype:** Two-page consumer decision-support and benefits-literacy guide
- **Language pattern / sections:** Explore plan options; review benefits against needs; read
  the SPD and SBC; use coverage and preventive care; understand behavioral-health coverage;
  assess wellness programs; file claims and appeals; revisit coverage after family/work
  changes; plan for retirement
- **Why distinct and reusable:** It supplies a task-based "how to use your benefits" narrative
  rather than defining terms or summarizing a particular plan. It is useful for welcome,
  decision-support, enrollment checklist, using-your-plan, and claims/appeals modules.
- **BenefitsPackage fields / modules supported:** `welcome.decisionSupport`,
  `enrollment.planSelectionChecklist`, `documents.spd`, `documents.sbc`,
  `medical.preventiveCare`, `medical.behavioralHealth`, `wellness`, `claimsAndAppeals`,
  `eligibility.lifeEvents`, `continuationCoverage`, and retirement-transition callouts
- **Source webpage:**
  https://www.dol.gov/node/63389
- **Direct file URL:**
  https://www.dol.gov/sites/dolgov/files/ebsa/about-ebsa/our-activities/resource-center/publications/top-10-ways-to-make-your-health-benefits-work-for-you.pdf
- **Metadata:** PDF 1.7; 2 landscape pages; 243,462 bytes; title metadata "Top 10 Ways to Make
  Your Health Benefits Work for You"; modified 2024-08-11
- **SHA-256:** `77ea8de6edde57a44a82ad58757ef3e3cec45bb6d45e990834dbfae1bc7984fd`
- **Verification:** `%PDF`/Poppler recognized; `pdfinfo` completed with a non-fatal malformed
  metadata-object warning; extracted text confirmed all ten tips and the law/reference panel;
  both pages were rendered and visually checked. The four-column landscape layout, headings,
  illustrations, links, and footer are legible with no visible clipping or error content.
- **Known limitations:** The PDF itself is dated January 2022 even though its server metadata
  was updated later. Laws, deadlines, URLs, agencies, and benefit rules must be revalidated.
  Its general advice cannot establish what any employer's plan covers.
- **Copyright / reuse:** U.S. federal government works are generally not protected by U.S.
  copyright under 17 U.S.C. 105, but seals, logos, trademarks, and third-party material may be
  restricted. Reuse the task sequence and independently drafted plain-language concepts, not
  the federal seal, illustration, or an implication of DOL endorsement.

## Use in booklet generation

Recommended precedence for production content:

1. Governing plan document, certificate, SPD, SBC, or account plan document.
2. Current employer application, election, contribution, eligibility, and administrator data.
3. Current legal/regulatory requirements and notices.
4. These sources as language-pattern and information-architecture references only.

No file in this folder should override a plan-specific source. When a generated sentence
contains a dollar value, percentage, date, deadline, age, waiting/elimination period, duration,
tax limit, contact, or eligibility rule, the value must trace to the current employer package or
current authoritative law/guidance rather than to these examples.
