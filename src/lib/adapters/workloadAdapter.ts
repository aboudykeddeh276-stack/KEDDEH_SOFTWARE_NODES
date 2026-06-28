import { workloadSeed, type WorkloadObject, type WorkloadStatus } from '../../data/workloadSeed';

export type WorkloadQuery = {
  status?: WorkloadStatus;
  parentInventoryObject?: string;
  path?: string;
  text?: string;
};

export type WorkloadStatusSummary = Record<WorkloadStatus, number>;

const WORKLOAD_STATUSES: WorkloadStatus[] = [
  'identified',
  'queued',
  'in_progress',
  'blocked',
  'completed',
  'superseded',
];

export function queryWorkloads(query: WorkloadQuery = {}): WorkloadObject[] {
  return workloadSeed.filter((workload) => {
    if (query.status && workload.status !== query.status) return false;
    if (query.parentInventoryObject && workload.parentInventoryObject !== query.parentInventoryObject) return false;
    if (query.path && !workload.repositoryPaths.includes(query.path)) return false;
    if (query.text) {
      const haystack = `${workload.workloadId} ${workload.name} ${workload.notes} ${workload.completionCondition}`.toLowerCase();
      if (!haystack.includes(query.text.toLowerCase())) return false;
    }
    return true;
  });
}

export function summarizeWorkloads(workloads: WorkloadObject[] = workloadSeed): WorkloadStatusSummary {
  return WORKLOAD_STATUSES.reduce<WorkloadStatusSummary>((summary, status) => {
    summary[status] = workloads.filter((workload) => workload.status === status).length;
    return summary;
  }, {
    identified: 0,
    queued: 0,
    in_progress: 0,
    blocked: 0,
    completed: 0,
    superseded: 0,
  });
}

export function nextActionableWorkloads(workloads: WorkloadObject[] = workloadSeed): WorkloadObject[] {
  return workloads.filter((workload) => workload.status === 'identified' || workload.status === 'queued' || workload.status === 'in_progress');
}
