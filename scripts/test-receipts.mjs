import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReceipt } from '../lib/accounting/ledger.mjs';
test('receipt month and actual bank amount are independent from source report', () => {
  assert.deepEqual(validateReceipt({ month:'2026-09', amount:347964 }), { month:'2026-09', amount:347964 });
  assert.deepEqual(validateReceipt({ month:'2026-10', amount:340000 }), { month:'2026-10', amount:340000 });
});
test('invalid bank months and amounts cannot enter monthly totals', () => {
  for (const receipt of [null, {}, {month:'2026-13',amount:1}, {month:'2026-09',amount:-1}, {month:'2026-09',amount:1.5}, {month:'2026-09',amount:'100'}, {month:'2026-09',amount:Infinity}]) assert.throws(() => validateReceipt(receipt));
});
