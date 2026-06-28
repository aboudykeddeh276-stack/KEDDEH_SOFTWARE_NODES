import { describe, it, expect } from "vitest";
import { makeKexAddress, hexTimesHex } from "./kex";

describe("kex core", () => {
  it("creates correctly formatted kex addresses", () => {
    expect(makeKexAddress("folder", "GCurve3D")).toBe("kex://folder/gcurve3d");
    expect(makeKexAddress("ssd", "Nested SSD")).toBe("kex://ssd/nested-ssd");
  });

  it("creates valid hex times hex relations", () => {
    const a = { hexId: "HEX-01", name: "A", role: "r", payloadHash: "aaaaaaaabbbb" };
    const b = { hexId: "HEX-02", name: "B", role: "r", payloadHash: "ccccccdddddd" };
    const rel = hexTimesHex(a, b, "depends_on");
    
    expect(rel.kexId).toBe("KEX-aaaaaaaa-ccccccdd");
    expect(rel.a).toBe("HEX-01");
    expect(rel.b).toBe("HEX-02");
    expect(rel.relation).toBe("depends_on");
  });
});
