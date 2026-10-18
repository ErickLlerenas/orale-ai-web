import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const dir=mkdtempSync(join(tmpdir(),'orale-country-'));
for(const name of ['format','parse','summary']) {
  writeFileSync(join(dir,name+'.js'),ts.transpileModule(readFileSync(new URL('../lib/owner/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText);
}
writeFileSync(join(dir,'pricing.js'),ts.transpileModule(readFileSync(new URL('../lib/pricing.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText);
const require=createRequire(import.meta.url);
const {pesos}=require(join(dir,'format.js'));
const {parseOwnerMetrics,viewFor,hasMixedCurrencies}=require(join(dir,'parse.js'));
const {arqueoBadge,vsYesterdayLabel}=require(join(dir,'summary.js'));
const {pricingNow,pricingForCountry,clp}=require(join(dir,'pricing.js'));
rmSync(dir,{recursive:true,force:true});
test('owner formats MXN exactly as before and CLP without cents',()=>{
 assert.equal(pesos(1250050),'$12,500.50');
 assert.equal(pesos(1250000,'CL'),'$12.500');
 assert.equal(arqueoBadge(1000000,1250000,'CL').label,'Sobró $2.500');
 assert.equal(vsYesterdayLabel(1250000,'CL'),'+$12.500 vs ayer');
});
test('owner reads restaurant currency and refuses mixed-currency totals',()=>{
 const b=parseOwnerMetrics({locations:[{businessId:'cl',country:'CL',days:[],orders:[]},{businessId:'mx',days:[],orders:[]}]});
 assert.equal(viewFor(b,'cl').country,'CL');
 assert.equal(viewFor(b,'mx').country,'MX');
 assert.equal(hasMixedCurrencies(b),true);
 assert.equal(viewFor(b,null).caja,null);
 assert.deepEqual(viewFor(b,null).days,[]);
});
test('one Chilean location works without manually selecting the location',()=>{
 const b=parseOwnerMetrics({locations:[{businessId:'cl',country:'CL',days:[],orders:[]}]});
 assert.equal(viewFor(b,null).country,'CL');
});

test('approved Chile prices are independent of Mexican promotions',()=>{
 for(const date of [new Date('2026-08-01'),new Date('2026-10-17')]) {
  assert.deepEqual(pricingForCountry('CL',date),{prices:{base:{monthly:5990,yearly:49990},pro:{monthly:9990,yearly:79990}},next:null,promoEndsLabel:null,increaseOnLabel:null});
  assert.deepEqual(pricingForCountry('MX',date),pricingNow(date));
 }
 assert.equal(clp(5990),'$5.990');
 assert.equal(clp(79990),'$79.990');
});
