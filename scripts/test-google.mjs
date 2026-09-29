import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReport } from '../lib/accounting/ledger.mjs';

const file = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante Fecha="2026-09-20T05:03:17" Folio="27238642" Moneda="MXN" SubTotal="517.24" Total="600">
<cfdi:Emisor Nombre="GOOGLE OPERACIONES DE MEXICO"/>
<cfdi:Concepto Descripcion="Prepago de servicios de anuncios de Google"/>
<cfdi:Impuestos TotalImpuestosTrasladados="82.76"/>
</cfdi:Comprobante>
`;

test('google ads invoice keeps the paid total and the 16 percent VAT', () => {
  const report = parseReport(file, 'FCP-27238642.xml');
  assert.equal(report.kind, 'google');
  assert.equal(report.period, '2026-09-20-27238642');
  assert.equal(report.totals.closing, 60000);
  assert.equal(report.totals.tax, 8276);
  assert.equal(report.totals.credit, 51724);
  assert.equal(report.difference, 0);
});
