# Application and spreadsheet plan mismatch

Synthetic source package for Ansa document-scenario testing. Nothing in this
folder is valid for enrollment, insurance administration, or legal use. Plan
documents are copied from the repository source-document reservoir and renamed
for scenario readability.

## Expected behavior

- Builder should ask which uploaded rate row matches the selected medical plan.
- Email generator should ask the rate-row mismatch question instead of using the wrong rate.

## Files

- `00_completed-employer-application.pdf`
- `01_healthfirst-essential-plan-1.pdf` copied from `source-docs/03_benefit-source-documents/medical-insurance/healthfirst-ny-essential-plan-2026/essential-plan-1.pdf`
- `02_mismatched-rates.xlsx`

## Staged follow-ups

### Follow-up corrected rate workbook

- Reply with the corrected rate workbook attached. Use the Healthfirst Essential Plan 1 rate row for the selected medical plan.

Files live in `01_corrected-rate-workbook/`.

