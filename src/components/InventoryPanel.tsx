import { queryInventory } from '../lib/adapters/inventoryAdapter';

const inventoryObjects = queryInventory();

export function InventoryPanel() {
  return (
    <div className="stateList">
      {inventoryObjects.map((object) => (
        <article className="stateCard" key={object.id}>
          <div>
            <code>{object.id}</code>
            <h3>{object.name}</h3>
            <p>{object.notes}</p>
          </div>
          <dl>
            <div><dt>Domain</dt><dd>{object.domain}</dd></div>
            <div><dt>Evidence</dt><dd>{object.evidence}</dd></div>
            <div><dt>Status</dt><dd>{object.status}</dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}
