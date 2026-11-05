export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** GET a JSON endpoint of the local server; non-2xx becomes an ApiError with the server's code. */
export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { headers: { Accept: "application/json" }, signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError("offline", "Servidor local não está respondendo (npm run dev?)", 0);
  }
  if (res.ok) return (await res.json()) as T;
  const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  throw new ApiError(body.error ?? "http_error", body.message ?? `Erro ${res.status}`, res.status);
}
