# Report 03 — Superseded Baseline

This file records the earlier 12-test Report 03 baseline and is retained only as historical lineage.

**Current authority:** `event_runner/REPORT_03_R3.md`

Current R3 evidence:

- `event_runner/evidence/REPORT03_EXECUTION_RECEIPT_R3.json`
- `event_runner/evidence/REPORT03_STANDARDS_COMPARISON_R3.json`
- `event_runner/evidence/REPORT03_DEFICIENCY_MATRIX_R3.json`
- `event_runner/qualify_report03.mjs`

The R3 engineering pass adds durable ToT replay/causal sequence state, signed event envelopes, vector-clock coordinate state, conflict resolution that causally dominates both histories, tombstones, readback-verified Layer-2 reconciliation, rollback/quarantine semantics, runner-side revalidation and a chained evidence ledger.

Do not use the former 12-test result as the current qualification result. R3 observed 30/30 local fault/contract tests passing; distributed and external boundaries remain explicitly unproven in the R3 report.
