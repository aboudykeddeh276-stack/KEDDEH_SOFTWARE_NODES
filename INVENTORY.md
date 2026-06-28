# Repository Inventory

This file is the source of truth for repository objects and future iterations.

Rule: read this file before adding or renaming concepts. Extend existing entries instead of recreating them.

## Object ID Format

`KEX-<CLASS>-<DOMAIN>-<NUMBER>`

## Classes

- ARCH: architecture
- DEF: definition
- DOC: document
- DATA: structured data
- SCRIPT: code or adapter
- UI: interface component
- LEDGER: log or proof register
- BOUNDARY: scope boundary

## Evidence

- E0: asserted
- E1: documented
- E2: structured
- E3: implemented
- E4: tested
- E5: reproduced

## Register

| ID | Name | Class | Domain | Status | Evidence | Parent | Notes |
|---|---|---|---|---|---|---|---|
| KEX-ARCH-HYPERDRIVE-0001 | KEX HyperDrive Dashboard UI | ARCH | HYPERDRIVE | active | E3 | root | Front-facing dashboard skeleton. |
| KEX-LEDGER-INV-0001 | Repository Inventory | LEDGER | INV | active | E2 | KEX-ARCH-HYPERDRIVE-0001 | Persistent inventory authority. |
| KEX-LEDGER-INV-0002 | Inventory Ledger | LEDGER | INV | active | E2 | KEX-LEDGER-INV-0001 | Append-only inventory event log. |
| KEX-DEF-INV-0001 | Inventory Before Expansion | DEF | INV | active | E1 | KEX-LEDGER-INV-0001 | Future work extends the register first. |
| KEX-BOUNDARY-HYPERDRIVE-0001 | Frontend Boundary | BOUNDARY | HYPERDRIVE | active | E1 | KEX-ARCH-HYPERDRIVE-0001 | This repository is a frontend until connected to real services. |
| KEX-DOC-BRAINK-0001 | Learning Synthesis | DOC | BRAINK | active | E1 | KEX-ARCH-HYPERDRIVE-0001 | Repository learning model and capability synthesis. |
| KEX-DOC-AUTH-0001 | Agent Roles | DOC | BOUNDARY | active | E1 | KEX-LEDGER-INV-0001 | Defines A. Keddeh direction and bounded software-agent roles. |

## Required Entry Template

```yaml
id:
name:
class:
domain:
status:
evidence:
parents: []
children: []
dependencies: []
supersedes: []
superseded_by: []
paths: []
notes:
```

## Iteration Rule

1. Check for an existing ID.
2. Reuse the ID if the object already exists.
3. Create a new ID only for a materially new object.
4. Record parent, dependency, evidence, and status.
5. Do not delete old context; supersede it.
