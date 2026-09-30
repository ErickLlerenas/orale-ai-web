import { validDate } from './ledger.mjs';
export function validateNuReview(body) {
 if(!body || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month||'') || !Array.isArray(body.rows) || !body.rows.length || body.rows.length>1000 || !Array.isArray(body.sources) || !body.sources.length || body.sources.length>40)throw Error('Revisión de Nu inválida.');
 const sourceIds=new Set(body.sources.map(s=>s.id));
 if(sourceIds.size!==body.sources.length)throw Error('Capturas duplicadas.');
 const ids=new Set();
 return body.rows.map((r,index)=>{
  if(!/^[a-f0-9]{64}$/.test(r.id||'')||ids.has(r.id)||!validDate(r.date)||!r.date.startsWith(body.month)||!Number.isSafeInteger(r.amount)||r.amount===0||Math.abs(r.amount)>100000000||typeof r.description!=='string'||!r.description.trim()||r.description.length>250||!['posted','pending','cancelled'].includes(r.status)||typeof r.time!=='string'||(r.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time))||!Array.isArray(r.sourceIds)||!r.sourceIds.length||r.sourceIds.some(id=>!sourceIds.has(id))||(r.postedDate && (!validDate(r.postedDate)||!r.postedDate.startsWith(body.month)))||(r.operationDate&&!validDate(r.operationDate)))throw Error(`Movimiento de Nu inválido: ${index+1}.`);
  ids.add(r.id);return {id:r.id,date:r.date,time:r.time,description:r.description.trim(),amount:r.amount,status:r.status,postedDate:r.postedDate,operationDate:r.operationDate,sourceIds:[...new Set(r.sourceIds)]};
 });
}
export function nuCategory(row){
 const d=row.description.toUpperCase();
 if(row.amount>0)return 'payment';
 if(d.includes('GOOGLE CLOUD'))return 'cloud';
 if(d.includes('GOOGLE OPE'))return 'google';
 if(d.includes('CHATGPT'))return 'chatgpt';
 if(d.includes('SUPABASE'))return 'supabase';
 if(d.includes('GITHUB'))return 'github';
 if(d.includes('SUNO'))return 'suno';
 if(d.includes('CAPCUT'))return 'capcut';
 if(d.includes('GOOGLE G1'))return 'googleOne';
 if(d.includes('GOOGLE ORALE'))return 'oralePurchase';
 if(d.includes('YOUTUBEPREMIUM'))return 'youtube';
 if(d.includes('SPOTIFY'))return 'spotify';
 if(d.includes('NETFLIX'))return 'netflix';
 if(d.includes('AMAZONPRIMESUBS'))return 'prime';
 if(d.includes('APPLE.COM/BILL'))return 'applePurchase';
 return 'other';
}
export const nuLabels={payment:'Pago a la tarjeta',cloud:'Google Cloud',google:'Google Ads',chatgpt:'ChatGPT',supabase:'Supabase',github:'GitHub',suno:'Suno',capcut:'CapCut',googleOne:'Google One',oralePurchase:'Órale AI · compra',youtube:'YouTube Premium',spotify:'Spotify',netflix:'Netflix',prime:'Amazon Prime',applePurchase:'Apple · compra'};
export function nuView(rows,month,reports=[]){
 const selected=rows.filter(r=>(r.postedDate||r.date).slice(0,7)===month).map(r=>({...r,category:nuCategory(r),matched:false}));
 for(const kind of ['chatgpt','google','cloud']){
  const group=selected.filter(r=>r.category===kind && r.status!=='cancelled');
  const documents=reports.filter(r=>r.kind===kind && r.receipt?.month===month && !r.isAdjustment && r.currency!=='USD');
  const bankTotal=group.reduce((s,r)=>s-r.amount,0),documentTotal=documents.reduce((s,r)=>s+r.totals.closing,0);
  if(group.length && documents.length && bankTotal===documentTotal)for(const r of group)r.matched=r.status==='posted';
 }
 selected.sort((a,b)=>(b.postedDate||b.date).localeCompare(a.postedDate||a.date)||b.date.localeCompare(a.date)||b.time.localeCompare(a.time));
 return {rows:selected,payments:selected.filter(r=>r.status==='posted'&&r.amount>0).reduce((s,r)=>s+r.amount,0),charges:selected.filter(r=>r.status==='posted'&&r.amount<0).reduce((s,r)=>s-r.amount,0),pending:selected.filter(r=>r.status==='pending'&&r.amount<0).reduce((s,r)=>s-r.amount,0)};
}
