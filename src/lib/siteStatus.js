import fs from "node:fs";
import path from "node:path";
import { fetchPanelData } from "@/lib/adminData";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "maintenance.json");

export const DEFAULT_MESSAGE = "MAAF SERVER SEDANG DALAM MASA PEMELIHARAAN";

export async function readMaintenance() {
  // Prioritas: admin panel remote → file lokal → env MAINTENANCE
  const panel = await fetchPanelData("/api/public/site-status");
  if (panel) {
    return { enabled: Boolean(panel.enabled), message: panel.message || DEFAULT_MESSAGE };
  }
  let enabled = false;
  let message = DEFAULT_MESSAGE;
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    enabled = Boolean(raw?.enabled);
    if (raw?.message) message = String(raw.message);
  } catch {}
  if (process.env.MAINTENANCE === "1" || process.env.MAINTENANCE === "true") enabled = true;
  return { enabled, message };
}

export async function writeMaintenance(enabled, message) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ enabled: Boolean(enabled), message: message || DEFAULT_MESSAGE }, null, 2),
      "utf8"
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, code: "READ_ONLY_FS", message: String(err?.message || err) };
  }
}
