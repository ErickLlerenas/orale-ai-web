"use client";
import { Check, Download } from 'lucide-react';
import { money, type Report } from '@/lib/accounting/ledger.mjs';
import { bankLabels, bankOutflowTotals, bankDepositTotals, mergeBankDocuments, reconcileBank, type BankDocument } from '@/lib/accounting/bank-ledger.mjs';
import styles from './accounting.module.css';
const date=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
export default function BankStatement({documents,reports,month,loading}:{documents:BankDocument[];reports:Report[];month:string;loading:boolean}) {
  const view=mergeBankDocuments(documents,month);
  const reconciliation=reconcileBank(view,reports,month);
  const rows=[...reconciliation.rows].reverse();
  const incoming=bankDepositTotals(rows);
  const {transfers,otherPayments}=bankOutflowTotals(rows);
  return <>
    {!loading && view.missing.length>0 && <p className={styles.fileStatus}>Falta: {view.missing.join(' y ')}.</p>}
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
      <div className={styles.bankOriginals}>{documents.map(document=><a className={styles.csv} key={document.id} href={`/contadores/bank?month=${month}&source=${document.id}`}><Download/>{document.name}</a>)}</div>
    </>}
  </>;
}
