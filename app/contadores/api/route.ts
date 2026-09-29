import { NextRequest, NextResponse } from "next/server";
import { sessionRole, sessionCookie } from "@/lib/accounting/access";
import { emptyWorkspace, latest, storeVersion, validateWorkspace, monthSnapshot } from "@/lib/accounting/store";
import { extractPdfText } from "@/lib/accounting/pdf.mjs";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
const validMonth = (month: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
const collectionOf = (platform: string | null) => platform === "apple" ? "apple-reports" : platform === "stripe" ? "stripe-reports" : platform === "mercado" ? "mercado-reports" : platform === "cursor" ? "cursor-reports" : platform === "facebook" ? "facebook-reports" : platform === "chatgpt" ? "chatgpt-reports" : "simple-reports";
const platformOf = (kind?: string) => kind === "apple" || kind === "stripe" || kind === "mercado" || kind === "cursor" || kind === "facebook" || kind === "chatgpt" ? kind : "play";
export async function GET(req: NextRequest) {
  const role = await sessionRole(req.cookies.get(sessionCookie)?.value, req.headers.get("host"));
  if (!role) return json({ error: "Acceso restringido." }, 401);
  try {
    if (req.nextUrl.searchParams.get("view") === "receipts") {
      const play = await latest("simple-reports");
      const apple = await latest("apple-reports");
      return json({ play: play?.state.reports ?? [], apple: apple?.state.reports ?? [] });
    }
    if (req.nextUrl.searchParams.get("view") === "report") {
      const record = await latest(collectionOf(req.nextUrl.searchParams.get("platform")));
      return json({ reports: record?.state.reports ?? [], version: record?.key ?? "" });
    }
    const month = req.nextUrl.searchParams.get("month") || new Date().toISOString().slice(0, 7);
    if (!validMonth(month)) return json({ error: "Mes inválido." }, 400);
    const review = role === "reader" || req.nextUrl.searchParams.get("review") === "1";
    const record = await latest(review ? `published/${month}` : "drafts");
    return json({ state: record?.state ?? emptyWorkspace(), version: record?.key ?? "", role, review, publishedAt: record?.publishedAt ?? null, month });
  } catch { return json({ error: "No se pudo abrir el almacenamiento contable. Comprueba la configuración de Supabase." }, 503); }
}
export async function POST(req: NextRequest) {
  if (await sessionRole(req.cookies.get(sessionCookie)?.value, req.headers.get("host")) !== "owner") return json({ error: "Solo el preparador puede modificar o publicar." }, 403);
  const origin = req.headers.get("origin");
  let sameOrigin = false;
  try {
    const parsed = new URL(origin || "");
    sameOrigin = parsed.host === req.headers.get("host") && (process.env.NODE_ENV !== "production" || parsed.protocol === "https:");
  } catch { /* A missing or malformed Origin must fail closed. */ }
  if (!sameOrigin || !req.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Solicitud no permitida." }, 403);
  try {
    const raw = await req.text();
    if (raw.length > 3_500_000) return json({ error: "El espacio supera 3.5 MB. Reduce el tamaño de los archivos." }, 413);
    const body = JSON.parse(raw);
    if (body.action === "attach-sales") {
      const current = await latest("apple-reports");
      if (body.version !== (current?.key ?? "")) return json({ error: "Hay información más reciente. Recarga antes de guardar." }, 409);
      if (!current?.state.reports.some(r => r.kind === "apple" && r.period === body.period)) return json({ error: "Primero sube el CSV de App Store de ese periodo." }, 400);
      if (!Number.isSafeInteger(body.sales) || body.sales <= 0) return json({ error: "El detalle de App Store no contiene suscripciones." }, 400);
      const salesBase = Number.isSafeInteger(body.base) && body.base > 0 ? body.base : undefined;
      const salesFee = Number.isSafeInteger(body.fee) ? body.fee : undefined;
      const state = validateWorkspace({ ...current.state, reports: current.state.reports.map(r => r.period === body.period ? { ...r, sales: body.sales, salesBase, salesFee } : r) });
      const version = await storeVersion("apple-reports", { state });
      return json({ reports: state.reports, version });
    }
    if (body.action === 'record-receipt') {
      const collection = collectionOf(req.nextUrl.searchParams.get('platform'));
      const current = await latest(collection);
      if (body.version !== (current?.key ?? '')) return json({ error: 'Hay información más reciente. Recarga antes de guardar.' }, 409);
      if (!current?.state.reports.some(r => r.period === body.period)) return json({ error: 'No se encontró el reporte.' }, 400);
      const state = validateWorkspace({ ...current.state, reports: current.state.reports.map(r => r.period === body.period ? { ...r, receipt: body.receipt } : r) });
      const version = await storeVersion(collection, { state });
      return json({ reports: state.reports, version });
    }
    if (body.action === "upload-report") {
      if (typeof body.report?.pdf === "string") {
        const bytes = Buffer.from(body.report.pdf, "base64");
        if (!bytes.length || bytes.length > 2_000_000) return json({ error: "El PDF debe pesar menos de 2 MB." }, 400);
        body.report = { name: String(body.report.name || "mercado.pdf"), text: extractPdfText(bytes), file: body.report.pdf };
      }
      const requested = req.nextUrl.searchParams.get("platform");
      const detected = requested === "pdf" ? platformOf((validateWorkspace({ ...emptyWorkspace(), reports: [body.report] }).reports[0]).kind) : requested;
      const platform = detected === "cursor" || detected === "mercado" || detected === "apple" || detected === "stripe" || detected === "facebook" || detected === "chatgpt" ? detected : "play";
      const collection = collectionOf(platform);
      const current = await latest(collection);
      const expected = requested === "pdf" ? body.versions?.[platform] ?? "" : body.version;
      if (expected !== (current?.key ?? "")) return json({ error: "Hay información más reciente. Recarga antes de subir el archivo." }, 409);
      const uploaded = validateWorkspace({ ...emptyWorkspace(), reports: [body.report] }).reports[0];
      const existing = current?.state.reports.find(r => r.period === uploaded.period);
      uploaded.receipt = existing?.text === uploaded.text ? existing.receipt : undefined;
      if (existing?.sales) uploaded.sales = existing.sales;
      if (existing?.salesBase) uploaded.salesBase = existing.salesBase;
      if (existing?.salesFee != null) uploaded.salesFee = existing.salesFee;
      if (platformOf(uploaded.kind) !== platform) return json({ error: "El archivo no corresponde a la plataforma seleccionada." }, 400);
      const state = validateWorkspace({
        ...emptyWorkspace(),
        reports: [...(current?.state.reports ?? []).filter(r => r.period !== uploaded.period), uploaded]
          .sort((a, b) => b.period.localeCompare(a.period)),
      });
      const version = await storeVersion(collection, { state });
      return json({ reports: state.reports, version, period: uploaded.period, platform });
    }
    const current = await latest("drafts");
    if (body.version !== (current?.key ?? "")) return json({ error: "Hay una versión más reciente. Recarga antes de guardar." }, 409);
    if (body.action === "save") {
      const state = validateWorkspace(body.state);
      const version = await storeVersion("drafts", { state });
      return json({ version });
    }
    if (body.action === "publish" && validMonth(body.month)) {
      const state = monthSnapshot(current?.state ?? emptyWorkspace(), body.month);
      const publishedAt = new Date().toISOString();
      await storeVersion(`published/${body.month}`, { state, month: body.month, publishedAt });
      return json({ publishedAt, url: `/contadores?mes=${body.month}&vista=publicado` });
    }
    return json({ error: "Acción inválida." }, 400);
  } catch (error) { return json({ error: error instanceof Error ? error.message : "No se pudo guardar." }, 400); }
}
