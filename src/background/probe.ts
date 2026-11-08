const PROBE_TIMEOUT_MS = 10000;

export type ProbeResult = { ok: true } | { ok: false; error: "unauthorized" | "unreachable" };

/** Validates settings: GET {serverUrl}/api/features with X-API-Key. 401/403 → bad key. */
export async function probeServer(serverUrl: string, apiKey: string): Promise<ProbeResult> {
  if (!serverUrl || !apiKey) return { ok: false, error: "unreachable" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${serverUrl}/api/features`, {
      headers: { "X-API-Key": apiKey },
      signal: controller.signal,
    });
    if (res.status === 200) return { ok: true };
    if (res.status === 401 || res.status === 403) return { ok: false, error: "unauthorized" };
    return { ok: false, error: "unreachable" };
  } catch {
    return { ok: false, error: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
