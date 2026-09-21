# KEX Event Runner / Report 03 Control Plane

This directory implements the resident event path and the Report 03 safety/reconciliation layer.

## Active execution path

```text
Google Sheet telemetry
→ monotonic source sequence
→ dispatcher classification
→ authority-bound HMAC envelope
→ durable ToT safety admission
→ GitHub repository_dispatch
→ runner-side safety revalidation
→ canonical capability execution
→ Layer-2 desired/observed reconciliation
→ post-state readback
→ rollback or quarantine on divergence
→ coordinate update
→ hash-chained evidence
```

## Main components

- `src/contract.mjs` — classified event contract, hashing, signatures.
- `src/durable_state.mjs` — local atomic JSON/JSONL persistence.
- `src/tot_safety_kernel.mjs` — replay, sequence, gap, time, expiry, capability, readiness and signature gates.
- `src/coordinate_directory.mjs` — persistent vector-clock coordinates, conflict quarantine/resolution and tombstones.
- `src/layer2_reconciler.mjs` — deterministic plan, idempotency, mutation, readback, retry, rollback and quarantine.
- `src/evidence_receipt.mjs` — Report 03 receipts and chained evidence ledger.
- `src/report03_control_plane.mjs` — integrated safety/directory/reconciliation/evidence control plane.
- `runner/validate_event.mjs` — independent runner-side event validation.
- `qualify_report03.mjs` — resident qualification actuator.
- `REPORT_03_R3.md` — current full technical report.

## Qualification

Run:

```bash
npm test
npm run qualify
```

The resident qualifier performs syntax checks, the contract/fault suite, source hashing and chained evidence emission.

## Required dispatcher environment

```text
GITHUB_TOKEN
KEX_TARGET_REPOSITORY
KEX_INGRESS_SECRET
KEX_EVENT_SIGNING_SECRET
KEX_INGRESS_AUTHORITY_ID
KEX_NODE_STATE=READY
KEX_SAFETY_STATE_PATH
```

The dispatcher binds to `127.0.0.1`; an external ingress needs a separately governed reverse proxy/tunnel/edge.

## Required runner environment

```text
KEX_EVENT_SIGNING_SECRET
KEX_INGRESS_AUTHORITY_ID
KEX_NODE_STATE=READY
KEX_RUNNER_SAFETY_STATE_PATH
```

## Security boundary

Do not interpret an admitted telemetry event as permission to execute arbitrary shell commands. Dispatch payloads carry canonical capability references.

The repository is currently public. GitHub's current guidance warns that self-hosted runners should almost never be used for public repositories and recommends ephemeral runners for autoscaling/security-sensitive use. A persistent self-hosted runner attached to this public repository is therefore **not production-qualified** by this code.

Production closure requires a private/restricted execution boundary or equivalent runner-access controls, ephemeral/JIT runner provisioning, clean-image destruction after each job, externally preserved runner logs, short-lived secrets and network isolation.

## Evidence boundary

Current local R3 qualification proves the tested local mechanics. It does not prove:

- multi-host convergence under real partitions;
- consensus;
- distributed locking/fencing;
- live network-device actuation;
- RFC 8785 or RFC 9421 conformance;
- YANG/NMDA/NETCONF/RESTCONF operation;
- live GitHub runner execution;
- live Google Sheet trigger execution;
- physical-host attestation;
- production availability.

See `REPORT_03_R3.md` and `evidence/REPORT03_DEFICIENCY_MATRIX_R3.json` for the causal closure requirements.
