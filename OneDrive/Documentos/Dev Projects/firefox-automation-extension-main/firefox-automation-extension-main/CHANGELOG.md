# Changelog

## v0.2.1

Documentation refresh for the automotive lead parsing and Twenty CRM mapping release.

### Added

- documentation for structured automotive parsing of vehicle year, make, model, VIN, vehicle status, and prequal metadata
- typed `twentyLeadFieldMap` examples for number and boolean mappings
- testing guidance for VIN, prequal, campaign-code, and field-map validation scenarios

### Changed

- Twenty CRM integration docs now reflect that the configurable field map applies to both create and update requests
- README and guide content now describe the latest automotive placeholders, validation behavior, and mapping expectations

### Verified

- `npm test -- --runInBand`
- `npm run build`
- `npm run lint`

## v0.2.0

Stable snapshot of the Firefox automation extension after the lead-import and `View Email` extraction improvements.

### Added

- hidden raw-body ADF extraction support for `View Email` pages via `#InsertionPointForRawBody`
- lead-source analytics tracking for latest source, sub-source, and inquiry history
- content-side helper coverage for hidden raw-body extraction and email-page source parsing
- richer top-level documentation, installation guidance, and usage examples

### Changed

- the email page now shows a single `Create in Twenty` action instead of duplicate import buttons
- repeated imports can enrich an existing Twenty lead with richer ADF details such as email and updated provenance
- Twenty payload documentation now reflects analytics serialization and extraction priority

### Verified

- `npm test -- --runInBand`
- `npm run build`
