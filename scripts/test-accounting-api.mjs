import assert from 'node:assert/strict';
import { parseReport } from '../lib/accounting/ledger.mjs';
const origin = process.env.ACCOUNTING_TEST_ORIGIN || 'http://127.0.0.1:3107';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('Esta prueba solo puede usar localhost.');
const owner = 'Basic ' + btoa('admin:local-preview-only');
const reader = 'Basic ' + btoa('contadores:reader-preview-only');
async function req(auth, body, extra = {}) {
  const response = await fetch(origin + '/contadores/api?month=2026-09', { method: body ? 'POST' : 'GET', headers: { ...(auth ? { Authorization: auth } : {}), Origin: origin, 'Content-Type': 'application/json', ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: response.headers.get('content-type')?.includes('json') ? await response.json() : null };
}
const header = '"Fecha","Descripción","Importe (MXN)"\n';
const august = parseReport(header + '"1 ago 2026","Saldo inicial","0.00"\n"2 ago 2026","Aplicaciones de Google Play","100.00"\n"2 ago 2026","Aplicaciones de Google Play","−15.00"\n"1 – 31 de ago de 2026","I.V.A.","−2.40"\n"1 sept 2026","Saldo final","82.60"', 'account_activities_202608.csv');
const september = parseReport(header + '"1 sept 2026","Saldo inicial","82.60"\n"16 sept 2026","Pago automático: DATO FICTICIO DE PRUEBA","−82.60"\n"29 sept 2026","Saldo final","0.00"', 'account_activities_202609.csv');
assert.equal((await req()).status, 401);
const before = await req(owner); assert.equal(before.status, 200);
const state = { reports: [august, september], links: { '2026-09:3': '2026-08' }, bank: {}, notes: { '2026-09': 'DATOS FICTICIOS DE PRUEBA. No corresponden a ingresos reales.' } };
assert.equal((await req(reader, { action: 'save', state, version: before.data.version })).status, 403);
assert.equal((await req(owner, { action: 'save', state, version: before.data.version }, { Origin: 'https://example.invalid' })).status, 403);
const saved = await req(owner, { action: 'save', state, version: before.data.version }); assert.equal(saved.status, 200);
assert.equal((await req(owner, { action: 'save', state, version: before.data.version })).status, 409);
const pub = await req(owner, { action: 'publish', month: '2026-09', version: saved.data.version }); assert.equal(pub.status, 200);
const seen = await req(reader); assert.equal(seen.status, 200); assert.equal(seen.data.review, true); assert.equal(seen.data.state.reports.length, 2);
const changed = { ...state, notes: { '2026-09': 'BORRADOR NO PUBLICADO' } };
const saved2 = await req(owner, { action: 'save', state: changed, version: saved.data.version }); assert.equal(saved2.status, 200);
assert.notEqual((await req(reader)).data.state.notes['2026-09'], 'BORRADOR NO PUBLICADO');
await req(owner, { action: 'save', state, version: saved2.data.version });
console.log('PASS: authentication, read-only role, cross-origin rejection, stale version, import, publication, isolated draft. Synthetic preview data only.');
