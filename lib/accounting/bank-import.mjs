import { createHash } from 'node:crypto';
import readXlsx from 'read-excel-file/node';
import { parseBanamexMonthRows, parseBanamexPdf } from './bank-ledger.mjs';
import { zipSources } from './zip.mjs';
export async function bankPdfText(bytes) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,disableFontFace:true,useSystemFonts:false,verbosity:0});
  try {
    const pdf=await task.promise;if(pdf.numPages>40)throw new Error('El estado de cuenta supera 40 páginas.');
    const pages=[];
    for(let i=1;i<=pdf.numPages;i++) {
      const page=await pdf.getPage(i), content=await page.getTextContent();const lines=[];let line='',lastY=null;
      for(const item of content.items){if(!('str' in item))continue;const y=item.transform[5];if(lastY!==null&&Math.abs(y-lastY)>2){lines.push(line);line='';}line+=(line?' ':'')+item.str;lastY=y;if(item.hasEOL){lines.push(line);line='';lastY=null;}}
      if(line)lines.push(line);pages.push(lines.join('\n'));
    }
    return pages.join('\n\f\n');
  } finally { await task.destroy(); }
}
export async function importBankDocument(file,month) {
  if(typeof file?.name!=='string'||typeof file?.data!=='string'||!/^[\d]{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Archivo o mes inválido.');
  const bytes=Buffer.from(file.data,'base64');if(!bytes.length||bytes.length>2_000_000)throw new Error('Cada archivo debe pesar menos de 2 MB.');
  const type=file.name.toLowerCase().endsWith('.xlsx')?'xlsx':file.name.toLowerCase().endsWith('.pdf')?'pdf':null;
  let parsed;
  if(type==='xlsx') {
    zipSources(bytes); // Bound decompressed XML sizes before handing off the workbook.
    const sheets=await readXlsx(bytes);
    if(sheets.length!==1||sheets[0].sheet!=='Movimientos')throw new Error('Usa el Excel original de movimientos de Banamex.');
    parsed=parseBanamexMonthRows(sheets[0].data,month);
  } else if(type==='pdf')parsed=parseBanamexPdf(await bankPdfText(bytes));
  else throw new Error('Para Banamex sube el PDF del corte y los dos Excel (.xlsx).');
  if(!parsed.rows.some(r=>r.date.startsWith(month)))throw new Error('El archivo no contiene movimientos del mes seleccionado.');
  return {...parsed,id:createHash('sha256').update(bytes).digest('hex'),name:file.name.slice(0,180),type,month,bank:'banamex',file:file.data,importedAt:new Date().toISOString()};
}
