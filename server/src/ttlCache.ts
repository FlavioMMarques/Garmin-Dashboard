/**
 * Memoizes async loads by key for `ttlMs`. Failures are not cached, and concurrent
 * requests for the same key share one load.
 */
export function createTtlCache(ttlMs: number, now: () => number = Date.now) {
  const entries = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

  function get<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = entries.get(key);
    if (hit && now() < hit.expiresAt) return hit.value as Promise<T>;
    for (const [k, entry] of entries) if (now() >= entry.expiresAt) entries.delete(k);
    const value = load();
    entries.set(key, { expiresAt: now() + ttlMs, value });
    // Only drop the entry if it is still this request's.
    value.catch(() => {
      if (entries.get(key)?.value === value) entries.delete(key);
    });
    return value;
  }

  return { get, clear: () => entries.clear() };
}
