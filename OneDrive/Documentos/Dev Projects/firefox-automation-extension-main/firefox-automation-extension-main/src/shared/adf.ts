import type {
  AdfArtifact,
  AutomotiveFieldSources,
  AdfDetectionState,
  InquiryHistoryEntry,
  LeadPageContext,
  LeadSourceChannel,
  MatterCustomerSnapshot,
  MatterActivityEntry,
  ParsedAdfLead,
  ParsedValueSource,
  PhoneSourceKind,
} from "./lead";

const HTML_ADF_BLOCK_PATTERN = /<html[\s\S]*?<\/html>\s*(?:<!--[\s\S]*?-->)?/gi;
const XML_ADF_BLOCK_PATTERN = /(?:(?:<\?(?:adf|xml)\b[\s\S]*?\?>)\s*)*<adf\b[\s\S]*?<\/adf>/gi;
const PHONE_PATTERN = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const VIN_CANDIDATE_PATTERN = /\bVIN\b\s*[:;]\s*([^\s,;]+)/i;
const PREQUAL_STATUS_PATTERN = /\bPre[- ]?Qual(?:ified)?\b\s*[:;]\s*([A-Za-z0-9-]+)/i;
const PREQUAL_AMOUNT_PATTERN =
  /\bPre[- ]?Qualified Amount\b\s*[:;]\s*\$?\s*([0-9][0-9,\s]*(?:\.\d{1,2})?)/i;
const CAMPAIGN_CODE_PATTERN = /\b(?:Campaign-Tracking Code|Tracking Code)\b\s*[:;]\s*([^,<\n]+)/i;
const MODEL_YEAR_PATTERN = /\bModel Year\b\s*:\s*(\d{4})/i;
const MODEL_PATTERN = /\bModel\b\s*:\s*([^,\n]+)/i;
const VALID_VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
  rsquo: "'",
  lsquo: "'",
  ndash: "-",
  mdash: "-",
  hellip: "...",
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }

    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }

    return HTML_ENTITIES[entity] ?? `&${entity};`;
  });
}

function stripTags(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|table|head|body)>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "\n")
    .replace(/<[^>]+>/g, " ");
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function createEmptyAutomotiveFieldSources(): AutomotiveFieldSources {
  return {
    vehicleYear: null,
    vehicleMake: null,
    vehicleModel: null,
    vehicleTrim: null,
    vehicleVin: null,
    vehicleInterest: null,
    vehicleStatus: null,
    providerLeadType: null,
    isPrequalLead: null,
    prequalStatus: null,
    prequalifiedAmount: null,
    campaignCode: null,
    vehicleSummary: null,
  };
}

function markAutomotiveSource(
  sources: AutomotiveFieldSources,
  key: keyof AutomotiveFieldSources,
  source: ParsedValueSource,
): void {
  sources[key] = source;
}

function normalizeVehicleYear(value: string | null, warnings: string[]): number | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  const maxYear = new Date().getUTCFullYear() + 1;
  if (!Number.isInteger(parsed) || parsed < 1981 || parsed > maxYear) {
    warnings.push(`Ignored invalid vehicle year: ${trimmed}`);
    return null;
  }

  return parsed;
}

function normalizeCurrencyAmount(value: string | null, warnings: string[], label: string): number | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/[$,\s;]/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    warnings.push(`Ignored invalid ${label}: ${trimmed}`);
    return null;
  }

  return parsed;
}

function normalizeVin(value: string | null, warnings: string[]): string | null {
  const trimmed = value?.replace(/[^A-Za-z0-9]/g, "").toUpperCase() ?? "";
  if (!trimmed) {
    return null;
  }

  if (!VALID_VIN_PATTERN.test(trimmed)) {
    warnings.push(`Ignored invalid VIN: ${trimmed}`);
    return null;
  }

  return trimmed;
}

function findFallbackVin(value: string): string | null {
  return value.match(/\b[A-HJ-NPR-Z0-9]{17}\b/)?.[0] ?? null;
}

function normalizePrequalStatus(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.toLowerCase();
  if (["y", "yes", "true", "approved", "prequalified"].includes(normalized)) {
    return "prequalified";
  }

  if (["n", "no", "false", "denied", "not prequalified"].includes(normalized)) {
    return "not_prequalified";
  }

  return trimmed;
}

function inferIsPrequalLead(
  prequalStatus: string | null,
  providerService: string | null,
  providerLeadType: string | null,
  comments: string | null,
): boolean | null {
  if (prequalStatus === "prequalified" || prequalStatus === "not_prequalified") {
    return true;
  }

  const haystack = [providerService, providerLeadType, comments].filter(Boolean).join(" ").toLowerCase();
  if (!haystack) {
    return null;
  }

  if (haystack.includes("prequal") || haystack.includes("pre-qual") || haystack.includes("credit application")) {
    return true;
  }

  return null;
}

function buildVehicleSummary(
  vehicleYear: number | null,
  vehicleMake: string | null,
  vehicleModel: string | null,
  vehicleVin: string | null,
): string | null {
  const summary = [vehicleYear ? String(vehicleYear) : null, vehicleMake, vehicleModel]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (summary && vehicleVin) {
    return `${summary} (VIN: ${vehicleVin})`;
  }

  return summary || (vehicleVin ? `VIN: ${vehicleVin}` : null);
}

function getTagAttribute(value: string, tagName: string, attributeName: string): string | null {
  return (
    value.match(new RegExp(`<${tagName}\\b[^>]*${attributeName}=["']([^"']+)["']`, "i"))?.[1]?.trim() ?? null
  );
}

function extractCommentValue(pattern: RegExp, comments: string | null): string | null {
  const extracted = comments?.match(pattern)?.[1];
  if (!extracted) {
    return null;
  }

  return extracted.replace(/\]\]>.*$/s, "").trim() || null;
}

function extractAutomotiveDetailsFromComments(comments: string | null): {
  vehicleYear: number | null;
  vehicleModel: string | null;
  vehicleVin: string | null;
  prequalStatus: string | null;
  prequalifiedAmount: number | null;
  campaignCode: string | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const rawVehicleYear = extractCommentValue(MODEL_YEAR_PATTERN, comments);
  const rawVehicleModel = extractCommentValue(MODEL_PATTERN, comments);
  const rawVin =
    comments?.match(/\bVIN\b[^A-Z0-9]*([A-HJ-NPR-Z0-9]{17})\b/i)?.[1] ??
    extractCommentValue(VIN_CANDIDATE_PATTERN, comments);
  const rawPrequalStatus =
    extractCommentValue(PREQUAL_STATUS_PATTERN, comments) ??
    comments?.match(/\bPreQual\b\s*[:;]\s*([^,\n]+)/i)?.[1]?.trim() ??
    null;
  const rawPrequalifiedAmount =
    extractCommentValue(PREQUAL_AMOUNT_PATTERN, comments) ??
    comments?.match(/\bPreQualified Amount\b\s*[:;]\s*\$?\s*([0-9][0-9,\s]*(?:\.\d{1,2})?)/i)?.[1]?.trim() ??
    null;
  const rawCampaignCode =
    extractCommentValue(CAMPAIGN_CODE_PATTERN, comments) ??
    comments?.match(/\bHDMC-Campaign-Tracking Code\b\s*[:;]\s*([^,<\n]+)/i)?.[1]?.trim() ??
    null;

  return {
    vehicleYear: normalizeVehicleYear(rawVehicleYear, warnings),
    vehicleModel: rawVehicleModel ? normalizeWhitespace(rawVehicleModel) : null,
    vehicleVin: normalizeVin(rawVin, warnings),
    prequalStatus: normalizePrequalStatus(rawPrequalStatus),
    prequalifiedAmount: normalizeCurrencyAmount(
      rawPrequalifiedAmount,
      warnings,
      "prequalified amount",
    ),
    campaignCode: rawCampaignCode ? normalizeWhitespace(rawCampaignCode) : null,
    warnings,
  };
}

function extractGreetingName(plainText: string): string | null {
  const match = plainText.match(/Hello\s+([^\n]+)/i);
  return match?.[1]?.trim() ?? null;
}

function extractDealerName(plainText: string): string | null {
  const thankYouMatch = plainText.match(
    /Thank you for taking the time to contact\s+(.+?)(?:\s*\.\s+|\s+One of our)/i,
  );
  if (thankYouMatch?.[1]) {
    return thankYouMatch[1].trim().replace(/\s+\.$/, "");
  }

  const signatureMatch = plainText.match(/Internet Sales\s+(.+?)\s+\d{3}[-.]\d{3}[-.]\d{4}/i);
  return signatureMatch?.[1]?.trim() ?? null;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function mergeUniqueHistory(entries: InquiryHistoryEntry[]): InquiryHistoryEntry[] {
  const seen = new Set<string>();
  const result: InquiryHistoryEntry[] = [];

  for (const entry of entries) {
    const signature = `${entry.rawAdfFingerprint}|${entry.requestDate ?? ""}|${entry.sourceRaw ?? ""}|${entry.provider ?? ""}`;
    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    result.push(entry);
  }

  return result;
}

function dedupeMatterTimeline(entries: MatterActivityEntry[]): MatterActivityEntry[] {
  const seen = new Set<string>();
  const result: MatterActivityEntry[] = [];

  for (const entry of entries) {
    const signature = [
      entry.taskId ?? "",
      entry.completedAt ?? "",
      entry.activityType ?? "",
      entry.outcome ?? "",
      entry.comment ?? "",
    ].join("|");

    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    result.push(entry);
  }

  return result;
}

function dedupeArtifacts(entries: AdfArtifact[]): AdfArtifact[] {
  const seen = new Set<string>();
  const result: AdfArtifact[] = [];

  for (const entry of entries) {
    const signature = `${entry.fileName}|${entry.sourceUrl}|${entry.taskId ?? ""}`;
    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    result.push(entry);
  }

  return result;
}

function normalizePhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

interface PhoneCandidate {
  normalizedValue: string;
  sourceKind: PhoneSourceKind;
  confidenceScore: number;
  leadOrder: number;
  rawType: string | null;
}

function getPhoneSourceConfidence(sourceKind: PhoneSourceKind): number {
  switch (sourceKind) {
    case "xml_customer_mobile":
      return 500;
    case "xml_customer_other":
      return 400;
    case "matter_snapshot":
      return 350;
    case "html_contextual":
      return 200;
    case "html_generic":
      return 100;
    case "unscoped_fallback":
      return 50;
    default:
      return 0;
  }
}

function isLowConfidencePhoneSource(sourceKind: PhoneSourceKind | null): boolean {
  return sourceKind === null || ["html_contextual", "html_generic", "unscoped_fallback"].includes(sourceKind);
}

function dedupePhoneCandidates(candidates: PhoneCandidate[]): PhoneCandidate[] {
  const bestByValue = new Map<string, PhoneCandidate>();

  for (const candidate of candidates) {
    if (!candidate.normalizedValue) {
      continue;
    }

    const existing = bestByValue.get(candidate.normalizedValue);
    if (
      !existing ||
      candidate.confidenceScore > existing.confidenceScore ||
      (candidate.confidenceScore === existing.confidenceScore && candidate.leadOrder > existing.leadOrder)
    ) {
      bestByValue.set(candidate.normalizedValue, candidate);
    }
  }

  return [...bestByValue.values()];
}

function selectBestPhoneCandidate(candidates: PhoneCandidate[]): PhoneCandidate | null {
  const dedupedCandidates = dedupePhoneCandidates(candidates);

  dedupedCandidates.sort((left, right) => {
    if (right.confidenceScore !== left.confidenceScore) {
      return right.confidenceScore - left.confidenceScore;
    }

    return right.leadOrder - left.leadOrder;
  });

  return dedupedCandidates[0] ?? null;
}

function buildPhoneNumbers(candidates: PhoneCandidate[]): string[] {
  return uniqueStrings(
    dedupePhoneCandidates(candidates)
      .sort((left, right) => {
        if (right.confidenceScore !== left.confidenceScore) {
          return right.confidenceScore - left.confidenceScore;
        }

        return right.leadOrder - left.leadOrder;
      })
      .map((candidate) => candidate.normalizedValue),
  );
}

function classifyHtmlPhoneSource(line: string): PhoneSourceKind {
  const haystack = line.toLowerCase();
  const positiveSignals = ["customer", "your phone", "best phone", "best number", "mobile", "cell"];
  const negativeSignals = [
    "internet team",
    "internet sales",
    "contact us",
    "call us",
    "reach us",
    "rock city harley",
    "dealership",
  ];

  if (negativeSignals.some((signal) => haystack.includes(signal))) {
    return "html_generic";
  }

  if (positiveSignals.some((signal) => haystack.includes(signal))) {
    return "html_contextual";
  }

  return "html_generic";
}

function extractHtmlPhoneCandidates(plainText: string, leadOrder = 0): PhoneCandidate[] {
  return dedupePhoneCandidates(
    plainText
      .split("\n")
      .flatMap((line) => {
        const matches = line.match(PHONE_PATTERN) ?? [];
        return matches.map((match) => {
          const sourceKind = classifyHtmlPhoneSource(line);
          return {
            normalizedValue: normalizePhoneNumber(match),
            sourceKind,
            confidenceScore: getPhoneSourceConfidence(sourceKind),
            leadOrder,
            rawType: null,
          } satisfies PhoneCandidate;
        });
      }),
  );
}

function inferXmlPhoneSourceKind(rawType: string | null): PhoneSourceKind {
  const normalizedType = rawType?.trim().toLowerCase() ?? "";
  if (["cell", "cellphone", "mobile", "cell phone", "cellular"].includes(normalizedType)) {
    return "xml_customer_mobile";
  }

  return "xml_customer_other";
}

function extractXmlCustomerPhoneCandidates(value: string, leadOrder = 0): PhoneCandidate[] {
  const customerMatch = value.match(/<customer\b[^>]*>([\s\S]*?)<\/customer>/i);
  const customerContent = customerMatch?.[1];
  if (!customerContent) {
    return [];
  }

  const contactMatch = customerContent.match(/<contact\b[^>]*>([\s\S]*?)<\/contact>/i);
  const contactContent = contactMatch?.[1];
  if (!contactContent) {
    return [];
  }

  const matches = [...contactContent.matchAll(/<phone\b([^>]*)>([\s\S]*?)<\/phone>/gi)];
  return dedupePhoneCandidates(
    matches
      .map((match) => {
        const rawValue = normalizeWhitespace(stripTags(decodeHtmlEntities(match[2] ?? "")));
        const normalizedValue = normalizePhoneNumber(rawValue);
        if (!normalizedValue) {
          return null;
        }

        const rawType =
          match[1]?.match(/\btype=["']([^"']+)["']/i)?.[1]?.trim() ??
          match[1]?.match(/\btime=["']([^"']+)["']/i)?.[1]?.trim() ??
          null;
        const sourceKind = inferXmlPhoneSourceKind(rawType);

        return {
          normalizedValue,
          sourceKind,
          confidenceScore: getPhoneSourceConfidence(sourceKind),
          leadOrder,
          rawType,
        } satisfies PhoneCandidate;
      })
      .filter((candidate): candidate is PhoneCandidate => candidate !== null),
  );
}

function extractFallbackPhoneCandidates(value: string, leadOrder = 0): PhoneCandidate[] {
  return dedupePhoneCandidates(
    (value.match(PHONE_PATTERN) ?? []).map((match) => ({
      normalizedValue: normalizePhoneNumber(match),
      sourceKind: "unscoped_fallback" as const,
      confidenceScore: getPhoneSourceConfidence("unscoped_fallback"),
      leadOrder,
      rawType: null,
    })),
  );
}

function getLeadPrimaryPhoneCandidate(lead: ParsedAdfLead, leadOrder: number): PhoneCandidate | null {
  if (!lead.primaryPhone || !lead.primaryPhoneSource) {
    return null;
  }

  return {
    normalizedValue: normalizePhoneNumber(lead.primaryPhone),
    sourceKind: lead.primaryPhoneSource,
    confidenceScore: getPhoneSourceConfidence(lead.primaryPhoneSource),
    leadOrder,
    rawType: null,
  };
}

function resolvePrimaryPhone(
  leads: ParsedAdfLead[],
): Pick<ParsedAdfLead, "phoneNumbers" | "primaryPhone" | "primaryPhoneSource"> {
  const candidates = leads
    .map((lead, index) => getLeadPrimaryPhoneCandidate(lead, index))
    .filter((candidate): candidate is PhoneCandidate => candidate !== null);
  const winner = selectBestPhoneCandidate(candidates);

  return {
    phoneNumbers: uniqueStrings(leads.flatMap((lead) => lead.phoneNumbers)),
    primaryPhone: winner?.normalizedValue ?? null,
    primaryPhoneSource: winner?.sourceKind ?? null,
  };
}

function sanitizeFileNameSegment(value: string | null | undefined): string {
  const normalized = (value ?? "unknown")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

  return normalized || "unknown";
}

export function normalizeLeadSource(...values: Array<string | null | undefined>): LeadSourceChannel {
  const haystack = values
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack) {
    return "unknown";
  }

  if (haystack.includes("facebook") || haystack.includes("meta")) {
    return "facebook";
  }

  if (haystack.includes("tik tok") || haystack.includes("tiktok")) {
    return "tiktok";
  }

  if (haystack.includes("motomate")) {
    return "motomate";
  }

  if (haystack.includes("coupon")) {
    return "coupon";
  }

  if (
    haystack.includes("website") ||
    haystack.includes("internet up") ||
    haystack.includes("vdp page") ||
    haystack.includes("web")
  ) {
    return "website";
  }

  if (haystack.includes("direct")) {
    return "direct";
  }

  return "other";
}

function splitName(value: string | null): {
  firstName: string | null;
  lastName: string | null;
} {
  const parts = (value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return { firstName: null, lastName: null };
  }

  return {
    firstName: parts[0] ?? null,
    lastName: parts.slice(1).join(" ") || null,
  };
}

function hasSingleTokenName(value: string | null): boolean {
  return (value ?? "").trim().split(/\s+/).filter(Boolean).length <= 1;
}

function buildCustomerName(
  firstName: string | null,
  lastName: string | null,
  fallbackName: string | null,
): string | null {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || fallbackName;
}

function mergeAddressFields(
  lead: ParsedAdfLead,
  snapshot: MatterCustomerSnapshot | null,
): Pick<
  ParsedAdfLead,
  | "customerStreetAddress"
  | "customerCity"
  | "customerState"
  | "customerPostalCode"
  | "customerFullAddress"
> {
  const customerStreetAddress = lead.customerStreetAddress ?? snapshot?.customerStreetAddress ?? null;
  const customerCity = lead.customerCity ?? snapshot?.customerCity ?? null;
  const customerState = lead.customerState ?? snapshot?.customerState ?? null;
  const customerPostalCode = lead.customerPostalCode ?? snapshot?.customerPostalCode ?? null;
  const composedFullAddress =
    [customerStreetAddress, customerCity, [customerState, customerPostalCode].filter(Boolean).join(" ").trim()]
      .filter(Boolean)
      .join(", ") || null;
  const customerFullAddress =
    lead.customerFullAddress ?? composedFullAddress ?? snapshot?.customerFullAddress ?? null;

  return {
    customerStreetAddress,
    customerCity,
    customerState,
    customerPostalCode,
    customerFullAddress,
  };
}

function getTagText(value: string, tagName: string): string | null {
  const match = value.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match?.[1] ? normalizeWhitespace(stripTags(decodeHtmlEntities(match[1]))) : null;
}

function getTagTextWithAttribute(
  value: string,
  tagName: string,
  attributeName: string,
  attributeValue: string,
): string | null {
  const escapedValue = attributeValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = value.match(
    new RegExp(
      `<${tagName}\\b[^>]*${attributeName}=["']${escapedValue}["'][^>]*>([\\s\\S]*?)<\\/${tagName}>`,
      "i",
    ),
  );
  return match?.[1] ? normalizeWhitespace(stripTags(decodeHtmlEntities(match[1]))) : null;
}

function getNestedTagText(
  value: string,
  parentTagName: string,
  childTagName: string,
): string | null {
  const parentMatch = value.match(
    new RegExp(`<${parentTagName}\\b[^>]*>([\\s\\S]*?)<\\/${parentTagName}>`, "i"),
  );
  if (!parentMatch?.[1]) {
    return null;
  }

  return getTagText(parentMatch[1], childTagName);
}

function getIdSourceAttribute(value: string): string | null {
  return value.match(/<id\b[^>]*source=["']([^"']+)["']/i)?.[1] ?? null;
}

function extractHtmlAdfBlock(value: string): string | null {
  return value.match(/<html/i) ? value.trim() : null;
}

function extractXmlAdfBlock(value: string): string | null {
  return value.match(/(?:<\?adf\b|<\?xml\b|<adf\b)/i) ? value.trim() : null;
}

function extractEmail(value: string): string | null {
  return value.match(EMAIL_PATTERN)?.[0]?.trim() ?? null;
}

function extractHtmlLead(rawAdf: string, sourceUrl: string): ParsedAdfLead {
  const decoded = decodeHtmlEntities(rawAdf);
  const plainText = normalizeWhitespace(stripTags(decoded));
  const urls = uniqueStrings(decoded.match(URL_PATTERN) ?? []);
  const phoneCandidates = extractHtmlPhoneCandidates(plainText);
  const primaryPhoneCandidate = selectBestPhoneCandidate(phoneCandidates);
  const phoneNumbers = buildPhoneNumbers(phoneCandidates);
  const taskId = decoded.match(/lTaskID\s*=\s*(\d+)/i)?.[1] ?? null;
  const childId = decoded.match(/ChildId\s*:\s*(\d+)/i)?.[1] ?? null;
  const optOutUrl = urls.find((url) => /optin/i.test(url)) ?? null;
  const customerName = extractGreetingName(plainText);
  const { firstName, lastName } = splitName(customerName);
  const extractedAt = new Date().toISOString();
  const fingerprint = createAdfFingerprint(decoded);
  const automotiveFieldSources = createEmptyAutomotiveFieldSources();

  return {
    fingerprint,
    sourceUrl,
    source: "adf",
    sourceProvider: null,
    pageContext: null,
    rawAdfHtml: decoded,
    rawAdfDocuments: [decoded],
    plainText,
    customerName,
    customerFirstName: firstName,
    customerLastName: lastName,
    customerEmail: extractEmail(decoded),
    customerStreetAddress: null,
    customerCity: null,
    customerState: null,
    customerPostalCode: null,
    customerFullAddress: null,
    dealerName: extractDealerName(plainText),
    dealershipWebsite: urls[0] ?? null,
    phoneNumbers,
    primaryPhone: primaryPhoneCandidate?.normalizedValue ?? null,
    primaryPhoneSource: primaryPhoneCandidate?.sourceKind ?? null,
    vehicleYear: null,
    vehicleMake: null,
    vehicleModel: null,
    vehicleTrim: null,
    vehicleVin: null,
    vehicleInterest: null,
    vehicleStatus: null,
    providerLeadType: null,
    isPrequalLead: null,
    prequalStatus: null,
    prequalifiedAmount: null,
    campaignCode: null,
    vehicleSummary: null,
    comments: null,
    requestDate: null,
    optOutUrl,
    taskId,
    childId,
    latestInquirySourceRaw: null,
    latestInquirySubSourceRaw: null,
    latestInquiryUpType: null,
    latestInquiryNormalizedSource: "unknown",
    inquiryHistory: [
      {
        eventId: fingerprint,
        sourceRaw: null,
        subSourceRaw: null,
        upType: null,
        normalizedSource: "unknown",
        provider: null,
        sourceUrl,
        requestDate: null,
        importedAt: extractedAt,
        rawAdfFingerprint: fingerprint,
        rawAdfDocument: decoded,
        taskId,
        childId,
      },
    ],
    matterTimeline: [],
    adfArtifacts: buildAdfArtifactsFromInquiryHistory([
      {
        eventId: fingerprint,
        sourceRaw: null,
        subSourceRaw: null,
        upType: null,
        normalizedSource: "unknown",
        provider: null,
        sourceUrl,
        requestDate: null,
        importedAt: extractedAt,
        rawAdfFingerprint: fingerprint,
        rawAdfDocument: decoded,
        taskId,
        childId,
      },
    ]),
    matterCustomerSnapshot: null,
    automotiveFieldSources,
    parsingWarnings: [],
    extractedAt,
  };
}

function extractXmlLead(rawAdf: string, sourceUrl: string): ParsedAdfLead {
  const decoded = decodeHtmlEntities(rawAdf);
  const plainText = normalizeWhitespace(stripTags(decoded));
  const xmlPhoneCandidates = extractXmlCustomerPhoneCandidates(decoded);
  const phoneCandidates =
    xmlPhoneCandidates.length > 0 ? xmlPhoneCandidates : extractFallbackPhoneCandidates(decoded);
  const primaryPhoneCandidate = selectBestPhoneCandidate(phoneCandidates);
  const phoneNumbers = buildPhoneNumbers(phoneCandidates);
  const firstName =
    getTagTextWithAttribute(decoded, "name", "part", "first") ??
    getTagText(decoded, "given");
  const lastName =
    getTagTextWithAttribute(decoded, "name", "part", "last") ??
    getTagText(decoded, "family");
  const customerName = [firstName, lastName].filter(Boolean).join(" ").trim() || null;
  const providerName =
    getNestedTagText(decoded, "provider", "name") ??
    getIdSourceAttribute(decoded) ??
    getTagText(decoded, "service");
  const providerService =
    getNestedTagText(decoded, "provider", "service") ?? getTagText(decoded, "service");
  const providerLeadType =
    getNestedTagText(decoded, "provider", "leadtype") ?? getTagText(decoded, "leadtype");
  const extractedAt = new Date().toISOString();
  const fingerprint = createAdfFingerprint(decoded);
  const requestDate = getTagText(decoded, "requestdate");
  const taskId = getTagText(decoded, "id");
  const comments = getTagText(decoded, "comments");
  const commentAutomotive = extractAutomotiveDetailsFromComments(comments || decoded);
  const automotiveFieldSources = createEmptyAutomotiveFieldSources();
  const customerStreetAddress = getNestedTagText(decoded, "address", "street");
  const customerCity = getNestedTagText(decoded, "address", "city");
  const customerState = getNestedTagText(decoded, "address", "regioncode");
  const customerPostalCode = getNestedTagText(decoded, "address", "postalcode");
  const vehicleYear =
    normalizeVehicleYear(getNestedTagText(decoded, "vehicle", "year"), commentAutomotive.warnings) ??
    commentAutomotive.vehicleYear;
  const vehicleMake = getNestedTagText(decoded, "vehicle", "make");
  const vehicleModel = getNestedTagText(decoded, "vehicle", "model") ?? commentAutomotive.vehicleModel;
  const vehicleTrim = getNestedTagText(decoded, "vehicle", "trim");
  const vehicleVin =
    normalizeVin(getNestedTagText(decoded, "vehicle", "vin"), commentAutomotive.warnings) ??
    commentAutomotive.vehicleVin ??
    normalizeVin(findFallbackVin(decoded), commentAutomotive.warnings);
  const vehicleInterest = getTagAttribute(decoded, "vehicle", "interest");
  const vehicleStatus = getTagAttribute(decoded, "vehicle", "status");
  const prequalStatus = commentAutomotive.prequalStatus;
  const prequalifiedAmount = commentAutomotive.prequalifiedAmount;
  const campaignCode = commentAutomotive.campaignCode;
  const isPrequalLead = inferIsPrequalLead(prequalStatus, providerService, providerLeadType, comments);
  const vehicleSummary = buildVehicleSummary(vehicleYear, vehicleMake, vehicleModel, vehicleVin);

  if (vehicleYear !== null) {
    markAutomotiveSource(automotiveFieldSources, "vehicleYear", getNestedTagText(decoded, "vehicle", "year") ? "xml" : "comment");
  }
  if (vehicleMake) {
    markAutomotiveSource(automotiveFieldSources, "vehicleMake", "xml");
  }
  if (vehicleModel) {
    markAutomotiveSource(
      automotiveFieldSources,
      "vehicleModel",
      getNestedTagText(decoded, "vehicle", "model") ? "xml" : "comment",
    );
  }
  if (vehicleTrim) {
    markAutomotiveSource(automotiveFieldSources, "vehicleTrim", "xml");
  }
  if (vehicleVin) {
    markAutomotiveSource(
      automotiveFieldSources,
      "vehicleVin",
      getNestedTagText(decoded, "vehicle", "vin") ? "xml" : "comment",
    );
  }
  if (vehicleInterest) {
    markAutomotiveSource(automotiveFieldSources, "vehicleInterest", "xml");
  }
  if (vehicleStatus) {
    markAutomotiveSource(automotiveFieldSources, "vehicleStatus", "xml");
  }
  if (providerLeadType) {
    markAutomotiveSource(automotiveFieldSources, "providerLeadType", "xml");
  }
  if (prequalStatus) {
    markAutomotiveSource(automotiveFieldSources, "prequalStatus", "comment");
  }
  if (prequalifiedAmount !== null) {
    markAutomotiveSource(automotiveFieldSources, "prequalifiedAmount", "comment");
  }
  if (isPrequalLead !== null) {
    markAutomotiveSource(automotiveFieldSources, "isPrequalLead", "comment");
  }
  if (campaignCode) {
    markAutomotiveSource(automotiveFieldSources, "campaignCode", "comment");
  }
  if (vehicleSummary) {
    markAutomotiveSource(automotiveFieldSources, "vehicleSummary", "merged");
  }
  const customerFullAddress =
    [
      customerStreetAddress,
      customerCity,
      [customerState, customerPostalCode].filter(Boolean).join(" ").trim(),
    ]
      .filter(Boolean)
      .join(", ") || null;

  return {
    fingerprint,
    sourceUrl,
    source: "adf",
    sourceProvider: providerName,
    pageContext: null,
    rawAdfHtml: decoded,
    rawAdfDocuments: [decoded],
    plainText,
    customerName,
    customerFirstName: firstName,
    customerLastName: lastName,
    customerEmail: getTagText(decoded, "email"),
    customerStreetAddress,
    customerCity,
    customerState,
    customerPostalCode,
    customerFullAddress,
    dealerName: getTagText(decoded, "vendorname"),
    dealershipWebsite: getTagText(decoded, "url"),
    phoneNumbers,
    primaryPhone: primaryPhoneCandidate?.normalizedValue ?? null,
    primaryPhoneSource: primaryPhoneCandidate?.sourceKind ?? null,
    vehicleYear,
    vehicleMake,
    vehicleModel,
    vehicleTrim,
    vehicleVin,
    vehicleInterest,
    vehicleStatus,
    providerLeadType,
    isPrequalLead,
    prequalStatus,
    prequalifiedAmount,
    campaignCode,
    vehicleSummary,
    comments,
    requestDate,
    optOutUrl: null,
    taskId,
    childId: null,
    latestInquirySourceRaw: providerName,
    latestInquirySubSourceRaw: providerService,
    latestInquiryUpType: null,
    latestInquiryNormalizedSource: normalizeLeadSource(providerName, providerService),
    inquiryHistory: [
      {
        eventId: fingerprint,
        sourceRaw: providerName,
        subSourceRaw: providerService,
        upType: null,
        normalizedSource: normalizeLeadSource(providerName, providerService),
        provider: providerName,
        sourceUrl,
        requestDate,
        importedAt: extractedAt,
        rawAdfFingerprint: fingerprint,
        rawAdfDocument: decoded,
        taskId,
        childId: null,
      },
    ],
    matterTimeline: [],
    adfArtifacts: buildAdfArtifactsFromInquiryHistory([
      {
        eventId: fingerprint,
        sourceRaw: providerName,
        subSourceRaw: providerService,
        upType: null,
        normalizedSource: normalizeLeadSource(providerName, providerService),
        provider: providerName,
        sourceUrl,
        requestDate,
        importedAt: extractedAt,
        rawAdfFingerprint: fingerprint,
        rawAdfDocument: decoded,
        taskId,
        childId: null,
      },
    ]),
    matterCustomerSnapshot: null,
    automotiveFieldSources,
    parsingWarnings: commentAutomotive.warnings,
    extractedAt,
  };
}

function mergeTextValues(...values: Array<string | null>): string | null {
  for (const value of values) {
    if (value?.trim()) {
      return value.trim();
    }
  }
  return null;
}

function mergeNumberValues(...values: Array<number | null>): number | null {
  for (const value of values) {
    if (value !== null && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function mergeBooleanValues(...values: Array<boolean | null>): boolean | null {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }
  }
  return null;
}

function buildMergedAutomotiveFieldSources(lead: ParsedAdfLead): AutomotiveFieldSources {
  return {
    vehicleYear: lead.vehicleYear !== null ? "merged" : null,
    vehicleMake: lead.vehicleMake ? "merged" : null,
    vehicleModel: lead.vehicleModel ? "merged" : null,
    vehicleTrim: lead.vehicleTrim ? "merged" : null,
    vehicleVin: lead.vehicleVin ? "merged" : null,
    vehicleInterest: lead.vehicleInterest ? "merged" : null,
    vehicleStatus: lead.vehicleStatus ? "merged" : null,
    providerLeadType: lead.providerLeadType ? "merged" : null,
    isPrequalLead: lead.isPrequalLead !== null ? "merged" : null,
    prequalStatus: lead.prequalStatus ? "merged" : null,
    prequalifiedAmount: lead.prequalifiedAmount !== null ? "merged" : null,
    campaignCode: lead.campaignCode ? "merged" : null,
    vehicleSummary: lead.vehicleSummary ? "merged" : null,
  };
}

function combineRawAdfs(leads: ParsedAdfLead[]): string {
  return leads
    .map((lead, index) => {
      const title = lead.sourceProvider
        ? `ADF ${index + 1} (${lead.sourceProvider})`
        : `ADF ${index + 1}`;
      return `<!-- ${title} -->\n${lead.rawAdfHtml}`;
    })
    .join("\n\n");
}

function combinePlainText(leads: ParsedAdfLead[]): string {
  return leads
    .map((lead) => lead.plainText.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function buildInquiryHistory(
  leads: ParsedAdfLead[],
  sourceUrl: string,
  pageContext: LeadPageContext | null,
  importedAt: string,
): InquiryHistoryEntry[] {
  return mergeUniqueHistory(
    leads.flatMap((lead) =>
      lead.rawAdfDocuments.map((document, index) => ({
        eventId: `${lead.fingerprint}_${index + 1}`,
        sourceRaw: pageContext?.rawSource ?? lead.latestInquirySourceRaw ?? lead.sourceProvider ?? null,
        subSourceRaw: pageContext?.rawSubSource ?? lead.latestInquirySubSourceRaw ?? null,
        upType: pageContext?.rawUpType ?? lead.latestInquiryUpType ?? null,
        normalizedSource: normalizeLeadSource(
          pageContext?.rawSource,
          pageContext?.rawSubSource,
          lead.latestInquirySourceRaw,
          lead.latestInquirySubSourceRaw,
          lead.sourceProvider,
          lead.comments,
        ),
        provider: lead.sourceProvider,
        sourceUrl,
        requestDate: lead.requestDate,
        importedAt,
        rawAdfFingerprint: lead.fingerprint,
        rawAdfDocument: document,
        taskId: lead.taskId,
        childId: lead.childId,
      })),
    ),
  );
}

function buildAdfArtifactsFromInquiryHistory(
  inquiryHistory: InquiryHistoryEntry[],
  matterTimeline: MatterActivityEntry[] = [],
): AdfArtifact[] {
  return dedupeArtifacts(
    inquiryHistory.map((entry, index) => {
      const matchingTimeline = matterTimeline.find((timelineEntry) => timelineEntry.taskId === entry.taskId);
      const completedAt = matchingTimeline?.completedAt ?? null;
      const fileName = [
        completedAt ? sanitizeFileNameSegment(completedAt) : "undated",
        entry.taskId ? `task_${sanitizeFileNameSegment(entry.taskId)}` : `adf_${index + 1}`,
        sanitizeFileNameSegment(entry.sourceRaw ?? entry.provider ?? "lead"),
      ].join("_");

      return {
        fileName: `${fileName}.adf.xml`,
        contentType: "text/xml",
        content: entry.rawAdfDocument,
        sourceUrl: entry.sourceUrl,
        taskId: entry.taskId,
        completedAt,
      };
    }),
  );
}

export function createAdfFingerprint(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return `adf_${(hash >>> 0).toString(36)}`;
}

export function extractAdfBlocks(value: string): string[] {
  const decoded = decodeHtmlEntities(value);
  const matches = [
    ...(decoded.match(HTML_ADF_BLOCK_PATTERN) ?? []),
    ...(decoded.match(XML_ADF_BLOCK_PATTERN) ?? []),
  ].map((match) => match.trim());

  return uniqueStrings(matches);
}

export function detectAdfInText(value: string): AdfDetectionState {
  const rawAdfs = extractAdfBlocks(value);

  if (rawAdfs.length === 0) {
    return {
      found: false,
      rawAdfs: [],
      fingerprint: null,
      preview: null,
    };
  }

  const preview =
    normalizeWhitespace(stripTags(rawAdfs.map((rawAdf) => `\n${rawAdf}`).join("\n\n"))).slice(0, 180) ||
    null;
  const fingerprint = createAdfFingerprint(rawAdfs.join("\n---ADF---\n"));

  return {
    found: true,
    rawAdfs,
    fingerprint,
    preview,
  };
}

export function parseAdfLeadDocument(rawAdf: string, sourceUrl: string): ParsedAdfLead {
  const htmlBlock = extractHtmlAdfBlock(rawAdf);
  if (htmlBlock) {
    return extractHtmlLead(htmlBlock, sourceUrl);
  }

  const xmlBlock = extractXmlAdfBlock(rawAdf);
  if (xmlBlock) {
    return extractXmlLead(xmlBlock, sourceUrl);
  }

  return extractHtmlLead(rawAdf, sourceUrl);
}

export function mergeParsedAdfLeads(
  leads: ParsedAdfLead[],
  sourceUrl: string,
  pageContext: LeadPageContext | null = null,
): ParsedAdfLead {
  if (leads.length === 0) {
    throw new Error("At least one parsed ADF lead is required.");
  }

  const extractedAt = new Date().toISOString();
  const primaryPhoneState = resolvePrimaryPhone(leads);
  const customerFirstName = mergeTextValues(...leads.map((lead) => lead.customerFirstName));
  const customerLastName = mergeTextValues(...leads.map((lead) => lead.customerLastName));
  const customerName =
    [customerFirstName, customerLastName].filter(Boolean).join(" ").trim() ||
    mergeTextValues(...leads.map((lead) => lead.customerName));
  const rawAdfDocuments = leads.flatMap((lead) => lead.rawAdfDocuments);
  const inquiryHistory = buildInquiryHistory(leads, sourceUrl, pageContext, extractedAt);
  const latestInquirySourceRaw =
    pageContext?.rawSource ?? mergeTextValues(...inquiryHistory.map((entry) => entry.sourceRaw));
  const latestInquirySubSourceRaw =
    pageContext?.rawSubSource ?? mergeTextValues(...inquiryHistory.map((entry) => entry.subSourceRaw));
  const latestInquiryUpType =
    pageContext?.rawUpType ?? mergeTextValues(...inquiryHistory.map((entry) => entry.upType));
  const latestInquiryNormalizedSource = pageContext?.normalizedSource
    ? pageContext.normalizedSource
    : normalizeLeadSource(latestInquirySourceRaw, latestInquirySubSourceRaw, latestInquiryUpType);
  const vehicleYear = mergeNumberValues(...leads.map((lead) => lead.vehicleYear));
  const vehicleMake = mergeTextValues(...leads.map((lead) => lead.vehicleMake));
  const vehicleModel = mergeTextValues(...leads.map((lead) => lead.vehicleModel));
  const vehicleTrim = mergeTextValues(...leads.map((lead) => lead.vehicleTrim));
  const vehicleVin = mergeTextValues(...leads.map((lead) => lead.vehicleVin));
  const vehicleInterest = mergeTextValues(...leads.map((lead) => lead.vehicleInterest));
  const vehicleStatus = mergeTextValues(...leads.map((lead) => lead.vehicleStatus));
  const providerLeadType = mergeTextValues(...leads.map((lead) => lead.providerLeadType));
  const prequalStatus = mergeTextValues(...leads.map((lead) => lead.prequalStatus));
  const prequalifiedAmount = mergeNumberValues(...leads.map((lead) => lead.prequalifiedAmount));
  const isPrequalLead = mergeBooleanValues(...leads.map((lead) => lead.isPrequalLead));
  const campaignCode = mergeTextValues(...leads.map((lead) => lead.campaignCode));
  const vehicleSummary =
    buildVehicleSummary(vehicleYear, vehicleMake, vehicleModel, vehicleVin) ??
    mergeTextValues(...leads.map((lead) => lead.vehicleSummary));

  const mergedLead: ParsedAdfLead = {
    fingerprint: createAdfFingerprint(leads.map((lead) => lead.fingerprint).join("|")),
    sourceUrl,
    source: "adf",
    sourceProvider: mergeTextValues(...leads.map((lead) => lead.sourceProvider)),
    pageContext,
    rawAdfHtml: combineRawAdfs(leads),
    rawAdfDocuments,
    plainText: combinePlainText(leads),
    customerName,
    customerFirstName,
    customerLastName,
    customerEmail: mergeTextValues(...leads.map((lead) => lead.customerEmail)),
    customerStreetAddress: mergeTextValues(...leads.map((lead) => lead.customerStreetAddress)),
    customerCity: mergeTextValues(...leads.map((lead) => lead.customerCity)),
    customerState: mergeTextValues(...leads.map((lead) => lead.customerState)),
    customerPostalCode: mergeTextValues(...leads.map((lead) => lead.customerPostalCode)),
    customerFullAddress: mergeTextValues(...leads.map((lead) => lead.customerFullAddress)),
    dealerName: mergeTextValues(...leads.map((lead) => lead.dealerName)),
    dealershipWebsite: mergeTextValues(...leads.map((lead) => lead.dealershipWebsite)),
    phoneNumbers: primaryPhoneState.phoneNumbers,
    primaryPhone: primaryPhoneState.primaryPhone,
    primaryPhoneSource: primaryPhoneState.primaryPhoneSource,
    vehicleYear,
    vehicleMake,
    vehicleModel,
    vehicleTrim,
    vehicleVin,
    vehicleInterest,
    vehicleStatus,
    providerLeadType,
    isPrequalLead,
    prequalStatus,
    prequalifiedAmount,
    campaignCode,
    vehicleSummary,
    comments: mergeTextValues(...leads.map((lead) => lead.comments)),
    requestDate: mergeTextValues(...leads.map((lead) => lead.requestDate)),
    optOutUrl: mergeTextValues(...leads.map((lead) => lead.optOutUrl)),
    taskId: mergeTextValues(...leads.map((lead) => lead.taskId)),
    childId: mergeTextValues(...leads.map((lead) => lead.childId)),
    latestInquirySourceRaw,
    latestInquirySubSourceRaw,
    latestInquiryUpType,
    latestInquiryNormalizedSource,
    inquiryHistory,
    matterTimeline: [],
    adfArtifacts: buildAdfArtifactsFromInquiryHistory(inquiryHistory),
    matterCustomerSnapshot: null,
    automotiveFieldSources: createEmptyAutomotiveFieldSources(),
    parsingWarnings: uniqueStrings(leads.flatMap((lead) => lead.parsingWarnings)),
    extractedAt,
  };

  return {
    ...mergedLead,
    automotiveFieldSources: buildMergedAutomotiveFieldSources(mergedLead),
  };
}

export function applyMatterCustomerSnapshot(
  lead: ParsedAdfLead,
  snapshot: MatterCustomerSnapshot | null = null,
): ParsedAdfLead {
  if (!snapshot) {
    return lead;
  }

  const mergedFirstName = lead.customerFirstName ?? snapshot.customerFirstName ?? null;
  const mergedLastName = lead.customerLastName ?? snapshot.customerLastName ?? null;
  const normalizedSnapshotPhone = snapshot.customerPhone ? normalizePhoneNumber(snapshot.customerPhone) : null;
  const snapshotCandidate =
    normalizedSnapshotPhone && (lead.primaryPhone === null || isLowConfidencePhoneSource(lead.primaryPhoneSource))
      ? {
          normalizedValue: normalizedSnapshotPhone,
          sourceKind: "matter_snapshot" as const,
          confidenceScore: getPhoneSourceConfidence("matter_snapshot"),
          leadOrder: 1,
          rawType: null,
        }
      : null;
  const existingCandidate = getLeadPrimaryPhoneCandidate(lead, 0);
  const mergedPhoneCandidate = selectBestPhoneCandidate(
    [existingCandidate, snapshotCandidate].filter((candidate): candidate is PhoneCandidate => candidate !== null),
  );
  const mergedPhone = mergedPhoneCandidate?.normalizedValue ?? null;
  const mergedPhoneNumbers = uniqueStrings([
    ...lead.phoneNumbers,
    ...(normalizedSnapshotPhone ? [normalizedSnapshotPhone] : []),
  ]);
  const shouldUpgradeName =
    (!lead.customerLastName && !!snapshot.customerLastName) ||
    (hasSingleTokenName(lead.customerName) &&
      !!snapshot.customerName &&
      (!lead.customerFirstName || lead.customerFirstName === snapshot.customerFirstName));
  const mergedCustomerName = shouldUpgradeName
    ? buildCustomerName(mergedFirstName, mergedLastName, snapshot.customerName ?? lead.customerName)
    : buildCustomerName(lead.customerFirstName, lead.customerLastName, lead.customerName);

  return {
    ...lead,
    customerName: mergedCustomerName,
    customerFirstName: mergedFirstName,
    customerLastName: mergedLastName,
    customerEmail: lead.customerEmail ?? snapshot.customerEmail ?? null,
    primaryPhone: mergedPhone,
    primaryPhoneSource: mergedPhoneCandidate?.sourceKind ?? lead.primaryPhoneSource,
    phoneNumbers: mergedPhoneNumbers,
    ...mergeAddressFields(lead, snapshot),
    matterCustomerSnapshot: snapshot,
  };
}

export function mergeImportedLeads(
  leads: ParsedAdfLead[],
  sourceUrl: string,
  matterTimeline: MatterActivityEntry[] = [],
  matterCustomerSnapshot: MatterCustomerSnapshot | null = null,
): ParsedAdfLead {
  if (leads.length === 0) {
    throw new Error("At least one parsed ADF lead is required.");
  }

  const extractedAt = new Date().toISOString();
  const newestFirstLeads = [...leads].reverse();
  const primaryPhoneState = resolvePrimaryPhone(leads);
  const customerFirstName = mergeTextValues(...newestFirstLeads.map((lead) => lead.customerFirstName));
  const customerLastName = mergeTextValues(...newestFirstLeads.map((lead) => lead.customerLastName));
  const customerName =
    [customerFirstName, customerLastName].filter(Boolean).join(" ").trim() ||
    mergeTextValues(...newestFirstLeads.map((lead) => lead.customerName));
  const inquiryHistory = mergeUniqueHistory(leads.flatMap((lead) => lead.inquiryHistory));
  const mergedMatterTimeline = dedupeMatterTimeline(matterTimeline);
  const latestLead = newestFirstLeads[0];
  const vehicleYear = mergeNumberValues(...newestFirstLeads.map((lead) => lead.vehicleYear));
  const vehicleMake = mergeTextValues(...newestFirstLeads.map((lead) => lead.vehicleMake));
  const vehicleModel = mergeTextValues(...newestFirstLeads.map((lead) => lead.vehicleModel));
  const vehicleTrim = mergeTextValues(...newestFirstLeads.map((lead) => lead.vehicleTrim));
  const vehicleVin = mergeTextValues(...newestFirstLeads.map((lead) => lead.vehicleVin));
  const vehicleInterest = mergeTextValues(...newestFirstLeads.map((lead) => lead.vehicleInterest));
  const vehicleStatus = mergeTextValues(...newestFirstLeads.map((lead) => lead.vehicleStatus));
  const providerLeadType = mergeTextValues(...newestFirstLeads.map((lead) => lead.providerLeadType));
  const isPrequalLead = mergeBooleanValues(...newestFirstLeads.map((lead) => lead.isPrequalLead));
  const prequalStatus = mergeTextValues(...newestFirstLeads.map((lead) => lead.prequalStatus));
  const prequalifiedAmount = mergeNumberValues(...newestFirstLeads.map((lead) => lead.prequalifiedAmount));
  const campaignCode = mergeTextValues(...newestFirstLeads.map((lead) => lead.campaignCode));
  const vehicleSummary =
    buildVehicleSummary(vehicleYear, vehicleMake, vehicleModel, vehicleVin) ??
    mergeTextValues(...newestFirstLeads.map((lead) => lead.vehicleSummary));

  const mergedLead: ParsedAdfLead = {
    fingerprint: createAdfFingerprint(leads.map((lead) => lead.fingerprint).join("|")),
    sourceUrl,
    source: "adf",
    sourceProvider: mergeTextValues(...newestFirstLeads.map((lead) => lead.sourceProvider)),
    pageContext: latestLead?.pageContext ?? null,
    rawAdfHtml: combineRawAdfs(leads),
    rawAdfDocuments: leads.flatMap((lead) => lead.rawAdfDocuments),
    plainText: combinePlainText(leads),
    customerName,
    customerFirstName,
    customerLastName,
    customerEmail: mergeTextValues(...newestFirstLeads.map((lead) => lead.customerEmail)),
    customerStreetAddress: mergeTextValues(...newestFirstLeads.map((lead) => lead.customerStreetAddress)),
    customerCity: mergeTextValues(...newestFirstLeads.map((lead) => lead.customerCity)),
    customerState: mergeTextValues(...newestFirstLeads.map((lead) => lead.customerState)),
    customerPostalCode: mergeTextValues(...newestFirstLeads.map((lead) => lead.customerPostalCode)),
    customerFullAddress: mergeTextValues(...newestFirstLeads.map((lead) => lead.customerFullAddress)),
    dealerName: mergeTextValues(...newestFirstLeads.map((lead) => lead.dealerName)),
    dealershipWebsite: mergeTextValues(...newestFirstLeads.map((lead) => lead.dealershipWebsite)),
    phoneNumbers: primaryPhoneState.phoneNumbers,
    primaryPhone: primaryPhoneState.primaryPhone,
    primaryPhoneSource: primaryPhoneState.primaryPhoneSource,
    vehicleYear,
    vehicleMake,
    vehicleModel,
    vehicleTrim,
    vehicleVin,
    vehicleInterest,
    vehicleStatus,
    providerLeadType,
    isPrequalLead,
    prequalStatus,
    prequalifiedAmount,
    campaignCode,
    vehicleSummary,
    comments: mergeTextValues(...newestFirstLeads.map((lead) => lead.comments)),
    requestDate:
      mergeTextValues(...newestFirstLeads.map((lead) => lead.requestDate)) ??
      latestLead?.requestDate ??
      null,
    optOutUrl: mergeTextValues(...newestFirstLeads.map((lead) => lead.optOutUrl)),
    taskId: latestLead?.taskId ?? mergeTextValues(...newestFirstLeads.map((lead) => lead.taskId)),
    childId: mergeTextValues(...newestFirstLeads.map((lead) => lead.childId)),
    latestInquirySourceRaw:
      latestLead?.latestInquirySourceRaw ??
      mergeTextValues(...newestFirstLeads.map((lead) => lead.latestInquirySourceRaw)),
    latestInquirySubSourceRaw:
      latestLead?.latestInquirySubSourceRaw ??
      mergeTextValues(...newestFirstLeads.map((lead) => lead.latestInquirySubSourceRaw)),
    latestInquiryUpType:
      latestLead?.latestInquiryUpType ??
      mergeTextValues(...newestFirstLeads.map((lead) => lead.latestInquiryUpType)),
    latestInquiryNormalizedSource:
      latestLead?.latestInquiryNormalizedSource ??
      normalizeLeadSource(
        mergeTextValues(...newestFirstLeads.map((lead) => lead.latestInquirySourceRaw)),
        mergeTextValues(...newestFirstLeads.map((lead) => lead.latestInquirySubSourceRaw)),
      ),
    inquiryHistory,
    matterTimeline: mergedMatterTimeline,
    adfArtifacts: buildAdfArtifactsFromInquiryHistory(inquiryHistory, mergedMatterTimeline),
    matterCustomerSnapshot: matterCustomerSnapshot ?? null,
    automotiveFieldSources: createEmptyAutomotiveFieldSources(),
    parsingWarnings: uniqueStrings(newestFirstLeads.flatMap((lead) => lead.parsingWarnings)),
    extractedAt,
  };

  const mergedWithSnapshot = applyMatterCustomerSnapshot(mergedLead, matterCustomerSnapshot);
  return {
    ...mergedWithSnapshot,
    automotiveFieldSources: buildMergedAutomotiveFieldSources(mergedWithSnapshot),
  };
}

export function parseAdfLead(
  rawAdf: string,
  sourceUrl: string,
  pageContext: LeadPageContext | null = null,
): ParsedAdfLead {
  const documents = extractAdfBlocks(rawAdf);
  const parsed = (documents.length > 0 ? documents : [rawAdf]).map((document) =>
    parseAdfLeadDocument(document, sourceUrl),
  );
  return mergeParsedAdfLeads(parsed, sourceUrl, pageContext);
}
