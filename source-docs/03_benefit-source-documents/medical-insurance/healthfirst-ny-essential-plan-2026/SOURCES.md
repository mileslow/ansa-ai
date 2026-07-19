# Healthfirst New York Essential Plan options (2026)

Retrieved: 2026-07-17

## Scope

Healthfirst's official Essential Plans page presents four current 2026 tiers: Essential Plan 1, 2, 3, and 4. This folder contains the English Summary of Benefits and Coverage PDF for each of those four tiers.

Official lineup index: [Healthfirst Essential Plans](https://healthfirst.org/essential-plans)

Excluded on purpose:

- Essential Plan 200-250, because Healthfirst's current official page says it has ended and does not include it in the 2026 plan-document lineup.
- Spanish and Chinese translations, because they duplicate the four English plan designs.
- Formularies, member handbooks, subscriber contracts, Marketplace Leaf plans, Medicaid, and Medicare plans, because they are different document types or product families.

## Files and official sources

All PDFs are official Healthfirst-hosted English Summary of Benefits and Coverage documents. Byte counts and SHA-256 values describe the checked-in files.

| File | Official identifier | Pages | Bytes | SHA-256 | Official PDF |
| --- | --- | ---: | ---: | --- | --- |
| `essential-plan-1.pdf` | `HF-EP1-SBC-STD-26` | 8 | 571,602 | `b0d607ae71bd98c8417db79d56472e102852aeb4d39dbe9aba4da3220da981fe` | [source](https://assets.healthfirst.org/pdf_Y1Jq9o4B4fQd/2026-essential-plan-1-summary-of-benefits-english) |
| `essential-plan-2.pdf` | `HF-EP2-SBC-STD-26` | 9 | 571,210 | `0fd7804f29149b871779767baa7b02ec91aaeaac8dad26b35051f17b6661290e` | [source](https://assets.healthfirst.org/pdf_KiizOJmrn3qL/2026-essential-plan-2-summary-of-benefits-english) |
| `essential-plan-3.pdf` | `HF-EP3-SBC-STD-26` | 8 | 675,078 | `c8154dfb1cdfe6c03555ccdb9d4bb2d23158b902282d347469f2b64044ef9c14` | [source](https://assets.healthfirst.org/pdf_X18xY4mhK6T8/2026-essential-plan-3-summary-of-benefits-english) |
| `essential-plan-4.pdf` | `HF-EP4-SBC-STD-26` | 8 | 663,522 | `27eee405122576357064d45b69961601abfbc5d8cd54d4fb8ccfac0db4a7f8ba` | [source](https://assets.healthfirst.org/pdf_6IqSrm9wpECr/2026-essential-plan-4-summary-of-benefits-english) |

## Verification

- Healthfirst's asset responses contain 123 bytes of whitespace before the PDF header; confirmed `%PDF-` at byte offset 123 in all four files. The files were preserved byte-for-byte as served.
- `pdfinfo` opened every file without error and reported 8, 9, 8, and 8 pages respectively.
- `pdftotext` extracted each Essential Plan number, the `01/01/2026-12/31/2026` coverage period, and the official document identifier.
- Rendered page 1 of every PDF with `pdftoppm` at 110 DPI and visually inspected a contact sheet. Headers, tables, links, identifiers, and page boundaries were legible with no clipping, overlap, missing glyphs, or rendering defects.
- Re-downloaded the original Essential Plan 1 anchor PDF and compared it byte-for-byte with the relocated file; they were identical.
