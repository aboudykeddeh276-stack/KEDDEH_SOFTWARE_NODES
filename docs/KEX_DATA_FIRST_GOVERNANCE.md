# KEX Data-First Governance Canon

Author: A. Keddeh
Repository: KEX_HYPERDRIVE_DASHBOARD_UI
Status: v0.1 canonical governance lane

## Root correction

KEX Hyperdrive must be instantiated through the lens of data first, prior to data traversal.

The repository must not treat UI, Python engines, TypeScript components, hooks, dashboards, folders, or scripts as root authority.

Root authority is:

```text
Definition -> Data -> State -> Traversal -> Execution -> Projection
```

Software is a projection of the data lens. It is not the root lens.

## Absolute naming governance

Every name must declare its role before it can be used as runtime authority.

Required naming tuple:

```text
KEX_NAME = {
  definition,
  role,
  data_state,
  traversal_state,
  execution_boundary,
  proof_boundary,
  projection_surface
}
```

A name is invalid when it is only a label.

A name is valid when it exposes the definition and data-state behind the label.

## Role classes

```text
DATA_DEFINITION
DATA_OBJECT
DATA_STATE
DATA_TRAVERSAL
DATA_EXECUTION
DATA_PROJECTION
DATA_LEDGER
DATA_PROOF
SOFTWARE_PROJECTION
UI_PROJECTION
```

## Governance rules

1. Data is read before traversal.
2. Traversal is defined before execution.
3. Execution is bounded before projection.
4. UI never defines truth.
5. Software never outranks data definition.
6. Python/TypeScript engines are implementation projections, not root authority.
7. Every runtime transition must preserve the data behind the state change.
8. Every component must map back to a data-first definition.
9. Every placeholder must be marked as contextual-null until wired to data.
10. Every achievement must be visible through definition, data-state, proof, and projection.

## Correct repository lane

```text
/data
  /definitions
  /objects
  /states
  /traversals
  /ledgers
  /proofs

/src
  /lib/kex
  /components
  /hooks
```

The `/data` lane is root.
The `/src` lane is projection.

## Null-state rule

If a concept is named but not wired to data, it must be represented as:

```text
0X_Repo = contextual null existence of X inside the repository runtime environment
```

Examples:

```text
0Adapter_Repo
0LedgerRuntime_Repo
0TraversalEngine_Repo
0RuntimeRouter_Repo
```

## Operational target

The repository reaches correct governance when every visible panel, hook, adapter, route, metric, and proof packet can answer:

```text
What data defines me?
What state am I in?
What traversal can reach me?
What execution can change me?
What proof preserves my transition?
What projection exposes me?
```
