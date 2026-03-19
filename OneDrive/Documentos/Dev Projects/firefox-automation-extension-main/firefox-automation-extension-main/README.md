# Firefox Automation Extension

A Firefox-first WebExtension for dealership automation workflows, lead detection, ADF extraction, and Twenty CRM syncing.

## Highlights

- Detects visible `New Leads` badges and raises sound/notification alerts.
- Extracts raw ADF from hidden `#InsertionPointForRawBody` containers on `View Email` pages.
- Falls back to generic visible/raw page scanning on other lead pages.
- Injects a single in-page `Create in Twenty` action in the most useful visible location for each page layout.
- Adds a separate one-click `Sync Matter to Twenty` action on the lead file/matter page to traverse visible history oldest-to-newest.
- Parses and merges multi-source ADF payloads, then enriches existing Twenty CRM leads instead of creating unnecessary duplicates.
- Extracts structured automotive fields such as vehicle year, make, model, VIN, prequal status, prequalified amount, and campaign code when present.
- Preserves latest source analytics, inquiry history, matter activity timeline, and per-ADF artifact blocks inside the Twenty payload.

## Installation

Requirements:

- Node.js `>=22`
- npm
- Firefox or Firefox Developer Edition

Install dependencies and build:

```bash
npm install
npm run build
```

Run the extension in Firefox:

```bash
npm run run:firefox
```

For live rebuilds during development:

```bash
npm run dev
```

If you use Firefox Developer Edition on Windows:

```powershell
$env:FIREFOX_BINARY="C:\Program Files\Firefox Developer Edition\firefox.exe"
npm run run:firefox
```

On Linux, `npm run dev` / `web-ext run` needs a Firefox binary on `PATH`. The launcher tries `firefox` then `firefox-esr` and passes `--firefox` to `web-ext` automatically. If neither exists (typical on a headless VPS), install a browser package or point at a binary you copied from your workstation:

```bash
# Debian/Ubuntu example
sudo apt update && sudo apt install -y firefox-esr

# Or set explicitly (also works for Flatpak/snap installs if you know the path)
export FIREFOX_BINARY=/usr/bin/firefox-esr
npm run dev
```

## Usage Examples

Example 1: Import a lead from the `View Email` page.

1. Open a lead email page that contains a hidden `#InsertionPointForRawBody`.
2. Wait for the in-page `Create in Twenty` button to appear near the page header.
3. Click the button to parse the ADF and create or enrich the corresponding lead in Twenty CRM.

Example 2: Update an existing lead with richer ADF data.

1. Open a later inquiry for an already imported customer.
2. Click `Create in Twenty` again.
3. The extension re-runs matching and updates the existing Twenty lead with new values such as email, phone, source history, and the latest inquiry source.

Example 3: Sync the whole visible matter history from the opportunity page.

1. Open the lead file/matter page that hosts the `Contacts` history inside `tabsTargetFrame`.
2. Click `Sync Matter to Twenty` in the opportunity header area.
3. The extension walks the visible history oldest-to-newest, fetches each linked email/detail page, skips non-ADF pages for parsing, and sends the merged ADF history plus the full matter activity timeline to Twenty CRM.

## Configuration

Set these values in the options page before importing into Twenty CRM:

- `Twenty CRM base URL`
- `Twenty API key`
- `Twenty lead endpoint path`
- `Twenty lead field map (JSON)`

The default field map now includes first-class vehicle placeholders for workspaces that expose `Vehicle Year`, `Vehicle Make`, and `Vehicle Model` fields. Advanced mappings can also use typed values for fields that must remain numbers or booleans, for example:

```json
{
  "vehicleYear": {
    "value": "{{vehicleYear}}",
    "type": "number"
  },
  "isPrequalLead": {
    "value": "{{isPrequalLead}}",
    "type": "boolean"
  }
}
```

If a field map references an unknown placeholder, the import now fails early with a validation error instead of silently sending an empty value.

For a ready-to-copy recommended Twenty custom-field spec for `vehicleVin`, `prequalStatus`, `prequalifiedAmount`, and `isPrequalLead`, see the `Recommended Automotive Custom Fields` section in the [Twenty CRM integration guide](docs/guides/twenty-crm-integration.md).

Default API target:

- Base URL: `https://twenty.lhapache.cloud`
- Endpoint path: `rest/inboundLeads`

## Open-source / public repo checklist

- **Never commit** Twenty API keys, JWTs, or `.cursor/mcp.json` with real credentials. This repo gitignores `.cursor/mcp.json`; copy [`.cursor/mcp.json.example`](.cursor/mcp.json.example) to `.cursor/mcp.json` locally.
- If a key was ever in git history, **revoke and recreate** it in Twenty (Settings → APIs & Webhooks) before going public.
- `package.json` has `"private": true`; set to `false` or remove if you publish the package to npm (optional).

## API References

- [Twenty CRM integration guide](docs/guides/twenty-crm-integration.md)
- [Content scripts guide](docs/guides/content-scripts.md)
- [Background and events guide](docs/guides/background-and-events.md)
- [Testing and validation guide](docs/guides/testing-and-validation.md)
- [WebExtensions core API notes](docs/api/webextensions-core.md)
- [Permissions and security notes](docs/api/permissions-and-security.md)

## Project Map

- Project and workflow docs: `docs/README.md`
- Extension manifest: `manifest.json`
- Source code: `src/`
- Release notes: `CHANGELOG.md`
