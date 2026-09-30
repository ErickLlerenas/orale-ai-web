import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as bank from '../lib/accounting/bank-ledger.mjs';
const header=['Fecha','Descripción','Depósitos','Retiros','Saldo'];
const old=bank.parseBanamexRows([header,['24 Sep 2026','FACEBOOK',null,'$100.00','$1,200.00'],['03 Sep 2026','DEPOSITO AUT 123','$200.00',null,'$1,300.00'],['31 Ago 2026','OTRO',null,'$50.00','$1,100.00']]);
const fresh=bank.parseBanamexRows([header,['29 Sep 2026','FACEBOOK',null,'$18.05',null],['25 Sep 2026','FACEBOOK',null,'$100.00','$1,100.00']]);
const make=(id,type,data)=>({id,type,name:`${id}.${type}`,month:'2026-09',bank:'banamex',file:'',importedAt:'2026-09-29',...data});
const docs=[make('a','xlsx',old),make('b','xlsx',fresh),make('c','pdf',{...old,rows:old.rows.map(r=>({...r,description:r.amount>0?'GOOGLE PAYMENT CORP.':r.description})),cardLast4:'6271'})];
test('merges PDF and overlapping Excel once, preserving PDF identity and month boundaries',()=>{
 const view=bank.mergeBankDocuments(docs,'2026-09');assert.equal(view.rows.length,4);assert.equal(view.deposits,20000);assert.equal(view.withdrawals,20000);assert.equal(view.unposted,1805);assert.equal(view.opening,110000);assert.equal(view.closing,110000);assert.equal(view.gap,false);assert.equal(view.openingAtMonthStart,true);assert.equal(view.missing.length,0);
 assert.equal(bank.bankCategory(view.rows.find(r=>r.amount>0)),'play');
 assert.equal(bank.mergeBankDocuments([...docs,docs[0]],'2026-09').rows.length,4);
 assert.equal(bank.mergeBankDocuments(docs,'2026-10').rows.length,0);
});
test('identical-looking same-day purchases with different running balances are preserved',()=>{
 const r=bank.parseBanamexRows([header,['03 Sep 2026','FACEBOOK',null,'100.00','800.00'],['03 Sep 2026','FACEBOOK',null,'100.00','900.00']]);
 const v=bank.mergeBankDocuments([make('a','xlsx',r),make('b','xlsx',r)],'2026-09');assert.equal(v.rows.length,2);assert.equal(v.withdrawals,20000);assert.equal(v.gap,false);assert.equal(v.openingAtMonthStart,false);
});
test('a balance-less row is not deducted from bank balance and is replaced when posted',()=>{
 const pending=make('p','xlsx',bank.parseBanamexRows([header,['29 Sep 2026','FACEBOOK',null,'18.05',null]]));
 const posted=make('q','xlsx',bank.parseBanamexRows([header,['29 Sep 2026','FACEBOOK MEXICO',null,'18.05','81.95']]));
 const v=bank.mergeBankDocuments([pending,posted],'2026-09');assert.equal(v.rows.length,1);assert.equal(v.unposted,0);assert.equal(v.closing,8195);
});
test('rejects changed column meanings, ambiguous amounts and inconsistent balances',()=>{
 assert.throws(()=>bank.parseBanamexRows([header.slice().reverse(),['x']]),/Excel/);
 assert.throws(()=>bank.parseBanamexRows([header,['01 Sep 2026','x','10.00','10.00','20.00']]),/inválido/);
 assert.throws(()=>bank.parseBanamexRows([header,['02 Sep 2026','x',null,'10.00','90.01'],['01 Sep 2026','x','100.00',null,'100.00']]),/no cuadran/);
 assert.throws(()=>bank.bankDate('31 Sep 2026'),/Fecha/);
});
test('reconciliation uses description as well as amount, does not call own transfers income, and preserves USD',()=>{
 const v=bank.mergeBankDocuments(docs,'2026-09');
 const report={id:'play:2026-08',kind:'earnings',receipt:{month:'2026-09',amount:20000},totals:{closing:20000}};
 const check=bank.reconcileBank(v,[report],'2026-09');assert.equal(check.checks[0].status,'matched');
 const noPdf=bank.reconcileBank(bank.mergeBankDocuments(docs.slice(0,2),'2026-09'),[report],'2026-09');assert.equal(noPdf.checks[0].status,'missing');
 assert.equal(bank.bankCategory({description:'PAGO RECIBIDO DE NUBANK TRANSFERENCIA',amount:20000}),'transfer');
 const cursorView={...v,rows:[{id:'c',date:'2026-09-09',description:'CURSOR',amount:-36396,balance:10000}]};
 const cursor={id:'cursor:A',kind:'cursor',currency:'USD',documentDate:'2026-09-09',receipt:{month:'2026-09',amount:2000},totals:{closing:2000}};
 const fx=bank.reconcileBank(cursorView,[cursor],'2026-09').checks[0];assert.equal(fx.status,'fx');assert.equal(fx.amount,2000);assert.equal(fx.row.amount,-36396);
});
const pdf=`Switch Banamex\nFecha de corte: 24 de septiembre de 2026\nNúmero de Tarjeta de Débito 0000000000006271\nSaldo anterior $1,100.00\nDepósitos $200.00\nRetiros $100.00\nSaldo al corte $1,200.00\n\f\nDETALLE DE OPERACIONES\nFECHA CONCEPTO RETIROS DEPÓSITOS SALDO\n25 AGO SALDO ANTERIOR 1,100.00\n03 SEP PAGO RECIBIDO DE GOOGLE PAYMENT CORP. 200.00 1,300.00\n24 SEP FACEBOOK 100.00 1,200.00\n* Expresada`;
test('PDF parser reconciles individual movements with independent statement totals',()=>{
 const parsed=bank.parseBanamexPdf(pdf);assert.equal(parsed.rows.length,2);assert.equal(parsed.deposits,20000);assert.equal(parsed.withdrawals,10000);assert.equal(parsed.cardLast4,'6271');
 assert.throws(()=>bank.parseBanamexPdf(pdf.replace('FACEBOOK 100.00','FACEBOOK 99.00')),/no cuadra/);
 assert.throws(()=>bank.parseBanamexPdf(pdf.replace('Depósitos $200.00','Depósitos $201.00')),/resumen/);
});
// Test the authenticated route with isolated storage and the real row validator.
const memory=new Map();let seq=0;
const source=ts.transpileModule(fs.readFileSync(new URL('../app/contadores/bank/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const deps={
 'next/server':{NextResponse:{json:(data,options)=>({data,status:options.status})}},
 '@/lib/accounting/access':{sessionCookie:'cookie',sessionRole:async value=>value},
 '@/lib/accounting/store':{emptyWorkspace:()=>({reports:[]}),latest:async key=>memory.get(key)||null,storeVersion:async(key,value)=>{const version=String(++seq);memory.set(key,{...value,key:version});return version;}},
 '@/lib/accounting/bank-ledger.mjs':bank,
 '@/lib/accounting/bank-import.mjs':{importBankDocument:async file=>{if(file.name==='bad')throw Error('bad file');return docs[Number(file.name)];}}
};
const context={exports:{},require:name=>deps[name],process:{env:{NODE_ENV:'test'}},Buffer,URL};vm.runInNewContext(source,context);const route=context.exports;
const req=(body,role='owner',origin='http://localhost')=>({cookies:{get:()=>({value:role})},headers:new Headers({'content-type':'application/json',origin,host:'localhost'}),nextUrl:new URL('http://localhost/contadores/bank?month=2026-09'),text:async()=>JSON.stringify(body)});
test('bank route enforces permissions and saves a validated batch atomically and idempotently',async()=>{
 const body={month:'2026-09',version:'',files:[{name:'0'},{name:'1'},{name:'2'}]};
 assert.equal((await route.POST(req(body,'reader'))).status,403);assert.equal((await route.POST(req(body,'owner','https://elsewhere'))).status,403);
 const first=await route.POST(req(body));assert.equal(first.status,200);assert.equal(first.data.documents.length,3);
 const again=await route.POST(req({...body,version:first.data.version}));assert.equal(again.status,200);assert.equal(again.data.documents.length,3);
 const failed=await route.POST(req({...body,version:again.data.version,files:[{name:'0'},{name:'bad'}]}));assert.equal(failed.status,400);assert.equal(memory.get('bank-banamex/2026-09').key,again.data.version);
 assert.equal((await route.POST(req(body))).status,409);assert.equal((await route.GET(req({},null))).status,401);
});

test('posting one of two identical pending charges does not erase the second charge',()=>{
 const pending=make('p','xlsx',bank.parseBanamexRows([header,['29 Sep 2026','FACEBOOK',null,'18.05',null],['29 Sep 2026','FACEBOOK',null,'18.05',null]]));
 const posted=make('q','xlsx',bank.parseBanamexRows([header,['29 Sep 2026','FACEBOOK MEXICO',null,'18.05','81.95']]));
 const v=bank.mergeBankDocuments([pending,posted],'2026-09');assert.equal(v.rows.length,2);assert.equal(v.unposted,1805);
});

test('chips and confirmations follow new monthly files, never a fixed deposit or previous month',()=>{
 const view={...bank.mergeBankDocuments([],'2026-10'),through:'2026-10-31',rows:[
  {id:'apple',date:'2026-10-06',description:'DEVELOPER PROCEEDS',amount:1600000,balance:2000000},
  {id:'transfer',date:'2026-10-06',description:'NUBANK TRANSFERENCIA',amount:1600000,balance:3600000},
  {id:'fb',date:'2026-10-08',description:'FACEBOOK MEXICO',amount:-25000,balance:3575000},
  {id:'cursor',date:'2026-10-09',description:'CURSOR',amount:-39000,balance:3536000}
 ]};
 const report={id:'apple:next',kind:'apple',receipt:{month:'2026-10',amount:1600000,date:'2026-10-06'},totals:{closing:1600000}};
 const result=bank.reconcileBank(view,[report],'2026-10');
 assert.equal(result.rows[0].category,'apple');assert.equal(result.rows[0].check.status,'matched');
 assert.equal(result.rows[1].category,'transfer');assert.equal(result.rows[1].check,null);
 assert.equal(result.rows[2].category,'facebook');assert.equal(result.rows[2].check,null);
 assert.equal(result.rows[3].category,'cursor');
 assert.equal(bank.reconcileBank(view,[{...report,receipt:{...report.receipt,month:'2026-09'}}],'2026-10').checks.length,0);
 assert.equal(bank.reconcileBank(view,[{...report,receipt:{...report.receipt,amount:1600001}}],'2026-10').checks[0].status,'missing');
});
