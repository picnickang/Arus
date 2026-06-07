# Vessel Intelligence v2 Audit Gap Report

## Current State Before This Pass

- The existing client route family and navigation migration for Vessel Intelligence are present.
- `client/src/pages/vessel-intelligence` renders an operational shell and binds live vessel, equipment, work order, alert, and PdM reads.
- Section maps, diagram types, thumbnail fallback rules, and equipment mapping are local TypeScript constants.
- `server/domains/schematic-layout` manages a vessel JSON zone/slot layout, but it does not provide versioned replaceable diagrams, normalized section polygons, thumbnail overrides, upload validation, rollback, or publish validation.

## Gaps Addressed In This Pass

- Add the exported design package under `docs/design/vessel-intelligence-v2` and document the frame, token, route, responsive, and state contracts.
- Add a dedicated vessel diagram registry domain instead of extending the existing schematic-layout helper.
- Add a tenant-scoped schema for diagrams, versions, section maps, sections, polygons, equipment assignments, thumbnails, and validation results.
- Add secure SVG/file validation before diagram version registration.
- Add API endpoints under `/api/vessel-intelligence/:vesselId/...`.

## Remaining Gaps

- Pixel-perfect parity with every desktop and mobile SVG frame requires further UI iteration and Playwright visual baselines.
- Browser-file object storage is represented by sanitized metadata and object-key scaffolding in this pass; complete binary persistence should be wired to the app's object-storage upload flow before large production media rollout.
