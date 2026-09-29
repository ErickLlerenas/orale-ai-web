"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, Download, AlertCircle, Printer } from "lucide-react";
import { money, parseReport, appleSales, type Report } from "@/lib/accounting/ledger.mjs";
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
  if (!response.ok) throw new Error(data.error || "No se pudo abrir el informe.");
  return data as { reports: Report[]; version: string };
}

function depositOf(report: Report) {
  return report.totals.closing;
}

function Figures({ report, onDownload }: { report: Report; onDownload: (report: Report) => void }) {
  const apple = report.kind === "apple";
  const sales = apple ? report.sales || 0 : report.totals.credit || 0;
  const base = apple ? report.salesBase || (sales ? Math.round(sales / 1.16) : 0) : sales;
  const salesVat = apple ? sales - base : Math.round(sales * 0.16);
  const earned = apple ? report.totals.credit || 0 : 0;
  const fee = apple ? (report.salesFee ?? base - earned) : Math.abs(report.totals.debit || 0);
  const platformVat = apple ? salesVat - (report.totals.other || 0) : Math.abs(report.totals.tax || 0);
  const rows: { label: string; amount: number; hint?: string; kind?: "due" | "deposit" }[] = [
    { label: "Ventas", amount: sales },
    { label: "Sin IVA", amount: base },
    { label: "IVA de ventas", amount: salesVat, hint: apple ? "Incluido en las ventas" : "16% de las ventas" },
    { label: "Comisión", amount: fee },
    { label: "Ganado", amount: apple ? earned : base - fee },
    { label: "IVA/ajuste de la plataforma", amount: platformVat },
    { label: "IVA a pagar", amount: apple ? report.totals.other || 0 : salesVat - platformVat, hint: "IVA de ventas − IVA de la comisión", kind: "due" },
    { label: "Depositado", amount: depositOf(report), kind: "deposit" },
  ];
  return <>
    <dl className={styles.breakdown}>
      {rows.filter(row => row.amount !== 0 || row.kind === "deposit").map(row => <div key={row.label} className={row.kind === "deposit" ? styles.deposit : row.kind === "due" ? styles.due : undefined}><dt>{row.label}{row.hint && <small>{row.hint}</small>}</dt><dd>{money(row.amount)}</dd></div>)}
    </dl>
    {report.difference !== 0 && <div className={styles.error} role="alert"><AlertCircle/>Diferencia de {money(report.difference)}</div>}
    <button type="button" className={styles.csv} onClick={() => onDownload(report)}><Download/>CSV</button>
  </>;
}

function Platform({ title, reports, month, onDownload }: { title: string; reports: Report[]; month: string; onDownload: (report: Report) => void }) {
  const paid = reports.filter(report => report.receipt?.month === month);
  return <section className={styles.entry}>
    <div className={styles.row}>
      <h2>{title}</h2>
      {paid.length === 0 && <span className={styles.missing}>Sin archivo</span>}
    </div>
    {paid.map(report => <Figures key={report.period} report={report} onDownload={onDownload}/>)}
  </section>;
}

export default function AccountingPortal({ role, local = false }: { role: "owner" | "reader"; local?: boolean }) {
  const [month, setMonth] = useState(new Date().toLocaleDateString("en-CA").slice(0, 7));
  const [play, setPlay] = useState<{ reports: Report[]; version: string }>({ reports: [], version: "" });
  const [apple, setApple] = useState<{ reports: Report[]; version: string }>({ reports: [], version: "" });
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const deposited = [...play.reports, ...apple.reports].filter(report => report.receipt?.month === month).map(depositOf);

  useEffect(() => {
    const selected = new URLSearchParams(location.search).get("mes");
    if (selected && /^\d{4}-(0[1-9]|1[0-2])$/.test(selected)) setMonth(selected);
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    Promise.all([request("play"), request("apple")]).then(([playData, appleData]) => {
      if (cancelled) return;
      setPlay(playData); setApple(appleData); setReady(true);
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
  async function upload(file?: File) {
    if (!file || busy) return;
    setBusy(true); setError("");
    try {
      if (file.size > 2_000_000) throw new Error("El archivo debe pesar menos de 2 MB.");
      const text = await file.text();
      if (text.includes("Customer Price")) {
        const sales = appleSales(text, file.name);
        const paid = await request("apple", { action: "attach-sales", period: sales.period, sales: sales.customer, base: sales.base, fee: sales.fee, version: apple.version });
        setApple(paid);
        return;
      }
      const parsed = parseReport(text, file.name);
      const platform = parsed.kind === "apple" ? "apple" : "play";
      const current = platform === "apple" ? apple : play;
      const existing = current.reports.find(r => r.period === parsed.period);
      if (existing && existing.text !== parsed.text && !confirm(`¿Reemplazar ${file.name}?`)) return;
      const data = await request(platform, { action: "upload-report", report: { name: file.name, text: parsed.text }, version: current.version });
      const saved = data.reports.find(report => report.period === parsed.period);
      if (!saved) throw new Error("No se pudo guardar el archivo.");
      const paid = await request(platform, { action: "record-receipt", period: saved.period, version: data.version, receipt: { month, amount: depositOf(saved) } });
      if (platform === "apple") setApple(paid); else setPlay(paid);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el archivo."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  function download(report: Report) {
    const url = URL.createObjectURL(new Blob([report.text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = report.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className={styles.portal}><main className={styles.main}>
    <header className={styles.header}>
      <a href="/contadores" className={styles.brand}>Órale AI<span>Contabilidad</span></a>
      <div className={styles.tools}>
        <input aria-label="Mes" type="month" value={month} disabled={busy} onChange={e => { if (e.target.value) openMonth(e.target.value); }}/>
        {role === "owner" && <button className={styles.primary} disabled={busy || loading} onClick={() => input.current?.click()}><Upload/>{busy ? "Subiendo…" : "Subir CSV"}</button>}
        <button aria-label="Imprimir" onClick={() => window.print()}><Printer/></button>
      </div>
    </header>
    {local && <p className={styles.preview}>Prueba local. Este enlace todavía no se puede abrir desde otra computadora.</p>}
    {error && <div className={styles.error} role="alert"><AlertCircle/>{error}</div>}
    <h1>{periodName(month)}<small>MXN</small></h1>
    {loading ? <div role="status" className={styles.empty}>Cargando</div> : ready && <>
      <Platform title="Google Play" reports={play.reports} month={month} onDownload={download}/>
      <Platform title="App Store" reports={apple.reports} month={month} onDownload={download}/>
      <Platform title="Stripe" reports={[]} month={month} onDownload={download}/>
      <Platform title="Mercado Libre" reports={[]} month={month} onDownload={download}/>
      {deposited.length > 0 && <div className={styles.total}><span>Total depositado</span><strong>{money(deposited.reduce((sum, amount) => sum + amount, 0))}</strong></div>}
    </>}
    <input ref={input} hidden type="file" accept=".csv,.txt,text/csv,text/plain" onChange={e => upload(e.target.files?.[0])}/>
  </main></div>;
}
