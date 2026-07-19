# Medical-insurance offering families

The five original public medical-plan examples are now organized by coherent
carrier, employer, or government-program offering. Each offering folder
contains every verified sibling option in scope, plus a `SOURCES.md` manifest
with official URLs, retrieval date, inclusion and exclusion rules, hashes, and
PDF verification results.

Prescription formularies and PBM support remain separate under
`prescription-and-pharmacy/`. Public availability does not transfer ownership;
retain source attribution.

## Offering inventory

| Offering folder | Complete option set represented | PDFs |
| --- | --- | ---: |
| `kaiser-permanente-ca-small-group-2025-hmo/` | Bronze 60, Silver 70, Gold 80, and Platinum 90 English base HMO, HDHP HMO, and HRA HMO designs in the same Kaiser-published small-group lineup | 15 |
| `healthfirst-ny-essential-plan-2026/` | Essential Plans 1, 2, 3, and 4 | 4 |
| `fcps-2026-medicare-retiree-medical/` | Aetna Medicare Advantage PPO ESA and Kaiser Permanente Medicare Advantage Group HMO | 2 |
| `bcbs-fep-service-benefit-plan-2026/` | FEP Blue Standard, Basic, and Focus | 2 |
| `university-of-rochester-2026-medical-plans/` | YOUR PPO and YOUR HSA-Eligible | 2 |

Total: 25 verified medical PDFs across five offering families.

## Important modeling rules

- Metal levels are plan tiers only when the official offering publishes them
  that way. Kaiser therefore has Bronze through Platinum files.
- Network levels, enrollment coverage levels, and employer contribution tiers
  are attributes inside a plan, not additional plan options.
- One authoritative document is stored once when it covers several options.
  The BCBS Standard/Basic brochure is not duplicated into two identical files.
- Different markets, employers, years, languages, rider variants, and product
  families are excluded unless the offering manifest explicitly includes them.
- Supporting forms and governing documents may have different subtypes (SBC,
  EOC, or program brochure); the manifest records the authority of each source.

See each offering folder’s `SOURCES.md` for the exact official lineup and
source-level verification.
