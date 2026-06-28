export type EvidenceLevel = 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5';

export type InventoryClass =
  | 'ARCH'
  | 'DEF'
  | 'DOC'
  | 'DATA'
  | 'SCRIPT'
  | 'UI'
  | 'LEDGER'
  | 'BOUNDARY';

export type InventoryObject = {
  id: string;
  name: string;
  class: InventoryClass;
  domain: string;
  status: string;
  evidence: EvidenceLevel;
  parent: string;
  paths: string[];
  notes: string;
};

export const inventorySeed: InventoryObject[] = [
  {
    id: 'KEX-ARCH-HYPERDRIVE-0001',
    name: 'KEX HyperDrive Dashboard UI',
    class: 'ARCH',
    domain: 'HYPERDRIVE',
    status: 'active',
    evidence: 'E3',
    parent: 'root',
    paths: ['README.md'],
    notes: 'Front-facing dashboard skeleton for KEX/BRAINK runtime control plane.',
  },
  {
    id: 'KEX-LEDGER-INV-0001',
    name: 'Repository Inventory',
    class: 'LEDGER',
    domain: 'INV',
    status: 'active',
    evidence: 'E2',
    parent: 'KEX-ARCH-HYPERDRIVE-0001',
    paths: ['INVENTORY.md'],
    notes: 'Persistent inventory authority.',
  },
  {
    id: 'KEX-LEDGER-INV-0002',
    name: 'Inventory Ledger',
    class: 'LEDGER',
    domain: 'INV',
    status: 'active',
    evidence: 'E2',
    parent: 'KEX-LEDGER-INV-0001',
    paths: ['INVENTORY_LEDGER.md'],
    notes: 'Append-only inventory event log.',
  },
  {
    id: 'KEX-DOC-BRAINK-0001',
    name: 'KEX Learning Synthesis',
    class: 'DOC',
    domain: 'BRAINK',
    status: 'active',
    evidence: 'E1',
    parent: 'KEX-ARCH-HYPERDRIVE-0001',
    paths: ['docs/LEARNING_SYNTHESIS.md'],
    notes: 'Current learned model of how the software becomes a state-preserving control plane.',
  },
  {
    id: 'KEX-DOC-HYPERDRIVE-0002',
    name: 'Capability Architecture Map',
    class: 'DOC',
    domain: 'HYPERDRIVE',
    status: 'active',
    evidence: 'E1',
    parent: 'KEX-DOC-BRAINK-0001',
    paths: ['docs/CAPABILITY_ARCHITECTURE_MAP.md'],
    notes: 'Maps inventory, ledger, router, substrate, proof capsule, and dashboard projection.',
  },
  {
    id: 'KEX-THEOREM-HEX-0001',
    name: 'Cascading Seed Formula',
    class: 'DOC',
    domain: 'HEX',
    status: 'active',
    evidence: 'E1',
    parent: 'KEX-LEDGER-INV-0001',
    paths: ['docs/CASCADING_SEED_FORMULA.md'],
    notes: 'Formula governing context-preserving repository growth.',
  },

  {
    id: 'KEX-UI-HYPERDRIVE-0001',
    name: 'Dashboard Projection Layer',
    class: 'UI',
    domain: 'HYPERDRIVE',
    status: 'active',
    evidence: 'E3',
    parent: 'KEX-ARCH-HYPERDRIVE-0001',
    paths: ['src/App.tsx', 'src/components/InventoryPanel.tsx', 'src/components/WorkloadPanel.tsx'],
    notes: 'Visible projection of registered inventory, workload, proof, and boundary state.',
  },
  {
    id: 'KEX-BRAINK-AFFECT-ETHICS-0001',
    name: 'KEX/BRAINK Bioethics and Affect Response Model',
    class: 'BOUNDARY',
    domain: 'BRAINK',
    status: 'model-local',
    evidence: 'E3',
    parent: 'KEX-DOC-BRAINK-0001',
    paths: ['docs/KEX_BRAINK_AFFECT_ETHICS.md', 'src/lib/validators.ts'],
    notes: 'Boundary model for affect, identity, ethics, and unsupported bio-claims with executable BLOCK_OR_REPAIR routing.',
  },
  {
    id: 'KEX-HYPERDRIVE-INSTANTIATION-0001',
    name: 'KEX HyperDrive Instantiation Research Trajectory',
    class: 'DOC',
    domain: 'HYPERDRIVE',
    status: 'model-local',
    evidence: 'E2',
    parent: 'KEX-ARCH-HYPERDRIVE-0001',
    paths: ['docs/KEX_HYPERDRIVE_INSTANTIATION_RESEARCH.md'],
    notes: 'Maps KEX concepts to software strategies, repository instantiation, proof gates, and pending external validation boundaries.',
  },
  {
    id: 'KEX-DOC-WORKLOAD-0001',
    name: 'Workload Harvesting Lane',
    class: 'DOC',
    domain: 'WORKLOAD',
    status: 'active',
    evidence: 'E2',
    parent: 'KEX-LEDGER-INV-0001',
    paths: ['docs/WORKLOAD_HARVESTING_LANE.md', 'WORKLOAD_REGISTER.md'],
    notes: 'Defines workload object identification, queue growth, status progression, and completion discipline.',
  },
  {
    id: 'KEX-DOC-BRAINK-0003',
    name: 'Transition Definition Doctrine',
    class: 'DOC',
    domain: 'BRAINK',
    status: 'active',
    evidence: 'E1',
    parent: 'KEX-DOC-BRAINK-0001',
    paths: ['docs/TRANSITION_DEFINITION_DOCTRINE.md'],
    notes: 'Defines State OF Transition, Transition OF State, Definition OF State, and recursive X OF X operator family.',
  },
  {
    id: 'KEX-DATA-BRAINK-0001',
    name: 'Transition Definition Seed',
    class: 'DATA',
    domain: 'BRAINK',
    status: 'active',
    evidence: 'E3',
    parent: 'KEX-DOC-BRAINK-0003',
    paths: ['src/data/transitionDefinitionSeed.ts'],
    notes: 'Source-level seed data for transition-definition operators.',
  },
];

export function findInventoryObject(id: string): InventoryObject | undefined {
  return inventorySeed.find((object) => object.id === id);
}

export function listInventoryByDomain(domain: string): InventoryObject[] {
  return inventorySeed.filter((object) => object.domain === domain);
}
