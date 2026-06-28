# Capability Architecture Map

Object ID: KEX-DOC-HYPERDRIVE-0002
Parent: KEX-DOC-BRAINK-0001
Evidence: E1
Status: active draft

## Capability Thesis

KEX HyperDrive becomes powerful when the UI is treated as the visible surface of a deeper inventory-led state machine.

## Capability Layers

### Layer 1 — Inventory Memory

Stores registered objects, identities, evidence, boundaries, and supersession history.

### Layer 2 — Ledger Memory

Records every inventory change as an event.

### Layer 3 — Query Router

Routes user intent into registered objects rather than free-floating answers.

### Layer 4 — Folder Substrate

Maps registered objects onto repository paths, Drive folders, local folders, or nested storage volumes.

### Layer 5 — Workbook Substrate

Treats spreadsheets as state tables, ledgers, proof grids, and runtime registers.

### Layer 6 — Proof Capsule

Binds object identity, evidence class, test status, and release history.

### Layer 7 — Dashboard Projection

Displays current state, unresolved gaps, proof status, and executable routes.

## Capability Matrix

| Layer | Current state | Next implementation |
|---|---|---|
| Inventory | INVENTORY.md exists | source seed file |
| Ledger | INVENTORY_LEDGER.md exists | typed ledger adapter |
| Router | README describes route | query adapter |
| Folder substrate | conceptual | folder scanner |
| Workbook substrate | conceptual | workbook import adapter |
| Proof capsule | conceptual | proof object schema |
| Dashboard | frontend skeleton | inventory panel |

## Software Evolution Rule

```text
Registered State + New Input = Resolved Object
Resolved Object + Ledger Entry = Preserved Evolution
Preserved Evolution + UI Projection = Controllable Runtime
```

## Practical Meaning

Each feature should become inspectable as:

```text
what exists
what it depends on
what it proves
what it does not prove
what file implements it
what evidence class it has
what next step promotes it
```

That is the bridge from dashboard skeleton to robust KEX/BRAINK control plane.
