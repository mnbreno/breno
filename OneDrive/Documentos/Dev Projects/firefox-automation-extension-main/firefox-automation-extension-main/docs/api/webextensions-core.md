# WebExtensions Core API Reference

This scaffold centers on the Firefox WebExtensions model documented by MDN:

- [WebExtensions overview](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [JavaScript API reference](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API)
- [manifest.json reference](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json)

## APIs Used In This Project

### `browser.runtime`

Used for internal extension messaging between popup, background, and content script.

Relevant docs:

- [runtime API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime)
- [runtime.sendMessage](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/sendMessage)
- [runtime.onMessage](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage)

Project usage:

- Popup sends typed requests to background.
- Background routes commands and replies with structured results.
- Content script listens for forwarded automation commands.

### `browser.tabs`

Used to locate the active tab and send commands into the tab.

Relevant docs:

- [tabs API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs)
- [tabs.query](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/query)
- [tabs.sendMessage](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/sendMessage)

Project usage:

- Background obtains the active tab.
- Background forwards automation commands to the content script in that tab.

### `browser.storage`

Used for extension settings such as selector defaults and highlight behavior.

Relevant docs:

- [storage API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage)
- [storage.local](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local)

Project usage:

- `runtime.onInstalled` initializes defaults.
- Options page persists settings.
- Background loads settings before executing actions.

## Manifest Keys Used

- `manifest_version`
- `browser_specific_settings`
- `background`
- `action`
- `options_ui`
- `permissions`
- `host_permissions`
- `content_scripts`
- `web_accessible_resources`

The manifest intentionally uses Firefox-compatible `background.scripts` for MV3 because Firefox does not currently rely on the Chrome-only service-worker model as the primary Firefox path.

Reference:

- [MDN background key](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)

## Implementation Pattern

1. Popup gathers user input.
2. Popup sends a typed `runAutomation` message.
3. Background validates the active tab and settings.
4. Background forwards the command with `tabs.sendMessage`.
5. Content script performs DOM work and returns a typed result object.
