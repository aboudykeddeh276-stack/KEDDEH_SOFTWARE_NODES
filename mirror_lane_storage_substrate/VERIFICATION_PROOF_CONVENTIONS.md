# Verification Proof Conventions

## Meaning of Verify

In this repository, `verify` means to document adequate proof under declared proof conventions. It does not mean that a software assistant personally certifies truth, physical execution, hardware control, or external-world completion.

## Proof Levels

| Level | Name | Meaning |
|---:|---|---|
| 0 | Declared | A claim or intended design is recorded. |
| 1 | Structured | The claim has definitions, scope, and boundaries. |
| 2 | File-backed | The claim is supported by repository files. |
| 3 | Test-backed | The claim is supported by runnable tests or deterministic checks. |
| 4 | Cross-checked | The claim is supported by multiple independent records or parity checks. |

## Required Boundaries

Verification notes must distinguish:

```text
declared design
software record
repository file
runnable test
physical hardware action
external system action
```

## Current Convention

Unless a file contains runnable tests and those tests have actually been executed and reported, repository statements should be treated as `Level 2: File-backed` or below.
