import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { extractFile } from "./zip.js";

/**
 * A zip shaped like Garmin's download: sizes are zero in the local header (data
 * descriptor flag) and only the central directory carries them.
 */
function garminStyleZip(files: { name: string; content: Buffer; store?: boolean }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const data = f.store ? f.content : deflateRawSync(f.content);
    const name = Buffer.from(f.name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0808, 6); // data descriptor + UTF-8
    local.writeUInt16LE(f.store ? 0 : 8, 8);
    // CRC and sizes left at zero, as Garmin does.
    local.writeUInt16LE(name.length, 26);
    const descriptor = Buffer.alloc(16);
    descriptor.writeUInt32LE(0x08074b50, 0);
    descriptor.writeUInt32LE(data.length, 8);
    descriptor.writeUInt32LE(f.content.length, 12);
    locals.push(local, name, data, descriptor);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0808, 8);
    central.writeUInt16LE(f.store ? 0 : 8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(f.content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + data.length + 16;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

describe("extractFile", () => {
  it("reads a deflated file whose sizes are only in the central directory", () => {
    const content = Buffer.from("FIT".repeat(1000));
    const zip = garminStyleZip([{ name: "123_ACTIVITY.fit", content }]);
    expect(extractFile(zip, ".fit")).toEqual(content);
  });

  it("picks the entry with the wanted extension", () => {
    const fit = Buffer.from("the activity");
    const zip = garminStyleZip([
      { name: "readme.txt", content: Buffer.from("other") },
      { name: "a.FIT", content: fit, store: true },
    ]);
    expect(extractFile(zip, ".fit")).toEqual(fit);
  });

  it("returns null when no entry matches or the data is not a zip", () => {
    expect(
      extractFile(garminStyleZip([{ name: "a.txt", content: Buffer.from("x") }]), ".fit"),
    ).toBeNull();
    expect(extractFile(Buffer.from("not a zip at all"), ".fit")).toBeNull();
  });
});
