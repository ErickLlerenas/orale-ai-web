import { NextRequest, NextResponse } from "next/server";
import { sessionRole, sessionCookie } from "@/lib/accounting/access";
import { emptyWorkspace, latest, storeVersion, validateWorkspace, monthSnapshot } from "@/lib/accounting/store";
import { reportKey, upsertReport, attachPlayEarnings, attachAppleSales, appleCommissionInvoice, attachAppleCommission } from "@/lib/accounting/ledger.mjs";
import { extractPdfText } from "@/lib/accounting/pdf.mjs";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
const validMonth = (month: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
const collectionOf = (platform: string | null) => platform === "apple" ? "apple-reports" : platform === "stripe" ? "stripe-reports" : platform === "mercado" ? "mercado-reports" : platform === "cursor" ? "cursor-reports" : platform === "facebook" ? "facebook-reports" : platform === "chatgpt" ? "chatgpt-reports" : platform === "supabase" ? "supabase-reports" : platform === "google" ? "google-reports" : "simple-reports";
const platformOf = (kind?: string) => kind === "apple" || kind === "stripe" || kind === "mercado" || kind === "cursor" || kind === "facebook" || kind === "chatgpt" || kind === "google" || kind === "supabase" ? kind : "play";
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
      return json({ reports: record ? validateWorkspace(record.state).reports : [], version: record?.key ?? "" });
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
    if (body.action === "attach-sales" || body.action === "attach-earnings") {
      const collection = body.action === "attach-sales" ? "apple-reports" : "simple-reports";
      const current = await latest(collection);
      if (body.version !== (current?.key ?? "")) return json({ error: "Hay información más reciente. Recarga antes de guardar." }, 409);
      const state = validateWorkspace(current?.state ?? emptyWorkspace());
      const index = state.reports.findIndex(r => r.period === body.period && (body.action === "attach-sales" ? r.kind === "apple" : !r.kind));
      if (index < 0) return json({ error: "Primero sube el reporte principal de ese periodo." }, 400);
      if (typeof body.source?.text !== "string" || body.source.text.length > 2_000_000 || typeof body.source.name !== "string") return json({ error: "Detalle inválido." }, 400);
      state.reports[index] = body.action === "attach-sales" ? attachAppleSales(state.reports[index], body.source) : attachPlayEarnings(state.reports[index], body.source);
      const validated = validateWorkspace(state);
      const version = await storeVersion(collection, { state: validated });
      return json({ reports: validated.reports, version });
    }
    if (body.action === 'record-receipt') {
      const collection = collectionOf(req.nextUrl.searchParams.get('platform'));
      const current = await latest(collection);
      if (body.version !== (current?.key ?? '')) return json({ error: 'Hay información más reciente. Recarga antes de guardar.' }, 409);
      const currentState = validateWorkspace(current?.state ?? emptyWorkspace());
      const matches = (r: typeof currentState.reports[number]) => body.reportId ? reportKey(r) === body.reportId : r.period === body.period;
      if (currentState.reports.filter(matches).length !== 1) return json({ error: 'No se encontró el reporte.' }, 400);
      const state = validateWorkspace({ ...currentState, reports: currentState.reports.map(r => matches(r) ? { ...r, receipt: body.receipt } : r) });
      const version = await storeVersion(collection, { state });
      return json({ reports: state.reports, version });
    }
    if (body.action === "upload-report") {
      if (typeof body.report?.pdf === "string") {
        const bytes = Buffer.from(body.report.pdf, "base64");
        if (!bytes.length || bytes.length > 2_000_000) return json({ error: "El PDF debe pesar menos de 2 MB." }, 400);
        body.report = { name: String(body.report.name || "mercado.pdf"), text: extractPdfText(bytes), file: body.report.pdf };
      }
      if (typeof body.report?.text === "string" && body.report.text.includes("Mexico Commission Invoice")) {
        if (!validMonth(body.month || "")) return json({ error: "Elige el mes del depósito." }, 400);
        const invoice = appleCommissionInvoice(body.report.text, body.report.name);
        const current = await latest("apple-reports");
        if ((body.versions?.apple ?? body.version) !== (current?.key ?? "")) return json({ error: "Hay información más reciente. Recarga antes de subir el archivo." }, 409);
        const state = validateWorkspace(current?.state ?? emptyWorkspace());
        const index = state.reports.findIndex(r => r.kind === "apple" && r.period === invoice.period && r.receipt?.month === body.month);
        if (index < 0) return json({ error: "Primero sube el reporte financiero de Apple en el mes de su depósito." }, 400);
        const previous = state.reports[index].commissionSource;
        if (previous && previous.text !== body.report.text && body.replace !== true) return json({ error: "Ya existe otra factura de comisión. Confirma su reemplazo.", replaceRequired: true }, 409);
        state.reports[index] = attachAppleCommission(state.reports[index], body.report);
        const validated = validateWorkspace(state);
        const version = await storeVersion("apple-reports", { state: validated });
        return json({ reports: validated.reports, version, period: invoice.period, platform: "apple" });
      }
      const requested = req.nextUrl.searchParams.get("platform");
      const detected = requested === "pdf" ? platformOf((validateWorkspace({ ...emptyWorkspace(), reports: [body.report] }).reports[0]).kind) : requested;
      const platform = detected === "cursor" || detected === "mercado" || detected === "apple" || detected === "stripe" || detected === "facebook" || detected === "chatgpt" || detected === "google" || detected === "supabase" ? detected : "play";
      const collection = collectionOf(platform);
      const current = await latest(collection);
      const expected = requested === "pdf" ? body.versions?.[platform] ?? "" : body.version;
      if (expected !== (current?.key ?? "")) return json({ error: "Hay información más reciente. Recarga antes de subir el archivo." }, 409);
      const uploaded = validateWorkspace({ ...emptyWorkspace(), reports: [body.report] }).reports[0];
      if (platformOf(uploaded.kind) !== platform || uploaded.kind === "earnings") return json({ error: "Sube el detalle PlayApps como complemento del reporte de actividades." }, 400);
      if (!validMonth(body.month || "")) return json({ error: "Elige el mes del depósito o pago." }, 400);
      const currentState = validateWorkspace(current?.state ?? emptyWorkspace());
      const existing = currentState.reports.find(r => reportKey(r) === reportKey(uploaded));
      if (existing && existing.text !== uploaded.text && body.replace !== true) return json({ error: "Ya existe otro archivo para este documento o periodo. Confirma su reemplazo.", replaceRequired: true }, 409);
      const state = validateWorkspace({ ...currentState, reports: upsertReport(currentState.reports, uploaded, body.month) });
      const version = await storeVersion(collection, { state });
      return json({ reports: state.reports, version, period: uploaded.period, reportId: reportKey(uploaded), platform });
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
