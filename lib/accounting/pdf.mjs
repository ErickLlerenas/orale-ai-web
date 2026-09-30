import { inflateSync } from 'node:zlib';

function streamsOf(source) {
  const streams = [];
  for (const match of source.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    try { streams.push({ index: match.index, text: inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1') }); }
    catch { /* Images and other streams are not text. */ }
  }
  return streams;
}
function cmapOf(text) {
  const map = new Map();
  const put = (code, unicode) => map.set(code.toString(16).toUpperCase().padStart(4, '0'), String.fromCharCode(unicode));
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]{4})>/g)) put(parseInt(pair[1], 16), parseInt(pair[2], 16));
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const range of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]{4})>/g)) {
      const start = parseInt(range[1], 16), end = parseInt(range[2], 16), dest = parseInt(range[3], 16);
      for (let code = start; code <= end; code++) put(code, dest + code - start);
    }
  }
  return map;
}
function hexText(source) {
  const objects = [...source.matchAll(/(\d+) 0 obj/g)].map(match => ({ n: +match[1], index: match.index }));
  const objectAt = index => objects.reduce((found, object) => object.index <= index ? object : found, objects[0])?.n;
  const streams = streamsOf(source);
  const maps = new Map(streams.filter(stream => stream.text.includes('beginbfchar') || stream.text.includes('beginbfrange')).map(stream => [objectAt(stream.index), cmapOf(stream.text)]));
  // Supabase PDFs store font dictionaries inside compressed object streams.
  const definitions = new Map(objects.map((object, i) => [object.n, source.slice(object.index, objects[i + 1]?.index ?? source.length)]));
  for (const stream of streams) {
    const definition = definitions.get(objectAt(stream.index)) || '';
    if (!/\/Type\s*\/ObjStm\b/.test(definition)) continue;
    const first = Number(definition.match(/\/First\s+(\d+)/)?.[1]);
    const count = Number(definition.match(/\/N\s+(\d+)/)?.[1]);
    if (!Number.isInteger(first) || !Number.isInteger(count) || first < 0 || first > stream.text.length) continue;
    const entries = stream.text.slice(0, first).trim().split(/\s+/).map(Number);
    if (entries.length !== count * 2 || entries.some(n => !Number.isSafeInteger(n) || n < 0)) continue;
    for (let i = 0; i < entries.length; i += 2) definitions.set(entries[i], stream.text.slice(first + entries[i + 1], i + 3 < entries.length ? first + entries[i + 3] : undefined));
  }
  const fonts = {};
  for (const definition of definitions.values()) for (const ref of definition.matchAll(/\/([A-Za-z][\w]*)\s+(\d+)\s+0\s+R/g)) {
    const unicode = definitions.get(+ref[2])?.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
    if (unicode && maps.has(+unicode[1])) fonts[ref[1]] = maps.get(+unicode[1]);
  }
  if (!Object.keys(fonts).length) return '';
  let font = fonts.F4 || Object.values(fonts)[0], text = '';
  for (const stream of streams) {
    if (!/T[jJ]/.test(stream.text)) continue;
    for (const part of stream.text.matchAll(/\/([A-Za-z][\w]*)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]+)>\s*Tj|\[([^\]]*)\]\s*TJ|\bTm\b/g)) {
      if (part[1]) { font = fonts[part[1]] || font; continue; }
      if (!part[2] && !part[3]) { text += '\n'; continue; }
      const hex = (part[2] || [...part[3].matchAll(/<([0-9A-Fa-f]+)>/g)].map(m => m[1]).join('')).toUpperCase();
      for (let i = 0; i < hex.length; i += 4) text += font?.get(hex.slice(i, i + 4).padStart(4, '0')) || '';
    }
  }
  return text;
}
export function extractPdfText(bytes) {
  const source = Buffer.from(bytes).toString('latin1');
  const tokens = [];
  for (const stream of streamsOf(source)) {
    for (const piece of stream.text.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)) {
      tokens.push(piece[0].slice(1).replace(/\)\s*Tj$/, '').replace(/\\([()\\])/g, '$1'));
    }
  }
  const text = tokens.length ? tokens.join('\n') : hexText(source);
  if (!text.trim()) throw new Error('No se pudo leer el PDF.');
  return text;
}
