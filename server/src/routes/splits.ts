import FitParser from "fit-file-parser";
import { Hono } from "hono";
import { GarminError, type GarminClient } from "../garminClient.js";
import { kmSplits, type KmSplit, type TrackPoint } from "../splits.js";
import { createTtlCache } from "../ttlCache.js";
import { extractFile } from "../zip.js";

const DOWNLOAD_PATH = "/download-service/files/activity";
// A recorded activity never changes; an hour keeps memory bounded.
const CACHE_TTL_MS = 60 * 60_000;

/** Only the record fields we read; GPS and everything else stay in this function. */
interface RawRecord {
  timestamp?: Date | string;
  distance?: number;
  heart_rate?: number;
  cadence?: number;
  fractional_cadence?: number;
  enhanced_altitude?: number;
  altitude?: number;
}

/** Decodes a .FIT file into plain track points (seconds, meters, bpm, steps per minute). */
async function fitTrack(fit: Buffer): Promise<TrackPoint[]> {
  const parser = new FitParser({ force: true, speedUnit: "m/s", lengthUnit: "m", mode: "list" });
  const bytes = fit.buffer.slice(fit.byteOffset, fit.byteOffset + fit.byteLength) as ArrayBuffer;
  const data = (await parser.parseAsync(bytes)) as { records?: RawRecord[] };
  const records = (data.records ?? []).filter((r) => r.timestamp != null);
  const t0 = records.length ? new Date(records[0]!.timestamp!).getTime() : 0;
  return records.map((r) => ({
    t: (new Date(r.timestamp!).getTime() - t0) / 1000,
    distanceM: r.distance ?? null,
    hr: r.heart_rate ?? null,
    // FIT stores running cadence per leg.
    cadenceSpm: r.cadence != null ? (r.cadence + (r.fractional_cadence ?? 0)) * 2 : null,
    altitudeM: r.enhanced_altitude ?? r.altitude ?? null,
  }));
}

export function splitsRoutes(
  garmin: GarminClient,
  { now = Date.now, onReset }: { now?: () => number; onReset?: (reset: () => void) => void } = {},
) {
  const cache = createTtlCache(CACHE_TTL_MS, now);
  onReset?.(cache.clear);

  async function load(id: string): Promise<KmSplit[]> {
    const zip = await garmin.getBinary(`${DOWNLOAD_PATH}/${id}`);
    const fit = extractFile(zip, ".fit");
    if (!fit) throw new GarminError("upstream", "O arquivo da atividade veio sem dados .FIT");
    return kmSplits(await fitTrack(fit));
  }

  return new Hono().get("/runs/:id/splits", async (c) => {
    const id = c.req.param("id");
    if (!/^\d{1,20}$/.test(id)) {
      return c.json({ error: "bad_request", message: "id da atividade inválido" }, 400);
    }
    return c.json({ splits: await cache.get(id, () => load(id)) });
  });
}
