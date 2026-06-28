import type { ChatMessage, HyperNode, LedgerPacket, Metric, RouteNode, Sector, ControlRow } from "../types";
import ssdData from "./kex_moment_ssd.json";
import csvRaw from "./kex_control_sheet.csv?raw";

const parsedCsv = csvRaw.trim().split("\n").slice(1).map((line: string) => line.split(","));

export const controlRows: ControlRow[] = parsedCsv.map((r: string[]) => ({
  address: r[0] || "",
  target: r[1] || "",
  entryPoint: r[2] || "",
  action: r[3] || "",
  field: r[4] || "",
  value: r[5] || "",
  status: r[6] || ""
}));

export const header = {
  title: "KEX HyperDrive Control Plane",
  subtitle: "Front-facing dashboard for knowledge sheets, folder substrate entry points, nested SSDs, recursive hyper-computers, MUX display, host chat, and proof ledgers.",
  kexCode: "[KEX_HYPER_DRIVE::10TB_SSD::1000TB_KSSD::fffaeb274e68]",
  proofHash: "fffaeb274e68cde315a45b35d17903ddea85635903fecd15e21e693da8073cbd",
  status: "BOOT: ACTIVE"
};

const numSectors = Object.keys(ssdData.sectors).length;

export const metrics: Metric[] = [
  { label: "Outer Virtual SSD", value: "10 TB", foot: "sparse / 2.44B blocks" },
  { label: "Nested KSSD", value: "1000 TB", foot: "nested / 244B blocks" },
  { label: "Sector Hyper-Computers", value: numSectors.toString(), foot: "seed from SSD route" },
  { label: "Packet Integrity", value: "100%", foot: "29d2d37169c874aca7bd3d..." }
];

export const hyperNodes: HyperNode[] = [
  { title: "Knowledge Sheets", role: "Front-facing registry", status: "ready" },
  { title: "KEX Router", role: "Query engine + watcher", status: "ready" },
  { title: "Folder Substrate", role: "Literal runtime sector", status: "ready" },
  { title: "SSD0", role: "Outer sparse storage (10TB)", status: "ready" },
  { title: "Nested KSSD", role: "Storage inside storage (1000TB)", status: "ready" },
  { title: "CPU Fabric", role: "Opposing execution lanes (X12)", status: "ready" },
  { title: "GPU / MUX", role: "Runtime screen translator", status: "ready" },
  { title: "Host Chat", role: "Bottom direct channel", status: "watch" }
];

export const kexRoute: RouteNode[] = Object.values(ssdData.sectors).map((s: any, index: number) => ({
  index: index + 1,
  name: s.marker,
  className: s.class,
  description: `Offset ${s.offset} - ${s.end_offset} (${s.byte_span_estimate} bytes)`
}));

export const sectors: Sector[] = controlRows.map((r, i) => ({
  id: `HEX-00${i + 1}`,
  address: r.address,
  role: r.target,
  state: r.status
}));

export const muxLines = [
  "KEX MUX SCREEN // VIRTUAL SUBSYSTEM",
  "------------------------------------------------------------",
  `DEVICE: ${ssdData.device}`,
  `PACKET_HASH: 29d2d37169c874aca7bd3d445f0dc21bb1c927283c798f3a7f43a9060ade0eff`,
  `SUBSTRATE_HASH: ca47755528de6b3f3361a91dfe4dadf03d1d19bda265d4d59baea2fcea693e8e`,
  `HYPERDRIVE_HASH: fffaeb274e68cde315a45b35d17903ddea85635903fecd15e21e693da8073cbd`,
  `SECTORS_MOUNTED: ${numSectors}`,
  "",
  ...Object.keys(ssdData.concept).map(k => `CONCEPT [${k.toUpperCase()}]: ${(ssdData.concept as any)[k]}`),
  "",
  "SYSTEM ONLINE. FOLDER SUBSTRATE ACTIVE."
];

export const hostMessages: ChatMessage[] = [
  { actor: "system", time: "00:00", text: "Host bridge ready. Loading physical substrate..." },
  { actor: "system", time: "00:01", text: "Mounted 10TB Outer SSD + 1000TB Nested KSSD." },
  { actor: "system", time: "00:02", text: "Substrate ledger preflight verified: ca477555..." }
];

export const ledgerPackets: LedgerPacket[] = [
  { id: "0001", action: "BOOT_DASHBOARD", hash: "29d2d37169c874aca7bd3d445f0dc21bb1c927283c798f3a7f43a9060ade0eff" },
  { id: "0002", action: "MOUNT_FOLDER_SUBSTRATE", hash: "ca47755528de6b3f3361a91dfe4dadf03d1d19bda265d4d59baea2fcea693e8e" },
  { id: "0003", action: "MOUNT_HYPER_DRIVE", hash: "fffaeb274e68cde315a45b35d17903ddea85635903fecd15e21e693da8073cbd" }
];
