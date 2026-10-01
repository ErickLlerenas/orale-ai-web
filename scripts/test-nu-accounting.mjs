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

test('Nu stages originals privately before an atomic review and rejects invalid or missing files',async()=>{
 const fs=await import('node:fs'),vm=await import('node:vm'),ts=(await import('typescript')).default,{createHash}=await import('node:crypto');
 const memory=new Map();let seq=0;
 const code=ts.transpileModule(fs.readFileSync(new URL('../app/contadores/nu/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const deps={
  'next/server':{NextResponse:{json:(data,options)=>({data,status:options.status})}},
  'node:crypto':{createHash},
  '@/lib/accounting/access':{sessionCookie:'cookie',sessionRole:async value=>value},
  '@/lib/accounting/store':{emptyWorkspace:()=>({reports:[]}),latest:async key=>memory.get(key)||null,storeVersion:async(key,value)=>{const version=String(++seq);memory.set(key,{...value,key:version});return version;}},
  '@/lib/accounting/nu-ledger.mjs':{validateNuReview}
 };
 const context={exports:{},require:name=>deps[name],process:{env:{NODE_ENV:'production'}},Buffer,URL};vm.runInNewContext(code,context);const route=context.exports;
 const req=(body,role='owner',origin='https://accounting.example')=>({cookies:{get:()=>({value:role})},headers:new Headers({'content-type':'application/json',origin,host:'accounting.example'}),text:async()=>JSON.stringify(body)});
 const bytes=Buffer.from('89504e470d0a1a0a','hex'),id=createHash('sha256').update(bytes).digest('hex'),original={id,name:'review.png',type:'png',file:bytes.toString('base64')},stage={action:'upload-source',month:'2026-09',source:original};
 assert.equal((await route.POST(req(stage,'reader'))).status,403);
 assert.equal((await route.POST(req(stage,'owner','https://elsewhere'))).status,403);
 assert.equal((await route.POST(req({...stage,source:{...original,id:'b'.repeat(64)}}))).status,400);assert.equal(seq,0);
 assert.equal((await route.POST(req(stage))).status,200);assert.equal(seq,1);
 assert.equal((await route.POST(req(stage))).status,200);assert.equal(seq,1);
 const body={month:'2026-09',version:'',sources:[{id,name:'review.png',type:'png'}],rows:[{...rows[0],sourceIds:[id]}]};
 const saved=await route.POST(req(body));assert.equal(saved.status,200);assert.equal(saved.data.rows.length,1);
 const invalid={...body,version:saved.data.version,sources:[{id:source,name:'missing.png',type:'png'}],rows:[rows[0]]};
 assert.equal((await route.POST(req(invalid))).status,400);assert.equal(memory.get('bank-nu/2026-09').key,saved.data.version);
 assert.equal((await route.POST(req(body))).status,409);
});
