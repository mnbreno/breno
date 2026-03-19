export interface ExtensionSettings {
  defaultSelector: string;
  highlightDurationMs: number;
  autoScrollIntoView: boolean;
  enableLeadSound: boolean;
  enableLeadNotifications: boolean;
  twentyBaseUrl: string;
  twentyApiKey: string;
  twentyLeadEndpointPath: string;
  twentyLeadFieldMap: string;
  /** Upload each ADF as a plain-text .txt file via GraphQL + createAttachment (linked to the lead). */
  twentyUploadAdfAttachments: boolean;
  /** GraphQL path on the same host as Twenty (e.g. graphql). */
  twentyGraphqlPath: string;
  /**
   * Optional path segment for multipart uploads only (e.g. `metadata`).
   * When empty, the extension tries **POST .../metadata** first, then core GraphQL (file mutations often live on metadata only).
   */
  twentyGraphqlUploadPath: string;
  /**
   * UUID of the Attachment object's FILES field metadata (Twenty ≥ 0.40 style uploads).
   * If empty, the extension tries to read it from GET /rest/metadata/objects (`file` field on attachment).
   * Required when auto-detect fails (no `uploadFile` on your server).
   * Find it: Settings → Data model → Attachment → `file` field, or Network tab on a manual upload (`fieldMetadataId` in variables).
   */
  twentyAttachmentFileFieldMetadataId: string;
  /**
   * `AttachmentCreateInput` field linking the attachment to the lead (e.g. targetInboundLeadId).
   * Empty = inferred from twentyLeadEndpointPath (rest/inboundLeads → targetInboundLeadId for GraphQL).
   */
  twentyAttachmentParentField: string;
  /** Optional FileFolder enum value for uploadFile (e.g. Attachment). Leave empty to call uploadFile(file) only. */
  twentyUploadFileFolder: string;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  defaultSelector: "body",
  highlightDurationMs: 2000,
  autoScrollIntoView: true,
  enableLeadSound: true,
  enableLeadNotifications: true,
  twentyBaseUrl: "https://twenty.lhapache.cloud",
  twentyApiKey: "",
  twentyLeadEndpointPath: "rest/inboundLeads",
  twentyUploadAdfAttachments: true,
  twentyGraphqlPath: "graphql",
  twentyGraphqlUploadPath: "",
  twentyAttachmentFileFieldMetadataId: "",
  twentyAttachmentParentField: "",
  twentyUploadFileFolder: "",
  twentyLeadFieldMap: JSON.stringify(
    {
      name: "{{customerName}}",
      receivedAtUtc: "{{extractedAt}}",
      vendorName: "Rock City Harley-Davidson",
      payloadRaw: {
        markdown: "{{analyticsPayloadMarkdown}}",
        blocknote: null,
      },
      customerFirstName: "{{customerFirstName}}",
      customerLastName: "{{customerLastName}}",
      customerEmail: "{{customerEmail}}",
      customerPhone: "{{primaryPhone}}",
      vehicleYear: {
        value: "{{vehicleYear}}",
        type: "number",
      },
      vehicleMake: "{{vehicleMake}}",
      vehicleModel: "{{vehicleModel}}",
      vehicleVin: "{{vehicleVin}}",
      vehicleStatus: "{{vehicleStatus}}",
      providerLeadType: "{{providerLeadType}}",
      prequalifiedAmount: {
        value: "{{prequalifiedAmount}}",
        type: "number",
      },
      campaignCode: "{{campaignCode}}",
      latestInquirySubSourceRaw: "{{latestInquirySubSourceRaw}}",
      latestInquiryUpType: "{{latestInquiryUpType}}",
      latestProvider: "{{latestProvider}}",
      status: "NEW",
    },
    null,
    2,
  ),
};

export function mergeSettings(
  partial: Partial<ExtensionSettings> | undefined,
): ExtensionSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
  };
}

export function sanitizeSettings(
  value: unknown,
): Partial<ExtensionSettings> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<ExtensionSettings>;
  const next: Partial<ExtensionSettings> = {};

  if (typeof candidate.defaultSelector === "string") {
    next.defaultSelector = candidate.defaultSelector.trim() || DEFAULT_SETTINGS.defaultSelector;
  }

  if (typeof candidate.highlightDurationMs === "number" && Number.isFinite(candidate.highlightDurationMs)) {
    next.highlightDurationMs = Math.min(Math.max(candidate.highlightDurationMs, 250), 10000);
  }

  if (typeof candidate.autoScrollIntoView === "boolean") {
    next.autoScrollIntoView = candidate.autoScrollIntoView;
  }

  if (typeof candidate.enableLeadSound === "boolean") {
    next.enableLeadSound = candidate.enableLeadSound;
  }

  if (typeof candidate.enableLeadNotifications === "boolean") {
    next.enableLeadNotifications = candidate.enableLeadNotifications;
  }

  if (typeof candidate.twentyBaseUrl === "string") {
    next.twentyBaseUrl = candidate.twentyBaseUrl.trim() || DEFAULT_SETTINGS.twentyBaseUrl;
  }

  if (typeof candidate.twentyApiKey === "string") {
    next.twentyApiKey = candidate.twentyApiKey.trim();
  }

  if (typeof candidate.twentyLeadEndpointPath === "string") {
    next.twentyLeadEndpointPath =
      candidate.twentyLeadEndpointPath.trim() || DEFAULT_SETTINGS.twentyLeadEndpointPath;
  }

  if (typeof candidate.twentyLeadFieldMap === "string") {
    next.twentyLeadFieldMap = candidate.twentyLeadFieldMap.trim() || DEFAULT_SETTINGS.twentyLeadFieldMap;
  }

  if (typeof candidate.twentyUploadAdfAttachments === "boolean") {
    next.twentyUploadAdfAttachments = candidate.twentyUploadAdfAttachments;
  }

  if (typeof candidate.twentyGraphqlPath === "string") {
    next.twentyGraphqlPath =
      candidate.twentyGraphqlPath.trim().replace(/^\/+/, "") || DEFAULT_SETTINGS.twentyGraphqlPath;
  }

  if (typeof candidate.twentyGraphqlUploadPath === "string") {
    next.twentyGraphqlUploadPath = candidate.twentyGraphqlUploadPath.trim().replace(/^\/+/, "");
  }

  if (typeof candidate.twentyAttachmentFileFieldMetadataId === "string") {
    next.twentyAttachmentFileFieldMetadataId = candidate.twentyAttachmentFileFieldMetadataId.trim();
  }

  if (typeof candidate.twentyAttachmentParentField === "string") {
    next.twentyAttachmentParentField = candidate.twentyAttachmentParentField.trim();
  }

  if (typeof candidate.twentyUploadFileFolder === "string") {
    next.twentyUploadFileFolder = candidate.twentyUploadFileFolder.trim();
  }

  return next;
}
