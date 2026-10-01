import Papa from 'papaparse';

const months = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sept: 9, sep: 9, oct: 10, nov: 11, dic: 12 };
export const money = cents => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cents / 100);
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function parseAmount(value) {
  const v = String(value).trim().replaceAll('−', '-');
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)\.\d{2}$/.test(v)) throw new Error(`Importe no reconocido: ${value}`);
  const sign = v.startsWith('-') ? -1 : 1;
  const [whole, fraction] = v.replace('-', '').replaceAll(',', '').split('.');
  const amount = sign * (Number(whole) * 100 + Number(fraction));
  if (!Number.isSafeInteger(amount)) throw new Error('Importe fuera de rango.');
  return amount;
}
export function dateISO(value) {
  const m = value.trim().toLowerCase().match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/u);
  if (!m || !months[m[2]]) return null;
  const iso = `${m[3]}-${String(months[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === iso ? iso : null;
}
function parseStripeReport(text, name) {
  const parsed = Papa.parse(text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'), { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() });
  const expected = ['Type', 'Amount', 'Fees', 'Net', 'Currency', 'Created'];
  if (parsed.errors.some(e => e.type !== 'FieldMismatch') || expected.some(f => !parsed.meta.fields?.includes(f)) || !parsed.data.length) throw new Error('El CSV de Stripe no tiene el formato de movimientos.');
  let credit = 0, refund = 0, debit = 0, tax = 0, closing = 0, salesBase = 0, latest = '';
  const ids = new Set();
  const rows = parsed.data.map((row, index) => {
    if (String(row.Currency).trim().toLowerCase() !== 'mxn' || (row['Converted Currency'] && row['Converted Currency'].trim().toLowerCase() !== 'mxn')) throw new Error('Stripe requiere importes en MXN.');
    const iso = String(row.Created || '').slice(0, 10);
    if (!validDate(iso)) throw new Error(`Fecha inválida en la fila ${index + 2}.`);
    if (iso > latest) latest = iso;
    if (row.ID) { if (ids.has(row.ID)) throw new Error('El CSV de Stripe contiene movimientos duplicados.'); ids.add(row.ID); }
    const amount = parseAmount(row.Amount), fees = parseAmount(row.Fees), net = parseAmount(row.Net);
    if (amount - fees !== net) throw new Error(`El neto de Stripe no cuadra en la fila ${index + 2}.`);
    const type = String(row.Type).trim();
    if (type === 'Charge' || type === 'Refund' || type === 'Charge Refund') {
      if ((type === 'Charge' && amount < 0) || (type !== 'Charge' && amount > 0)) throw new Error('Signo de cargo o devolución de Stripe inválido.');
      const feeBase = roundSigned(fees / 1.16);
      if (type === 'Charge') credit += amount; else refund += amount;
      salesBase += roundSigned(amount / 1.16); debit -= feeBase; tax -= fees - feeBase;
    } else if (type === 'Stripe Fee') {
      debit += amount; tax -= fees;
    } else throw new Error(`Movimiento de Stripe no reconocido: ${type}. No se omitió: revisa el archivo.`);
    closing += net;
    return { line: index + 2, date: iso, iso, description: type, amount, type: type === 'Charge' ? 'credit' : type.includes('Refund') ? 'refund' : 'fee', transactionId: row.ID || null };
  });
  return { kind: 'stripe', name, period: latest.slice(0, 7), text, rows, salesBase, totals: { opening: 0, closing, credit, refund, debit, tax, payout: 0, other: 0 }, difference: credit + refund + debit + tax - closing, importedAt: new Date().toISOString(), hasOperations: true };
}
function pdfMoney(value) {
  return parseAmount(String(value).replaceAll('$', '').replaceAll(' ', ''));
}
function parseMercadoReport(text, name) {
  const tokens = text.split('\n').map(token => token.trim()).filter(Boolean);
  if (!tokens.some(token => token.includes('Programas de Marketing de Afiliado'))) throw new Error('El PDF no es un pago de Mercado Libre Afiliados.');
  const sub = tokens.indexOf('Subtotal');
  const total = tokens.indexOf('Total');
  const summary = tokens.indexOf('IMPORTES TOTALES');
  const issued = tokens.indexOf('Fecha de Emisión');
  if (sub < 2 || total < 0 || summary < 0 || !/^\d{4}-\d{2}-\d{2}T/.test(tokens[issued + 1] || '')) throw new Error('El PDF de Mercado Libre no trae el desglose fiscal.');
  const credit = pdfMoney(tokens[sub + 1]);
  const closing = pdfMoney(tokens[total + 1]);
  let tax = 0, withheldVat = 0, withheldIsr = 0;
  for (let i = summary + 1; i + 1 < tokens.length && /^\d{3}$/.test(tokens[i]); i += 2) {
    if (tokens[i] !== '002') throw new Error('Impuesto trasladado no reconocido.');
    tax += pdfMoney(tokens[i + 1]);
  }
  for (let i = sub - 2; i >= 0 && /^\d{3}$/.test(tokens[i]); i -= 2) {
    const amount = pdfMoney(tokens[i + 1]);
    if (tokens[i] === '002') withheldVat += amount;
    else if (tokens[i] === '001') withheldIsr += amount;
    else throw new Error('Retención no reconocida.');
  }
  let lineVat = 0, lineWithheldVat = 0, lineIsr = 0;
  for (let i = 0; i < tokens.length - 4; i++) {
    if (tokens[i + 2] !== 'Tasa' || !/^\d{3}$/.test(tokens[i + 1]) || !tokens[i].startsWith('$') || !tokens[i + 4].startsWith('$')) continue;
    const amount = pdfMoney(tokens[i + 4]);
    if (tokens[i + 1] === '002' && tokens[i + 3].startsWith('0.16')) lineVat += amount;
    else if (tokens[i + 1] === '002' && tokens[i + 3].startsWith('0.10')) lineWithheldVat += amount;
    else if (tokens[i + 1] === '001') lineIsr += amount;
  }
  if (lineVat !== tax || lineWithheldVat !== withheldVat || lineIsr !== withheldIsr) throw new Error('El desglose del PDF no cuadra con los totales.');
  return { kind: 'mercado', name, period: tokens[issued + 1].slice(0, 7), text, rows: [], totals: { opening: 0, closing, credit, debit: withheldIsr, tax, payout: 0, other: withheldVat }, difference: credit + tax - withheldVat - withheldIsr - closing, importedAt: new Date().toISOString(), hasOperations: true };
}
function metaDate(day, month, year) {
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${iso}T12:00:00Z`);
  if (date.toISOString().slice(0, 10) !== iso) throw new Error('Fecha inválida en el resumen de Meta.');
  return iso;
}
function parseFacebookReport(text, name) {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!clean.includes('Pago de Anuncios de Meta') || !clean.includes('Importe total facturado')) throw new Error('El CSV no es un resumen de facturación de Meta.');
  const range = clean.match(/Informe de facturación:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!range) throw new Error('El resumen de Meta no trae el periodo.');
  const start = metaDate(range[1], range[2], range[3]);
  const end = metaDate(range[4], range[5], range[6]);
  const rows = [];
  for (const line of clean.split('\n')) {
    const charge = line.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),[^,]*,"?([\d,]+\.\d{2})"?,(MXN)\s*$/);
    if (!charge) continue;
    const iso = metaDate(charge[1], charge[2], charge[3]);
    if (iso < start || iso > end) throw new Error('Un cargo de Meta queda fuera del periodo del resumen.');
    rows.push({ line: rows.length + 1, date: iso, iso, description: 'Pago', amount: parseAmount(charge[4]), type: 'debit' });
  }
  rows.sort((a, b) => a.iso.localeCompare(b.iso) || a.line - b.line);
  const total = clean.match(/Importe total facturado,"?([\d,]+\.\d{2})"?,(MXN)/);
  const vatAmount = clean.match(/VAT Amount:\s*([\d,]+\.\d{2})/);
  const vatRate = clean.match(/VAT Rate:\s*([\d.]+)%/);
  if (!rows.length || !total || !vatAmount || !vatRate) throw new Error('El resumen de Meta no trae el total o el IVA.');
  const closing = parseAmount(total[1]);
  const tax = parseAmount(vatAmount[1]);
  const spent = rows.reduce((sum, row) => sum + row.amount, 0);
  if (vatRate[1] === '0' && tax !== 0) throw new Error('El IVA del resumen de Meta no cuadra.');
  // Meta exports a full month with the first day of the next month as its end.
  // Use the billed month only when every charge belongs to it.
  const nextMonth = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const period = end === nextMonth.toISOString().slice(0, 10) && rows.every(row => row.iso.startsWith(start.slice(0, 7)))
    ? start.slice(0, 7) : end.slice(0, 7);
  return { kind: 'facebook', name, period, text, rows, totals: { opening: 0, closing, credit: 0, debit: spent, tax, payout: 0, other: 0 }, difference: spent - closing, importedAt: new Date().toISOString(), hasOperations: true };
}
const cursorMonths = { january: '01', february: '02', march: '03', april: '04', may: '05', june: '06', july: '07', august: '08', september: '09', october: '10', november: '11', december: '12' };
function parseCursorReport(text, name) {
  const lines = text.split('\n').map(line => line.replaceAll('\u0000', '').trim()).filter(Boolean);
  if (!lines.includes('Cursor') && !lines.some(line => line.startsWith('Anysphere'))) throw new Error('El PDF no es una factura de Cursor.');
  const issued = lines.indexOf('Date of issue');
  const date = (lines[issued + 1] || '').match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})$/i);
  const due = lines.indexOf('Amount due');
  const amount = (lines[due + 1] || '').match(/^\$([\d,]+\.\d{2})\s*USD$/);
  if (!date || !amount) throw new Error('La factura de Cursor no trae la fecha o el total.');
  const closing = parseAmount(amount[1]);
  const period = `${date[3]}-${cursorMonths[date[1].toLowerCase()]}-${date[2].padStart(2, '0')}`;
  return { kind: 'cursor', name, period, text, rows: [], totals: { opening: 0, closing, credit: closing, debit: 0, tax: 0, payout: 0, other: 0 }, difference: 0, importedAt: new Date().toISOString(), hasOperations: true };
}
function parseSupabaseReport(text, name) {
  const clean = text.replaceAll('\u0000', '').replace(/\r/g, '').replace(/(\d)\s*\.\s*(\d{2})\b/g, '$1.$2');
  if (!/^\s*RECEIPT\b/i.test(clean) || !/Payment date/i.test(clean)) throw new Error('Para registrar el pago de Supabase, sube el Receipt. El Invoice no confirma que ya se pagó.');
  const number = clean.match(/Invoice number\s+([A-Z0-9]+(?:-[A-Z0-9]+)+)\b/i)?.[1];
  const date = clean.match(/Payment date\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/i);
  const month = date && Object.keys(cursorMonths).find(m => m === date[1].toLowerCase() || m.slice(0, 3) === date[1].toLowerCase());
  const period = month ? `${date[3]}-${cursorMonths[month]}-${date[2].padStart(2, '0')}` : '';
  const payments = [...clean.matchAll(/Amount paid\s+\$\s*([\d,]+\.\d{2})\b/g)].map(m => parseAmount(m[1]));
  const subtotal = clean.match(/\bSubtotal\s+\$\s*([\d,]+\.\d{2})\b/)?.[1];
  const taxLines = [...clean.matchAll(/(?:^|\n)\s*(?:VAT|IVA|Tax|GST|Sales tax)(?:\s*\([^\n)]*\))?\s+\$\s*([\d,]+\.\d{2})\b/gi)];
  if (!number || !validDate(period) || !payments.length || !subtotal) throw new Error('El recibo de Supabase no trae número, fecha de pago o importes completos.');
  // Supabase issues its invoices in USD (billing FAQ); the PDF uses a bare $.
  if (/\b(?:MXN|EUR|SGD|CAD|AUD|GBP)\b/.test(clean)) throw new Error('El recibo de Supabase debe estar en USD.');
  const closing = payments[0], credit = parseAmount(subtotal), tax = taxLines.reduce((sum, m) => sum + parseAmount(m[1]), 0);
  if (payments.some(amount => amount !== closing) || credit + tax !== closing) throw new Error('Los importes del recibo de Supabase no cuadran.');
  const cardLast4 = clean.match(/(?:Mastercard|Visa|American Express|Amex)\s*(?:[-·•*]+\s*|ending in\s+)(\d{4})\b/i)?.[1];
  return { kind: 'supabase', name, period, text, cardLast4, rows: [], totals: { opening: 0, closing, credit, debit: 0, tax, payout: 0, other: 0 }, difference: 0, importedAt: new Date().toISOString(), hasOperations: true };
}
function parseChatgptReport(text, name) {
  const lines = text.split('\n').map(line => line.replaceAll('\u0000', '').trim()).filter(Boolean);
  if (!lines.some(line => line.startsWith('OpenAI'))) throw new Error('El PDF no es un recibo de ChatGPT.');
  const paidOn = lines.indexOf('Date paid');
  const date = (lines[paidOn + 1] || '').match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})$/i);
  const paid = lines.indexOf('Amount paid');
  const amount = (lines[paid + 1] || '').match(/^MXN\$([\d,]+\.\d{2})$/);
  const totalAt = lines.indexOf('Total');
  const total = (lines[totalAt + 1] || '').match(/^MXN\$([\d,]+\.\d{2})$/);
  if (!date || !amount || !total) throw new Error('El recibo de ChatGPT no trae la fecha o el total.');
  const closing = parseAmount(amount[1]);
  if (parseAmount(total[1]) !== closing) throw new Error('El total del recibo de ChatGPT no cuadra.');
  const period = `${date[3]}-${cursorMonths[date[1].toLowerCase()]}-${date[2].padStart(2, '0')}`;
  return { kind: 'chatgpt', name, period, text, rows: [], totals: { opening: 0, closing, credit: closing, debit: 0, tax: 0, payout: 0, other: 0 }, difference: 0, importedAt: new Date().toISOString(), hasOperations: true };
}
function mxnCents(value) {
  const [whole, fraction = ''] = String(value).split('.');
  if (!/^\d+$/.test(whole) || fraction.length > 2 || !/^\d*$/.test(fraction)) throw new Error('Importe de Google inválido.');
  return parseAmount(`${whole}.${fraction.padEnd(2, '0')}`);
}
function parseGoogleReport(text, name) {
  if (!text.includes('GOOGLE OPERACIONES DE MEXICO') || !text.includes('Prepago de servicios de anuncios de Google')) throw new Error('El XML no es una factura de Google Ads.');
  const header = text.match(/<cfdi:Comprobante\b([^>]*)>/);
  const attr = key => header?.[1].match(new RegExp(`\\b${key}="([^"]*)"`))?.[1];
  const fecha = attr('Fecha')?.slice(0, 10);
  const folio = attr('Folio');
  const moneda = attr('Moneda');
  const iva = text.match(/TotalImpuestosTrasladados="([\d.]+)"/)?.[1];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '') || !folio || moneda !== 'MXN' || !iva) throw new Error('La factura de Google Ads no trae la fecha, el folio o el IVA.');
  const base = mxnCents(attr('SubTotal'));
  const tax = mxnCents(iva);
  const closing = mxnCents(attr('Total'));
  if (base + tax !== closing) throw new Error('El IVA de la factura de Google Ads no cuadra.');
  return { kind: 'google', name, period: `${fecha}-${folio}`, text, rows: [], totals: { opening: 0, closing, credit: base, debit: 0, tax, payout: 0, other: 0 }, difference: 0, importedAt: new Date().toISOString(), hasOperations: true };
}
function parseCloudReport(text, name) {
  // This importer accepts Google's MXN prepaid CFDI, not usage invoices.
  const tag = element => text.match(new RegExp(`<${element}\\b([^>]*)>`))?.[1] || '';
  const attr = (attributes, key) => attributes.match(new RegExp(`(?:^|\\s)${key}="([^"]*)"`))?.[1];
  const header = tag('cfdi:Comprobante'), issuer = tag('cfdi:Emisor');
  const date = attr(header, 'Fecha')?.slice(0, 10), folio = attr(header, 'Folio');
  const uuid = attr(tag('tfd:TimbreFiscalDigital'), 'UUID');
  const type = attr(header, 'TipoDeComprobante');
  const relationship = attr(tag('cfdi:CfdiRelacionados'), 'TipoRelacion');
  if (/<!DOCTYPE|<!ENTITY|<!--/i.test(text) || !text.includes('http://www.sat.gob.mx/cfd/4') ||
      (text.match(/<cfdi:Comprobante\b/g) || []).length !== 1 ||
      attr(issuer, 'Rfc') !== 'GCM221031837' || !text.includes('Prepago de servicios de Plataforma de Google Cloud')) {
    throw new Error('Usa los CFDI de prepago de Google Cloud, incluidos en el ZIP de AI Studio.');
  }
  if (!validDate(date) || !folio || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(uuid || '') ||
      attr(header, 'Moneda') !== 'MXN' || attr(header, 'MetodoPago') !== 'PUE' || !['I', 'E'].includes(type) ||
      (relationship && relationship !== '02') || /<cfdi:Retenciones\b/.test(text) ||
      (attr(header, 'Descuento') && mxnCents(attr(header, 'Descuento')) !== 0)) {
    throw new Error('Este CFDI de Google Cloud requiere revisión: fecha, moneda, pago o ajuste no compatible.');
  }
  const base = mxnCents(attr(header, 'SubTotal')), closing = mxnCents(attr(header, 'Total'));
  // Read the global tax, never both the concept tax and its repeated global value.
  const taxes = [...text.matchAll(/TotalImpuestosTrasladados="([\d.]+)"/g)];
  if (taxes.length !== 1) throw new Error('El CFDI de Google Cloud no trae un IVA total único.');
  const tax = mxnCents(taxes[0][1]);
  const transfers = [...text.matchAll(/<cfdi:Traslado\b([^>]*)>/g)];
  if (!transfers.length || transfers.some(m => attr(m[1], 'Impuesto') !== '002') || base + tax !== closing) throw new Error('El IVA y el total de Google Cloud no cuadran.');
  return { kind: 'cloud', isAdjustment: type === 'E' || relationship === '02', name, period: `${date}-${folio}`, text,
    documentDate: date, rows: [], totals: { opening: 0, closing, credit: base, debit: 0, tax, payout: 0, other: 0 },
    difference: 0, importedAt: new Date().toISOString(), hasOperations: true };
}
function parseSource(text, name) {
  if (text.includes('GOOGLE CLOUD MEXICO') || text.includes('GCM221031837')) return parseCloudReport(text, name);
  if (text.includes('Supabase Pte. Ltd.')) return parseSupabaseReport(text, name);
  if (text.replace(/^\uFEFF/, '').startsWith('"iTunes Connect - Payments and Financial Reports')) return parseAppleReport(text, name);
  const header = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || '';
  if (header.split(',').map(field => field.trim()).includes('Type') && header.includes('Fees') && header.includes('Net')) return parseStripeReport(text, name);
  if (text.includes('Programas de Marketing de Afiliado') && text.includes('IMPORTES TOTALES')) return parseMercadoReport(text, name);
  if (text.includes('Amount due') && text.includes('Date of issue') && /\$[\d,]+\.\d{2}\s*USD/.test(text)) return parseCursorReport(text, name);
  if (text.includes('OpenAI') && text.includes('Date paid') && text.includes('Amount paid') && /MXN\$[\d,]+\.\d{2}/.test(text)) return parseChatgptReport(text, name);
  if (text.includes('Pago de Anuncios de Meta') && text.includes('Importe total facturado')) return parseFacebookReport(text, name);
  if (text.includes('Prepago de servicios de anuncios de Google') && text.includes('GOOGLE OPERACIONES DE MEXICO')) return parseGoogleReport(text, name);
  if (/^PlayApps_/i.test(name)) return parseEarnings(text, name);
  const periodMatch = name.match(/^account_activities_(\d{4})(\d{2})(?:\s*\(\d+\))?\.csv$/i);
  if (!periodMatch || +periodMatch[2] < 1 || +periodMatch[2] > 12) throw new Error('Usa el nombre original account_activities_AAAAMM.csv para identificar el periodo.');
  const parsed = Papa.parse(text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'), { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() });
  if (parsed.errors.length) throw new Error(`CSV inválido: ${parsed.errors[0].message}`);
  const expected = ['Fecha', 'Descripción', 'Importe (MXN)'];
  if (parsed.meta.fields?.length !== 3 || expected.some(h => !parsed.meta.fields.includes(h))) throw new Error('Formato no compatible. Selecciona el CSV de actividades de Google Play en español y MXN.');
  if (!parsed.data.length) throw new Error('El archivo está vacío.');
  const period = `${periodMatch[1]}-${periodMatch[2]}`;
  const rows = parsed.data.map((r, i) => {
    const description = r['Descripción'].trim();
    const date = r.Fecha.trim();
    const amount = parseAmount(r['Importe (MXN)']);
    const type = description === 'Saldo inicial' ? 'opening' : description === 'Saldo final' ? 'closing' : description.startsWith('Pago automático:') ? 'payout' : description === 'I.V.A.' ? 'tax' : description === 'Aplicaciones de Google Play' ? (amount >= 0 ? 'credit' : 'debit') : 'other';
    const iso = dateISO(date);
    if (type === 'payout' && (!iso || iso.slice(0, 7) !== period || amount >= 0)) throw new Error(`Pago o fecha inválidos en la fila ${i + 2}.`);
    if (['credit', 'debit'].includes(type) && (!iso || iso.slice(0, 7) !== period)) throw new Error(`La fecha de la fila ${i + 2} no corresponde al archivo.`);
    return { line: i + 2, date, iso, description, amount, type };
  });
  const openings = rows.filter(r => r.type === 'opening');
  const closings = rows.filter(r => r.type === 'closing');
  if (openings.length !== 1 || closings.length !== 1) throw new Error('El reporte debe incluir un saldo inicial y un saldo final.');
  if (rows[0].type !== 'opening' || rows.at(-1).type !== 'closing') throw new Error('Los saldos no están en los extremos del reporte.');
  const total = type => rows.filter(r => r.type === type).reduce((n, r) => n + r.amount, 0);
  const totals = Object.fromEntries(['opening', 'closing', 'credit', 'debit', 'tax', 'payout', 'other'].map(t => [t, total(t)]));
  const difference = totals.opening + totals.credit + totals.debit + totals.tax + totals.payout + totals.other - totals.closing;
  return { name, period, text, rows, totals, difference, importedAt: new Date().toISOString(), hasOperations: rows.some(r => ['credit', 'debit', 'tax', 'other'].includes(r.type)) };
}
function parseEarnings(text, name) {
  const match = name.match(/^PlayApps_(\d{4})(\d{2})(?: \d+|\s*\(\d+\))?\.csv$/i);
  if (!match || +match[2] < 1 || +match[2] > 12) throw new Error('Usa el nombre original PlayApps_AAAAMM.csv.');
  const period = `${match[1]}-${match[2]}`;
  const parsed = Papa.parse(text.replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() });
  const required = ['Description', 'Transaction Date', 'Transaction Type', 'Buyer Country', 'Merchant Currency', 'Amount (Merchant Currency)', 'Tax Type'];
  if (parsed.errors.length || required.some(h => !parsed.meta.fields?.includes(h)) || !parsed.data.length) throw new Error('El informe de ingresos está vacío o tiene un formato inválido.');
  const englishMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const countries = {};
  const rows = parsed.data.map((r, i) => {
    if (r['Merchant Currency'] !== 'MXN') throw new Error('El informe debe estar expresado en MXN para el comerciante.');
    const date = r['Transaction Date'].trim();
    const parts = date.match(/^([A-Za-z]{3}) (\d{1,2}), (\d{4})$/);
    const month = parts ? englishMonths.indexOf(parts[1]) + 1 : 0;
    const iso = parts && month ? `${parts[3]}-${String(month).padStart(2, '0')}-${parts[2].padStart(2, '0')}` : null;
    if (!iso || iso.slice(0, 7) !== period || Number.isNaN(Date.parse(iso)) || new Date(iso).toISOString().slice(0,10) !== iso) throw new Error(`Fecha fuera del periodo o inválida en fila ${i + 2}.`);
    const amount = parseAmount(r['Amount (Merchant Currency)']);
    const transaction = r['Transaction Type'].trim();
    const type = ({ Charge: 'credit', 'Charge refund': 'refund', 'Google fee': 'debit', 'Google fee refund': 'debit', Tax: 'tax', 'Tax refund': 'tax' })[transaction] || 'other';
    const country = r['Buyer Country'].trim() || 'Sin identificar';
    const group = countries[country] ??= { code: country, charges: 0, gross: 0, refunds: 0, net: 0 };
    if (type === 'credit') { group.charges++; group.gross += amount; }
    if (type === 'refund') group.refunds += amount;
    group.net += amount;
    return { line: i + 2, date, iso, description: transaction, amount, type, country };
  });
  const total = type => rows.filter(r => r.type === type).reduce((sum, r) => sum + r.amount, 0);
  const totals = Object.fromEntries(['credit','refund','debit','tax','other'].map(type => [type,total(type)]));
  totals.opening = 0; totals.payout = 0;
  totals.closing = rows.reduce((sum,r) => sum + r.amount,0);
  if (!Object.values(totals).every(Number.isSafeInteger)) throw new Error('Total fuera de rango.');
  return { kind: 'earnings', countries: Object.values(countries), name, period, text, rows, totals, difference: 0, importedAt: new Date().toISOString(), hasOperations: true };
}
export function payoutRows(reports, month) {
  return reports.flatMap(report => report.rows.filter(r => r.type === 'payout' && r.iso?.startsWith(month)).map(r => ({ ...r, id: `${report.period}:${r.line}`, report })));
}
function parseAppleReport(text, name) {
  const parsed = Papa.parse(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
  if (parsed.errors.length) throw new Error('El CSV de App Store no es válido.');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const date = parsed.data[0]?.[0]?.match(/\((\w+), (\d{4})\)/);
  const month = date ? months.indexOf(date[1]) + 1 : 0;
  if (!month) throw new Error('No se pudo identificar el periodo de App Store.');
  const period = `${date[2]}-${String(month).padStart(2,'0')}`;
  const headerIndex = parsed.data.findIndex(r => r[0] === 'Country or Region (Currency)');
  const headers = parsed.data[headerIndex] || [];
  const required = ['Country or Region (Currency)','Units Sold','Earned','Input Tax','Adjustments','Withholding Tax','Total Owed','Proceeds','Bank Account Currency'];
  if (required.some(h => !headers.includes(h))) throw new Error('Faltan columnas del resumen financiero de App Store.');
  const records = parsed.data.slice(headerIndex + 1).filter(r => r[0]?.trim());
  if (!records.length) throw new Error('El reporte de App Store no contiene movimientos.');
  const totals = { opening:0, closing:0, credit:0, debit:0, tax:0, payout:0, other:0, inputTax:0, withholding:0, owed:0 };
  const countries = records.map(r => {
    const field = h => String(r[headers.indexOf(h)] || '').trim();
    const region = field(required[0]).match(/^(.+) \(([A-Z]{3})\)$/);
    if (!region || region[2] !== 'MXN' || field('Bank Account Currency') !== 'MXN') throw new Error('App Store requiere por ahora importes y pago en MXN. No se suman monedas distintas.');
    const amount = h => { const v = field(h); return parseAmount(/^-?\d+$/.test(v) ? `${v}.00` : v); };
    const units = field('Units Sold');
    if (!/^-?\d+$/.test(units)) throw new Error('Unidades de App Store inválidas.');
    const carry = headers.includes('Balance') && field('Balance') ? amount('Balance') : 0;
    if (amount('Earned') + carry + amount('Input Tax') + amount('Adjustments') + amount('Withholding Tax') !== amount('Total Owed')) throw new Error('Los impuestos y ajustes de Apple no cuadran con Total Owed.');
    if (amount('Total Owed') !== amount('Proceeds')) throw new Error('El pago de Apple en MXN difiere de Total Owed. Revisa el ajuste o la conversión.');
    totals.opening += carry;
    totals.credit += amount('Earned'); totals.inputTax += amount('Input Tax');
    totals.other += amount('Adjustments'); totals.withholding += amount('Withholding Tax');
    totals.owed += amount('Total Owed'); totals.closing += amount('Proceeds');
    return { code:region[1], charges:Number(units), gross:amount('Earned'), refunds:0, net:amount('Proceeds') };
  });
  if (!Object.values(totals).every(Number.isSafeInteger)) throw new Error('Total fuera de rango.');
  return { kind:'apple', name, period, text, rows:[], countries, totals, difference:0, importedAt:new Date().toISOString(), hasOperations:true };
}
export function appleSales(text, name) {
  const periodMatch = name.match(/_(\d{2})(\d{2})(?:_|\.)/);
  const month = periodMatch ? Number(periodMatch[1]) : 0;
  const year = periodMatch ? 2000 + Number(periodMatch[2]) : 0;
  if (month < 1 || month > 12) throw new Error('No se pudo identificar el periodo del detalle de App Store.');
  const period = `${year}-${String(month).padStart(2, '0')}`;
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const headerAt = lines.findIndex(line => line.split('\t').includes('Customer Price') && line.split('\t').includes('Quantity'));
  if (headerAt < 0) throw new Error('El detalle de App Store no tiene el precio de las suscripciones.');
  const headers = lines[headerAt].split('\t').map(h => h.trim());
  const priceAt = headers.indexOf('Customer Price');
  const qtyAt = headers.indexOf('Quantity');
  const earnedAt = headers.indexOf('Extended Partner Share');
  let customer = 0, base = 0, fee = 0, earned = 0;
  for (const line of lines.slice(headerAt + 1)) {
    const cells = line.split('\t');
    const price = Number(String(cells[priceAt] ?? '').trim());
    const qty = Number(String(cells[qtyAt] ?? '').trim());
    if (cells.length < headers.length) continue;
    if (!cells[priceAt]?.trim() || !cells[qtyAt]?.trim() || !Number.isFinite(price) || !Number.isFinite(qty) || !Number.isInteger(qty)) throw new Error('Precio o cantidad inválidos en el detalle de Apple.');
    if (qty === 0) continue;
    for (const currency of ['Customer Currency', 'Partner Share Currency']) if (headers.includes(currency) && cells[headers.indexOf(currency)] !== 'MXN') throw new Error('El detalle de Apple mezcla monedas.');
    if (headers.includes('Country of Sale') && cells[headers.indexOf('Country of Sale')] !== 'MX') throw new Error('El desglose de IVA del detalle solo admite ventas de México.');
    const gross = roundSigned(Math.abs(price) * qty * 100);
    const net = roundSigned(gross / 1.16);
    customer += gross;
    base += net;
    if (earnedAt >= 0) { const share = Number(cells[earnedAt]); if (!Number.isFinite(share)) throw new Error('Importe inválido en el detalle de Apple.'); const cents = roundSigned(share * 100); earned += cents; fee += net - cents; }
  }
  if (!Number.isSafeInteger(customer) || customer < 0) throw new Error('El detalle de App Store no contiene suscripciones.');
  return { period, customer, base, fee: earnedAt >= 0 ? fee : undefined, earned: earnedAt >= 0 ? earned : undefined };
}
export function appleCommissionInvoice(text, name) {
  if (typeof text !== 'string' || !text.includes('Mexico Commission Invoice')) throw new Error('El PDF no es la factura de comisión de Apple para México.');
  const period = text.match(/Fiscal Month:\s*([A-Za-z]+),\s*(\d{4})/);
  const month = ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(period?.[1]) + 1;
  if (!month) throw new Error('La factura de Apple no indica su mes.');
  const amount = '(-?(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\\.[0-9]{2})';
  const pattern = new RegExp('Paid\\s*Apps(?:(?!Paid\\s*Apps)[\\s\\S])*?MXN\\s*' + [amount, amount, amount, '(16|0)', amount, amount].join('\\s*'), 'g');
  const rows = [...text.matchAll(pattern)];
  if (!rows.length || rows.length !== (text.match(/Paid\s*Apps/g) || []).length) throw new Error('La factura de Apple debe tener sus importes completos en MXN.');
  const totals = { earned: 0, fee: 0, feeVat: 0, invoiceTotal: 0 };
  for (const row of rows) {
    const [earned, fee, invoiceTotal, rate, vat, mxnVat] = row.slice(1).map((v, i) => i === 3 ? Number(v) : parseAmount(v));
    if (vat !== mxnVat) throw new Error('Los importes de IVA en pesos de Apple no coinciden.');
    if (Math.abs(roundSigned(fee * rate / 100) - vat) > 1) throw new Error('Revisa la tasa y el IVA de la comisión en la factura de Apple.');
    totals.earned += earned; totals.fee += fee; totals.feeVat += vat; totals.invoiceTotal += invoiceTotal;
  }
  if (!Object.values(totals).every(Number.isSafeInteger)) throw new Error('Importe de Apple fuera de rango.');
  return { period: `${period[2]}-${String(month).padStart(2, '0')}`, ...totals };
}
export function attachAppleCommission(report, source) {
  const invoice = appleCommissionInvoice(source.text, source.name);
  if (report.kind !== 'apple' || invoice.period !== report.period || invoice.earned !== report.totals.credit) throw new Error('La factura de comisión no corresponde al reporte de Apple cargado.');
  const saved = { name: source.name, text: source.text };
  if (typeof source.file === 'string' && source.file.length < 3000000 && /^[A-Za-z0-9+/=]+$/.test(source.file)) saved.file = source.file;
  return { ...report, commissionSource: saved };
}
export function mexicoVat(report) {
  const mexico = report.kind === 'earnings' ? report.countries?.find(c => c.code === 'MX') : null;
  const gross = mexico ? mexico.gross + mexico.refunds : !report.kind && report.totals?.credit > 0 ? report.totals.credit : 0;
  if (!gross) return null;
  const base = Math.round(gross / 1.16);
  return { gross, base, vat: gross - base };
}
export const roundSigned = value => Math.sign(value) * Math.round(Math.abs(value));
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function parseReport(text, name) {
  const report = parseSource(text, name);
  if (!Object.values(report.totals).every(Number.isSafeInteger)) throw new Error('Total fuera de rango.');
  const clean = text.replaceAll('\u0000', '').replace(/\r/g, '');
  report.currency = report.kind === 'cursor' || report.kind === 'supabase' ? 'USD' : 'MXN';
  let identity = report.period;
  if (report.kind === 'cursor' || report.kind === 'chatgpt' || report.kind === 'supabase') {
    const number = report.kind === 'supabase' ? clean.match(/Invoice number\s+([A-Z0-9]+(?:-[A-Z0-9]+)+)\b/i)?.[1] : clean.match(/Invoice number\s*\n\s*([^\n]+)/)?.[1]?.trim();
    if (!number) throw new Error('El documento no trae número de factura; no se puede evitar un duplicado.');
    identity = number;
    report.documentDate = report.period;
  } else if (report.kind === 'cloud') {
    identity = text.match(/<tfd:TimbreFiscalDigital\b[^>]*\bUUID="([^"]+)"/)?.[1]?.toUpperCase();
  } else if (report.kind === 'google') {
    identity = text.match(/UUID="([^"]+)"/i)?.[1] || report.period.slice(11);
    report.documentDate = report.period.slice(0, 10);
  } else if (report.kind === 'mercado') {
    identity = clean.match(/[A-Fa-f0-9]{8}-(?:[A-Fa-f0-9]{4}-){3}[A-Fa-f0-9]{12}/)?.[0];
    if (!identity) throw new Error('El CFDI de Mercado Libre no trae UUID.');
    report.documentDate = clean.match(/Fecha de Emisión\s*\n\s*(\d{4}-\d{2}-\d{2})/)?.[1];
  }
  report.id = `${!report.kind || report.kind === 'earnings' ? 'play' : report.kind}:${identity}`;
  report.cardLast4 = report.cardLast4 || clean.match(/Mastercard\s*(?:-|[·•\s])+\s*(\d{4})/i)?.[1];
  return report;
}
export const reportKey = report => report.kind === 'earnings' ? `play:${report.period}` : report.id || `${report.kind || 'play'}:${report.period}`;
export function suggestedAmount(report) {
  if (report.isAdjustment) return 0;
  // A previous period's ending balance can be assigned to a later payout month.
  // A payout-only statement already documents the payment, not its ending balance.
  return !report.kind && !report.hasOperations && report.totals.payout < 0 ? -report.totals.payout : report.totals.closing;
}
export function paymentAmount(report) {
  if (report.isAdjustment) return 0;
  if (report.currency === 'USD' || report.kind === 'cursor') return report.receipt?.mxnAmount ?? null;
  return report.receipt?.amount ?? suggestedAmount(report);
}
export function validateReceipt(receipt) {
  if (!receipt || typeof receipt.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(receipt.month) || !Number.isSafeInteger(receipt.amount)) throw new Error('Pago inválido.');
  const value = { month: receipt.month, amount: receipt.amount };
  if (receipt.date != null && receipt.date !== '') {
    if (!validDate(receipt.date) || receipt.date.slice(0, 7) !== receipt.month) throw new Error('La fecha de pago debe pertenecer al mes seleccionado.');
    value.date = receipt.date;
  }
  if (receipt.mxnAmount != null) {
    if (!Number.isSafeInteger(receipt.mxnAmount) || receipt.mxnAmount < 0) throw new Error('Importe en pesos inválido.');
    value.mxnAmount = receipt.mxnAmount;
  }
  if (receipt.cardLast4) {
    if (!/^\d{4}$/.test(receipt.cardLast4)) throw new Error('Usa solo los últimos cuatro dígitos de la tarjeta.');
    value.cardLast4 = receipt.cardLast4;
  }
  value.source = receipt.source === 'bank' || receipt.source === 'user' ? receipt.source : 'document';
  return value;
}
export function upsertReport(reports, uploaded, month) {
  const previous = reports.find(r => reportKey(r) === reportKey(uploaded));
  if (previous?.receipt && month && previous.receipt.month !== month) throw new Error(`Este documento ya está en ${previous.receipt.month}. Edita su pago para cambiarlo de mes; no se movió ni duplicó.`);
  if (uploaded.difference !== 0) throw new Error('El reporte tiene una diferencia aritmética. No se guardó.');
  const migration = previous && !previous.kind && uploaded.kind === 'earnings';
  if (migration) {
    attachPlayEarnings(previous, { name: uploaded.name, text: uploaded.text });
    uploaded.receipt = previous.receipt;
  }
  if (previous?.kind === 'earnings' && !uploaded.kind) throw new Error('Google Play usa PlayApps_AAAAMM.csv. Sube ese archivo para actualizar el periodo.');
  const same = previous?.text === uploaded.text;
  if (same) {
    for (const key of ['sales', 'salesBase', 'salesFee', 'salesSource', 'commissionSource', 'earningsSource', 'earnings']) if (previous[key] != null) uploaded[key] = previous[key];
    uploaded.receipt = previous.receipt;
  } else if (previous?.receipt?.source === 'bank' || previous?.receipt?.source === 'user') {
    uploaded.receipt = previous.receipt;
  }
  if (!uploaded.receipt && month) uploaded.receipt = validateReceipt({ month, amount: suggestedAmount(uploaded), source: 'document' });
  return [...reports.filter(r => reportKey(r) !== reportKey(uploaded)), uploaded].sort((a, b) => b.period.localeCompare(a.period));
}

// Fiscal amounts are a working breakdown, not a tax return. Unknown is null, never zero.
export function incomeFigures(report) {
  const t = report.totals;
  if (report.kind === 'mercado') return { sales: t.credit, base: t.credit, salesVat: t.tax, fee: null, feeVat: null, preliminaryVat: t.tax - t.other };
  if (report.kind === 'apple') {
    const invoice = report.commissionSource ? appleCommissionInvoice(report.commissionSource.text, report.commissionSource.name) : null;
    const sales = report.sales ?? null, fee = invoice?.fee ?? report.salesFee ?? null;
    // Apple defines Partner Share as customer price less taxes and commission.
    // A matching commission invoice therefore lets us reconstruct the Mexican
    // sales base without imposing a second, differently rounded VAT calculation.
    const base = invoice && sales != null ? invoice.earned + invoice.fee : report.salesBase ?? null;
    const salesVat = sales != null && base != null ? sales - base : null;
    // Adjustments remain a separate source field, never an input to this calculation.
    const feeVat = invoice?.feeVat ?? (fee != null ? roundSigned(fee * 0.16) : null);
    return { sales, base, salesVat, fee, feeVat, preliminaryVat: salesVat != null && feeVat != null ? salesVat - feeVat : null };
  }
  if (report.kind === 'stripe') {
    const sales = t.credit + (t.refund || 0), base = report.salesBase;
    return { sales, base, salesVat: sales - base, fee: -t.debit, feeVat: -t.tax, preliminaryVat: sales - base + t.tax };
  }
  // Activities reports aggregate negative sales and commissions: do not invent their split.
  const detail = report.earnings || (report.kind === 'earnings' ? report : null);
  const figures = detail?.totals || t;
  const gross = figures.credit + (figures.refund || 0);
  const vat = detail ? mexicoVat(detail) : null;
  return { sales: gross, base: vat?.base ?? null, salesVat: vat?.vat ?? null, fee: detail ? -figures.debit : null, feeVat: detail && detail.countries.every(c => c.code === 'MX') ? -figures.tax : null, preliminaryVat: vat && detail.countries.every(c => c.code === 'MX') ? vat.vat + figures.tax : null };
}
export function csv(rows) { return '\uFEFF' + Papa.unparse(rows, { escapeFormulae: true }); }

export function attachPlayEarnings(report, source) {
  const detail = parseReport(source.text, source.name);
  if (report.kind || detail.kind !== 'earnings' || detail.period !== report.period) throw new Error('El detalle debe corresponder al periodo del CSV de actividades de Play.');
  const t = report.totals;
  if (detail.totals.closing !== t.credit + t.debit + t.tax + t.other || detail.totals.credit + detail.totals.refund + detail.totals.debit !== t.credit + t.debit || detail.totals.tax !== t.tax) throw new Error('El detalle de Play no coincide con el reporte de actividades.');
  return { ...report, earningsSource: { name: source.name, text: source.text }, earnings: detail };
}
export function attachAppleSales(report, source) {
  const sales = appleSales(source.text, source.name);
  if (report.kind !== 'apple' || sales.period !== report.period || sales.earned !== report.totals.credit) throw new Error('El detalle de ventas no coincide con el importe Earned del reporte financiero de Apple.');
  return { ...report, sales: sales.customer, salesBase: sales.base, salesFee: sales.fee, salesSource: { name: source.name, text: source.text } };
}

export function missingAppleFiles(report) {
  const missing = [];
  if (!report || report.kind !== 'apple') missing.push('reporte financiero (financial_report.csv)');
  if (!report?.salesSource) missing.push('detalle de ventas (FD_….txt)');
  if (!report?.commissionSource) missing.push('factura de comisión (MexicoCommissionInvoice-….pdf)');
  return missing;
}
