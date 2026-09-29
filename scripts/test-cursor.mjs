import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReport } from '../lib/accounting/ledger.mjs';

const file = `Invoice number
LXFJLTVE-0016
Date of issue
September 9, 2026
Cursor
$20.00 USD due September 9, 2026
Amount due
$20.00 USD
`;

test('cursor invoice keeps the dollar total and does not invent VAT', () => {
  const report = parseReport(file, 'cursor.pdf');
  assert.equal(report.kind, 'cursor');
  assert.equal(report.period, '2026-09-09');
  assert.equal(report.totals.closing, 2000);
  assert.equal(report.totals.tax, 0);
  assert.equal(report.difference, 0);
});
