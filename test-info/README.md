# Northstar Fabrication 2026 synthetic booklet test package

This folder contains a complete, fictional input set and the booklet generated from it by Ansa's real `employee_booklet` pipeline. Nothing here is valid for enrollment or insurance administration.

## Offered benefits

- Medical: 2026 SimplyBlue Plus Bronze 4, Silver 19, and Gold 6
- Dental: 2026 Delta Dental Basic Family PPO Plan I and Enhanced Family PPO Plan III
- No other benefits or spending accounts are offered

## Package contents

- `01_employer-setup/`: completed synthetic employer application with plan year, eligibility, enrollment instructions, contacts, selections, and contribution rules
- `02_rates-and-contributions/`: formula-driven Excel workbook containing premiums, employer costs, employee monthly costs, 26-pay-period deductions, enrollment counts, and annual totals
- `03_plan-documents/`: five synthetic plan summaries with the material benefit terms used by the generator
- `04_generated-booklet/`: final employee booklet, source HTML, and pipeline audit metadata

## Calculation rules

Medical receives a flat $75.00 monthly employer contribution for every plan and tier. Basic dental receives a flat $23.00 monthly credit and Enhanced dental receives $31.70, each equal to 50% of that option's employee-only premium. Per-pay deductions use `(monthly premium − employer monthly contribution) × 12 ÷ 26`.

## Provenance

The selected Excellus plan names, IDs, design values, and base rates were aligned to the local 2026 Q1 Excellus rate inventory. Dental option names and benefit percentages were aligned to the local Delta Dental Basic Family PPO Plan I and Enhanced Family PPO Plan III source policies. Dental rates, employer contributions, enrollment counts, employer identity, and contacts are explicitly synthetic.
