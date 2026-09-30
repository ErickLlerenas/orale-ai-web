"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Upload, Download, AlertCircle, LogOut, CreditCard } from "lucide-react";
import { money, parseReport, appleSales, reportKey, paymentAmount, incomeFigures, missingAppleFiles, type Report } from "@/lib/accounting/ledger.mjs";
import styles from "./accounting.module.css";

import BankStatement from "./BankStatement";
import type { NuReview } from "@/lib/accounting/nu-ledger.mjs";
import { expensePesos } from "@/lib/accounting/expense-pesos.mjs";
import { mergeBankDocuments, bankCategory } from "@/lib/accounting/bank-ledger.mjs";
import { nuView } from "@/lib/accounting/nu-ledger.mjs";
import type { BankDocument } from "@/lib/accounting/bank-ledger.mjs";

const AdminView = createContext(false);
const PlatformUpload = createContext<{choose:(title:string)=>void;loaded:Set<string>;busy:boolean}>({choose:()=>{},loaded:new Set(),busy:false});
const PesoAmounts = createContext<Record<string,number|null>>({});
const downloadGuides: Record<string, { href: string; steps: string; file: string; detail: string | null }> = {
  "Google Play": {
    "href": "https://play.google.com/console/u/0/developers/6708397449839658524/download-reports/financial",
    "steps": "Descargar informes → Finanzas → Informes de ganancias → abre el año y el mes → descarga y descomprime el ZIP.",
    "file": "Sube solo PlayApps_AAAAMM.csv.",
    "detail": "Abre en esta web el mes en que recibiste el depósito y sube ese CSV. Ya no necesitas account_activities. El neto del archivo se confirma con tu banco."
  },
  "App Store": {
    "href": "https://appstoreconnect.apple.com/itc/payments_and_financial_reports",
    "steps": "Pagos e informes financieros → abre el pago recibido → selecciona su periodo y descarga el informe financiero.",
    "file": "3 archivos: financial_report.csv + FD_94105360_MMYY.txt + MexicoCommissionInvoice-MM-AAAA-94105360.pdf.",
    "detail": "Sube primero financial_report.csv y después el detalle y la factura de comisión del mismo periodo. El CSV confirma el depósito, el detalle aporta las ventas y la factura aporta la comisión y su IVA exactos. Ninguno reúne todo en un solo archivo."
  },
  "Stripe": {
    "href": "https://dashboard.stripe.com/acct_1Tr1ycPl6RX2hOkm/payouts",
    "steps": "Depósitos (Payouts) → abre el depósito recibido → exporta sus movimientos en CSV.",
    "file": "Archivo: transfers.csv, con cargos, comisiones y neto.",
    "detail": "Es el mismo tipo de archivo cargado este mes. Si hay varios depósitos, los movimientos del mes deben quedar reunidos en un solo CSV; la web conserva un reporte por periodo."
  },
  "Mercado Libre Afiliados": {
    "href": "https://www.mercadolibre.com.mx/afiliados/payments",
    "steps": "Ingresos → abre el pago del mes → descarga su comprobante fiscal.",
    "file": "Archivo: paycheck-…-MLM.pdf (CFDI).",
    "detail": null
  },
  "Cursor AI": {
    "href": "https://cursor.com/dashboard/billing",
    "steps": "Billing → historial de facturas → abre cada factura pagada en el mes → descarga Invoice.",
    "file": "Archivo: Invoice en PDF, como los cursor-invoice-….pdf cargados.",
    "detail": "Sube todas las facturas pagadas en el mes. Elige Invoice, no Receipt."
  },
  "ChatGPT": {
    "href": "https://chatgpt.com/settings/billing",
    "steps": "Facturación → Administrar suscripción → historial de facturas → abre cada pago → descarga Receipt.",
    "file": "Archivo: Receipt-….pdf (recibo de pago).",
    "detail": "Sube los recibos del mes; puedes seleccionarlos todos juntos. Elige Receipt, no Invoice."
  },
  "Facebook Ads": {
    "href": "https://adsmanager.facebook.com/adsmanager/billing_hub/payment_activity?asset_id=242779225906555&business_id=865322613094575&payment_account_id=242779225906555&placement=BILLING_HUB",
    "steps": "Actividad de pago → selecciona el mes completo → descarga el resumen de facturación en CSV.",
    "file": "Archivo: AAAA-MM-DD--AAAA-MM-DD_Resumen_Facturación.csv.",
    "detail": "Sube un resumen del mes completo, no los PDF de cada cobro."
  },
  "Google Ads": {
    "href": "https://ads.google.com/aw/billing/documents?ocid=322288941&billingId=527655704",
    "steps": "Facturación → Documentos → selecciona las facturas del mes → descarga Factura Fiscal: XML.",
    "file": "Archivos: FCP-….xml (CFDI).",
    "detail": "Sube todos los XML del mes; puedes seleccionarlos juntos. No subas las versiones PDF de esos mismos comprobantes."
  },
  "Supabase": {
    "href": "https://supabase.com/dashboard/org/jaddfmfmvtdzyuhexakn/billing",
    "steps": "Billing → historial de facturas → abre el pago del mes → descarga Receipt.",
    "file": "Archivo: Receipt-….pdf, como Receipt-AZSTCI-00012.pdf.",
    "detail": "Elige Receipt, no Invoice: el recibo confirma el pago."
  },
  "Google Cloud": {
    "href": "https://console.cloud.google.com/billing/012CD5-09C255-197CEF/invoices/prepaidDocuments?organizationId=0",
    "steps": "Facturas → Prepago: AI Studio → marca los documentos del mes → Descargar elementos seleccionados → incluye Documentos relacionados.",
    "file": "Sube un solo ZIP: google-payments-document-center-download_….zip.",
    "detail": "No lo descomprimas. La web lee los XML, evita duplicados y separa los ajustes de los cargos. Selecciona todos los documentos del mes."
  }
};
function UploadButton({title}:{title:string}) {
  const admin=useContext(AdminView),state=useContext(PlatformUpload);
  if(!admin)return null;
  return <button type="button" className={styles.csv} disabled={state.busy} onClick={()=>state.choose(title)}><Upload/>{state.loaded.has(title)?"Agregar o reemplazar":"Subir archivos"}</button>;
}

function DownloadGuide({ title }: { title: string }) {
  const admin = useContext(AdminView);
  const guide = downloadGuides[title];
  if (!admin || !guide) return null;
  return <><UploadButton title={title}/><details className={styles.downloadGuide}>
    <summary>Cómo descargar</summary>
    <div className={styles.downloadHelp}>
      <strong>{title}</strong>
      <p>{guide.steps}</p>
      <p className={styles.downloadFile}>{guide.file}</p>
      {guide.detail && <p>{guide.detail}</p>}
      <a href={guide.href} target="_blank" rel="noopener noreferrer">Abrir sitio de descarga ↗</a>
    </div>
  </details></>;
}

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
  return data as { reports: Report[]; version: string; period?: string; platform?: string; label: string };
}
const usd = (cents: number) => `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)} USD`;
const invoiceDate = (period: string) => new Date(`${period}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");

function unconfirmedPlay(report: Report) {
  return report.kind === "earnings" && report.receipt?.source !== "bank" && report.receipt?.source !== "user";
}

function depositOf(report: Report) {
  return paymentAmount(report) ?? report.totals.closing;
}
function vatDue(report: Report) {
  return report.kind === "apple" && missingAppleFiles(report).length > 0 ? null : incomeFigures(report).preliminaryVat;
}

function AppleFileStatus({ report }: { report?: Report }) {
  const missing = missingAppleFiles(report);
  if (missing.length === 0) return null;
  return <p className={styles.fileStatus} role="status"><strong>{missing.length === 1 ? "Falta 1 archivo" : `Faltan ${missing.length} archivos`}</strong>: {missing.join("; ")}.<span>El desglose de Apple está incompleto.</span></p>;
}

function Figures({ report, onDownload, title }: { report: Report; title: string; onDownload: (report: Report) => void }) {
  const mercado = report.kind === "mercado";
  const figures = incomeFigures(report);
  if (report.kind === "apple" && missingAppleFiles(report).length > 0) {
    figures.preliminaryVat = null;
    figures.salesVat = null;
    if (!report.salesSource) figures.sales = null;
    if (!report.commissionSource) { figures.fee = null; figures.feeVat = null; }
  }
  const deposit = depositOf(report);
  const rows: { label: string; amount: number | null; hint?: string; kind?: "due" | "deposit" }[] = mercado ? [
    { label: "Ingreso antes de impuestos", amount: report.totals.credit },
    { label: "IVA trasladado", amount: report.totals.tax },
    { label: "IVA retenido", amount: report.totals.other },
    { label: "ISR retenido", amount: report.totals.debit },
    { label: unconfirmedPlay(report) ? "Neto del reporte" : "Depositado en tu cuenta", amount: deposit, kind: "deposit" },
  ] : [
    { label: "Ventas", amount: figures.sales },
    { label: "IVA de las ventas", amount: figures.salesVat },
    { label: "Comisión", amount: figures.fee },
    { label: "IVA de la comisión", amount: figures.feeVat },
    { label: "IVA estimado", amount: figures.preliminaryVat, hint: figures.preliminaryVat == null ? (report.kind === "apple" ? "Faltan archivos de Apple" : "Falta el detalle de ventas") : undefined, kind: "due" },
    { label: unconfirmedPlay(report) ? "Neto del reporte" : "Depositado en tu cuenta", amount: deposit, kind: "deposit" },
  ];
  return <>
    {report.kind === "apple" && <AppleFileStatus report={report}/>}
    <dl className={styles.breakdown}>
      {rows.map(row => <div key={row.label} className={row.kind === "deposit" ? styles.deposit : row.kind === "due" ? styles.due : undefined}><dt><span>{row.label}{row.hint && <small>{row.hint}</small>}</span></dt><dd>{row.amount == null ? "Pendiente" : money(row.amount)}</dd></div>)}
    </dl>
    {report.difference !== 0 && <div className={styles.error} role="alert"><AlertCircle/>Diferencia de {money(report.difference)}</div>}
    <div className={styles.downloadActions}><button type="button" className={styles.csv} onClick={() => onDownload(report)}><Download/>{mercado ? "PDF" : "CSV"}</button><DownloadGuide title={title}/></div>
  </>;
}

function CardTag({ card }: { card: "personal" | "negocio" }) {
  const personal = card === "personal";
  return <span className={personal ? styles.personal : styles.negocio}>
    <CreditCard aria-hidden="true"/>
    {personal ? "Tarjeta personal" : "Tarjeta de negocio"}
  </span>;
}

function ForeignVatNote({name}:{name:string}) {
  return <p className={styles.foreignVatNote}>El comprobante de {name} no muestra IVA cobrado. Como es un servicio del extranjero, puede corresponder declarar IVA por separado. Tu contador debe revisar ese cálculo antes de descontarlo del IVA de tus ingresos.</p>;
}

function DollarAmount({reports,total=false}:{reports:Report[];total?:boolean}) {
  const pesos=useContext(PesoAmounts), complete=reports.every(r=>pesos[reportKey(r)]!=null);
  const original=usd(reports.reduce((sum,r)=>sum+r.totals.closing,0));
  return <>{complete?`${money(reports.reduce((sum,r)=>sum+(pesos[reportKey(r)]||0),0))} MXN`:original}<small>{complete?`${total?"Comprobantes":"Comprobante"}: ${original}`:"Falta identificar el cargo en pesos"}</small></>;
}

function CursorExpenses({ reports, month, onDownload }: { reports: Report[]; month: string; onDownload: (report: Report) => void }) {
  const paid = reports.filter(report => report.receipt?.month === month).sort((a, b) => a.period.localeCompare(b.period));
  return <section className={styles.entry}>
    <div className={styles.row}><h2>Cursor AI</h2>{paid.length === 0 && <span className={styles.missing}>Sin archivo</span>}</div>
    {paid.length > 0 && <dl className={styles.breakdown}>
      {paid.map(report => <div key={reportKey(report)}><dt><span>{invoiceDate(report.documentDate || report.period.slice(0, 10))}</span><CardTag card="negocio"/><button type="button" className={styles.csv} onClick={() => onDownload(report)}><Download/>PDF</button></dt><dd><DollarAmount reports={[report]}/></dd></div>)}
      <div className={styles.deposit}><dt><span>Total</span></dt><dd><DollarAmount reports={paid} total/></dd></div>
    </dl>}
    {paid.length>0&&paid.every(r=>!r.totals.tax)&&<ForeignVatNote name="Cursor"/>}
    <div className={styles.downloadActions}><DownloadGuide title="Cursor AI"/></div>
  </section>;
}

function SupabaseExpenses({ reports, month, onDownload }: { reports: Report[]; month: string; onDownload: (report: Report) => void }) {
  const paid = reports.filter(report => report.receipt?.month === month).sort((a, b) => a.period.localeCompare(b.period));
  return <section className={styles.entry}>
    <div className={styles.row}><h2>Supabase</h2>{paid.length === 0 && <span className={styles.missing}>Sin archivo</span>}</div>
    {paid.length > 0 && <dl className={styles.breakdown}>
      {paid.map(report => {
        const card = report.receipt?.cardLast4 || report.cardLast4;
        return <div key={reportKey(report)}><dt><span>{invoiceDate(report.documentDate || report.period)}{!card && <small>El recibo no indica la tarjeta</small>}</span>{card === "0698" || card === "6271" ? <CardTag card={card === "0698" ? "personal" : "negocio"}/> : card ? <span>Tarjeta ···· {card}</span> : null}<button type="button" className={styles.csv} onClick={() => onDownload(report)}><Download/>PDF</button></dt><dd><DollarAmount reports={[report]}/></dd></div>;
      })}
      <div className={styles.deposit}><dt><span>Total</span></dt><dd><DollarAmount reports={paid} total/></dd></div>
    </dl>}
    {paid.length>0&&paid.every(r=>!r.totals.tax)&&<ForeignVatNote name="Supabase"/>}
    <div className={styles.downloadActions}><DownloadGuide title="Supabase"/></div>
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
    {paid.length>0&&paid.every(r=>!r.totals.tax)&&<ForeignVatNote name="ChatGPT"/>}
    <div className={styles.downloadActions}><DownloadGuide title="ChatGPT"/></div>
  </section>;
}

function FacebookExpenses({ reports, month, onDownload }: { reports: Report[]; month: string; onDownload: (report: Report) => void }) {
  const paid = reports.filter(report => report.receipt?.month === month).sort((a, b) => a.period.localeCompare(b.period));
  return <section className={styles.entry}>
    <div className={styles.row}><h2>Facebook Ads</h2>{paid.length === 0 && <span className={styles.missing}>Sin archivo</span>}</div>
    {paid.length === 0 && <div className={styles.downloadActions}><DownloadGuide title="Facebook Ads"/></div>}
    {paid.map(report => <div key={reportKey(report)}>
      <dl className={styles.breakdown}>
        {report.rows.map(row => <div key={row.line}><dt><span>{invoiceDate(row.iso || row.date)}</span><CardTag card="negocio"/></dt><dd>{money(row.amount)} MXN</dd></div>)}
        <div className={styles.deposit}><dt><span>Total pagado</span></dt><dd>{money(report.totals.closing)} MXN</dd></div>
      </dl>
      {report.totals.tax>0&&<p className={styles.taxNote}>Este total incluye {money(report.totals.tax)} MXN de IVA.</p>}
      {report.totals.tax===0&&<ForeignVatNote name="Facebook Ads"/>}
      <div className={styles.downloadActions}><button type="button" className={styles.csv} onClick={() => onDownload(report)}><Download/>CSV</button><DownloadGuide title="Facebook Ads"/></div>
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
    <div className={styles.downloadActions}><DownloadGuide title="Google Ads"/></div>
  </section>;
}

function CloudExpenses({ reports, month, onDownload }: { reports: Report[]; month: string; onDownload: (report: Report) => void }) {
  const documents = reports.filter(r => r.receipt?.month === month).sort((a, b) => a.period.localeCompare(b.period));
  const paid = documents.filter(r => !r.isAdjustment);
  return <section className={styles.entry}>
    <div className={styles.row}><h2>Google Cloud</h2>{documents.length === 0 && <span className={styles.missing}>Sin archivo</span>}</div>
    {paid.length > 0 && <>
      <dl className={styles.breakdown}>
        {paid.map(report => {
          const card = report.receipt?.cardLast4 || report.cardLast4;
          return <div key={reportKey(report)}><dt><span>{invoiceDate(report.receipt?.date || report.documentDate || report.period.slice(0, 10))}</span>
            {card === "0698" ? <CardTag card="personal"/> : card === "6271" ? <CardTag card="negocio"/> : <span>{card ? `Tarjeta ···· ${card}` : "Tarjeta no indicada"}</span>}
            <button type="button" className={styles.csv} onClick={() => onDownload(report)}><Download/>XML</button>
          </dt><dd>{money(report.totals.closing)} MXN</dd></div>;
        })}
        <div className={styles.deposit}><dt><span>Total pagado</span></dt><dd>{money(paid.reduce((sum, r) => sum + r.totals.closing, 0))} MXN</dd></div>
      </dl>
      <p className={styles.taxNote}>Este total incluye {money(paid.reduce((sum, r) => sum + r.totals.tax, 0))} MXN de IVA.</p>
    </>}
    <div className={styles.downloadActions}><DownloadGuide title="Google Cloud"/></div>
  </section>;
}

function Platform({ title, reports, month, onDownload, card }: { title: string; reports: Report[]; month: string; onDownload: (report: Report) => void; card?: "personal" | "negocio" }) {
  const paid = reports.filter(report => report.receipt?.month === month);
  return <section className={styles.entry}>
    <div className={styles.row}>
      <div className={styles.name}><h2>{title}</h2>{card && <CardTag card={card}/>}</div>
      {paid.length === 0 && <span className={styles.missing}>Sin archivo</span>}
    </div>
    {title === "App Store" && paid.length === 0 && <AppleFileStatus/>}
    {paid.length === 0 && <div className={styles.downloadActions}><DownloadGuide title={title}/></div>}
    {paid.map(report => <Figures title={title} key={reportKey(report)} report={report} onDownload={onDownload}/>)}
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
  const [cloud, setCloud] = useState<{ reports: Report[]; version: string }>({ reports: [], version: "" });
  const [supabase, setSupabase] = useState<{ reports: Report[]; version: string }>({ reports: [], version: "" });
  const [facebook, setFacebook] = useState<{ reports: Report[]; version: string }>({ reports: [], version: "" });
  const [bankFiles, setBankFiles] = useState<{documents:BankDocument[];version:string}>({documents:[],version:""});
  const [nuFiles,setNuFiles]=useState<NuReview>({rows:[],sources:[],version:""});
  const [bankAccount,setBankAccount]=useState<"negocio"|"personal">("negocio");
  const [bankLoading,setBankLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"ingresos" | "gastos" | "banco">("ingresos");
  const [uploadReview,setUploadReview]=useState<{files:File[];labels:string[];month:string;bank:boolean}|null>(null);
  const uploadTarget=useRef("");
  const input = useRef<HTMLInputElement>(null);
  const paid = [...play.reports, ...apple.reports, ...stripe.reports, ...mercado.reports].filter(report => report.receipt?.month === month);

  const expenses=[...cursor.reports,...chatgpt.reports,...facebook.reports,...google.reports,...supabase.reports,...cloud.reports].filter(r=>r.receipt?.month===month&&!r.isAdjustment);
  const pesoAmounts=expensePesos(expenses,[...mergeBankDocuments(bankFiles.documents,month).rows.map(r=>({...r,category:bankCategory(r)})),...nuView(nuFiles.rows,month).rows],month);
  const missingPesos=expenses.some(r=>pesoAmounts[reportKey(r)]==null);
  const expenseTotal=expenses.reduce((sum,r)=>sum+(pesoAmounts[reportKey(r)]||0),0);

  useEffect(() => {
    const selected = new URLSearchParams(location.search).get("mes");
    if (selected && /^\d{4}-(0[1-9]|1[0-2])$/.test(selected)) setMonth(selected);
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    Promise.all([request("play"), request("apple"), request("stripe"), request("mercado"), request("cursor"), request("facebook"), request("chatgpt"), request("google"), request("supabase"), request("cloud")]).then(([playData, appleData, stripeData, mercadoData, cursorData, facebookData, chatgptData, googleData, supabaseData, cloudData]) => {
      if (cancelled) return;
      setPlay(playData); setApple(appleData); setStripe(stripeData); setMercado(mercadoData); setCursor(cursorData); setFacebook(facebookData); setChatgpt(chatgptData); setGoogle(googleData); setSupabase(supabaseData); setCloud(cloudData); setReady(true);
    }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled=false;setBankLoading(true);setBankFiles({documents:[],version:""});setNuFiles({rows:[],sources:[],version:""});
    Promise.all([`/contadores/bank?month=${month}`,`/contadores/nu?month=${month}`].map(url=>fetch(url).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);return data;}))).then(([bank,nu])=>{if(!cancelled){setBankFiles(bank);setNuFiles(nu);}}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setBankLoading(false);});
    return ()=>{cancelled=true;};
  },[month]);

  function openMonth(value: string) {
    setMonth(value); setError("");
    const url = new URL(location.href);
    url.searchParams.set("mes", value);
    url.searchParams.delete("reporte");
    url.searchParams.delete("platform");
    history.replaceState(null, "", url);
  }
  async function reviewUpload(files:FileList|null) {
    const list=files?[...files]:[];
    if(!list.length||busy)return;
    setBusy(true);setError("");
    try {
      const labels=[];
      for(const file of list){
        if(file.size>2_000_000)throw new Error("Cada archivo debe pesar menos de 2 MB.");
        if(tab==="banco"){labels.push("Banamex");continue;}
        let report;
        if(/\.(pdf|zip)$/i.test(file.name)){const bytes=new Uint8Array(await file.arrayBuffer());let binary="";bytes.forEach(byte=>{binary+=String.fromCharCode(byte);});report={name:file.name,[/\.zip$/i.test(file.name)?"zip":"pdf"]:btoa(binary)};}
        else report={name:file.name,text:await file.text()};
        const data=await request("pdf",{action:"preview",month,report});
        if(!data.label.startsWith(uploadTarget.current))throw new Error(`${file.name} corresponde a ${data.label}. Súbelo en su apartado.`);
        labels.push(data.label);
      }
      setUploadReview({files:list,labels,month,bank:tab==="banco"});
    }catch(e){setError(e instanceof Error?e.message:"No se pudo revisar el archivo.");}
    finally{setBusy(false);if(input.current)input.current.value="";}
  }
  async function upload(files?: FileList | File[] | null) {
    const list = files ? [...files].sort((a, b) => Number(/PlayApps_|MexicoCommissionInvoice|\.txt$/i.test(a.name)) - Number(/PlayApps_|MexicoCommissionInvoice|\.txt$/i.test(b.name))) : [];
    if (!list.length || busy) return;
    setBusy(true); setError("");
    const versions: Record<string, string> = { play: play.version, apple: apple.version, stripe: stripe.version, mercado: mercado.version, cursor: cursor.version, facebook: facebook.version, chatgpt: chatgpt.version, google: google.version, supabase: supabase.version, cloud: cloud.version };
    try {
      if(tab === "banco") {
        if(bankLoading)throw new Error("Espera a que terminen de abrirse los archivos bancarios.");
        const files=[];
        for(const file of list){if(file.size>2_000_000)throw new Error("Cada archivo debe pesar menos de 2 MB.");const bytes=new Uint8Array(await file.arrayBuffer());let binary="";bytes.forEach(byte=>{binary+=String.fromCharCode(byte);});files.push({name:file.name,data:btoa(binary)});}
        const response=await fetch("/contadores/bank",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({month,version:bankFiles.version,files})});
        const data=await response.json();if(!response.ok)throw new Error(data.error);setBankFiles(data);return;
      }
      for (const file of list) {
        if (file.size > 2_000_000) throw new Error("El archivo debe pesar menos de 2 MB.");
        let platform: string, body: Record<string, unknown>;
        if (file.name.toLowerCase().endsWith(".zip")) {
          const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ""; bytes.forEach(byte => { binary += String.fromCharCode(byte); });
          platform = "zip"; body = { action: "upload-report", month, report: { name: file.name, zip: btoa(binary) }, versions };
        } else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
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
            body = { action: "upload-report", month, report: source, version: versions[platform] };
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
        else if (platform === "cloud") { setCloud(data); setTab("gastos"); }
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

  return <AdminView.Provider value={role === "owner"}><PesoAmounts.Provider value={pesoAmounts}><PlatformUpload.Provider value={{choose:title=>{uploadTarget.current=title;input.current?.click();},busy:busy||loading||bankLoading,loaded:new Set(([ ["Google Play",play.reports],["App Store",apple.reports],["Stripe",stripe.reports],["Mercado Libre Afiliados",mercado.reports],["Cursor AI",cursor.reports],["ChatGPT",chatgpt.reports],["Facebook Ads",facebook.reports],["Google Ads",google.reports],["Supabase",supabase.reports],["Google Cloud",cloud.reports] ] as [string,Report[]][]).filter(([,reports])=>reports.some(r=>r.receipt?.month===month)).map(([title])=>title))}}><div className={styles.portal}><main className={styles.main}>
    <header className={styles.header}>
      <a href="/contadores" className={styles.brand}>Órale AI<span>Contabilidad</span></a>
      <div className={styles.tools}>
        <input aria-label="Mes" type="month" value={month} disabled={busy} onChange={e => { if (e.target.value) openMonth(e.target.value); }}/>
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
        <div><span>{paid.some(unconfirmedPlay) ? "Total neto" : "Total depositado"}</span><strong>{money(paid.reduce((sum, report) => sum + depositOf(report), 0))}</strong></div>
        <div><span>IVA estimado</span><strong>{paid.some(report => vatDue(report) == null) ? "Pendiente" : money(paid.reduce((sum, report) => sum + (vatDue(report) || 0), 0))}</strong></div>
      </div>}
    </>}
    {ready && tab === "gastos" && <>
      <CursorExpenses reports={cursor.reports} month={month} onDownload={download}/>
      <ChatgptExpenses reports={chatgpt.reports} month={month} onDownload={download}/>
      <FacebookExpenses reports={facebook.reports} month={month} onDownload={download}/>
      <GoogleExpenses reports={google.reports} month={month} onDownload={download}/>
      <SupabaseExpenses reports={supabase.reports} month={month} onDownload={download}/>
      <CloudExpenses reports={cloud.reports} month={month} onDownload={download}/>
      {expenses.length>0&&<div className={styles.totals}><div><span>Total de gastos de la app{missingPesos&&<small>Faltan cargos en pesos</small>}</span><strong>{bankLoading?"Cargando…":`${money(expenseTotal)} MXN`}</strong></div><p className={styles.taxNote}>{missingPesos?"Total parcial · ":""}Según los comprobantes cargados.</p></div>}
    </>}
    {role==="owner"&&tab==="banco"&&bankAccount==="negocio"&&<div className={styles.downloadActions}><UploadButton title="Banamex"/></div>}
    {ready && tab === "banco" && <BankStatement onAccountChange={setBankAccount} documents={bankFiles.documents} nu={nuFiles} reports={[...play.reports,...apple.reports,...stripe.reports,...mercado.reports,...cursor.reports,...facebook.reports,...chatgpt.reports,...google.reports,...cloud.reports,...supabase.reports]} month={month} loading={bankLoading}/>}
    {uploadReview&&<div className={styles.uploadBackdrop}><section className={styles.uploadReview} role="dialog" aria-modal="true" aria-labelledby="upload-review-title"><h2 id="upload-review-title">Revisar archivos</h2><p>Se guardarán en <strong>{periodName(uploadReview.month)}</strong>.</p><ul>{uploadReview.files.map((file,i)=><li key={i}><strong>{uploadReview.labels[i]}</strong><small>{file.name}</small></li>)}</ul><div><button type="button" onClick={()=>setUploadReview(null)}>Cancelar</button><button type="button" className={styles.primary} onClick={()=>{const review=uploadReview;setUploadReview(null);upload(review.files);}}>Guardar archivos</button></div></section></div>}
    <input ref={input} hidden type="file" multiple accept={tab === "banco" ? ".xlsx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : ".zip,application/zip,.csv,.txt,.pdf,.xml,text/csv,text/plain,application/pdf,application/xml,text/xml"} onChange={e => reviewUpload(e.target.files)}/>
  </main></div></PlatformUpload.Provider></PesoAmounts.Provider></AdminView.Provider>;
}
