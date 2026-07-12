# ansa

Benefit guide generator — one structure file → HTML → PDF.

## File

`2025-benefit-guide-structure.txt` — single master document containing:

1. **BROKER_CONFIG** — swap phones, emails, employer names, dates per client
2. **PAGE STRUCTURE** — all 19 pages with layout, copy, and plan tables
3. **Agent instructions** — how to generate print-ready HTML

An agent reads this file, replaces `[BROKER:key]` tokens from the config block,
and outputs HTML for PDF conversion in seconds.
