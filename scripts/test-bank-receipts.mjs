import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
import ts from 'typescript';
import * as bank from '../lib/accounting/bank-ledger.mjs';
import * as receipts from '../lib/accounting/bank-receipts.mjs';
const pdf=Buffer.from('%PDF-1.4 recibo').toString('base64');
test('a receipt goes to the first bank charge of its section that has none, once',()=>{
 const rows=[{id:'b',date:'2026-10-20',category:'cloudflare',amount:-500},{id:'a',date:'2026-10-08',category:'cloudflare',amount:-549},{id:'c',date:'2026-10-05',category:'anthropic',amount:-1749}];
 const file=receipts.validateReceiptFile({name:'Invoice.pdf',data:pdf},hash);
 const one=receipts.assignReceipt([],rows,{...file,category:'cloudflare'});
 assert.equal(one[0].rowId,'a');assert.equal(receipts.assignReceipt(one,rows,{...file,category:'cloudflare'}),one);
 const two=receipts.assignReceipt(one,rows,{...file,id:'otro',category:'cloudflare'});assert.equal(two[1].rowId,'b');
 assert.throws(()=>receipts.assignReceipt(two,rows,{...file,id:'tercero',category:'cloudflare'}),/sin comprobante/);
 assert.throws(()=>receipts.assignReceipt([],rows,{...file,category:'facebook'}),/inválido/);
 assert.throws(()=>receipts.validateReceiptFile({name:'x.png',data:Buffer.from('png').toString('base64')},hash),/PDF o el XML/);
 assert.equal(receipts.validateReceiptFile({name:'f.xml',data:Buffer.from('<?xml?><cfdi:Comprobante Total="1"/>').toString('base64')},hash).type,'xml');
});
const memory=new Map();let seq=0;
const source=ts.transpileModule(fs.readFileSync(new URL('../app/contadores/receipts/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const deps={
 'node:crypto':{createHash},
 'next/server':{NextResponse:Object.assign(class{constructor(body,options){this.body=body;this.headers=options.headers;this.status=200;}},{json:(data,options)=>({data,status:options.status})})},
 '@/lib/accounting/access':{sessionCookie:'cookie',sessionRole:async value=>value},
 '@/lib/accounting/store':{emptyWorkspace:()=>({reports:[]}),latest:async key=>memory.get(key)||null,storeVersion:async(key,value)=>{const version=String(++seq);memory.set(key,{...value,key:version});return version;}},
 '@/lib/accounting/bank-ledger.mjs':bank,'@/lib/accounting/bank-receipts.mjs':receipts
};
const context={exports:{},require:name=>deps[name],process:{env:{NODE_ENV:'test'}},Buffer,URL,encodeURIComponent};vm.runInNewContext(source,context);const route=context.exports;
const req=(body,role='owner',query='month=2026-10')=>({cookies:{get:()=>({value:role})},headers:new Headers({'content-type':'application/json',origin:'http://localhost',host:'localhost'}),nextUrl:new URL(`http://localhost/contadores/receipts?${query}`),text:async()=>JSON.stringify(body)});
test('receipt route lets only the owner attach a file to a Banamex charge and anyone signed in download it',async()=>{
 const rows=bank.parseBanamexRows([['Fecha','Descripción','Depósitos','Retiros','Saldo'],['05 Oct 2026','ANTHROPIC* CLAUDE SUB',null,'100.00','900.00'],['01 Oct 2026','DEPOSITO',  '1000.00',null,'1000.00']]);
 memory.set('bank-banamex/2026-10',{key:'b1',bankDocuments:[{id:'x',type:'xlsx',name:'x.xlsx',month:'2026-10',bank:'banamex',file:'',importedAt:'',...rows}]});
 const body={month:'2026-10',version:'',category:'anthropic',file:{name:'Invoice.pdf',data:pdf}};
 assert.equal((await route.POST(req(body,'reader'))).status,403);
 const saved=await route.POST(req(body));assert.equal(saved.data.error,undefined);assert.equal(saved.status,200);assert.equal(saved.data.receipts.length,1);
 assert.equal((await route.POST(req(body))).status,409);
 const list=await route.GET(req({},'reader'));assert.equal(list.data.receipts[0].category,'anthropic');
 const file=await route.GET(req({},'reader',`month=2026-10&id=${saved.data.receipts[0].id}`));assert.equal(Buffer.from(file.body).toString(),'%PDF-1.4 recibo');
 assert.equal((await route.POST(req({...body,version:saved.data.version,category:'cloudflare',file:{name:'Otro.pdf',data:Buffer.from('%PDF-1.4 otro').toString('base64')}}))).status,400);
 assert.equal((await route.POST(req({...body,version:saved.data.version}))).data.receipts.length,1);
});
