# Content Scripts Guide

Official references:

- [MDN Content scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts)
- [MDN Modify a web page](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Modify_a_web_page)
- [MDN scripting.registerContentScripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/registerContentScripts)

## Current Project Pattern

This project uses declarative injection through the manifest:

- `content_scripts.matches` is set to `<all_urls>`
- `content.js` runs at `document_idle`

This is a good Firefox-first default because the content script is always available when the popup sends a command.

## Current Lead Extraction Order

For dealership lead pages, the content script now prioritizes extraction in this order:

1. Hidden raw-body containers such as `#InsertionPointForRawBody` on `View Email` pages
2. Visible source/context rows such as `Source`, `Sub-source`, `UpType`, and `Lead Source`
3. Generic visible/raw ADF scanning across the page as a fallback

This keeps the parser aligned with the page’s real source of truth instead of relying on rendered summaries when a hidden raw XML payload exists.

## Matter Page Bulk Sync

The content script now also detects the lead file/matter layout and injects a separate `Sync Matter to Twenty` action there.

That flow:

1. opens or reuses the `Contacts` history inside `tabsTargetFrame`
2. enumerates the visible scheduled and completed history rows
3. sorts the collected rows oldest-to-newest
4. fetches linked `viewemailmessage.aspx` detail pages directly
5. keeps all rows in the exported matter activity timeline
6. only forwards rows with detected ADF/XML into the bulk Twenty lead import

## Automotive Data Flow

The content script does not parse vehicle or prequal fields itself. Its job is to surface the raw ADF/XML and visible matter context so the shared parser can:

1. read `<vehicle>` nodes such as `year`, `make`, `model`, `interest`, and `status`
2. read provider metadata such as `<provider><leadtype>`
3. fall back to comment/CDATAs for `VIN`, `PreQual`, `PreQualified Amount`, and campaign-tracking values
4. pass that structured result into the Twenty mapping layer without losing the raw ADF document

This separation keeps DOM scraping focused on source collection while the parsing rules stay centralized in shared code and tests.

## Messaging Pattern

Content scripts should not own privileged browser orchestration. Instead:

1. Popup sends a message to background.
2. Background validates tab and settings.
3. Background forwards a typed command to the content script.
4. Content script performs DOM interaction and returns a result object.

## Commands Implemented

- `getPageInfo`
- `highlightSelector`
- `clickSelector`
- `extractText`
- `setValue`

## Best Practices

- Validate selectors before using them.
- Prefer typed payloads over stringly-typed messages.
- Keep page mutations explicit and easy to review.
- Only expose web-accessible resources that the page truly needs.
- Avoid injecting remote code or dynamically building executable code strings.
- Prefer page-owned raw data containers over scraping formatted display text when both exist.

## When To Switch To Dynamic Injection

Use `scripting.registerContentScripts()` or `scripting.executeScript()` when:

- Host access should be optional instead of always-on.
- Some commands should only load scripts on demand.
- You need per-site registration rules at runtime.

For this scaffold, declarative injection keeps the developer workflow simpler.
