# Common Issues

## `web-ext run` Cannot Find Firefox

Set `FIREFOX_BINARY` explicitly:

```powershell
$env:FIREFOX_BINARY="C:\Program Files\Firefox Developer Edition\firefox.exe"
npm run run:firefox
```

## Popup Loads But Commands Fail

Likely causes:

- You are on an unsupported page such as `about:addons`
- The tab did not match content-script permissions
- The selector is invalid or returns no element

Check the popup output and the Browser Toolbox console.

## ESLint Fails Immediately

This project uses ESLint 9 flat config through `eslint.config.mjs`.

If editor integration still points at legacy config, re-run `npm run lint` from the terminal and ensure the editor uses the workspace ESLint version.

## `web-ext lint` Rejects The Package

Review:

- host permissions breadth
- remote code or remote asset references
- add-on description accuracy
- missing source-code upload for bundled builds

## Signing Fails

Confirm:

- `AMO_JWT_ISSUER` is set
- `AMO_JWT_SECRET` is set
- `AMO_CHANNEL` is `listed` or `unlisted`
- the AMO API credentials are valid for the target account

## Automation Does Not Affect The Page

Verify:

- the selector matches a live element
- the element is not inside a cross-origin iframe
- the page is not protected by browser restrictions
- the page does not immediately overwrite DOM changes after interaction
