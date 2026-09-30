import { validDate, paymentAmount, reportKey } from './ledger.mjs';
const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
export function bankDate(value) {
  const m = String(value).trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  const date = m && `${m[3]}-${String(months.indexOf(m[2].toLowerCase()) + 1).padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if (!validDate(date)) throw new Error('Fecha bancaria inválida.');
  return date;
}
export function bankMoney(value) {
  const clean = String(value ?? '').replace(/[$,\s]/g,'');
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(clean)) throw new Error('Importe bancario inválido.');
  const cents = Math.round(Number(clean) * 100);
  if (!Number.isSafeInteger(cents)) throw new Error('Importe bancario fuera de rango.');
  return cents;
}
const sum = (rows, predicate) => rows.filter(predicate).reduce((s,r) => s + Math.abs(r.amount), 0);
export function parseBanamexRows(data) {
  if (!Array.isArray(data) || data.length < 2 || data.length > 5001 || data[0].map(x=>String(x ?? '').trim()).join('|') !== 'Fecha|Descripción|Depósitos|Retiros|Saldo') throw new Error('Usa el Excel de Banamex con Fecha, Descripción, Depósitos, Retiros y Saldo.');
  const rows = data.slice(1).filter(r=>r.some(v=>v!=null && v!=='')).map((r,i)=> {
    const deposit = r[2] == null || r[2] === '' ? 0 : bankMoney(r[2]);
    const withdrawal = r[3] == null || r[3] === '' ? 0 : bankMoney(r[3]);
    if (deposit < 0 || withdrawal < 0 || (deposit > 0) === (withdrawal > 0) || typeof r[1] !== 'string' || !r[1].trim()) throw new Error(`Movimiento inválido en la fila ${i+2}.`);
    return { date: bankDate(r[0]), description: r[1].trim(), amount: deposit - withdrawal, balance: r[4] == null || r[4] === '' ? null : bankMoney(r[4]), sourceRow: i+2 };
  }).reverse();
  if (!rows.length) throw new Error('El Excel no contiene movimientos.');
  const posted=rows.filter(r=>r.balance!=null);
  for(let i=1;i<posted.length;i++) if(posted[i].date < posted[i-1].date || posted[i-1].balance + posted[i].amount !== posted[i].balance) throw new Error('Los movimientos del Excel no cuadran con sus saldos. No se importó.');
  return { rows, from: rows.map(r=>r.date).sort()[0], to: rows.map(r=>r.date).sort().at(-1), opening: posted.length ? posted[0].balance-posted[0].amount : null, closing: posted.at(-1)?.balance ?? null };
}
export function parseBanamexPdf(text) {
  if (!/Switch Banamex/i.test(text)) throw new Error('Usa el estado de cuenta PDF de Switch Banamex.');
  const cut=text.match(/Fecha de corte:\s*(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if(!cut) throw new Error('El PDF no indica la fecha de corte.');
  const end=bankDate(`${cut[1]} ${cut[2].slice(0,3)} ${cut[3]}`);
  const cards=text.match(/Número de Tarjeta de Débito\s+(\d{16})/i);
  if(!cards) throw new Error('El PDF no identifica la tarjeta de Banamex.');
  const value=label=> {const m=text.match(new RegExp(label+'\\s*\\$([\\d,]+\\.\\d{2})','i'));if(!m)throw new Error('El PDF no trae el resumen completo.');return bankMoney(m[1]);};
  const opening=value('Saldo anterior'), closing=value('Saldo al corte'), deposits=value('Depósitos'), withdrawals=value('Retiros');
  if(opening+deposits-withdrawals!==closing) throw new Error('El resumen del PDF de Banamex no cuadra.');
  const pages=text.split('\f');
  const detail=pages.filter(p=>p.includes('DETALLE DE OPERACIONES')).map(p=>p.split(/FECHA\s+CONCEPTO\s+RETIROS\s+DEPÓSITOS\s+SALDO/)[1]?.split('* Expresada')[0] || '').join('\n').replace(/SU ABONO\.\.\.GRACIAS/g,'');
  const matches=[...detail.matchAll(/(?:^|\n)\s*(\d{2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+/g)];
  const rows=[]; let balance=opening, from=null;
  for(let i=0;i<matches.length;i++) {
    const m=matches[i], block=detail.slice(m.index+m[0].length,matches[i+1]?.index ?? detail.length).trim();
    const year=Number(cut[3])-(months.indexOf(m[2].toLowerCase())+1>Number(end.slice(5,7))?1:0);
    const date=bankDate(`${m[1]} ${m[2]} ${year}`); from ??= date;
    if(block.startsWith('SALDO ANTERIOR')) {if(bankMoney(block.replace('SALDO ANTERIOR',''))!==opening)throw new Error('Saldo inicial inconsistente.');continue;}
    const tail=block.match(/([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/);
    if(!tail) throw new Error('No se pudo leer un movimiento completo del PDF.');
    const total=bankMoney(tail[1]), after=bankMoney(tail[2]), amount=after-balance;
    if(Math.abs(amount)!==total || amount===0)throw new Error('Un movimiento del PDF no cuadra con el saldo.');
    rows.push({date,description:block.slice(0,tail.index).replace(/\s+/g,' ').trim(),amount,balance:after,sourceRow:i+1});balance=after;
  }
  if(!rows.length || balance!==closing || sum(rows,r=>r.amount>0)!==deposits || sum(rows,r=>r.amount<0)!==withdrawals)throw new Error('El detalle del PDF no coincide con su resumen.');
  return {rows,from,to:end,opening,closing,cardLast4:cards[1].slice(-4),deposits,withdrawals};
}
const identity = r => `${r.date}|${r.amount}|${r.balance ?? r.description.toUpperCase().replace(/\s+/g,' ')}`;
export function mergeBankDocuments(documents,month) {
  const docs=documents.filter(d=>d.month===month), merged=new Map();
  for(const doc of docs) {
    const counts=new Map();
    for(const row of doc.rows) {
      const key=identity(row), n=(counts.get(key)||0)+1;counts.set(key,n);
      const id=`${key}|${n}`, old=merged.get(id);
      merged.set(id,{...row,id,spreadsheetDescription:doc.type==='xlsx'?row.description:old?.spreadsheetDescription,description:doc.type==='pdf'?row.description:old?.description||row.description,pdfDescription:doc.type==='pdf'?row.description:old?.pdfDescription,sources:[...new Set([...(old?.sources||[]),doc.name])]});
    }
  }
  // A later export may give a posted balance to an earlier balance-less movement.
  const all=[...merged.values()];
  const consumed=new Set();
  const rows=all.filter(r=>{
    if(r.balance!==null)return true;
    const posted=all.find(other=>other.balance!==null && !consumed.has(other.id) && other.date===r.date && other.amount===r.amount && (other.description.startsWith(r.description)||r.description.startsWith(other.description)));
    if(posted){consumed.add(posted.id);return false;}return true;
  });
  const selected=rows.filter(r=>r.date.slice(0,7)===month);
  const posted=selected.filter(r=>r.balance!==null).sort((a,b)=>a.date.localeCompare(b.date));
  let opening=null,closing=null,gap=false;const ordered=[];
  const before=rows.filter(r=>r.balance!==null && r.date<`${month}-01`).sort((a,b)=>b.date.localeCompare(a.date));
  if(posted.length) {
    // Infer the start of the first day's chain, or anchor it to the prior month.
    const firstDay=posted.filter(r=>r.date===posted[0].date);
    const starts=firstDay.filter(r=>!firstDay.some(o=>o!==r && o.balance===r.balance-r.amount));
    if(starts.length===1)opening=starts[0].balance-starts[0].amount;
    if(before.length && opening!==null && !before.some(r=>r.date===before[0].date && r.balance===opening))gap=true;
    let running=opening;
    for(const date of [...new Set(posted.map(r=>r.date))]){
      const remaining=posted.filter(r=>r.date===date);
      while(remaining.length){const candidates=remaining.filter(r=>r.balance-r.amount===running);const next=candidates.length===1?candidates[0]:remaining[0];if(candidates.length!==1)gap=true;ordered.push(next);running=next.balance;remaining.splice(remaining.indexOf(next),1);}
    }
    closing=running;
  }
  const unsalded=selected.filter(r=>r.balance===null);
  return {openingAtMonthStart: before.length > 0 || docs.some(d=>d.from<=`${month}-01` && d.to>=`${month}-01`),documents:docs,rows:[...ordered,...unsalded].sort((a,b)=>a.date.localeCompare(b.date)),opening,closing,gap,
    deposits:sum(posted,r=>r.amount>0),withdrawals:sum(posted,r=>r.amount<0),unposted:sum(unsalded,r=>r.amount<0),
    balanceDate:posted.map(r=>r.date).sort().at(-1)||null,through:docs.map(d=>d.to).sort().at(-1)||null,
    missing:[...(docs.some(d=>d.type==='pdf')?[]:['PDF del corte']),...(docs.filter(d=>d.type==='xlsx').length>=2?[]:[docs.filter(d=>d.type==='xlsx').length===1?'un Excel de movimientos':'los dos Excel de movimientos'])]};
}
export function bankCategory(row) {
  const d=(row.pdfDescription||row.description).toUpperCase();
  if(row.amount>0){
    if(d.includes('GOOGLE PAYMENT'))return 'play';
    if(d.includes('DEVELOPER PROCEEDS'))return 'apple';
    if(d.includes('STRIPE'))return 'stripe';
    if(d.includes('MERCADO LIBRE AFILIADOS'))return 'mercado';
    if(d.includes('BONIFICACION'))return 'bonus';
    if(d.includes('NUBANK') && d.includes('TRANSFERENCIA'))return 'transfer';
    return 'other';
  }
  if(d.includes('FACEBOOK'))return 'facebook';
  if(d.includes('CURSOR'))return 'cursor';
  if(d.includes('HONORARIOS CONTADORES'))return 'accountant';
  if(d.includes('PAGO DE IMPUE'))return 'tax';
  if(d.includes('NUBANK') && /TRANSFERENCIA|TRANFERENCIA/.test(d))return 'transfer';
  return 'other';
}
export const bankLabels={play:'Google Play',apple:'App Store',stripe:'Stripe',mercado:'Mercado Libre Afiliados',facebook:'Facebook Ads',cursor:'Cursor AI',bonus:'Bonificación del banco',transfer:'Transferencia con Nu',accountant:'Honorarios de contadores',tax:'Pago de impuestos',other:'Por identificar'};
export function reconcileBank(view,reports,month) {
  const expected=[];
  for(const report of reports.filter(r=>r.receipt?.month===month)) {
    const kind=report.kind==='earnings'||!report.kind?'play':report.kind;
    if(['play','apple','stripe','mercado'].includes(kind))expected.push({id:reportKey(report),kind,amount:paymentAmount(report),currency:'MXN',date:report.receipt?.date||null});
    if(kind==='cursor')expected.push({id:reportKey(report),kind,amount:report.totals.closing,currency:'USD',date:report.documentDate});
    if(kind==='facebook')for(const row of report.rows)expected.push({id:`${reportKey(report)}:${row.line}`,kind,amount:row.amount,currency:'MXN',date:row.iso||row.date});
  }
  expected.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const used=new Set(), checks=[];
  const days=(a,b)=>Math.abs(Date.parse(a)-Date.parse(b))/86400000;
  for(const item of expected) {
    const income=['play','apple','stripe','mercado'].includes(item.kind);
    const candidates=view.rows.filter(r=>r.balance!==null && !used.has(r.id) && (income?r.amount>0:r.amount<0) && bankCategory(r)===item.kind && (!item.date||days(item.date,r.date)<=5) && (item.currency==='USD'||Math.abs(r.amount)===item.amount));
    candidates.sort((a,b)=>(item.date?days(item.date,a.date)-days(item.date,b.date):0)||a.date.localeCompare(b.date));
    const row=candidates[0];
    if(row){used.add(row.id);checks.push({...item,row,status:item.currency==='USD'?'fx':'matched'});}
    else checks.push({...item,status:item.date&&view.through&&item.date>view.through?'outside':'missing'});
  }
  return {checks,rows:view.rows.map(row=>({...row,category:bankCategory(row),check:checks.find(c=>c.row?.id===row.id)||null})),unmatched:view.rows.filter(r=>!used.has(r.id))};
}

export function bankOutflowTotals(rows) {
 const withdrawals=rows.reduce((sum,row)=>sum+Math.max(0,-row.amount),0);
 const transfers=rows.filter(row=>row.amount<0 && bankCategory(row)==='transfer').reduce((sum,row)=>sum-row.amount,0);
 return {withdrawals,transfers,otherPayments:withdrawals-transfers};
}

export function bankDepositTotals(rows) {
 const positive=rows.filter(row=>row.amount>0);
 const total=positive.reduce((sum,row)=>sum+row.amount,0);
 const transfers=positive.filter(row=>bankCategory(row)==='transfer').reduce((sum,row)=>sum+row.amount,0);
 const platforms=positive.filter(row=>['play','apple','stripe','mercado'].includes(bankCategory(row))).reduce((sum,row)=>sum+row.amount,0);
 const bonuses=positive.filter(row=>bankCategory(row)==='bonus').reduce((sum,row)=>sum+row.amount,0);
 return {total,transfers,platforms,bonuses,other:total-transfers-platforms-bonuses};
}
