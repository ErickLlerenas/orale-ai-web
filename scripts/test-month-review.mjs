import test from 'node:test';
import assert from 'node:assert/strict';
import { groupAppleFiles, monthPending } from '../lib/accounting/month-review.mjs';
test('lists only what is missing, in plain words',()=>{
 assert.deepEqual(monthPending({}),[]);
 const pending=monthPending({hasNu:false,receipts:['Claude','Cloudflare'],accountant:true,appleFiles:groupAppleFiles([{file:'factura de comisión (Mexico.pdf)',period:'septiembre'},{file:'factura de comisión (Mexico.pdf)',period:'agosto'}])}).map(item=>item.text);
 assert.deepEqual(pending,['Movimientos de Nu','Comprobantes de Claude y Cloudflare','Comprobante de honorarios','Factura de comisión de Apple (septiembre y agosto)']);
 assert.deepEqual(monthPending({bankMissing:['PDF del corte'],unidentified:1,receipts:['Claude']}).map(item=>item.text),['Banamex: PDF del corte','1 movimiento de Banamex sin identificar','Comprobante de Claude']);
});
