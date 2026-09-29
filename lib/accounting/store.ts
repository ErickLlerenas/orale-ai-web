import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { adminClient } from "@/lib/supabase";
import { parseReport, payoutRows, validateReceipt, type Workspace } from "./ledger.mjs";

const bucketName = "accounting-private";
function localDirectory() {
  if (process.env.NODE_ENV !== "development") return undefined;
  if (process.env.ACCOUNTING_LOCAL_DATA_DIR) return process.env.ACCOUNTING_LOCAL_DATA_DIR;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return join(process.cwd(), ".data", "accounting");
  return undefined;
}
export const emptyWorkspace = (): Workspace => ({ reports: [], links: {}, notes: {}, bank: {} });
async function bucket(create = false) {
  const client = adminClient();
  const { data, error } = await client.storage.getBucket(bucketName);
  if (!data && create) {
    const result = await client.storage.createBucket(bucketName, { public: false, fileSizeLimit: 10_000_000, allowedMimeTypes: ["application/json"] });
    if (result.error && !/already exists/i.test(result.error.message)) throw new Error("No se pudo crear el almacenamiento privado.");
  } else if (error && !/not found/i.test(error.message)) throw new Error("No se pudo consultar el almacenamiento.");
  if (data?.public) throw new Error("El almacenamiento contable debe ser privado.");
  return { storage: client.storage.from(bucketName), exists: Boolean(data) || create };
}
export async function latest(folder: string): Promise<{ key: string; state: Workspace; publishedAt?: string; month?: string } | null> {
  const local = localDirectory();
  if (local) {
    const dir = join(local, folder);
    let names: string[];
    try { names = await readdir(dir); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
    const name = names.filter(n => n.endsWith(".json")).sort().at(-1);
    return name ? { ...JSON.parse(await readFile(join(dir, name), "utf8")), key: `${folder}/${name}` } : null;
  }
  const { storage, exists } = await bucket();
  if (!exists) return null;
  const { data, error } = await storage.list(folder, { limit: 1, sortBy: { column: "name", order: "desc" } });
  if (error) throw new Error("No se pudieron consultar los cierres.");
  if (!data?.length) return null;
  const key = `${folder}/${data[0].name}`;
  const downloaded = await storage.download(key);
  if (downloaded.error) throw new Error("No se pudo abrir el cierre.");
  return { ...JSON.parse(await downloaded.data.text()), key };
}
export async function storeVersion(folder: string, value: object) {
  const key = `${folder}/${Date.now()}-${randomUUID()}.json`;
  const local = localDirectory();
  if (local) { await mkdir(join(local, folder), { recursive: true }); await writeFile(join(local, key), JSON.stringify(value), { flag: "wx", mode: 0o600 }); return key; }
  const { storage } = await bucket(true);
  const { error } = await storage.upload(key, JSON.stringify(value), { contentType: "application/json", upsert: false });
  if (error) throw new Error("No se pudo guardar; conserva tus archivos y vuelve a intentar.");
  return key;
}
export function validateWorkspace(raw: unknown): Workspace {
  const body = raw as Workspace;
  if (!body || !Array.isArray(body.reports) || body.reports.length > 120) throw new Error("Máximo 120 reportes por espacio.");
  const reports = body.reports.map(r => {
    if (typeof r.text !== "string" || r.text.length > 2_000_000 || typeof r.name !== "string") throw new Error("Archivo inválido o demasiado grande.");
    const report = parseReport(r.text, r.name);
    if (r.receipt) report.receipt = validateReceipt(r.receipt);
    const sales = r.sales, salesBase = r.salesBase, salesFee = r.salesFee;
    if (report.kind === "apple" && typeof sales === "number" && Number.isSafeInteger(sales) && sales > 0) report.sales = sales;
    if (report.kind === "apple" && typeof salesBase === "number" && Number.isSafeInteger(salesBase) && salesBase > 0) report.salesBase = salesBase;
    if (report.kind === "apple" && typeof salesFee === "number" && Number.isSafeInteger(salesFee)) report.salesFee = salesFee;
    if ((report.kind === "mercado" || report.kind === "cursor" || report.kind === "chatgpt") && typeof r.file === "string" && r.file.length < 3_000_000 && /^[A-Za-z0-9+/=]+$/.test(r.file)) report.file = r.file;
    return report;
  });
  if (new Set(reports.map(r => r.period)).size !== reports.length) throw new Error("Periodos duplicados.");
  const links: Record<string, string> = {}, notes: Record<string, string> = {}, bank: Record<string, string> = {};
  const ids = new Set(reports.flatMap(r => payoutRows([r], r.period).map(p => p.id)));
  for (const [key, value] of Object.entries(body.links ?? {})) {
    if (!ids.has(key) || !reports.some(r => r.period === value && r.hasOperations)) throw new Error("Vínculo de operaciones inválido.");
    links[key] = value;
  }
  for (const [key, value] of Object.entries(body.notes ?? {})) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key) || typeof value !== "string" || value.length > 5000) throw new Error("Nota inválida.");
    notes[key] = value;
  }
  for (const [key, value] of Object.entries(body.bank ?? {})) {
    if (!ids.has(key) || typeof value !== "string" || (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value))) throw new Error("Fecha bancaria inválida.");
    bank[key] = value;
  }
  return { reports, links, notes, bank };
}
export function monthSnapshot(state: Workspace, month: string): Workspace {
  const payouts = payoutRows(state.reports, month);
  if (!payouts.length) throw new Error("No hay pagos documentados en este mes.");
  const periods = new Set(payouts.flatMap(p => [p.report.period, state.links[p.id]]).filter(Boolean));
  const reports = state.reports.filter(r => periods.has(r.period));
  if (reports.some(r => r.difference !== 0)) throw new Error("Hay diferencias aritméticas en los reportes. Revisa los originales antes de publicar.");
  return { reports, links: Object.fromEntries(payouts.filter(p => state.links[p.id]).map(p => [p.id, state.links[p.id]])), bank: Object.fromEntries(payouts.filter(p => state.bank[p.id]).map(p => [p.id, state.bank[p.id]])), notes: { [month]: state.notes[month] || "" } };
}
