import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReport } from '../lib/accounting/ledger.mjs';

const file = `Type,Amount,Fees,Net,Currency,Created
Charge,199.00,11.79,187.21,mxn,2026-09-01 17:29
Stripe Fee,-1.39,0.22,-1.61,mxn,2026-09-02 02:43
`;

test('stripe payout keeps the fee VAT from each line and the deposit is the net', () => {
  const report = parseReport(file, 'transfers.csv');
  assert.equal(report.kind, 'stripe');
  assert.equal(report.period, '2026-09');
  assert.equal(report.totals.credit, 19900);
  assert.equal(report.salesBase, 17155);
  assert.equal(report.totals.debit, -1155);
  assert.equal(report.totals.tax, -185);
  assert.equal(report.totals.closing, 18560);
  assert.equal(report.difference, 0);
});
