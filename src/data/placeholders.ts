import type { ChatMessage, HyperNode, LedgerPacket, Metric, RouteNode, Sector, ControlRow } from "../types";
import ssdData from "./kex_moment_ssd.json";
import csvRaw from "./kex_control_sheet.csv?raw";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }

  if (quoted) throw new Error("CONTROL_SHEET_CSV_UNCLOSED_QUOTE");
  if (field.length || row.length) {
    row.push(field);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  return rows;
}

const csvRows = parseCsv(csvRaw.trim());
const headerRow = csvRows[0] ?? [];
const expectedHeaders = ["ADDRESS", "TARGET_FOLDER", "ENTRY_POINT", "ACTION", "FIELD", "VALUE", "STATUS"];
if (JSON.stringify(headerRow) !== JSON.stringify(expectedHeaders)) {
  throw new Error(`CONTROL_SHEET_HEADER_MISMATCH:${headerRow.join("|")}`);
}

export const controlRows: ControlRow[] = csvRows.slice(1).map((r: string[], index: number) => {
  if (r.length !== expectedHeaders.length) {
    throw new Error(`CONTROL_SHEET_COLUMN_COUNT_INVALID:row=${index + 2}:count=${r.length}`);
  }
  return {
    address: r[0],
    target: r[1],
    entryPoint: r[2],
    action: r[3],
    field: r[4],
    value: r[5],
    status: r[6]
  };
});

const sectorEntries = Object.entries(ssdData.sectors);
const numSectors = sectorEntries.length;
const numLinks = ssdData.links.length;
const numLedgerPackets = ssdData.ledger.length;
const pendingRows = controlRows.filter((row) => row.status === "PENDING").length;
const observedRows = controlRows.length;

export const header = {
  title: "KEX HyperDrive Control Plane",
  subtitle: "Static projection of the checked-in KEX control sheet and virtual substrate description.",
  kexCode: ssdData.device,
  proofHash: ssdData.source_sha256,
  status: "STATIC DATASET LOADED"
};

export const metrics: Metric[] = [
  { label: "Control Rows", value: observedRows.toString(), foot: "parsed from kex_control_sheet.csv" },
  { label: "Pending Rows", value: pendingRows.toString(), foot: "status values observed in control sheet" },
  { label: "Indexed Sectors", value: numSectors.toString(), foot: "entries in kex_moment_ssd.json" },
  { label: "Indexed Links", value: numLinks.toString(), foot: "links in kex_moment_ssd.json" }
];

export const hyperNodes: HyperNode[] = [
  { title: "Control Sheet", role: "Checked-in CSV input", status: "ready" },
  { title: "Sector Index", role: "Checked-in JSON sector map", status: "ready" },
  { title: "Ledger Records", role: `${numLedgerPackets} checked-in evidence records`, status: "ready" },
  { title: "Runtime State", role: "No live runtime observation attached to this static module", status: "watch" }
];

export const kexRoute: RouteNode[] = Object.values(ssdData.sectors).map((s: any, index) => ({
  index: index + 1,
  name: s.marker,
  className: s.class,
  description: `Offset ${s.offset} - ${s.end_offset} (${s.byte_span_estimate} bytes)`
}));

export const sectors: Sector[] = controlRows.map((r, i) => ({
  id: `ROW-${String(i + 1).padStart(3, "0")}`,
  address: r.address,
  role: r.target,
  state: r.status
}));

export const muxLines = [
  "KEX DATASET PROJECTION",
  "------------------------------------------------------------",
  `DEVICE_LABEL: ${ssdData.device}`,
  `CLAIM_BOUNDARY: ${ssdData.claim_boundary}`,
  `SOURCE_SHA256: ${ssdData.source_sha256}`,
  `SECTORS_INDEXED: ${numSectors}`,
  `LINKS_INDEXED: ${numLinks}`,
  `LEDGER_RECORDS: ${numLedgerPackets}`,
  "",
  ...Object.keys(ssdData.concept).map((k) => `CONCEPT [${k.toUpperCase()}]: ${(ssdData.concept as any)[k]}`),
  "",
  "STATIC DATA LOADED. NO LIVE MOUNT, CAPACITY, OR ONLINE-STATE CLAIM IS MADE HERE."
];

export const hostMessages: ChatMessage[] = [
  { actor: "system", time: "data", text: `Loaded ${observedRows} control-sheet rows from the checked-in CSV.` },
  { actor: "system", time: "data", text: `Loaded ${numSectors} sector descriptions and ${numLinks} links from the checked-in JSON.` },
  { actor: "system", time: "data", text: `Claim boundary: ${ssdData.claim_boundary}` }
];

export const ledgerPackets: LedgerPacket[] = ssdData.ledger.map((packet: any) => ({
  id: String(packet.packet_id).padStart(4, "0"),
  action: packet.action,
  hash: packet.packet_hash
}));
