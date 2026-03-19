import { normalizeLeadSource } from "@shared/adf";
import type {
  LeadPageContext,
  MatterCustomerSnapshot,
  MatterHistoryImportItem,
} from "@shared/lead";
import {
  detectAdfInFetchedDetailDocument,
  detectAdfInRawBodyHtml,
  parseLeadSourceSummary,
} from "./adf-extraction";

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : null;
}

function decodeUrl(value: string): string {
  return value.replace(/&amp;/g, "&");
}

function parseHistoryDate(value: string | null): number {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const match = value.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i,
  );

  if (!match) {
    return Number.POSITIVE_INFINITY;
  }

  const [, monthText, dayText, yearText, hourText, minuteText, meridiem] = match;
  const month = Number.parseInt(monthText, 10) - 1;
  const day = Number.parseInt(dayText, 10);
  const year = 2000 + Number.parseInt(yearText, 10);
  let hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);

  if (meridiem.toUpperCase() === "PM" && hour !== 12) {
    hour += 12;
  } else if (meridiem.toUpperCase() === "AM" && hour === 12) {
    hour = 0;
  }

  return new Date(year, month, day, hour, minute).getTime();
}

function extractDetailUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/(?:getTaskDetails|PopHistory)\('([^']+)'/i);
  return match?.[1] ? decodeUrl(match[1]) : null;
}

function getNestedCellText(cell: Element | null): string | null {
  return normalizeText(cell?.textContent);
}

function splitCustomerName(value: string | null): {
  customerFirstName: string | null;
  customerLastName: string | null;
} {
  const parts = (value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      customerFirstName: null,
      customerLastName: null,
    };
  }

  return {
    customerFirstName: parts[0] ?? null,
    customerLastName: parts.slice(1).join(" ") || null,
  };
}

function decodeHtmlAttribute(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getCustomerInfoValueByLinkId(doc: Document, linkId: string): string | null {
  const link = doc.getElementById(linkId);
  const labelCell = link?.closest("td");
  const valueCell = labelCell?.nextElementSibling;

  return normalizeText(valueCell?.textContent ?? null);
}

function getCustomerInfoLabelValue(doc: Document, label: string): string | null {
  for (const row of doc.querySelectorAll<HTMLTableRowElement>("tr")) {
    const cells = row.querySelectorAll<HTMLTableCellElement>("td");
    if (cells.length < 2) {
      continue;
    }

    const rowLabel =
      normalizeText(cells[0]?.textContent)
        ?.replace(/\s+/g, " ")
        .replace(/:$/, "") ?? "";
    if (rowLabel.toLowerCase() !== label.toLowerCase()) {
      continue;
    }

    return normalizeText(cells[1]?.textContent);
  }

  return null;
}

function parseCityStateZip(value: string | null): {
  customerCity: string | null;
  customerState: string | null;
  customerPostalCode: string | null;
} {
  if (!value) {
    return {
      customerCity: null,
      customerState: null,
      customerPostalCode: null,
    };
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  const stateZipMatch = normalized.match(/^(.*?)(?:,\s*)?([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (stateZipMatch) {
    return {
      customerCity: normalizeText(stateZipMatch[1]),
      customerState: normalizeText(stateZipMatch[2])?.toUpperCase() ?? null,
      customerPostalCode: normalizeText(stateZipMatch[3]),
    };
  }

  return {
    customerCity: normalized || null,
    customerState: null,
    customerPostalCode: null,
  };
}

function parseGoogleMapsAddress(doc: Document): MatterCustomerSnapshot | null {
  const mapsImage = doc.querySelector<HTMLElement>("#CustomerInfoPanel_googlemaps");
  const onclick = decodeHtmlAttribute(mapsImage?.getAttribute("onclick"));

  if (!onclick) {
    return null;
  }

  const match = onclick.match(/daddr=([^']+)'/i);
  if (!match?.[1]) {
    return null;
  }

  const destination = normalizeText(match[1].replace(/\+/g, " "));
  if (!destination) {
    return null;
  }

  const [streetPart, cityPart, stateZipPart] = destination.split(",").map((part) => normalizeText(part));
  const stateZip = parseCityStateZip(stateZipPart);

  return {
    customerName: null,
    customerFirstName: null,
    customerLastName: null,
    customerEmail: null,
    customerPhone: null,
    customerStreetAddress: streetPart ?? null,
    customerCity: cityPart ?? stateZip.customerCity,
    customerState: stateZip.customerState,
    customerPostalCode: stateZip.customerPostalCode,
    customerFullAddress: [streetPart, cityPart, stateZipPart].filter(Boolean).join(", ") || null,
  };
}

export function extractMatterCustomerSnapshot(doc: Document): MatterCustomerSnapshot | null {
  const customerName =
    getCustomerInfoValueByLinkId(doc, "CustomerInfoPanel_NameLink") ?? getCustomerInfoLabelValue(doc, "Name");
  const { customerFirstName, customerLastName } = splitCustomerName(customerName);
  const prefEmailLink = doc.querySelector<HTMLAnchorElement>("#CustomerInfoPanel_PrefEmailLink");
  const customerEmail =
    normalizeText(prefEmailLink?.getAttribute("title")) ??
    getCustomerInfoValueByLinkId(doc, "CustomerInfoPanel_PrefEmailLink") ??
    getCustomerInfoLabelValue(doc, "Preferred Email");
  const customerPhone =
    getCustomerInfoValueByLinkId(doc, "CustomerInfoPanel_CPhoneLink") ??
    getCustomerInfoLabelValue(doc, "Cell #") ??
    getCustomerInfoLabelValue(doc, "Cell");
  const customerStreetAddress =
    getCustomerInfoValueByLinkId(doc, "CustomerInfoPanel_AddressLink") ??
    getCustomerInfoLabelValue(doc, "Address");
  const cityStateZipRow = doc.querySelector<HTMLElement>("#CustomerInfoPanel_CityStateZipRow td.headingBlack_11px");
  const cityStateZipValue = normalizeText(cityStateZipRow?.textContent);
  const parsedCityStateZip = parseCityStateZip(cityStateZipValue);
  const mapsAddress = parseGoogleMapsAddress(doc);

  const streetAddress = customerStreetAddress ?? mapsAddress?.customerStreetAddress ?? null;
  const customerCity = parsedCityStateZip.customerCity ?? mapsAddress?.customerCity ?? null;
  const customerState = parsedCityStateZip.customerState ?? mapsAddress?.customerState ?? null;
  const customerPostalCode = parsedCityStateZip.customerPostalCode ?? mapsAddress?.customerPostalCode ?? null;
  const customerFullAddress =
    [streetAddress, customerCity, [customerState, customerPostalCode].filter(Boolean).join(" ").trim()]
      .filter(Boolean)
      .join(", ") || mapsAddress?.customerFullAddress || null;

  const snapshot: MatterCustomerSnapshot = {
    customerName,
    customerFirstName,
    customerLastName,
    customerEmail,
    customerPhone,
    customerStreetAddress: streetAddress,
    customerCity,
    customerState,
    customerPostalCode,
    customerFullAddress,
  };

  return Object.values(snapshot).some(Boolean) ? snapshot : null;
}

function buildLeadPageContextFromDocument(doc: Document): LeadPageContext | null {
  const sourceRow = doc.querySelector("#OpportunityPanel_SourceLink")?.closest("tr");
  const subSourceRow = doc.querySelector("#OpportunityPanel_SubSourceLink")?.closest("tr");
  const upTypeRow = doc.querySelector("#OpportunityPanel_UpTypeLink")?.closest("tr");

  const sourceFromOpportunity = sourceRow?.querySelectorAll("td")[1]?.textContent ?? null;
  const subSourceFromOpportunity = subSourceRow?.querySelectorAll("td")[1]?.textContent ?? null;
  const upTypeFromOpportunity = upTypeRow?.querySelectorAll("td")[1]?.textContent ?? null;

  let sourceFromEmailBody: string | null = null;
  let subSourceFromEmailBody: string | null = null;

  for (const row of doc.querySelectorAll<HTMLTableRowElement>("#InsertionPointForBody tr")) {
    const cells = row.querySelectorAll<HTMLTableCellElement>("td");
    if (cells.length < 2) {
      continue;
    }

    const label = normalizeText(cells[0]?.textContent)?.replace(/:$/, "");
    if (label?.toLowerCase() !== "lead source") {
      continue;
    }

    const parsed = parseLeadSourceSummary(cells[1]?.textContent ?? null);
    sourceFromEmailBody = parsed.rawSource;
    subSourceFromEmailBody = parsed.rawSubSource;
    break;
  }

  const rawSource = normalizeText(sourceFromOpportunity) ?? sourceFromEmailBody;
  const rawSubSource = normalizeText(subSourceFromOpportunity) ?? subSourceFromEmailBody;
  const rawUpType = normalizeText(upTypeFromOpportunity);

  if (!rawSource && !rawSubSource && !rawUpType) {
    return null;
  }

  return {
    rawSource,
    rawSubSource,
    rawUpType,
    normalizedSource: normalizeLeadSource(rawSource, rawSubSource, rawUpType),
  };
}

export function isMatterPageDocument(doc: Document): boolean {
  return Boolean(doc.querySelector("#tabsTargetFrame") && doc.querySelector("#liContacts"));
}

export function extractMatterHistoryItems(doc: Document, baseUrl: string): MatterHistoryImportItem[] {
  const items: MatterHistoryImportItem[] = [];

  for (const row of doc.querySelectorAll<HTMLTableRowElement>("#gvScheduled tr.even, #gvScheduled tr.odd")) {
    const cells = row.querySelectorAll<HTMLTableCellElement>("td");
    if (cells.length < 4) {
      continue;
    }

    items.push({
      sourceUrl: baseUrl,
      title: "Scheduled Activity",
      taskId: null,
      completedAt: normalizeText(cells[0]?.textContent),
      activityType: getNestedCellText(cells[1]),
      outcome: null,
      comment: normalizeText(cells[3]?.textContent),
      completedBy: normalizeText(cells[2]?.textContent),
      pageContext: null,
      rawAdfs: [],
    });
  }

  for (const row of doc.querySelectorAll<HTMLTableRowElement>("#gvOpptyHistory tr.even, #gvOpptyHistory tr.odd")) {
    const cells = row.querySelectorAll<HTMLTableCellElement>("td");
    if (cells.length < 7) {
      continue;
    }

    const icon = row.querySelector<HTMLElement>("i[id^='img_']");
    const taskId = icon?.id.replace(/^img_/, "") ?? null;
    const openedLink = row.querySelector<HTMLAnchorElement>("a[title='Opened']");
    const detailUrl = extractDetailUrl(openedLink?.getAttribute("onclick") ?? icon?.getAttribute("onclick") ?? null);

    items.push({
      sourceUrl: detailUrl ? new URL(detailUrl, baseUrl).toString() : baseUrl,
      title: normalizeText(cells[4]?.textContent),
      taskId,
      completedAt: normalizeText(cells[1]?.textContent),
      activityType: getNestedCellText(cells[2]),
      outcome: normalizeText(cells[3]?.textContent),
      comment: normalizeText(cells[4]?.textContent),
      completedBy: normalizeText(cells[5]?.textContent),
      pageContext: null,
      rawAdfs: [],
    });
  }

  return items.sort((left, right) => parseHistoryDate(left.completedAt) - parseHistoryDate(right.completedAt));
}

export function enrichMatterHistoryItemFromDetailHtml(
  item: MatterHistoryImportItem,
  html: string,
): MatterHistoryImportItem {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rawBodyHtml = doc.querySelector<HTMLElement>("#InsertionPointForRawBody")?.innerHTML?.trim() ?? "";
  const detection = rawBodyHtml
    ? detectAdfInRawBodyHtml(rawBodyHtml)
    : detectAdfInFetchedDetailDocument(doc);
  const resolvedDetection = detection.found ? detection : detectAdfInFetchedDetailDocument(doc);

  return {
    ...item,
    title:
      normalizeText(doc.querySelector("#HeaderSubject")?.textContent) ??
      normalizeText(doc.title) ??
      item.title,
    pageContext: buildLeadPageContextFromDocument(doc) ?? item.pageContext,
    rawAdfs: resolvedDetection.found ? resolvedDetection.rawAdfs : [],
  };
}
