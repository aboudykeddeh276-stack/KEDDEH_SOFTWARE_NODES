# Report 03 R3 — Executed ToT Safety Kernel, Distributed Coordinate Directory, Layer-2 Reconciliation and Residual Architecture Analysis

**Repository:** `aboudykeddeh276-stack/KEDDEH_SOFTWARE_NODES`  
**System area:** `event_runner`  
**Evidence run:** `REPORT03-OBSERVED-20260921T1850-AU`  
**Report state:** `LOCAL_ENGINEERING_LAYER_QUALIFIED_EXTERNAL_DISTRIBUTED_CLOSURE_UNPROVEN`

## 1. Purpose and evidence rule

This report is not a restatement of an architecture proposal. It records the engineering that was actually added to the existing `event_runner`, the faults that were deliberately injected, the observed execution results, the external evidence that was checked, and the exact boundary between implemented mechanics and unproven distributed or production claims.

The evidence rule used throughout is strict:

1. source existing in a repository proves source existence;
2. local execution proves the mechanics executed under that local process, filesystem and fixture set;
3. a readback proves the observed post-state for the tested adapter;
4. a GitHub workflow file proves workflow configuration, not job execution;
5. a distributed claim requires independent hosts and actual transport;
6. a production claim requires production-state observation, failure/recovery evidence and an operational authority boundary.

No item is promoted by architectural intent alone.

## 2. Engineering baseline before R3

The prior Report 03 layer already contained four real components:

- a ToT safety kernel that checked clock window, replay within one process, input hash, capability authority and node READY state;
- a coordinate directory with scalar versions, compare-and-set writes and equal-version equivocation rejection;
- a Layer-2 reconciler that generated deterministic REGISTER, RECONCILE and QUARANTINE_ORPHAN operations and retried adapter failures;
- a per-run evidence hash.

The earlier local qualification had executed 12 tests successfully.

The manual falsification review found that those components were not yet sufficient for the stronger claim implied by a distributed control layer.

The deficiencies were concrete:

- replay memory disappeared with the process;
- two processes using the same authority could race without one durable serialization point;
- there was no monotonic source sequence and therefore no positive detection of dropped events;
- event authority was not cryptographically bound beyond the ingress shared secret;
- coordinate state was memory-only;
- scalar version comparison was inadequate for independently writing replicas;
- deletion had no tombstone propagation;
- a successful adapter call could be labelled APPLIED even if post-readback diverged from desired state;
- rollback was not verified;
- evidence hashes were not chained;
- the GitHub runner independently trusted the repository-dispatch payload after the dispatcher had admitted it.

Those faults were the engineering target for R3.

## 3. Implemented R3 execution path

The resulting execution path is:

```text
Google Sheet edit
    ↓
Apps Script monotonic sequence allocation
    ↓
classified telemetry event
    ↓
dispatcher-bound authority identity
    ↓
HMAC event-envelope signature
    ↓
ToT safety decision
    ├─ identity
    ├─ time window
    ├─ expiry
    ├─ capability
    ├─ node readiness
    ├─ durable replay
    ├─ sequence rollback
    ├─ sequence gap
    ├─ input hash
    └─ signature
    ↓ ALLOW only
GitHub repository_dispatch
    ↓
self-hosted runner
    ↓
independent runner-side signature/hash/sequence/ToT validation
    ↓
canonical capability execution boundary
    ↓
Layer-2 desired / observed reconciler
    ↓
adapter mutation
    ↓
readback verification
    ├─ match → APPLIED_VERIFIED
    └─ mismatch/failure → retry → rollback → quarantine-required
    ↓
coordinate/evidence update
    ↓
hash-chained evidence ledger
```

The important difference is that transport no longer constitutes authority. The same event is admitted before dispatch and independently revalidated at the execution boundary.

## 4. ToT safety kernel R3

### 4.1 Added durable safety state

`src/durable_state.mjs` provides the local durability primitive used by the safety journal and coordinate directory.

It implements:

- exclusive local lock-file acquisition;
- stale lock cleanup;
- bounded lock wait;
- temporary-file write;
- file `fsync`;
- atomic rename;
- parent-directory `fsync`;
- append-and-`fsync` JSONL writes.

This is a local crash-consistency and process-serialization mechanism. It is not described as a distributed lock and does not provide cross-host fencing.

### 4.2 Durable replay protection

The previous in-memory replay map is now persisted in `kex.tot-safety-journal.v2`.

Replay identity is scoped by:

```text
authority_id + event_id
```

The journal also records the highest accepted sequence per authority.

The restart falsification creates one kernel, admits an event, reconstructs a second kernel from the same journal and attempts the same event again. The second kernel returns `DENY / REPLAY_REJECTED`.

A separate shared-journal race test creates two kernels from the same initial journal state. The first admits the event. The stale second process reaches the durable transaction later and returns a structured deny rather than raising an unhandled race exception.

### 4.3 Causal sequence enforcement

The event contract now requires a positive integer `sequence`.

The safety kernel rejects:

- `sequence <= previous` as `SEQUENCE_ROLLBACK_REJECTED`;
- `sequence > previous + 1`, after a baseline exists, as `SEQUENCE_GAP_DETECTED`.

This changes missing-source-event behavior from silent acceptance to explicit blocked state.

It does not, by itself, reconstruct the missing event. Resynchronization remains a separate architecture requirement documented later in this report.

### 4.4 Time and expiry

The kernel checks both:

- bounded observed-time skew;
- explicit `expires_at`.

An event can therefore be denied because it is outside the accepted observation window or because its own validity interval has elapsed.

### 4.5 Event authentication

The dispatcher binds `authority_id` from its own configuration rather than accepting an arbitrary authority name from the submitted body.

It signs a canonical internal safety payload with HMAC-SHA256. The signed fields include:

- event ID;
- input hash;
- authority ID;
- sequence;
- observation time;
- expiry time;
- node ID;
- capability.

The runner performs the same verification again after repository dispatch.

This is a real integrity and shared-secret authentication mechanism. It is not RFC 9421 HTTP Message Signatures and is not represented as host attestation.

## 5. Distributed coordinate directory R3

### 5.1 Persistent records

Coordinate records are now persisted and carry:

- `node_id`;
- `writer_id`;
- logical coordinate;
- runtime coordinate;
- network coordinate;
- sorted capabilities;
- health;
- tombstone state;
- vector clock;
- local version;
- record hash.

### 5.2 Vector causality

Remote/local records are classified as:

- `DOMINATES`;
- `DOMINATED`;
- `EQUAL`;
- `CONCURRENT`.

This fixes a weakness in the original scalar-version approach. Two independently writing replicas can now be recognized as concurrent even when neither has a numerically “newer” authoritative history.

### 5.3 Conflict quarantine

Concurrent records are not automatically overwritten.

The directory stores both candidate records and their vector clocks in the conflict state and raises `COORDINATE_CONCURRENT_CONFLICT`.

Equal vector clocks with different record hashes are treated separately as `COORDINATE_EQUIVOCATION`.

### 5.4 Conflict resolution

The first R3 hardening pass could quarantine a conflict but could not lawfully choose the remote candidate because it stored only the remote hash. That was falsified during the same engineering pass and corrected.

The directory now stores full local and remote conflict candidates.

When an operator/policy chooses one candidate:

1. the chosen payload is selected;
2. both vector clocks are combined using component-wise maximum;
3. the resolving writer increments its own vector component;
4. a new record is generated;
5. the new record carries `resolution_of=[local_hash, remote_hash]`;
6. the conflict is cleared.

The resulting record causally dominates both histories. A test then merges that resolved record into the other replica and verifies both replicas converge on the new hash.

### 5.5 Tombstones

Removal generates a versioned/vector-clocked tombstone rather than physically forgetting the node immediately.

A dominating tombstone is propagated and the receiving directory returns no live node while retaining the tombstone for causal history.

Safe distributed tombstone garbage collection remains unimplemented because it requires knowledge that every relevant replica has advanced beyond the deletion.

## 6. Layer-2 reconciler R3

### 6.1 Desired and observed state

The reconciler explicitly distinguishes desired state from observed state.

The comparison removes only known ephemeral fields such as timestamps, proof roots and writer/vector metadata. It then builds deterministic operations ordered by node ID.

### 6.2 Operation identity

Every operation receives a deterministic idempotency key derived from:

- operation type;
- node payload;
- generation;
- relevant observed state.

Equivalent plans produce equivalent operation IDs.

### 6.3 Apply is not success

This is one of the most material changes in R3.

An adapter returning without exception is no longer evidence of convergence.

For each operation the reconciler:

1. reads pre-state;
2. invokes the optional safety gate;
3. applies the operation;
4. reads post-state;
5. verifies the post-state against the desired operation;
6. records `APPLIED_VERIFIED` only if that verification succeeds.

The injected divergent-readback test deliberately makes `adapter.apply()` report success while leaving the node in the wrong state. The reconciler refuses to promote the operation.

### 6.4 Retry, rollback and quarantine

Transient failures are retried up to the configured bound.

After repeated failure or divergence:

- if the adapter supports rollback, rollback is invoked;
- the rollback itself is read back and verified;
- successful rollback produces `ROLLED_BACK`;
- failure without a verified rollback produces `FAILED_QUARANTINE_REQUIRED`.

Orphan quarantine is also verified through observed state rather than assumed from a successful function call.

### 6.5 Safety gate

The reconciler accepts a safety gate before mutation.

The fault test supplies a gate returning `DENY` and verifies that `adapter.apply` is never called.

This is the point at which KEX authority/ToT policy can be placed immediately before a state mutation rather than only at initial ingress.

## 7. Evidence subsystem R3

The old evidence object was a standalone hash.

R3 adds an append-only JSONL chain:

```text
entry[n].previous_receipt_hash = entry[n-1].receipt_hash
entry[n].receipt_hash = SHA256(canonical(entry[n] without receipt_hash))
```

The verifier checks:

- monotonic sequence;
- previous-root continuity;
- current-entry hash.

Fault injection modifies an earlier ledger entry and the verifier reports failure.

This provides local tamper evidence relative to a trusted head. It is not externally immutable. Rewriting the entire local chain and every local reference remains possible to an attacker with complete filesystem control. That limitation is preserved in the deficiency matrix rather than magically upgraded by the word “ledger.”

## 8. Ingress and runner enforcement

### 8.1 Apps Script

`TelemetryDispatch.gs` now allocates a sequence using `LockService.getScriptLock()` and a Script Property counter.

Each event includes:

- UUID event ID;
- monotonic sequence;
- observation timestamp;
- five-minute expiry;
- Sheet and range delta;
- node ID;
- capability.

The script still needs a deployed project, Script Properties and a real installed trigger before this can be considered a live source.

### 8.2 Dispatcher

The dispatcher now fails closed unless:

- ingress secret exists and matches;
- the configured node state is `READY`;
- the event contract is valid;
- the internal signed event passes ToT admission.

Only then is `repository_dispatch` attempted.

### 8.3 Runner boundary

`runner/validate_event.mjs` independently validates:

- command reference;
- authority ID;
- signing secret;
- event signature;
- recomputed event input hash;
- replay;
- causal sequence;
- node READY state.

Observed local runner-boundary execution:

- first signed event: `VALIDATED`, exit 0;
- exact replay: `BLOCKED`, exit 2;
- denial reasons included `REPLAY_REJECTED` and `SEQUENCE_ROLLBACK_REJECTED`.

This proves the runner validation program under the local execution environment. It does not prove that GitHub delivered a job to a real self-hosted runner.

## 9. Executed qualification

The final R3 fault suite executed under Node v22.16.0 on Linux x64.

Observed result:

```text
tests:       30
passed:      30
failed:      0
duration:    86.628458 ms
```

The suite includes positive and negative cases for:

- deterministic classification;
- canonical dispatch;
- missing identity;
- sequence validation;
- signature verification and tamper;
- authorized ToT admission;
- replay after restart;
- shared-journal stale-reader race;
- sequence rollback;
- sequence gap;
- signature forgery;
- input-hash mismatch;
- event expiry;
- clock-window rejection;
- non-ready node;
- coordinate persistence;
- stale compare-and-set;
- concurrent-writer conflict;
- conflict resolution producing a causally dominating record;
- equal-vector equivocation;
- remote snapshot tamper;
- tombstone propagation;
- deterministic reconciliation planning;
- deterministic idempotency;
- transient failure retry;
- divergent readback falsification;
- verified rollback;
- permanent failure containment;
- orphan quarantine verification;
- mutation safety-gate denial;
- evidence-ledger tamper detection;
- integrated control-plane evidence emission.

The execution receipt is:

`event_runner/evidence/REPORT03_EXECUTION_RECEIPT_R3.json`

Receipt hash:

`1461df1568047ffaa2b5accf110f7f373761ce078347e69396ad73d0568a9845`

The execution was a clean resident-equivalent mirrored run because this sandbox could not clone/download the repository through its outbound GitHub DNS path. The report therefore does not claim byte-for-byte execution of GitHub blobs. Repository blob SHAs were independently read back through the GitHub connector and recorded in the receipt.

## 10. GitHub execution evidence

After the qualification workflow was changed to call the same resident actuator via `npm run qualify`, the latest observed GitHub Actions state remained:

### Report 03 qualification

```text
run_id:       35584786860
conclusion:   failure
job_id:       106285498732
executed steps observed: 0
```

### Telemetry runner

```text
run_id:       35584785745
conclusion:   failure
jobs observed: 0
```

The correct interpretation is not “the 30 tests fail in GitHub.”

The correct interpretation is that the external Actions/runner execution plane did not reach the test or telemetry execution steps.

That boundary remains unproven.

## 11. Current standards comparison

The machine-readable comparison is stored at:

`event_runner/evidence/REPORT03_STANDARDS_COMPARISON_R3.json`

### 11.1 NIST SP 800-207

The R3 design directionally follows zero-trust separation between policy decision/enforcement and resource access:

- location does not imply trust;
- explicit capability and node state are checked;
- an execution boundary enforces the decision again.

This is not a NIST conformance claim. There is no complete enterprise identity/policy decision service or continuous trust-context engine.

### 11.2 RFC 8342 NMDA

RFC 8342 distinguishes intended configuration from operational state.

R3 now has a real desired-vs-observed loop and refuses to infer convergence from an attempted mutation.

However, it does not implement NMDA:

- no YANG datastore;
- no `<running>`, `<intended>` or `<operational>` protocol datastores;
- no YANG validation engine.

### 11.3 RFC 8345 topology

RFC 8345 defines generic YANG network topology using nodes, links and termination points.

The coordinate directory provides node-oriented logical/runtime/network coordinates, but lacks:

- formal YANG topology;
- link model;
- termination points;
- supporting underlay/overlay topology relationships.

### 11.4 RFC 6241 NETCONF

NETCONF provides standard configuration operations, locks and confirmed-commit semantics.

R3 has local analogues:

- pre-read;
- bounded apply;
- post-read;
- rollback.

It does not implement NETCONF confirmed commit or candidate/lock semantics. A generic JavaScript adapter is not a network transaction protocol.

### 11.5 RFC 8785 JSON Canonicalization Scheme

R3 recursively sorts object keys before JSON serialization.

That is sufficient for deterministic hashes over the tested domain, but it is explicitly not RFC 8785 conformance.

Missing elements include I-JSON constraints and complete prescribed primitive serialization behavior.

### 11.6 RFC 9421 HTTP Message Signatures

R3 signs an internal event envelope using HMAC.

RFC 9421 defines signatures/MACs over selected HTTP message components and standardized `Signature-Input` and `Signature` fields.

R3 does not implement those fields or their signature-base rules. Therefore its event HMAC must not be labelled an RFC 9421 implementation.

### 11.7 RFC 8641 YANG-Push

R3 now detects event sequence gaps.

RFC 8641 goes further by defining incomplete-update signaling and resynchronization behavior.

R3 has no standardized subscription or full-resync transaction. Gap detection therefore produces an explicit stop condition, not automatic recovery.

### 11.8 GitHub self-hosted runners

GitHub currently recommends ephemeral self-hosted runners for autoscaling and states that persistent autoscaling is not recommended. GitHub also warns that self-hosted runners should almost never be used for public repositories because workflow code can persistently compromise the machine.

The present repository is public and the telemetry workflow names a self-hosted runner.

This is not a theoretical documentation difference. It is a production-security blocker until the execution trust topology is changed.

## 12. What advanced in R3

The following capabilities advanced from architectural or weak-local state into executed local mechanics:

### ToT

- replay survives process restart;
- stale-reader races fail closed;
- event sequence is monotonic per authority;
- missing sequence is detected;
- expiry is enforced;
- event HMAC is verified;
- policy is independently re-evaluated on the runner.

### Coordinates

- directory persists locally;
- writes support hash/version preconditions;
- vector clocks identify causal dominance;
- concurrent histories are quarantined;
- both conflict candidates are retained;
- a resolution record causally dominates both histories;
- remote snapshot tampering is detected;
- deletion propagates as a tombstone.

### Layer 2

- plan identity is deterministic;
- operation idempotency keys are stable;
- successful function return is insufficient;
- post-state must match desired state;
- transient failures retry;
- divergent success is falsified;
- rollback is read back;
- uncontained failure becomes quarantine-required;
- safety can stop mutation before the adapter executes.

### Evidence

- evidence is chained;
- tampering is detected;
- source hashes and boundaries are emitted by a resident qualifier;
- local and external execution evidence are reported separately.

Those are engineering advances, not renamed intentions.

## 13. What remains unproven, why, why the reason remains unresolved, and the missing architecture

The complete machine-readable causal matrix is:

`event_runner/evidence/REPORT03_DEFICIENCY_MATRIX_R3.json`

The principal residuals are summarized below.

### 13.1 Multi-host partition convergence

**Unproven:** replicas converging after a real network partition and rejoin.

**Why:** all executed replicas were objects/processes in one Linux environment. No two physical or virtual admitted hosts exchanged directory state over a real network fault.

**Why that why is unresolved:** the coordinate directory exposes `merge(snapshot)`, but there is no resident distributed sync service.

**Why the concept remains:** vector clocks only become distributed evidence once independently evolving replicas exchange their histories.

**Architecture not present:**

- authenticated peer membership;
- coordinate replication transport;
- anti-entropy scheduler;
- peer sync cursors;
- failure detector;
- partition/rejoin harness;
- multi-host receipts.

### 13.2 Consensus

**Unproven and not claimed:** global ordered consensus under crash or Byzantine failures.

**Why:** vector clocks detect ordering/concurrency but do not elect leaders, create quorums or replicate an ordered log.

**Why unresolved:** no consensus architecture was introduced.

**Architecture not present:**

- explicit fault model;
- quorum membership;
- Raft/Paxos if crash-fault consensus is required;
- BFT protocol only if Byzantine tolerance is actually required;
- term/epoch fencing;
- replicated log;
- snapshots and membership changes.

The coordinate directory should not be relabelled “consensus.” That would merely make the report less accurate.

### 13.3 Distributed serialization/durability

**Partial only:** local atomic persistence.

**Why unproven:** a local lock file and atomic rename cannot fence another host.

**Why unresolved:** there is no replicated metadata or lease service.

**Architecture not present:**

- consensus-backed metadata store or equivalent;
- distributed leases;
- fencing tokens;
- replicated recovery journal;
- disk/corruption/restore testing.

### 13.4 Real network-device actuation

**Unproven:** actual Layer-2/route/device convergence.

**Why:** the reconciler executes against an adapter interface and fault fixtures, not a real switch/router/FRR/Linux networking target.

**Why unresolved:** no standards/device adapter is bound.

**Architecture not present:**

- YANG models;
- NMDA datastore;
- NETCONF/RESTCONF/gNMI or explicit FRR/Linux adapters;
- capability discovery;
- candidate/lock/confirmed-commit mapping;
- multi-device transaction coordinator;
- real readback normalizer.

### 13.5 Ingress cryptographic protocol

**Partial:** shared secret plus internal HMAC.

**Why not standards-proven:** the HTTP request itself is not protected using RFC 9421 semantics.

**Why unresolved:** no HTTP Message Signature implementation/key lifecycle exists.

**Architecture not present:**

- TLS edge contract;
- RFC 9421 signing/verifying or another explicitly specified end-to-end request protocol;
- Content-Digest;
- key IDs/algorithms;
- key rotation and revocation;
- distinct ingress-auth and event-signing keys.

### 13.6 RFC 8785 interoperability

**Unproven:** cross-language canonical JSON cryptographic equality.

**Why:** current canonicalization is sorted JavaScript JSON, not full JCS.

**Why unresolved:** no JCS implementation/conformance suite.

**Architecture not present:**

- JCS canonicalizer;
- I-JSON validator;
- RFC vectors;
- JS/Python/Swift cross-language hashing tests.

### 13.7 Event gap recovery

**Advanced but incomplete:** gaps are now detected.

**Why recovery remains unproven:** detection does not reconstruct lost source state.

**Why unresolved:** source and consumer have no full-resync protocol.

**Architecture not present:**

- authoritative snapshot endpoint;
- source checkpoint;
- incomplete-update signal;
- resync request/response;
- replay journal or full-state replacement;
- acknowledgement and safe sequence restart.

### 13.8 GitHub execution plane

**Unproven:** GitHub executing the qualification and telemetry jobs.

**Why:** latest observed runs never reached workflow steps.

**Why unresolved:** failure occurs in the external runner/allocation plane rather than the tested JavaScript layer.

**Architecture not present/operational:**

- functioning qualification-runner allocation;
- healthy admitted self-hosted telemetry runner;
- runner heartbeat;
- external runner logs;
- runner health/readiness receipt.

### 13.9 Public-repository self-hosted-runner security

**Production blocker.**

**Why:** GitHub's current security guidance warns against self-hosted runners for public repositories, while this repository is public and the workflow targets self-hosted execution.

**Why unresolved:** the trust topology and persistent-runner installer have not changed.

**Architecture not present:**

- private execution repository or restricted execution boundary;
- ephemeral/JIT runner provisioning;
- runner groups/workflow allowlists;
- immutable runner image;
- destroy-after-job lifecycle;
- short-lived secret broker;
- network sandbox;
- external log sink.

ToT event validation does not solve arbitrary workflow-code compromise. They are different threat planes.

### 13.10 Live Sheet trigger

**Unproven:** real Google Sheet event reaching the dispatcher and runner.

**Why:** source code exists; no deployed trigger receipt has been observed.

**Why unresolved:** Apps Script project deployment, properties, trigger binding and reachable ingress are external bindings.

**Architecture/operations not present in evidence:**

- deployed script version;
- installed trigger;
- Script Properties receipt;
- reachable ingress;
- end-to-end correlation receipt;
- source retry/dead-letter behavior.

### 13.11 Physical-host identity

**Unproven:** that the intended physical host executed an operation.

**Why:** a software authority and HMAC secret are not hardware identity.

**Why unresolved:** this event path has no attestation binding.

**Architecture not present:**

- host admission;
- per-host key/certificate;
- resident-root challenge;
- optional TPM/Secure Enclave attestation;
- revocation/rotation;
- mapping from GitHub runner identity to admitted BRAINK host.

### 13.12 Evidence external immutability

**Partial:** locally tamper-evident.

**Why not immutable:** a fully compromised local host can rewrite the chain and local head.

**Why unresolved:** there is no independent witness.

**Architecture not present:**

- WORM/object-lock storage;
- external checkpoint witness;
- signed periodic roots;
- cross-host root replication;
- recovery comparison against independent witnesses.

### 13.13 Production availability

**Unproven.**

**Why:** 30 local fault tests do not exercise host disappearance, real network impairment, dependency outage, disk exhaustion or production failover.

**Why unresolved:** there is no deployed multi-host service/SLO/failover system in this evidence set.

**Architecture not present:**

- multiple live hosts;
- service supervision;
- health/freshness telemetry;
- failover routing;
- backup/restore;
- chaos network tests;
- defined SLI/SLO;
- RTO/RPO;
- measured recovery receipts.

## 14. Architectural separation of the remaining deficiencies

The remaining deficiencies are not one amorphous “more testing required” bucket.

They belong to different missing architecture classes.

### A. Distributed-systems substrate

Missing:

- peer membership;
- anti-entropy;
- cross-host transport;
- failure detection;
- distributed serialization/fencing;
- optional consensus.

Without this class, multi-host convergence cannot be proven.

### B. Network-management substrate

Missing:

- YANG models;
- NMDA datastores;
- concrete NETCONF/RESTCONF/gNMI/FRR/Linux actuators;
- device transactions and readback normalization.

Without this class, Layer-2 remains a proven controller core, not a proven network-device controller.

### C. Trust/identity substrate

Missing:

- request-level cryptographic protocol;
- key lifecycle;
- host identity;
- attestation;
- runner identity mapping.

Without this class, shared-key software authority cannot be promoted into machine identity.

### D. Execution substrate

Missing or not operating:

- healthy GitHub qualification runner;
- admitted telemetry self-hosted runner;
- safe runner lifecycle;
- public/private trust policy;
- clean execution images and external logs.

Without this class, repository-dispatch execution remains external and unproven.

### E. Source-ingress/resynchronization substrate

Missing:

- live Apps Script deployment evidence;
- source event journal/snapshot;
- gap recovery;
- dead-letter and replay.

Without this class, gap detection can stop corruption but cannot restore continuity.

### F. Evidence-witness substrate

Missing:

- independent ledger root witness;
- immutable retention;
- cross-host checkpoint.

Without this class, the ledger is locally tamper-evident but not externally anchored.

### G. Production operations substrate

Missing:

- multi-host service deployment;
- observability;
- SLOs;
- failover;
- disaster recovery;
- chaos qualification.

Without this class, production availability remains a claim outside the evidence envelope.

## 15. Final observed result

R3 advances the system materially.

It is no longer merely:

```text
event
→ dispatch
→ attempted mutation
```

The observed local mechanics are now:

```text
source sequence
→ classified hash
→ authority-bound signature
→ durable ToT admission
→ runner-side re-admission
→ causal coordinate state
→ desired/observed Layer-2 reconciliation
→ verified readback
→ verified rollback / quarantine
→ chained evidence
```

The strongest defensible qualification is:

```text
LOCAL ENGINEERING LAYER:
QUALIFIED UNDER 30 EXECUTED TESTS

DISTRIBUTED MULTI-HOST OPERATION:
UNPROVEN

LIVE GITHUB RUNNER EXECUTION:
UNPROVEN — JOBS DID NOT REACH STEPS

LIVE GOOGLE SHEET PATH:
UNPROVEN

REAL NETWORK DEVICE CONVERGENCE:
UNPROVEN

CONSENSUS / BYZANTINE CLAIM:
NOT MADE

PRODUCTION AVAILABILITY:
UNPROVEN
```

The remaining items do not remain because they were forgotten in a report. They remain because specific architectural substrates do not yet exist or have not yet been operationally admitted. Those substrates are enumerated above and in `REPORT03_DEFICIENCY_MATRIX_R3.json`.

That distinction is the central result of Report 03 R3: the local safety, coordinate, reconciliation and evidence mechanics have advanced and survived deliberate falsification, while every residual claim now has an explicit causal reason and an explicit missing architecture rather than a decorative “future work” label.
