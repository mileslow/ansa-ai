# Valuable rate and enrollment source additions

Status: 8 verified additions retained (2 proposals, 2 renewals, 2 synthetic employee-level enrollment exports, and 2 completed tier-count reports).

Retrieved: 2026-07-17

This pass intentionally kept only artifacts that contain the data shape implied by their folder. It did not add RFP instructions, blank quote forms, export specifications, generic guides, or population-level enrollment summaries. No existing `README.md` was edited.

## Inventory

| Bucket | Retained source | Subtype and useful variation |
| --- | --- | --- |
| Quotes and proposals | `01_city-of-gainesville_2026_standard-life-benefits-proposal.pdf` | Completed large-employer group life proposal: classes, benefit schedules, aggregate members/volume, rate, premium, guarantee, assumptions, and carrier boilerplate |
| Quotes and proposals | `02_burnet-county_2025-2026_alternate-medical-plan-proposal.pdf` | Completed medical/Rx alternate-plan proposal: current, renewal, and three alternatives across five coverage tiers |
| Renewal rates | `01_city-of-maumee_2026_health-insurance-renewal-summary.pdf` | Self-funded employer renewal analysis with prior-year premiums, enrollment counts, employer/employee shares, HSA funding, waivers, claims, and stop-loss context |
| Renewal rates | `02_city-of-northfield_2026_health-insurance-premium-renewal-rates.pdf` | Concise renewal contribution sheet across copay, HDHP/HSA, and high-value HSA plans for full-time/part-time employee and family coverage |
| Current enrollment exports | `02_ichra-connect_inbound-enrollment-sample.edi` | Official vendor synthetic X12 834, one physical line, 5010 envelope/member/coverage loops and explicit test placeholders |
| Current enrollment exports | `03_inteligenz_x12parser_dhcs-834-test-enrollment.txt` | Official vendor parser fixture, indented line-oriented X12 834 with BOM/CRLF and synthetic DHCS/ACME member data |
| Tier-count reports and analyses | `04_mclennan-county_2024-2025_membership-4-tier-report.pdf` | Completed 14-month medical enrollment report by four-tier coverage, subscriber status, and plan variation |
| Tier-count reports and analyses | `05_starr-county-memorial_2022-2025_enrollment-by-tier-and-month.xlsx` | Completed 32-month workbook by coverage tier and high/low plan, split across three worksheets |

## Provenance, verification, and test value

### 1. City of Gainesville — Standard life benefits proposal

- File: `source-docs/02_plan-and-rate-source/quotes-and-proposals/01_city-of-gainesville_2026_standard-life-benefits-proposal.pdf`
- Source: [City of Gainesville public meeting document](https://pub-cityofgainesville.escribemeetings.com/filestream.ashx?DocumentId=115212)
- Provenance: City public-meeting host; proposal prepared by The Standard for the City of Gainesville and presented by Gehring Group.
- Document facts: 35 pages; proposed effective date January 1, 2026; 3,602 aggregate members; $126,546,000 aggregate volume; rate of $0.495 per $1,000; $62,640 monthly premium; three-year rate guarantee.
- Test value: separates the small core quote/rate section from long product boilerplate; extracts benefit classes, schedules, rate units, aggregate census values, assumptions, compensation disclosure, dates, and parties.
- Verification: valid unencrypted PDF; text extracted; cover and cost page rendered without clipping; no embedded files or PDF JavaScript/launch markers found.
- Safety: no employee-level rows, names, IDs, contact details, or health data; only employer-level aggregates and public organization/carrier information.
- Size: 11,347,201 bytes.
- SHA-256: `c58a6c04d3605d09d2e94a60feacac49927b9dc22a340af74af8127686c3b5dd`

### 2. Burnet County — alternate medical plan proposal

- File: `source-docs/02_plan-and-rate-source/quotes-and-proposals/02_burnet-county_2025-2026_alternate-medical-plan-proposal.pdf`
- Source: page 95 extracted from the [official Burnet County June 10, 2025 agenda packet](https://public.destinyhosted.com/burnedocs/2025/ComCt/20250610_4520/AGENDApacket__06-10-25_0859_4519.pdf).
- Provenance: Burnet County public meeting record; Texas Association of Counties Health and Employee Benefits Pool proposal.
- Document facts: one page; current plan, renewal, and three alternative plans; five coverage tiers; medical deductible/coinsurance/OOP/visit fields; prescription copays; selected-plan text; blank signature line.
- Test value: side-by-side plan comparison, five-tier rates, current-versus-renewal-versus-alternative classification, missing cells (specialist visit), proposal assumptions, and selected-plan extraction.
- Verification: source packet was a valid 166-page PDF; the exact proposal page was extracted mechanically, text-extracted, and rendered; retained page is a valid unencrypted PDF with no embedded files or PDF JavaScript/launch markers.
- Safety: no signature or individual employee record; the page contains only employer/group data and a public business contact address.
- Size: 453,303 bytes.
- SHA-256: `1afe55fdc4ad483b62d0df4086236e0e5871cdf39e319065e1e652bde7c39d95`

### 3. City of Maumee — 2026 health insurance renewal summary

- File: `source-docs/02_plan-and-rate-source/renewal-rates/01_city-of-maumee_2026_health-insurance-renewal-summary.pdf`
- Source: [City of Maumee Document Center](https://www.maumee.org/DocumentCenter/View/1218/1-Health-Insurance-Renewal-Summary-PDF)
- Provenance: first-party municipal renewal analysis.
- Document facts: two pages; 2022–2026 employee premiums; current single/family enrollment; 2026 fixed cost and estimated claims; employer/employee shares; HSA contributions; waiver counts/stipends; projected new-hire cost; fund balance; employee survey; self-insured/stop-loss explanation.
- Test value: cross-year normalization, aggregate enrollment-to-cost calculations, HSA and waiver handling, self-funded terminology, narrative/table reconciliation, and potentially ambiguous labels such as “Monthly HSA Contribution.”
- Verification: valid two-page unencrypted PDF; text extracted; first page rendered cleanly; no embedded files or PDF JavaScript/launch markers.
- Safety: no employee names or member-level records. PDF metadata includes a public municipal document-author name.
- Size: 120,964 bytes.
- SHA-256: `9336ee9b96cc0aa6f921a0a29179b18f2edc617f6e20a87f7c24637982244356`

### 4. City of Northfield — 2026 health insurance premium renewal rates

- File: `source-docs/02_plan-and-rate-source/renewal-rates/02_city-of-northfield_2026_health-insurance-premium-renewal-rates.pdf`
- Source: [City of Northfield Legistar attachment](https://northfield.legistar.com/View.ashx?GUID=F1BF6C01-983D-4D1B-A7F8-C34106236E49&ID=14831114&M=F)
- Provenance: first-party city legislative attachment titled “2026 Health Insurance Premium Rates.”
- Document facts: one page; three medical designs ($500 copay, $3,300 HDHP HSA, and $5,000 HSA high-value); employee/family premiums; full-time and part-time city/employee contribution splits.
- Test value: nonstandard two-tier coverage, multiple HSA variants, employer/employee contribution reconciliation, full-time versus part-time splits, and compact rate-table extraction.
- Verification: valid one-page unencrypted PDF; text extracted and visually rendered; no embedded files or PDF JavaScript/launch markers.
- Safety: no names, member counts, IDs, or individual-level fields.
- Size: 90,828 bytes.
- SHA-256: `35c17c81c9d001a5c97618b9f0cc6a476b5095fca4d7246fb96f547c7db10a83`

### 5. ICHRA Connect/Oscar — inbound enrollment sample

- File: `source-docs/05_census-and-enrollment/current-enrollment-exports/02_ichra-connect_inbound-enrollment-sample.edi`
- Source documentation: [ICHRA Connect EDI sample-file downloads](https://ichra-connect.readme.io/docs/edi-sample-file-downloads)
- Direct source: [vendor-hosted sample 834](https://hioscar-enrollment-platform-assets.s3.us-east-1.amazonaws.com/sample_files/FROM_VENDOR.I834.D20241114.T125545.P.edi)
- Provenance: first-party ICHRA Connect/Oscar implementation documentation and vendor asset host.
- Document facts: 867 bytes; X12 005010X220A1; one transaction/member loop; 34 transaction-set segments; enrollment, plan, effective date, member, address, contact, and premium fields.
- Test value: delimiter-based parsing from a single physical line; envelope/control-number validation; member/coverage loop extraction; field normalization; synthetic-data recognition; prevention of accidental PII assertions.
- Verification: plain ASCII with no line terminator; envelope and `SE*34` control count inspected; member and coverage loops present.
- Safety: the public sample uses obvious synthetic/test placeholders (John Doe, test address, zero/sequence IDs). It must be treated as synthetic fixture data, not a real person.
- SHA-256: `ca8006959cfb874c7d4377ea613944753c6859f07771f1ac3203e937e40a0289`

### 6. Inteligenz X12Parser — DHCS-style 834 test enrollment

- File: `source-docs/05_census-and-enrollment/current-enrollment-exports/03_inteligenz_x12parser_dhcs-834-test-enrollment.txt`
- Source: [Inteligenz X12Parser official repository fixture](https://github.com/Inteligenz/X12Parser/blob/master/tests/OopFactory.X12.Tests.Unit/Parsing/_SampleEdiFiles/INS/_834/_5010/Dhcs_Example1.txt)
- Related documentation: [Parsing an 834 Transaction](https://github.com/Inteligenz/X12Parser/blob/master/docs/Parsing%20an%20834%20Transaction.md)
- Provenance: vendor/open-source project’s own unit-test corpus.
- Document facts: 1,208 bytes; UTF-8 BOM and CRLF; indented, line-oriented X12 005010X220A1; one member; 29 transaction-set segments; payer, carrier, member, address, demographic, health coverage, effective, and termination fields.
- Test value: BOM/whitespace normalization, line-oriented EDI parsing, X12 version handling, envelope/control validation, and comparison against the one-line Oscar shape.
- Verification: text encoding and line endings inspected; `ISA/GS/ST/BGN/QTY/INS/NM1/HD/SE/GE/IEA` structure present; `SE*29` control count inspected.
- Safety: uses explicit synthetic entities and placeholders (John Doe, Nowhere Lane, ACME Health Plan, sequence-number IDs); not production enrollment data.
- SHA-256: `9bc34825fcf0c88dc3b8d43f2cd6271710fbe3aa7cb263a534a7cfe65e984dbb`

### 7. McLennan County — membership four-tier report

- File: `source-docs/05_census-and-enrollment/tier-count-reports-and-analyses/04_mclennan-county_2024-2025_membership-4-tier-report.pdf`
- Source page: [McLennan County bid record](https://www.mclennan.gov/bids.aspx?bidID=268)
- Direct source: [McLennan County Document Center](https://www.mclennan.gov/DocumentCenter/View/17077)
- Provenance: official county procurement attachment.
- Document facts: one landscape page; January 2024 through February 2025; subscriber only/spouse/child(ren)/family; active, retiree-under-65, and COBRA; base and HDHP plan variations; monthly totals.
- Test value: very wide table reconstruction, multi-level headers, 14-period time series, subtotal validation, status-versus-plan grouping, and OCR/layout robustness.
- Verification: valid one-page unencrypted PDF; text extracted; landscape page rendered and values remained legible; no embedded files or PDF JavaScript/launch markers.
- Safety: aggregate counts only. PDF metadata contains a public creator username; no employee names or member identifiers appear in the report.
- Size: 61,029 bytes.
- SHA-256: `f811c55c5e4c1cff1201a98275142448a46b30282eccb2f8463e85c2043f9719`

### 8. Starr County Memorial Hospital — enrollment by tier and month

- File: `source-docs/05_census-and-enrollment/tier-count-reports-and-analyses/05_starr-county-memorial_2022-2025_enrollment-by-tier-and-month.xlsx`
- Source page: [Starr County Memorial Hospital public information/RFP page](https://www.starrcountyhospital.com/getpage.php?name=Public_Information_RFP&sub=About+SCMH)
- Direct source: [official workbook](https://www.starrcountyhospital.com/docs/Copy_of_SCMH_Enrollment_by_Tier_and_Month_Oct_2022_May_2025_07012025.xlsx)
- Provenance: official hospital procurement attachment.
- Document facts: three visible worksheets (`A1:E85`, `A1:E85`, `A1:E61`); October 2022 through May 2025; medical subscriber-month counts by single/spouse/dependent(s)/family and high/low plan.
- Test value: multi-sheet aggregation, repeated section headers, blank-cell handling, month normalization, plan/tier subtotals, and a useful internal inconsistency: the third sheet tab says “Oct 2024 - Feb 2025” while its title/data continue through May 2025.
- Verification: genuine XLSX; sheet/range/cell values read with the project’s XLSX library; Quick Look rendered the first sheet clearly; 1,035 nonempty cells; zero formulas, hyperlinks, or comments; all sheets visible; no VBA, external links, connections, ActiveX, OLE objects, or embedded files detected.
- Safety: aggregate tier counts only; no employee-level rows, names, IDs, dates of birth, or contact information.
- Size: 42,779 bytes.
- SHA-256: `2f1ca1be0e9f019e75edb30a677cdbc3d07462b9081afddd3d04594d9052a441`

## Privacy and execution safety

- No retained rate, proposal, renewal, or tier-count artifact contains employee/member-level records.
- The two employee-level 834 examples are public, explicitly synthetic test fixtures. Their placeholder identities must never be promoted to factual people during tests.
- All retained PDFs are unencrypted and have no embedded files. Static scans found no PDF JavaScript, launch actions, or embedded-file markers.
- The retained XLSX has no macros, formulas, external links, comments, hidden worksheets, or embedded objects.
- Public business contacts and document-author/creator metadata may remain in first-party public records; there is no private employee enrollment data.

## Rejected candidates and remaining coverage gap

- Rejected and removed: the former Kennion proposal URL now returns an HTML homepage rather than the indexed PDF.
- Rejected and removed: Oscar’s `outbound_reconcilliation_spec.csv` is a field specification with example values, not a populated current-enrollment export.
- Rejected: a 2026 Washington County “alternate plan proposal” page whose rate table was blank.
- Remaining diversity gap: both safe employee-level export additions are X12 834 fixtures. A populated first-party CSV/XLSX benefits-admin export that is both genuinely representative and demonstrably synthetic/deidentified was not found. The collection should not fill that gap with a schema/specification or with real employee data.
