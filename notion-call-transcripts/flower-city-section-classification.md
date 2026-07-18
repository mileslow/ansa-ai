# Flower City Communications Benefit Guide - OCR/Text Section Classification

Source PDF: `notion-call-transcripts/2025 Benefit Guide.pdf`

Extraction source: `notion-call-transcripts/pdf-information-extraction.md`

Document metadata:

- Employer shown on cover: Flower City Communications
- Plan year shown on cover: 2025 Plan Year
- Page count: 19
- Extraction method available in repo: embedded PDF text extraction
- OCR/text reliability: generally good for section structure and tables; contains several obvious template/stale-text artifacts that must not be treated as employer facts without corroboration.

## High-level classification

Flower City is best treated as a master benefits booklet template with broad section coverage.

It is useful for:

- section order
- section inventory
- table structures
- employee-facing language
- benefit module examples
- disclaimer/legal language
- contact-list layout

It should not be blindly used as a factual source for another employer because the extracted text includes stale or template artifacts.

## Section map

| Page | Section | Classification | Primary benefit/module | Use in generator |
|---:|---|---|---|---|
| 1 | Cover | Booklet front matter | Employer identity / plan year | Template for cover layout; factual only for Flower City name and 2025 plan year |
| 2 | Table of Contents | Navigation / structure | Section ordering | Strong master-template source for section inventory and ordering |
| 3 | Welcome | Introductory copy | General benefits overview | Reusable language with employer-name substitution |
| 4 | Open Enrollment | Enrollment workflow | Enrollment dates, what's new, how to enroll | Template for enrollment section; dates and contact are employer/year-specific |
| 5 | Eligibility | Eligibility rules | waiting period, dependents, qualifying events | Template for eligibility/dependent/QLE language; waiting period must be verified against employer app |
| 6 | Medical Plan Option 1 | Medical plan detail | Excellus SimplyBlue Plus Gold 1 | Medical plan page template with cost table |
| 7 | Medical Plan Option 2 | Medical plan detail | Excellus SimplyBlue Plus Silver 19 | Medical plan page template with cost table |
| 8 | Medical Plan Option 3 | Medical plan detail / HSA signal | Excellus SimplyBlue Plus Bronze 4, HSA-qualified | Medical plan page template; indicates HSA-qualified plan handling |
| 9 | Telemedicine | Ancillary medical service | Excellus / MDLive | Telemedicine module template |
| 10 | HRA | Account-based benefit | Benefit Resource, Inc. HRA | HRA module template; employer contribution table pattern |
| 11 | FSA | Account-based benefit | Benefit Resource, Inc. FSA | FSA module template; includes 2025 FSA contribution limits |
| 12 | Dental | Dental plan detail | Excellus BC/BS dental | Dental module template with benefit and cost table |
| 13 | Vision | Vision plan detail | EyeMed Insight Network | Vision module template with benefit and cost table |
| 14 | Basic Life & AD&D | Employer-paid insurance | Guardian Basic Life / AD&D | Life/AD&D module template |
| 15 | Long Term Disability | Employer-paid disability | LTD | LTD module template |
| 16 | EAP | Employee assistance | Guardian/ComPsych EAP | EAP module template with service categories and contact block |
| 17 | Voluntary Benefits | Voluntary/employee-paid benefits | Colonial | Voluntary benefits module template |
| 18 | Contact List | Contacts | carriers, HR, broker | Contact-list template |
| 19 | Legal disclaimer | Legal / disclaimer | official-documents prevail, HIPAA confidentiality | Legal/disclaimer template |

## Detailed classification by section

### 1. Cover

Page: 1

Classification:

- `front_matter.cover`
- factual for this document only

Extracted fields:

- employer name: Flower City Communications
- plan year label: 2025 Plan Year

Generator usage:

- Use as cover layout reference.
- Do not use Flower City name for other employers.

### 2. Table of Contents

Page: 2

Classification:

- `front_matter.table_of_contents`
- `template.section_order`

Detected section order:

1. Welcome
2. Open Enrollment
3. Eligibility
4. Medical
5. Telemedicine
6. Health Reimbursement Account (HRA)
7. Flexible Spending Account (FSA)
8. Dental
9. Vision
10. Basic Life & AD&D
11. Long Term Disability
12. EAP
13. Voluntary Benefits
14. Contact List
15. Legal/disclaimer page

Generator usage:

- Strong source for the master-template module list.
- Strong source for default section order when employer-specific documents do not provide a better order.

### 3. Welcome

Page: 3

Classification:

- `intro.welcome`
- reusable employee-facing copy

Extracted concepts:

- employer goal of offering effective, cost-efficient, comprehensive benefits
- annual review of programs
- compliance with health care reform/government regulation
- guide is a summary, not the SPD
- official plan documents prevail

Generator usage:

- Reusable with employer-name substitution.
- Official-documents-prevail language should be preserved or adapted.

### 4. Open Enrollment

Page: 4

Classification:

- `enrollment.open_enrollment`
- `enrollment.how_to_enroll`
- `renewal.whats_new`

Extracted fields:

- plan year: 2025
- open enrollment dates: Wednesday, November 13 - Wednesday, November 27
- meeting: Wednesday, November 13th at 1:30 PM
- how to enroll: return forms to Jennifer Kelly; sign waiver if waiving coverage
- what's new:
  - new medical plan and contribution rates
  - employer-paid Life and AD&D
  - employer-paid LTD
  - EAP

Generator usage:

- Template for open enrollment page.
- Dates/contact/new-benefit list are employer/year-specific and must come from current files or user answer.

### 5. Eligibility

Page: 5

Classification:

- `eligibility.employee_eligibility`
- `eligibility.dependents`
- `eligibility.qualifying_life_events`

Extracted fields:

- initial eligibility period: day employee becomes benefit eligible through 30 days from that date
- benefits begin: first of the following month after 30 days of employment
- eligible dependents:
  - spouse unless legally separated
  - domestic partner
  - naturally born children
  - legally adopted children
  - stepchild/foster/legal custody children, subject to dependency/support rules
  - children required under Qualified Medical Child Support Order
- child dependent age: medical/dental/vision until end of month following 26th birthday
- qualifying events:
  - marriage/divorce/legal separation
  - birth/adoption
  - child dependent-status change
  - death of spouse/child/dependent
  - service-area change
  - employment status or other employer-plan coverage change
- qualifying-event request deadline: within 30 days

Generator usage:

- Strong template for dependent/QLE language.
- Waiting period must be verified from employer application/current documents.

OCR/text issues:

- Contains typos: `teh follwoing`, `30days`.

### 6. Medical Plan Option 1

Page: 6

Classification:

- `benefit.medical.plan_option`
- `benefit.medical.cost_table`

Plan:

- carrier: Excellus BC/BS
- plan name: SimplyBlue Plus Gold 1

Extracted benefits:

- deductible: N/A
- coinsurance: N/A
- OOP max: Single $9,200 / Family $18,400
- Rx tiers: $15 ($0 to age 19) / 40% / 50%
- preventive drugs: not subject to deductible
- preventive care: covered in full
- PCP: $30 copay
- specialist: $60 copay
- inpatient hospital: $1,250 copay per admission
- outpatient surgery facility: $650 copay
- ER: $650 copay
- urgent care: $60 copay

Cost table:

- pay periods shown: 26 and 22
- tiers: Single, Employee + Spouse, Employee + Child(ren), Family

Generator usage:

- Good template for a single medical option page.
- Cost table shows support for nonstandard payroll periods beyond 52/26/24/12; the product should not assume only common payroll schedules.

### 7. Medical Plan Option 2

Page: 7

Classification:

- `benefit.medical.plan_option`
- `benefit.medical.cost_table`

Plan:

- carrier: Excellus BC/BS
- plan name: SimplyBlue Plus Silver 19

Extracted benefits:

- deductible: Single $3,350 / Family $6,700
- coinsurance: N/A
- OOP max: Single $7,750 / Family $15,500
- Rx tiers: $5 ($0 to age 19) / $45 / $90 after deductible
- preventive drugs: not subject to deductible
- preventive care: covered in full
- PCP: $25 copay after deductible
- specialist: $50 copay after deductible
- inpatient hospital: $500 copay after deductible
- outpatient surgery facility: $350 copay after deductible
- ER: $350 copay after deductible
- urgent care: $50 copay after deductible

Generator usage:

- Good template for medical option pages with deductible-applies language.

### 8. Medical Plan Option 3 / HSA-qualified plan

Page: 8

Classification:

- `benefit.medical.plan_option`
- `benefit.medical.hsa_qualified_signal`
- `benefit.medical.cost_table`

Plan:

- carrier: Excellus BC/BS
- plan name: SimplyBlue Plus Bronze 4
- HSA-qualified: yes

Extracted benefits:

- deductible: Single $8,300 / Family $16,600
- coinsurance: 0%
- OOP max: Single $8,300 / Family $16,600
- Rx tiers: $0 / $0 / $0 after deductible
- preventive drugs: not subject to deductible
- preventive care: covered in full
- PCP/specialist/inpatient/outpatient/ER/urgent care: covered at 100% after deductible

Generator usage:

- Strong example of detecting HSA eligibility from the plan page.
- If this plan is selected, the generator should consider whether to include an HSA section or ask if HSA is offered.

### 9. Telemedicine

Page: 9

Classification:

- `benefit.telemedicine`

Vendor/carrier:

- Excellus / MDLive

Extracted concepts:

- 24/7 virtual access to U.S. board-certified doctors and pediatricians
- average wait time: 20 minutes
- not a replacement for PCP/specialist
- behavioral health telemedicine available

Common conditions:

- acne
- bronchitis
- nausea
- allergies
- fever
- pinkeye
- asthma
- cold and flu
- earache

Behavioral health categories:

- addiction
- bipolar disorder
- depression
- eating disorders
- postpartum depression
- relationship issues
- stress
- trauma and PTSD
- grief and loss
- LGBTQ support
- life changes
- panic disorders

Contact:

- app: MDLive
- phone: 1-866-692-5045
- text: EXCELLUS to 635483
- website: ExcellusBCBS.com/Member

OCR/text issues:

- Header includes `VISION PLAN` before `TELEMEDICINE`; this appears to be a layout/template artifact.

### 10. Health Reimbursement Account

Page: 10

Classification:

- `benefit.hra`
- `benefit.account_based`

Administrator:

- Benefit Resource, Inc.

Extracted concepts:

- HRA is employer-funded.
- Can be used for medical care expenses such as copays, deductible, and prescriptions.
- Funds can be used for employee and covered dependents.
- Debit card issued by BRI.

Contribution table:

- Single:
  - Gold 21 & Silver 19: $1,000
  - Bronze 4: $1,500
- Family:
  - Gold 21 & Silver 19: $2,000
  - Bronze 4: $2,500

Generator usage:

- Strong HRA module template.
- Shows contribution varies by selected medical plan and tier.

Important artifact:

- Text references `Genesee Community Charter School` and `GCCS`, not Flower City Communications. Treat as stale employer-specific content from the template, not as Flower City factual data.

Possible data issue:

- `Gold 21` may be a typo/stale reference because the medical page shows `Gold 1`.

### 11. Flexible Spending Account

Page: 11

Classification:

- `benefit.fsa`
- `benefit.account_based`

Administrator:

- Benefit Resource, Inc.

Extracted concepts:

- FSA uses pre-tax payroll deductions.
- Does not roll over year to year, though medical FSA carryover is listed.
- Medical FSA covers eligible medical, dental, and vision out-of-pocket expenses.
- Dependent Care FSA covers qualified dependent care expenses.

Extracted limits:

- 2025 medical FSA maximum contribution: $3,300
- maximum carryover: $660
- dependent care FSA maximum: $5,000, or $2,500 if married filing separately

Generator usage:

- Strong FSA module template.
- Annual IRS limits must be updated by plan year; do not hard-code 2025 limits for future booklets.

Important artifact:

- Contains `[carrier website]` placeholder.

### 12. Dental

Page: 12

Classification:

- `benefit.dental.plan_detail`
- `benefit.dental.cost_table`

Carrier:

- Excellus BC/BS

Extracted benefits:

- eligibility: all eligible employees
- who pays: GCCS & Employee
- dependent age limit: to age 26
- preventive services: 100% in-network / 100% out-of-network
- basic services: 80% / 80%
- major services: 50% / 50%
- orthodontia to age 19: 50% / 50%
- deductible: Single $50 / Family $150, preventive waived
- annual max: $1,000
- orthodontia lifetime max: $1,000
- waiting period: none
- out-of-network: covered at fee schedule, subject to balance billing

Cost table:

- pay periods shown: 26 and 22
- tiers: Single, Employee + Spouse, Employee + Children, Family

Important artifact:

- `GCCS & Employee` is stale employer-specific text, not Flower City factual data unless corroborated.

### 13. Vision

Page: 13

Classification:

- `benefit.vision.plan_detail`
- `benefit.vision.cost_table`

Carrier/network:

- EyeMed
- Insight Network

Extracted benefits:

- eligibility: all eligible employees
- who pays: employee
- dependent age limit: to age 26
- eye exam: $10 copay
- frames: up to $130 plus 20% off balance
- standard plastic lenses: $25 copay
- elective contacts: up to $130 plus 15% off balance
- medically necessary contacts: covered in full
- frequency:
  - eye exam: once every 12 months
  - frames: once every 12 months
  - contacts: once every 12 months

Cost table:

- pay periods shown: 26 and 22
- tiers: Single, Employee + Spouse, Employee + Children, Family

OCR/text issues:

- Header extracted as `VVISION PLAN` / duplicated `ISION PLAN`.
- A stray `963` appears near the header.

### 14. Basic Life & AD&D

Page: 14

Classification:

- `benefit.life`
- `benefit.add`
- `employer_paid_benefit`

Carrier:

- Guardian appears in the benefit table.
- Header contains `[Vendor/Carrier Name]` placeholder.

Extracted benefits:

- eligibility: all eligible employees
- who pays: employer
- life benefit amount: 1x annual salary
- guarantee issue: $50,000
- age reduction:
  - age 65: reduced by 35%
  - age 70: reduced by 50%

Generator usage:

- Good Life/AD&D module template.

Important artifact:

- Text says Genesee Community Charter School pays full cost.
- Header contains `[Vendor/Carrier Name]`.
- Treat as template/stale content unless corroborated.

### 15. Long Term Disability

Page: 15

Classification:

- `benefit.ltd`
- `employer_paid_benefit`

Extracted benefits:

- eligibility: all eligible employees
- who pays: employer
- monthly benefit percentage: 60%
- monthly benefit amount: $4,000
- definition of disability: 24 months own occupation
- elimination period: 180 days
- maximum benefit duration: SSNRA
- pre-existing limitation: 3 months / 12 months

Generator usage:

- Good LTD module template.

Important artifact:

- Header contains `[Vendor/Carrier Name]`.
- Text says Genesee Community Charter School pays full cost.

### 16. Employee Assistance Program

Page: 16

Classification:

- `benefit.eap`

Extracted benefits:

- voluntary and confidential program
- assistance for employee and immediate dependent family members
- up to six face-to-face assessment and counseling sessions
- 24-hour toll-free access, 7 days/week
- staff are trained master’s/doctor-level professionals
- WorkLife services include childcare, elder care, health/wellness, emotional wellbeing, daily living, relocation, and community volunteering

Services/categories:

- depression, grief, loss, emotional wellbeing
- family/marital/relationship issues
- life improvement and goal setting
- addictions
- stress/anxiety
- financial/legal concerns
- identity theft/fraud resolution
- online will/legal document preparation

Contact:

- phone: 1-855-239-0743
- website: www.guardianresources.com
- web ID: Guardian

Generator usage:

- Strong EAP module template.

### 17. Voluntary Benefits

Page: 17

Classification:

- `benefit.voluntary`

Vendor:

- Colonial

Extracted benefit types:

- Accident
- Specified Disease
- Hospital Indemnity
- Voluntary Term Life
- Disability

Contact:

- Tony Mangione
- tony.mangione@coloniallifesales.com
- phone values: `(585)230-6633` and `(585) 704-8886`

OCR/text issues:

- Header includes stray text: `VISION B`, `PENEFITS`, `LAN`.
- Phone numbers are concatenated in extracted text.

Generator usage:

- Good voluntary/Aflac-style module template.
- Contact details should be parsed carefully.

### 18. Contact List

Page: 18

Classification:

- `contacts.carriers`
- `contacts.hr`
- `contacts.broker`

Carrier contacts:

- Excellus BCBS: 800-499-1275, www.excellusbcbs.com
- EyeMed: 866-800-5457, www.eyemed.com
- Guardian: 800-541-7846, www.guardiananytime.com
- EAP - ComPsych: 855-239-0743, www.guidanceresources.com

HR contact:

- Maureen Milke
- 585-697-1960
- mmilke@gccschool.org

Broker contacts:

- header exists, but no broker contact entries are filled in

Generator usage:

- Strong contact-list layout template.
- Carrier contacts may be reusable by carrier, but HR contact is not Flower City-specific unless corroborated.

Important artifact:

- HR email uses `gccschool.org`; this is likely stale GCCS content, not Flower City factual data.

### 19. Legal disclaimer

Page: 19

Classification:

- `legal.disclaimer`
- `legal.official_documents_prevail`
- `legal.hipaa_confidentiality`

Extracted concepts:

- guide is illustrative and based on employer-provided information
- text taken from SPDs and benefit summaries
- discrepancies/errors are possible
- official plan documents prevail
- information is confidential under HIPAA
- contact Human Resources with questions

Generator usage:

- Strong reusable legal disclaimer template.

## Detected benefit modules

This document includes examples for:

- Medical
- Telemedicine
- HRA
- FSA
- Dental
- Vision
- Basic Life & AD&D
- Long Term Disability
- EAP
- Voluntary Benefits
- Contacts
- Eligibility
- Open Enrollment
- Legal Notices

Not present as standalone modules:

- Short Term Disability
- HSA as a standalone account page

However, HSA is referenced through the HSA-qualified Bronze medical plan.

## Template/factual source classification

### Safe to use as template/style source

- Page order
- Cover layout
- Table of contents structure
- Welcome language
- Enrollment page pattern
- Eligibility/dependent/QLE page pattern
- Medical option page pattern
- Telemedicine module pattern
- HRA module pattern
- FSA module pattern
- Dental module pattern
- Vision module pattern
- Life/AD&D module pattern
- LTD module pattern
- EAP module pattern
- Voluntary benefits module pattern
- Contact list pattern
- Legal disclaimer pattern

### Safe to use as Flower City factual source only with caution

- Cover employer name
- Cover plan year
- Medical plan names/rates
- Dental/vision/life/LTD/EAP/voluntary module existence

Reason: internal text includes stale GCCS references, so employer-specific facts need corroboration.

### Not safe as factual source for Flower City without corroboration

- GCCS / Genesee Community Charter School references
- HR contact `Maureen Milke`
- HR email `mmilke@gccschool.org`
- `Jennifer Kelly` enrollment-return instruction
- `[Vendor/Carrier Name]`
- `[carrier website]`
- `Gold 21` in the HRA table

## Recommended machine classification labels

```json
{
  "documentType": "benefit_guide",
  "templateRole": "master_template",
  "employerOnCover": "Flower City Communications",
  "planYearLabel": "2025 Plan Year",
  "sectionOrder": [
    "cover",
    "table_of_contents",
    "welcome",
    "open_enrollment",
    "eligibility",
    "medical",
    "telemedicine",
    "hra",
    "fsa",
    "dental",
    "vision",
    "life_add",
    "ltd",
    "eap",
    "voluntary",
    "contacts",
    "legal"
  ],
  "benefitModules": [
    "medical",
    "telemedicine",
    "hra",
    "fsa",
    "dental",
    "vision",
    "life",
    "ltd",
    "eap",
    "voluntary"
  ],
  "warnings": [
    "Contains stale Genesee Community Charter School/GCCS references.",
    "Contains placeholder [Vendor/Carrier Name].",
    "Contains placeholder [carrier website].",
    "Contains OCR/text header artifacts on Telemedicine, Vision, and Voluntary pages.",
    "HR/contact details appear to belong to GCCS, not Flower City."
  ]
}
```
