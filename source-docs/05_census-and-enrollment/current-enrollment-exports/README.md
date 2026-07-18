# Current enrollment exports

Only actual member-level employer/program exports belong here.

- `01_washington-hca_benefits247-sample-enrollment-export.txt` is an official
  synthetic pipe-delimited enrollment export containing documented lifecycle
  scenarios. It is not a file-layout guide or aggregate public statistic.
- `02_ichra-connect_inbound-enrollment-sample.edi` is an official vendor
  synthetic, single-line X12 834 with member and coverage loops.
- `03_inteligenz_x12parser_dhcs-834-test-enrollment.txt` is a second synthetic
  X12 834 shape with a BOM, CRLF, indentation, effective and termination data.

The bucket still lacks a populated first-party CSV/XLSX benefits-admin export
that is demonstrably synthetic or de-identified. Do not fill that gap with a
field specification or real employee data.
