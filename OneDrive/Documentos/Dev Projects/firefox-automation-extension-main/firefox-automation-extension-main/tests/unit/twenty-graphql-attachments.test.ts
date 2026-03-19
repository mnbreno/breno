import {
  clearTwentyAttachmentFileFieldMetadataCache,
  createTwentyLead,
} from "../../src/background/twenty";
import type { ParsedAdfLead } from "../../src/shared/lead";
import { DEFAULT_SETTINGS, type ExtensionSettings } from "../../src/shared/settings";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function minimalLeadForAttachments(): ParsedAdfLead {
  return {
    fingerprint: "adf_test_fp",
    sourceUrl: "https://dealer.example/lead/1",
    source: "adf",
    sourceProvider: "Src",
    pageContext: {
      rawSource: null,
      rawSubSource: null,
      rawUpType: null,
      normalizedSource: "unknown",
    },
    rawAdfHtml: "",
    rawAdfDocuments: [],
    plainText: "",
    customerName: "Test User",
    customerFirstName: "Test",
    customerLastName: "User",
    customerEmail: "test@example.com",
    customerStreetAddress: null,
    customerCity: null,
    customerState: null,
    customerPostalCode: null,
    customerFullAddress: null,
    dealerName: "Dealer",
    dealershipWebsite: null,
    phoneNumbers: [],
    primaryPhone: null,
    primaryPhoneSource: null,
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
    requestDate: "2026-03-11T00:00:00.000Z",
    optOutUrl: null,
    taskId: "t1",
    childId: "c1",
    latestInquirySourceRaw: null,
    latestInquirySubSourceRaw: null,
    latestInquiryUpType: null,
    latestInquiryNormalizedSource: "unknown",
    inquiryHistory: [],
    matterTimeline: [],
    adfArtifacts: [
      {
        fileName: "lead.adf.xml",
        contentType: "text/xml",
        content: "<?adf version=\"1.0\"?><adf><x/></adf>",
        sourceUrl: "https://dealer.example/lead/1",
        taskId: "t1",
        completedAt: null,
      },
    ],
    matterCustomerSnapshot: null,
    automotiveFieldSources: {
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
    parsingWarnings: [],
    extractedAt: "2026-03-10T00:00:00.000Z",
  };
}

function attachmentTestSettings(): ExtensionSettings {
  return {
    ...DEFAULT_SETTINGS,
    twentyBaseUrl: "https://api.example.com",
    twentyApiKey: "test-api-key",
    twentyLeadEndpointPath: "rest/inboundLeads",
    twentyUploadAdfAttachments: true,
    twentyGraphqlPath: "graphql",
  };
}

/** Empty metadata list so legacy uploadFile path stays testable when field id option is blank. */
function metadataObjectsEmptyResponse(): Response {
  return jsonResponse({ data: { objects: { edges: [] } } });
}

/** Mirrors modern Twenty: `POST /metadata` has no `uploadFile`; core `/graphql` may still run legacy tests. */
function metadataRejectsLegacyUploadFile(url: string, init?: RequestInit): Response | undefined {
  if (url !== "https://api.example.com/metadata" || !(init?.body instanceof FormData)) {
    return undefined;
  }
  const ops = String((init.body as FormData).get("operations"));
  if (ops.includes("uploadFile")) {
    return jsonResponse({
      errors: [{ message: 'Cannot query field "uploadFile" on type "Mutation"' }],
    });
  }
  return undefined;
}

describe("Twenty ADF attachments (GraphQL)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    clearTwentyAttachmentFileFieldMetadataCache();
  });

  it("after uploadFile, creates attachment via GraphQL createAttachment with TEXT_DOCUMENT", async () => {
    const createAttachmentBodies: Array<{ query: string; variables: { data: Record<string, unknown> } }> = [];

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      if (url.includes("/rest/metadata/objects")) {
        return metadataObjectsEmptyResponse();
      }

      const metaLegacyRejection = metadataRejectsLegacyUploadFile(url, init);
      if (metaLegacyRejection) return metaLegacyRejection;

      if (url.includes("/rest/inboundLeads") && url.includes("limit=100") && (init?.method ?? "GET") === "GET") {
        return jsonResponse({ data: { inboundLeads: [] } });
      }

      if (url === "https://api.example.com/rest/inboundLeads" && init?.method === "POST") {
        return jsonResponse({ data: { inboundLead: { id: "new-lead-id" } } });
      }

      if (url === "https://api.example.com/graphql") {
        if (init?.body instanceof FormData) {
          return jsonResponse({ data: { uploadFile: "/workspace/uploads/adf.txt" } });
        }
        const parsed = JSON.parse(init?.body as string) as {
          query: string;
          variables: { data: Record<string, unknown> };
        };
        createAttachmentBodies.push(parsed);
        return jsonResponse({ data: { createAttachment: { id: "attachment-uuid" } } });
      }

      if (url === "https://api.example.com/rest/inboundLeads/new-lead-id" && init?.method === "PATCH") {
        return jsonResponse({ ok: true });
      }

      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    const result = await createTwentyLead(minimalLeadForAttachments(), attachmentTestSettings());

    expect(result.ok).toBe(true);
    expect(createAttachmentBodies).toHaveLength(1);
    expect(createAttachmentBodies[0].query).toContain("createAttachment");
    expect(createAttachmentBodies[0].variables.data.fileCategory).toBe("TEXT_DOCUMENT");
    expect(createAttachmentBodies[0].variables.data.fullPath).toBe("/workspace/uploads/adf.txt");
    expect(createAttachmentBodies[0].variables.data.targetInboundLeadId).toBe("new-lead-id");
    expect(typeof createAttachmentBodies[0].variables.data.name).toBe("string");
    expect(String(createAttachmentBodies[0].variables.data.name)).toMatch(/\.txt$/);

    const fetchMock = global.fetch as jest.Mock;
    expect(fetchMock).toHaveBeenCalled();

    const graphqlCalls = fetchMock.mock.calls.filter(
      ([u]) => String(u) === "https://api.example.com/graphql",
    );
    expect(graphqlCalls).toHaveLength(2);
    expect(graphqlCalls[0][1]?.body).toBeInstanceOf(FormData);
    expect(typeof graphqlCalls[1][1]?.body).toBe("string");
  });

  it("uses uploadFilesFieldFile + file fileId on createAttachment when field metadata id is set", async () => {
    const createAttachmentBodies: Array<{ query: string; variables: { data: Record<string, unknown> } }> = [];

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      if (url.includes("/rest/metadata/objects")) {
        return metadataObjectsEmptyResponse();
      }

      if (url.includes("/rest/inboundLeads") && url.includes("limit=100") && (init?.method ?? "GET") === "GET") {
        return jsonResponse({ data: { inboundLeads: [] } });
      }

      if (url === "https://api.example.com/rest/inboundLeads" && init?.method === "POST") {
        return jsonResponse({ data: { inboundLead: { id: "lead-mod" } } });
      }

      if (
        (url === "https://api.example.com/metadata" || url === "https://api.example.com/graphql") &&
        init?.body instanceof FormData
      ) {
        const ops = (init.body as FormData).get("operations");
        expect(String(ops)).toContain("uploadFilesFieldFile");
        return jsonResponse({
          data: {
            uploadFilesFieldFile: {
              id: "file-uuid-1",
              path: "/workspace/files-field/adf.txt",
            },
          },
        });
      }

      if (url === "https://api.example.com/graphql") {
        const parsed = JSON.parse(init?.body as string) as {
          query: string;
          variables: { data: Record<string, unknown> };
        };
        createAttachmentBodies.push(parsed);
        return jsonResponse({ data: { createAttachment: { id: "att-mod" } } });
      }

      if (url === "https://api.example.com/rest/inboundLeads/lead-mod" && init?.method === "PATCH") {
        return jsonResponse({ ok: true });
      }

      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    const settings: ExtensionSettings = {
      ...attachmentTestSettings(),
      twentyAttachmentFileFieldMetadataId: "11111111-1111-1111-1111-111111111111",
    };

    await createTwentyLead(minimalLeadForAttachments(), settings);

    expect(createAttachmentBodies).toHaveLength(1);
    const fileField = createAttachmentBodies[0].variables.data.file as { fileId: string; label: string }[];
    expect(fileField[0].fileId).toBe("file-uuid-1");
    expect(fileField[0].label).toMatch(/\.txt$/);
  });

  it("resolves Attachment file field id from /rest/metadata/objects when option is blank", async () => {
    const createAttachmentBodies: Array<{ query: string; variables: { data: Record<string, unknown> } }> = [];
    let metadataCalls = 0;

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      if (url.includes("/rest/metadata/objects")) {
        metadataCalls += 1;
        return jsonResponse({
          data: {
            objects: {
              edges: [
                {
                  node: {
                    nameSingular: "attachment",
                    namePlural: "attachments",
                    fields: {
                     edges: [
                        {
                          node: {
                            id: "auto-detected-field-uuid",
                            name: "file",
                            type: "FILES",
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        });
      }

      if (url.includes("/rest/inboundLeads") && url.includes("limit=100") && (init?.method ?? "GET") === "GET") {
        return jsonResponse({ data: { inboundLeads: [] } });
      }

      if (url === "https://api.example.com/rest/inboundLeads" && init?.method === "POST") {
        return jsonResponse({ data: { inboundLead: { id: "lead-auto" } } });
      }

      if (
        (url === "https://api.example.com/metadata" || url === "https://api.example.com/graphql") &&
        init?.body instanceof FormData
      ) {
        const ops = String((init.body as FormData).get("operations"));
        expect(ops).toContain("uploadFilesFieldFile");
        expect(ops).toContain("auto-detected-field-uuid");
        return jsonResponse({
          data: {
            uploadFilesFieldFile: {
              id: "uploaded-file-id",
              path: "files-field/x/y.txt",
            },
          },
        });
      }

      if (url === "https://api.example.com/graphql") {
        const parsed = JSON.parse(init?.body as string) as {
          query: string;
          variables: { data: Record<string, unknown> };
        };
        createAttachmentBodies.push(parsed);
        return jsonResponse({ data: { createAttachment: { id: "att-auto" } } });
      }

      if (url === "https://api.example.com/rest/inboundLeads/lead-auto" && init?.method === "PATCH") {
        return jsonResponse({ ok: true });
      }

      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    const settings: ExtensionSettings = {
      ...attachmentTestSettings(),
      twentyAttachmentFileFieldMetadataId: "",
    };

    await createTwentyLead(minimalLeadForAttachments(), settings);

    expect(metadataCalls).toBe(1);
    expect(createAttachmentBodies).toHaveLength(1);
    const fileField = createAttachmentBodies[0].variables.data.file as { fileId: string }[];
    expect(fileField[0].fileId).toBe("uploaded-file-id");
  });

  it("auto-detects file field id from data.objects[] with flat fields[] (REST shape)", async () => {
    const createAttachmentBodies: Array<{ query: string; variables: { data: Record<string, unknown> } }> = [];

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      if (url.includes("/rest/metadata/objects")) {
        return jsonResponse({
          data: {
            objects: [
              {
                nameSingular: "person",
                namePlural: "people",
                fields: [],
              },
              {
                nameSingular: "attachment",
                namePlural: "attachments",
                fields: [
                  {
                    id: "flat-field-uuid-001",
                    name: "file",
                    type: "FILES",
                  },
                ],
              },
            ],
          },
        });
      }

      if (url.includes("/rest/inboundLeads") && url.includes("limit=100") && (init?.method ?? "GET") === "GET") {
        return jsonResponse({ data: { inboundLeads: [] } });
      }

      if (url === "https://api.example.com/rest/inboundLeads" && init?.method === "POST") {
        return jsonResponse({ data: { inboundLead: { id: "lead-flat" } } });
      }

      if (
        (url === "https://api.example.com/metadata" || url === "https://api.example.com/graphql") &&
        init?.body instanceof FormData
      ) {
        expect(String((init.body as FormData).get("operations"))).toContain("flat-field-uuid-001");
        return jsonResponse({
          data: {
            uploadFilesFieldFile: { id: "up-flat", path: "files-field/x.txt" },
          },
        });
      }

      if (url === "https://api.example.com/graphql") {
        const parsed = JSON.parse(init?.body as string) as {
          variables: { data: Record<string, unknown> };
        };
        createAttachmentBodies.push(parsed as { query: string; variables: { data: Record<string, unknown> } });
        return jsonResponse({ data: { createAttachment: { id: "a-flat" } } });
      }

      if (url === "https://api.example.com/rest/inboundLeads/lead-flat" && init?.method === "PATCH") {
        return jsonResponse({ ok: true });
      }

      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    await createTwentyLead(minimalLeadForAttachments(), {
      ...attachmentTestSettings(),
      twentyAttachmentFileFieldMetadataId: "",
    });

    expect(createAttachmentBodies).toHaveLength(1);
    const fileField = createAttachmentBodies[0].variables.data.file as { fileId: string }[];
    expect(fileField[0].fileId).toBe("up-flat");
  });

  it("PATCHes lead payloadRaw.markdown after attachment sync with uploadedAdfFileKeys", async () => {
    let patchBody: string | undefined;

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      if (url.includes("/rest/metadata/objects")) {
        return metadataObjectsEmptyResponse();
      }

      const metaLegacy = metadataRejectsLegacyUploadFile(url, init);
      if (metaLegacy) return metaLegacy;

      if (url.includes("/rest/inboundLeads") && url.includes("limit=100") && (init?.method ?? "GET") === "GET") {
        return jsonResponse({ data: { inboundLeads: [] } });
      }

      if (url === "https://api.example.com/rest/inboundLeads" && init?.method === "POST") {
        return jsonResponse({ data: { inboundLead: { id: "lead-2" } } });
      }

      if (url === "https://api.example.com/graphql") {
        if (init?.body instanceof FormData) {
          return jsonResponse({ data: { uploadFile: "/path/file.txt" } });
        }
        return jsonResponse({ data: { createAttachment: { id: "a1" } } });
      }

      if (url === "https://api.example.com/rest/inboundLeads/lead-2" && init?.method === "PATCH") {
        patchBody = init?.body as string;
        return jsonResponse({ ok: true });
      }

      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    await createTwentyLead(minimalLeadForAttachments(), attachmentTestSettings());

    expect(patchBody).toBeDefined();
    const patch = JSON.parse(patchBody!) as {
      payloadRaw?: { markdown?: string };
    };
    expect(patch.payloadRaw?.markdown).toContain("uploadedAdfFileKeys");
    expect(patch.payloadRaw?.markdown).toMatch(/"uploadedAdfFileKeys"\s*:\s*\[/);
  });
});
