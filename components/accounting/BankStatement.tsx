"use client";
import { useState } from 'react';
import { Check, Download } from 'lucide-react';
import { money, type Report } from '@/lib/accounting/ledger.mjs';
import { bankLabels, mergeBankDocuments, reconcileBank, type BankDocument } from '@/lib/accounting/bank-ledger.mjs';
import styles from './accounting.module.css';
const date=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
function sourceDownload(document:BankDocument){const bytes=Uint8Array.from(atob(document.file),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:document.type==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=window.document.createElement('a');a.href=url;a.download=document.name;a.click();URL.revokeObjectURL(url);}
export default function BankStatement({documents,reports,month,loading}:{documents:BankDocument[];reports:Report[];month:string;loading:boolean}) {
  const [account,setAccount]=useState<'negocio'|'personal'>('negocio');
  const view=mergeBankDocuments(documents,month);
  const reconciliation=reconcileBank(view,reports,month);
  const rows=account==='negocio'?[...reconciliation.rows].reverse():[];
  const deposits=rows.reduce((sum,row)=>sum+Math.max(0,row.amount),0);
  const withdrawals=rows.reduce((sum,row)=>sum+Math.max(0,-row.amount),0);
  const card=documents.find(d=>d.cardLast4)?.cardLast4;
  return <>
    <div className={styles.bankChooser} role="tablist" aria-label="Cuenta bancaria">
      <button type="button" role="tab" aria-selected={account==='negocio'} onClick={()=>setAccount('negocio')} className={styles.bankBusinessTab}>Negocio <small>Banamex{card?` ····${card}`:''}</small></button>
      <button type="button" role="tab" aria-selected={account==='personal'} onClick={()=>setAccount('personal')} className={styles.bankPersonalTab}>Personal <small>Nu ····0698</small></button>
    </div>
    {account==='negocio' && !loading && view.missing.length>0 && <p className={styles.fileStatus}>Falta: {view.missing.join(' y ')}.</p>}
    {loading?<p className={styles.empty}>Cargando…</p>:rows.length===0?<p className={styles.empty}>Sin movimientos cargados.</p>:<>
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
            <td>{row.amount>0?<span className={styles.bankIn}>+{money(row.amount)}</span>:'—'}</td>
            <td>{row.amount<0?<span className={styles.bankOut}>−{money(-row.amount)}</span>:'—'}</td>
            <td>{row.balance===null?'—':money(row.balance)}</td>
          </tr>)}</tbody>
          <tfoot><tr><th colSpan={2}>Total</th><td><span className={styles.bankIn}>{money(deposits)}</span></td><td><span className={styles.bankOut}>{money(withdrawals)}</span></td><td>—</td></tr></tfoot>
        </table>
      </div>
      <div className={styles.bankOriginals}>{documents.map(document=><button type="button" className={styles.csv} key={document.id} onClick={()=>sourceDownload(document)}><Download/>{document.name}</button>)}</div>
    </>}
  </>;
}
