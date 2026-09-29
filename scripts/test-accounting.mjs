import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parseReport, parseAmount, dateISO, payoutRows, csv, mexicoVat } from "../lib/accounting/ledger.mjs";
const header = '"Fecha","Descripción","Importe (MXN)"\r\n';
const sample = header + '"1 ago 2026","Saldo inicial","10.00"\r\n"2 ago 2026","Aplicaciones de Google Play","100.00"\r\n"2 ago 2026","Aplicaciones de Google Play","−15.00"\r\n"16 ago 2026","Pago automático: Prueba","−10.00"\r\n"1 – 31 de ago de 2026","I.V.A.","−2.40"\r\n"1 sept 2026","Saldo final","82.60"';
test("exact cents, BOM, Unicode minus and quoted fields", () => {
  const r = parseReport('\ufeff' + sample, 'account_activities_202608 (1).csv');
  assert.equal(r.totals.credit, 10000); assert.equal(r.totals.debit, -1500); assert.equal(r.totals.tax, -240); assert.equal(r.difference, 0);
  assert.equal(r.rows.at(-1).date, '1 sept 2026'); assert.equal(r.period, '2026-08');
  assert.equal(r.totals.closing, 8260);
  assert.deepEqual(mexicoVat(r), { gross: 10000, base: 8621, vat: 1379 });
});
test("payout-only files are not mistaken for zero sales", () => {
  const text = header + '"1 sept 2026","Saldo inicial","82.60"\n"16 sept 2026","Pago automático: Prueba","−82.60"\n"29 sept 2026","Saldo final","0.00"';
  const r = parseReport(text, 'account_activities_202609.csv');
  assert.equal(r.hasOperations, false); assert.equal(payoutRows([r], '2026-09')[0].amount, -8260); assert.equal(payoutRows([r], '2026-08').length, 0);
});
test("mismatched periods, broken money, missing balances and malformed dates rejected", () => {
  for (const amount of ['12.345', '1,2.00', 'NaN', '', '1e3', '10,00']) assert.throws(() => parseAmount(amount));
  assert.equal(dateISO('31 feb 2026'), null); assert.equal(parseAmount('1,234.56'), 123456);
  assert.throws(() => parseReport(sample, 'account_activities_202613.csv'));
  assert.throws(() => parseReport(sample, 'account_activities_202609.csv'));
  assert.throws(() => parseReport(header, 'account_activities_202608.csv'));
  assert.throws(() => parseReport(sample.replace('Saldo inicial', 'Otro saldo'), 'account_activities_202608.csv'));
});
test("unknown movements preserved; discrepancies are not silently hidden", () => {
  const r = parseReport(sample.replace('82.60', '90.00').replace('I.V.A.', 'Otro cargo'), 'account_activities_202608.csv');
  assert.equal(r.totals.other, -240); assert.equal(r.difference, -740);
});
test("CSV export neutralizes spreadsheet formulas", () => { assert.match(csv([{ Nota: '=IMPORTXML("x")' }]), /'=IMPORTXML/); });
test("auth fails closed and accountant cannot become owner", () => {
  const output = ts.transpileModule(readFileSync(new URL('../lib/accounting/access.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {}, process: { env: { ADMIN_PASSWORD: 'owner:secret', CONTADORES_PASSWORD: 'reader-secret' } }, atob };
  vm.runInNewContext(output, context);
  const role = context.exports.accountingRole; const auth = v => 'Basic ' + btoa(v);
  assert.equal(role(null), null); assert.equal(role('Basic !'), null);
  assert.equal(role(auth('admin:owner:secret')), 'owner'); assert.equal(role(auth('contadores:reader-secret')), 'reader');
  assert.equal(role(auth(':ejele123')), 'owner'); assert.equal(role(auth(':contador')), 'reader'); assert.equal(role(auth('admin:contador')), 'reader');
  assert.equal(role(auth('admin:reader-secret')), null);
  context.process.env = {}; assert.equal(role(auth('admin:')), null);
});
