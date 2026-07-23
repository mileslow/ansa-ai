# HSA selected in application but no HSA form attached

Synthetic source package for Ansa document-scenario testing. Nothing in this
folder is valid for enrollment, insurance administration, or legal use. Plan
documents are copied from the repository source-document reservoir and renamed
for scenario readability.

## Expected behavior

- Builder should ask for HSA source materials or account administrator details.
- Email generator should ask the same HSA follow-up instead of omitting the selected HSA.

## Files

- `00_completed-employer-application.pdf`
- `01_rochester-your-hsa-eligible-option-sbc.pdf` copied from `source-docs/03_benefit-source-documents/medical-insurance/university-of-rochester-2026-medical-plans/your-hsa-eligible-option-sbc.pdf`
- `02_rates-and-contributions.xlsx`

## Staged follow-ups

### Follow-up HSA account source details

- Reply with the attached HSA account source details. Include the HSA in the booklet.
- HSA administrator/custodian: Optum Bank.
- Employer HSA contribution: $500 annually for employee-only HDHP coverage and $1,000 annually for family HDHP coverage, funded in equal quarterly installments.

Files live in `01_hsa-account-source-details/`.

