# Report 03 R2 — Observed Engineering, Falsification and Deficiency Architecture

## Executive finding

Report 03 R2 records executable engineering, not a design wishlist. The estate contains executable ToT safety decisions, deterministic telemetry identity, a versioned coordinate directory, Layer-2 desired/observed reconciliation, fault injection, a local durable hash-linked reconciliation journal, and a quorum-gated coordinate commit primitive.

The quorum primitive advances the previous single-directory implementation by proving that a configured minority cannot commit and unknown acknowledgers cannot manufacture quorum. It does not prove distributed consensus because all replicas are still represented inside one process and no authenticated transport, leader/term protocol, replicated durable log or partition harness exists.

The durable journal advances persistence evidence by append, fsync, reopen, chain verification and tamper detection. It does not prove power-loss durability, torn-write behavior, cross-host replication or disaster recovery.

## Executed architecture

TELEMETRY -> CLASSIFY/HASH -> ToT SAFETY -> COORDINATE STATE -> QUORUM GATE -> L2 PLAN -> BEFORE READ -> APPLY -> AFTER READ -> HASHED RECEIPT -> DURABLE JOURNAL.

ToT rejects stale clock windows, replay, missing identity, expected-hash mismatch, unauthorized capability and non-READY node state. The coordinate directory supplies compare-and-set updates, deterministic snapshots and equal-version equivocation rejection. The quorum layer accepts acknowledgements only from configured members and requires a declared majority. Layer-2 deterministically produces REGISTER, RECONCILE and QUARANTINE_ORPHAN operations, retries transient adapter failure within a fixed bound, and records FAILED after exhaustion. The journal chains sequence, previous hash, event and entry hash, fsyncs the descriptor, verifies after reopen and detects content tampering.

## Falsification

The combined suite covers deterministic classification, canonical capability projection, malformed telemetry, authorized ToT passage, replay, hash mismatch, clock-window violation, stale coordinate CAS, equal-version equivocation, deterministic reconciliation planning, transient adapter failure, permanent adapter failure, minority quorum, unknown-member quorum forgery, majority quorum, journal reopen and journal tampering.

Passing these tests proves only these mechanics under the executed local Node.js process and fixtures.

## What advanced

Multi-host convergence moved from absent toward PARTIALLY_ADVANCED because a quorum commit rule now exists and minority/unknown-member acknowledgements are falsified. Actual distribution remains absent.

External durability moved to PARTIALLY_ADVANCED because reconciliation evidence now has fsync-backed append, reopen verification and tamper detection. Crash/power-loss and replicated-storage evidence remain absent.

The original ToT, coordinate and Layer-2 layers remain locally executable and fault tested.

## Remaining claims, causal reasons, missing architecture and promotion evidence

### Multi-host convergence under partitions
UNPROVEN/PARTIALLY_ADVANCED. No test used three independent processes on independently failure-prone hosts joined by a transport capable of delay, loss, duplication, reordering and partition. Quorum arithmetic is not a distributed protocol.

The cause remains unaddressed because the estate lacks an admitted replica transport, membership/change protocol, ordering term/leader mechanism, durable replicated log and network fault harness.

Missing architecture: authenticated replica transport; membership/reconfiguration; leader/term or equivalent ordering; replicated durable log; snapshot/install; partition/latency/loss harness; replica restart/rejoin.

Promotion evidence: >=3 independent replicas; majority/minority partition; heal/convergence; duplicate/reorder/loss; restart during commit; stale leader; membership change; final state-root equality.

### Byzantine tolerance
UNPROVEN. The quorum layer assumes configured members report honestly. It does not authenticate votes or tolerate malicious replicas producing conflicting histories.

The cause remains unaddressed because there is no replica key authority, signed proposal/vote protocol, Byzantine quorum certificate, view change, adversarial replica harness or evidence propagation/quarantine.

Missing architecture: cryptographic replica identity; signed messages; declared n/f model; Byzantine quorum certificates; view change; equivocation proof; key rotation/revocation.

Promotion evidence: forged-vote rejection; double-vote detection; malicious leader; conflicting proposal; view change; recovery at the declared maximum Byzantine fault count.

### Physical host identity
UNPROVEN. Logical node IDs and runner labels are copyable strings.

The cause remains unaddressed because hardware-backed identity is not part of node admission.

Missing architecture: TPM/Secure Enclave or equivalent key; attestation verifier; freshness challenge; host-node binding; rotation/revocation.

Promotion evidence: fresh attestation; cloned logical ID rejection; revoked host rejection; legitimate host rotation accepted and ledgered.

### GitHub runner admission
EXTERNAL_BOUNDARY. Repository source cannot prove a target machine is registered, online and executing jobs.

The cause remains unaddressed because GitHub registration/JIT credentials and target-host execution are external authority state.

Missing architecture: admitted runner host; registration/JIT flow; runner health readback; isolation policy; external log sink; credential lifecycle.

Promotion evidence: GitHub reports runner online; labeled job executes; receipt returns; restart/reconnect; credential revocation; isolation cleanup.

### Google Sheet trigger
EXTERNAL_BOUNDARY. UrlFetchApp source does not prove an installable trigger is bound and authorized on a real spreadsheet.

The cause remains unaddressed because Apps Script project identity, trigger binding, OAuth grant and Script Properties are external account state.

Missing architecture: bound script project; installable trigger; Script Properties; reachable TLS ingress; retry/delivery ledger.

Promotion evidence: real edit; observed HTTP delivery; dispatcher receipt; duplicate/retry behavior; revoked/incorrect authority rejection.

### External durability
PARTIALLY_ADVANCED. fsync/reopen/tamper tests are stronger than memory-only state but do not establish survival across power loss or device failure.

The cause remains unaddressed because no declared production volume, crash harness, replicated journal, backup authority or independent restore target is connected.

Missing architecture: durable-volume contract; crash/power-loss harness; replicated persistence; backup/restore; cross-replica head reconciliation.

Promotion evidence: kill boundaries; reboot; torn-write simulation; disk-full behavior; backup restore; replica head agreement.

### Global IL-LLM propagation
UNPROVEN. Report 03 execution does not publish a validated relation delta into a versioned global IL-LLM authority and observe a subscriber applying it.

The cause remains unaddressed because node events and global relationship authority are not joined by a canonical publisher/subscriber contract.

Missing architecture: versioned global relation store; eligibility gate; publisher; subscriber; delta ACK ledger; conflict/version resolution; restart catch-up.

Promotion evidence: validated publish; relevant subscription; ACK/readback; stale-version rejection; conflict test; restart catch-up.

### RFC 8785/JCS conformance
UNPROVEN. Recursively sorting JavaScript object keys is not the complete JSON Canonicalization Scheme.

The cause remains unaddressed because stableHash targeted deterministic internal fixtures rather than standards interoperability.

Missing architecture: conforming JCS serializer or vetted dependency; I-JSON validator; conformance vectors; cross-language vectors.

Promotion evidence: RFC vectors; IEEE-754 edge cases; Unicode/string cases; duplicate-key rejection at ingestion; equal hashes in independent implementations.

### Production runner isolation
UNPROVEN. A persistent self-hosted runner can retain state between jobs.

The cause remains unaddressed because no ephemeral/JIT lifecycle controller, per-job isolation boundary, secret broker, egress policy, external logs or image provenance layer is installed.

Missing architecture: ephemeral/JIT controller; isolated execution image; secret broker; network policy; external log sink; image/update lifecycle.

Promotion evidence: one-job runner destruction; no workspace/credential persistence; containment test; log preservation; image digest/provenance; revoked secret cannot be reused.

## Standards comparison

NIST SP 800-207 and 800-207A reject implicit trust based solely on network location and move policy toward resource/service identities. ToT follows that direction through explicit identity, integrity, capability authority and node state. No NIST conformance claim is made.

Kubernetes controllers compare desired and current state and act toward desired state. Layer-2 uses that broad control-loop pattern, but it is a KEX-specific reconciler and does not possess the mature Kubernetes API-server, informer/work-queue and etcd architecture.

RFC 8785 provides a canonical JSON representation for repeatable cryptographic operations. Current KEX hashing is deterministic over the tested fixture domain but is not yet JCS conformant.

GitHub documents self-hosted runners as operator-managed execution environments and recommends ephemeral runners for autoscaling. Persistence should therefore live in controller state and durable evidence where isolation matters, rather than relying on dirty per-job worker state.

## Deficiency map and final classification

The machine-readable matrix is event_runner/evidence/REPORT03_R2_DEFICIENCY_MATRIX.json. Every unresolved claim records its evidence state, immediate reason, why that reason remains unaddressed, missing architecture and exact evidence required for promotion.

PROVEN_LOCAL: ToT decisions; deterministic telemetry hashing for tested data; replay/hash/clock/capability/node-state rejection; coordinate CAS; equal-version equivocation detection; deterministic L2 plan; bounded retry/failure receipt; local fsync journal append/reopen/tamper detection; local quorum membership/majority rules.

PARTIALLY_ADVANCED: distributed coordinate commit semantics; external durability semantics.

UNPROVEN: Byzantine tolerance; physical host identity; multi-host convergence; global IL-LLM propagation; RFC 8785 conformance; production runner isolation.

EXTERNAL_BOUNDARY: live GitHub runner admission and live Google Sheet trigger execution until external authority and target execution are admitted and read back.

No unresolved item is promoted merely because its missing architecture is now named.
