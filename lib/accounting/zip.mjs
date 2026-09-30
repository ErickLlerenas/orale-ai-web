import { inflateRawSync } from 'node:zlib';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Read bounded text entries in memory. Never extract paths or inflate PDFs.
export function zipSources(bytes) {
  const fail = () => { throw new Error('El ZIP está dañado o usa un formato no compatible. Descárgalo de nuevo.'); };
  if (!Buffer.isBuffer(bytes) || bytes.length < 22 || bytes.length > 2_000_000) fail();
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && bytes.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < Math.max(0, bytes.length - 65557)) fail();
  const count = bytes.readUInt16LE(end + 10), size = bytes.readUInt32LE(end + 12), start = bytes.readUInt32LE(end + 16);
  if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || bytes.readUInt16LE(end + 8) !== count || count > 200 || start + size !== end || end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length) fail();
  let cursor = start, total = 0;
  const sources = [];
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50) fail();
    const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10), crc = bytes.readUInt32LE(cursor + 16);
    const packed = bytes.readUInt32LE(cursor + 20), unpacked = bytes.readUInt32LE(cursor + 24), offset = bytes.readUInt32LE(cursor + 42);
    const nameLength = bytes.readUInt16LE(cursor + 28), extra = bytes.readUInt16LE(cursor + 30), comment = bytes.readUInt16LE(cursor + 32);
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const path = nameBytes.toString('utf8');
    cursor += 46 + nameLength + extra + comment;
    if (cursor > end || bytes.readUInt16LE(cursor - (46 + nameLength + extra + comment) + 34)) fail();
    if (!/\.(xml|txt|csv)$/i.test(path) || path.startsWith('__MACOSX/')) continue;
    if ((flags & 1) || ![0, 8].includes(method) || !unpacked || unpacked > 2_000_000 || (total += unpacked) > 8_000_000 || offset + 30 > start) fail();
    if (bytes.readUInt32LE(offset) !== 0x04034b50 || bytes.readUInt16LE(offset + 6) !== flags || bytes.readUInt16LE(offset + 8) !== method) fail();
    const localName = bytes.readUInt16LE(offset + 26), localExtra = bytes.readUInt16LE(offset + 28);
    const dataAt = offset + 30 + localName + localExtra;
    if (dataAt + packed > start || !bytes.subarray(offset + 30, offset + 30 + localName).equals(nameBytes)) fail();
    const data = bytes.subarray(dataAt, dataAt + packed);
    const content = method === 8 ? inflateRawSync(data, { maxOutputLength: 2_000_000 }) : data;
    if (content.length !== unpacked || crc32(content) !== crc) fail();
    const text = new TextDecoder('utf-8', { fatal: true }).decode(content);
    sources.push({ name: path.split('/').at(-1), text });
  }
  if (cursor !== end || !sources.length) throw new Error('El ZIP no contiene los archivos necesarios. Incluye los documentos relacionados al descargar.');
  return sources;
}
