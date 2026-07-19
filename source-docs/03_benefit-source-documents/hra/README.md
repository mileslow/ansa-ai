# Health Reimbursement Arrangement (HRA) source documents

Five public, authoritative examples selected for materially different HRA arrangements and document roles. Together they cover an integrated group HRA, a Medicare-eligible retiree HRA, a QSEHRA, an ICHRA notice, and an administrator/member reimbursement guide. These are source and extraction fixtures, not legal templates for unsupervised reuse.

Retrieved: 2026-07-17

## Coverage matrix

| # | Organization | HRA design or role | Document subtype | Jurisdiction or market |
|---|---|---|---|---|
| 1 | City of Cincinnati | Integrated group HRA for active employees | Plan document and SPD | Public employer; Cincinnati, Ohio |
| 2 | JPMorgan Chase & Co. | Medicare-eligible retiree HRA | Official plan document and SPD | Large private employer; U.S. retirees |
| 3 | Internal Revenue Service | QSEHRA | Federal regulatory guidance, Notice 2017-67 | U.S. small employers |
| 4 | Centers for Medicare & Medicaid Services | ICHRA | Federal model participant notice | U.S. individual market and Medicare integration |
| 5 | Optum Financial | HRA reimbursement administration | Participant FAQ and reimbursement workflow guide | U.S. employer-sponsored accounts |

## 1. City of Cincinnati Integrated HRA - Actives

- **Organization:** City of Cincinnati; claims administration identified in the document as J & K Consultants, Inc.
- **Jurisdiction or market:** Public employer in Cincinnati, Ohio; active employees.
- **HRA design:** Integrated HRA paired with employer-sponsored group medical coverage.
- **Document subtype:** Governing plan document and Summary Plan Description (SPD), amended and restated January 1, 2020.
- **Why this example is distinct:** This is a real public-employer plan that shows how an HRA is integrated with a group health plan. It contains detailed participation, reimbursement, forfeiture, COBRA, HIPAA, and plan-administration language rather than only a general HRA explanation.
- **Source webpage URL:** https://www.cincinnati-oh.gov/finance/risk-management/
- **Direct file URL:** https://www.cincinnati-oh.gov/sites/finance/assets/File/Risk/Integrated%20HRA%20Plan%20Doc%202020.pdf
- **Local filename:** `city-of-cincinnati-integrated-hra/active-plan-spd.pdf`
- **File metadata:** PDF 1.7; 466,366 bytes; 28 pages; U.S. Letter; tagged; not encrypted.
- **SHA-256:** `1d2d3882c9c8055cf780ec8b402056552c6d05d4adbdc26dff333c71680de417`
- **Fields it could populate in `BenefitsPackage`:** employer and plan names; section type; active/retiree status; HRA integration type; effective date; plan year; eligible employee classes; participation start/end rules; claims administrator and sponsor contacts; employer funding mechanics; eligible and excluded expenses; reimbursement sequencing; claim and appeal procedures; carryover/forfeiture rules; COBRA terms; HIPAA/privacy notices.
- **Verification notes:** The downloaded object identifies as a PDF rather than HTML. `pdfinfo` opens it successfully, reports 28 pages and no encryption, and `pdftotext` confirms the City of Cincinnati Integrated HRA title, active-employee population, and 2020 restatement. Page 1 was rendered with Poppler and visually inspected; the cover is complete, legible, and unclipped.
- **Known limitations:** The plan is historical and employer-specific. The cover marks J & K material proprietary/confidential, so it is suitable as a factual extraction fixture, not as reusable boilerplate. Contribution amounts and current administration may have changed.

## 2. JPMorgan Chase Retiree Health Reimbursement Arrangement Plan

- **Organization:** JPMorgan Chase & Co.; Via Benefits is identified as claims administrator.
- **Jurisdiction or market:** Large U.S. private employer; Medicare-eligible retirees, certain LTD participants, and eligible dependents.
- **HRA design:** Retiree-only HRA tied to enrollment in individual Medicare coverage through Via Benefits.
- **Document subtype:** Official plan document and SPD, effective January 1, 2020.
- **Why this example is distinct:** Unlike the active-employee integrated HRA, this source describes a retiree-only arrangement, Medicare eligibility, annual employer subsidy funding, premium reimbursement, surviving-dependent treatment, and coordination with a private Medicare exchange.
- **Source webpage URL:** https://www.jpmcbenefitsguide.com/
- **Direct file URL:** https://www.jpmcbenefitsguide.com/content/dam/jpmorganchase/jpmc-benefits-guide/documents/jpm-0d5-ret-hra-print.pdf
- **Local filename:** `jpmorgan-chase-medicare-retiree-hra/plan-spd.pdf`
- **File metadata:** PDF 1.4; 1,264,576 bytes; 13 pages; U.S. Letter; tagged; not encrypted.
- **SHA-256:** `870fe997266e33d0d08b01c88a4d15dc8cabe962e297217b52845cb816082ec5`
- **Fields it could populate in `BenefitsPackage`:** employer and plan names; retiree/Medicare market; eligibility age and service rules; dependent eligibility; enrollment prerequisite; plan effective date; employer-paid status; funding timing and proration; eligible premiums and out-of-pocket expenses; carryover; reimbursement method; claims administrator; COBRA; rehire, divorce, and death rules; plan contacts and amendment disclaimer.
- **Verification notes:** The file signature is PDF, `pdfinfo` reports 13 pages and no encryption, and text extraction confirms it is the JPMorgan Chase retiree HRA plan/SPD with Via Benefits administration and Medicare-specific eligibility. The first page was rendered and visually inspected; branding, body text, image, and footer are legible with no clipping or broken glyphs.
- **Known limitations:** This is a 2020 employer-specific plan and may no longer reflect current eligibility, subsidy amounts, contacts, or Via Benefits procedures. It addresses retirees rather than active employees and should not be generalized to other HRA designs.

## 3. IRS Notice 2017-67 - Qualified Small Employer HRAs

- **Organization:** U.S. Department of the Treasury, Internal Revenue Service.
- **Jurisdiction or market:** Federal U.S. guidance for eligible small employers and their eligible employees.
- **HRA design:** Qualified Small Employer Health Reimbursement Arrangement (QSEHRA).
- **Document subtype:** Authoritative federal tax and administrative guidance, Notice 2017-67.
- **Why this example is distinct:** This source defines the QSEHRA-specific employer and employee eligibility rules, same-terms requirement, statutory limits, written notice, minimum essential coverage proof, substantiation, reporting, premium-tax-credit coordination, and HSA interaction. A QSEHRA is not a group health plan, so it materially differs from the City integrated HRA and JPMorgan retiree HRA.
- **Source webpage URL:** https://www.irs.gov/government-entities/federal-state-local-governments/where-can-i-learn-more-about-health-savings-accounts-hsa-and-health-reimbursement-arrangements-hra
- **Direct file URL:** https://www.irs.gov/pub/irs-drop/n-17-67.pdf
- **Local filename:** `irs-qsehra-guidance/notice-2017-67.pdf`
- **File metadata:** PDF 1.5; 215,830 bytes; 59 pages; U.S. Letter; tagged; not encrypted.
- **SHA-256:** `89d21732d63d5caec8a7114e59b22f9db250479155ab53dcee652cb36b3322d9`
- **Fields it could populate in `BenefitsPackage`:** HRA subtype; eligible-employer constraints; eligible and excluded employee classes; permitted-benefit methodology; family-status variation; plan-year and midyear proration concepts; reimbursable expense rules; MEC proof; substantiation requirements; written-notice requirements; W-2 reporting; premium tax credit coordination; HSA compatibility caveats.
- **Verification notes:** The file identifies as PDF, `pdfinfo` reports 59 pages and no encryption, and extraction confirms Notice 2017-67 and its QSEHRA purpose. Page 1 was rendered and visually inspected; the federal notice text and footnote are complete and legible.
- **Known limitations:** This is regulatory guidance, not a completed employer QSEHRA plan document or employee notice. It predates subsequent statutory and indexed-dollar updates. Current limits and legal requirements must be checked separately before generation; values should not be copied blindly into a booklet.

## 4. CMS Individual Coverage HRA Model Notice

- **Organization:** Centers for Medicare & Medicaid Services (CMS), with requirements issued by the Departments of Treasury, Labor, and Health and Human Services.
- **Jurisdiction or market:** U.S. employers offering ICHRAs; employees obtaining individual-market coverage or enrolled in Medicare.
- **HRA design:** Individual Coverage HRA (ICHRA).
- **Document subtype:** Federal model participant notice, OMB control number 0938-1361; displayed expiration date November 30, 2026.
- **Why this example is distinct:** This is an employer-fillable communication template rather than a governing SPD. It exposes the specific facts needed to explain an ICHRA offer: allowance, family eligibility, dates, opt-out procedures, required individual coverage or Medicare, substantiation, special enrollment, and premium-tax-credit effects.
- **Source webpage URL:** https://www.cms.gov/marketplace/private-health-insurance/health-reimbursement-arrangements
- **Direct file URL:** https://www.cms.gov/files/document/cms-10704-hra-model-notice.pdf
- **Local filename:** `cms-ichra-guidance/model-notice.pdf`
- **File metadata:** PDF 1.6; 157,709 bytes; 7 pages; U.S. Letter; tagged; AcroForm present; not encrypted.
- **SHA-256:** `2a8407d914eb97c896bfcace7649cfdda33499b4dc1f3fcb97007b5d16d6a20d`
- **Fields it could populate in `BenefitsPackage`:** HRA subtype; notice date; annual allowance and variation by family size or age; proration; dependent coverage; coverage and plan-year dates; funding availability dates; opt-out/forfeiture process; required individual coverage or Medicare; reimbursable-expense reference; substantiation procedure; employer HRA contact; Marketplace and premium-tax-credit disclosures.
- **Verification notes:** The downloaded file is a PDF, not HTML. `pdfinfo` reports seven pages, an AcroForm, and no encryption. Extracted text confirms the official ICHRA model notice and its bracketed employer prompts. The first page was rendered and visually inspected; headings, instructions, regulatory citations, and footer are readable without rendering defects.
- **Known limitations:** It is an uncompleted model notice with placeholders, not evidence that a particular employer offers an ICHRA. The displayed OMB expiration is 2026-11-30, so the current CMS version should be rechecked after that date. It does not replace a governing plan document or SPD.

## 5. Optum Financial HRA Frequently Asked Questions

- **Organization:** Optum Financial.
- **Jurisdiction or market:** U.S. employer-sponsored HRA participants and account administration.
- **HRA design:** General employer-funded HRA with payment-card and reimbursement workflows; plan-specific terms remain employer-configurable.
- **Document subtype:** Participant FAQ and reimbursement/administration guide.
- **Why this example is distinct:** This source represents the operational layer that plan documents often omit. It explains how members pay, submit claims, provide documentation, receive reimbursement, retain receipts, use funds, and distinguish an HRA from an HSA or FSA.
- **Source webpage URL:** https://www.optum.com/en/financial-services/health-reimbursement-arrangements.html
- **Direct file URL:** https://my5.optum.com/content/dam/internal-resources/pdfs/employer-resources/faq-hra.pdf
- **Local filename:** `optum-hra-administration/faq.pdf`
- **File metadata:** PDF 1.6; 745,677 bytes; 2 pages; U.S. Letter; tagged; not encrypted.
- **SHA-256:** `ed2f0e1d4ee3420773a617695a4bb1bff86481968ce1cf163d8920207e0f0e29`
- **Fields it could populate in `BenefitsPackage`:** account funding party; general eligible-expense categories; participant/dependent use; payment-card availability; out-of-pocket reimbursement channel; online/mobile claims process; required supporting documentation; receipt-retention guidance; rollover as a plan-dependent setting; comparison language for HRA, HSA, and FSA; administrator identity and member support concepts.
- **Verification notes:** The object has a valid PDF signature. `pdfinfo` reports two pages and no encryption; text extraction confirms the HRA funding, expense, reimbursement, documentation, and account-comparison content. Page 1 was rendered and visually inspected; Optum branding, image, headings, and all FAQ text are sharp and unclipped.
- **Known limitations:** This is general administrator education, not a claim form, employer funding schedule, SPD, or plan-specific guide. It intentionally defers exact contribution, rollover, and eligible-expense terms to the employer's plan materials. It should supply explanatory workflow language only when the actual plan confirms those features.

## Verification summary

- Exactly five original source PDFs are stored in this folder.
- All five files passed file-signature checks as PDF documents; none is an HTML error or login page.
- All five open in Poppler, are unencrypted, and yielded usable text with `pdftotext`.
- `pdfinfo` metadata, byte count, page count, and SHA-256 are recorded above.
- Page 1 of every PDF was rendered to PNG with `pdftoppm` and visually inspected for identity, legibility, clipping, broken glyphs, and rendering defects.
- The collection deliberately mixes governing plan documents, federal rules/templates, and administration guidance because a booklet-generation system must classify the document's role instead of assuming every HRA upload is an SPD.

## Coverage gaps

- No completed employer-specific QSEHRA notice was retained because public examples are often vendor-generated templates or contain employer facts; the IRS guidance is the more authoritative extraction fixture.
- No completed employer-specific ICHRA plan/SPD was retained; the CMS model notice was selected because it is authoritative and explicitly exposes the fields an employer must supply.
- The administrator example is an FAQ rather than a blank claim form. HealthEquity's public claim-form URL returned HTTP 403 to automated retrieval, so no blocked response or disguised HTML was saved.
