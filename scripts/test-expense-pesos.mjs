import test from 'node:test';
import assert from 'node:assert/strict';
import {expensePesos} from '../lib/accounting/expense-pesos.mjs';
import {reportKey} from '../lib/accounting/ledger.mjs';
const cursor={kind:'cursor',period:'2026-09-09',documentDate:'2026-09-09',receipt:{month:'2026-09'},totals:{closing:2000}};
const supabase={kind:'supabase',period:'2026-09-20',documentDate:'2026-09-20',receipt:{month:'2026-09'},totals:{closing:2700}};
test('uses actual matched pesos without converting dollars or including card payments',()=>{
 const rows=[{date:'2026-09-09',category:'cursor',amount:-36396},{date:'2026-09-20',category:'supabase',amount:-46562,status:'posted'},{date:'2026-09-20',category:'payment',amount:46562}];
 const result=expensePesos([cursor,supabase],rows,'2026-09');
 assert.equal(result[reportKey(cursor)],36396);assert.equal(result[reportKey(supabase)],46562);
});
test('ambiguous, cancelled, pending or different-month charges do not produce a peso amount',()=>{
 const row={date:'2026-09-20',category:'supabase',amount:-46562,status:'posted'};
 for(const rows of [[row,row],[{...row,status:'pending'}],[{...row,status:'cancelled'}],[{...row,postedDate:'2026-10-01'}]])assert.equal(expensePesos([supabase],rows,'2026-09')[reportKey(supabase)],null);
 assert.deepEqual(expensePesos([supabase],[row],'2026-10'),{});
});
test('excludes adjustment documents and preserves MXN invoice amounts',()=>{
 const google={kind:'google',period:'2026-09-20',receipt:{month:'2026-09'},totals:{closing:60000}};
 const adjustment={...google,period:'2026-09-21',isAdjustment:true,totals:{closing:2}};
 const result=expensePesos([google,adjustment],[],'2026-09');
 assert.equal(result[reportKey(google)],60000);assert.equal(result[reportKey(adjustment)],undefined);
});
