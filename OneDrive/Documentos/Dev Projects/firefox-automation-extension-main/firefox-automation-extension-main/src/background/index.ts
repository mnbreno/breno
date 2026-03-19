import {
  errorResult,
  isExtensionRequest,
  successResult,
  type AutomationResult,
  type CreateTwentyLeadBatchRequest,
  type CreateTwentyLeadRequest,
  type ExtensionRequest,
} from "@shared/messages";
import { mergeImportedLeads, parseAdfLead } from "@shared/adf";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  sanitizeSettings,
  type ExtensionSettings,
} from "@shared/settings";
import type {
  MatterActivityEntry,
  MatterCustomerSnapshot,
  MatterHistoryImportItem,
  ParsedAdfLead,
  TwentyLeadImportResult,
} from "@shared/lead";
import {
  DEFAULT_ALERT_STATE,
  buildAdfAlertSignature,
  buildLeadAlertSignature,
  shouldDispatchAlert,
  type AlertState,
} from "./alerts";
import { getRequiredFieldError, isAutomatableUrl } from "./helpers";
import { createTwentyLead, testTwentyConnection } from "./twenty";

const ALERT_STATE_KEY = "leadAlertState";
const IMPORTED_LEADS_KEY = "twentyImportedLeads";
const WARNING_SOUND_PATH = "assets/warning-tone.wav";

interface ImportedLeadState {
  importedAt: string;
  message: string;
  recordId?: string;
  sourceUrl: string;
}

async function getStoredSettings(): Promise<ExtensionSettings> {
  const stored = await browser.storage.local.get(DEFAULT_SETTINGS);
  return mergeSettings(stored as Partial<ExtensionSettings>);
}

async function initializeSettings(): Promise<void> {
  const settings = await getStoredSettings();
  await browser.storage.local.set(settings);
}

async function getAlertState(): Promise<AlertState> {
  const stored = await browser.storage.local.get(ALERT_STATE_KEY);
  return {
    ...DEFAULT_ALERT_STATE,
    ...(stored[ALERT_STATE_KEY] as Partial<AlertState> | undefined),
  };
}

async function setAlertState(nextState: AlertState): Promise<void> {
  await browser.storage.local.set({
    [ALERT_STATE_KEY]: nextState,
  });
}

async function getImportedLeads(): Promise<Record<string, ImportedLeadState>> {
  const stored = await browser.storage.local.get(IMPORTED_LEADS_KEY);
  return (stored[IMPORTED_LEADS_KEY] as Record<string, ImportedLeadState> | undefined) ?? {};
}

async function setImportedLead(
  fingerprint: string,
  value: ImportedLeadState,
): Promise<void> {
  const importedLeads = await getImportedLeads();
  importedLeads[fingerprint] = value;
  await browser.storage.local.set({
    [IMPORTED_LEADS_KEY]: importedLeads,
  });
}

async function getActiveTab(): Promise<browser.tabs.Tab> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No active tab is available.");
  }

  if (!isAutomatableUrl(tab.url)) {
    throw new Error("Automation is blocked on Firefox internal pages.");
  }

  return tab;
}

async function executeAutomation(
  request: Extract<ExtensionRequest, { type: "runAutomation" }>,
): Promise<AutomationResult> {
  const { action, selector, value } = request.command;
  const validationError = getRequiredFieldError(action, selector, value);

  if (validationError) {
    return errorResult(action, validationError);
  }

  const settings = await getStoredSettings();
  const tab = await getActiveTab();

  try {
    return await browser.tabs.sendMessage(tab.id!, {
      ...request.command,
      selector: selector?.trim() || settings.defaultSelector,
      value: value?.trim(),
      settings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown content script error.";
    return errorResult(action, `Unable to reach the content script: ${message}`);
  }
}

async function updateSettings(
  request: Extract<ExtensionRequest, { type: "updateSettings" }>,
): Promise<ExtensionSettings> {
  const sanitized = sanitizeSettings(request.settings);

  if (!sanitized) {
    throw new Error("Invalid settings payload.");
  }

  const nextSettings = mergeSettings({
    ...(await getStoredSettings()),
    ...sanitized,
  });

  await browser.storage.local.set(nextSettings);
  return nextSettings;
}

async function playLeadSound(settings: ExtensionSettings): Promise<void> {
  if (!settings.enableLeadSound) {
    return;
  }

  const audio = new Audio(browser.runtime.getURL(WARNING_SOUND_PATH));
  audio.volume = 1;

  try {
    await audio.play();
  } catch {
    // Firefox may block playback in some contexts; notifications still provide a visible alert.
  }
}

async function createLeadNotification(message: string, settings: ExtensionSettings): Promise<void> {
  if (!settings.enableLeadNotifications) {
    return;
  }

  await browser.notifications.create({
    type: "basic",
    title: "Firefox Automation",
    message,
    iconUrl: browser.runtime.getURL("assets/icons/icon-96.svg"),
  });
}

async function handleLeadIndicatorDetected(
  request: Extract<ExtensionRequest, { type: "leadIndicatorDetected" }>,
): Promise<{ ok: boolean; deduped: boolean }> {
  const settings = await getStoredSettings();
  const alertState = await getAlertState();
  const signature = buildLeadAlertSignature(request.detection);

  if (!shouldDispatchAlert(alertState.lastLeadAlertSignature, signature)) {
    return { ok: true, deduped: true };
  }

  await setAlertState({
    ...alertState,
    lastLeadAlertSignature: signature,
  });

  await Promise.all([
    playLeadSound(settings),
    createLeadNotification("New Lead has arrived", settings),
  ]);

  return { ok: true, deduped: false };
}

async function handleAdfDetected(
  request: Extract<ExtensionRequest, { type: "adfDetected" }>,
): Promise<{ ok: boolean; deduped: boolean }> {
  const settings = await getStoredSettings();
  const alertState = await getAlertState();
  const signature = buildAdfAlertSignature(request.sourceUrl, request.fingerprint);

  if (!shouldDispatchAlert(alertState.lastAdfAlertSignature, signature)) {
    return { ok: true, deduped: true };
  }

  await setAlertState({
    ...alertState,
    lastAdfAlertSignature: signature,
  });

  await createLeadNotification("New Lead has arrived", settings);
  return { ok: true, deduped: false };
}

async function importLeadIntoTwenty(
  request: CreateTwentyLeadRequest,
): Promise<TwentyLeadImportResult> {
  const settings = await getStoredSettings();
  const parsedLead: ParsedAdfLead = parseAdfLead(
    request.rawAdfs.join("\n\n"),
    request.sourceUrl,
    request.pageContext ?? null,
  );
  const result = await createTwentyLead(parsedLead, settings);

  if (result.ok) {
    await setImportedLead(parsedLead.fingerprint, {
      importedAt: new Date().toISOString(),
      message: result.message,
      recordId: result.recordId,
      sourceUrl: parsedLead.sourceUrl,
    });
  }

  return result;
}

function buildMatterTimeline(items: MatterHistoryImportItem[]): MatterActivityEntry[] {
  return items.map((item, index) => ({
    eventId: item.taskId ?? `matter_activity_${index + 1}`,
    sourceUrl: item.sourceUrl,
    title: item.title,
    taskId: item.taskId,
    completedAt: item.completedAt,
    activityType: item.activityType,
    outcome: item.outcome,
    comment: item.comment,
    completedBy: item.completedBy,
    sourceRaw: item.pageContext?.rawSource ?? null,
    subSourceRaw: item.pageContext?.rawSubSource ?? null,
    hasAdf: item.rawAdfs.length > 0,
  }));
}

function getMatterCustomerSnapshot(
  request: CreateTwentyLeadBatchRequest,
): MatterCustomerSnapshot | null {
  return request.customerSnapshot ?? null;
}

async function importLeadBatchIntoTwenty(
  request: CreateTwentyLeadBatchRequest,
): Promise<TwentyLeadImportResult> {
  const settings = await getStoredSettings();
  const parsedLeads = request.items
    .filter((item) => item.rawAdfs.length > 0)
    .map((item) => parseAdfLead(item.rawAdfs.join("\n\n"), item.sourceUrl, item.pageContext ?? null));

  if (parsedLeads.length === 0) {
    return {
      ok: false,
      message: "No ADF-backed history entries were found in the visible matter history.",
    };
  }

  const parsedLead: ParsedAdfLead = mergeImportedLeads(
    parsedLeads,
    request.sourceUrl,
    buildMatterTimeline(request.items),
    getMatterCustomerSnapshot(request),
  );
  const result = await createTwentyLead(parsedLead, settings);

  if (result.ok) {
    await setImportedLead(parsedLead.fingerprint, {
      importedAt: new Date().toISOString(),
      message: result.message,
      recordId: result.recordId,
      sourceUrl: parsedLead.sourceUrl,
    });
  }

  return {
    ...result,
    message: result.ok
      ? `${result.message} Synced ${parsedLeads.length} ADF page${parsedLeads.length === 1 ? "" : "s"} and ${request.items.length} matter history entr${request.items.length === 1 ? "y" : "ies"}.`
      : result.message,
  };
}

browser.runtime.onInstalled.addListener(() => {
  void initializeSettings();
});

browser.runtime.onMessage.addListener((message: unknown) => {
  if (!isExtensionRequest(message)) {
    return Promise.resolve(errorResult("getPageInfo", "Unsupported message payload."));
  }

  switch (message.type) {
    case "getSettings":
      return getStoredSettings();
    case "updateSettings":
      return updateSettings(message);
    case "leadIndicatorDetected":
      return handleLeadIndicatorDetected(message);
    case "adfDetected":
      return handleAdfDetected(message);
    case "createTwentyLead":
      return importLeadIntoTwenty(message);
    case "createTwentyLeadBatch":
      return importLeadBatchIntoTwenty(message);
    case "testTwentyConnection":
      return getStoredSettings().then((settings) => testTwentyConnection(settings));
    case "runAutomation":
      return executeAutomation(message);
    default:
      return Promise.resolve(successResult("getPageInfo"));
  }
});
