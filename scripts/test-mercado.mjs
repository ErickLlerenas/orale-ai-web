import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { parseReport } from '../lib/accounting/ledger.mjs';
import { extractPdfText } from '../lib/accounting/pdf.mjs';

const file = `Folio Fiscal
12345678-1234-1234-1234-123456789012
Fecha de Emisión
2026-09-04T15:34:48
80141600 - Programas de Marketing de Afiliado
$  1,260.54
002
Tasa
0.160000
$  201.69
$  1,260.54
002
Tasa
0.106667
$  134.46
$  1,260.54
001
Tasa
0.012500
$  15.76
80141600 - Programas de Marketing de Afiliado - Meli Connect
$  62.92
002
Tasa
0.160000
$  10.07
$  62.92
002
Tasa
0.106667
$  6.71
$  62.92
001
Tasa
0.012500
$  0.79
002
$  141.17
001
$  16.55
Subtotal
$  1,323.46
Total
$  1,377.50
IMPORTES TOTALES
002
$  211.76
`;

test('mercado affiliate paycheck keeps the official tax breakdown', () => {
  const report = parseReport(file, 'paycheck.pdf');
  assert.equal(report.kind, 'mercado');
  assert.equal(report.period, '2026-09');
  assert.equal(report.totals.credit, 132346);
  assert.equal(report.totals.tax, 21176);
  assert.equal(report.totals.other, 14117);
  assert.equal(report.totals.debit, 1655);
  assert.equal(report.totals.closing, 137750);
  assert.equal(report.difference, 0);
});

test('pdf text extractor reads parenthesized strings', () => {
  const stream = deflateSync(Buffer.from('(Programas de Marketing de Afiliado) Tj\n(Subtotal) Tj\n', 'latin1'));
  const pdf = Buffer.concat([
    Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length ' + stream.length + ' >>\nstream\n'),
    stream,
    Buffer.from('\nendstream\nendobj\ntrailer\n<<>>\n%%EOF\n'),
  ]);
  assert.match(extractPdfText(pdf), /Programas de Marketing de Afiliado/);
});
