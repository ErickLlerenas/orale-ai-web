import { reportKey } from './ledger.mjs';
// A peso charge is linked only when both the provider and date identify one document and one posted movement.
export function expensePesos(reports, rows, month) {
  const selected=reports.filter(r=>r.receipt?.month===month&&!r.isAdjustment);
  const amounts={};
  for(const report of selected){
    const key=reportKey(report);
    if(!['cursor','supabase'].includes(report.kind)){amounts[key]=report.totals.closing;continue;}
    const date=(report.receipt?.date||report.documentDate||report.period).slice(0,10);
    const peers=selected.filter(r=>r.kind===report.kind&&(r.receipt?.date||r.documentDate||r.period).slice(0,10)===date);
    const matches=rows.filter(r=>r.category===report.kind&&r.amount<0&&(!r.status||r.status==='posted')&&(r.postedDate||r.date).startsWith(month)&&(r.date===date||r.postedDate===date));
    amounts[key]=peers.length===1&&matches.length===1?-matches[0].amount:null;
  }
  return amounts;
}
