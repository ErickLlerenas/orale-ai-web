import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { deflateSync } from 'node:zlib';
import ts from 'typescript';
import * as ledger from '../lib/accounting/ledger.mjs';
import {extractPdfText} from '../lib/accounting/pdf.mjs';
const {parseReport, incomeFigures, paymentAmount, upsertReport, attachPlayEarnings, validateReceipt} = ledger;
const invoice = (number, amount = '180.00') => `Receipt\nInvoice number\n${number}\nDate paid\nSeptember 23, 2026\nOpenAI OpCo, LLC\nTotal\nMXN$${amount}\nAmount paid\nMXN$${amount}\nMastercard - 0698`;
const activity = `"Fecha","Descripción","Importe (MXN)"\n"1 ago 2026","Saldo inicial","0.00"\n"2 ago 2026","Aplicaciones de Google Play","116.00"\n"2 ago 2026","Aplicaciones de Google Play","−17.40"\n"1 – 31 de ago de 2026","I.V.A.","−2.78"\n"1 sept 2026","Saldo final","95.82"`;
const apple = `"iTunes Connect - Payments and Financial Reports\t(July, 2026)"\nCountry or Region (Currency),Units Sold,Earned,Input Tax,Adjustments,Withholding Tax,Total Owed,Proceeds,Bank Account Currency\nMexico (MXN),19,2999.72,0,479.92,0,3479.64,3479.64,MXN`;
const supabaseReceipt = 'RECEIPT\nSupabase Pte. Ltd.\nInvoice number\nTEST-00012\nReceipt date\nSep 20, 2026\nPayment date\nSep 20, 2026\nAmount paid\n$27.00\nPro Plan\nSep 20 – Oct 19, 2026\n$25.00\nSubtotal\n$27.00\nAmount paid\n$27.00';
// Minimal anonymous PDF exercising compressed font objects and TJ arrays.
function compressedReceiptPdf(text) {
 const chars = [...new Set(text.replaceAll('\n', ''))];
 const code = char => (chars.indexOf(char) + 1).toString(16).padStart(4, '0');
 const cmap = `beginbfchar\n${chars.map(char => `<${code(char)}> <${char.charCodeAt(0).toString(16).padStart(4, '0')}>`).join('\n')}\nendbfchar`;
 const font = '<< /Type /Font /ToUnicode 2 0 R >>';
 const resources = '<< /Font << /CJNBGO 4 0 R >> >>';
 const header = `4 0 5 ${font.length + 1} `;
 const stream = (id, data, dict = '') => { const bytes = deflateSync(Buffer.from(data)); return Buffer.concat([Buffer.from(`${id} 0 obj\n<< /Filter /FlateDecode /Length ${bytes.length} ${dict} >>\nstream\n`), bytes, Buffer.from('\nendstream\nendobj\n')]); };
 return Buffer.concat([Buffer.from('%PDF-1.7\n'), stream(1, `BT /CJNBGO 12 Tf\n${text.split('\n').map(line => `1 0 0 1 0 0 Tm [${[...line].map(char => `<${code(char)}>0`).join('')}] TJ`).join('\n')}\nET`), stream(2, cmap), stream(3, header + font + ' ' + resources, `/Type /ObjStm /N 2 /First ${header.length}`), Buffer.from('%%EOF')]);
}
test('Supabase receipt reads compressed-font PDF, uses payment date, and keeps USD separate from pesos', () => {
 const text = extractPdfText(compressedReceiptPdf(supabaseReceipt));
 const r = parseReport(text, 'renamed.pdf');
 assert.equal(r.kind, 'supabase');assert.equal(r.id, 'supabase:TEST-00012');
 assert.equal(r.documentDate, '2026-09-20');assert.equal(r.totals.closing, 2700);
 assert.equal(r.currency, 'USD');assert.equal(r.cardLast4, undefined);assert.equal(paymentAmount(r), null);
 assert.equal(parseReport(supabaseReceipt.replaceAll('$27.00','$27 .00'),'receipt.pdf').totals.closing,2700);
 const userReceipt = validateReceipt({month:'2026-09',amount:2700,cardLast4:'0698',source:'user'});
 const again = upsertReport([{...r,receipt:userReceipt}],parseReport(text+'\n','receipt.pdf'),'2026-09');
 assert.equal(again.length,1);assert.equal(again[0].receipt.cardLast4,'0698');assert.equal(again[0].receipt.source,'user');
});
test('Supabase rejects an unpaid invoice and contradictory totals or dates', () => {
 assert.throws(()=>parseReport(supabaseReceipt.replace('RECEIPT','INVOICE').replace('Payment date','Due date').replaceAll('Amount paid','Amount due'),'Invoice.pdf'),/Receipt/);
 assert.throws(()=>parseReport(supabaseReceipt.replace('Subtotal\n$27.00','Subtotal\n$25.00'),'Receipt.pdf'),/no cuadran/);
 assert.throws(()=>parseReport(supabaseReceipt.replaceAll('Sep 20, 2026','Feb 30, 2026'),'Receipt.pdf'),/fecha/);
 assert.equal(parseReport(supabaseReceipt+'\nMastercard - 0698','Receipt.pdf').cardLast4,'0698');
});

test('two separate receipts on the same day survive, and importing one again is idempotent', () => {
 const first = parseReport(invoice('A'), 'first.pdf'), second = parseReport(invoice('B'), 'second.pdf');
 let records = upsertReport([], first, '2026-09'); records = upsertReport(records, second, '2026-09'); records = upsertReport(records, parseReport(invoice('A'), 'renamed.pdf'), '2026-09');
 assert.equal(records.length, 2); assert.equal(records.reduce((n,r)=>n+paymentAmount(r),0), 36000);
 assert.equal(first.cardLast4,'0698');
 assert.throws(()=>upsertReport(records,parseReport(invoice('A'),'first.pdf'),'2026-10'), /ya está en/);
});
test('bank amount, date and FX survive reimport; USD without conversion is not counted as pesos', () => {
 const report = parseReport(invoice('A'), 'first.pdf');
 report.receipt=validateReceipt({month:'2026-09',amount:18100,date:'2026-09-24',source:'bank'});
 const records=upsertReport([report],parseReport(invoice('A'),'first.pdf'),'2026-09');
 assert.equal(paymentAmount(records[0]),18100); assert.equal(records[0].receipt.date,'2026-09-24');
 assert.equal(paymentAmount({...report,kind:'cursor',currency:'USD'}),null);
 assert.equal(paymentAmount({...report,kind:'cursor',currency:'USD',receipt:{...report.receipt,mxnAmount:53453}}),53453);
 assert.throws(()=>validateReceipt({...report.receipt,date:'2026-10-01'}),/mes/);
});
test('payment-only Play statement shows its payment, not zero closing balance', () => {
 const r=parseReport(`"Fecha","Descripción","Importe (MXN)"\n"1 sept 2026","Saldo inicial","100.00"\n"16 sept 2026","Pago automático: Banco","−100.00"\n"30 sept 2026","Saldo final","0.00"`,'account_activities_202609.csv');
 assert.equal(paymentAmount(r),10000);
});
test('Play IVA comes from matched Mexican sales detail, not 16 percent added to gross', () => {
 const r=parseReport(activity,'account_activities_202608.csv'); assert.equal(incomeFigures(r).salesVat,null);
 const text='Description,Transaction Date,Transaction Type,Buyer Country,Merchant Currency,Amount (Merchant Currency),Tax Type\na,"Aug 2, 2026",Charge,MX,MXN,116.00,\nb,"Aug 2, 2026",Google fee,MX,MXN,-17.40,\nc,"Aug 2, 2026",Tax,MX,MXN,-2.78,Mexico VAT';
 const withDetail=attachPlayEarnings(r,{name:'PlayApps_202608.csv',text});
 assert.equal(incomeFigures(withDetail).salesVat,1600); assert.equal(incomeFigures(withDetail).preliminaryVat,1322);
 assert.throws(()=>attachPlayEarnings(r,{name:'PlayApps_202608.csv',text:text.replace('116.00','117.00')}),/no coincide/);
});
test('Apple adjustments are not automatically classified as VAT and invalid totals are rejected', () => {
 const r=parseReport(apple,'financial_report.csv');const figures=incomeFigures(r);
 assert.equal(figures.feeVat,null);assert.equal(figures.preliminaryVat,null);assert.equal(paymentAmount(r),347964);
 assert.throws(()=>parseReport(apple.replaceAll('3479.64','9999.99'),'financial_report.csv'),/no cuadran/);
});
test('Apple estimates Mexican VAT from sales and fees independently of reported adjustments', () => {
 const report={...parseReport(apple,'financial_report.csv'),sales:409377,salesBase:352905,salesFee:52933};
 const f=incomeFigures(report);
 assert.equal(f.salesVat,56472); assert.equal(f.feeVat,8469); assert.equal(f.preliminaryVat,48003);
 assert.equal(f.preliminaryVat-report.totals.other,11);
 const adjusted={...report,totals:{...report.totals,other:0,closing:299972}};
 assert.equal(incomeFigures(adjusted).preliminaryVat,48003);
 assert.equal(incomeFigures({...report,salesFee:undefined}).preliminaryVat,null);
});
test('Stripe refunds reduce sales and net; contradictory rows and duplicate IDs fail closed', () => {
 const csv='Type,ID,Amount,Fees,Net,Currency,Created\nCharge,ch_1,116.00,11.60,104.40,mxn,2026-09-01\nRefund,re_1,-58.00,0.00,-58.00,mxn,2026-09-02';
 const r=parseReport(csv,'stripe.csv'); assert.equal(paymentAmount(r),4640);assert.equal(incomeFigures(r).salesVat,800);assert.equal(r.difference,0);
 assert.throws(()=>parseReport(csv.replace('104.40','104.41'),'stripe.csv'),/no cuadra/);
 assert.throws(()=>parseReport(csv.replace('re_1','ch_1'),'stripe.csv'),/duplicados/);
});

// Exercise the real route and workspace validation without network or production storage.
function transpiled(file, dependencies) {
 const source=ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const context={exports:{},require:name=>{if(!(name in dependencies))throw Error(`Unexpected dependency: ${name}`);return dependencies[name];},process:{env:{NODE_ENV:'test'}},Buffer,console,URL};
 vm.runInNewContext(source,context);return context.exports;
}
const validator=transpiled('../lib/accounting/store.ts',{'server-only':{},'node:crypto':{},'node:fs/promises':{},'node:path':{},'@/lib/supabase':{},'./ledger.mjs':ledger});
const memory=new Map();let version=0;
const route=transpiled('../app/contadores/api/route.ts',{
 'next/server':{NextResponse:{json:(data,options)=>({status:options.status,data})}},
 '@/lib/accounting/access':{sessionCookie:'test',sessionRole:async value=>value},
 '@/lib/accounting/ledger.mjs':ledger,'@/lib/accounting/pdf.mjs':{extractPdfText},
 '@/lib/accounting/store':{...validator,latest:async key=>memory.get(key)||null,storeVersion:async(key,value)=>{const id=String(++version);memory.set(key,{...value,key:id});return id;}}
});
const req=(body,token='owner')=>({cookies:{get:()=>({value:token})},headers:new Headers({host:'localhost',origin:'http://localhost','content-type':'application/json'}),nextUrl:new URL('http://localhost/contadores/api?view=report&platform=chatgpt'),text:async()=>JSON.stringify(body)});
test('Supabase PDF upload routes to expenses, retains the original and does not duplicate a payment', async () => {
 const pdf = compressedReceiptPdf(supabaseReceipt).toString('base64');
 const upload = versions => ({...req({action:'upload-report',versions,month:'2026-09',report:{name:'Receipt.pdf',pdf}}),nextUrl:new URL('http://localhost/contadores/api?view=report&platform=pdf')});
 const first = await route.POST(upload({supabase:''}));
 assert.equal(first.status,200);assert.equal(first.data.platform,'supabase');
 assert.equal(first.data.reports[0].file,pdf);assert.equal(first.data.reports[0].receipt.month,'2026-09');
 const second = await route.POST(upload({supabase:first.data.version}));
 assert.equal(second.status,200);assert.equal(second.data.reports.length,1);
 const read = await route.GET({...req({}),nextUrl:new URL('http://localhost/contadores/api?view=report&platform=supabase')});
 assert.equal(read.data.reports[0].id,'supabase:TEST-00012');assert.equal(read.data.reports[0].file,pdf);
});
test('API upload assigns month atomically, rejects cross-month duplicates and preserves same-day receipts', async () => {
 const first=await route.POST(req({action:'upload-report',version:'',month:'2026-09',report:{name:'first.pdf',text:invoice('A')}}));assert.equal(first.status,200);
 assert.equal(first.data.reports[0].receipt.month,'2026-09');
 const second=await route.POST(req({action:'upload-report',version:first.data.version,month:'2026-09',report:{name:'second.pdf',text:invoice('B')}}));assert.equal(second.status,200);assert.equal(second.data.reports.length,2);
 const otherMonth=await route.POST(req({action:'upload-report',version:second.data.version,month:'2026-10',report:{name:'first.pdf',text:invoice('A')}}));assert.equal(otherMonth.status,400);
 const edit=await route.POST(req({action:'record-receipt',version:second.data.version,reportId:'chatgpt:A',receipt:{month:'2026-09',amount:18000,date:'2026-09-24',cardLast4:'0698',source:'bank'}}));assert.equal(edit.status,200);assert.equal(edit.data.reports.filter(r=>r.receipt.date).length,1);
 const forbidden=await route.POST(req({action:'record-receipt'},'reader'));assert.equal(forbidden.status,403);
});

const appleCommissionText = 'Fiscal Month: July, 2026\nPartner Revenue Apple Commission Total Amount Tax Rate VAT Adjustment on Commission VAT Adjustment on Commission (MXN)\nPaid AppsApple Services LATAM LLCMXN2,999.72529.423,528.721684.7184.71\nMexico Commission Invoice';
test('Apple commission invoice supplies exact fees and VAT without changing the deposit or relabeling adjustments', () => {
 const report={...parseReport(apple,'financial_report.csv'),sales:409377,salesBase:352905,salesFee:52933,receipt:{month:'2026-09',amount:347964}};
 const attached=ledger.attachAppleCommission(report,{name:'invoice.pdf',text:appleCommissionText});
 const f=incomeFigures(attached);
 assert.equal(f.fee,52942);assert.equal(f.feeVat,8471);
 assert.equal(f.base,352914);assert.equal(f.salesVat,56463);assert.equal(f.preliminaryVat,47992);
 assert.equal(f.base-f.fee,attached.totals.credit);
 assert.equal(f.base+f.salesVat,f.sales);
 assert.equal(incomeFigures({...attached,totals:{...attached.totals,other:0}}).preliminaryVat,47992);
 assert.equal(f.sales-f.fee-f.feeVat,paymentAmount(attached));
 assert.equal(attached.totals.other,47992);assert.equal(attached.receipt.month,'2026-09');
 const again=upsertReport([attached],parseReport(apple,'financial_report.csv'),'2026-09')[0];
 assert.equal(incomeFigures(again).feeVat,8471);
 const normalized=validator.validateWorkspace({...validator.emptyWorkspace(),reports:[attached]});
 assert.equal(incomeFigures(normalized.reports[0]).fee,52942);
});
test('Apple commission invoice rejects another period, earnings amount, currency or inconsistent VAT', () => {
 const report=parseReport(apple,'financial_report.csv');
 const attach=text=>ledger.attachAppleCommission(report,{name:'invoice.pdf',text});
 assert.throws(()=>attach(appleCommissionText.replace('July','August')),/no corresponde/);
 assert.throws(()=>attach(appleCommissionText.replace('2,999.72','2,998.72')),/no corresponde/);
 assert.throws(()=>attach(appleCommissionText.replace('LLCMXN','LLCUSD')),/MXN/);
 assert.throws(()=>attach(appleCommissionText.replaceAll('84.71','84.00')),/tasa/);
});
test('August Apple invoice cannot silently replace figures from a different set of earnings', () => {
 const financial=apple.replace('July','August').replace('19,2999.72,0,479.92,0,3479.64,3479.64','83,13967.52,0,2238.73,0,16206.25,16206.25');
 const report=parseReport(financial,'financial_report.csv');
 const invoice='Fiscal Month: August, 2026\nPaid AppsApple Services LATAM LLCMXN13,821.702,439.4216,260.7016390.31390.31\nMexico Commission Invoice';
 assert.equal(ledger.appleCommissionInvoice(invoice,'invoice.pdf').feeVat,39031);
 assert.throws(()=>ledger.attachAppleCommission(report,{name:'invoice.pdf',text:invoice}),/no corresponde/);
 assert.equal(paymentAmount(report),1620625);
});
test('API attaches Apple commission PDF text to the assigned month without adding an income', async () => {
 const appleReq=body=>({...req(body),nextUrl:new URL('http://localhost/contadores/api?view=report&platform=apple')});
 const uploaded=await route.POST(appleReq({action:'upload-report',version:'',month:'2026-09',report:{name:'financial_report.csv',text:apple}}));
 assert.equal(uploaded.status,200);
 const attached=await route.POST(appleReq({action:'upload-report',version:uploaded.data.version,month:'2026-09',report:{name:'invoice.pdf',text:appleCommissionText}}));
 assert.equal(attached.status,200);assert.equal(attached.data.platform,'apple');assert.equal(attached.data.reports.length,1);
 assert.equal(attached.data.reports[0].receipt.amount,347964);
 assert.equal(incomeFigures(attached.data.reports[0]).feeVat,8471);
 const wrongMonth=await route.POST(appleReq({action:'upload-report',version:attached.data.version,month:'2026-10',report:{name:'invoice.pdf',text:appleCommissionText}}));
 assert.equal(wrongMonth.status,400);
});
