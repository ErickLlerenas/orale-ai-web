"use client";
import { useState } from 'react';
import { Check, Download } from 'lucide-react';
import { money, type Report } from '@/lib/accounting/ledger.mjs';
import { bankLabels, bankOutflowTotals, bankDepositTotals, mergeBankDocuments, reconcileBank, type BankDocument } from '@/lib/accounting/bank-ledger.mjs';
import { nuView, nuLabels, type NuReview } from '@/lib/accounting/nu-ledger.mjs';
import styles from './accounting.module.css';
const date=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
function sourceDownload(document:BankDocument){const bytes=Uint8Array.from(atob(document.file),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:document.type==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=window.document.createElement('a');a.href=url;a.download=document.name;a.click();URL.revokeObjectURL(url);}
export default function BankStatement({documents,nu,reports,month,loading,onAccountChange}:{onAccountChange:(account:"negocio"|"personal")=>void;documents:BankDocument[];nu:NuReview;reports:Report[];month:string;loading:boolean}) {
  const [account,setAccount]=useState<'negocio'|'personal'>('negocio');
  const personal=nuView(nu.rows,month,reports);
  const view=mergeBankDocuments(documents,month);
  const reconciliation=reconcileBank(view,reports,month);
  const rows=account==='negocio'?[...reconciliation.rows].reverse():[];
  const incoming=bankDepositTotals(rows);
  const {transfers,otherPayments}=bankOutflowTotals(rows);
  const card=documents.find(d=>d.cardLast4)?.cardLast4;
  return <>
    <div className={styles.bankChooser} role="tablist" aria-label="Cuenta bancaria">
      <button type="button" role="tab" aria-selected={account==='negocio'} onClick={()=>{setAccount('negocio');onAccountChange('negocio');}} className={styles.bankBusinessTab}>Negocio <small>Banamex{card?` ····${card}`:''}</small></button>
      <button type="button" role="tab" aria-selected={account==='personal'} onClick={()=>{setAccount('personal');onAccountChange('personal');}} className={styles.bankPersonalTab}>Personal <small>Nu ····0698</small></button>
    </div>
    {account==='negocio' && !loading && view.missing.length>0 && <p className={styles.fileStatus}>Falta: {view.missing.join(' y ')}.</p>}
    {account==='personal' && !loading && <>{personal.rows.length===0?<p className={styles.empty}>Sin movimientos cargados.</p>:<><div className={`${styles.bankTableWrap} ${styles.bankBusiness}`}><table className={`${styles.bankTable} ${styles.bankRawTable}`}>
      <thead><tr><th>Fecha</th><th>Descripción</th><th>Abonos</th><th>Cargos</th></tr></thead>
      <tbody>{personal.rows.map(row=><tr key={row.id} className={row.status==='cancelled'?styles.bankCancelled:undefined}>
        <td title={row.postedDate && row.date!==row.postedDate?`Fecha en la app: ${date(row.date)}`:undefined}>{date(row.postedDate||row.date)}</td>
        <td><div>{row.description}</div>{row.category!=='other' && <span className={styles.bankChip} title={row.matched?'El total de la plataforma coincide con los comprobantes del mes':undefined}>{nuLabels[row.category]}{row.matched&&<Check aria-label="Total confirmado con los comprobantes del mes"/>}</span>}
        {row.status!=='posted'&&<span className={styles.bankChip}>{row.status==='pending'?'Por procesar':'Cancelado'}</span>}</td>
        <td>{row.amount>0?<span className={styles.bankTransfer}>+{money(row.amount)}</span>:'—'}</td>
        <td>{row.amount<0?<span className={row.category==='transfer'?styles.bankTransfer:styles.bankOut}>−{money(-row.amount)}</span>:'—'}</td>
      </tr>)}</tbody>
      <tfoot><tr><th colSpan={2}>Total confirmado</th><td><span className={styles.bankTransfer}>{money(personal.payments)}</span><small className={styles.bankTotalDetail}>Pagos a la tarjeta</small></td><td><span className={styles.bankOut}>{money(personal.charges)}</span><small className={styles.bankTotalDetail}>Personales y de la app</small></td></tr>
      {personal.pending>0&&<tr><th colSpan={2}>Por procesar</th><td>—</td><td><span className={styles.bankOut}>{money(personal.pending)}</span></td></tr>}</tfoot>
      </table></div><details className={styles.bankSources}><summary>Capturas y estado de cuenta · {nu.sources.length}</summary><div className={styles.bankOriginals}>{nu.sources.map(source=><a className={styles.csv} key={source.id} href={`/contadores/nu?month=${month}&source=${source.id}`}><Download/>{source.name}</a>)}</div></details></>}</>}
    {account==='negocio' && (loading?<p className={styles.empty}>Cargando…</p>:rows.length===0?<p className={styles.empty}>Sin movimientos cargados.</p>:<>
      <div className={`${styles.bankTableWrap} ${styles.bankBusiness}`}>
        <table className={`${styles.bankTable} ${styles.bankRawTable}`}>
          <thead><tr><th>Fecha</th><th>Descripción</th><th>Depósitos</th><th>Retiros</th><th>Saldo</th></tr></thead>
          <tbody>{rows.map(row=><tr key={row.id}>
            <td>{date(row.date)}</td>
            <td>
              <div>{row.spreadsheetDescription||row.description.replace(/\b\d{8,}\b/g,n=>`····${n.slice(-4)}`)}</div>
              {row.category!=='other' && <span className={styles.bankChip} title={row.check?.status==='matched'?'Importe confirmado con el archivo del mes':'Identificado por la descripción del banco'}>
                {bankLabels[row.category]}
                {row.check?.status==='matched' && <Check aria-label="Importe confirmado con el archivo del mes"/>}
              </span>}
            </td>
            <td>{row.amount>0?<span className={row.category==='transfer'?styles.bankTransfer:styles.bankIn}>+{money(row.amount)}</span>:'—'}</td>
            <td>{row.amount<0?<span className={row.category==='transfer'?styles.bankTransfer:styles.bankOut}>−{money(-row.amount)}</span>:'—'}</td>
            <td>{row.balance===null?'—':money(row.balance)}</td>
          </tr>)}</tbody>
          <tfoot><tr><th colSpan={2}>Transferencias con Nu</th><td><span className={styles.bankTransfer}>{money(incoming.transfers)}</span></td><td><span className={styles.bankTransfer}>−{money(transfers)}</span></td><td>—</td></tr>
          <tr className={styles.bankSubtotal}><th colSpan={2}>Ingresos de plataformas</th><td><span className={styles.bankIn}>{money(incoming.platforms)}</span></td><td>—</td><td>—</td></tr>
          {incoming.bonuses>0&&<tr className={styles.bankSubtotal}><th colSpan={2}>Bonificaciones del banco</th><td><span className={styles.bankIn}>{money(incoming.bonuses)}</span></td><td>—</td><td>—</td></tr>}
          {incoming.other>0&&<tr className={styles.bankSubtotal}><th colSpan={2}>Otros depósitos</th><td><span className={styles.bankIn}>{money(incoming.other)}</span></td><td>—</td><td>—</td></tr>}
          <tr className={styles.bankSubtotal}><th colSpan={2}>Gastos y otros pagos</th><td>—</td><td><span className={styles.bankOut}>{money(otherPayments)}</span></td><td>—</td></tr></tfoot>
        </table>
      </div>
      <div className={styles.bankOriginals}>{documents.map(document=><button type="button" className={styles.csv} key={document.id} onClick={()=>sourceDownload(document)}><Download/>{document.name}</button>)}</div>
    </>)}
  </>;
}
