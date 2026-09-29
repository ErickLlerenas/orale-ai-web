import test from 'node:test';
import assert from 'node:assert/strict';
import Papa from 'papaparse';
import { parseReport, mexicoVat, appleSales } from '../lib/accounting/ledger.mjs';

const csv = (currency = 'MXN', proceeds = '3479.64') => Papa.unparse([
  ['iTunes Connect - Payments and Financial Reports\t(July, 2026)'],
  ['Country or Region (Currency)','Units Sold','Earned','Input Tax','Adjustments','Withholding Tax','Total Owed','Proceeds','Bank Account Currency'],
  ['Mexico (MXN)','19','2999.72','0','479.92','0','3479.64',proceeds,currency],
  ['','','','','','','','3,479.64 MXN'],
  ['','','','','','','','Paid to BANK'],
]);
test('Apple summary preserves fiscal month, adjustments and proceeds without assuming sales VAT', () => {
  const r = parseReport(csv(), 'financial_report (3).csv');
  assert.equal(r.kind, 'apple');
  assert.equal(r.period, '2026-07');
  assert.equal(r.totals.credit, 299972);
  assert.equal(r.totals.other, 47992);
  assert.equal(r.totals.closing, 347964);
  assert.equal(r.countries[0].charges, 19);
  assert.equal(mexicoVat(r), null);
  assert.deepEqual(r.rows, []);
});
test('Apple detail totals the subscription price, including refunds', () => {
  const detail = [
    'Vendor Name\tTest',
    'Transaction Date\tSettlement Date\tApple Identifier\tSKU\tTitle\tDeveloper Name\tProduct Type Identifier\tCountry of Sale\tQuantity\tPartner Share\tExtended Partner Share\tPartner Share Currency\tCustomer Price\tCustomer Currency\tSale or Return',
    '07/01/2026\t07/01/2026\t1\tmonthly\tMonth\t\tIAY\tMX\t2\t72.54\t145.08\tMXN\t99.000\tMXN\tS',
    '07/02/2026\t07/02/2026\t1\tmonthly\tMonth\t\tIAY\tMX\t-1\t72.54\t-72.54\tMXN\t-99.000\tMXN\tR',
  ].join('\n');
  assert.deepEqual(appleSales(detail, 'FD_94105360_0726.txt'), { period: '2026-07', customer: 9900, base: 8535, fee: 1281 });
});
test('Apple rejects unsupported currencies and malformed amounts and periods', () => {
  assert.throws(() => parseReport(csv('USD'), 'financial_report.csv'), /MXN/);
  assert.throws(() => parseReport(csv('MXN','invalid'), 'financial_report.csv'));
  assert.throws(() => parseReport(csv().replace('July','Unknown'), 'financial_report.csv'));
  assert.throws(() => parseReport(csv().replace('Earned','Missing'), 'financial_report.csv'));
});
