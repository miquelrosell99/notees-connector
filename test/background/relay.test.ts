import { afterEach, describe, expect, it, vi } from "vitest";
import browser from "webextension-polyfill";
import { fakeBrowser } from "@webext-core/fake-browser";
import { RELAY_TIMEOUT_MS, captureViaRelay } from "../../src/background/relay";

const payload = { url: "https://example.com/a", title: "A", mode: "source" as const };

function captureListener() {
  let listener: ((msg: unknown) => void) | undefined;
  vi.spyOn(fakeBrowser.runtime.onMessage, "addListener").mockImplementation((fn) => {
    listener = fn as (msg: unknown) => void;
  });
  return (msg: unknown) => {
    if (!listener) throw new Error("no listener registered");
    listener(msg);
  };
}

afterEach(() => vi.restoreAllMocks());

describe("captureViaRelay", () => {
  it("resolves ok on relay-from-page ok", async () => {
    const emit = captureListener();
    vi.spyOn(browser.tabs, "sendMessage").mockResolvedValue(undefined as never);
    const promise = captureViaRelay(3, payload);
    emit({ source: "notees-connector", type: "relay-from-page", requestId: expect.any(String), ok: true, objectId: "obj-7" });
    const sent = vi.mocked(browser.tabs.sendMessage).mock.calls[0][1] as { requestId: string };
    emit({ source: "notees-connector", type: "relay-from-page", requestId: sent.requestId, ok: true, objectId: "obj-7" });
    expect(await promise).toEqual({ ok: true, transport: "tab-relay", objectId: "obj-7" });
  });

  it("resolves failure on relay-from-page error (e.g. logged-out tab)", async () => {
    const emit = captureListener();
    vi.spyOn(browser.tabs, "sendMessage").mockResolvedValue(undefined as never);
    const promise = captureViaRelay(3, payload);
    const sent = vi.mocked(browser.tabs.sendMessage).mock.calls[0][1] as { requestId: string };
    emit({ source: "notees-connector", type: "relay-from-page", requestId: sent.requestId, ok: false, error: { code: "not_authenticated", message: "no session" } });
    expect(await promise).toEqual({ ok: false, error: { code: "not_authenticated", message: "no session" } });
  });

  it("times out when the page never answers", async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(browser.tabs, "sendMessage").mockResolvedValue(undefined as never);
      const promise = captureViaRelay(3, payload);
      vi.advanceTimersByTime(RELAY_TIMEOUT_MS + 1);
      expect(await promise).toEqual({ ok: false, error: { code: "failed", message: "The Notees tab did not answer" } });
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails cleanly when sendMessage rejects (tab navigated away)", async () => {
    vi.spyOn(browser.tabs, "sendMessage").mockRejectedValue(new Error("no receiver") as never);
    expect(await captureViaRelay(3, payload)).toEqual({ ok: false, error: { code: "failed", message: "Could not reach the Notees tab" } });
  });
});
