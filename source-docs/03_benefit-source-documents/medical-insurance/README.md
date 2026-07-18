# Medical-insurance plan-document examples

This folder contains five real, public health-insurance plan documents selected
to exercise materially different medical inputs. Prescription formularies and
PBM support documents are stored separately under
`prescription-and-pharmacy/`; they do not count as medical plans. Public
availability does not transfer ownership; retain source attribution.

## 1. Kaiser Permanente Bronze 60 HDHP HMO 6650/0% PCP + Child Dental

- **Organization:** Kaiser Permanente / Kaiser Foundation Health Plan
- **Jurisdiction:** California
- **Market / plan type:** Small-group Bronze; HSA-qualified high-deductible HMO
- **Document subtype:** Summary of Benefits and Coverage (SBC)
- **Why this is distinct:** A metal-tier small-group plan with an integrated medical and drug deductible, HMO network/referral rules, child dental, and an HSA-compatible high-deductible design. It is a compact comparison input rather than the complete contract. Kaiser’s official small-business plan listing identifies Bronze HDHP HMO offerings as HSA-qualified high-deductible plans.
- **Source page URL:** <https://healthy.kaiserpermanente.org/southern-california/support/forms/health-plans/small-groups-summary-benefits-coverage/archive>
- **HSA qualification confirmation:** <https://business.kaiserpermanente.org/business/plans-listing/small-business/california>
- **Direct file URL:** <https://healthy.kaiserpermanente.org/content/dam/kporg/final/documents/health-plan-documents/summary-of-benefits/ca/sg/2025/40513CA0410021-00-en-2025.pdf>
- **Retrieval date:** 2026-07-17
- **Local filename:** `01_kaiser-ca-bronze-60-hdhp-hmo-sbc-2025.pdf`
- **File details:** PDF 1.7; 3,397,219 bytes (3.2 MiB); 14 PDF pages. The core SBC is numbered 1-6, followed by required nondiscrimination and language-assistance pages.
- **Verification notes:** `pdfinfo` opened the file successfully. Text extraction identified the 2025 coverage period, Bronze 60 HDHP HMO title, $6,650 individual / $13,300 family deductible, and Deductible HMO plan type. Page 1 was rendered to PNG and visually checked; the Kaiser name, plan title, coverage period, deductible table, and network/referral fields are legible with no error-page content.

## 2. Healthfirst Essential Plan 1

- **Organization:** Healthfirst
- **Jurisdiction:** New York
- **Market / plan type:** New York Essential Plan; individual HMO
- **Document subtype:** Summary of Benefits and Coverage (SBC)
- **Why this is distinct:** A New York-specific public-market coverage example, with a $0 deductible and very low out-of-pocket limit, rather than a conventional employer PPO or metal-tier plan. It tests state-program naming, individual coverage, HMO network data, and plan-specific cost sharing.
- **Source page URL:** <https://healthfirst.org/documents>
- **Direct file URL:** <https://assets.healthfirst.org/pdf_Y1Jq9o4B4fQd/2026-essential-plan-1-summary-of-benefits-english>
- **Retrieval date:** 2026-07-17
- **Local filename:** `02_healthfirst-ny-essential-plan-1-summary-2026.pdf`
- **File details:** PDF 1.7; 571,602 bytes (558 KiB); 8 PDF pages.
- **Verification notes:** `pdfinfo` opened the file successfully even though the public file URL has no `.pdf` suffix. Text extraction identified `Healthfirst: Essential Plan 1`, the 01/01/2026-12/31/2026 coverage period, individual coverage, and HMO plan type. Page 1 was rendered and visually checked; the title, $0 deductible, $360 out-of-pocket limit, Healthfirst contact details, and HMO fields are legible and authentic.

## 3. Kaiser Permanente Medicare Advantage Group Plan (HMO) - FCPS

- **Organization:** Kaiser Foundation Health Plan of the Mid-Atlantic States, Inc.; offered for Fairfax County Public Schools
- **Jurisdiction:** District of Columbia, Maryland, and Virginia; employer group is Fairfax County, Virginia
- **Market / plan type:** Employer-group Medicare Advantage HMO with prescription drug coverage for Medicare-eligible retirees
- **Document subtype:** Evidence of Coverage (EOC)
- **Why this is distinct:** A full, 215-page Medicare legal coverage document tied to a specific employer group. It combines Medicare medical and Part D prescription coverage and includes cost sharing, rights, complaints, coverage rules, and CMS-required language that a short commercial SBC does not contain.
- **Source page URL:** <https://myhealth.kaiserpermanente.org/fcps/plans-and-services/>
- **Direct file URL:** <https://myhealth.kaiserpermanente.org/fcps/wp-content/uploads/sites/3/2025/10/FCPS-EOC-2026_ADA.pdf>
- **Retrieval date:** 2026-07-17
- **Local filename:** `03_kaiser-fcps-medicare-advantage-hmo-eoc-2026.pdf`
- **File details:** PDF 1.6; 1,310,984 bytes (1.3 MiB); 215 pages.
- **Verification notes:** `pdfinfo` opened the file successfully. Text extraction identified the January 1-December 31, 2026 term, `Kaiser Permanente Medicare Advantage Group Plan (HMO)`, and explicit medical and prescription-drug coverage language. The rendered first page was visually checked; the EOC title, Medicare/group/HMO designation, carrier name, document code, and plan identifier are clear and undamaged.

## 4. Blue Cross and Blue Shield Service Benefit Plan

- **Organization:** Blue Cross and Blue Shield Association and participating Blue Cross and Blue Shield Plans; authorized by the U.S. Office of Personnel Management
- **Jurisdiction:** United States / federal program
- **Market / plan type:** Federal Employees Health Benefits (FEHB); fee-for-service plan with a national Preferred Provider Organization (PPO); Standard and Basic options
- **Document subtype:** Official FEHB plan brochure / benefit contract summary, including rates and summaries of benefits
- **Why this is distinct:** A nationwide federal PPO example with multiple enrollment tiers and plan options in one authoritative document. It includes out-of-network rules, a full benefit description, FEHB eligibility, enrollment codes, and rates rather than only the standardized SBC table.
- **Source page URL:** <https://www.opm.gov/healthcare-insurance/healthcare/plan-information/plans/BrochureJson?brochureNumber=71-005&year=2026>
- **Direct file URL:** <https://www.opm.gov/healthcare-insurance/healthcare/plan-information/plans/pdf/2026/brochures/71-005.pdf>
- **Retrieval date:** 2026-07-17
- **Local filename:** `04_bcbs-fep-ppo-plan-brochure-2026.pdf`
- **File details:** PDF 1.7; 1,988,748 bytes (1.9 MiB); 168 pages.
- **Verification notes:** `pdfinfo` opened the file successfully. Text extraction identified the 2026 Blue Cross and Blue Shield Service Benefit Plan, FEHB eligibility, Standard and Basic options, PPO structure, and six enrollment codes. Page 1 was rendered and visually checked; the OPM authorization, FEHB logo, PPO description, enrollment information, and brochure number RI 71-005 are legible. OPM returned HTTP 403 to a default command-line user agent, so retrieval was repeated from the same public URL with a conventional browser user agent; the saved result is a valid PDF, not the error response.

## 5. University of Rochester Your PPO Option

- **Organization:** University of Rochester; plan networks include Accountable
  Health Partners and Excellus BlueCross BlueShield.
- **Jurisdiction:** New York private-employer group plan.
- **Market / plan type:** Employer-specific conventional PPO with three network
  cost levels and out-of-network coverage.
- **Document subtype:** 2026 Summary of Benefits and Coverage (SBC).
- **Why this is distinct:** Unlike the public-program and HSA examples, this is
  a private-employer PPO. It tests a preferred local network layered over the
  broader carrier network, out-of-network benefits, and salary-dependent
  out-of-pocket limits.
- **Direct file URL:** <https://www.rochester.edu/human-resources/wp-content/uploads/2025/10/2026-ppo-sbc.pdf>
- **Retrieval date:** 2026-07-17
- **Local filename:** `05_university-of-rochester_2026-employer-ppo-sbc.pdf`
- **File details:** PDF 1.6; 401,946 bytes; 8 pages; SHA-256
  `08f87fb5aebf1331b0eb50c4041a02ce36612335e541918b8ed4905e4bb8bb5e`.
- **Verification notes:** `pdfinfo` opened all pages; text extraction identified
  the 2026 coverage period, employer name, PPO type, three network levels,
  deductibles, prescription benefits, and salary-banded out-of-pocket limits.
  Page 1 was rendered and visually checked as intact and legible.

## Coverage of the requested variation

| Variation | Example |
| --- | --- |
| Bronze HSA-qualified / high-deductible plan | 01 - Kaiser California Bronze 60 HDHP HMO SBC |
| New York-specific coverage | 02 - Healthfirst Essential Plan 1 SBC |
| Medicare | 03 - Kaiser FCPS Medicare Advantage Group HMO EOC |
| Federal nationwide PPO | 04 - BCBS Service Benefit Plan FEHB brochure |
| Private-employer conventional PPO | 05 - University of Rochester PPO SBC |
