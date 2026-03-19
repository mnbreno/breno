import {
  type CreateTwentyLeadBatchRequest,
  type CreateTwentyLeadRequest,
  errorResult,
  isAutomationCommand,
  successResult,
  type AutomationCommand,
} from "@shared/messages";
import { detectAdfInText, normalizeLeadSource } from "@shared/adf";
import type {
  AdfDetectionState,
  LeadPageContext,
  MatterCustomerSnapshot,
  MatterHistoryImportItem,
  TwentyLeadImportResult,
} from "@shared/lead";
import { DEFAULT_SETTINGS, mergeSettings, type ExtensionSettings } from "@shared/settings";
import {
  detectAdfInRawBodyHtml,
  parseLeadSourceSummary,
} from "./adf-extraction";
import {
  enrichMatterHistoryItemFromDetailHtml,
  extractMatterCustomerSnapshot,
  extractMatterHistoryItems,
  isMatterPageDocument,
} from "./matter-sync";

type ContentCommand = AutomationCommand & { settings?: Partial<ExtensionSettings> };

const STYLE_ID = "firefox-automation-overlay-style";
const HIGHLIGHT_CLASS = "firefox-automation-highlight";
const ADF_PANEL_ID = "firefox-automation-adf-panel";
const HEADER_PANEL_ID = "firefox-automation-header-panel";
const ADF_STATUS_ID = "firefox-automation-adf-status";
const ADF_BUTTON_ID = "firefox-automation-adf-button";
const HEADER_STATUS_ID = "firefox-automation-header-status";
const HEADER_BUTTON_ID = "firefox-automation-header-button";
const MATTER_PANEL_ID = "firefox-automation-matter-panel";
const MATTER_STATUS_ID = "firefox-automation-matter-status";
const MATTER_BUTTON_ID = "firefox-automation-matter-button";
const LEAD_INDICATOR_SELECTOR = "#tdNewLeadsImage";
const LEAD_COUNT_SELECTOR = "#tdNewLeadsCount2";
const OPPORTUNITY_HEADER_SELECTOR = "#btnAddTrade, #AddTradeImgBtn";
const EMAIL_HEADER_SELECTOR = "#InsertionPointForInteractions, #OptionalPageTitle, #InsertionPointForBody";
const RAW_BODY_SELECTOR = "#InsertionPointForRawBody";
const CONTACTS_TAB_SELECTOR = "#liContacts";
const HISTORY_FRAME_SELECTOR = "#tabsTargetFrame";

let lastLeadSignature: string | null = null;
let lastAdfFingerprint: string | null = null;
let rescanHandle: number | null = null;

function ensureOverlayStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = browser.runtime.getURL("assets/automation-overlay.css");
  document.documentElement.append(link);
}

function resolveElement(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    throw new Error("Invalid CSS selector.");
  }
}

function highlightElement(element: Element, durationMs: number): void {
  ensureOverlayStyles();
  element.classList.add(HIGHLIGHT_CLASS);
  window.setTimeout(() => {
    element.classList.remove(HIGHLIGHT_CLASS);
  }, durationMs);
}

function maybeScrollIntoView(element: Element, settings: ExtensionSettings): void {
  if (!settings.autoScrollIntoView) {
    return;
  }

  element.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest",
  });
}

function asFormControl(element: Element): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    return element;
  }

  return null;
}

function isVisible(element: HTMLElement | null): element is HTMLElement {
  if (!element) {
    return false;
  }

  const style = window.getComputedStyle(element);

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    (element.offsetParent !== null || style.position === "fixed")
  );
}

function getElementText(element: HTMLElement): string {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return element.value;
  }

  return element.innerText || element.textContent || "";
}

function setPanelStatus(message: string): void {
  for (const id of [ADF_STATUS_ID, HEADER_STATUS_ID, MATTER_STATUS_ID]) {
    const status = document.getElementById(id);
    if (status) {
      status.textContent = message;
    }
  }
}

function getRowValueByAnchorId(anchorId: string): string | null {
  const anchor = document.getElementById(anchorId);
  const row = anchor?.closest("tr");

  if (!row) {
    return null;
  }

  const cells = row.querySelectorAll<HTMLTableCellElement>("td");
  return cells.length > 1 ? cells[1].textContent?.trim() ?? null : null;
}

function extractValueFromInlineScript(key: string): string | null {
  const scripts = Array.from(document.scripts);
  const pattern = new RegExp(`${key}:\\s*"([^"]*)"`, "i");

  for (const script of scripts) {
    const match = script.textContent?.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function getBodyTableValue(label: string): string | null {
  for (const row of document.querySelectorAll<HTMLTableRowElement>("#InsertionPointForBody tr")) {
    const cells = row.querySelectorAll<HTMLTableCellElement>("td");
    if (cells.length < 2) {
      continue;
    }

    const rowLabel = cells[0]?.textContent?.replace(/\s+/g, " ").trim().replace(/:$/, "") ?? "";
    if (rowLabel.toLowerCase() !== label.toLowerCase()) {
      continue;
    }

    return cells[1]?.textContent?.replace(/\s+/g, " ").trim() ?? null;
  }

  return null;
}

function extractLeadPageContext(): LeadPageContext {
  const emailLeadSource = parseLeadSourceSummary(getBodyTableValue("Lead Source"));
  const rawSource =
    getRowValueByAnchorId("OpportunityPanel_SourceLink") ??
    extractValueFromInlineScript("Source") ??
    emailLeadSource.rawSource;
  const rawSubSource =
    getRowValueByAnchorId("OpportunityPanel_SubSourceLink") ??
    extractValueFromInlineScript("SourceDetails") ??
    emailLeadSource.rawSubSource;
  const rawUpType =
    getRowValueByAnchorId("OpportunityPanel_UpTypeLink") ?? extractValueFromInlineScript("UpType");

  return {
    rawSource,
    rawSubSource,
    rawUpType,
    normalizedSource: normalizeLeadSource(rawSource, rawSubSource, rawUpType),
  };
}

function findRawBodyAdfContainer(): { container: HTMLElement; detection: AdfDetectionState } | null {
  const rawBody = document.querySelector<HTMLElement>(RAW_BODY_SELECTOR);
  const rawBodyHtml = rawBody?.innerHTML?.trim();

  if (!rawBody || !rawBodyHtml) {
    return null;
  }

  const detection = detectAdfInRawBodyHtml(rawBodyHtml);
  if (!detection.found) {
    return null;
  }

  return {
    container: document.querySelector<HTMLElement>("#InsertionPointForBody") ?? document.body,
    detection,
  };
}

function isViewEmailPage(): boolean {
  return document.querySelector(RAW_BODY_SELECTOR) !== null;
}

function findAdfContainer(): { container: HTMLElement; detection: AdfDetectionState } | null {
  const hiddenRawBodyMatch = findRawBodyAdfContainer();
  if (hiddenRawBodyMatch) {
    return hiddenRawBodyMatch;
  }

  const candidates = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
    .filter((element) => isVisible(element))
    .map((element) => ({
      element,
      detection: detectAdfInText(getElementText(element)),
    }))
    .filter((entry) => entry.detection.found)
    .sort((left, right) => getElementText(left.element).length - getElementText(right.element).length);

  if (candidates.length > 0) {
    return {
      container: candidates[0].element,
      detection: candidates[0].detection,
    };
  }

  const fallbackDetection = detectAdfInText(document.body.innerText);
  if (!fallbackDetection.found) {
    return null;
  }

  return {
    container: document.body,
    detection: fallbackDetection,
  };
}

function findHeaderContainer(): HTMLElement | null {
  const actionAnchor = document.querySelector<HTMLElement>(OPPORTUNITY_HEADER_SELECTOR);

  if (actionAnchor?.parentElement) {
    return actionAnchor.parentElement;
  }

  return (
    document.querySelector<HTMLElement>("td.SectionHeader.borderRight") ??
    document.querySelector<HTMLElement>(EMAIL_HEADER_SELECTOR)
  );
}

async function notifyLeadIndicator(): Promise<void> {
  const leadIndicator = document.querySelector<HTMLElement>(LEAD_INDICATOR_SELECTOR);
  const countText = document.querySelector<HTMLElement>(LEAD_COUNT_SELECTOR)?.textContent ?? "0";
  const count = Number.parseInt(countText.replace(/[^\d]/g, ""), 10);

  if (!isVisible(leadIndicator) || !Number.isFinite(count) || count <= 0) {
    lastLeadSignature = null;
    return;
  }

  const signature = `${window.location.pathname}|${count}`;
  if (signature === lastLeadSignature) {
    return;
  }

  lastLeadSignature = signature;
  await browser.runtime.sendMessage({
    type: "leadIndicatorDetected",
    detection: {
      url: window.location.href,
      title: document.title,
      count,
      text: leadIndicator.innerText.trim(),
      seenAt: new Date().toISOString(),
    },
  });
}

async function createLeadInTwenty(
  rawAdfs: string[],
  pageContext: LeadPageContext,
): Promise<TwentyLeadImportResult> {
  return browser.runtime.sendMessage({
    type: "createTwentyLead",
    sourceUrl: window.location.href,
    rawAdfs,
    pageContext,
  } satisfies CreateTwentyLeadRequest) as Promise<TwentyLeadImportResult>;
}

async function createMatterLeadInTwenty(
  items: MatterHistoryImportItem[],
  customerSnapshot: MatterCustomerSnapshot | null,
): Promise<TwentyLeadImportResult> {
  return browser.runtime.sendMessage({
    type: "createTwentyLeadBatch",
    sourceUrl: window.location.href,
    items,
    customerSnapshot,
  } satisfies CreateTwentyLeadBatchRequest) as Promise<TwentyLeadImportResult>;
}

function isMatterPage(): boolean {
  return isMatterPageDocument(document);
}

function waitFor<T>(factory: () => T | null, timeoutMs = 6000, intervalMs = 150): Promise<T> {
  const startedAt = Date.now();

  return new Promise<T>((resolve, reject) => {
    const check = () => {
      const value = factory();
      if (value) {
        resolve(value);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("Timed out waiting for matter history to load."));
        return;
      }

      window.setTimeout(check, intervalMs);
    };

    check();
  });
}

async function getMatterHistoryDocument(): Promise<Document> {
  const frame = document.querySelector<HTMLIFrameElement>(HISTORY_FRAME_SELECTOR);
  if (!frame) {
    throw new Error("Matter history frame was not found.");
  }

  const currentDocument = frame.contentDocument;
  if (currentDocument?.querySelector("#gvOpptyHistory, #gvScheduled")) {
    return currentDocument;
  }

  document.querySelector<HTMLElement>(CONTACTS_TAB_SELECTOR)?.click();
  return waitFor(() => {
    const historyDocument = frame.contentDocument;
    if (historyDocument?.querySelector("#gvOpptyHistory, #gvScheduled")) {
      return historyDocument;
    }

    return null;
  });
}

async function fetchMatterDetailHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Unable to load history detail page (${response.status}).`);
  }

  return response.text();
}

async function collectMatterHistoryItems(): Promise<{
  items: MatterHistoryImportItem[];
  customerSnapshot: MatterCustomerSnapshot | null;
}> {
  const historyDocument = await getMatterHistoryDocument();
  const historyItems = extractMatterHistoryItems(historyDocument, historyDocument.location.href);
  const customerSnapshot = extractMatterCustomerSnapshot(document);
  const enrichedItems: MatterHistoryImportItem[] = [];

  for (const item of historyItems) {
    if (!/viewemailmessage\.aspx/i.test(item.sourceUrl)) {
      enrichedItems.push(item);
      continue;
    }

    try {
      const detailHtml = await fetchMatterDetailHtml(item.sourceUrl);
      enrichedItems.push(enrichMatterHistoryItemFromDetailHtml(item, detailHtml));
    } catch {
      enrichedItems.push(item);
    }
  }

  return {
    items: enrichedItems,
    customerSnapshot,
  };
}

function runLeadImport(
  button: HTMLButtonElement,
  rawAdfs: string[],
  pageContext: LeadPageContext,
): void {
  button.disabled = true;
  setPanelStatus("Sending lead to Twenty CRM...");

  void createLeadInTwenty(rawAdfs, pageContext).then((result) => {
    if (result.ok) {
      setPanelStatus(result.message);
      button.textContent = "Lead Imported";
    } else {
      setPanelStatus(result.message);
      button.disabled = false;
      button.textContent = "Retry Create in Twenty";
    }
  });
}

function runMatterImport(button: HTMLButtonElement): void {
  button.disabled = true;
  setPanelStatus("Collecting visible matter history...");

  void collectMatterHistoryItems()
    .then(({ items, customerSnapshot }) => {
      const adfItemCount = items.filter((item) => item.rawAdfs.length > 0).length;
      if (adfItemCount === 0) {
        throw new Error("No ADF-backed history entries were found in the visible matter history.");
      }

      setPanelStatus(`Syncing ${adfItemCount} ADF page${adfItemCount === 1 ? "" : "s"} to Twenty CRM...`);
      return createMatterLeadInTwenty(items, customerSnapshot);
    })
    .then((result) => {
      if (result.ok) {
        setPanelStatus(result.message);
        button.textContent = "Matter Synced";
        return;
      }

      setPanelStatus(result.message);
      button.disabled = false;
      button.textContent = "Retry Matter Sync";
    })
    .catch((error: unknown) => {
      setPanelStatus(error instanceof Error ? error.message : "Matter sync failed.");
      button.disabled = false;
      button.textContent = "Retry Matter Sync";
    });
}

function renderMatterPanel(): void {
  if (!isMatterPage()) {
    document.getElementById(MATTER_PANEL_ID)?.remove();
    return;
  }

  const container = findHeaderContainer();
  if (!container) {
    return;
  }

  if (document.getElementById(MATTER_PANEL_ID)) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.id = MATTER_PANEL_ID;
  wrapper.className = "firefox-automation-header-panel";

  const meta = document.createElement("div");
  meta.className = "firefox-automation-header-meta";
  meta.textContent = "Sync the visible matter history oldest-to-newest, including comments and ADF pages.";

  const button = document.createElement("button");
  button.id = MATTER_BUTTON_ID;
  button.className = "firefox-automation-adf-button";
  button.type = "button";
  button.textContent = "Sync Matter to Twenty";

  const status = document.createElement("div");
  status.id = MATTER_STATUS_ID;
  status.className = "firefox-automation-adf-status";
  status.textContent = "Ready to sync the visible matter history into Twenty CRM.";

  button.addEventListener("click", () => {
    runMatterImport(button);
  });

  wrapper.append(meta, button, status);
  container.prepend(wrapper);
}

function renderHeaderPanel(detection: AdfDetectionState, pageContext: LeadPageContext): void {
  const container = findHeaderContainer();

  if (!container || detection.rawAdfs.length === 0 || !detection.fingerprint) {
    return;
  }

  const existing = document.getElementById(HEADER_PANEL_ID);
  if (existing?.dataset.fingerprint === detection.fingerprint) {
    return;
  }

  existing?.remove();

  const wrapper = document.createElement("div");
  wrapper.id = HEADER_PANEL_ID;
  wrapper.className = "firefox-automation-header-panel";
  wrapper.dataset.fingerprint = detection.fingerprint;

  const meta = document.createElement("div");
  meta.className = "firefox-automation-header-meta";
  meta.textContent = `Latest source: ${pageContext.rawSource ?? "Unknown"}${
    pageContext.rawSubSource ? ` / ${pageContext.rawSubSource}` : ""
  }`;

  const button = document.createElement("button");
  button.id = HEADER_BUTTON_ID;
  button.className = "firefox-automation-adf-button";
  button.type = "button";
  button.textContent = "Create in Twenty";

  const status = document.createElement("div");
  status.id = HEADER_STATUS_ID;
  status.className = "firefox-automation-adf-status";
  status.textContent = "Ready to import this lead with latest source analytics.";

  button.addEventListener("click", () => {
    runLeadImport(button, detection.rawAdfs, pageContext);
  });

  wrapper.append(meta, button, status);
  container.prepend(wrapper);
}

function renderAdfPanel(
  container: HTMLElement,
  detection: AdfDetectionState,
  pageContext: LeadPageContext,
): void {
  if (detection.rawAdfs.length === 0 || !detection.fingerprint) {
    return;
  }

  const existingPanel = document.getElementById(ADF_PANEL_ID);
  if (existingPanel?.dataset.fingerprint === detection.fingerprint) {
    return;
  }

  existingPanel?.remove();

  const panel = document.createElement("section");
  panel.id = ADF_PANEL_ID;
  panel.className = "firefox-automation-adf-panel";
  panel.dataset.fingerprint = detection.fingerprint;

  const title = document.createElement("strong");
  title.textContent = "New Lead has arrived";

  const preview = document.createElement("p");
  preview.className = "firefox-automation-adf-preview";
  preview.textContent =
    detection.preview ??
    `${detection.rawAdfs.length} ADF source${detection.rawAdfs.length === 1 ? "" : "s"} detected on this page.`;

  const status = document.createElement("div");
  status.id = ADF_STATUS_ID;
  status.className = "firefox-automation-adf-status";
  status.textContent = `ADF detected. Latest source: ${pageContext.rawSource ?? "Unknown"}${
    pageContext.rawSubSource ? ` / ${pageContext.rawSubSource}` : ""
  }.`;

  const button = document.createElement("button");
  button.id = ADF_BUTTON_ID;
  button.className = "firefox-automation-adf-button";
  button.type = "button";
  button.textContent = "Create in Twenty";

  button.addEventListener("click", () => {
    runLeadImport(button, detection.rawAdfs, pageContext);
  });

  panel.append(title, preview, button, status);

  if (container === document.body) {
    container.prepend(panel);
  } else {
    container.insertAdjacentElement("beforebegin", panel);
  }

  highlightElement(container, 2500);
}

async function scanForAdf(): Promise<void> {
  const match = findAdfContainer();
  const pageContext = extractLeadPageContext();

  if (!match || !match.detection.fingerprint || match.detection.rawAdfs.length === 0) {
    return;
  }

  renderHeaderPanel(match.detection, pageContext);
  if (!isViewEmailPage()) {
    renderAdfPanel(match.container, match.detection, pageContext);
  } else {
    document.getElementById(ADF_PANEL_ID)?.remove();
  }

  if (match.detection.fingerprint === lastAdfFingerprint) {
    return;
  }

  lastAdfFingerprint = match.detection.fingerprint;
  await browser.runtime.sendMessage({
    type: "adfDetected",
    sourceUrl: window.location.href,
    fingerprint: match.detection.fingerprint,
  });
}

function scheduleRescan(): void {
  if (rescanHandle !== null) {
    return;
  }

  rescanHandle = window.setTimeout(() => {
    rescanHandle = null;
    void monitorPage();
  }, 250);
}

async function monitorPage(): Promise<void> {
  ensureOverlayStyles();
  await notifyLeadIndicator();
  renderMatterPanel();
  await scanForAdf();
}

async function executeCommand(command: ContentCommand) {
  const settings = mergeSettings(command.settings ?? DEFAULT_SETTINGS);

  switch (command.action) {
    case "getPageInfo":
      return successResult(command.action, {
        title: document.title,
        url: window.location.href,
        readyState: document.readyState,
      });
    case "highlightSelector": {
      const element = resolveElement(command.selector ?? settings.defaultSelector);

      if (!element) {
        return errorResult(command.action, "No element matched the selector.");
      }

      maybeScrollIntoView(element, settings);
      highlightElement(element, settings.highlightDurationMs);

      return successResult(command.action, {
        selector: command.selector ?? settings.defaultSelector,
        tagName: element.tagName.toLowerCase(),
      });
    }
    case "clickSelector": {
      const element = resolveElement(command.selector ?? settings.defaultSelector);

      if (!(element instanceof HTMLElement)) {
        return errorResult(command.action, "No clickable element matched the selector.");
      }

      maybeScrollIntoView(element, settings);
      element.click();

      return successResult(command.action, {
        selector: command.selector ?? settings.defaultSelector,
      });
    }
    case "extractText": {
      const element = resolveElement(command.selector ?? settings.defaultSelector);

      if (!element) {
        return errorResult(command.action, "No element matched the selector.");
      }

      maybeScrollIntoView(element, settings);

      return successResult(command.action, {
        selector: command.selector ?? settings.defaultSelector,
        text: element.textContent?.trim() ?? "",
      });
    }
    case "setValue": {
      const element = resolveElement(command.selector ?? settings.defaultSelector);
      const control = element ? asFormControl(element) : null;

      if (!control) {
        return errorResult(command.action, "Selector must point to an input, textarea, or select.");
      }

      maybeScrollIntoView(control, settings);
      control.focus();
      control.value = command.value ?? "";
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));

      return successResult(command.action, {
        selector: command.selector ?? settings.defaultSelector,
        valueLength: control.value.length,
      });
    }
    default:
      return errorResult("getPageInfo", "Unsupported automation action.");
  }
}

browser.runtime.onMessage.addListener((message: unknown) => {
  if (!isAutomationCommand(message)) {
    return false;
  }

  return executeCommand(message as ContentCommand);
});

const observer = new MutationObserver(() => {
  scheduleRescan();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  characterData: true,
});

void monitorPage();
