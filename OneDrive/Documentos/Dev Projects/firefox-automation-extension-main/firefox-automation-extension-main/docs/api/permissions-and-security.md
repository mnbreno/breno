# Permissions And Security

Mozilla guidance:

- [MDN permissions key](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions)
- [Extension Workshop: Request the right permissions](https://extensionworkshop.com/documentation/develop/request-the-right-permissions/)
- [Mozilla add-on policies](https://developer.mozilla.org/en-us/add-ons/amo/policy/reviews)

## Permissions In This Scaffold

- `activeTab`: user-initiated access through popup interactions
- `storage`: save extension settings
- `tabs`: query the active tab and send tab-scoped messages
- `host_permissions: ["<all_urls>"]`: enable automation on arbitrary websites
- `browser_specific_settings.gecko.data_collection_permissions.required: ["none"]`: declares that the scaffold does not collect or transmit user data

## Why `<all_urls>` Is Included

Automation extensions often need to work on many domains. This scaffold includes broad host access so the project works immediately.

Before publishing, consider narrowing `host_permissions` to the specific sites your automation actually needs. Doing so reduces install friction and helps AMO review.

## Security Rules Followed

- No remote JavaScript or remote CSS is loaded.
- All automation is performed by bundled content scripts.
- Settings are stored locally with `browser.storage.local`.
- Background logic rejects Firefox internal URLs such as `about:` and `moz-extension:`.
- Validation scripts check for remote script references in build output.

## AMO Review Notes

- Explain clearly why host permissions are needed.
- Keep the add-on description aligned with actual behavior.
- If the production bundle is processed, upload readable source code during signing.
- Avoid surprise behavior: do not automate pages without clear user intent.
