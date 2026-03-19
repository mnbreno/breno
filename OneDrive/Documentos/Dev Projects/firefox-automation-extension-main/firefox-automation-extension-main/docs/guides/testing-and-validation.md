# Testing And Validation

## Local Firefox Testing

Recommended environment:

- Firefox Developer Edition
- Dedicated development profile
- `web-ext run` for temporary install and auto-reload

Commands:

```bash
npm run build
npm run run:firefox
```

Hot reload workflow:

```bash
npm run dev
```

If Developer Edition is not your default browser, set `FIREFOX_BINARY` first.

## Automated Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `web-ext lint -s dist`
- `npm run validate:amo`

## What The Custom Validator Checks

- Manifest V3 is present in the built output
- Firefox `background.scripts` is declared
- Gecko add-on ID exists
- Required built assets exist in `dist/`
- Required docs exist in `docs/`
- No remote script URLs appear in built files

## Recommended Manual Smoke Tests

1. Open the dealership dashboard page that contains the `#tdNewLeadsImage` element and verify a visible lead badge triggers a warning sound and Firefox notification.
2. Open the `View Email` page shape and confirm the extension detects ADF from the hidden `#InsertionPointForRawBody` container even though the raw XML is not visibly rendered.
3. Confirm the page receives an injected `Create in Twenty` panel in a visible email header/body area.
4. Click `Create in Twenty` and verify the panel reports success or a helpful API failure.
5. Open the lead file/matter page, confirm a separate `Sync Matter to Twenty` action appears in the header area, and verify it walks the visible `Contacts` history oldest-to-newest.
6. Confirm non-ADF history rows are retained in the synced matter timeline while only ADF-backed rows are parsed as lead inquiries.
7. Verify a vehicle-backed XML lead populates `vehicleYear`, `vehicleMake`, `vehicleModel`, `vehicleVin`, `vehicleStatus`, and `vehicleInterest` in the parsed payload or mapped Twenty fields.
8. Verify comment-derived finance fields such as `PreQual`, `PreQualified Amount`, and campaign code are captured when they are present only inside CDATA/comments.
9. Open the options page, enter the Twenty base URL, API key, endpoint path, and field-map JSON, then use `Test Twenty connection`.
10. Confirm invalid field-map placeholders fail fast with a helpful validation error instead of producing empty mapped fields.
11. Import a mixed HTML plus XML lead and confirm the XML `<customer><contact><phone>` value wins over dealer numbers found in the HTML body.
12. Import a sparse matter page with a customer phone in the matter snapshot and confirm it can replace a low-confidence HTML-derived phone.
13. Confirm repeated DOM mutations do not spam duplicate alerts for the same lead count or same ADF fingerprint.
14. Re-run the general popup actions to confirm the original automation features still work.

## Cross-Platform Checklist

- Windows: verify `FIREFOX_BINARY` path escaping and shell usage
- macOS: verify Firefox app bundle path passed to `web-ext`
- Linux: verify binary path and profile permissions
- All platforms: confirm packaged `.zip` installs and popup/options render correctly
