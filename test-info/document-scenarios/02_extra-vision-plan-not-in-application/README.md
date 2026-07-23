# Extra vision plan file not selected in application

Synthetic source package for Ansa document-scenario testing. Nothing in this
folder is valid for enrollment, insurance administration, or legal use. Plan
documents are copied from the repository source-document reservoir and renamed
for scenario readability.

## Expected behavior

- Builder should ask whether the uploaded vision benefit should be included.
- Email generator should ask for the same employer-selection confirmation.

## Files

- `00_completed-employer-application.pdf`
- `01_kaiser-silver-70-hmo-2500-55-pcp.pdf` copied from `source-docs/03_benefit-source-documents/medical-insurance/kaiser-permanente-ca-small-group-2025-hmo/silver-70-hmo-2500-55-pcp.pdf`
- `02_unselected-eyemed-bright-bold-healthy-options-summary.pdf` copied from `source-docs/03_benefit-source-documents/vision/eyemed-individual-family/bright-bold-healthy-options/summary-of-benefits.pdf`
- `03_rates-and-contributions.xlsx`

## Staged follow-ups

### Follow-up confirmation to omit accidental vision file

- Reply: No, do not include the vision benefit. The EyeMed file was attached accidentally and the employer only offers medical.
- planYear.start: 2026-01-01
- planYear.end: 2026-12-31

Files live in `01_confirm-vision-not-offered/`.

