import { inflateSync } from 'node:zlib';

export function extractPdfText(bytes) {
  const source = Buffer.from(bytes).toString('latin1');
  const tokens = [];
  for (const match of source.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let inflated;
    try { inflated = inflateSync(Buffer.from(match[1], 'latin1')); } catch { continue; }
    const text = inflated.toString('latin1');
    for (const piece of text.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)) {
      tokens.push(piece[0].slice(1).replace(/\)\s*Tj$/, '').replace(/\\([()\\])/g, '$1'));
    }
  }
  if (!tokens.length) throw new Error('No se pudo leer el PDF de Mercado Libre.');
  return tokens.join('\n');
}
