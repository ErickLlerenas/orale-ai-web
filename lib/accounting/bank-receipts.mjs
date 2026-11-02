// Providers without a parser: the bank charge gives the amount and the PDF or XML proves it.
export const receiptCategories = { Claude: 'anthropic', Cloudflare: 'cloudflare', RevenueCat: 'revenuecat', Contabilidad: 'accountant' };
// The caller supplies the content hash so this module also runs in the browser.
export function validateReceiptFile(file, hash) {
  if (!file || typeof file.name !== 'string' || !file.name.trim() || file.name.length > 180 || typeof file.data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(file.data)) throw new Error('Archivo inválido.');
  const bytes = Buffer.from(file.data, 'base64');
  if (!bytes.length || bytes.length > 2_000_000) throw new Error('El comprobante debe pesar menos de 2 MB.');
  const type = bytes.subarray(0, 5).toString() === '%PDF-' ? 'pdf' : /<cfdi:Comprobante\b/.test(bytes.toString('utf8', 0, 4000)) ? 'xml' : null;
  if (!type) throw new Error('Sube el comprobante en PDF o el XML de la factura.');
  return { id: hash(bytes), name: file.name.trim(), type, data: file.data };
}
export function assignReceipt(receipts, rows, { id, name, type, category }) {
  if (!Object.values(receiptCategories).includes(category)) throw new Error('Apartado inválido.');
  const existing = receipts.find(receipt => receipt.id === id);
  if (existing) return receipts;
  const used = new Set(receipts.map(receipt => receipt.rowId));
  const row = rows.filter(r => r.category === category && r.amount < 0 && !used.has(r.id)).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!row) throw new Error('No hay un cargo de Banamex sin comprobante en ese apartado este mes.');
  return [...receipts, { id, name, type, category, rowId: row.id }];
}
