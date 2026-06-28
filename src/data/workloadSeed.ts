export type WorkloadStatus =
  | 'identified'
  | 'queued'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'superseded';

export type WorkloadObject = {
  workloadId: string;
  name: string;
  status: WorkloadStatus;
  parentInventoryObject: string;
  repositoryPaths: string[];
  completionCondition: string;
  notes: string;
};

export const workloadSeed: WorkloadObject[] = [
  {
    workloadId: 'WL-0001',
    name: 'Workload harvesting lane',
    status: 'completed',
    parentInventoryObject: 'KEX-LEDGER-INV-0001',
    repositoryPaths: ['docs/WORKLOAD_HARVESTING_LANE.md'],
    completionCondition: 'Lane document exists and defines object/status protocol.',
    notes: 'Completed before expanding the rest of the queue.',
  },
  {
    workloadId: 'WL-0002',
    name: 'Live workload register',
    status: 'completed',
    parentInventoryObject: 'KEX-DOC-WORKLOAD-0001',
    repositoryPaths: ['WORKLOAD_REGISTER.md'],
    completionCondition: 'Register exists and records active/completed work.',
    notes: 'Register is now the human-readable workload queue.',
  },
  {
    workloadId: 'WL-0003',
    name: 'Inventory seed source file',
    status: 'completed',
    parentInventoryObject: 'KEX-LEDGER-INV-0001',
    repositoryPaths: ['src/data/inventorySeed.ts'],
    completionCondition: 'Source file exports registered inventory objects.',
    notes: 'Source seed represents registered inventory objects for dashboard projection.',
  },
  {
    workloadId: 'WL-0004',
    name: 'Workload seed source file',
    status: 'completed',
    parentInventoryObject: 'KEX-DOC-WORKLOAD-0001',
    repositoryPaths: ['src/data/workloadSeed.ts'],
    completionCondition: 'Source file exports workload records.',
    notes: 'This file instantiates the workload queue in source form.',
  },
  {
    workloadId: 'WL-0005',
    name: 'Inventory adapter',
    status: 'completed',
    parentInventoryObject: 'KEX-LEDGER-INV-0001',
    repositoryPaths: ['src/lib/adapters/inventoryAdapter.ts'],
    completionCondition: 'Adapter loads/searches inventory objects.',
    notes: 'Adapter supports domain, evidence, status, parent, and text queries.',
  },
  {
    workloadId: 'WL-0006',
    name: 'Workload adapter',
    status: 'completed',
    parentInventoryObject: 'KEX-DOC-WORKLOAD-0001',
    repositoryPaths: ['src/lib/adapters/workloadAdapter.ts'],
    completionCondition: 'Adapter loads/status-filters workload objects.',
    notes: 'Adapter supports status queries, summaries, path filters, and next actionable workload discovery.',
  },
  {
    workloadId: 'WL-0007',
    name: 'Inventory panel',
    status: 'completed',
    parentInventoryObject: 'KEX-UI-HYPERDRIVE-0001',
    repositoryPaths: ['src/components/InventoryPanel.tsx'],
    completionCondition: 'UI component displays inventory state.',
    notes: 'Projection keeps evidence, status, domain, and notes visible.',
  },
  {
    workloadId: 'WL-0008',
    name: 'Workload panel',
    status: 'completed',
    parentInventoryObject: 'KEX-UI-HYPERDRIVE-0001',
    repositoryPaths: ['src/components/WorkloadPanel.tsx'],
    completionCondition: 'UI component displays workload queue.',
    notes: 'Projection surfaces all registered workload states and actionable workload IDs.',
  },
  {
    workloadId: 'WL-0009',
    name: 'KEX/BRAINK affect ethics model',
    status: 'completed',
    parentInventoryObject: 'KEX-BRAINK-AFFECT-ETHICS-0001',
    repositoryPaths: ['docs/KEX_BRAINK_AFFECT_ETHICS.md', 'src/lib/validators.ts', 'src/lib/validators.test.ts', 'MANIFEST.json'],
    completionCondition: 'Model artifact exists, manifest is updated with hashes, executable checker passes tests.',
    notes: 'Local ethical response constraints are checked as MODEL-LOCAL and routed to BLOCK_OR_REPAIR on failure.',
  },
  {
    workloadId: 'WL-0010',
    name: 'Vitest benchmark/test lane separation',
    status: 'completed',
    parentInventoryObject: 'KEX-DOC-WORKLOAD-0001',
    repositoryPaths: ['vite.config.ts', 'package.json'],
    completionCondition: 'Unit test runner excludes benchmark-only files, and benchmark command remains explicit.',
    notes: 'Prevents benchmark-only calls from collapsing the unit-test proof lane.',
  },
  {
    workloadId: 'WL-0011',
    name: 'KEX HyperDrive instantiation research trajectory',
    status: 'completed',
    parentInventoryObject: 'KEX-ARCH-HYPERDRIVE-0001',
    repositoryPaths: ['docs/KEX_HYPERDRIVE_INSTANTIATION_RESEARCH.md'],
    completionCondition: 'Deep analysis exists with lanes, software strategies, proof gates, and pending external validation boundaries.',
    notes: 'Translates user concepts into an instantiation trajectory without external overclaiming.',
  },
  {
    workloadId: 'WL-0012',
    name: 'Dashboard workload source alignment',
    status: 'completed',
    parentInventoryObject: 'KEX-DOC-WORKLOAD-0001',
    repositoryPaths: ['src/data/workloadSeed.ts', 'src/lib/adapters/workloadAdapter.ts'],
    completionCondition: 'Source workload queue mirrors the active register and supports status summaries.',
    notes: 'Keeps the source projection aligned with the workload register.',
  },
  {
    workloadId: 'WL-0013',
    name: 'Dashboard inventory/workload projection',
    status: 'completed',
    parentInventoryObject: 'KEX-UI-HYPERDRIVE-0001',
    repositoryPaths: ['src/components/InventoryPanel.tsx', 'src/components/WorkloadPanel.tsx', 'src/App.tsx', 'src/styles/global.css'],
    completionCondition: 'UI renders inventory and workload proof state without autonomous/runtime overclaiming.',
    notes: 'Makes local proof, workload state, and pending boundaries visible in the dashboard.',
  },
];

export function listWorkloadsByStatus(status: WorkloadStatus): WorkloadObject[] {
  return workloadSeed.filter((workload) => workload.status === status);
}

export function findWorkload(workloadId: string): WorkloadObject | undefined {
  return workloadSeed.find((workload) => workload.workloadId === workloadId);
}
