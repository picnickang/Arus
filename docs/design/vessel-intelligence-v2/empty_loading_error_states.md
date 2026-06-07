# Vessel Intelligence v2 Empty, Loading, And Error States

## Loading

- Show compact panel skeletons or loading labels in the same layout footprint as the loaded state.
- The section map panel should keep a stable aspect ratio while diagrams, maps, or live counts load.

## Empty

- No vessels: show an operational empty state in the hub body and disable vessel-specific actions.
- No active diagram: show the upload/replace diagram entry point and keep section map publishing disabled.
- No section map: show a draft creation entry point, seeded from the design reference only when explicitly requested.
- No equipment assignments: show section rows and allow assignments when the user has configuration permission.

## Error

- Live data endpoint failures should not hide persisted diagram registry data.
- Registry API failures should show a targeted registry warning and prevent publish/rollback actions.
- SVG validation blockers must prevent publish; warnings remain visible but do not block publishing.

## Validation Severity

- Blockers: missing active diagram, unsafe SVG, invalid normalized polygon, duplicate section key, empty section set, or unassigned published map.
- Warnings: missing thumbnail, unmapped equipment, stale diagram version, low section coverage, or fallback-only thumbnails.
