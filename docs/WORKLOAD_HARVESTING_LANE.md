# Workload Harvesting Lane

Object ID: KEX-DOC-WORKLOAD-0001
Parent: KEX-LEDGER-INV-0001
Evidence: E2
Status: active

## Purpose

This lane records every workload object before work proceeds on it.

The rule is simple:

```text
WORKLOAD OBJECT IDENTIFIED: <name>
WORK ON OBJECT #<id>: <status>
```

The workload list is not capped. It expands whenever work reveals another required object.

## Required Status Values

- identified
- queued
- in_progress
- blocked
- completed
- superseded

## Required Workload Record

```yaml
workload_id:
name:
status:
source:
parent_inventory_object:
created_because:
required_before:
repository_paths: []
completion_condition:
notes:
```

## Operating Rule

1. If work reveals a new task, add it first.
2. Mark the current object in progress.
3. Complete the smallest useful unit.
4. Mark the object completed only after a repository file, code file, test, or ledger entry exists.
5. If the work reveals more work, add those as new workload objects before continuing.
