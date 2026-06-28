import { inventorySeed, type InventoryObject } from '../../data/inventorySeed';

export type InventoryQuery = {
  domain?: string;
  evidence?: string;
  status?: string;
  parent?: string;
  text?: string;
};

export function queryInventory(query: InventoryQuery = {}): InventoryObject[] {
  return inventorySeed.filter((object) => {
    if (query.domain && object.domain !== query.domain) return false;
    if (query.evidence && object.evidence !== query.evidence) return false;
    if (query.status && object.status !== query.status) return false;
    if (query.parent && object.parent !== query.parent) return false;
    if (query.text) {
      const haystack = `${object.id} ${object.name} ${object.domain} ${object.notes}`.toLowerCase();
      if (!haystack.includes(query.text.toLowerCase())) return false;
    }
    return true;
  });
}

export function resolveInventoryChain(id: string): InventoryObject[] {
  const chain: InventoryObject[] = [];
  const seen = new Set<string>();
  let current = inventorySeed.find((object) => object.id === id);

  while (current && !seen.has(current.id)) {
    chain.unshift(current);
    seen.add(current.id);
    current = inventorySeed.find((object) => object.id === current?.parent);
  }

  return chain;
}

export function composeKexObject(hexA: InventoryObject, hexB: Partial<InventoryObject>): InventoryObject {
  return {
    id: hexB.id ?? `${hexA.id}-CHILD`,
    name: hexB.name ?? `${hexA.name} Extension`,
    class: hexB.class ?? hexA.class,
    domain: hexB.domain ?? hexA.domain,
    status: hexB.status ?? 'draft',
    evidence: hexB.evidence ?? 'E0',
    parent: hexB.parent ?? hexA.id,
    paths: hexB.paths ?? [],
    notes: hexB.notes ?? 'Composed through KEX = HEX x HEX inventory rule.',
  };
}
