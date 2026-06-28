export type HexState = {
  hexId: string;
  name: string;
  role: string;
  payloadHash: string;
};

export type KexRelation = {
  kexId: string;
  a: string;
  b: string;
  relation: string;
};

export function makeKexAddress(namespace: string, name: string): string {
  return `kex://${namespace}/${name.toLowerCase().replaceAll(" ", "-")}`;
}

export function hexTimesHex(a: HexState, b: HexState, relation: string): KexRelation {
  return {
    kexId: `KEX-${a.payloadHash.slice(0, 8)}-${b.payloadHash.slice(0, 8)}`,
    a: a.hexId,
    b: b.hexId,
    relation
  };
}
