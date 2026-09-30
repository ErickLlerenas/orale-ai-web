import test from 'node:test';
import assert from 'node:assert/strict';
import {validateNuReview,nuView,nuCategory} from '../lib/accounting/nu-ledger.mjs';
const source='a'.repeat(64);
const row=(id,date,amount,status='posted',description='Payu *Google Cloud')=>({id:id.repeat(64),date,time:'12:00',description,amount,status,sourceIds:[source]});
const rows=[row('1','2026-09-07',-20000),row('2','2026-09-27',-20000,'pending'),row('3','2026-09-22',-19900,'cancelled','Google G1sk003m'),row('4','2026-09-29',299600,'posted','¡Gracias por tu pago!')];
test('Nu preserves pending and cancelled movements without counting them as posted charges or payments as app income',()=>{
 const view=nuView(rows,'2026-09');assert.equal(view.payments,299600);assert.equal(view.charges,20000);assert.equal(view.pending,20000);assert.equal(view.rows.length,4);
 assert.equal(nuCategory(rows[3]),'payment');assert.equal(nuCategory({...rows[0],description:'Apple.Com/Bill'}),'applePurchase');
 assert.equal(nuView(rows,'2026-10').rows.length,0);
});
test('Nu confirms monthly platform totals only against same-month pesos and excludes adjustments and cancellations',()=>{
 const report={kind:'cloud',currency:'MXN',receipt:{month:'2026-09'},totals:{closing:20000}};
 const view=nuView(rows,'2026-09',[report,report,{...report,isAdjustment:true,totals:{closing:2}}]);
 assert.equal(view.rows.find(r=>r.id===rows[0].id).matched,true);assert.equal(view.rows.find(r=>r.status==='pending').matched,false);
 for(const altered of [{...report,receipt:{month:'2026-10'}},{...report,currency:'USD'},{...report,totals:{closing:20001}}])assert.equal(nuView(rows,'2026-09',[altered,altered]).rows.some(r=>r.matched),false);
});
test('Nu review rejects duplicates, unknown sources, invalid dates and fractional cents',()=>{
 const body={month:'2026-09',rows,sources:[{id:source}]};assert.equal(validateNuReview(body).length,4);
 assert.throws(()=>validateNuReview({...body,rows:[rows[0],rows[0]]}));
 for(const change of [{date:'2026-09-31'},{date:'2026-10-01'},{amount:-20000.1},{sourceIds:['b'.repeat(64)]},{status:'unknown'},{time:'25:00'}])assert.throws(()=>validateNuReview({...body,rows:[{...rows[0],...change}]}));
});
test('Nu uses the statement posting date when available and does not invent a balance',()=>{
 const view=nuView([{...rows[0],date:'2026-08-31',postedDate:'2026-09-01'}],'2026-09');assert.equal(view.rows.length,1);assert.equal(view.charges,20000);assert.equal(view.rows[0].balance,undefined);
});
