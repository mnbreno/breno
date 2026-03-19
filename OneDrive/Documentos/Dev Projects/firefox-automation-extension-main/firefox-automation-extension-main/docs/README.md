# Firefox Extension Documentation

This project is a complete Firefox-first WebExtension scaffold for browser automation.

It now also includes a dealership lead workflow that can:

- detect visible `New Leads` badges in the page,
- play a warning sound and raise a Firefox notification,
- detect raw ADF lead data inside a lead page, prioritizing hidden raw-body containers such as `#InsertionPointForRawBody`,
- inject a single in-page `Create in Twenty` button in the most useful visible location for the current page layout,
- inject a separate one-click `Sync Matter to Twenty` action on the lead file/matter page,
- parse the ADF and submit it to Twenty CRM,
- extract structured automotive values such as vehicle year, make, model, VIN, and prequal metadata for downstream mapping.

## Included

- Manifest V3 extension structure with popup, options page, background script, and content script.
- TypeScript + webpack build pipeline.
- Firefox development workflow via `web-ext`.
- ESLint with Mozilla rules and Jest unit tests.
- AMO-oriented validation and signing helpers.

## Quick Start

```bash
npm install
npm run build
npm run run:firefox
```

Recommended setup:

- configure Twenty settings in the extension options page before testing imports
- use `npm run dev` while iterating on content-script behavior
- test both the opportunity page layout and the `View Email` page layout
- verify both the page-level import and the whole-matter bulk sync action
- verify the workspace field map matches the available Twenty columns for vehicle and finance data

For hot reload during development:

```bash
npm run dev
```

If you want Firefox Developer Edition specifically, set `FIREFOX_BINARY` before running:

```powershell
$env:FIREFOX_BINARY="C:\Program Files\Firefox Developer Edition\firefox.exe"
npm run run:firefox
```

## Main Scripts

- `npm run build`: production bundle into `dist/`
- `npm run build:dev`: development bundle once
- `npm run watch`: rebuild on source changes
- `npm run dev`: webpack watch plus `web-ext run`
- `npm run lint`: ESLint with Mozilla + TypeScript rules
- `npm run typecheck`: strict TypeScript validation
- `npm run test`: Jest unit tests
- `npm run package`: build `.zip` package via `web-ext build`
- `npm run validate:amo`: build, lint, typecheck, test, `web-ext lint`, custom validation
- `npm run sign`: prepare source archive and submit signed build with AMO credentials

## Project Layout

- `manifest.json`: Firefox extension metadata and permissions
- `src/background/`: background orchestration and message routing
- `src/content/`: DOM automation execution
- `src/popup/`: toolbar UI for running commands
- `src/options/`: settings UI backed by `browser.storage.local`
- `src/shared/`: typed request/response contracts and settings helpers
- `assets/`: icons and overlay styles
- `tests/unit/`: Jest coverage for shared logic and validation helpers
- `scripts/`: Firefox launch, signing, and validation utilities

## Documentation Map

- `docs/api/webextensions-core.md`
- `docs/api/permissions-and-security.md`
- `docs/guides/content-scripts.md`
- `docs/guides/background-and-events.md`
- `docs/guides/testing-and-validation.md`
- `docs/guides/firefox-compatibility.md`
- `docs/guides/twenty-crm-integration.md`
- `docs/troubleshooting/common-issues.md`
- `CHANGELOG.md`

## Official Mozilla References

- [MDN WebExtensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [MDN JavaScript APIs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API)
- [MDN manifest.json](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json)
- [MDN Background scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Background_scripts)
- [MDN Content scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts)
- [web-ext command reference](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/webextensions/web-ext_command_reference)
- [Extension Workshop: Request the right permissions](https://extensionworkshop.com/documentation/develop/request-the-right-permissions/)
- [Extension Workshop: Manifest V3 migration guide](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide)

## Signing Setup

`npm run sign` expects:

- `AMO_JWT_ISSUER`
- `AMO_JWT_SECRET`
- optional `AMO_CHANNEL` with `listed` or `unlisted`

The script builds the extension, creates a source archive, and uploads both through `web-ext sign`.
