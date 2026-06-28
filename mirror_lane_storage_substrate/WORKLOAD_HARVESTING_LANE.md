# Workload Harvesting Lane

**Originating authority:** A. Keddeh  
**Support agents:** ChatGPT, Codex, and related software agents operate only as directed assisting agents inside their software/tool/directive limits.

## Purpose

This lane prevents implied, invisible, or unrecorded work. When the research or software process identifies a new task, the task is first registered as a workload object before execution continues.

## Mandatory Phrase Hooks

```text
WORKLOAD OBJECT IDENTIFIED: <object title>
WORK ON OBJECT #<id>: <pending|in_progress|blocked|complete|superseded>
```

## Harvesting Procedure

1. Detect newly identified work.
2. Add it to `PENDING_WORKLOAD_REGISTER.md` with the next object number.
3. Log the triggering phrase in the event log.
4. Mark the object `in_progress` only when work begins.
5. Mark the object `complete` only when its completion condition is satisfied.
6. If work reveals another task, stop and register that new object first.

## Authority Boundary

This lane is an execution-control record only. It does not create autonomous authority for software agents. It records work under A. Keddeh's authorship and direction.

## Non-Physical Boundary

This lane records software governance objects only. It does not claim direct physical disk control, hardware control, external execution, or independent certification.
