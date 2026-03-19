import { createAdfFingerprint } from "@shared/adf";
import type {
  AdfArtifact,
  InquiryHistoryEntry,
  LeadSourceChannel,
  MatterCustomerSnapshot,
  MatterActivityEntry,
  ParsedAdfLead,
  TwentyLeadImportResult,
} from "@shared/lead";
import type { ExtensionSettings } from "@shared/settings";

interface TwentyInboundLeadRecord {
  id: string;
  name?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  customerPhone?: string;
  vendorName?: string;
  externalId?: string;
  externalSource?: string;
  externalLink?: string;
  payloadRaw?: {
    markdown?: string;
    blocknote?: string | null;
  };
}

interface PersistedAnalyticsState {
  latestInquirySourceRaw: string | null;
  latestInquirySubSourceRaw: string | null;
  latestInquiryUpType: string | null;
  latestInquiryNormalizedSource: LeadSourceChannel;
  latestProvider: string | null;
  latestInquiryAt: string | null;
  primaryPhoneSource: ParsedAdfLead["primaryPhoneSource"];
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
  history: InquiryHistoryEntry[];
  matterTimeline: MatterActivityEntry[];
  adfArtifacts: AdfArtifact[];
  matterCustomerSnapshot: MatterCustomerSnapshot | null;
  automotiveFieldSources: ParsedAdfLead["automotiveFieldSources"];
  parsingWarnings: string[];
  /** Fingerprints of ADF bodies already uploaded as Twenty attachment files (dedupe on re-sync). */
  uploadedAdfFileKeys: string[];
}

const ANALYTICS_START_MARKER = "<!-- FIREFOX_AUTOMATION_ANALYTICS_START -->";
const ANALYTICS_END_MARKER = "<!-- FIREFOX_AUTOMATION_ANALYTICS_END -->";
const RAW_ADF_START_MARKER = "<!-- FIREFOX_AUTOMATION_RAW_ADF_START -->";
const RAW_ADF_END_MARKER = "<!-- FIREFOX_AUTOMATION_RAW_ADF_END -->";
const RAW_ADF_SEPARATOR = "\n\n<!-- FIREFOX_AUTOMATION_ADF_SEPARATOR -->\n\n";

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function normalizeEndpointPath(value: string): string {
  const trimmed = value.trim().replace(/^\/+/, "");
  return trimmed || "rest/inboundLeads";
}

/**
 * Value for the `Authorization` header. Strips one leading `Bearer ` (case-insensitive) so
 * users who paste `Bearer <token>` do not end up with `Bearer Bearer <token>` (401).
 */
export function buildTwentyAuthorizationHeader(rawApiKey: string): string {
  let token = rawApiKey.trim();
  if (/^bearer\s+/i.test(token)) {
    token = token.replace(/^bearer\s+/i, "").trim();
  }
  return `Bearer ${token}`;
}

function ensureValidConfiguration(settings: ExtensionSettings): void {
  if (!settings.twentyBaseUrl.trim()) {
    throw new Error("Twenty CRM base URL is required.");
  }

  if (!settings.twentyApiKey.trim()) {
    throw new Error("Twenty CRM API key is required.");
  }

  if (!settings.twentyLeadEndpointPath.trim()) {
    throw new Error("Twenty CRM lead endpoint path is required.");
  }
}

function graphqlEndpoint(settings: ExtensionSettings): string {
  const path = settings.twentyGraphqlPath.trim().replace(/^\/+/, "") || "graphql";
  return `${normalizeBaseUrl(settings.twentyBaseUrl)}/${path}`;
}

/** Multipart uploads: optional dedicated path segment under the same host (e.g. `metadata`). */
function graphqlUploadEndpoint(settings: ExtensionSettings): string {
  const raw = settings.twentyGraphqlUploadPath.trim().replace(/^\/+/, "");
  const path = raw || settings.twentyGraphqlPath.trim().replace(/^\/+/, "") || "graphql";
  return `${normalizeBaseUrl(settings.twentyBaseUrl)}/${path}`;
}

const metadataGraphqlUrl = (settings: ExtensionSettings): string =>
  `${normalizeBaseUrl(settings.twentyBaseUrl)}/metadata`;

/**
 * URLs for GraphQL multipart (`uploadFilesFieldFile` / legacy `uploadFile`).
 * Modern self-hosted Twenty exposes file mutations on `POST /metadata` only; core `/graphql` often has no Upload.
 * When upload path is unset: try **metadata first**, then core GraphQL as fallback for older stacks.
 * When upload path is set explicitly: that URL first, then `/metadata` if different.
 */
function graphqlMultipartUrlCandidates(settings: ExtensionSettings): string[] {
  const meta = metadataGraphqlUrl(settings);
  const explicit = settings.twentyGraphqlUploadPath.trim().replace(/^\/+/, "");
  if (explicit) {
    const primary = graphqlUploadEndpoint(settings);
    return primary === meta ? [primary] : [primary, meta];
  }
  const corePath = settings.twentyGraphqlPath.trim().replace(/^\/+/, "") || "graphql";
  const coreGraphql = `${normalizeBaseUrl(settings.twentyBaseUrl)}/${corePath}`;
  if (coreGraphql === meta) {
    return [meta];
  }
  return [meta, coreGraphql];
}

/**
 * Twenty GraphQL `AttachmentCreateInput` uses morph targets like `targetInboundLeadId`, not REST-style `inboundLeadId`.
 * Map REST core object path segment (e.g. inboundLeads) → Attachment parent field name.
 */
const REST_SEGMENT_TO_ATTACHMENT_TARGET_FIELD: Record<string, string> = {
  inboundleads: "targetInboundLeadId",
  people: "targetPersonId",
  companies: "targetCompanyId",
  opportunities: "targetOpportunityId",
  tasks: "targetTaskId",
  notes: "targetNoteId",
  dashboards: "targetDashboardId",
  workflows: "targetWorkflowId",
  integrationconnections: "targetIntegrationConnectionId",
};

function inferAttachmentParentFieldName(settings: ExtensionSettings): string {
  if (settings.twentyAttachmentParentField.trim()) {
    return settings.twentyAttachmentParentField.trim();
  }

  const raw = normalizeEndpointPath(settings.twentyLeadEndpointPath);
  const segment =
    raw
      .replace(/^rest\/?/i, "")
      .split("/")
      .filter(Boolean)[0] ?? "inboundLeads";

  const mapped = REST_SEGMENT_TO_ATTACHMENT_TARGET_FIELD[segment.toLowerCase()];
  if (mapped) {
    return mapped;
  }

  if (segment.endsWith("Id")) {
    return segment;
  }

  if (segment.endsWith("s")) {
    return `${segment.slice(0, -1)}Id`;
  }

  return `${segment}Id`;
}

function buildAdfArtifactUploadKey(artifact: AdfArtifact): string {
  return createAdfFingerprint(artifact.content);
}

function toReadableAdfFileName(artifact: AdfArtifact): string {
  const base = artifact.fileName.replace(/\.adf\.xml$/i, "").replace(/\.xml$/i, "");
  const safe = base.replace(/[^\w.-]+/g, "_").slice(0, 120);
  const short = buildAdfArtifactUploadKey(artifact).replace(/^adf_/, "").slice(0, 10);
  return `${safe || "adf"}_${short}.txt`;
}

/** Twenty `AttachmentFileCategoryEnum` — ADF uploads are plain `.txt` files. */
const ATTACHMENT_FILE_CATEGORY_TEXT_DOCUMENT = "TEXT_DOCUMENT";

const CREATE_ATTACHMENT_MUTATION = `mutation CreateAttachment($data: AttachmentCreateInput!) {
  createAttachment(data: $data) {
    id
  }
}`;

const UPLOAD_FILES_FIELD_MUTATION = `mutation ($file: Upload!, $fieldMetadataId: String!) {
  uploadFilesFieldFile(file: $file, fieldMetadataId: $fieldMetadataId) {
    id
    path
  }
}`;

type AdfBinaryUploadOk = { ok: true; fullPath: string; fileId?: string };
type AdfBinaryUploadErr = { ok: false; message: string };

async function postMultipartGraphqlUpload(
  url: string,
  settings: ExtensionSettings,
  query: string,
  variables: Record<string, unknown>,
  file: File,
): Promise<{ response: Response; text: string; parsed: unknown }> {
  const operations = JSON.stringify({ query, variables });
  const map = JSON.stringify({ "0": ["variables.file"] });
  const formData = new FormData();
  formData.set("operations", operations);
  formData.set("map", map);
  formData.set("0", file);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: buildTwentyAuthorizationHeader(settings.twentyApiKey),
      "Apollo-Require-Preflight": "true",
    },
    body: formData,
  });

  const text = await response.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }
  return { response, text, parsed };
}

async function tryUploadFilesFieldAtUrl(
  url: string,
  settings: ExtensionSettings,
  file: File,
  fieldMetadataId: string,
): Promise<AdfBinaryUploadOk | AdfBinaryUploadErr> {
  const { response, text, parsed } = await postMultipartGraphqlUpload(
    url,
    settings,
    UPLOAD_FILES_FIELD_MUTATION,
    { file: null, fieldMetadataId },
    file,
  );

  const root = parsed as {
    data?: { uploadFilesFieldFile?: { id?: string; path?: string } | null };
    errors?: { message: string }[];
  };

  if (!response.ok) {
    return {
      ok: false,
      message: `uploadFilesFieldFile @ ${url} HTTP ${response.status}: ${text.slice(0, 240)}`,
    };
  }

  if (root.errors?.length) {
    return {
      ok: false,
      message: root.errors.map((e) => e.message).join("; "),
    };
  }

  const uploaded = root.data?.uploadFilesFieldFile;
  const fileId = typeof uploaded?.id === "string" ? uploaded.id.trim() : "";
  const path = typeof uploaded?.path === "string" ? uploaded.path.trim() : "";
  if (!fileId || !path) {
    return {
      ok: false,
      message: "uploadFilesFieldFile returned no id/path in GraphQL response.",
    };
  }

  return { ok: true, fullPath: path, fileId };
}

/** Modern Twenty: `uploadFilesFieldFile` + Attachment `file` field (needs field metadata UUID). */
async function uploadFilesFieldGraphql(
  settings: ExtensionSettings,
  file: File,
  fieldMetadataId: string,
): Promise<AdfBinaryUploadOk | AdfBinaryUploadErr> {
  const urls = graphqlMultipartUrlCandidates(settings);
  let last: AdfBinaryUploadErr | null = null;
  for (const url of urls) {
    const result = await tryUploadFilesFieldAtUrl(url, settings, file, fieldMetadataId);
    if (result.ok) {
      return result;
    }
    last = result;
    if (!isMissingUploadCapabilityMessage(result.message)) {
      return result;
    }
  }
  return last ?? { ok: false, message: "uploadFilesFieldFile failed." };
}

/** Legacy Twenty: `uploadFile` returns a storage path string for `AttachmentCreateInput.fullPath`. */
async function uploadFileLegacyGraphql(
  settings: ExtensionSettings,
  file: File,
): Promise<AdfBinaryUploadOk | AdfBinaryUploadErr> {
  const hasFolder = Boolean(settings.twentyUploadFileFolder.trim());
  const query = hasFolder
    ? "mutation ($file: Upload!, $fileFolder: FileFolder) { uploadFile(file: $file, fileFolder: $fileFolder) }"
    : "mutation ($file: Upload!) { uploadFile(file: $file) }";

  const variables: Record<string, unknown> = { file: null };
  if (hasFolder) {
    variables.fileFolder = settings.twentyUploadFileFolder.trim();
  }

  const urls = graphqlMultipartUrlCandidates(settings);
  let last: AdfBinaryUploadErr | null = null;

  for (const url of urls) {
    const { response, text, parsed } = await postMultipartGraphqlUpload(url, settings, query, variables, file);

    const root = parsed as { data?: { uploadFile?: string }; errors?: { message: string }[] };

    if (!response.ok) {
      last = {
        ok: false,
        message: `uploadFile @ ${url} HTTP ${response.status}: ${text.slice(0, 240)}`,
      };
      continue;
    }

    if (root.errors?.length) {
      const msg = root.errors.map((e) => e.message).join("; ");
      last = { ok: false, message: msg };
      if (!isMissingUploadCapabilityMessage(msg)) {
        return last;
      }
      continue;
    }

    const fullPath = root.data?.uploadFile;
    if (typeof fullPath !== "string" || !fullPath.trim()) {
      last = {
        ok: false,
        message: "uploadFile returned no path in GraphQL response.",
      };
      continue;
    }

    return { ok: true, fullPath: fullPath.trim() };
  }

  return last ?? { ok: false, message: "uploadFile failed." };
}

function isMissingUploadCapabilityMessage(message: string): boolean {
  return (
    /Unknown type ['"]Upload['"]/i.test(message) ||
    /Cannot query field ['"]uploadFile['"]/i.test(message) ||
    /Cannot query field ['"]uploadFilesFieldFile['"]/i.test(message)
  );
}

/**
 * Cached result of GET /rest/metadata/objects lookup (per Twenty base URL).
 * Avoids hammering the metadata API when syncing many ADF files.
 */
const attachmentFileFieldMetadataIdCache = new Map<string, string | null>();

/** Exposed for unit tests that run multiple attachment scenarios in one process. */
export function clearTwentyAttachmentFileFieldMetadataCache(): void {
  attachmentFileFieldMetadataIdCache.clear();
}

function extractFieldMetadataNodes(fields: unknown): Record<string, unknown>[] {
  if (fields == null) return [];
  if (Array.isArray(fields)) {
    return fields.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null);
  }
  if (typeof fields === "object" && "edges" in fields) {
    const edges = (fields as { edges?: unknown[] }).edges;
    if (!Array.isArray(edges)) return [];
    return edges
      .map((e) => {
        if (e !== null && typeof e === "object" && "node" in e) {
          const n = (e as { node: unknown }).node;
          if (n !== null && typeof n === "object") return n as Record<string, unknown>;
        }
        return null;
      })
      .filter((n): n is Record<string, unknown> => n !== null);
  }
  return [];
}

/** REST / GraphQL wrappers may nest multiple `data` keys before `objects`. */
function unwrapNestedDataObjectsRoot(root: Record<string, unknown>): Record<string, unknown> {
  let current: Record<string, unknown> = root;
  for (let depth = 0; depth < 5; depth++) {
    const data = current.data;
    if (data !== null && typeof data === "object" && !Array.isArray(data)) {
      current = data as Record<string, unknown>;
      continue;
    }
    break;
  }
  return current;
}

function collectObjectsFromPayload(payload: Record<string, unknown>): unknown {
  if (payload.objects !== undefined) return payload.objects;
  if (payload.objectMetadata !== undefined) return payload.objectMetadata;
  return undefined;
}

function objectValuesIfAllRecords(value: Record<string, unknown>): Record<string, unknown>[] | null {
  const vals = Object.values(value);
  if (vals.length === 0) return null;
  if (vals.every((v) => v !== null && typeof v === "object" && !Array.isArray(v))) {
    return vals as Record<string, unknown>[];
  }
  return null;
}

function extractObjectMetadataNodes(raw: unknown): Record<string, unknown>[] {
  if (raw == null || typeof raw !== "object") return [];
  const root = raw as Record<string, unknown>;
  const payload = unwrapNestedDataObjectsRoot(root);
  const objects = collectObjectsFromPayload(payload);
  if (Array.isArray(objects)) {
    return objects.filter((o): o is Record<string, unknown> => typeof o === "object" && o !== null);
  }
  if (objects !== null && typeof objects === "object" && "edges" in objects) {
    const edges = (objects as { edges?: unknown[] }).edges;
    if (!Array.isArray(edges)) return [];
    return edges
      .map((e) => {
        if (e !== null && typeof e === "object" && "node" in e) {
          const n = (e as { node: unknown }).node;
          if (n !== null && typeof n === "object") return n as Record<string, unknown>;
        }
        return null;
      })
      .filter((n): n is Record<string, unknown> => n !== null);
  }
  if (objects !== null && typeof objects === "object" && !Array.isArray(objects)) {
    const asRecords = objectValuesIfAllRecords(objects as Record<string, unknown>);
    if (asRecords) return asRecords;
  }
  return [];
}

/** Metadata REST may use `fields`, `fieldsList`, or `objectMetadataFields`. */
function fieldsContainerFromObjectMetadata(obj: Record<string, unknown>): unknown {
  if (obj.fields !== undefined) return obj.fields;
  if (obj.fieldsList !== undefined) return obj.fieldsList;
  if (obj.objectMetadataFields !== undefined) return obj.objectMetadataFields;
  return undefined;
}

function findAttachmentFileFieldIdFromObjects(objects: Record<string, unknown>[]): string | null {
  for (const obj of objects) {
    const singular = String(obj.nameSingular ?? "").toLowerCase();
    const plural = String(obj.namePlural ?? "").toLowerCase();
    if (singular !== "attachment" && plural !== "attachments") continue;
    for (const field of extractFieldMetadataNodes(fieldsContainerFromObjectMetadata(obj))) {
      const name = String(field.name ?? "").toLowerCase();
      const type = String(field.type ?? "").toUpperCase();
      if (name === "file" && type === "FILES") {
        const id = typeof field.id === "string" ? field.id.trim() : "";
        if (id) return id;
      }
    }
  }
  return null;
}

/**
 * Reads standard objects from Twenty Metadata REST API and finds the Attachment `file` (FILES) field id.
 * Same source as Settings → Data model, when the API returns nested field metadata.
 */
async function resolveAttachmentFileFieldMetadataId(
  settings: ExtensionSettings,
): Promise<string | null> {
  try {
    const url = `${normalizeBaseUrl(settings.twentyBaseUrl)}/rest/metadata/objects?limit=1000`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: buildTwentyAuthorizationHeader(settings.twentyApiKey),
        Accept: "application/json",
      },
    });
    if (!response.ok) return null;
    const raw: unknown = await response.json();
    const objects = extractObjectMetadataNodes(raw);
    return findAttachmentFileFieldIdFromObjects(objects);
  } catch {
    return null;
  }
}

async function getEffectiveAttachmentFileFieldMetadataId(settings: ExtensionSettings): Promise<string> {
  const configured = settings.twentyAttachmentFileFieldMetadataId.trim();
  if (configured) return configured;
  const cacheKey = normalizeBaseUrl(settings.twentyBaseUrl);
  if (attachmentFileFieldMetadataIdCache.has(cacheKey)) {
    const hit = attachmentFileFieldMetadataIdCache.get(cacheKey);
    return hit?.trim() ?? "";
  }
  const resolved = await resolveAttachmentFileFieldMetadataId(settings);
  attachmentFileFieldMetadataIdCache.set(cacheKey, resolved);
  return resolved?.trim() ?? "";
}

async function uploadAdfBinaryForAttachment(
  settings: ExtensionSettings,
  file: File,
): Promise<AdfBinaryUploadOk | AdfBinaryUploadErr> {
  const fieldMetaId = await getEffectiveAttachmentFileFieldMetadataId(settings);

  if (fieldMetaId) {
    const modern = await uploadFilesFieldGraphql(settings, file, fieldMetaId);
    if (modern.ok) {
      return modern;
    }
    if (!isMissingUploadCapabilityMessage(modern.message)) {
      return modern;
    }
    // Many Twenty builds removed `uploadFile`; only `uploadFilesFieldFile` on `POST /metadata` applies. Do not round-trip legacy `uploadFile` when we already have a FILES field id.
    return {
      ok: false,
      message: `${modern.message} With Attachment file field metadata set, uploads must succeed via uploadFilesFieldFile (extension tries POST .../metadata before core GraphQL). Check base URL, API key, and field UUID. See Twenty CRM integration guide.`,
    };
  }

  const legacy = await uploadFileLegacyGraphql(settings, file);
  if (legacy.ok) {
    return legacy;
  }

  if (!fieldMetaId && isMissingUploadCapabilityMessage(legacy.message)) {
    return {
      ok: false,
      message: `${legacy.message} Could not auto-detect Attachment → file field id from GET /rest/metadata/objects (or it is not returned there). Configure "Attachment file field metadata id" in extension options (Twenty Settings → Data model → Attachment → file field id). Uploads use POST .../metadata + uploadFilesFieldFile on modern Twenty. See Twenty CRM integration guide.`,
    };
  }

  return legacy;
}

async function postCreateAttachment(
  settings: ExtensionSettings,
  data: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(graphqlEndpoint(settings), {
    method: "POST",
    headers: {
      Authorization: buildTwentyAuthorizationHeader(settings.twentyApiKey),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: CREATE_ATTACHMENT_MUTATION,
      variables: { data },
    }),
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, message: `createAttachment response was not JSON (${response.status}).` };
  }

  const root = parsed as {
    data?: { createAttachment?: { id?: string } | null };
    errors?: { message: string }[];
  };

  if (!response.ok) {
    return {
      ok: false,
      message: `createAttachment HTTP ${response.status}: ${text.slice(0, 240)}`,
    };
  }

  if (root.errors?.length) {
    return {
      ok: false,
      message: root.errors.map((e) => e.message).join("; "),
    };
  }

  const createdId = root.data?.createAttachment?.id;
  if (typeof createdId !== "string" || !createdId.trim()) {
    return {
      ok: false,
      message: "createAttachment returned no attachment id in GraphQL response.",
    };
  }

  return { ok: true };
}

async function createAttachmentGraphql
(
  settings: ExtensionSettings,
  params: {
    name: string;
    fullPath: string;
    fileId?: string;
    parentRecordId: string;
    parentFieldName: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const base: Record<string, unknown> = {
    name: params.name,
    fileCategory: ATTACHMENT_FILE_CATEGORY_TEXT_DOCUMENT,
    [params.parentFieldName]: params.parentRecordId,
  };

  if (params.fileId) {
    const withFile = {
      ...base,
      file: [{ fileId: params.fileId, label: params.name }],
    };
    const first = await postCreateAttachment(settings, withFile);
    if (first.ok) {
      return first;
    }
    const withPath = { ...base, fullPath: params.fullPath };
    const second = await postCreateAttachment(settings, withPath);
    if (second.ok) {
      return second;
    }
    return {
      ok: false,
      message: `${first.message} (fallback fullPath: ${second.message})`,
    };
  }

  return postCreateAttachment(settings, { ...base, fullPath: params.fullPath });
}

async function patchLeadPayloadRawMarkdown(
  recordId: string,
  markdown: string,
  settings: ExtensionSettings,
  blocknote: string | null | undefined,
): Promise<{ ok: boolean; message: string }> {
  const endpoint = `${normalizeBaseUrl(settings.twentyBaseUrl)}/${normalizeEndpointPath(
    settings.twentyLeadEndpointPath,
  )}/${recordId}`;

  const payloadRaw: Record<string, unknown> = {
    markdown,
    blocknote: blocknote === undefined ? null : blocknote,
  };

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      Authorization: buildTwentyAuthorizationHeader(settings.twentyApiKey),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payloadRaw }),
  });

  const text = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      message: `Failed to update payloadRaw after ADF uploads (${response.status}): ${text.slice(0, 240)}`,
    };
  }

  return { ok: true, message: "" };
}

interface AdfAttachmentSyncResult {
  uploaded: number;
  skippedAlready: number;
  errors: string[];
}

async function syncAdfAttachmentsToTwenty(
  recordId: string,
  lead: ParsedAdfLead,
  settings: ExtensionSettings,
  existingLeadPayloadMarkdown: string | null | undefined,
  importPayloadRaw: Record<string, unknown> | undefined,
): Promise<AdfAttachmentSyncResult> {
  const errors: string[] = [];
  const merged = mergeAnalyticsState(
    parseAnalyticsState(existingLeadPayloadMarkdown ?? undefined),
    lead,
  );
  const uploadedKeys = new Set(merged.uploadedAdfFileKeys);
  const artifacts = dedupeAdfArtifacts(lead.adfArtifacts);

  let skippedAlready = 0;
  for (const artifact of artifacts) {
    if (uploadedKeys.has(buildAdfArtifactUploadKey(artifact))) {
      skippedAlready += 1;
    }
  }

  const parentField = inferAttachmentParentFieldName(settings);
  let uploaded = 0;

  for (const artifact of artifacts) {
    const key = buildAdfArtifactUploadKey(artifact);
    if (uploadedKeys.has(key)) {
      continue;
    }

    if (!artifact.content.trim()) {
      errors.push(`${artifact.fileName || "adf"}: empty ADF body, skipped upload`);
      continue;
    }

    const readableName = toReadableAdfFileName(artifact);
    const file = new File([artifact.content], readableName, {
      type: "text/plain;charset=utf-8",
    });

    const up = await uploadAdfBinaryForAttachment(settings, file);
    if (!up.ok) {
      errors.push(`${readableName}: ${up.message}`);
      continue;
    }

    const att = await createAttachmentGraphql(settings, {
      name: readableName,
      fullPath: up.fullPath,
      fileId: up.fileId,
      parentRecordId: recordId,
      parentFieldName: parentField,
    });

    if (!att.ok) {
      errors.push(`${readableName}: ${att.message}`);
      continue;
    }

    uploadedKeys.add(key);
    uploaded += 1;
  }

  if (uploaded === 0) {
    return { uploaded: 0, skippedAlready, errors };
  }

  merged.uploadedAdfFileKeys = [...uploadedKeys];
  const newMarkdown = createAnalyticsMarkdown(merged);

  const rawPayloadRaw = importPayloadRaw?.payloadRaw;
  const blocknote =
    rawPayloadRaw &&
    typeof rawPayloadRaw === "object" &&
    !Array.isArray(rawPayloadRaw) &&
    "blocknote" in rawPayloadRaw
      ? (rawPayloadRaw as { blocknote?: string | null }).blocknote ?? null
      : null;

  const patch = await patchLeadPayloadRawMarkdown(recordId, newMarkdown, settings, blocknote);
  if (!patch.ok) {
    errors.push(patch.message);
  }

  return { uploaded, skippedAlready, errors };
}

function describeAdfAttachmentSync(sync: AdfAttachmentSyncResult): string {
  const parts: string[] = [];
  if (sync.uploaded > 0) {
    parts.push(`Uploaded ${sync.uploaded} ADF text file(s) as Twenty attachments.`);
  }
  if (sync.skippedAlready > 0) {
    parts.push(`${sync.skippedAlready} ADF file(s) already attached (skipped).`);
  }
  if (sync.errors.length > 0) {
    parts.push(`Attachment issues: ${sync.errors.join(" · ")}`);
  }
  return parts.join(" ");
}

function splitCustomerName(value: string | null): {
  customerFirstName: string;
  customerLastName: string;
} {
  const parts = (value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      customerFirstName: "",
      customerLastName: "",
    };
  }

  return {
    customerFirstName: parts[0],
    customerLastName: parts.slice(1).join(" "),
  };
}

function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function dedupeHistoryEntries(entries: InquiryHistoryEntry[]): InquiryHistoryEntry[] {
  const seen = new Set<string>();
  const result: InquiryHistoryEntry[] = [];

  for (const entry of entries) {
    const signature = [
      entry.rawAdfFingerprint,
      entry.taskId ?? "",
      entry.childId ?? "",
      entry.sourceRaw ?? "",
      entry.subSourceRaw ?? "",
    ].join("|");

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

function dedupeAdfArtifacts(entries: AdfArtifact[]): AdfArtifact[] {
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

function buildAnalyticsStateFromLead(lead: ParsedAdfLead): PersistedAnalyticsState {
  return {
    latestInquirySourceRaw: lead.latestInquirySourceRaw,
    latestInquirySubSourceRaw: lead.latestInquirySubSourceRaw,
    latestInquiryUpType: lead.latestInquiryUpType,
    latestInquiryNormalizedSource: lead.latestInquiryNormalizedSource,
    latestProvider: lead.sourceProvider,
    latestInquiryAt: lead.requestDate ?? lead.extractedAt,
    primaryPhoneSource: lead.primaryPhoneSource,
    vehicleYear: lead.vehicleYear,
    vehicleMake: lead.vehicleMake,
    vehicleModel: lead.vehicleModel,
    vehicleTrim: lead.vehicleTrim,
    vehicleVin: lead.vehicleVin,
    vehicleInterest: lead.vehicleInterest,
    vehicleStatus: lead.vehicleStatus,
    providerLeadType: lead.providerLeadType,
    isPrequalLead: lead.isPrequalLead,
    prequalStatus: lead.prequalStatus,
    prequalifiedAmount: lead.prequalifiedAmount,
    campaignCode: lead.campaignCode,
    vehicleSummary: lead.vehicleSummary,
    history: dedupeHistoryEntries(lead.inquiryHistory),
    matterTimeline: dedupeMatterTimeline(lead.matterTimeline),
    adfArtifacts: dedupeAdfArtifacts(lead.adfArtifacts),
    matterCustomerSnapshot: lead.matterCustomerSnapshot,
    automotiveFieldSources: lead.automotiveFieldSources,
    parsingWarnings: [...new Set(lead.parsingWarnings)],
    uploadedAdfFileKeys: [],
  };
}

function createAnalyticsMarkdown(state: PersistedAnalyticsState): string {
  const rawDocuments = dedupeAdfArtifacts(state.adfArtifacts).map((entry) => {
    return `### ${entry.fileName}

\`\`\`xml
${entry.content.trim()}
\`\`\``;
  });

  return [
    ANALYTICS_START_MARKER,
    "```json",
    JSON.stringify(state, null, 2),
    "```",
    ANALYTICS_END_MARKER,
    "",
    RAW_ADF_START_MARKER,
    rawDocuments.join(RAW_ADF_SEPARATOR),
    RAW_ADF_END_MARKER,
  ]
    .filter((part) => part !== "")
    .join("\n");
}

function parseAnalyticsState(markdown: string | undefined): PersistedAnalyticsState | null {
  if (!markdown?.trim()) {
    return null;
  }

  const pattern = new RegExp(
    `${ANALYTICS_START_MARKER}\\s*\`\`\`json\\s*([\\s\\S]*?)\\s*\`\`\`\\s*${ANALYTICS_END_MARKER}`,
  );
  const match = markdown.match(pattern);

  if (!match?.[1]) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[1]) as Partial<PersistedAnalyticsState>;
    return {
      latestInquirySourceRaw: parsed.latestInquirySourceRaw ?? null,
      latestInquirySubSourceRaw: parsed.latestInquirySubSourceRaw ?? null,
      latestInquiryUpType: parsed.latestInquiryUpType ?? null,
      latestInquiryNormalizedSource: parsed.latestInquiryNormalizedSource ?? "unknown",
      latestProvider: parsed.latestProvider ?? null,
      latestInquiryAt: parsed.latestInquiryAt ?? null,
      primaryPhoneSource: parsed.primaryPhoneSource ?? null,
      vehicleYear: typeof parsed.vehicleYear === "number" ? parsed.vehicleYear : null,
      vehicleMake: parsed.vehicleMake ?? null,
      vehicleModel: parsed.vehicleModel ?? null,
      vehicleTrim: parsed.vehicleTrim ?? null,
      vehicleVin: parsed.vehicleVin ?? null,
      vehicleInterest: parsed.vehicleInterest ?? null,
      vehicleStatus: parsed.vehicleStatus ?? null,
      providerLeadType: parsed.providerLeadType ?? null,
      isPrequalLead: typeof parsed.isPrequalLead === "boolean" ? parsed.isPrequalLead : null,
      prequalStatus: parsed.prequalStatus ?? null,
      prequalifiedAmount: typeof parsed.prequalifiedAmount === "number" ? parsed.prequalifiedAmount : null,
      campaignCode: parsed.campaignCode ?? null,
      vehicleSummary: parsed.vehicleSummary ?? null,
      history: parsed.history ?? [],
      matterTimeline: parsed.matterTimeline ?? [],
      adfArtifacts: parsed.adfArtifacts ?? [],
      matterCustomerSnapshot: parsed.matterCustomerSnapshot ?? null,
      automotiveFieldSources: parsed.automotiveFieldSources ?? {
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
      },
      parsingWarnings: parsed.parsingWarnings ?? [],
      uploadedAdfFileKeys: Array.isArray(parsed.uploadedAdfFileKeys)
        ? [...new Set(parsed.uploadedAdfFileKeys.filter((k): k is string => typeof k === "string"))]
        : [],
    };
  } catch {
    return null;
  }
}

function mergeAnalyticsState(
  existingState: PersistedAnalyticsState | null,
  incomingLead: ParsedAdfLead,
): PersistedAnalyticsState {
  const incomingState = buildAnalyticsStateFromLead(incomingLead);

  return {
    latestInquirySourceRaw: incomingState.latestInquirySourceRaw,
    latestInquirySubSourceRaw: incomingState.latestInquirySubSourceRaw,
    latestInquiryUpType: incomingState.latestInquiryUpType,
    latestInquiryNormalizedSource: incomingState.latestInquiryNormalizedSource,
    latestProvider: incomingState.latestProvider,
    latestInquiryAt: incomingState.latestInquiryAt,
    primaryPhoneSource: incomingState.primaryPhoneSource ?? existingState?.primaryPhoneSource ?? null,
    vehicleYear: incomingState.vehicleYear ?? existingState?.vehicleYear ?? null,
    vehicleMake: incomingState.vehicleMake ?? existingState?.vehicleMake ?? null,
    vehicleModel: incomingState.vehicleModel ?? existingState?.vehicleModel ?? null,
    vehicleTrim: incomingState.vehicleTrim ?? existingState?.vehicleTrim ?? null,
    vehicleVin: incomingState.vehicleVin ?? existingState?.vehicleVin ?? null,
    vehicleInterest: incomingState.vehicleInterest ?? existingState?.vehicleInterest ?? null,
    vehicleStatus: incomingState.vehicleStatus ?? existingState?.vehicleStatus ?? null,
    providerLeadType: incomingState.providerLeadType ?? existingState?.providerLeadType ?? null,
    isPrequalLead: incomingState.isPrequalLead ?? existingState?.isPrequalLead ?? null,
    prequalStatus: incomingState.prequalStatus ?? existingState?.prequalStatus ?? null,
    prequalifiedAmount: incomingState.prequalifiedAmount ?? existingState?.prequalifiedAmount ?? null,
    campaignCode: incomingState.campaignCode ?? existingState?.campaignCode ?? null,
    vehicleSummary: incomingState.vehicleSummary ?? existingState?.vehicleSummary ?? null,
    history: dedupeHistoryEntries([...(existingState?.history ?? []), ...incomingState.history]),
    matterTimeline: dedupeMatterTimeline([
      ...(existingState?.matterTimeline ?? []),
      ...incomingState.matterTimeline,
    ]),
    adfArtifacts: dedupeAdfArtifacts([...(existingState?.adfArtifacts ?? []), ...incomingState.adfArtifacts]),
    matterCustomerSnapshot: incomingState.matterCustomerSnapshot ?? existingState?.matterCustomerSnapshot ?? null,
    automotiveFieldSources: incomingState.automotiveFieldSources,
    parsingWarnings: [...new Set([...(existingState?.parsingWarnings ?? []), ...incomingState.parsingWarnings])],
    uploadedAdfFileKeys: [...(existingState?.uploadedAdfFileKeys ?? [])],
  };
}

function flattenLead(lead: ParsedAdfLead): Record<string, string> {
  const { customerFirstName, customerLastName } = splitCustomerName(lead.customerName);
  const resolvedExternalId = lead.taskId || lead.childId || lead.fingerprint;
  const analyticsState = buildAnalyticsStateFromLead(lead);

  return {
    customerFirstName: lead.customerFirstName ?? customerFirstName,
    customerLastName: lead.customerLastName ?? customerLastName,
    childId: lead.childId ?? "",
    customerName: lead.customerName ?? "",
    dealerName: lead.dealerName ?? "",
    dealershipWebsite: lead.dealershipWebsite ?? "",
    customerStreetAddress: lead.customerStreetAddress ?? "",
    customerCity: lead.customerCity ?? "",
    customerState: lead.customerState ?? "",
    customerPostalCode: lead.customerPostalCode ?? "",
    customerFullAddress: lead.customerFullAddress ?? "",
    vehicleYear: lead.vehicleYear === null ? "" : String(lead.vehicleYear),
    vehicleMake: lead.vehicleMake ?? "",
    vehicleModel: lead.vehicleModel ?? "",
    vehicleTrim: lead.vehicleTrim ?? "",
    vehicleVin: lead.vehicleVin ?? "",
    vehicleInterest: lead.vehicleInterest ?? "",
    vehicleStatus: lead.vehicleStatus ?? "",
    providerLeadType: lead.providerLeadType ?? "",
    isPrequalLead: lead.isPrequalLead === null ? "" : String(lead.isPrequalLead),
    prequalStatus: lead.prequalStatus ?? "",
    prequalifiedAmount: lead.prequalifiedAmount === null ? "" : String(lead.prequalifiedAmount),
    campaignCode: lead.campaignCode ?? "",
    vehicleSummary: lead.vehicleSummary ?? "",
    extractedAt: lead.extractedAt,
    fingerprint: lead.fingerprint,
    optOutUrl: lead.optOutUrl ?? "",
    phoneNumbers: lead.phoneNumbers.join(", "),
    plainText: lead.plainText,
    primaryPhone: lead.primaryPhone ?? "",
    primaryPhoneSource: lead.primaryPhoneSource ?? "",
    rawAdfHtml: lead.rawAdfHtml,
    rawAdfCount: String(lead.rawAdfDocuments.length),
    resolvedExternalId,
    resolvedExternalKey: `ADF_ELEADS:${resolvedExternalId}`,
    source: lead.source,
    sourceProvider: lead.sourceProvider ?? "",
    sourceUrl: lead.sourceUrl,
    taskId: lead.taskId ?? "",
    requestDate: lead.requestDate ?? lead.extractedAt,
    customerEmail: lead.customerEmail ?? "",
    comments: lead.comments ?? "",
    latestInquirySourceRaw: lead.latestInquirySourceRaw ?? "",
    latestInquirySubSourceRaw: lead.latestInquirySubSourceRaw ?? "",
    latestInquiryUpType: lead.latestInquiryUpType ?? "",
    latestInquiryNormalizedSource: lead.latestInquiryNormalizedSource,
    latestProvider: lead.sourceProvider ?? "",
    inquiryHistoryJson: JSON.stringify(lead.inquiryHistory),
    matterTimelineJson: JSON.stringify(lead.matterTimeline),
    adfArtifactsJson: JSON.stringify(lead.adfArtifacts),
    matterCustomerSnapshotJson: JSON.stringify(lead.matterCustomerSnapshot),
    automotiveFieldSourcesJson: JSON.stringify(lead.automotiveFieldSources),
    parsingWarningsJson: JSON.stringify(lead.parsingWarnings),
    analyticsPayloadMarkdown: createAnalyticsMarkdown(analyticsState),
  };
}

function resolveTemplate(template: string, lead: ParsedAdfLead): string {
  const flattenedLead = flattenLead(lead);
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, token: string) => {
    return flattenedLead[token] ?? "";
  });
}

function collectTemplateTokens(value: unknown, tokens: Set<string> = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    for (const match of value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
      if (match[1]) {
        tokens.add(match[1]);
      }
    }
    return tokens;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectTemplateTokens(item, tokens));
    return tokens;
  }

  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((nested) => collectTemplateTokens(nested, tokens));
  }

  return tokens;
}

function isTypedTemplateObject(value: unknown): value is { value: unknown; type: string } {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "value" in (value as Record<string, unknown>) &&
    "type" in (value as Record<string, unknown>)
  );
}

function coerceTypedFieldValue(value: unknown, type: string): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  switch (type) {
    case "string":
      return typeof value === "string" ? value : String(value);
    case "number": {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value !== "string" || !value.trim()) {
        return null;
      }
      const normalized = value.replace(/[$,\s;]/g, "");
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    case "boolean": {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value !== "string") {
        return null;
      }
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(normalized)) {
        return true;
      }
      if (["false", "0", "no", "n"].includes(normalized)) {
        return false;
      }
      return null;
    }
    default:
      throw new Error(`Unsupported field map value type: ${type}`);
  }
}

function parseFieldMap(rawFieldMap: string): Record<string, unknown> {
  const parsed = JSON.parse(rawFieldMap) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Twenty field map must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

function validateFieldMap(mapping: Record<string, unknown>, lead: ParsedAdfLead): void {
  const availablePlaceholders = new Set(Object.keys(flattenLead(lead)));
  const usedTokens = [...collectTemplateTokens(mapping)];
  const unknownTokens = usedTokens.filter((token) => !availablePlaceholders.has(token));

  if (unknownTokens.length > 0) {
    throw new Error(`Unknown Twenty field map placeholders: ${unknownTokens.sort().join(", ")}`);
  }

  const invalidTypedNodes: string[] = [];
  const walk = (value: unknown, path: string): void => {
    if (isTypedTemplateObject(value)) {
      if (!["string", "number", "boolean"].includes(value.type)) {
        invalidTypedNodes.push(path || "root");
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }

    if (value && typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([key, nested]) =>
        walk(nested, path ? `${path}.${key}` : key),
      );
    }
  };

  walk(mapping, "");

  if (invalidTypedNodes.length > 0) {
    throw new Error(`Unsupported typed field map entries at: ${invalidTypedNodes.join(", ")}`);
  }
}

function resolveTemplateValue(value: unknown, lead: ParsedAdfLead): unknown {
  if (isTypedTemplateObject(value)) {
    return coerceTypedFieldValue(resolveTemplateValue(value.value, lead), value.type);
  }

  if (typeof value === "string") {
    return resolveTemplate(value, lead);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplateValue(item, lead));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        resolveTemplateValue(nestedValue, lead),
      ]),
    );
  }

  return value;
}

export function buildTwentyLeadPayload(
  lead: ParsedAdfLead,
  settings: ExtensionSettings,
): Record<string, unknown> {
  const mapping = parseFieldMap(settings.twentyLeadFieldMap);
  validateFieldMap(mapping, lead);
  const payload = resolveTemplateValue(mapping, lead) as Record<string, unknown>;
  const payloadRaw =
    payload.payloadRaw && typeof payload.payloadRaw === "object" && !Array.isArray(payload.payloadRaw)
      ? { ...(payload.payloadRaw as Record<string, unknown>) }
      : {};

  payloadRaw.markdown = flattenLead(lead).analyticsPayloadMarkdown;
  payloadRaw.blocknote =
    payloadRaw.blocknote === undefined ? null : (payloadRaw.blocknote as string | null);

  payload.payloadRaw = payloadRaw;
  return payload;
}

function prunePatchPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    const cleaned = value
      .map((entry) => prunePatchPayload(entry))
      .filter((entry) => entry !== undefined);
    return cleaned.length > 0 ? cleaned : undefined;
  }

  if (value && typeof value === "object") {
    const cleaned = Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, nestedValue]) => [key, prunePatchPayload(nestedValue)])
        .filter(([, nestedValue]) => nestedValue !== undefined),
    );
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }

  if (typeof value === "string") {
    return value.trim() ? value : undefined;
  }

  if (value === null || value === undefined) {
    return undefined;
  }

  return value;
}

function readStringId(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  return value.trim();
}

/**
 * Parses id from Twenty REST create/update JSON. Shapes vary by version/workspace
 * (`{ data: { inboundLead: { id } } }`, `{ data: { id } }`, `{ record: { id } }`, `{ data: [...] }`).
 */
function extractRecordId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const candidate = data as Record<string, unknown>;

  const directId = readStringId(candidate.id);
  if (directId) {
    return directId;
  }

  const recordField = candidate.record;
  if (recordField && typeof recordField === "object") {
    const id = readStringId((recordField as Record<string, unknown>).id);
    if (id) {
      return id;
    }
  }

  const directData = candidate.data;
  if (Array.isArray(directData) && directData.length > 0) {
    const first = directData[0];
    if (first && typeof first === "object") {
      const id = readStringId((first as Record<string, unknown>).id);
      if (id) {
        return id;
      }
    }
  }

  if (directData && typeof directData === "object" && !Array.isArray(directData)) {
    const dataObj = directData as Record<string, unknown>;
    const flatId = readStringId(dataObj.id);
    if (flatId) {
      return flatId;
    }

    const nestedRecord = Object.values(dataObj).find(
      (value) =>
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof (value as Record<string, unknown>).id === "string",
    );
    if (nestedRecord && typeof nestedRecord === "object") {
      const id = readStringId((nestedRecord as Record<string, unknown>).id);
      if (id) {
        return id;
      }
    }
  }

  return undefined;
}

export function buildUpdatePayload(
  existingLead: TwentyInboundLeadRecord,
  incomingLead: ParsedAdfLead,
  settings: ExtensionSettings,
): Record<string, unknown> {
  const createPayload = buildTwentyLeadPayload(incomingLead, settings);
  const analyticsState = mergeAnalyticsState(
    parseAnalyticsState(existingLead.payloadRaw?.markdown),
    incomingLead,
  );
  const payloadRaw =
    createPayload.payloadRaw && typeof createPayload.payloadRaw === "object" && !Array.isArray(createPayload.payloadRaw)
      ? { ...(createPayload.payloadRaw as Record<string, unknown>) }
      : {};

  payloadRaw.markdown = createAnalyticsMarkdown(analyticsState);
  payloadRaw.blocknote =
    payloadRaw.blocknote === undefined ? existingLead.payloadRaw?.blocknote ?? null : payloadRaw.blocknote;

  return {
    ...(prunePatchPayload({
      ...createPayload,
      payloadRaw,
    }) as Record<string, unknown>),
    payloadRaw,
  };
}

async function fetchInboundLeads(
  settings: ExtensionSettings,
): Promise<TwentyInboundLeadRecord[]> {
  const endpoint = `${normalizeBaseUrl(settings.twentyBaseUrl)}/${normalizeEndpointPath(
    settings.twentyLeadEndpointPath,
  )}?limit=100`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: buildTwentyAuthorizationHeader(settings.twentyApiKey),
      Accept: "application/json",
    },
  });

  const responseText = await response.text();

  if (!response.ok) {
    const bodySnippet = responseText.replace(/\s+/g, " ").trim().slice(0, 200);
    const hint401 =
      response.status === 401
        ? " Twenty returned 401: verify the API key under Settings → APIs & Webhooks. Paste the key token only (or one \"Bearer …\" value); the extension adds Bearer automatically."
        : "";
    throw new Error(
      `Unable to fetch existing Twenty leads (${response.status}).${hint401}${bodySnippet ? ` Response: ${bodySnippet}` : ""}`,
    );
  }

  const data = (responseText ? JSON.parse(responseText) : {}) as {
    data?: {
      inboundLeads?: TwentyInboundLeadRecord[];
    };
  };

  return data.data?.inboundLeads ?? [];
}

function findMatchingLead(
  leads: TwentyInboundLeadRecord[],
  incomingLead: ParsedAdfLead,
): TwentyInboundLeadRecord | null {
  const incomingEmail = normalizeEmail(incomingLead.customerEmail);
  const incomingPhone = normalizePhone(incomingLead.primaryPhone);
  const shouldUsePhoneForMatching =
    !!incomingPhone &&
    incomingLead.primaryPhoneSource !== "html_generic" &&
    incomingLead.primaryPhoneSource !== "unscoped_fallback";
  const incomingName = normalizeName(incomingLead.customerName);
  const incomingVendor = normalizeName(incomingLead.dealerName);
  const incomingTaskIds = new Set(
    [incomingLead.taskId, ...incomingLead.inquiryHistory.map((entry) => entry.taskId)].filter(Boolean),
  );
  const incomingChildIds = new Set(
    [incomingLead.childId, ...incomingLead.inquiryHistory.map((entry) => entry.childId)].filter(Boolean),
  );
  const incomingFingerprints = new Set(
    [incomingLead.fingerprint, ...incomingLead.inquiryHistory.map((entry) => entry.rawAdfFingerprint)].filter(
      Boolean,
    ),
  );
  const incomingExternalId = normalizeText(incomingLead.taskId || incomingLead.childId || incomingLead.fingerprint);

  for (const lead of leads) {
    if (
      incomingEmail &&
      normalizeEmail(lead.customerEmail) &&
      normalizeEmail(lead.customerEmail) === incomingEmail
    ) {
      return lead;
    }

    if (
      shouldUsePhoneForMatching &&
      normalizePhone(lead.customerPhone) &&
      normalizePhone(lead.customerPhone) === incomingPhone
    ) {
      return lead;
    }

    const existingName = normalizeName(
      lead.name ||
        [lead.customerFirstName, lead.customerLastName].filter(Boolean).join(" "),
    );
    const existingVendor = normalizeName(lead.vendorName);

    if (incomingName && existingName === incomingName && incomingVendor && existingVendor === incomingVendor) {
      return lead;
    }

    if (incomingExternalId && normalizeText(lead.externalId) === incomingExternalId) {
      return lead;
    }

    const analyticsState = parseAnalyticsState(lead.payloadRaw?.markdown);

    if (!analyticsState) {
      continue;
    }

    const matchesHistory = analyticsState.history.some((entry) => {
      return (
        (!!entry.taskId && incomingTaskIds.has(entry.taskId)) ||
        (!!entry.childId && incomingChildIds.has(entry.childId)) ||
        (!!entry.rawAdfFingerprint && incomingFingerprints.has(entry.rawAdfFingerprint))
      );
    });

    if (matchesHistory) {
      return lead;
    }
  }

  return null;
}

async function updateTwentyLead(
  recordId: string,
  payload: Record<string, unknown>,
  settings: ExtensionSettings,
): Promise<TwentyLeadImportResult> {
  const endpoint = `${normalizeBaseUrl(settings.twentyBaseUrl)}/${normalizeEndpointPath(
    settings.twentyLeadEndpointPath,
  )}/${recordId}`;

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      Authorization: buildTwentyAuthorizationHeader(settings.twentyApiKey),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let parsedResponse: unknown = undefined;

  try {
    parsedResponse = responseText ? JSON.parse(responseText) : undefined;
  } catch {
    parsedResponse = responseText;
  }

  if (!response.ok) {
    return {
      ok: false,
      message:
        typeof parsedResponse === "string" && parsedResponse
          ? parsedResponse
          : `Twenty CRM update failed with status ${response.status}.`,
      payload,
    };
  }

  return {
    ok: true,
    message: "Existing lead in Twenty CRM was updated with additional ADF data.",
    recordId: extractRecordId(parsedResponse) ?? recordId,
    payload,
  };
}

export async function testTwentyConnection(
  settings: ExtensionSettings,
): Promise<TwentyLeadImportResult> {
  ensureValidConfiguration(settings);

  const endpoint = `${normalizeBaseUrl(settings.twentyBaseUrl)}/${normalizeEndpointPath(
    settings.twentyLeadEndpointPath,
  )}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: buildTwentyAuthorizationHeader(settings.twentyApiKey),
      Accept: "application/json",
    },
  });

  if (response.ok) {
    return {
      ok: true,
      message: `Connected to Twenty CRM successfully (${response.status}).`,
    };
  }

  const extra401 =
    response.status === 401
      ? ' Paste the raw API key only, or one full "Bearer your-token" value (the extension adds Bearer if you omit it; do not paste both).'
      : "";
  return {
    ok: false,
    message: `Twenty CRM connection failed with status ${response.status}.${extra401}`,
  };
}

export async function createTwentyLead(
  lead: ParsedAdfLead,
  settings: ExtensionSettings,
): Promise<TwentyLeadImportResult> {
  ensureValidConfiguration(settings);

  const existingLead = findMatchingLead(await fetchInboundLeads(settings), lead);
  if (existingLead?.id) {
    const priorMarkdown = existingLead.payloadRaw?.markdown;
    const updatePayload = buildUpdatePayload(existingLead, lead, settings);
    const updateResult = await updateTwentyLead(existingLead.id, updatePayload, settings);
    const recordId = updateResult.recordId ?? existingLead.id;
    let message = updateResult.message;

    const shouldTryAttachments =
      updateResult.ok &&
      settings.twentyUploadAdfAttachments &&
      lead.adfArtifacts.length > 0 &&
      Boolean(recordId);

    if (shouldTryAttachments) {
      const sync = await syncAdfAttachmentsToTwenty(
        recordId,
        lead,
        settings,
        priorMarkdown,
        updateResult.payload as Record<string, unknown> | undefined,
      );
      const extra = describeAdfAttachmentSync(sync);
      if (extra) {
        message = `${message} ${extra}`.trim();
      }
    } else if (
      updateResult.ok &&
      settings.twentyUploadAdfAttachments &&
      lead.adfArtifacts.length > 0 &&
      !recordId
    ) {
      message = `${message} Attachments were not uploaded (missing record id after update).`.trim();
    } else if (updateResult.ok && settings.twentyUploadAdfAttachments && lead.adfArtifacts.length === 0) {
      message = `${message} (ADF attachments: no artifacts parsed on this lead.)`.trim();
    }

    return {
      ...updateResult,
      message,
      parsedLead: lead,
    };
  }

  const payload = buildTwentyLeadPayload(lead, settings);
  const endpoint = `${normalizeBaseUrl(settings.twentyBaseUrl)}/${normalizeEndpointPath(
    settings.twentyLeadEndpointPath,
  )}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: buildTwentyAuthorizationHeader(settings.twentyApiKey),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let parsedResponse: unknown = undefined;

  try {
    parsedResponse = responseText ? JSON.parse(responseText) : undefined;
  } catch {
    parsedResponse = responseText;
  }

  if (response.ok) {
    const recordId = extractRecordId(parsedResponse);
    let message = "Lead created in Twenty CRM.";
    const wantAttachments = settings.twentyUploadAdfAttachments && lead.adfArtifacts.length > 0;

    if (wantAttachments && recordId) {
      const sync = await syncAdfAttachmentsToTwenty(recordId, lead, settings, null, payload);
      const extra = describeAdfAttachmentSync(sync);
      if (extra) {
        message = `${message} ${extra}`.trim();
      }
    } else if (wantAttachments && !recordId) {
      message = `${message} Attachments were not uploaded: create response had no record id (extension could not parse POST JSON — check response body for id).`.trim();
    } else if (settings.twentyUploadAdfAttachments && lead.adfArtifacts.length === 0) {
      message = `${message} (ADF attachments: no artifacts parsed on this lead.)`.trim();
    }

    return {
      ok: true,
      message,
      recordId,
      payload,
      parsedLead: lead,
    };
  }

  return {
    ok: false,
    message:
      typeof parsedResponse === "string" && parsedResponse
        ? parsedResponse
        : `Twenty CRM responded with status ${response.status}.`,
    payload,
    parsedLead: lead,
  };
}

/** @internal exported for unit tests */
export { buildAdfArtifactUploadKey, extractRecordId, toReadableAdfFileName };
