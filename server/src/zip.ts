import { inflateRawSync } from "node:zlib";

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;

/**
 * Extracts the first entry whose name ends with `extension` (case-insensitive).
 * Sizes and offsets come from the central directory: Garmin's downloads set the
 * data-descriptor flag and leave them zero in the local headers.
 * Returns null when the buffer is not a zip or has no such entry.
 */
export function extractFile(zip: Buffer, extension: string): Buffer | null {
  const eocd = findEocd(zip);
  if (eocd < 0) return null;
  const entries = zip.readUInt16LE(eocd + 10);
  let pos = zip.readUInt32LE(eocd + 16);
  const wanted = extension.toLowerCase();

  for (let i = 0; i < entries; i++) {
    if (pos + 46 > zip.length || zip.readUInt32LE(pos) !== CENTRAL_SIG) return null;
    const method = zip.readUInt16LE(pos + 10);
    const compressedSize = zip.readUInt32LE(pos + 20);
    const nameLength = zip.readUInt16LE(pos + 28);
    const extraLength = zip.readUInt16LE(pos + 30);
    const commentLength = zip.readUInt16LE(pos + 32);
    const localOffset = zip.readUInt32LE(pos + 42);
    const name = zip.toString("utf8", pos + 46, pos + 46 + nameLength);

    if (name.toLowerCase().endsWith(wanted)) {
      if (zip.readUInt32LE(localOffset) !== LOCAL_SIG) return null;
      const start =
        localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
      const data = zip.subarray(start, start + compressedSize);
      if (method === STORED) return Buffer.from(data);
      if (method === DEFLATED) return inflateRawSync(data);
      return null;
    }
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

/** The end-of-central-directory record sits in the last 22 + 65535 (comment) bytes. */
function findEocd(zip: Buffer): number {
  const stop = Math.max(0, zip.length - 22 - 0xffff);
  for (let i = zip.length - 22; i >= stop; i--) {
    if (zip.readUInt32LE(i) === EOCD_SIG) return i;
  }
  return -1;
}
