# Employee Assistance Program (EAP) source examples

This folder contains exactly five real, publicly accessible EAP documents selected for benefits-booklet extraction and document-classification testing. The set is intentionally diverse across sponsor type, vendor model, intended audience, session design, household eligibility, work-life resources, crisis support, and manager services.

Retrieved: **2026-07-17**

## Coverage summary

| # | Sponsor / publisher | Market and design | Distinctive extraction value |
|---|---|---|---|
| 1 | National Institutes of Health | Federal workforce; internally staffed, full-service EAP | Long-form program brochure with employee scenarios, supervisor support, crisis intervention, workshops, confidentiality, and immediate-family eligibility |
| 2 | Washington State EAP | State and other participating public employees; short-term public-sector model | Explicit three-session allowance, all-household-adult eligibility, in-person/phone access, confidentiality rules, and legal/financial topics |
| 3 | Tulane University / Lucet | University-sponsored private-vendor EAP | Three counseling/coaching sessions per topic per year, household eligibility, multiple counseling modes, life coaching, legal/financial, work-life, and digital resources |
| 4 | Guardian / Uprise Health | Carrier-linked employee overview for a staffing organization | Employer/group-specific access fields plus health, family, legal, financial, identity-theft, and medical-bill-negotiation resources |
| 5 | Optum | National private EAP vendor; employer/manager-facing product snapshot | Unlimited specialist/management consultations, face-to-face referrals, critical-incident response, promotion resources, WorkLife services, and outcome metrics |

## Verification performed

- Confirmed each download has a PDF signature and is identified as a PDF by the system `file` utility; none is HTML or an error/login page.
- Opened every file with Poppler `pdfinfo`; all five are unencrypted and report valid page geometry and page counts.
- Extracted identifying text with `pdftotext` from every document. The Tulane/Lucet PDF has a malformed embedded character map, so its identity and content were additionally confirmed by OCR of rendered pages.
- Rendered and visually inspected page 1 of every PDF with Poppler. The Tulane/Lucet second page was also rendered and inspected to confirm its service table, access details, and session allowance.
- Visual inspection found readable text, intact branding, complete page bounds, and no clipping, overlap, black boxes, or broken images.
- Originals were retained byte-for-byte as downloaded; no source document was edited.

## 1. NIH federal in-house EAP brochure

- **Document title:** Employee Assistance Program - Navigating life's transitions
- **Organization:** National Institutes of Health, Office of Research Services, Division of Occupational Health and Safety
- **Jurisdiction / market:** United States federal workforce; NIH employees, trainees, and immediate family members
- **Document subtype:** Long-form employee program brochure
- **Program design:** Internally staffed EAP with licensed/certified workplace-wellness and behavioral-health professionals; personalized consultation, short-term counseling, referrals, follow-up, supervisor/workgroup support, crisis intervention, and workshops
- **Why it is distinct:** This is the only long-form, internally staffed federal program example. It demonstrates how a detailed booklet section can describe employee support, management resources, crisis response, training, and confidentiality without presenting a fixed carrier session count.
- **Source webpage:** https://ors.od.nih.gov/sr/dohs/HealthAndWellness/EAP/Pages/Publications-Videos-and-Media.aspx
- **Direct file URL:** https://ors.od.nih.gov/sr/dohs/Documents/employee-assistance-program-brochure.pdf
- **Local filename:** `01_nih_federal_inhouse_eap_brochure.pdf`
- **File metadata:** PDF 1.7; 11 pages; 756,931 bytes (739.2 KiB); created 2013-03-27; modified 2017-12-20
- **SHA-256:** `ddd9b79a9a1491b0ef2c255f6bd39fcdb7011d0fc5f2c9a00808d5173eb4eed3`
- **BenefitsPackage fields supported:** sponsor/employer, program name, program description, eligible populations, family eligibility, cost/no-cost status, confidentiality, counseling model, referral/follow-up model, work-life topics, supervisor resources, critical-incident support, workshops/training, access phone/location/hours, and crisis guidance
- **Verification notes:** PDF metadata identifies the NIH EAP as author. Extracted text and the rendered cover identify NIH and the program; subsequent extracted pages contain work/life balance, supervisory resources, crisis intervention, workshops, and FAQs.
- **Known limitations:** The document is older and should not be treated as current evidence for phone numbers or operations without revalidation. It describes short-term counseling but does not state a numeric visit allowance. It is an internal federal program, not an insurance policy or commercial EAP contract.

## 2. Washington State public-employee EAP brochure

- **Document title:** Employee Assistance Program - No-cost, confidential support to help with work and life challenges
- **Organization:** Washington State Employee Assistance Program, Department of Enterprise Services
- **Jurisdiction / market:** Washington public employees at participating organizations
- **Document subtype:** Employee onboarding tri-fold brochure
- **Program design:** Short-term, solution-focused counseling with local in-person or phone professionals; up to three sessions; all household adults covered; future use allowed when new problems arise
- **Why it is distinct:** It is a recent public-sector benefit summary with unusually explicit session and household rules. It also demonstrates a public-employer EAP that combines mental health, addiction/recovery, parenting/eldercare, workplace issues, and legal/financial help.
- **Source webpage:** https://eap.wa.gov/resource-library/eap-brochure-pdf
- **Direct file URL:** https://eap.wa.gov/sites/default/files/2025-03/EAP-brochure-english.pdf
- **Local filename:** `02_washington_state_public_employee_eap_brochure.pdf`
- **File metadata:** PDF 1.6; 2 pages; 679,571 bytes (663.6 KiB); created 2025-10-23; modified 2025-10-23
- **SHA-256:** `bcc68c3e1ca11d6fed6d695dbf4ed6f66b880d2b3825402a4be3b7e0baee3d6d`
- **BenefitsPackage fields supported:** sponsor, program name, public-employee market, cost/no-cost status, session allowance, session reset/new-problem rule, eligible household members, counseling modalities, work/life topics, parenting/eldercare, legal/financial services, confidentiality and exceptions, access phone/URL, and intake method
- **Verification notes:** Both pages open correctly. Extracted text states the three-session allowance and all-household-adult rule. The rendered first page is a complete tri-fold exterior with program identity, public-employee audience, phone, and URL.
- **Known limitations:** The session and eligibility design is sponsor-specific and should not be generalized to other EAPs. The PDF URL path contains `2025-03`, while embedded metadata reports an October 2025 creation date. It is a high-level brochure rather than a governing plan document.

## 3. Tulane University / Lucet EAP brochure

- **Document title:** Personalized care and resources, when you need them
- **Organization:** Lucet; distributed by Tulane University Human Resources
- **Jurisdiction / market:** Tulane University employees and household members; United States university workforce
- **Document subtype:** Employer-customized two-page vendor EAP brochure
- **Program design:** Three counseling/coaching sessions per topic per year; face-to-face, online, and telephone counseling; telephone life coaching; legal/financial consultation; work-life referrals; 24/7 access; website/app resources
- **Why it is distinct:** This example combines a precise per-topic/per-year allowance with counseling, coaching, legal/financial, work-life, and digital self-service. It also contains employer-specific company-code and contact fields suitable for access-instruction extraction.
- **Source webpage:** https://hr.tulane.edu/employee-assistance-program-eap
- **Direct file URL:** https://hr.tulane.edu/sites/default/files/2025-01/eap_intro-to-eap_lucet_tulane.pdf
- **Local filename:** `03_tulane_lucet_university_eap_brochure.pdf`
- **File metadata:** PDF 1.6; 2 pages; 726,167 bytes (709.1 KiB); created 2024-10-16; modified 2025-01-06
- **SHA-256:** `6651327f258d65eb12daed4315ea125efa7a09dfdf113d760d1bb6d5f2b36090`
- **BenefitsPackage fields supported:** sponsor/employer, vendor, program name, household eligibility, cost/no-cost status, availability, counseling/coaching allowance and reset basis, counseling modalities, legal/financial consultation duration, work-life categories, caregiver/education/career resources, online tools, webinars/training, access phone/URL/company code, and confidentiality language
- **Verification notes:** Both pages render cleanly and visually identify Lucet and Tulane. OCR confirms the title, household eligibility, 24/7 availability, counseling modes, coaching, legal/financial resources, work-life resources, and `3 counseling/coaching sessions, per topic, per year.`
- **Known limitations:** The PDF's embedded text character map is malformed; naive `pdftotext` output is garbled even though the visible PDF is correct. Production extraction should route this document to OCR. The three-session allowance and company code are Tulane-specific.

## 4. Guardian / Uprise Health employee EAP overview

- **Document title:** Help for what matters most - Your employee assistance program
- **Organization:** Uprise Health; Guardian-branded distribution; employer identified as Staffing Solutions Organization
- **Jurisdiction / market:** United States employer group; carrier-linked voluntary-benefits context
- **Document subtype:** Employer/group-customized employee EAP overview flyer
- **Program design:** Telephone, email, and web access to complimentary counseling support plus health, family, legal, financial, identity-theft, tax/debt, will-preparation, and medical-bill-negotiation resources
- **Why it is distinct:** This is the strongest example of a compact, employer-specific access flyer. It includes a group number, employer name, access code, contact channels, office-hours caveat, vendor/carrier relationship, and broad non-counseling resources.
- **Source webpage:** No separate public landing page was identified; the official New York State Public Health Corps resource host serves the PDF directly.
- **Direct file URL:** https://nysphcresources.health.ny.gov/sites/default/files/nysphc/shared_documents/2024-07/SSO%20Guardian%20-%20Uprise%20Health%20EAP%20EE%20Overview%20%282023%29.pdf
- **Local filename:** `04_guardian_uprise_health_employee_eap_overview.pdf`
- **File metadata:** PDF 1.5; 1 page; 106,794 bytes (104.3 KiB); created 2022-03-03; modified 2023-08-08; tagged; AcroForm present
- **SHA-256:** `bd2ec3dba64ba7be76c574c618d1cbaa6f4f62a7f84850ebf54d5a3e88c1e61f`
- **BenefitsPackage fields supported:** carrier/brand, service vendor, employer name, group number, program name, family eligibility wording, service categories, legal/financial subservices, access email/phone/URL/code, service availability, office-hours caveat, non-insurance status, state-availability caveat, and disclaimer text
- **Verification notes:** `pdftotext` and the rendered page confirm Guardian/Uprise branding, employer and group identifiers, access code, phone/email/web channels, and all listed service categories. The one-page layout is complete and readable.
- **Known limitations:** The flyer expired in February 2024 and is retained as a structural/extraction example, not current benefit guidance. It does not state a counseling-session allowance. The document says it is illustrative, not a contract, and that the EAP is not an insurance benefit. The employer/group identifiers should be treated as sample-sensitive fields, not defaults.

## 5. Optum employer and manager EAP snapshot

- **Document title:** A snapshot of the Optum Employee Assistance Program - Fostering resiliency and enhancing productivity
- **Organization:** Optum
- **Jurisdiction / market:** United States national employer market
- **Document subtype:** Employer-facing product infographic / sales fact sheet
- **Program design:** 24/7 unlimited specialist and management consultations with face-to-face counseling referrals; specialty help centers; critical-incident management support; employee-promotion resources; optional WorkLife services; integration with behavioral-health benefits
- **Why it is distinct:** Unlike the four employee-facing or program-specific examples, this document targets employers and managers. It is valuable for extracting organization-level services, critical-incident response, management consultation, promotion resources, integration claims, and outcome metrics.
- **Source webpage:** No distinct current landing page for this archived fact sheet was identified; Optum serves it directly from its official content library.
- **Direct file URL:** https://campaign.optum.com/content/dam/optum/resources/infographics/EAP-At-a-Glance.pdf
- **Local filename:** `05_optum_employer_manager_eap_at_a_glance.pdf`
- **File metadata:** PDF 1.7; 1 page; 63,095 bytes (61.6 KiB); created 2014-05-21; modified 2014-05-21
- **SHA-256:** `daf5da2e3be641ffc4c82962da25e24f87777318448527f939c2355c53d22ea6`
- **BenefitsPackage fields supported:** vendor, program name, market/audience, availability, employee consultation model, management consultations, face-to-face referral model, specialty help centers, critical-incident support, WorkLife availability, promotion/engagement resources, behavioral-health integration, vendor sales contact, outcome metrics, evidence footnotes, exclusions/availability caveat, and document version/date
- **Verification notes:** Extracted text and the rendered page confirm Optum branding, 24/7 access, unlimited consultations, management services, critical-incident support, WorkLife services, and the cited performance metrics. Fine-print footnotes and the program-availability caveat are readable in the source.
- **Known limitations:** This is a 2014 marketing infographic, not a current plan document or employee access guide. Its outcome statistics and contact information may be stale. A footnote references a five-visit EAP model, but the main design language emphasizes unlimited specialist consultations plus face-to-face referrals; these concepts must not be conflated into a plan-specific visit allowance.

