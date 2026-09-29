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
  const fatal = parsed.errors.filter(error => error.type !== 'FieldMismatch');
  if (fatal.length || expected.some(field => !parsed.meta.fields?.includes(field)) || !parsed.data.length) throw new Error('El CSV de Stripe no tiene el formato del pago.');
  let credit = 0, debit = 0, tax = 0, closing = 0, salesBase = 0, latest = '';
  parsed.data.forEach((row, index) => {
    if (String(row.Currency || '').trim().toLowerCase() !== 'mxn') throw new Error('Stripe requiere importes en MXN.');
    const created = String(row.Created || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}/.test(created)) throw new Error(`Fecha inválida en la fila ${index + 2}.`);
    if (created > latest) latest = created;
    const amount = parseAmount(row.Amount), fees = parseAmount(row.Fees), net = parseAmount(row.Net);
    const type = String(row.Type || '').trim();
    if (type === 'Charge') {
      const feeBase = Math.round(fees / 1.16);
      credit += amount; salesBase += Math.round(amount / 1.16); debit -= feeBase; tax -= fees - feeBase;
    } else if (type === 'Stripe Fee') {
      debit -= Math.abs(amount); tax -= fees;
    } else throw new Error(`Movimiento de Stripe no reconocido: ${type}.`);
    closing += net;
  });
  return { kind: 'stripe', name, period: latest.slice(0, 7), text, rows: [], salesBase, totals: { opening: 0, closing, credit, debit, tax, payout: 0, other: 0 }, difference: credit + debit + tax - closing, importedAt: new Date().toISOString(), hasOperations: true };
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
export function parseReport(text, name) {
  if (text.replace(/^\uFEFF/, '').startsWith('"iTunes Connect - Payments and Financial Reports')) return parseAppleReport(text, name);
  const header = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || '';
  if (header.split(',').map(field => field.trim()).includes('Type') && header.includes('Fees') && header.includes('Net')) return parseStripeReport(text, name);
  if (text.includes('Programas de Marketing de Afiliado') && text.includes('IMPORTES TOTALES')) return parseMercadoReport(text, name);
  if (text.includes('Amount due') && text.includes('Date of issue') && /\$[\d,]+\.\d{2}\s*USD/.test(text)) return parseCursorReport(text, name);
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
  let customer = 0, base = 0, fee = 0;
  for (const line of lines.slice(headerAt + 1)) {
    const cells = line.split('\t');
    const price = Number(String(cells[priceAt] ?? '').trim());
    const qty = Number(String(cells[qtyAt] ?? '').trim());
    if (!Number.isFinite(price) || !Number.isFinite(qty) || qty === 0) continue;
    const gross = Math.round(price * Math.abs(qty) * 100);
    const net = Math.round(gross / 1.16);
    customer += gross;
    base += net;
    if (earnedAt >= 0) fee += net - Math.round(Number(cells[earnedAt]) * 100);
  }
  if (!Number.isSafeInteger(customer) || customer <= 0) throw new Error('El detalle de App Store no contiene suscripciones.');
  return { period, customer, base, fee: earnedAt >= 0 ? fee : undefined };
}
export function mexicoVat(report) {
  const mexico = report.kind === 'earnings' ? report.countries?.find(c => c.code === 'MX') : null;
  const gross = mexico ? mexico.gross + mexico.refunds : !report.kind && report.totals?.credit > 0 ? report.totals.credit : 0;
  if (!gross) return null;
  const base = Math.round(gross / 1.16);
  return { gross, base, vat: gross - base };
}
export function validateReceipt(receipt) {
  if (!receipt || typeof receipt.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(receipt.month) || !Number.isSafeInteger(receipt.amount) || receipt.amount < 0) throw new Error('Depósito inválido.');
  const value = { month: receipt.month, amount: receipt.amount };
  if (receipt.date != null) {
    const date = typeof receipt.date === 'string' ? receipt.date : '';
    const parsed = new Date(`${date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || parsed.toISOString().slice(0, 10) !== date || date.slice(0, 7) !== receipt.month) throw new Error('Depósito inválido.');
    value.date = date;
  }
  return value;
}
export function csv(rows) { return '\uFEFF' + Papa.unparse(rows, { escapeFormulae: true }); }
