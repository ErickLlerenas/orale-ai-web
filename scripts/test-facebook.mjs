import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReport } from '../lib/accounting/ledger.mjs';

const file = `Pago de Anuncios de Meta
Informe de facturación: 1/9/2026 - 30/9/2026
Fecha,Identificador de la transacción,Importe,Divisa
24/9/2026,1-2,"1,000.00",MXN
3/9/2026,3-4,"2,049.00",MXN
,Importe total facturado,"3,049.00",MXN
VAT Rate: 0%
VAT Amount: 0.00
`;

test('facebook billing summary keeps the charged total and the invoice VAT', () => {
  const report = parseReport(file, 'meta.csv');
  assert.equal(report.kind, 'facebook');
  assert.equal(report.period, '2026-09');
  assert.equal(report.rows[0].iso, '2026-09-03');
  assert.equal(report.totals.closing, 304900);
  assert.equal(report.totals.tax, 0);
  assert.equal(report.difference, 0);
  assert.equal(report.rows.some(row => row.description.includes('1-2')), false);
});

test('Meta next-month boundary replaces the same monthly report and preserves the original', () => {
  const text = file.replace('30/9/2026', '1/10/2026');
  const report = parseReport(text, 'meta.csv');
  assert.equal(report.period, '2026-09');
  assert.equal(report.text, text);
});

test('Meta report containing an October payment retains its October period', () => {
  const text = file.replace('30/9/2026', '1/10/2026').replace('24/9/2026', '1/10/2026');
  assert.equal(parseReport(text, 'meta.csv').period, '2026-10');
});
