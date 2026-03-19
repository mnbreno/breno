# Twenty CRM Integration

This extension can import raw ADF lead content into Twenty CRM through the direct API and preserve source analytics for each inquiry.

## What The Extension Does

1. Watches the dealership page for a visible `New Leads` badge.
2. Plays a warning sound and shows a Firefox notification.
3. Reads hidden raw ADF containers such as `#InsertionPointForRawBody` when available, then falls back to generic page scanning.
4. Injects a `Create in Twenty` button directly into the page.
5. Parses the ADF into normalized lead data.
6. Merges multiple ADF sources for the same person when possible.
7. Extracts visible lead-page source details such as `Source`, `Sub-source`, and `UpType`.
8. Stores the latest inquiry source plus structured inquiry history inside Twenty CRM.
9. On the matter page, can bulk-sync the visible history oldest-to-newest and preserve the matter activity/comment timeline.
10. Sends the mapped payload to Twenty CRM.

## Required Twenty Settings

Configure these values in the extension options page:

- `Twenty CRM base URL`
- `Twenty API key`
- `Twenty lead endpoint path`
- `Twenty lead field map (JSON)`

Defaults:

- Base URL: `https://twenty.lhapache.cloud`
- Endpoint path: `rest/inboundLeads`

## API Key Setup

Create the Twenty API key in:

- `Settings -> APIs & Webhooks -> Create key`

Then copy the key into the extension options page.

Reference:

- [Twenty APIs](https://docs.twenty.com/developers/extend/capabilities/apis)

## ADF file attachments (per lead)

For matter sync and multi-ADF imports, the extension can upload **one plain-text `.txt` file per ADF** into Twenty’s **Attachments** area and link it to the same **Inbound Lead** record. Uses the same API key as REST.

1. **File bytes** — `multipart/form-data` GraphQL upload, then  
2. **`createAttachment`** — JSON `POST` to your Core GraphQL path (e.g. `/graphql`).

**Upload step (two supported styles):**

- **Legacy:** `uploadFile` mutation → returns a `fullPath` string → `createAttachment` with `fullPath`.
- **Modern (Twenty with FILES fields on Attachment):** `uploadFilesFieldFile` with an **Attachment `file` field metadata UUID** → returns `id` + `path` → `createAttachment` prefers `file: [{ fileId, label }]` and falls back to `fullPath` if needed.

If Core GraphQL returns **`Unknown type "Upload"`** or **`Cannot query field "uploadFile"`**, the extension **retries the same multipart request against `POST /metadata`** on your base URL (many self-hosted layouts expose `Upload` only there). You can also set **GraphQL path for file uploads** to `metadata` explicitly. For modern stacks, set **Attachment file field metadata id** (copy from Twenty: **Settings → Data model → Attachment → `file` field**, or from the browser Network tab when you manually attach a file — look for `fieldMetadataId` in the upload mutation variables).

**Options (extension):**

- **Upload each ADF as a separate .txt attachment** — toggle (default on).
- **GraphQL path** — default `graphql` (Core CRUD + `createAttachment`).
- **GraphQL path for file multipart uploads** — optional. When empty, the extension tries **`POST {base}/metadata` first**, then core **`POST {base}/graphql`**, because `uploadFilesFieldFile` is often only on the metadata schema. Set to **`metadata`** alone to skip the core attempt.
- **Attachment file field metadata UUID** — passed as `fieldMetadataId` to **`uploadFilesFieldFile`** on **`POST /metadata`** (multipart). If left empty, the extension reads **`GET /rest/metadata/objects?limit=1000`** and parses **`data.objects`** (array or `edges`), finds **`nameSingular: attachment`**, then **`fields` / `fieldsList` / `objectMetadataFields`** for **`name: file`**, **`type: FILES`**, and uses **`id`**. Nested `data` wrappers are unwrapped. Override manually if your workspace shape differs.
- **Attachment parent field** — leave empty to infer the GraphQL morph id from your lead path (e.g. `rest/inboundLeads` → **`targetInboundLeadId`**, matching Twenty’s `createAttachment`). Override only if your `AttachmentCreateInput` uses a different field.
- **uploadFile FileFolder** — legacy `uploadFile` only; leave empty if unused.

**Deduplication:** Upload fingerprints are stored in `payloadRaw.markdown` analytics JSON under `uploadedAdfFileKeys`. Re-running sync skips ADF bodies already uploaded.

**No files in Twenty but the lead saves:** Read the full notification / result text from the extension. It now explains common cases: **no record id** after `POST` (response JSON shape differs), **no ADF artifacts** parsed on that lead (matter rows without fetched ADF HTML), **empty ADF bodies**, or **Attachment issues:** with GraphQL errors. For record id: in DevTools → Network, open the successful `POST` to your lead path and confirm where the UUID lives (top-level `id`, `data.id`, `data.inboundLead.id`, `data[0].id`, etc.).

If uploads fail, check your workspace GraphQL schema for `AttachmentCreateInput` and `AttachmentFileCategoryEnum`, and for `uploadFile` / `FileFolder`. Capture a working mutation from Settings → API playground or the browser Network tab if needed ([Twenty discussion](https://github.com/twentyhq/twenty/issues/10776)).

## Cursor MCP Server (Twenty CRM)

The project includes the [twenty-crm-mcp-server](https://github.com/mhenry3164/twenty-crm-mcp-server) for natural-language CRM access inside Cursor.

### MCP capabilities summary

The Twenty CRM MCP server lets you work with your CRM from Cursor via natural language or direct tool calls. It talks to your Twenty instance over the REST API using the key and base URL in `.cursor/mcp.json`.

**What you can do:**

- **People, companies, notes, tasks** — List, get, create, update, and delete records (e.g. *"List the first 5 people"*, *"Create a company called Acme"*).
- **Inbound leads** — Query the custom `inboundLeads` object with `search_records` (e.g. *"Fetch inbound leads"*).
- **Schema discovery** — Ask for object metadata and fields (e.g. *"Show me the available fields for people"*) via `get_metadata_objects` and `get_object_metadata`.
- **Search** — Search across one or more object types (`people`, `companies`, `notes`, `tasks`, `inboundLeads`) with a query and optional filters.

All changes sync with your Twenty workspace. The server uses object names in core paths and maps names to UUIDs where the metadata API requires them.

### Setup

1. **Installation** (already done in this repo):
   - The server is in `twenty-crm-mcp-server/` with dependencies installed.

2. **Configure Cursor**  
   Edit `.cursor/mcp.json` in the project root and set:
   - `TWENTY_API_KEY`: Your Twenty API key (from **Settings → APIs & Webhooks** or **Settings → Playground**; same key can be used in the extension options).
   - `TWENTY_BASE_URL`: Your Twenty base URL (e.g. `https://twenty.lhapache.cloud` or `https://api.twenty.com` for cloud). No trailing slash.

3. **Restart Cursor** so it loads the MCP server.

**Available MCP tools:** `list_people`, `list_companies`, `list_notes`, `list_tasks`, `get_person`, `get_company`, `create_person`, `update_person`, `search_records` (supports `people`, `companies`, `notes`, `tasks`, `inboundLeads`), `get_metadata_objects`, `get_object_metadata` (e.g. fields for people).

### Test the connection

From the project root, run:

```bash
node scripts/test-twenty-mcp-connection.mjs
```

This calls the Twenty metadata API (`/rest/metadata/objects`). If you see `OK – Twenty CRM API is reachable`, the API key and base URL are valid; you can then use the MCP tools in Cursor (e.g. list people, fetch inbound leads). If you see `401 Unauthorized`, check the key in **Settings → APIs & Webhooks** (or **Playground**) and that `TWENTY_BASE_URL` in `.cursor/mcp.json` matches your instance (e.g. `https://twenty.lhapache.cloud` with no trailing slash).

### Usage in Cursor

Once configured, you can ask in natural language or use the MCP tools directly. Examples that work with this workspace:

- *"List the first 5 people"* — uses `list_people` with `limit: 5`
- *"Fetch inbound leads"* — use `search_records` with `objectTypes: ['inboundLeads']` and a query (e.g. `'*'`) and `limit`
- *"Show me the available fields for people"* — uses `get_object_metadata` with `objectName: 'people'`
- *"Create a new person named John Doe with email john@example.com"*
- *"Show me all companies"* — `list_companies`
- *"Create a task to follow up with John next Friday"*
- *"Search for any records mentioning 'blockchain'"* — `search_records` with `objectTypes: ['people', 'companies']` or `['inboundLeads']`

The server supports CRUD on people, companies, tasks, and notes; schema discovery (metadata); and search. The custom object **inboundLeads** is supported via `search_records` with `objectTypes: ['inboundLeads']`.

### API behavior (this workspace)

- **Core API** (list, get, create, update, delete) uses paths like `/rest/people`, `/rest/companies`, `/rest/notes`, `/rest/tasks`, `/rest/inboundLeads` (object names).
- **Metadata API** (e.g. “available fields for people”) uses object UUIDs under `/rest/metadata/objects/`. The MCP server maps names like `people` to the correct UUID for your workspace.
- **Pagination:** list endpoints return `pageInfo` with `startCursor`, `endCursor`, `hasNextPage`; use `limit` to cap page size.

### Troubleshooting

**Authentication Error:** Verify your API key is correct and has appropriate permissions (Settings → APIs & Webhooks in Twenty).

**Connection Failed:** Check that `TWENTY_BASE_URL` in `.cursor/mcp.json` is correct, especially for self-hosted instances (e.g. `https://twenty.lhapache.cloud` with no trailing slash).

**Field Not Found:** The server discovers fields from your workspace. If you get field errors, try getting metadata first, e.g. *"Show me the available fields for people"*.

## Field Mapping

The Lead object in Twenty can vary by workspace, so the extension uses a JSON field map with template placeholders.

Validated default map for your Twenty workspace:

```json
{
  "name": "{{customerName}}",
  "externalSource": "ADF_ELEADS",
  "externalId": "{{resolvedExternalId}}",
  "externalKey": "{{resolvedExternalKey}}",
  "receivedAtUtc": "{{extractedAt}}",
  "vendorName": "Rock City Harley-Davidson",
  "companyId": "789c9654-d9f8-4be9-bd56-15ee48bbaccf",
  "payloadRaw": {
    "markdown": "{{analyticsPayloadMarkdown}}",
    "blocknote": null
  },
  "customerFirstName": "{{customerFirstName}}",
  "customerLastName": "{{customerLastName}}",
  "customerEmail": "{{customerEmail}}",
  "customerPhone": "{{primaryPhone}}",
  "leadPhoneSource": "{{primaryPhoneSource}}",
  "vehicleYear": {
    "value": "{{vehicleYear}}",
    "type": "number"
  },
  "vehicleMake": "{{vehicleMake}}",
  "vehicleModel": "{{vehicleModel}}",
  "vehicleVin": "{{vehicleVin}}",
  "vehicleStatus": "{{vehicleStatus}}",
  "providerLeadType": "{{providerLeadType}}",
  "prequalStatus": "{{prequalStatus}}",
  "prequalifiedAmount": {
    "value": "{{prequalifiedAmount}}",
    "type": "number"
  },
  "isPrequalLead": {
    "value": "{{isPrequalLead}}",
    "type": "boolean"
  },
  "campaignCode": "{{campaignCode}}",
  "latestInquirySourceRaw": "{{latestInquirySourceRaw}}",
  "latestInquirySubSourceRaw": "{{latestInquirySubSourceRaw}}",
  "latestInquiryUpType": "{{latestInquiryUpType}}",
  "latestInquiryNormalizedSource": "{{latestInquiryNormalizedSource}}",
  "latestProvider": "{{latestProvider}}",
  "status": "NEW"
}
```

Creates and updates both use the same configured field map. This means any supported placeholder you add for create requests will also be applied when an existing Twenty lead is re-imported and enriched.

Typed field-map values are supported for fields that must remain numbers or booleans:

```json
{
  "vehicleYear": {
    "value": "{{vehicleYear}}",
    "type": "number"
  },
  "isPrequalLead": {
    "value": "{{isPrequalLead}}",
    "type": "boolean"
  },
  "prequalifiedAmount": {
    "value": "{{prequalifiedAmount}}",
    "type": "number"
  }
}
```

Supported typed value kinds:

- `string`
- `number`
- `boolean`

## Recommended Automotive Custom Fields

Live MCP verification of your current `inboundLeads` object shows these columns already exist:

- `customerFirstName`
- `customerLastName`
- `customerEmail`
- `customerPhone`
- `leadPhoneSource`
- `vehicleYear`
- `vehicleMake`
- `vehicleModel`
- `vehicleVin`
- `vehicleStatus`
- `providerLeadType`
- `prequalStatus`
- `prequalifiedAmount`
- `isPrequalLead`
- `campaignCode`
- `latestInquirySourceRaw`
- `latestInquirySubSourceRaw`
- `latestInquiryUpType`
- `latestInquiryNormalizedSource`
- `latestProvider`
- `status`
- `externalSource`
- `externalId`
- `externalKey`
- `vendorName`
- `receivedAtUtc`
- `payloadRaw`

The field definitions below document the custom columns that are now part of the live object and match the extension placeholders used by the default field map.

The repository does not include a verified Twenty field-creation API schema, so the JSON below is a recommended field-definition spec for your workspace, not a guaranteed Twenty REST or GraphQL payload. It is designed to match the extension's existing placeholders and parsed types.

Recommended Twenty field-definition spec:

```json
{
  "objectName": "inboundLead",
  "fields": [
    {
      "name": "vehicleVin",
      "label": "Vehicle VIN",
      "type": "text",
      "description": "Normalized 17-character vehicle identification number parsed from ADF XML or comments.",
      "nullable": true,
      "validation": {
        "maxLength": 17,
        "transform": ["trim", "uppercase", "stripNonAlphanumeric"],
        "pattern": "^[A-HJ-NPR-Z0-9]{17}$"
      },
      "sourcePlaceholder": "{{vehicleVin}}"
    },
    {
      "name": "vehicleStatus",
      "label": "Vehicle Status",
      "type": "text",
      "description": "Vehicle condition or inventory status parsed from XML such as new, used, or cpo.",
      "nullable": true,
      "validation": {
        "allowedExamples": ["new", "used", "cpo"]
      },
      "sourcePlaceholder": "{{vehicleStatus}}"
    },
    {
      "name": "providerLeadType",
      "label": "Provider Lead Type",
      "type": "text",
      "description": "Lead type supplied by the provider block, such as Internet.",
      "nullable": true,
      "sourcePlaceholder": "{{providerLeadType}}"
    },
    {
      "name": "prequalStatus",
      "label": "Prequal Status",
      "type": "text",
      "description": "Normalized finance status derived from ADF comments, such as prequalified or not_prequalified.",
      "nullable": true,
      "validation": {
        "allowedValues": ["prequalified", "not_prequalified", "unknown"],
        "fallback": "storeRawIfWorkspaceDoesNotSupportSingleSelect"
      },
      "sourcePlaceholder": "{{prequalStatus}}"
    },
    {
      "name": "prequalifiedAmount",
      "label": "Prequalified Amount",
      "type": "number",
      "description": "Numeric prequalification amount parsed from the lead comments.",
      "nullable": true,
      "validation": {
        "min": 0,
        "precision": 2,
        "transform": ["parseCurrencyString"]
      },
      "sourcePlaceholder": "{{prequalifiedAmount}}"
    },
    {
      "name": "isPrequalLead",
      "label": "Is Prequal Lead",
      "type": "boolean",
      "description": "True when the lead indicates finance or prequalification intent.",
      "nullable": true,
      "validation": {
        "acceptedTrueValues": ["true", "1", "yes", "y"],
        "acceptedFalseValues": ["false", "0", "no", "n"]
      },
      "sourcePlaceholder": "{{isPrequalLead}}"
    },
    {
      "name": "campaignCode",
      "label": "Campaign Code",
      "type": "text",
      "description": "Campaign or finance tracking code extracted from ADF comments.",
      "nullable": true,
      "sourcePlaceholder": "{{campaignCode}}"
    }
  ]
}
```

If your Twenty workspace supports stricter field types, the recommended upgrade path is:

- keep `vehicleVin` as text
- use a single-select field for `vehicleStatus` if your workspace has a stable controlled vocabulary
- keep `providerLeadType` as text
- use a single-select field for `prequalStatus`
- use currency instead of number for `prequalifiedAmount` when supported
- keep `isPrequalLead` as boolean
- keep `campaignCode` as text

## Matching Field-Map Snippet

Once those custom columns exist on the Twenty `inboundLead` object, you can add this directly to `Twenty lead field map (JSON)`:

```json
{
  "vehicleVin": "{{vehicleVin}}",
  "vehicleStatus": "{{vehicleStatus}}",
  "providerLeadType": "{{providerLeadType}}",
  "prequalStatus": "{{prequalStatus}}",
  "prequalifiedAmount": {
    "value": "{{prequalifiedAmount}}",
    "type": "number"
  },
  "isPrequalLead": {
    "value": "{{isPrequalLead}}",
    "type": "boolean"
  },
  "campaignCode": "{{campaignCode}}"
}
```

If you want a ready-to-paste full map for the current live schema plus the recommended new fields, use:

```json
{
  "name": "{{customerName}}",
  "externalSource": "ADF_ELEADS",
  "externalId": "{{resolvedExternalId}}",
  "externalKey": "{{resolvedExternalKey}}",
  "receivedAtUtc": "{{extractedAt}}",
  "vendorName": "Rock City Harley-Davidson",
  "companyId": "789c9654-d9f8-4be9-bd56-15ee48bbaccf",
  "payloadRaw": {
    "markdown": "{{analyticsPayloadMarkdown}}",
    "blocknote": null
  },
  "customerFirstName": "{{customerFirstName}}",
  "customerLastName": "{{customerLastName}}",
  "customerEmail": "{{customerEmail}}",
  "customerPhone": "{{primaryPhone}}",
  "vehicleYear": {
    "value": "{{vehicleYear}}",
    "type": "number"
  },
  "vehicleMake": "{{vehicleMake}}",
  "vehicleModel": "{{vehicleModel}}",
  "vehicleVin": "{{vehicleVin}}",
  "vehicleStatus": "{{vehicleStatus}}",
  "providerLeadType": "{{providerLeadType}}",
  "prequalStatus": "{{prequalStatus}}",
  "prequalifiedAmount": {
    "value": "{{prequalifiedAmount}}",
    "type": "number"
  },
  "isPrequalLead": {
    "value": "{{isPrequalLead}}",
    "type": "boolean"
  },
  "campaignCode": "{{campaignCode}}",
  "status": "NEW"
}
```

This snippet is repo-verified at the placeholder level because all referenced placeholders and typed wrappers are already supported by the current extension mapping logic. The only requirement is that the corresponding custom columns exist in Twenty before you enable them in the field map.

Available placeholders:

- `{{customerName}}`
- `{{customerFirstName}}`
- `{{customerLastName}}`
- `{{customerEmail}}`
- `{{dealerName}}`
- `{{dealershipWebsite}}`
- `{{primaryPhone}}`
- `{{primaryPhoneSource}}`
- `{{phoneNumbers}}`
- `{{customerStreetAddress}}`
- `{{customerCity}}`
- `{{customerState}}`
- `{{customerPostalCode}}`
- `{{customerFullAddress}}`
- `{{vehicleYear}}`
- `{{vehicleMake}}`
- `{{vehicleModel}}`
- `{{vehicleTrim}}`
- `{{vehicleVin}}`
- `{{vehicleInterest}}`
- `{{vehicleStatus}}`
- `{{providerLeadType}}`
- `{{isPrequalLead}}`
- `{{prequalStatus}}`
- `{{prequalifiedAmount}}`
- `{{campaignCode}}`
- `{{vehicleSummary}}`
- `{{plainText}}`
- `{{rawAdfHtml}}`
- `{{analyticsPayloadMarkdown}}`
- `{{sourceUrl}}`
- `{{taskId}}`
- `{{childId}}`
- `{{optOutUrl}}`
- `{{fingerprint}}`
- `{{extractedAt}}`
- `{{resolvedExternalId}}`
- `{{resolvedExternalKey}}`
- `{{latestInquirySourceRaw}}`
- `{{latestInquirySubSourceRaw}}`
- `{{latestInquiryUpType}}`
- `{{latestInquiryNormalizedSource}}`
- `{{latestProvider}}`
- `{{inquiryHistoryJson}}`
- `{{matterTimelineJson}}`
- `{{adfArtifactsJson}}`
- `{{matterCustomerSnapshotJson}}`
- `{{automotiveFieldSourcesJson}}`
- `{{parsingWarningsJson}}`

## ADF Data Extracted

The parser attempts to extract:

- customer greeting name
- dealer name
- dealership website
- phone numbers
- `lTaskID`
- `ChildId`
- communication preferences URL
- normalized plain-text body
- full raw ADF HTML
- XML ADF prospect/contact/provider fields
- XML vehicle fields such as `year`, `make`, `model`, `interest`, and `status`
- provider lead type when present in XML
- comment-derived `VIN`, `PreQual`, `PreQualified Amount`, and campaign-tracking code values
- visible lead-page source rows such as `Source`, `Sub-source`, and `UpType`
- `View Email` summary rows such as `Lead Source`

Validation and normalization rules:

- VIN values are uppercased, stripped to alphanumeric characters, and only accepted when they match the standard 17-character VIN shape excluding `I`, `O`, and `Q`.
- vehicle years are only accepted when they are within a reasonable range from `1981` to next calendar year.
- prequalified amounts are parsed as numeric values; malformed values are left unset instead of being pushed as strings.
- parser warnings are retained in the analytics payload so bad source values can be diagnosed without blocking the whole lead import.

## Multi-ADF Behavior

If the same customer sends multiple ADF files from different sources, the extension now:

- prioritizes hidden raw ADF containers such as `#InsertionPointForRawBody`,
- falls back to visible/raw page scanning when a dedicated raw-body node is absent,
- captures the current visible source/sub-source from the opportunity page,
- merges richer details such as email and additional phone values,
- searches recent `inboundLeads` for the same person by email, phone, name plus vendor, prior task IDs, child IDs, and prior ADF fingerprints,
- updates the existing Twenty record instead of creating a duplicate when a match is found,
- persists a machine-readable latest-source block inside `payloadRaw.markdown`,
- retains every raw ADF document and its source metadata in the stored inquiry history.
- preserves the visible matter activity timeline, including non-ADF rows, in the same machine-readable payload block.

## Phone Selection

`customerPhone` in Twenty still maps from `{{primaryPhone}}`, but `primaryPhone` is now resolved with a confidence hierarchy instead of `phoneNumbers[0]`.

Confidence order:

- XML customer phone with mobile or cellphone type
- other XML customer-scoped phone values
- matter snapshot phone when it needs to correct a low-confidence parsed value
- HTML phone with local customer context
- generic HTML/body regex phone fallback

Selection rules:

- malformed formatting is normalized to digits before ranking and dedupe
- mixed HTML plus XML imports prefer customer-scoped XML phones over dealer numbers scraped from the page body
- merged imports break ties by recency, so newer leads beat older leads when both phones have the same confidence
- matter snapshot phones are allowed to replace low-confidence HTML-derived values while keeping the replaced number in `phoneNumbers`
- low-confidence generic HTML phones are not used for phone-only Twenty matching, which reduces false-positive merges

## Source Normalization

Visible and parsed source labels are normalized into analytics-friendly buckets:

- `facebook`
- `tiktok`
- `website`
- `motomate`
- `coupon`
- `direct`
- `other`
- `unknown`

The raw values are still preserved exactly as seen on the page, for example `MotoMate123` and `Coupon Lead`.

## Extraction Order

The content script currently extracts lead data in this order:

1. `#InsertionPointForRawBody` hidden raw-body content on the `View Email` page
2. visible page/body source rows such as `Source`, `Sub-source`, and `Lead Source` for enrichment
3. generic visible/raw ADF scanning as a fallback for other lead page layouts

## History Serialization

When the workspace does not yet expose dedicated custom fields for latest source, inquiry history, or file attachments, the extension stores a stable machine-readable block in `payloadRaw.markdown` containing:

- latest source
- latest sub-source
- latest normalized source
- latest provider
- latest inquiry timestamp
- full inquiry history array with raw ADF fingerprint, raw ADF document, task ID, and child ID
- full matter activity timeline with comments, outcomes, and whether each row contained ADF
- individual ADF artifact entries with stable filenames and raw XML/HTML content blocks

## Notes About Twenty Requests

- The extension authenticates with `Authorization: Bearer YOUR_API_KEY`. Paste the key from Twenty **Settings → APIs & Webhooks** as the **token only**, or as a single `Bearer <token>` string. If you paste `Bearer …` and the request still fails with **401**, remove the word `Bearer` and save only the token (the extension sends `Bearer` for you).
- It posts to the configured endpoint path under the configured base URL.
- The extension posts a direct JSON payload to the configured endpoint path.
- Unknown placeholders in the field map are rejected before the request is sent.
- If a typed field-map coercion fails for a number or boolean field, the outgoing mapped value is omitted instead of sending a misleading string.

The current self-hosted workspace at [`https://twenty.lhapache.cloud/`](https://twenty.lhapache.cloud/) was validated with a live create against `POST /rest/inboundLeads`, using a direct JSON payload.
