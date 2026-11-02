import { reportKey } from './ledger.mjs';
// A peso charge is linked only when both the provider and date identify one document and one posted movement.
const documentDate=report=>(report.receipt?.date||report.documentDate||report.period).slice(0,10);
const days=(a,b)=>Math.abs(Date.parse(a)-Date.parse(b))/86400000;
export function expensePesos(reports, rows, month) {
  const selected=reports.filter(r=>r.receipt?.month===month&&!r.isAdjustment);
  const amounts={}, used=new Set(), pending=[];
  const charges=kind=>rows.filter(r=>r.category===kind&&r.amount<0&&(!r.status||r.status==='posted')&&(r.postedDate||r.date).startsWith(month));
  for(const report of selected){
    const key=reportKey(report);
    if(!['cursor','supabase'].includes(report.kind)){amounts[key]=report.totals.closing;continue;}
    const date=documentDate(report);
    const peers=selected.filter(r=>r.kind===report.kind&&documentDate(r)===date);
    const matches=charges(report.kind).filter(r=>r.date===date||r.postedDate===date);
    if(peers.length===1&&matches.length===1){amounts[key]=-matches[0].amount;used.add(matches[0]);}
    else{amounts[key]=null;if(!matches.length&&peers.length===1)pending.push(report);}
  }
  // The bank may post a card charge up to three days after the document date.
  for(const report of pending){
    const date=documentDate(report);
    const nearby=charges(report.kind).filter(r=>!used.has(r)&&days(r.postedDate||r.date,date)<=3);
    const rivals=pending.filter(r=>r.kind===report.kind&&days(documentDate(r),date)<=3);
    if(nearby.length===1&&rivals.length===1){amounts[reportKey(report)]=-nearby[0].amount;used.add(nearby[0]);}
  }
  return amounts;
}
