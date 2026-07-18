# Public enrollment reference data

These are aggregate public datasets and negative/scale fixtures, not employer
current-enrollment exports.

- `01_cms_medicare_cpsc_enrollment_2026_07.zip`: large Medicare contract/plan/
  geography aggregates; about 34 MiB compressed and 171 MiB expanded.
- `02_cms_medicaid_managed_care_enrollment_2024.csv`: aggregate program/plan
  enrollment data.

They must never populate an employer's elections or offered plans. ZIP tests
must enforce expansion, entry-count, compression-ratio, and traversal limits.

