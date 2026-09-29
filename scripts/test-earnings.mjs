import test from 'node:test';
import assert from 'node:assert/strict';
import Papa from 'papaparse';
import { mexicoVat, parseReport } from '../lib/accounting/ledger.mjs';

const row = (type, amount, country = 'MX') => ({ Description: 'order-1', 'Transaction Date': 'Aug 1, 2026', 'Transaction Type': type, 'Buyer Country': country, 'Merchant Currency': 'MXN', 'Amount (Merchant Currency)': amount, 'Tax Type': type === 'Tax' ? 'Mexico VAT' : '' });
const parse = rows => parseReport(Papa.unparse(rows), 'PlayApps_202608 2.csv');
test('VAT is included in Mexican customer charges, not calculated on the payout', () => {
  const r = parse([row('Charge','20432.00'), row('Google fee','-3064.80'), row('Tax','-490.37')]);
  assert.deepEqual(mexicoVat(r), { gross: 2043200, base: 1761379, vat: 281821 });
});
test('VAT excludes foreign sales and fees, and accounts for customer refunds', () => {
  const r = parse([row('Charge','232.00'), row('Charge refund','-116.00'), row('Charge','100.00','CO'), row('Google fee','-15.00')]);
  assert.deepEqual(mexicoVat(r), { gross: 11600, base: 10000, vat: 1600 });
  assert.equal(mexicoVat(parse([row('Charge','100.00','CO')])), null);
  assert.equal(mexicoVat({ totals: {} }), null);
});
test('earnings separates charges, fees, tax, refunds and countries without counting fee rows as purchases', () => {
  const r = parse([row('Charge','100.00'), row('Google fee','-15.00'), row('Tax','-2.40'), row('Charge','50.00','CO'), row('Charge refund','-50.00','CO')]);
  assert.equal(r.kind, 'earnings');
  assert.equal(r.totals.closing, 8260);
  assert.equal(r.totals.refund, -5000);
  assert.equal(r.countries[0].charges, 1);
  assert.equal(r.countries[1].net, 0);
  assert.equal(r.totals.payout, 0);
});
test('unknown adjustments remain included and visible', () => {
  const r = parse([row('Charge','100.00'),row('Adjustment','-1.00')]);
  assert.equal(r.totals.other,-100);
  assert.equal(r.totals.closing,9900);
});
test('earnings rejects invalid currencies, dates and missing schema', () => {
  assert.throws(() => parse([{...row('Charge','1.00'), 'Merchant Currency':'USD'}]));
  assert.throws(() => parse([{...row('Charge','1.00'), 'Transaction Date':'Sep 1, 2026'}]));
  assert.throws(() => parse([{...row('Charge','1.00'), 'Transaction Date':'Aug 32, 2026'}]));
  assert.throws(() => parseReport('A,B\n1,2', 'PlayApps_202608.csv'));
});
