# Report 03 — ToT Safety, Distributed Coordinates and Layer-2 Reconciliation

## Scope
This report records the engineering introduced after the event-driven GitHub runner bridge. It distinguishes executable local mechanics from claims requiring an admitted external runner, multi-host transport, or production security review.

## Implemented layer
The ToT safety kernel is a fail-closed decision boundary over classified telemetry events. It checks event identity, replay, bounded observation time, expected input hash, explicit capability authority, and node READY state before returning ALLOW. It does not infer trust from network location.

The distributed coordinate directory maintains versioned node records containing logical, runtime, network, capability and health coordinates. Writes support compare-and-set version expectations. Merge accepts newer records and rejects equal-version conflicting hashes as coordinate equivocation. This is deterministic replicated-state machinery, not a claim of consensus.

The Layer-2 reconciler compares desired node state with observed node state and emits ordered REGISTER, RECONCILE or QUARANTINE_ORPHAN operations. Application captures before/result/after hashes, retries bounded transient failures and records permanent failures instead of manufacturing success.

## Falsification
The executable suite injects replay, hash mismatch, clock-window violation, stale directory writes, equal-version equivocation, transient adapter failure and permanent adapter failure. It also tests deterministic reconciliation planning.

## Evidence boundary
Advanced: executable safety decisions; deterministic event hashing; replay rejection; capability gating; coordinate CAS; equivocation detection; deterministic desired/observed planning; bounded retry; readback hashes; explicit failed receipts.

Unproven: multi-host convergence under partitions; Byzantine consensus; physical-host identity; GitHub runner admission; real Sheet trigger execution; production availability; external durability; hostile-runner isolation; global IL-LLM propagation. None is promoted by this report.

## Standards comparison
NIST SP 800-207 separates policy decision and enforcement and rejects implicit trust based on network location. ToT follows that direction by requiring explicit event/capability/node-state checks, but this implementation is not a claim of NIST conformance.

Kubernetes controllers reconcile desired and current state through control loops. Layer-2 uses the same broad reconciliation pattern while remaining a small KEX-specific controller rather than a Kubernetes implementation.

RFC 8785 defines a rigorous JSON Canonicalization Scheme for repeatable cryptographic operations. This implementation currently uses recursively sorted JSON keys before SHA-256. That is deterministic for the tested data domain but is NOT claimed RFC 8785 conformant, especially for complete ECMAScript number/string serialization edge cases.

GitHub documents that self-hosted runners must be running to accept work and recommends ephemeral runners for autoscaling/security-sensitive use. The existing persistent-runner design therefore needs a deployment policy decision: persistent runner for controlled trusted workloads, or ephemeral/JIT runners for stronger job isolation. GitHub also warns against exposing self-hosted runners to untrusted public-repository workflows.

## Executed qualification\n\nObserved execution on 2026-09-21 used Node's native test runner against the contract and fault-injection suites. Result: **12 tests, 12 passed, 0 failed**, observed duration **69.187373 ms**. The injected faults covered replay, hash mismatch, clock-window violation, stale coordinate writes, equal-version coordinate equivocation, transient adapter failure, and permanent adapter failure. The evidence receipt is stored at `event_runner/evidence/REPORT03_EXECUTION_RECEIPT.json`.\n\nThis execution proves the local mechanics under the tested process and fixtures. It does not convert the unproven distributed/external boundaries below into facts.\n\n## Observed conclusion
Report 03 advances the system from dispatch wiring to an executable local safety/reconciliation layer. Its strongest proven state is deterministic local execution with injected failure containment. Distributed and external claims remain bounded until independent multi-host and GitHub-runner evidence exists.
