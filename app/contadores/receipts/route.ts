import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { sessionRole, sessionCookie } from "@/lib/accounting/access";
import { emptyWorkspace, latest, storeVersion } from "@/lib/accounting/store";
import { bankCategory, mergeBankDocuments, type BankDocument } from "@/lib/accounting/bank-ledger.mjs";
import { assignReceipt, validateReceiptFile, type BankReceipt } from "@/lib/accounting/bank-receipts.mjs";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const validMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
async function current(month: string) {
  const record = await latest(`bank-receipts/${month}`) as unknown as { key: string; receipts?: BankReceipt[] } | null;
  return { receipts: record?.receipts ?? [], version: record?.key ?? "" };
}
export async function GET(req: NextRequest) {
  if (!await sessionRole(req.cookies.get(sessionCookie)?.value, req.headers.get("host"))) return json({ error: "Acceso restringido." }, 401);
  const month = req.nextUrl.searchParams.get("month") || "";
  if (!validMonth(month)) return json({ error: "Mes inválido." }, 400);
  try {
    const saved = await current(month), id = req.nextUrl.searchParams.get("id");
    if (!id) return json(saved);
    const receipt = saved.receipts.find(item => item.id === id);
    const original = receipt ? await latest(`bank-receipts-files/${month}/${receipt.id}`) as unknown as { file: string } | null : null;
    if (!receipt || !original) return json({ error: "Archivo no encontrado." }, 404);
    return new NextResponse(Buffer.from(original.file, "base64"), { headers: { ...headers, "Content-Type": receipt.type === "pdf" ? "application/pdf" : "application/xml", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(receipt.name)}` } });
  } catch { return json({ error: "No se pudieron abrir los comprobantes." }, 503); }
}
export async function POST(req: NextRequest) {
  if (await sessionRole(req.cookies.get(sessionCookie)?.value, req.headers.get("host")) !== "owner") return json({ error: "Solo el administrador puede subir archivos." }, 403);
  try {
    const origin = new URL(req.headers.get("origin") || "");
    if (origin.host !== req.headers.get("host") || (process.env.NODE_ENV === "production" && origin.protocol !== "https:") || !req.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Solicitud no permitida." }, 403);
  } catch { return json({ error: "Solicitud no permitida." }, 403); }
  try {
    const raw = await req.text();
    if (raw.length > 3_000_000) return json({ error: "El comprobante debe pesar menos de 2 MB." }, 413);
    const body = JSON.parse(raw);
    if (!validMonth(body.month || "")) return json({ error: "Mes inválido." }, 400);
    const saved = await current(body.month);
    if (body.version !== saved.version) return json({ error: "Hay información más reciente. Recarga antes de guardar." }, 409);
    const file = validateReceiptFile(body.file, bytes => createHash("sha256").update(bytes).digest("hex"));
    const bank = await latest(`bank-banamex/${body.month}`) as unknown as { bankDocuments?: BankDocument[] } | null;
    const rows = mergeBankDocuments(bank?.bankDocuments ?? [], body.month).rows.map(row => ({ ...row, category: bankCategory(row) }));
    const receipts = assignReceipt(saved.receipts, rows, { id: file.id, name: file.name, type: file.type, category: body.category });
    if (receipts === saved.receipts) return json(saved);
    if (!await latest(`bank-receipts-files/${body.month}/${file.id}`)) await storeVersion(`bank-receipts-files/${body.month}/${file.id}`, { file: file.data });
    const version = await storeVersion(`bank-receipts/${body.month}`, { state: emptyWorkspace(), receipts });
    return json({ receipts, version });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "No se pudo guardar el comprobante." }, 400); }
}
