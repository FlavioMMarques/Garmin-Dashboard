import { describe, expect, it } from "vitest";
import { garminStyleZip } from "./test/garminZip.js";
import { extractFile } from "./zip.js";

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
