# Report 03 R3 — ToT Safety Kernel, Distributed Coordinate Directory and Layer-2 Reconciliation

**Observed execution date:** 21 September 2026  
**Repository baseline observed before R3 deployment:** `aboudykeddeh276-stack/KEDDEH_SOFTWARE_NODES` at `2f0621bd031213c21187383a27ad493f43cfad2f`  
**Evidence receipt:** `evidence/REPORT03_R3_EXECUTION_RECEIPT.json`  
**Engineering source root:** `316c62a52ceeaa2d951221ab9197e1fd24ace49eed99a6e88c3d8aa349ad2ecf`

## 1. Executive technical conclusion

Report 03 R3 is not a rearrangement of the earlier Report 03. The prior layer was inspected as executable code and then attacked at its state, identity, reconciliation and persistence boundaries. Four missing mechanics were identified and built:

1. **ToT admission was not cryptographically bound to the active policy revision or signing-key identity.** R3 adds `policy_id`, `policy_hash` and `key_id` to the signed event identity and fails closed on policy or key mismatch.
2. **The coordinate directory detected concurrent branches but could not resolve to a remote branch.** R3 retains both signed records and resolves an explicit choice by creating a new record whose vector dominates both prior branches.
3. **The Layer-2 reconciler had deterministic plans but no durable generation fence or durable idempotency history.** R3 persists generation→plan bindings and successful idempotency receipts, rejects stale generations and same-generation equivocation, and revalidates readback before treating a repeated operation as already satisfied.
4. **The file-lock stale-owner logic could remove a lock solely because it was old.** R3 checks whether the recorded PID is still alive and refuses to steal a live lock even after the stale interval. Dead stale locks remain recoverable.

The new layer was executed rather than inferred. The current R3 suite produced **17/17 passes**. Twenty additional full-suite repetitions produced **340/340 passes and zero failures**. A separate stress program completed **1,000 cross-process atomic increments**, retained and resolved **100 simultaneous coordinate conflicts**, applied **100 Layer-2 generations**, and rejected a stale generation.

The testing also falsified a material scalability assumption. The coordinate directory is not production-scale distributed storage. At 100 in-memory records it measured about 7,737 upserts/s; at 3,000 records it measured about 299 upserts/s. The 10,000-record qualification run exceeded 30 seconds. This degradation follows directly from the current monolithic state-clone/snapshot architecture. Therefore R3 proves substantially stronger local semantics, but it does not prove a scalable distributed directory.

The strongest justified claim is now:

> **A deterministic, non-Byzantine local control-plane kernel with signed policy-bound admission, crash-aware durable state, vector-clock conflict detection and executable resolution, generation-fenced/idempotent reconciliation, independent readback validation, and tamper-evident local evidence receipts.**

It is not yet justified to call the directory a production distributed database, the evidence ledger independently immutable, the system multi-host partition tolerant, or the environment zero-trust conformant.

## 2. Baseline inspection and defects actually found

### 2.1 Existing ToT safety kernel

The baseline already had valuable mechanics: bounded observation time, expiry, replay rejection, sequence rollback rejection, expected input hash checking, capability authorization, READY-state gating, HMAC event signatures and restart-persistent replay state. That baseline was not discarded.

The missing property was **policy identity binding**. An event could be correctly signed and still be evaluated under a different local policy context because the signed envelope did not prove which policy revision the emitter believed governed the event. R3 signs and verifies both `policy_id` and `policy_hash`, and binds decisions to a `key_id` as well as `authority_id`.

This matters because signature validity and authorization validity are different statements. A valid signature says the holder of a key authenticated the signed material. It does not, by itself, establish that the receiver applied the same authorization policy revision.

### 2.2 Existing coordinate directory

The baseline already had vector clocks, compare-and-set preconditions, record hashing, tombstones and concurrent-write detection. However, its `resolveConflict()` explicitly rejected selection of the remote branch with `REMOTE_RECORD_REQUIRED_FOR_RESOLUTION`. The conflict object retained hashes and vectors, not the complete remote candidate.

That meant conflict **detection** existed but conflict **closure** was incomplete.

R3 retains both complete branches in the conflict record. An explicit resolution chooses either branch and constructs a new locally signed descendant using a vector equal to the componentwise maximum of both branches plus a new local writer increment. The resulting vector was tested to dominate both parents.

### 2.3 Existing Layer-2 reconciler

The baseline correctly separated planning from application, produced deterministic idempotency keys, independently read back state after mutation, retried bounded failures and verified rollback when available.

Two distributed-control defects remained:

- `generation` was descriptive data rather than a durable fence. A stale plan could be applied by a newly created reconciler.
- idempotency keys were handed to the adapter but the reconciler did not persist its own record of successful application across restart.

R3 adds a durable journal containing `max_generation`, `generation_plan_hash`, and verified successful receipts by idempotency key. It rejects a generation older than the durable maximum and rejects a different plan hash reusing the same generation. A replayed idempotency key is not blindly skipped: current state is read again, and only a still-satisfied operation is returned as `IDEMPOTENT_REPLAY_VERIFIED`. If the environment drifted, the operation executes again.

### 2.4 Existing persistence lock

The baseline used exclusive lock-file creation and stale timeout recovery. The defect was that an operation legitimately lasting longer than the stale threshold could have its lock file removed by another process.

R3 records `{pid, token, created_at_ms}`. An old lock can be stolen only when its owner PID is not alive. Lock release also checks the random ownership token before unlinking the lock. Five concurrent processes executed 250 increments in the unit suite without lost updates; the stress run executed 1,000 increments without loss.

## 3. R3 executable architecture

The executed path is:

```text
Telemetry producer
  → canonical event payload
  → policy_id + policy_hash + authority_id + key_id
  → HMAC event signature
  → ToT safety decision
  → durable replay/sequence journal
  → ALLOW / DENY receipt

Coordinate writer
  → signed coordinate record
  → vector clock
  → compare-and-set
  → replica snapshot merge
  → dominates / dominated / equal / concurrent
  → retained concurrent branches
  → explicit resolution
  → new vector dominating both branches

Desired state + observed state
  → deterministic Layer-2 plan
  → generation fence
  → idempotency journal
  → optional ToT safety gate
  → adapter mutation
  → independent readback
  → verify / retry
  → rollback + rollback readback when possible
  → verified receipt or explicit failure/quarantine state

All control-plane events
  → append-only local evidence chain
  → hash-linked head
  → optional HMAC head seal
```

This is intentionally a **non-Byzantine** model. Participating writers are assumed not to maliciously collude or possess one another's signing keys. R3 detects accidental/stale/tampered state and rejects unknown signatures, but it does not implement Byzantine quorum consensus.

## 4. ToT safety kernel: what advanced

The R3 event identity contains source and sheet identity, event ID, monotonic sequence, observation and expiry time, node ID, authority ID, signing key ID, policy ID, policy hash, requested capability, input hash and HMAC signature.

Admission is fail-closed. An ALLOW requires:

1. event time within the configured observation window;
2. event not expired;
3. complete identity fields;
4. monotonic sequence for the authority;
5. no previously accepted replay key;
6. optional expected input hash match;
7. policy ID match;
8. policy hash match;
9. capability present in the receiver's authorization set;
10. node state exactly `READY`;
11. signing key resolved by `(authority_id,key_id)`;
12. valid event signature.

The resulting decision also records an `authorization_hash` over the admitted capability set and node state. This is evidence of which authorization context was used; it is not a claim that the authorization source itself is externally authoritative.

### Falsification results

Executed negative cases successfully rejected policy downgrade, unknown/rotated signing key, signature forgery, replay after process restart, sequence rollback after process restart, expired event, clock-window violation, unauthorized capability and non-READY node.

### Still unproven

The kernel does not have an enterprise PKI, remote KMS/HSM, revocation distribution service, certificate chain validation, hardware-backed keys, remote attestation, or independent policy-distribution authority. HMAC keys are supplied by the embedding process.

Therefore `authority_id` is a local trust mapping, not independently proven organizational identity.

## 5. Distributed coordinate directory: what advanced

Each record now contains logical/runtime/network/capability/health coordinates plus writer ID, vector clock, monotonically derived local version, tombstone state, SHA-256 record hash and HMAC writer signature.

Remote merges validate both record hashes and writer signatures. Vector comparison produces `DOMINATES`, `DOMINATED`, `EQUAL`, or `CONCURRENT`.

Equal vectors with different hashes are rejected as equivocation. Concurrent branches are retained in full. Resolution produces a new descendant with a vector dominating both parents.

### Falsification results

The suite established persistence across restart, remote signature tamper rejection, stale compare-and-set rejection, concurrent branch retention, selection of the remote branch during resolution, a resolved descendant that dominates both parent vectors, tombstone propagation, and 100 simultaneous conflicts retained and resolved in the stress harness.

### Scalability falsification

| Records | Coordinate upserts/s |
|---:|---:|
| 100 | 7,737.4 |
| 500 | 1,837.5 |
| 1,000 | 952.0 |
| 2,000 | 457.3 |
| 3,000 | 299.1 |
| 10,000 | qualification timed out beyond 30 s |

This curve is incompatible with a production claim of high-cardinality distributed-directory scalability. The current implementation clones or serializes monolithic directory state rather than storing independently addressable records in a write-ahead/log-structured or indexed key-value substrate.

That limitation is architectural, not linguistic and not solved by another status label.

## 6. Layer-2 reconciler: what advanced

### 6.1 Generation fencing

A generation is durably associated with one plan hash. An older generation is rejected as `STALE_GENERATION`. Reuse of the same generation with a different plan hash is rejected as `GENERATION_EQUIVOCATION`.

### 6.2 Restart-safe idempotency

A verified successful operation is persisted under its idempotency key. Following restart, the reconciler reads the destination again before returning `IDEMPOTENT_REPLAY_VERIFIED`. If the environment has drifted, the operation executes again. Therefore the journal cannot silently substitute historical success for current observed state.

### 6.3 Readback is authoritative over actuator acknowledgement

`adapter.apply()` returning success is not sufficient. The reconciler reads the destination and compares semantic state. A deliberately injected adapter that returned `{accepted:true}` while placing the node into the wrong state was detected on every attempt. R3 then invoked rollback, independently read the state again, and only marked the operation `ROLLED_BACK` when the original state was observed.

This implements:

```text
actuator response ≠ observed environmental mutation
```

The suite proved rejection or containment of stale generation, same-generation different-plan equivocation, transient failure, permanent failure, false-positive adapter acknowledgement, readback divergence, safety-gate denial and stale idempotency history after environmental drift.

## 7. Evidence layer

R3 preserves a local hash-linked JSONL evidence ledger and adds a separable HMAC seal over the current head. The seal is useful only when the sealing secret is kept outside the mutable ledger storage.

The tests showed that an intact chain verifies, mutation of an old event breaks chain verification, and substitution of the sealed head invalidates the HMAC seal.

This is stronger than an unsealed local hash chain but it is still **not independently immutable evidence**. An operator with both ledger write access and the HMAC sealing key can rewrite the entire ledger and produce a new valid seal. R3 therefore does not claim an external transparency log, independent timestamp, third-party notarization, or hardware-protected signing authority.

## 8. Executed qualification and observed evidence

### Primary suite

```text
17 tests
17 passed
0 failed
observed duration: 292.311346 ms
```

### Repetition

```text
20 complete repeated suites
340 aggregate test passes
0 aggregate failures
```

### Stress harness

```text
cross-process atomic increments:        1,000 / 1,000
coordinate conflicts retained/resolved: 100 / 100
Layer-2 generations applied:            100 / 100
stale generation rejection:             PASS
```

### Local benchmark

| Workload | 100 | 500 | 1,000 | 2,000 | 3,000 |
|---|---:|---:|---:|---:|---:|
| ToT decisions/s | 14,591 | 24,816.5 | 23,477.8 | 31,758.4 | 35,202.6 |
| coordinate upserts/s | 7,737.4 | 1,837.5 | 952.0 | 457.3 | 299.1 |
| reconcile-plan nodes/s | 11,348.1 | 44,452.1 | 71,021.2 | 113,585.7 | 137,129.2 |

These are local measurements from one Node.js process/container environment and are not portable production capacity claims.

## 8.1 Independent GitHub qualification observation

PR #5 was opened against the exact R3 branch head `7db3433963c9fe5d135405cfd4bad386aa2c002b`. GitHub created two workflow runs:

```text
Report 03 R3 Qualification
run: 35584964050
job: 106286054836
conclusion: failure
steps observed: 0

Existing Report 03 Engineering Qualification
run: 35584963938
job: 106286054522
conclusion: failure
steps observed: 0
```

Because both jobs were created but neither recorded a single step, this evidence does **not** show that the R3 syntax checks, Node tests, stress harness or benchmark failed in GitHub. It shows that GitHub did not execute those steps. The independent execution boundary therefore remains runner startup/execution. The local qualification remains valid as local evidence but is not promoted to GitHub-CI evidence.

## 9. Current standards and established-system comparison

### NIST SP 800-207 / SP 800-207A

NIST SP 800-207 separates policy decision and enforcement and rejects implicit trust based on network location. SP 800-207A further emphasizes service/application identity in cloud-native environments. R3 follows the same broad direction by making an explicit policy-bound admission decision before mutation and by refusing to infer trust from local placement.

R3 is **not NIST ZTA conformant**. It lacks the larger identity, policy-information, PKI, continuous-diagnostics, threat-intelligence and policy-enforcement ecosystem described by NIST.

References: https://csrc.nist.gov/pubs/sp/800/207/final and https://csrc.nist.gov/pubs/sp/800/207/a/final

### RFC 8785 — JSON Canonicalization Scheme

RFC 8785 exists because cryptographic hashes/signatures require invariant JSON representation. R3 recursively sorts object keys and rejects non-finite numbers. This is deterministic for the executed domain but is **not claimed RFC 8785/JCS conformant**. R3 does not implement the complete I-JSON constraints and exact ECMAScript serialization behavior required by JCS.

Reference: https://www.rfc-editor.org/rfc/rfc8785.html

### RFC 9421 — HTTP Message Signatures

RFC 9421 is an IETF Proposed Standard for signatures or MACs over HTTP message components and signature metadata. R3 signs an internal event envelope with HMAC-SHA256. It does not implement RFC 9421 signature bases, covered HTTP components, signature parameters or interoperable HTTP key-resolution semantics.

Reference: https://www.rfc-editor.org/info/rfc9421/

### Kubernetes controller pattern

Kubernetes controllers continuously compare desired state with current state and act to move current state toward desired state. R3 Layer-2 reconciliation is structurally comparable at that control-loop level. R3 is not a Kubernetes controller implementation and lacks Kubernetes' API server, watch/resource semantics, resource versions, controller-manager leader election, object schemas and ecosystem.

Reference: https://kubernetes.io/docs/concepts/architecture/controller/

### NIST SP 800-204A — Service-mesh security

SP 800-204A highlights secure service discovery, authentication/authorization, key management, encrypted service communication, resiliency and monitoring for distributed microservices. R3's signed directory records address only a narrow portion of that problem. There is no mTLS data plane, STS, mesh proxy layer, distributed key service, load balancer, circuit breaker or production service-discovery transport.

Reference: https://csrc.nist.gov/pubs/sp/800/204/a/final

### RFC 9162 — transparency-log evidence

RFC 9162 defines Merkle inclusion and consistency proofs over an append-only transparency log. R3 uses a linear hash chain plus an HMAC head seal. That detects local mutation when an earlier trusted head/seal exists, but it provides neither Merkle inclusion proofs nor independently witnessed consistency between tree heads.

Reference: https://www.rfc-editor.org/rfc/rfc9162.html

### GitHub runner security guidance

GitHub recommends ephemeral self-hosted runners for autoscaling/security-sensitive deployments and warns that persistent self-hosted runners do not provide clean-environment guarantees. Runner admission, isolation, job execution and external log retention therefore require observed evidence rather than workflow-file existence.

References: https://docs.github.com/en/actions/reference/runners/self-hosted-runners and https://docs.github.com/en/actions/reference/security/secure-use

## 10. What advanced versus what remains unproven

| Area | R3 observed advancement | Still unproven |
|---|---|---|
| ToT safety | signed policy/key binding, restart replay/sequence state, fail-closed capability/node gating | enterprise identity, PKI, revocation propagation, remote attestation |
| durable state | process lock ownership, live-lock theft prevention, atomic rename/fsync | cross-machine transactional durability, replicated WAL, filesystem/power-loss matrix |
| coordinates | signed records, vector clocks, conflict retention, executable resolution, tombstones | automatic network replication, membership, partitions, large-scale storage |
| Layer-2 | deterministic plan, generation fence, restart idempotency, readback, rollback | multi-controller lease/leader fencing across hosts, real adapters at scale |
| evidence | hash chain, signed head, tamper detection | external timestamp, independent witness, public/transparency consistency proof |
| performance | ToT/L2 local throughput measured; coordinate degradation characterized | production capacity, tail latency, multi-host throughput, long-duration soak |
| CI/runtime | local Node execution observed | externally admitted production runner and isolation until independent run completes |

## 11. WHY the remaining concepts remain unproven

### 11.1 Multi-host convergence under partitions

It remains unproven because every executed coordinate replica existed inside one local execution environment. Creating two objects with different writer IDs tests causal-state rules but does not create independent hosts, clocks, disks, network stacks or failure domains.

The missing proof requires packet transport between independently failing nodes and controlled partition/reordering/loss injection. Without that, vector-merge correctness is proven as a function, not as an operational distributed system.

### 11.2 Durable distributed identity

Writer IDs are authenticated with configured HMAC secrets. That proves knowledge of a configured symmetric secret, not physical machine identity or hardware provenance. No TPM, secure-enclave attestation, device certificate issuance, secure-boot measurement or remote-attestation verifier is present.

### 11.3 Strong consistency

R3 deliberately operates under a non-Byzantine, conflict-aware model. Vector clocks identify concurrent updates but do not themselves decide a single globally ordered winner. Conflict resolution currently requires an explicit selected record.

If application semantics require a single linearizable authoritative value, the architecture does not contain a replicated consensus log. If eventual convergence is acceptable, the architecture still lacks an automatic CRDT/merge policy for every coordinate field.

### 11.4 Independent evidence immutability

The evidence file and its seal are created in the same administrative environment. This is not independent witnessing. Independent immutability requires at least one authority outside the mutation domain of the process being evidenced.

### 11.5 Production-scale coordinate storage

The scalability benchmark falsified the current storage shape. Records are carried in one directory state object. Updating a growing object requires increasingly large clone/serialization work. No amount of terminology changes that computational property.

## 12. WHY the WHY remains unaddressed

The remaining gaps are not unaddressed because their algorithms are mysterious. They remain unaddressed because the **supporting execution substrates do not exist in the observed environment**.

- Partition tolerance cannot be observed without independent network endpoints and a transport plane.
- Hardware identity cannot be observed without a hardware root and attestation API.
- Independent evidence cannot be observed without an independent witness or transparency service.
- Distributed durability cannot be observed without separately failing storage replicas.
- Runner isolation cannot be observed without a successfully admitted runner executing the workload.
- Linearizable consistency cannot be observed without a quorum/consensus architecture and multiple independent replicas.
- Coordinate scale cannot be fixed by more tests while the directory remains a monolithic serialized object.

The absence is therefore architectural and environmental, not a missing sentence in the specification.

## 13. WHY the unaddressed unproven concepts remain

They remain because R3 stops where evidence stops. Promoting them would require invalid equivalences:

```text
multiple in-process objects        ≠ multiple independent hosts
vector clock                       ≠ consensus
HMAC writer ID                     ≠ hardware identity
local fsync                        ≠ replicated durability
hash chain                         ≠ independent immutable evidence
workflow YAML                      ≠ runner execution
adapter acknowledgement            ≠ observed mutation
local throughput                   ≠ production capacity
signed record                      ≠ secure transport
```

R3 does not make those substitutions.

## 14. Explicit missing architectures required to close each deficiency

### 14.1 Real distributed coordinate convergence

Not present:

- authenticated transport between directory replicas;
- node membership registry and join/leave protocol;
- failure detector/heartbeat semantics;
- anti-entropy or gossip scheduler;
- snapshot/delta transfer protocol;
- partition/reordering/duplication fault injector;
- per-record durable storage engine;
- compaction/tombstone-retention policy;
- automated conflict merge policy where human selection is not acceptable.

Required evidence after those architectures exist:

- independent hosts;
- controlled partitions;
- divergent writes on both sides;
- reconnection;
- convergence readback on every host;
- restart during reconciliation;
- tombstone resurrection tests;
- network duplication/reordering tests.

### 14.2 Strong single-value consistency, if required

Not present:

- leader/term model or equivalent;
- quorum membership;
- replicated log;
- election protocol;
- commit index;
- snapshot/log compaction;
- split-brain fencing;
- membership-change protocol.

A Raft/Paxos-family mechanism or another formally specified consensus architecture would be needed if the product requires linearizable authoritative state. It should not be added merely because “distributed” sounds grander; eventual convergence may be the correct contract for some node coordinates.

### 14.3 Production coordinate scale

Not present:

- per-key indexed persistence;
- WAL/log-structured update path;
- bounded-record read/write amplification;
- incremental snapshotting;
- background compaction;
- memory/index budget;
- backpressure;
- pagination/range queries;
- capacity/latency SLOs.

The observed 10,000-record timeout demonstrates why this layer is required.

### 14.4 Physical/runtime identity

Not present:

- device certificate provisioning;
- TPM/Secure Enclave key binding;
- measured boot evidence;
- attestation verifier;
- certificate/key rotation and revocation service;
- workload identity issuance;
- mapping from verified device/workload identity to KEX node identity.

### 14.5 Secure multi-host transport

Not present:

- mutually authenticated transport;
- certificate trust roots;
- peer authorization policy;
- replay-resistant session protocol;
- transport key rotation;
- network endpoint discovery;
- denial-of-service/backpressure controls.

### 14.6 Independent evidence

Not present:

- asymmetric signing key held outside the evidenced process;
- trusted timestamp source;
- independent append-only log or transparency service;
- inclusion proof;
- consistency proof;
- independent verifier/witness;
- retention and audit policy.

### 14.7 Production Layer-2 execution

Not present:

- real adapters for each authoritative external substrate;
- distributed lease/fencing ownership for multiple reconcilers;
- adapter-specific compensation contracts;
- per-target rate limiting and backpressure;
- dead-letter/quarantine operator workflow;
- change approval policy for destructive transitions;
- long-running operation recovery;
- production telemetry/SLO/error-budget system.

### 14.8 Runner qualification

Not present or not yet observed from the local execution:

- successfully admitted production runner for this exact source root;
- clean/ephemeral job environment evidence;
- external runner logs;
- runner identity binding;
- runner network policy;
- secrets isolation evidence.

## 15. Capability assessment after R3

### Proven local capability

R3 can now, inside the tested local trust domain:

- reject stale, replayed, forged, unauthorized or policy-mismatched control events;
- persist safety sequence/replay state across restart;
- serialize concurrent local writers without lost counter updates in the tested process model;
- create signed coordinate records;
- identify causal dominance and concurrency;
- retain both branches of a concurrent coordinate conflict;
- resolve either branch into a new record that dominates both parents;
- reject stale Layer-2 generations and generation reuse with divergent plans;
- carry verified idempotency through reconciler restart;
- distinguish actuator acknowledgement from environmental readback;
- roll back and verify rollback when the adapter provides compensation;
- produce hash-linked and head-sealed evidence.

### Not yet justified

R3 does not justify claims of unstoppable mesh persistence, Internet-scale directory performance, multi-region failover, Byzantine fault tolerance, linearizable consensus, hardware-rooted node identity, independently immutable evidence, formal RFC/NIST conformance, or production availability.

## 16. Final observed state

The missing engineering layer requested for Report 03 now exists and executes locally. It materially advances the prior code in safety-policy binding, process lock correctness, coordinate conflict closure, reconciliation fencing/idempotency, and evidence sealing. It also falsifies the strongest remaining scalability assumption in the coordinate directory.

The unresolved deficiencies are not represented as generic “future work”. They are tied to explicit absent architectures and explicit evidence that cannot be produced until those architectures exist.

```text
ToT safety semantics                 EXECUTED / FALSIFIED / PASS IN TESTED DOMAIN
local durable-state concurrency      EXECUTED / STRESS PASS
signed coordinate causal mechanics   EXECUTED / FALSIFIED / PASS
coordinate conflict resolution       EXECUTED / PASS
Layer-2 generation fencing           EXECUTED / PASS
Layer-2 restart idempotency           EXECUTED / PASS
readback/rollback verification       EXECUTED / PASS
local evidence chain + head seal     EXECUTED / TAMPER TEST PASS
multi-host transport/convergence     UNPROVEN — TRANSPORT/MEMBERSHIP ARCHITECTURE ABSENT
strong distributed consensus         UNPROVEN — CONSENSUS ARCHITECTURE ABSENT/NOT REQUIRED BY CURRENT NON-BYZANTINE CONTRACT
hardware identity                    UNPROVEN — ATTESTATION ARCHITECTURE ABSENT
external replicated durability       UNPROVEN — REPLICATED STORAGE ARCHITECTURE ABSENT
independent immutable evidence       UNPROVEN — EXTERNAL WITNESS/TRANSPARENCY ARCHITECTURE ABSENT
coordinate production scale          FALSIFIED AT CURRENT STORAGE SHAPE — PER-RECORD/WAL/KV ARCHITECTURE ABSENT
production runner execution          UNPROVEN — GITHUB JOBS CREATED BUT ZERO STEPS OBSERVED
```

That boundary is the result of execution, not prose rearrangement.
