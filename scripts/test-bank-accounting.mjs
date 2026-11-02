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
test('reconciliation identifies a deposit the Excel does not name by exact amount, does not call own transfers income, and preserves USD',()=>{
 const v=bank.mergeBankDocuments(docs,'2026-09');
 const report={id:'play:2026-08',kind:'earnings',receipt:{month:'2026-09',amount:20000},totals:{closing:20000}};
 const check=bank.reconcileBank(v,[report],'2026-09');assert.equal(check.checks[0].status,'matched');
 const noPdf=bank.reconcileBank(bank.mergeBankDocuments(docs.slice(0,2),'2026-09'),[report],'2026-09');assert.equal(noPdf.checks[0].status,'matched');assert.equal(noPdf.rows.find(r=>r.amount>0).category,'play');
 assert.equal(bank.reconcileBank(bank.mergeBankDocuments(docs.slice(0,2),'2026-09'),[{...report,receipt:{...report.receipt,amount:20001}}],'2026-09').checks[0].status,'missing');
 assert.equal(bank.bankCategory({amount:-100,description:'OPENAI *CHATGPT SUBSC SAN FRANCISCO'}),'chatgpt');assert.equal(bank.bankCategory({amount:-100,description:'SUPABASE SINGAPORE'}),'supabase');assert.equal(bank.bankCategory({amount:-100,description:'ANTHROPIC* CLAUDE SUB'}),'anthropic');assert.equal(bank.bankCategory({amount:-100,description:'CLOUDFLARE SAN FRANCISCO'}),'cloudflare');assert.equal(bank.bankCategory({amount:-100,description:'REVENUECAT'}),'revenuecat');
 const chatgpt={id:'chatgpt:A',kind:'chatgpt',documentDate:'2026-09-09',receipt:{month:'2026-09',amount:36396},totals:{closing:36396}};
 const supabase={id:'supabase:A',kind:'supabase',currency:'USD',documentDate:'2026-09-09',receipt:{month:'2026-09',amount:100},totals:{closing:100}};
 const charges={...v,rows:[{id:'o',date:'2026-09-09',description:'OPENAI',amount:-36396,balance:10000},{id:'s',date:'2026-09-10',description:'SUPABASE SINGAPORE',amount:-1850,balance:8150}]};
 assert.deepEqual(bank.reconcileBank(charges,[chatgpt,supabase],'2026-09').checks.map(c=>c.status).sort(),['fx','matched']);
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
 'next/server':{NextResponse:Object.assign(class{constructor(body,options){this.body=body;this.headers=options.headers;this.status=200;}},{json:(data,options)=>({data,status:options.status})})},
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

test('bank route lists documents without their bytes and downloads each original on its own',async()=>{
 const key='bank-banamex/2026-08';
 memory.set(key,{key:'9',bankDocuments:[{...docs[0],month:'2026-08',file:Buffer.from('original').toString('base64')}]});
 const get=source=>route.GET({...req({}),nextUrl:new URL(`http://localhost/contadores/bank?month=2026-08${source?`&source=${source}`:''}`)});
 const list=await get();assert.equal(list.status,200);assert.equal(list.data.documents.length,1);assert.equal('file' in list.data.documents[0],false);assert.equal(memory.get(key).bankDocuments[0].file.length>0,true);
 const download=await get('a');assert.equal(download.status,200);assert.equal(Buffer.from(download.body).toString(),'original');assert.equal(download.headers['Content-Disposition'].includes('a.xlsx'),true);
 assert.equal((await get('missing')).status,404);
 memory.delete(key);
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

test('outflow totals separate Nu transfers from purchases, preserving the original withdrawal total',()=>{
 const totals=bank.bankOutflowTotals([
 {amount:-1950000,description:'PAGO INTERBANCARIO A NUBANK TRANSFERENCIA'},
 {amount:-1290031,description:'FACEBOOK'},
 {amount:300000,description:'PAGO RECIBIDO DE NUBANK TRANSFERENCIA'}
 ]);
 assert.deepEqual(totals,{withdrawals:3240031,transfers:1950000,otherPayments:1290031});
 assert.deepEqual(bank.bankOutflowTotals([]),{withdrawals:0,transfers:0,otherPayments:0});
});

test('deposit totals distinguish platform income, Nu transfers and bank bonuses without losing cents',()=>{
 const rows=[{amount:2576995,description:'STRIPE'},{amount:300000,description:'NUBANK TRANSFERENCIA'},{amount:35758,description:'BONIFICACION COMPRAS DIGITALES'},{amount:-1950000,description:'NUBANK TRANSFERENCIA'}];
 assert.deepEqual(bank.bankDepositTotals(rows),{total:2912753,transfers:300000,platforms:2576995,bonuses:35758,other:0});
 assert.equal(bank.bankDepositTotals([{amount:12345,description:'DEPOSITO AUT'}]).other,12345);
});

test('monthly Excel import ignores incomplete adjacent months and preserves original row numbers', () => {
 const data=[header,['01 Oct 2026','AUTHORIZATION',null,null,null],['30 Sep 2026','FACEBOOK',null,'1000.00',null],['29 Sep 2026','FACEBOOK',null,'18.05',null],['25 Sep 2026','FACEBOOK',null,'1000.00','1517.93'],['25 Sep 2026','TAX',null,'66.00','2517.93']];
 const original=JSON.stringify(data);
 const parsed=bank.parseBanamexMonthRows(data,'2026-09');
 assert.equal(parsed.rows.length,4);
 assert.equal(parsed.rows.find(row=>row.amount===-1805).sourceRow,4);
 assert.equal(parsed.rows.at(-1).sourceRow,3);
 assert.equal(JSON.stringify(data),original);
 assert.throws(()=>bank.parseBanamexMonthRows(data,'2026-10'),/inválido/);
 assert.throws(()=>bank.parseBanamexMonthRows(data,'2026-08'),/no contiene/);
 assert.throws(()=>bank.parseBanamexMonthRows([header,['29 Sep 2026','FACEBOOK',null,null,null]],'2026-09'),/inválido/);
});

test('Excel overdrawn balances recover their sign and a wrong balance is still rejected', () => {
 const data=[header,['05 Oct 2026','DEPOSITO','3000.00',null,'2700.00'],['05 Oct 2026','FACEBOOK',null,'1000.00','300.00'],['01 Oct 2026','OTRO',null,'10.00','700.00']];
 const parsed=bank.parseBanamexMonthRows(data,'2026-10');
 assert.equal(parsed.rows[1].balance,-30000);assert.equal(parsed.closing,270000);
 assert.throws(()=>bank.parseBanamexMonthRows([header,data[1],['05 Oct 2026','FACEBOOK',null,'1000.00','300.01'],data[3]],'2026-10'),/no cuadran/);
 assert.throws(()=>bank.parseBanamexMonthRows([header,['05 Oct 2026','DEPOSITO','1000.00',null,'300.00'],data[3]],'2026-10'),/no cuadran/);
});

test('PDF reads overdrawn balances, skips card checks with no money and rejects a check that changes the balance', () => {
 const statement=`Switch Banamex\nFecha de corte: 24 de octubre de 2026\nNúmero de Tarjeta de Débito 0000000000001234\nSaldo anterior $100.00\nDepósitos $300.00\nRetiros $150.00\nSaldo al corte $250.00\n\f\nDETALLE DE OPERACIONES\nFECHA CONCEPTO RETIROS DEPÓSITOS SALDO\nSALDO ANTERIOR 100.00\n01 OCT FACEBOOK SUC 0342 150.00 -50.00\n01 OCT GOOGLE *CHROME TEMP LONDON\nCAJA 0020 AUT 00000001\nHORA 12:12 SUC 0342 -50.00\n05 OCT PAGO RECIBIDO DE NUBANK 300.00 250.00\n* Expresada`;
 const parsed=bank.parseBanamexPdf(statement);
 assert.equal(parsed.rows.length,2);assert.equal(parsed.rows[0].balance,-5000);assert.equal(parsed.rows[0].amount,-15000);assert.equal(parsed.closing,25000);
 assert.throws(()=>bank.parseBanamexPdf(statement.replace('HORA 12:12 SUC 0342 -50.00','HORA 12:12 SUC 0342 -49.00')),/No se pudo leer/);
});

test('bank descriptions identify split Apple text, Mercado Pago, misspelled Nu transfers and Facebook aliases', () => {
 assert.equal(bank.bankCategory({amount:100,description:'CCI : 123,PURP:DEVELOPER SUC 0 CAJA 0 AUT 0 HORA 0: 0 PROCEEDS RASTREO: 1'}),'apple');
 assert.equal(bank.bankCategory({amount:100,description:'PAGO RECIBIDO DE Mercado Pago W POR ORDEN DE X'}),'mercado');
 assert.equal(bank.bankCategory({amount:-100,description:'PAGO INTERBANCARIO A NUBANK AL BENEF. REF. 1 transfencia entre cuentas'}),'transfer');
 assert.equal(bank.bankCategory({amount:-100,description:'FACEBK *ABC123'}),'facebook');
});

test('an owner-marked transfer counts as one until a statement PDF names the movement', async () => {
 const excel=bank.parseBanamexRows([header,['26 Oct 2026','PAGO INTERBANCARIO AUT 1',null,'100.00','900.00'],['25 Oct 2026','FACEBOOK',null,'10.00','1000.00']]);
 const documents=[make('x','xlsx',{...excel,month:'2026-10'})];
 const id=bank.mergeBankDocuments(documents,'2026-10').rows.find(r=>r.amount===-10000).id;
 const marked=bank.markBankTransfer(documents,'2026-10',id);
 const row=bank.mergeBankDocuments(marked,'2026-10').rows.find(r=>r.id===id);
 assert.equal(bank.bankCategory(row),'transfer');assert.equal(bank.bankOutflowTotals([row]).transfers,10000);
 assert.equal(bank.bankCategory({...row,pdfDescription:'PAGO A OTRA PERSONA'}),'other');
 assert.equal(bank.bankCategory(bank.mergeBankDocuments([...marked,make('y','xlsx',{...excel,month:'2026-10'})],'2026-10').rows.find(r=>r.id===id)),'transfer');
 const facebook=bank.mergeBankDocuments(documents,'2026-10').rows.find(r=>r.amount===-1000).id;
 assert.throws(()=>bank.markBankTransfer(documents,'2026-10',facebook),/no se puede marcar/);
 assert.throws(()=>bank.markBankTransfer(documents,'2026-10','nada'),/no se puede marcar/);
 memory.set('bank-banamex/2026-10',{key:'7',bankDocuments:documents});
 const post=body=>route.POST({...req(body),nextUrl:new URL('http://localhost/contadores/bank?month=2026-10')});
 assert.equal((await route.POST(req({action:'mark-transfer',month:'2026-10',version:'7',rowId:id},'reader'))).status,403);
 assert.equal((await post({action:'mark-transfer',month:'2026-10',version:'old',rowId:id})).status,409);
 const saved=await post({action:'mark-transfer',month:'2026-10',version:'7',rowId:id});
 assert.equal(saved.status,200);assert.equal(saved.data.documents[0].rows.some(r=>r.userCategory==='transfer'),true);
 memory.delete('bank-banamex/2026-10');
});
