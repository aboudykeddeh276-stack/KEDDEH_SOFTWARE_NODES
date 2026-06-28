export type InventoryEvent = {
  eventId: string;
  eventType: 'created' | 'updated' | 'superseded' | 'validated' | 'linked';
  objectId: string;
  summary: string;
  paths: string[];
};

export const inventoryLedgerSeed: InventoryEvent[] = [
  {
    eventId: 'EVENT-0001',
    eventType: 'created',
    objectId: 'KEX-LEDGER-INV-0001',
    summary: 'Persistent repository inventory authority created.',
    paths: ['INVENTORY.md'],
  },
  {
    eventId: 'EVENT-0002',
    eventType: 'created',
    objectId: 'KEX-LEDGER-INV-0002',
    summary: 'Append-only inventory ledger created.',
    paths: ['INVENTORY_LEDGER.md'],
  },
  {
    eventId: 'EVENT-0003',
    eventType: 'created',
    objectId: 'KEX-DOC-BRAINK-0001',
    summary: 'Learning synthesis added as first deep capability expansion.',
    paths: ['docs/LEARNING_SYNTHESIS.md'],
  },
];

export function appendInventoryEvent(events: InventoryEvent[], event: InventoryEvent): InventoryEvent[] {
  if (events.some((existing) => existing.eventId === event.eventId)) {
    throw new Error(`Duplicate inventory event: ${event.eventId}`);
  }
  return [...events, event];
}

export function eventsForObject(objectId: string): InventoryEvent[] {
  return inventoryLedgerSeed.filter((event) => event.objectId === objectId);
}
