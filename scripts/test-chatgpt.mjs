import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReport } from '../lib/accounting/ledger.mjs';

const file = `Receipt
Date paid
September 9, 2026
OpenAI OpCo, LLC
MXN$1,972.00 paid on September 9, 2026
Total
MXN$1,972.00
Amount paid
MXN$1,972.00
`;

test('chatgpt receipt keeps the peso total that was paid', () => {
  const report = parseReport(file, 'Receipt.pdf');
  assert.equal(report.kind, 'chatgpt');
  assert.equal(report.period, '2026-09-09');
  assert.equal(report.totals.closing, 197200);
  assert.equal(report.totals.tax, 0);
  assert.equal(report.difference, 0);
});
