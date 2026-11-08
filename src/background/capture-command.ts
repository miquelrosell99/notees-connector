import type { Tabs } from "webextension-polyfill";
import { CaptureMode, CapturePayload, CaptureOutcome } from "../shared/capture-types";
import { ConnectorSettings } from "../shared/settings";
import { extractIdentifiers } from "../capture/extract-in-page";
import { notify, notifyFailure } from "./notify";

/**
 * The one seam injected by the background entrypoint: Task 10's
 * createTransport(deps).captureWithTransport (tab relay preferred, REST
 * fallback). Declared structurally so this module stays pure orchestration.
 */
export interface CaptureTransport {
  captureWithTransport(settings: ConnectorSettings, payload: CapturePayload): Promise<CaptureOutcome>;
}

function titleOf(tab: Tabs.Tab): string {
  return tab.title?.trim() || tab.url || "Untitled page";
}

/**
 * One capture request end to end: DOI/ISBN enrichment (REST path only),
 * transport selection, success/failure notification.
 */
export async function performCapture(
  mode: CaptureMode,
  tab: Tabs.Tab,
  settings: ConnectorSettings,
  transport: CaptureTransport,
): Promise<void> {
  if (!tab.id || !tab.url) return;
  const enabled = mode === "source" ? settings.features.bibliography : settings.features.readLater;
  if (!enabled) {
    await notify("Feature not enabled", "Turn this feature on in the connector settings.");
    return;
  }
  const identifiers = mode === "source" ? await extractIdentifiers(tab.id) : {};
  const payload: CapturePayload = {
    url: tab.url,
    title: titleOf(tab),
    mode,
    // REST-only enrichment; key omitted entirely when nothing was found
    ...(Object.keys(identifiers).length ? { identifiers } : {}),
  };
  const outcome = await transport.captureWithTransport(settings, payload);
  if (outcome.ok) {
    await notify(
      mode === "source" ? "Saved to bibliography" : "Saved to Read later",
      `${payload.title} — ${payload.url}`,
    );
  } else {
    await notifyFailure(outcome.error);
  }
}
