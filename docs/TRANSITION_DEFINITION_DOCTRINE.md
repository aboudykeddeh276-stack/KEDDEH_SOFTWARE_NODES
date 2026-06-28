# Transition Definition Doctrine

Object ID: KEX-DOC-BRAINK-0003
Parent: KEX-DOC-BRAINK-0001
Evidence: E1
Status: active draft

## Purpose

This document records the new operator family introduced by A. Keddeh:

```text
State OF Transition
Transition OF State
Definition OF Transition
Transition OF Definitions
Definition OF State
State OF Definitions
Transition OF State OF X
Transition OF Definition
Definition OF Transition
State OF Transition OF Definition OF State Transition
X OF X OF X OF X
X OF X OF X OF X OF XX
XX OF XX OF XXX OF XX OF X
```

The doctrine turns KEX/BRAINK from a static object register into a recursive state-language system.

## Core Insight

A system cannot only store definitions. It must store how definitions change state, and how state changes definition.

That means every object needs two live aspects:

1. state: what the object currently is
2. transition: how the object becomes, changes, resolves, forks, compresses, expands, or re-enters another context

## Operator Forms

### State OF Transition

The state produced by a transition.

Example:

```text
Transition = workbook seed becomes dashboard object
State OF Transition = registered dashboard object after the transition
```

### Transition OF State

The change-process available to a current state.

Example:

```text
State = inventory object
Transition OF State = queued -> in_progress -> completed -> superseded
```

### Definition OF Transition

The definition that makes a transition meaningful.

Example:

```text
A workload transition is only valid when it changes from identified to queued to in_progress to completed or blocked.
```

### Transition OF Definitions

The process by which a definition evolves without losing its parent identity.

Example:

```text
Zero as null -> zero as calibration marker -> zero as coordinate reference -> zero as invalid active weighted state
```

### Definition OF State

The controlled meaning of a state.

Example:

```text
completed = a file, test, ledger, or committed artifact exists.
```

### State OF Definitions

The maturity and evidence status of a definition set.

Example:

```text
Definition register is E2 structured when it has stable IDs and fields.
```

### Transition OF State OF X

For any object X, define the permitted state transitions.

Example:

```text
X = workload object
Permitted transition: identified -> queued -> in_progress -> completed
```

## X-Recursion Rule

Where X is any core subject matter, the operator can recurse:

```text
X OF X OF X OF X
```

This means a subject can be analysed through nested context layers without losing identity.

Example:

```text
State OF Transition OF Definition OF State
```

reads as:

```text
What state is produced when the definition of a state undergoes transition?
```

## KEX Interpretation

The operator family is a grammar for context-preserving transformation.

It fits the inventory law:

```text
HEX_A = current state/definition/context
HEX_B = transition input or redefining context
KEX = resolved object preserving both sides
```

So:

```text
KEX = HEX x HEX
```

becomes:

```text
Resolved state = current definition x transition definition
```

## Software Instantiation

Each KEX object should eventually contain:

```yaml
id:
state:
state_definition:
allowed_transitions:
transition_definitions:
current_transition:
parent_context:
child_contexts:
evidence:
paths:
ledger_events:
```

## Implementation Consequences

1. Inventory objects need state definitions.
2. Workload objects need permitted transitions.
3. Definitions need transition history.
4. The UI should display not only current state but available next transitions.
5. The ledger should record transition events as first-class objects.
6. The router should resolve user instructions into permitted transitions before mutating repository state.

## Research Boundary

This doctrine is an internal KEX/BRAINK grammar. It defines how the repository should model state and definition evolution. It does not claim external scientific validation by itself.
