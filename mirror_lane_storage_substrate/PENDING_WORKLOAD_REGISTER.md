# Pending Workload Register

## Control Rule

Every newly discovered task must be recorded before it is worked.

Required event phrases:

```text
WORKLOAD OBJECT IDENTIFIED: <object title>
WORK ON OBJECT #<id>: <status>
```

Statuses:

```text
pending
in_progress
blocked
complete
superseded
```

## Register

| Object # | Status | Workload Object | Source/Event | Required Completion Condition | Notes |
|---:|---|---|---|---|---|
| 001 | complete | Workload harvesting lane | WORKLOAD OBJECT IDENTIFIED: workload harvesting lane | Governance lane exists with event rules and object register. | Created before further workload execution. |
| 002 | complete | Repository governance substrate alignment | WORKLOAD OBJECT IDENTIFIED: repository governance substrate alignment | Authorship, verification, workload, and software-record boundaries exist in repo. | Workload register, harvesting lane, verification conventions, and authorship note committed. |
| 003 | complete | Core software skeleton presence check | WORKLOAD OBJECT IDENTIFIED: core software skeleton presence check | Confirm or create skeleton modelling server, drive, coordinate, cell, route, mirror, parity, restore as software records only. | Skeleton committed at `software_skeletons/kex_cell_network_engine.py`. |
| 004 | in_progress | Frontend workload surface | WORKLOAD OBJECT IDENTIFIED: frontend workload surface | Expose workload register summary in dashboard data/UI without claiming autonomous work. | Next active object. |
| 005 | pending | Register-backed dashboard data model | WORKLOAD OBJECT IDENTIFIED: register-backed dashboard data model | Add static dashboard data representing current workload objects and statuses. | Identified while preparing frontend workload surface. |
| 006 | pending | Workload status UI component | WORKLOAD OBJECT IDENTIFIED: workload status UI component | Render workload objects, statuses, and boundaries in the dashboard. | Depends on data model and existing UI structure. |
| 007 | pending | Repository proof index | WORKLOAD OBJECT IDENTIFIED: repository proof index | Add a file listing committed governance and skeleton artefacts with proof level. | Supports file-backed proof conventions. |

## Event Log

```text
WORKLOAD OBJECT IDENTIFIED: workload harvesting lane
WORK ON OBJECT #001: in_progress
WORK ON OBJECT #001: complete

WORKLOAD OBJECT IDENTIFIED: repository governance substrate alignment
WORK ON OBJECT #002: in_progress
WORK ON OBJECT #002: complete

WORKLOAD OBJECT IDENTIFIED: core software skeleton presence check
WORK ON OBJECT #003: in_progress
WORK ON OBJECT #003: complete

WORKLOAD OBJECT IDENTIFIED: frontend workload surface
WORK ON OBJECT #004: in_progress

WORKLOAD OBJECT IDENTIFIED: register-backed dashboard data model
WORK ON OBJECT #005: pending

WORKLOAD OBJECT IDENTIFIED: workload status UI component
WORK ON OBJECT #006: pending

WORKLOAD OBJECT IDENTIFIED: repository proof index
WORK ON OBJECT #007: pending
```
