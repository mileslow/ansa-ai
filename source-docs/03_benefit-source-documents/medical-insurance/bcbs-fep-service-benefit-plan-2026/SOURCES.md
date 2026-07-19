# BCBS Service Benefit Plan - FEHB 2026 options

Retrieved and verified on 2026-07-17.

## Offering scope

The 2026 Federal Employees Health Benefits Blue Cross and Blue Shield Service Benefit Plan has three plan options:

- FEP Blue Standard
- FEP Blue Basic
- FEP Blue Focus

OPM publishes Standard and Basic together in brochure RI 71-005 and publishes Blue Focus separately in brochure RI 71-017. This folder preserves that authoritative document structure.

### Inclusion and exclusion logic

- Included all three FEHB options: Standard, Basic, and Blue Focus.
- Retained a single Standard/Basic brochure because OPM's official document covers both options. Duplicating the same binary into separate option filenames would imply separate source documents that do not exist.
- Kept Blue Focus as its own file because OPM publishes it as a distinct brochure.
- Did not create separate PDFs for Self Only, Self Plus One, or Self and Family enrollment codes; those are enrollment tiers within each option, and their codes and rates are already in the official brochures.
- Excluded Postal Service Health Benefits versions because PSHB is a separate program and population from this FEHB offering.

## Official sources

- OPM Standard/Basic brochure page: <https://www.opm.gov/healthcare-insurance/healthcare/plan-information/plans/BrochureJson?brochureNumber=71-005&year=2026>
- OPM Standard/Basic brochure PDF (RI 71-005): <https://www.opm.gov/healthcare-insurance/healthcare/plan-information/plans/pdf/2026/brochures/71-005.pdf>
- OPM Blue Focus brochure page: <https://www.opm.gov/healthcare-insurance/healthcare/plan-information/plans/BrochureJson?brochureNumber=71-017&year=2026>
- OPM Blue Focus brochure PDF (RI 71-017): <https://www.opm.gov/healthcare-insurance/healthcare/plan-information/plans/pdf/2026/brochures/71-017.pdf>

## Local files and verification

### `fep-blue-standard-and-basic-options-brochure.pdf`

- Official title: `Blue Cross and Blue Shield Service Benefit Plan`
- Covered options: FEP Blue Standard and FEP Blue Basic
- OPM brochure number: RI 71-005
- PDF 1.7; 168 pages; 1,988,748 bytes
- SHA-256: `e5b371dbff81c71808da05fb2a4e2bad7b11c39bb3b49fdee1505c043111a7c1`
- Verification: `%PDF-` signature confirmed; `pdfinfo` opened the document; first-page text extraction identified 2026, Standard and Basic, FEHB eligibility, PPO structure, and the six option/enrollment codes. Page 1 was rendered with Poppler and visually checked; the title, option names, year, enrollment codes, OPM authorization, and RI number are intact and legible.

### `fep-blue-focus-option-brochure.pdf`

- Official title: `Blue Cross and Blue Shield Service Benefit Plan - FEP Blue Focus`
- Covered option: FEP Blue Focus
- OPM brochure number: RI 71-017
- PDF 1.7; 144 pages; 1,875,518 bytes
- SHA-256: `08109c847b02bd5c99e25501c8ca447fe951b770b231da5ad8bd215a3d23fc5b`
- Verification: `%PDF-` signature confirmed; `pdfinfo` opened the document; first-page text extraction identified 2026, FEP Blue Focus, FEHB eligibility, PPO structure, and enrollment codes 131, 133, and 132. Page 1 was rendered with Poppler and visually checked; the title, option name, year, codes, OPM authorization, and RI number are intact and legible.
