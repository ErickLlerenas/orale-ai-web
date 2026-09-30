"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, Download, AlertCircle, LogOut, CreditCard } from "lucide-react";
import { money, parseReport, appleSales, reportKey, paymentAmount, incomeFigures, type Report } from "@/lib/accounting/ledger.mjs";
import styles from "./accounting.module.css";

const periodName = (value: string) => {
  const label = new Date(`${value}-15T12:00:00`).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
};
async function request(platform: string, body?: object) {
  const response = await fetch(`/contadores/api?view=report&platform=${platform}`, body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || "No se pudo abrir el informe."), { replaceRequired: data.replaceRequired });
  return data as { reports: Report[]; version: string; period?: string; platform?: string };
}
const usd = (cents: number) => `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)} USD`;
const invoiceDate = (period: string) => new Date(`${period}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");

function depositOf(report: Report) {
  return paymentAmount(report) ?? report.totals.closing;
}
function vatDue(report: Report) {
  return incomeFigures(report).preliminaryVat;
}

function Figures({ report, onDownload }: { report: Report; onDownload: (report: Report) => void }) {
  const mercado = report.kind === "mercado";
  const figures = incomeFigures(report);
  const deposit = depositOf(report);
  const rows: { label: string; amount: number | null; hint?: string; kind?: "due" | "deposit" }[] = mercado ? [
    { label: "Ingreso antes de impuestos", amount: report.totals.credit },
    { label: "IVA trasladado", amount: report.totals.tax },
    { label: "IVA retenido", amount: report.totals.other },
    { label: "ISR retenido", amount: report.totals.debit },
    { label: "Depositado en tu cuenta", amount: deposit, kind: "deposit" },
  ] : [
    { label: "Ventas", amount: figures.sales },
    { label: "IVA de las ventas", amount: figures.salesVat },
    { label: "Comisión", amount: figures.fee },
    { label: "IVA de la comisión", amount: figures.feeVat },
    { label: "IVA estimado", amount: figures.preliminaryVat, hint: figures.preliminaryVat == null ? "Falta el detalle de ventas" : undefined, kind: "due" },
    { label: "Depositado en tu cuenta", amount: deposit, kind: "deposit" },
  ];
  return <>
    <dl className={styles.breakdown}>
      {rows.map(row => <div key={row.label} className={row.kind === "deposit" ? styles.deposit : row.kind === "due" ? styles.due : undefined}><dt><span>{row.label}{row.hint && <small>{row.hint}</small>}</span></dt><dd>{row.amount == null ? "Pendiente" : money(row.amount)}</dd></div>)}
    </dl>
    {report.difference !== 0 && <div className={styles.error} role="alert"><AlertCircle/>Diferencia de {money(report.difference)}</div>}
    <button type="button" className={styles.csv} onClick={() => onDownload(report)}><Download/>{mercado ? "PDF" : "CSV"}</button>
  </>;
}

function CardTag({ card }: { card: "personal" | "negocio" }) {
  const personal = card === "personal";
  return <span className={personal ? styles.personal : styles.negocio}>
    <CreditCard aria-hidden="true"/>
    {personal ? "Personal" : "Negocio"}
  </span>;
}

function CursorExpenses({ reports, month, onDownload }: { reports: Report[]; month: string; onDownload: (report: Report) => void }) {
  const paid = reports.filter(report => report.receipt?.month === month).sort((a, b) => a.period.localeCompare(b.period));
  return <section className={styles.entry}>
    <div className={styles.row}><h2>Cursor AI</h2>{paid.length === 0 && <span className={styles.missing}>Sin archivo</span>}</div>
    {paid.length > 0 && <dl className={styles.breakdown}>
      {paid.map(report => <div key={reportKey(report)}><dt><span>{invoiceDate(report.documentDate || report.period.slice(0, 10))}</span><CardTag card="negocio"/><button type="button" className={styles.csv} onClick={() => onDownload(report)}><Download/>PDF</button></dt><dd>{report.receipt?.mxnAmount != null ? money(report.receipt.mxnAmount) + " MXN" : usd(report.totals.closing)}</dd></div>)}
      <div className={styles.deposit}><dt><span>Total</span></dt><dd>{paid.every(report => report.receipt?.mxnAmount != null) ? money(paid.reduce((sum, report) => sum + (report.receipt?.mxnAmount || 0), 0)) + " MXN" : usd(paid.reduce((sum, report) => sum + report.totals.closing, 0))}</dd></div>
    </dl>}
  </section>;
}

function SupabaseExpenses({ reports, month, onDownload }: { reports: Report[]; month: string; onDownload: (report: Report) => void }) {
  const paid = reports.filter(report => report.receipt?.month === month).sort((a, b) => a.period.localeCompare(b.period));
  return <section className={styles.entry}>
    <div className={styles.row}><h2>Supabase</h2>{paid.length === 0 && <span className={styles.missing}>Sin archivo</span>}</div>
    {paid.length > 0 && <dl className={styles.breakdown}>
      {paid.map(report => {
        const card = report.receipt?.cardLast4 || report.cardLast4;
        return <div key={reportKey(report)}><dt><span>{invoiceDate(report.documentDate || report.period)}{!card && <small>El recibo no indica la tarjeta</small>}</span>{card === "0698" || card === "6271" ? <CardTag card={card === "0698" ? "personal" : "negocio"}/> : card ? <span>Tarjeta ···· {card}</span> : null}<button type="button" className={styles.csv} onClick={() => onDownload(report)}><Download/>PDF</button></dt><dd>{usd(report.totals.closing)}</dd></div>;
      })}
      <div className={styles.deposit}><dt><span>Total</span></dt><dd>{usd(paid.reduce((sum, report) => sum + report.totals.closing, 0))}</dd></div>
    </dl>}
  </section>;
}

function ChatgptExpenses({ reports, month, onDownload }: { reports: Report[]; month: string; onDownload: (report: Report) => void }) {
  const paid = reports.filter(report => report.receipt?.month === month).sort((a, b) => a.period.localeCompare(b.period));
  return <section className={styles.entry}>
    <div className={styles.row}><h2>ChatGPT</h2>{paid.length === 0 && <span className={styles.missing}>Sin archivo</span>}</div>
    {paid.length > 0 && <dl className={styles.breakdown}>
      {paid.map(report => <div key={reportKey(report)}><dt><span>{invoiceDate(report.documentDate || report.period.slice(0, 10))}</span><CardTag card="personal"/><button type="button" className={styles.csv} onClick={() => onDownload(report)}><Download/>PDF</button></dt><dd>{money(report.totals.closing)} MXN</dd></div>)}
      <div className={styles.deposit}><dt><span>Total</span></dt><dd>{money(paid.reduce((sum, report) => sum + report.totals.closing, 0))} MXN</dd></div>
    </dl>}
  </section>;
}

function FacebookExpenses({ reports, month, onDownload }: { reports: Report[]; month: string; onDownload: (report: Report) => void }) {
  const paid = reports.filter(report => report.receipt?.month === month).sort((a, b) => a.period.localeCompare(b.period));
  return <section className={styles.entry}>
    <div className={styles.row}><h2>Facebook Ads</h2>{paid.length === 0 && <span className={styles.missing}>Sin archivo</span>}</div>
    {paid.map(report => <div key={reportKey(report)}>
      <dl className={styles.breakdown}>
        {report.rows.map(row => <div key={row.line}><dt><span>{invoiceDate(row.iso || row.date)}</span><CardTag card="negocio"/></dt><dd>{money(row.amount)} MXN</dd></div>)}
        <div className={styles.deposit}><dt><span>Total pagado</span></dt><dd>{money(report.totals.closing)} MXN</dd></div>
      </dl>
      <p className={styles.taxNote}>Este total incluye {money(report.totals.tax || 0)} MXN de IVA.</p>
      <button type="button" className={styles.csv} onClick={() => onDownload(report)}><Download/>CSV</button>
    </div>)}
  </section>;
}

function GoogleExpenses({ reports, month, onDownload }: { reports: Report[]; month: string; onDownload: (report: Report) => void }) {
  const paid = reports.filter(report => report.receipt?.month === month).sort((a, b) => a.period.localeCompare(b.period));
  return <section className={styles.entry}>
    <div className={styles.row}><h2>Google Ads</h2>{paid.length === 0 && <span className={styles.missing}>Sin archivo</span>}</div>
    {paid.length > 0 && <>
    <dl className={styles.breakdown}>
      {paid.map(report => <div key={reportKey(report)}><dt><span>{invoiceDate(report.period.slice(0, 10))}</span><CardTag card="personal"/><button type="button" className={styles.csv} onClick={() => onDownload(report)}><Download/>XML</button></dt><dd>{money(report.totals.closing)} MXN</dd></div>)}
      <div className={styles.deposit}><dt><span>Total pagado</span></dt><dd>{money(paid.reduce((sum, report) => sum + report.totals.closing, 0))} MXN</dd></div>
    </dl>
    <p className={styles.taxNote}>Este total incluye {money(paid.reduce((sum, report) => sum + (report.totals.tax || 0), 0))} MXN de IVA.</p>
    </>}
  </section>;
}

function PendingExpense({ title }: { title: string }) {
  return <section className={styles.entry}>
    <div className={styles.row}><h2>{title}</h2><span className={styles.missing}>Sin archivo</span></div>
  </section>;
}

function Platform({ title, reports, month, onDownload, card }: { title: string; reports: Report[]; month: string; onDownload: (report: Report) => void; card?: "personal" | "negocio" }) {
  const paid = reports.filter(report => report.receipt?.month === month);
  return <section className={styles.entry}>
    <div className={styles.row}>
      <div className={styles.name}><h2>{title}</h2>{card && <CardTag card={card}/>}</div>
      {paid.length === 0 && <span className={styles.missing}>Sin archivo</span>}
    </div>
    {paid.map(report => <Figures key={reportKey(report)} report={report} onDownload={onDownload}/>)}
  </section>;
}

export default function AccountingPortal({ role, local = false }: { role: "owner" | "reader"; local?: boolean }) {
  const [month, setMonth] = useState(new Date().toLocaleDateString("en-CA").slice(0, 7));
  const [play, setPlay] = useState<{ reports: Report[]; version: string }>({ reports: [], version: "" });
  const [apple, setApple] = useState<{ reports: Report[]; version: string }>({ reports: [], version: "" });
  const [stripe, setStripe] = useState<{ reports: Report[]; version: string }>({ reports: [], version: "" });
  const [mercado, setMercado] = useState<{ reports: Report[]; version: string }>({ reports: [], version: "" });
  const [cursor, setCursor] = useState<{ reports: Report[]; version: string }>({ reports: [], version: "" });
  const [chatgpt, setChatgpt] = useState<{ reports: Report[]; version: string }>({ reports: [], version: "" });
  const [google, setGoogle] = useState<{ reports: Report[]; version: string }>({ reports: [], version: "" });
  const [supabase, setSupabase] = useState<{ reports: Report[]; version: string }>({ reports: [], version: "" });
  const [facebook, setFacebook] = useState<{ reports: Report[]; version: string }>({ reports: [], version: "" });
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"ingresos" | "gastos" | "banco">("ingresos");
  const input = useRef<HTMLInputElement>(null);
  const paid = [...play.reports, ...apple.reports, ...stripe.reports, ...mercado.reports].filter(report => report.receipt?.month === month);

  useEffect(() => {
    const selected = new URLSearchParams(location.search).get("mes");
    if (selected && /^\d{4}-(0[1-9]|1[0-2])$/.test(selected)) setMonth(selected);
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    Promise.all([request("play"), request("apple"), request("stripe"), request("mercado"), request("cursor"), request("facebook"), request("chatgpt"), request("google"), request("supabase")]).then(([playData, appleData, stripeData, mercadoData, cursorData, facebookData, chatgptData, googleData, supabaseData]) => {
      if (cancelled) return;
      setPlay(playData); setApple(appleData); setStripe(stripeData); setMercado(mercadoData); setCursor(cursorData); setFacebook(facebookData); setChatgpt(chatgptData); setGoogle(googleData); setSupabase(supabaseData); setReady(true);
    }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function openMonth(value: string) {
    setMonth(value); setError("");
    const url = new URL(location.href);
    url.searchParams.set("mes", value);
    url.searchParams.delete("reporte");
    url.searchParams.delete("platform");
    history.replaceState(null, "", url);
  }
  async function upload(files?: FileList | null) {
    const list = files ? [...files].sort((a, b) => Number(/PlayApps_|MexicoCommissionInvoice|\.txt$/i.test(a.name)) - Number(/PlayApps_|MexicoCommissionInvoice|\.txt$/i.test(b.name))) : [];
    if (!list.length || busy) return;
    setBusy(true); setError("");
    const versions: Record<string, string> = { play: play.version, apple: apple.version, stripe: stripe.version, mercado: mercado.version, cursor: cursor.version, facebook: facebook.version, chatgpt: chatgpt.version, google: google.version, supabase: supabase.version };
    try {
      for (const file of list) {
        if (file.size > 2_000_000) throw new Error("El archivo debe pesar menos de 2 MB.");
        let platform: string, body: Record<string, unknown>;
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ""; bytes.forEach(byte => { binary += String.fromCharCode(byte); });
          platform = "pdf"; body = { action: "upload-report", month, report: { name: file.name, pdf: btoa(binary) }, versions };
        } else {
          const text = await file.text(), source = { name: file.name, text };
          if (text.includes("Customer Price") && text.includes("\tQuantity")) {
            const sales = appleSales(text, file.name); platform = "apple";
            body = { action: "attach-sales", period: sales.period, source, version: versions.apple };
          } else {
            const parsed = parseReport(text, file.name);
            platform = parsed.kind === "earnings" || !parsed.kind ? "play" : parsed.kind;
            body = parsed.kind === "earnings" ? { action: "attach-earnings", period: parsed.period, source, version: versions.play } : { action: "upload-report", month, report: source, version: versions[platform] };
          }
        }
        let data;
        try { data = await request(platform, body); }
        catch (e) {
          if (!(e instanceof Error && "replaceRequired" in e && e.replaceRequired && confirm(`¿Reemplazar ${file.name}?`))) throw e;
          data = await request(platform, { ...body, replace: true });
        }
        platform = data.platform || platform; versions[platform] = data.version;
        if (platform === "apple") setApple(data); else if (platform === "stripe") setStripe(data); else if (platform === "mercado") setMercado(data);
        else if (platform === "cursor") { setCursor(data); setTab("gastos"); } else if (platform === "chatgpt") { setChatgpt(data); setTab("gastos"); }
        else if (platform === "supabase") { setSupabase(data); setTab("gastos"); }
        else if (platform === "facebook") { setFacebook(data); setTab("gastos"); } else if (platform === "google") { setGoogle(data); setTab("gastos"); } else setPlay(data);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el archivo."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  async function logout() {
    await fetch("/contadores/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    location.assign("/contadores/login");
  }
  function download(report: Report) {
    const bytes = report.file ? Uint8Array.from(atob(report.file), char => char.charCodeAt(0)) : null;
    const type = bytes ? "application/pdf" : report.name.toLowerCase().endsWith(".xml") ? "application/xml" : "text/csv;charset=utf-8";
    const url = URL.createObjectURL(bytes ? new Blob([bytes], { type }) : new Blob([report.text], { type }));
    const existing = document.getElementById("statement-download");
    const a = existing instanceof HTMLAnchorElement ? existing : document.createElement("a");
    a.id = "statement-download";
    a.href = url;
    a.download = report.name;
    a.rel = "noopener";
    a.style.display = "none";
    if (!a.isConnected) {
      a.addEventListener("click", event => event.stopPropagation());
      document.body.appendChild(a);
    }
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return <div className={styles.portal}><main className={styles.main}>
    <header className={styles.header}>
      <a href="/contadores" className={styles.brand}>Órale AI<span>Contabilidad</span></a>
      <div className={styles.tools}>
        <input aria-label="Mes" type="month" value={month} disabled={busy} onChange={e => { if (e.target.value) openMonth(e.target.value); }}/>
        {role === "owner" && <button className={styles.primary} disabled={busy || loading} onClick={() => input.current?.click()}><Upload/>{busy ? "Subiendo…" : "Subir archivo"}</button>}
        <button type="button" onClick={logout}><LogOut/>Salir</button>
      </div>
    </header>
    {local && <p className={styles.preview}>Prueba local. Este enlace todavía no se puede abrir desde otra computadora.</p>}
    {error && <div className={styles.error} role="alert"><AlertCircle/>{error}</div>}
    <div className={styles.tabs} role="tablist" aria-label="Sección">
      <button type="button" role="tab" aria-selected={tab === "ingresos"} onClick={() => setTab("ingresos")}>Ingresos</button>
      <button type="button" role="tab" aria-selected={tab === "gastos"} onClick={() => setTab("gastos")}>Gastos</button>
      <button type="button" role="tab" aria-selected={tab === "banco"} onClick={() => setTab("banco")}>Estado de cuenta</button>
    </div>
    <h1>{periodName(month)}{tab === "ingresos" && <small>MXN</small>}</h1>
    {loading ? <div role="status" className={styles.empty}>Cargando</div> : ready && tab === "ingresos" && <>
      <Platform title="Google Play" reports={play.reports} month={month} onDownload={download}/>
      <Platform title="App Store" reports={apple.reports} month={month} onDownload={download}/>
      <Platform title="Stripe" reports={stripe.reports} month={month} onDownload={download}/>
      <Platform title="Mercado Libre Afiliados" reports={mercado.reports} month={month} onDownload={download}/>
      {paid.length > 0 && <div className={styles.totals}>
        <div><span>Total depositado</span><strong>{money(paid.reduce((sum, report) => sum + depositOf(report), 0))}</strong></div>
        <div><span>IVA estimado</span><strong>{paid.some(report => vatDue(report) == null) ? "Pendiente" : money(paid.reduce((sum, report) => sum + (vatDue(report) || 0), 0))}</strong></div>
      </div>}
    </>}
    {ready && tab === "gastos" && <>
      <CursorExpenses reports={cursor.reports} month={month} onDownload={download}/>
      <ChatgptExpenses reports={chatgpt.reports} month={month} onDownload={download}/>
      <FacebookExpenses reports={facebook.reports} month={month} onDownload={download}/>
      <GoogleExpenses reports={google.reports} month={month} onDownload={download}/>
      <SupabaseExpenses reports={supabase.reports} month={month} onDownload={download}/>
      <PendingExpense title="Google Cloud"/>
    </>}
    {ready && tab === "banco" && <Platform title="Estado de cuenta" reports={[]} month={month} onDownload={download}/>}
    <input ref={input} hidden type="file" multiple accept=".csv,.txt,.pdf,.xml,text/csv,text/plain,application/pdf,application/xml,text/xml" onChange={e => upload(e.target.files)}/>
  </main></div>;
}
