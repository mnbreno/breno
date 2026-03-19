import { detectAdfInText } from "@shared/adf";
import type { AdfDetectionState } from "@shared/lead";

const RAW_BODY_PREFIX = "<!--Body";
const RAW_BODY_SUFFIX = "-->";

export function unwrapHiddenRawBody(rawHtml: string): string {
  let value = rawHtml.trim();

  if (value.startsWith(RAW_BODY_PREFIX)) {
    value = value.slice(RAW_BODY_PREFIX.length);
  }

  value = value.replace(/^\s*:\s*/, "");

  if (value.endsWith(RAW_BODY_SUFFIX)) {
    value = value.slice(0, -RAW_BODY_SUFFIX.length);
  }

  return value.trim();
}

export function detectAdfInRawBodyHtml(rawHtml: string): AdfDetectionState {
  return detectAdfInText(unwrapHiddenRawBody(rawHtml));
}

export function detectAdfInFetchedDetailDocument(doc: Document): AdfDetectionState {
  const rawBodyHtml = doc.querySelector<HTMLElement>("#InsertionPointForRawBody")?.innerHTML?.trim();
  if (rawBodyHtml) {
    const rawBodyDetection = detectAdfInRawBodyHtml(rawBodyHtml);
    if (rawBodyDetection.found) {
      return rawBodyDetection;
    }
  }

  const candidates = [
    doc.querySelector<HTMLElement>("#InsertionPointForBody")?.innerHTML?.trim() ?? "",
    doc.body?.innerHTML?.trim() ?? "",
    doc.documentElement?.outerHTML?.trim() ?? "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const detection = detectAdfInText(candidate);
    if (detection.found) {
      return detection;
    }
  }

  return {
    found: false,
    rawAdfs: [],
    fingerprint: null,
    preview: null,
  };
}

export function parseLeadSourceSummary(value: string | null): {
  rawSource: string | null;
  rawSubSource: string | null;
} {
  if (!value?.trim()) {
    return {
      rawSource: null,
      rawSubSource: null,
    };
  }

  const [rawSource, ...rest] = value
    .split(/\s+-\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  return {
    rawSource: rawSource ?? null,
    rawSubSource: rest.join(" - ") || null,
  };
}
