# REPORT 03 — Full Engineering Closure, Falsification, and Missing-Architecture Analysis

**Primary Research Author:** A. Keddeh  
**AI Support Role:** authorised implementation, test, documentation, and evidence-record support within tool and software limits.  
**Repository:** aboudykeddeh276-stack/KEDDEH_SOFTWARE_NODES  
**Evidence date:** 2026-09-21  
**Evidence state:** IMPLEMENTED / LOCALLY EXECUTED IN PRIOR QUALIFICATION / ADVERSARIAL TEST SURFACE EXPANDED / DISTRIBUTED PRODUCTION CLAIMS NOT PROMOTED

## 1. Report purpose

Report 03 is an engineering report, not a rearrangement of prior architecture prose. It records the missing layer that was actually instantiated around the existing event-runner estate, the faults that were explicitly encoded, the evidence surfaces that now exist, the claims that advanced, and the claims that remain unproven.

The implemented control path is:

TELEMETRY
-> CANONICAL INPUT IDENTITY
-> SIGNED EVENT
-> ToT SAFETY ADMISSION
-> DURABLE REPLAY / SEQUENCE STATE
-> DISTRIBUTED COORDINATE DIRECTORY MODEL
-> QUORUM COMMIT GATE
-> LAYER-2 DESIRED / OBSERVED PLAN
-> SAFETY GATE
-> APPLY
-> READBACK VERIFY
-> ROLLBACK OR QUARANTINE
-> HASHED RECEIPT
-> CHAINED DURABLE EVIDENCE LEDGER

No unresolved claim is promoted merely because this report names the missing architecture.

## 2. Engineering layer actually present

### 2.1 ToT safety kernel

The ToT safety kernel is executable software, not a diagram. Its test surface now exercises:

- signed authorised admission;
- replay rejection surviving restart;
- monotonic sequence rollback rejection;
- signature forgery rejection;
- expected-input-hash mismatch rejection;
- event-expiry rejection;
- clock-window rejection;
- non-ready node rejection;
- shared durable-journal race containment.

The kernel therefore advances the estate from “event exists” to “event must satisfy an admission contract before mutation”. Identity, integrity, capability, temporal validity, sequence monotonicity, node state, and replay history are separate gates.

What this proves: the implemented local admission mechanics reject the encoded invalid cases.

What this does not prove: Byzantine consensus, hardware-backed identity, multi-host quorum, globally synchronized time, or production availability.

### 2.2 Distributed coordinate directory

The coordinate directory now has executable mechanics for:

- persistent coordinate records;
- compare-and-set preconditions;
- record hashing;
- snapshot hashing;
- vector-clock style causality;
- concurrent-writer conflict quarantine;
- equal-vector equivocation detection;
- remote snapshot tamper rejection;
- tombstone propagation;
- deterministic snapshots;
- a quorum-gated commit primitive.

The quorum primitive proves a narrower fact than “distributed consensus”: given a configured membership set, a minority cannot satisfy the commit threshold, and an unknown acknowledger cannot manufacture quorum.

That is meaningful advancement. It is not Raft, Paxos, Zab, Viewstamped Replication, PBFT, HotStuff, or another complete consensus protocol. Quorum arithmetic without independent replicas, admitted transport, ordering terms, replicated durable logs, and partition execution remains a local model of distributed commit semantics.

### 2.3 Layer-2 reconciler

Layer-2 is executable desired-versus-observed reconciliation.

Its implemented semantics include:

- deterministic plan ordering;
- deterministic plan hashes;
- idempotency keys;
- generation input;
- bounded retry;
- before-state read;
- mutation;
- after-state readback;
- successful-apply falsification when observed state diverges;
- rollback verification when rollback exists;
- quarantine-required failure when rollback is unavailable;
- orphan quarantine;
- pre-mutation safety gate.

The important engineering change is that an adapter returning success is not accepted as proof of successful state transition. Layer-2 reads the resulting state and compares it with the intended state. A divergent readback converts apparent success into failure evidence and, where possible, rollback.

### 2.4 Evidence receipts and durable evidence

Evidence is now represented through:

- hashed qualification receipts;
- chained evidence entries;
- local durable append;
- fsync-backed journal behaviour;
- reopen verification;
- tamper detection;
- source hashes in the resident qualification actuator;
- explicit boundary declarations.

The resident qualification actuator performs syntax checks, runs the Node native test suite, hashes source files, creates a qualification receipt, appends it to the evidence ledger, verifies the ledger, and writes a machine-readable qualification file.

That closes the gap between “tests exist” and “there is a resident command intended to produce a receipt from the committed source surface”.

## 3. Falsification surface

The current committed test corpus attacks the implementation rather than merely checking happy paths.

### ToT faults

- duplicate/replayed event;
- replay after process restart;
- shared-journal race;
- sequence rollback with a new event identifier;
- forged signature;
- wrong input hash;
- expired event;
- clock-window violation;
- non-ready node.

### Coordinate faults

- stale compare-and-set;
- conflicting concurrent writers;
- equal-vector equivocation;
- tampered remote snapshot;
- deletion propagation through tombstones;
- minority quorum;
- unknown-member quorum forgery.

### Layer-2 faults

- transient adapter failure;
- divergent post-apply readback;
- rollback path;
- permanent adapter failure;
- missing rollback;
- orphaned observed object;
- safety denial before mutation;
- deterministic re-planning / idempotency.

### Evidence faults

- reopen after append;
- hash-chain verification;
- content tampering.

The falsification result is bounded: these attacks demonstrate that the encoded implementation detects or contains the encoded faults in the tested local model. They do not demonstrate resistance to every failure mode.

## 4. Observed execution state

The repository contains earlier execution evidence for the initial Report 03 qualification and later commits that materially expanded the test and fault surface.

The initial stored receipt records a 12-test local qualification with all 12 passing and no failures. Subsequent committed tests expand the adversarial surface substantially, including signed-event validation, durable replay, sequence rollback, coordinate persistence/conflict/tombstones, readback-verified rollback, safety gating, evidence-ledger tamper detection, quorum minority/majority behaviour, unknown-member quorum forgery, and journal reopen/tamper checks.

The resident qualification command now exists as `event_runner/qualify_report03.mjs` and `npm run qualify` in the event-runner package.

A new live execution receipt must not be fabricated when the execution environment has not returned one. Therefore this report distinguishes:

- previously observed passing qualification;
- later committed test expansion;
- resident executable qualification command;
- absence, at report-write time, of a newly read-back CI/runner receipt for the newest repository head.

That distinction is deliberate evidence hygiene.

## 5. What advanced

### 5.1 Safety admission advanced from stateless checking to durable admission state

Replay state can survive restart. Sequence rollback is separately rejected. Signed authority is checked. This is materially stronger than checking only an event hash or capability label.

### 5.2 Coordinate state advanced from local overwrite semantics to conflict-aware causal state

The directory can reject stale writes, detect concurrency, quarantine conflicts, detect equivocation, propagate tombstones, reject tampered snapshots, and gate a proposed commit by configured quorum membership.

### 5.3 Layer-2 advanced from “apply and trust the return value” to observed-state reconciliation

Readback is evidence. Divergent readback falsifies apparent success. Rollback is verified. Failure without rollback is explicitly contained as quarantine-required rather than silently declared converged.

### 5.4 Evidence advanced from transient test output to resident chained qualification

The evidence ledger, durable journal, source hashes, receipt hashes, and qualification actuator create a repeatable evidence-producing path.

### 5.5 The deficiency model advanced

Unproven claims are no longer represented as a single vague “future work” category. Each unresolved claim is tied to:

1. the claim;
2. current evidence state;
3. why it remains unproven;
4. why that reason remains unaddressed;
5. architecture not presently installed;
6. exact evidence required for promotion.

## 6. What remains unproven, why, why the why remains unaddressed, and what is absent

### D01 — Multi-host convergence under partitions

**State:** PARTIALLY_ADVANCED / UNPROVEN AS DISTRIBUTED EXECUTION.

**Why unproven:** quorum and merge logic have been exercised as software objects, not as three or more independently failing replicas connected through a real transport.

**Why the why remains unaddressed:** the repository does not yet contain an admitted replica transport plus membership/reconfiguration plus leader/term or equivalent ordering plus a replicated durable log plus a controllable network-fault harness.

**Architecture not present:** authenticated replica transport; replica discovery/admission; membership change; ordering/term mechanism; durable replicated log; snapshot install; restart/rejoin protocol; delay/loss/duplication/reordering/partition harness.

**Required evidence:** three or more independent replicas; majority/minority partition; heal/rejoin; stale leader/writer; duplicate/reorder/loss; restart during commit; membership change; final state-root equality.

### D02 — Byzantine tolerance

**State:** UNPROVEN.

**Why unproven:** configured quorum members are assumed honest. A malicious member can lie unless proposals and votes are authenticated and a Byzantine fault model is explicitly implemented.

**Why the why remains unaddressed:** no declared n/f Byzantine model, signed proposal/vote protocol, Byzantine quorum certificate, view change, equivocation propagation, or adversarial replica harness is installed.

**Architecture not present:** replica key authority; signed proposals and votes; Byzantine quorum certificate; view-change protocol; equivocation evidence propagation; key rotation/revocation; adversarial replica simulator.

**Required evidence:** forged-vote rejection; double-vote detection; malicious leader; conflicting proposal; view change; recovery with the declared maximum Byzantine fault count.

### D03 — Physical host identity

**State:** UNPROVEN.

**Why unproven:** logical node identifiers can be copied.

**Why the why remains unaddressed:** admission is not bound to hardware-backed identity or an independently verified host key.

**Architecture not present:** TPM/Secure Enclave or equivalent key source; challenge-response attestation; verifier; host-node binding registry; rotation/revocation.

**Required evidence:** fresh challenge; cloned logical-ID rejection; revoked-host rejection; legitimate host replacement/rotation.

### D04 — Live GitHub runner admission and production runner isolation

**State:** EXTERNAL_BOUNDARY / UNPROVEN FOR PRODUCTION ISOLATION.

**Why unproven:** repository source proves workflow and qualification commands, not that a target self-hosted runner is currently registered, online, isolated, and returning receipts.

**Why the why remains unaddressed:** runner registration and execution are external authority state; per-job clean isolation also requires lifecycle control outside the source tree.

**Architecture not present:** admitted runner host; JIT/registration authority; runner health readback; ephemeral lifecycle controller; per-job isolation; secret broker; egress policy; external log sink; image provenance.

**Required evidence:** online runner readback; labeled job execution; returned receipt; restart/reconnect; one-job runner destruction; workspace/secret non-persistence; preserved external logs; revoked credential rejection.

### D05 — Live Google Sheet trigger

**State:** EXTERNAL_BOUNDARY.

**Why unproven:** Apps Script source does not establish that a bound installable trigger, OAuth authority, Script Properties, and reachable ingress are active on a real spreadsheet.

**Why the why remains unaddressed:** these are account- and deployment-resident states rather than repository-only states.

**Architecture not present:** bound Apps Script project; installable trigger; Script Properties authority; reachable TLS ingress; delivery/retry ledger.

**Required evidence:** real edit; HTTP delivery; dispatcher receipt; duplicate/retry; revoked or incorrect authority rejection.

### D06 — External durability / disaster recovery

**State:** PARTIALLY_ADVANCED.

**Why unproven:** fsync, reopen, and tamper detection are local-filesystem evidence. They do not prove survival of power loss, filesystem corruption, device loss, or site loss.

**Why the why remains unaddressed:** no production volume contract, crash harness, replicated persistence authority, backup authority, or independent restore target is connected to Report 03.

**Architecture not present:** durable-volume contract; crash/power-loss harness; replicated journal/storage; backup/restore controller; cross-replica evidence-head reconciliation.

**Required evidence:** forced-kill boundaries; reboot; torn-write simulation; disk-full; backup restore; replica head agreement; site-loss recovery.

### D07 — Global IL-LLM propagation

**State:** UNPROVEN.

**Why unproven:** the Report 03 control plane does not yet publish a validated relationship delta to a versioned global IL-LLM authority and observe a subscriber apply it.

**Why the why remains unaddressed:** node event authority and global relation authority remain separate systems without a canonical publisher/subscriber contract.

**Architecture not present:** versioned relation store; promotion/eligibility gate; publisher; subscriber; delta ACK ledger; conflict/version resolver; restart catch-up.

**Required evidence:** validated publish; relevant subscription; ACK/readback; stale-version rejection; conflict test; restart catch-up.

### D08 — RFC 8785 / cross-language canonicalization

**State:** UNPROVEN.

**Why unproven:** recursively sorting JavaScript object keys is deterministic for the tested fixture domain but is not the complete JSON Canonicalization Scheme.

**Why the why remains unaddressed:** the original helper targeted internal deterministic hashing rather than standards interoperability.

**Architecture not present:** conforming JCS serializer or vetted implementation; I-JSON validation; Unicode and IEEE-754 conformance vectors; second-language implementation.

**Required evidence:** RFC vectors; number edge cases; Unicode cases; duplicate-property rejection at ingestion; equal canonical bytes/hashes across independent implementations.

### D09 — Standard network-management datastore semantics

**State:** UNPROVEN AS A STANDARD INTERFACE.

**Why unproven:** the KEX directory/reconciler has desired/observed mechanics but does not implement YANG NMDA datastores, NETCONF transactions, RESTCONF, or a standards-defined topology datastore.

**Why the why remains unaddressed:** KEX has so far prioritised its own event and coordinate contracts rather than an interoperability adapter layer.

**Architecture not present:** YANG model; intended/operational datastore adapter; NETCONF or RESTCONF endpoint; transaction/error mapping; topology projection.

**Required evidence:** schema validation; standards client interoperability; transactional edit/readback; error-path tests; topology round trip.

### D10 — Production availability and performance

**State:** UNPROVEN.

**Why unproven:** local correctness tests do not establish throughput, tail latency, resource ceilings, recovery time, or availability under sustained load.

**Why the why remains unaddressed:** there is no production-shaped load generator, multi-host deployment, SLO definition, failure budget, or long-duration soak evidence bound to this layer.

**Architecture not present:** benchmark harness; workload model; telemetry/metrics; SLO/SLA definitions; soak controller; capacity model; chaos schedule.

**Required evidence:** reproducible throughput and latency distributions; resource saturation curves; recovery-time measurements; sustained soak; fault-under-load; declared environment and hardware.

## 7. Current standards comparison

### NIST SP 800-207 / 800-207A

NIST zero trust rejects implicit trust based only on physical or network location and requires explicit authentication and authorization around protected resources. Report 03 is directionally aligned where ToT evaluates identity, signed authority, capability, integrity, temporal state, and node state before mutation.

This is not a NIST conformance claim. The missing physical-device attestation, policy-engine separation, deployment evidence, and broader enterprise controls prevent such a claim.

### Kubernetes controller pattern

Kubernetes controllers continuously compare desired and current state and act toward desired state. Report 03 Layer-2 uses the same broad control-loop principle.

KEX differs in its coordinate identity, explicit safety gate, receipt model, and research goals. It also lacks the mature Kubernetes API-server, watch/informer/work-queue, etcd, admission, lease, and controller-runtime ecosystem. Therefore the comparison is architectural, not equivalence.

### RFC 8785 JCS

RFC 8785 defines canonical JSON suitable for repeatable cryptographic operations using I-JSON constraints, ECMAScript primitive serialization, and deterministic property sorting.

KEX's current stable hashing is locally deterministic for tested inputs but is not claimed JCS-conformant until conformance vectors and cross-language equality are demonstrated.

### GitHub self-hosted runner guidance

GitHub documents self-hosted runners as operator-managed systems and recommends ephemeral self-hosted runners for autoscaling; an ephemeral runner is assigned one job and then automatically de-registered. GitHub also recommends external preservation of ephemeral runner logs.

Therefore a persistent runner can be useful for controlled trusted workloads, but stronger production isolation requires an explicit ephemeral/JIT lifecycle, external logs, secret handling, and cleanup evidence.

## 8. Falsification conclusions

The engineering survived the encoded local attacks in prior qualification evidence and has since gained a larger committed adversarial suite. The strongest defensible statement is therefore:

- ToT local safety admission is implemented and adversarially specified.
- Coordinate persistence, conflict detection, equivocation detection, tombstones, snapshot integrity, and quorum threshold semantics are implemented.
- Layer-2 deterministic planning, retry, readback verification, rollback, quarantine, and safety gating are implemented.
- Chained evidence and local durable journal verification are implemented.
- A resident qualification actuator exists to syntax-check, execute, hash, receipt, and ledger the committed engineering surface.
- Multi-host consensus, Byzantine tolerance, hardware identity, live external trigger/runner state, production durability, global IL-LLM propagation, standards conformance, and production availability remain unproven.

## 9. Required architecture sequence for the remaining deficiencies

The remaining work is not “add more prose”. The dependency order is:

1. authenticated replica transport and replica identity;
2. membership/reconfiguration and ordering/term semantics;
3. durable replicated log plus snapshot/install;
4. independent multi-process/multi-host partition harness;
5. crash, restart, disk-full, torn-write, and restore harness;
6. hardware-backed host admission where physical identity is required;
7. standards canonicalization/interoperability adapters;
8. external authority admission for GitHub runner and Google Sheet trigger;
9. versioned IL-LLM publisher/subscriber and ACK ledger;
10. production-shaped benchmark, telemetry, SLO, and soak layer.

Until those architectures exist and produce evidence, their corresponding claims remain explicitly unpromoted.

## 10. Final classification

**PROVEN_LOCAL / IMPLEMENTED:** ToT admission decisions; signed-event verification; durable replay and sequence rollback rejection; coordinate persistence; CAS; concurrent-conflict quarantine; equivocation detection; snapshot integrity; tombstones; deterministic Layer-2 planning; idempotency; bounded retry; readback verification; rollback verification; quarantine-required containment; safety-gated mutation; chained evidence; local journal reopen/tamper verification; local quorum threshold/membership semantics.

**PARTIALLY_ADVANCED:** distributed coordinate commit semantics; external durability semantics.

**UNPROVEN:** independent multi-host convergence; Byzantine tolerance; physical host identity; global IL-LLM propagation; RFC 8785 conformance; YANG/NMDA/NETCONF/RESTCONF interoperability; production runner isolation; production availability/performance.

**EXTERNAL_BOUNDARY:** live GitHub runner admission/execution and live Google Sheet trigger execution until those external authorities are admitted and read back.

Report 03 therefore advances the estate materially, but does not use architecture vocabulary as a substitute for evidence.
