export interface LeadIndicatorDetection {
  url: string;
  title: string;
  count: number;
  text: string;
  seenAt: string;
}

export type LeadSourceChannel =
  | "facebook"
  | "tiktok"
  | "website"
  | "motomate"
  | "coupon"
  | "direct"
  | "other"
  | "unknown";

export interface LeadPageContext {
  rawSource: string | null;
  rawSubSource: string | null;
  rawUpType: string | null;
  normalizedSource: LeadSourceChannel;
}

export interface InquiryHistoryEntry {
  eventId: string;
  sourceRaw: string | null;
  subSourceRaw: string | null;
  upType: string | null;
  normalizedSource: LeadSourceChannel;
  provider: string | null;
  sourceUrl: string;
  requestDate: string | null;
  importedAt: string;
  rawAdfFingerprint: string;
  rawAdfDocument: string;
  taskId: string | null;
  childId: string | null;
}

export interface MatterActivityEntry {
  eventId: string;
  sourceUrl: string;
  title: string | null;
  taskId: string | null;
  completedAt: string | null;
  activityType: string | null;
  outcome: string | null;
  comment: string | null;
  completedBy: string | null;
  sourceRaw: string | null;
  subSourceRaw: string | null;
  hasAdf: boolean;
}

export interface AdfArtifact {
  fileName: string;
  contentType: string;
  content: string;
  sourceUrl: string;
  taskId: string | null;
  completedAt: string | null;
}

export interface MatterCustomerSnapshot {
  customerName: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerStreetAddress: string | null;
  customerCity: string | null;
  customerState: string | null;
  customerPostalCode: string | null;
  customerFullAddress: string | null;
}

export interface MatterHistoryImportItem {
  sourceUrl: string;
  title: string | null;
  taskId: string | null;
  completedAt: string | null;
  activityType: string | null;
  outcome: string | null;
  comment: string | null;
  completedBy: string | null;
  pageContext: LeadPageContext | null;
  rawAdfs: string[];
}

export type ParsedValueSource = "xml" | "comment" | "matterSnapshot" | "merged";
export type PhoneSourceKind =
  | "xml_customer_mobile"
  | "xml_customer_other"
  | "html_contextual"
  | "html_generic"
  | "unscoped_fallback"
  | "matter_snapshot";

export interface AutomotiveFieldSources {
  vehicleYear: ParsedValueSource | null;
  vehicleMake: ParsedValueSource | null;
  vehicleModel: ParsedValueSource | null;
  vehicleTrim: ParsedValueSource | null;
  vehicleVin: ParsedValueSource | null;
  vehicleInterest: ParsedValueSource | null;
  vehicleStatus: ParsedValueSource | null;
  providerLeadType: ParsedValueSource | null;
  isPrequalLead: ParsedValueSource | null;
  prequalStatus: ParsedValueSource | null;
  prequalifiedAmount: ParsedValueSource | null;
  campaignCode: ParsedValueSource | null;
  vehicleSummary: ParsedValueSource | null;
}

export interface ParsedAdfLead {
  fingerprint: string;
  sourceUrl: string;
  source: "adf";
  sourceProvider: string | null;
  pageContext: LeadPageContext | null;
  rawAdfHtml: string;
  rawAdfDocuments: string[];
  plainText: string;
  customerName: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  customerStreetAddress: string | null;
  customerCity: string | null;
  customerState: string | null;
  customerPostalCode: string | null;
  customerFullAddress: string | null;
  dealerName: string | null;
  dealershipWebsite: string | null;
  phoneNumbers: string[];
  primaryPhone: string | null;
  primaryPhoneSource: PhoneSourceKind | null;
  vehicleYear: number | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleTrim: string | null;
  vehicleVin: string | null;
  vehicleInterest: string | null;
  vehicleStatus: string | null;
  providerLeadType: string | null;
  isPrequalLead: boolean | null;
  prequalStatus: string | null;
  prequalifiedAmount: number | null;
  campaignCode: string | null;
  vehicleSummary: string | null;
  comments: string | null;
  requestDate: string | null;
  optOutUrl: string | null;
  taskId: string | null;
  childId: string | null;
  latestInquirySourceRaw: string | null;
  latestInquirySubSourceRaw: string | null;
  latestInquiryUpType: string | null;
  latestInquiryNormalizedSource: LeadSourceChannel;
  inquiryHistory: InquiryHistoryEntry[];
  matterTimeline: MatterActivityEntry[];
  adfArtifacts: AdfArtifact[];
  matterCustomerSnapshot: MatterCustomerSnapshot | null;
  automotiveFieldSources: AutomotiveFieldSources;
  parsingWarnings: string[];
  extractedAt: string;
}

export interface AdfDetectionState {
  found: boolean;
  rawAdfs: string[];
  fingerprint: string | null;
  preview: string | null;
}

export interface TwentyLeadImportResult {
  ok: boolean;
  message: string;
  recordId?: string;
  payload?: Record<string, unknown>;
  parsedLead?: ParsedAdfLead;
}
