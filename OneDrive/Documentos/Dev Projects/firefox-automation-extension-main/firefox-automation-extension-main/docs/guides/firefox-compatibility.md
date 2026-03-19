# Firefox Compatibility Guide

## Firefox-Specific Development Notes

- Firefox supports Manifest V3, but background handling differs from Chrome.
- Firefox-first code should prefer the `browser` namespace and promise-based APIs.
- Internal pages such as `about:` are not valid automation targets.
- Host permissions are shown to users during install on modern Firefox releases.

## Key References

- [MDN WebExtensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [MDN background key browser support notes](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)
- [Extension Workshop MV3 migration guide](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide)

## Design Choices In This Project

- Uses `background.scripts` for Firefox MV3 compatibility.
- Uses the `browser` namespace directly.
- Uses manifest-declared content scripts to simplify Firefox testing.
- Declares `browser_specific_settings.gecko.id` for AMO packaging readiness.
- Targets Firefox 140+ desktop and 142+ Android to align with Mozilla's built-in data-consent metadata requirements.

## Compatibility Notes If You Later Add Chrome Support

- Add `background.service_worker` for Chrome MV3.
- Review messaging patterns that depend on Firefox promise behavior.
- Re-test any background code that assumes a document-style background context.
- Revisit install prompts caused by `host_permissions`.

## Testing Procedure For Firefox

1. Build the extension.
2. Launch with `web-ext run`.
3. Verify popup actions on an HTTPS page.
4. Verify internal pages are rejected cleanly.
5. Verify options persist after browser restart.
