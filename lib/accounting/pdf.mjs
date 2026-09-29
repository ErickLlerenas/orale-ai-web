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
  const fonts = {};
  for (const ref of source.match(/\/Font\s*<<([^>]*)>>/)?.[1].matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/g) || []) {
    const unicode = source.slice(source.indexOf(`\n${ref[2]} 0 obj`), source.indexOf(`\n${ref[2]} 0 obj`) + 400).match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
    if (unicode) fonts[ref[1]] = maps.get(+unicode[1]);
  }
  if (!Object.keys(fonts).length) return '';
  let font = fonts.F4 || Object.values(fonts)[0], text = '';
  for (const stream of streams) {
    if (!stream.text.includes('Tj')) continue;
    for (const part of stream.text.matchAll(/\/(F\d+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]+)>\s*Tj|\bTm\b/g)) {
      if (part[1]) { font = fonts[part[1]] || font; continue; }
      if (!part[2]) { text += '\n'; continue; }
      const hex = part[2].toUpperCase();
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
