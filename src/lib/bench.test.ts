import { bench, describe } from "vitest";
import { validateControlRow } from "./validators";
import { makeKexAddress } from "./kex";

describe("KEX Benchmarks", () => {
  bench("validateControlRow - valid", () => {
    validateControlRow({ ADDRESS: "kex://folder/GCurve3D", TARGET: "/runtime/GCurve3D", ENTRY_POINT: "metadata", ACTION: "set_metadata" });
  });

  bench("makeKexAddress", () => {
    makeKexAddress("ssd", "Test Matrix Layer");
  });
});
