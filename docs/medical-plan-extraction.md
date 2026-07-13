# Medical plan extraction inventory

The extractor treats a plan as auditable structured data, not a short summary.
Fields that are not stated in the source remain `null` or `[]`; they are not
inferred. Every benefit row and material statement keeps source-page provenance.

## Document and plan identity

- Document type, carrier, plan/product name, plan and footer identifiers
- Group name, market, state, funding type, metal tier, and HSA eligibility
- Coverage start/end dates, covered population, plan type, and network name
- Source filename, Storage path, size, model, schema version, and timestamps

## Financial rules

- Individual, family, and embedded deductibles, periods, and family accumulation
- Services covered before the deductible and service-specific deductibles
- Individual, family, and embedded out-of-pocket limits and accumulation rules
- Premiums, balance billing, non-covered care, and other amounts excluded from the
  out-of-pocket limit

## Network and access

- Network use, network tiers, out-of-network availability, and emergency exceptions
- Referral requirements, provider directory, balance-billing language, and contacts
- Every phone number, email address, URL, organization, purpose, and appeal contact

## Medical benefits

Every distinct service or site-of-care row is retained with:

- Medical-event category and service name
- In-network and out-of-network cost shares by tier
- Copay, coinsurance, allowed-amount wording, and whether the deductible applies
- Facility versus professional charges and other site-of-care variations
- Preauthorization, visit/unit/day, age, frequency, and dollar limits
- Exceptions, footnotes, limitations, raw notes, and source page

## Prescription drugs

- Formulary URL, pharmacy network, retail and mail-order supply periods
- Every tier's name, description, retail/mail/out-of-network cost, and deductible rule
- Specialty pharmacy, prior authorization, step therapy, and other tier limitations

## Coverage boundaries

- Every stated exclusion and its qualifying notes
- Other covered services and their limitations
- Continuation, grievance, appeal, minimum-essential-coverage, minimum-value, and
  Marketplace statements
- Language-access messages and contacts
- Notices and warnings that do not fit a narrower benefit field

## Coverage examples and extraction quality

- Example scenario, assumptions, included services, total example cost, and member
  payments for deductible, copay, coinsurance, limits/exclusions, and total
- A page-by-page character transcript for audit and later reprocessing
- Source pages on structured groups and rows
- Extraction warnings for contradictions, ambiguity, or illegible source material

## Firestore layout

The structured object is stored as JSON in
`benefitsCompanies/{companyId}/plans/{planId}.attributes`. Small status and extraction
metadata live on the same document. Full page transcripts live in the `textPages`
subcollection, one page per document, which keeps long source text outside the main
Firestore document's 1 MiB limit. The original PDF remains in Firebase Storage.
