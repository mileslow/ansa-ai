# Application only progressive intake

Synthetic source package for Ansa document-scenario testing. Nothing in this
folder is valid for enrollment, insurance administration, or legal use. Plan
documents are copied from the repository source-document reservoir and renamed
for scenario readability.

## Expected behavior

- Builder should ask for selected current plans.
- After a selected-plan answer, builder should continue and ask for any remaining source-backed details instead of failing.

## Files

- `00_completed-employer-application.pdf`

## Staged follow-ups

### Follow-up selected medical plan source pack

- Reply with the selected current plan: Medical: Healthfirst Essential Plan 2 - Healthfirst.
- Attach the plan document and rates from this folder so the agent can continue the booklet intake.

Files live in `01_selected-medical-plan-source-pack/`.

