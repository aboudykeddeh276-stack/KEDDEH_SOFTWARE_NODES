# Assistant Coding Connector

Author: A. Keddeh
Repository: KEX_HYPERDRIVE_DASHBOARD_UI
Status: v0.1 connector specification

## Purpose

This connector defines a safe platform lane for coding with the assistant directly through repository context, patch requests, proof packets, and reviewable file updates.

The connector does not provide uncontrolled machine access. It creates a typed coding surface where every proposed code change is represented as data, reviewed, and committed through explicit repository operations.

## KEX Calibration

The connector is classified as:

```text
AssistantConnector = 1_connector_definition
DirectUnboundedHostControl = 0_unapproved_runtime
PatchRequest = 1_reviewable_code_state
ProofPacket = validated_recursivity_record
```

## Flow

```text
User intent
-> Assistant coding request
-> Repo context read
-> Patch proposal
-> Reviewable file update
-> Proof packet
-> Commit / PR lane
```

## Connector Objects

```ts
type AssistantConnectorRequest = {
  id: string;
  repo: string;
  targetFiles: string[];
  intent: string;
  constraints: string[];
  status: "draft" | "ready" | "applied" | "rejected";
};

type AssistantPatchProposal = {
  id: string;
  requestId: string;
  filePath: string;
  beforeHash?: string;
  afterHash?: string;
  summary: string;
  content: string;
};

type AssistantProofPacket = {
  id: string;
  requestId: string;
  beforeState: string;
  afterState: string;
  ruleApplied: string;
  validation: "pending" | "passed" | "failed";
};
```

## Safety Boundary

The connector may:

- read repository files,
- propose code changes,
- create reviewable files,
- update repository files when explicitly directed,
- record proof packets.

The connector may not:

- run uncontrolled host operations,
- bypass review,
- mutate local folders without an explicit adapter boundary,
- hide state changes from the proof ledger.

## Definition of Done

The connector is operational when:

1. connector types exist;
2. a UI panel can create requests;
3. requests produce patch proposals;
4. patches are reviewable before application;
5. each accepted update records a proof packet;
6. all changes remain repository-traceable.
