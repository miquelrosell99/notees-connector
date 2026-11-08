import { afterEach, describe, expect, it, vi } from "vitest";
import { probeServer } from "../../src/background/probe";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => fetchMock.mockReset());

describe("probeServer", () => {
  it("succeeds on 200", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ features: [] }), { status: 200 }));
    expect(await probeServer("https://host.example", "nk_ok")).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("https://host.example/api/features", {
      headers: { "X-API-Key": "nk_ok" },
      signal: expect.any(AbortSignal),
    });
  });
  it("treats 401 and 403 as a bad key", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    expect(await probeServer("https://host.example", "nk_bad")).toEqual({ ok: false, error: "unauthorized" });
    fetchMock.mockResolvedValue(new Response("{}", { status: 403 }));
    expect(await probeServer("https://host.example", "nk_bad")).toEqual({ ok: false, error: "unauthorized" });
  });
  it("server unreachable → unreachable (offline, DNS, timeout)", async () => {
    fetchMock.mockRejectedValue(new TypeError("NetworkError"));
    expect(await probeServer("https://host.example", "nk_ok")).toEqual({ ok: false, error: "unreachable" });
    fetchMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));
    expect(await probeServer("https://host.example", "nk_ok")).toEqual({ ok: false, error: "unreachable" });
  });
  it("never sends the key anywhere but the configured origin", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    await probeServer("https://host.example", "nk_secret");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://host.example/api/features");
    expect(url).not.toContain("nk_secret");
    expect((init.headers as Record<string, string>)["X-API-Key"]).toBe("nk_secret");
  });
});
