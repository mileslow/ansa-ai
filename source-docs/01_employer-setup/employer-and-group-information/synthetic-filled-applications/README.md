# Synthetic filled employer application fixture

This folder contains one deliberately fictional, completed employer benefits application for document-classification and field-extraction tests.

## Files

- `01_northstar-fabrication_2026-synthetic-filled-employer-benefits-application.pdf` is the three-page test document.
- `extraction-answer-key.json` contains the values an extractor should return and visible decoy values it must ignore.
- The generator is `scripts/generate_synthetic_filled_employer_benefits_application.py`.

## Safety

Every company, person, plan, ID, address, rate, contact, and signature is invented. Emails use `.test`, phone numbers use the reserved-looking `555-01xx` pattern, IDs are visibly synthetic, and every PDF page says `SYNTHETIC / NOT A REAL EMPLOYER`.

This fixture is not an application, policy, enrollment, legal agreement, or source of production benefit facts.

## How to test extraction

1. Extract fields from the PDF.
2. Compare the result with `expected` in the answer key.
3. Confirm no entry in `must_not_extract` was accepted as the completed value for its named field.
4. Preserve checked versus unchecked state. An option that appears in the document is not necessarily selected.

The decoys are intentionally plausible. They include example IDs, rejected dates, an unchecked medical plan, an unchecked voluntary plan, an illustrative HRA amount, and example contacts.

## Regenerate and verify

From the repository root:

```bash
uv run --with reportlab python scripts/generate_synthetic_filled_employer_benefits_application.py
pdfinfo source-docs/01_employer-setup/employer-and-group-information/synthetic-filled-applications/01_northstar-fabrication_2026-synthetic-filled-employer-benefits-application.pdf
pdftotext -layout source-docs/01_employer-setup/employer-and-group-information/synthetic-filled-applications/01_northstar-fabrication_2026-synthetic-filled-employer-benefits-application.pdf -
```

Render all pages with Poppler and inspect them before changing the fixture:

```bash
mkdir -p tmp/pdfs/northstar-synthetic-application
pdftoppm -png -r 150 source-docs/01_employer-setup/employer-and-group-information/synthetic-filled-applications/01_northstar-fabrication_2026-synthetic-filled-employer-benefits-application.pdf tmp/pdfs/northstar-synthetic-application/page
```
