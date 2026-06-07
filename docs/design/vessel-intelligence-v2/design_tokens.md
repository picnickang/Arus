# Vessel Intelligence v2 Design Tokens

The reference package uses ARUS' dark operational shell. Keep new work visually aligned with the supplied SVGs rather than introducing generic dashboard styling.

## Color Roles

- Page background: deep navy/near black.
- Panel background: dark blue operational panels.
- Primary action and selected navigation: bright blue.
- Healthy state: green.
- Warning/watch state: amber.
- Critical/blocker state: red.
- Section overlays: use the exact section colors from `tokens/data/section_mapping.json`.

## Layout Rules

- Desktop frames use a persistent left navigation rail, top vessel context strip, and dense operational panels.
- Mobile frames use a compact header, tabs/segmented navigation, stacked panels, and fixed bottom navigation affordances.
- Map panels should keep the sectioned vessel image dominant and avoid decorative cards around the core diagram.
- Controls should be compact and task-oriented: icon buttons for upload, history, rollback, validation, thumbnail replacement, and publish flows.

## Type And Density

- Use compact operational headings inside panels.
- Avoid hero-scale typography inside the hub.
- Keep labels scannable and avoid explanatory marketing copy inside the app surface.

## Diagram-Specific Tokens

- Coordinate mode: `normalized_percent`.
- Reference side elevation dimensions: `895 x 420`.
- Diagram types: `side_elevation`, `deck_plan`, `machinery_arrangement`, `electrical_single_line`, `fire_safety_plan`, `system_schematic`, and tenant-specific `custom`.
- Thumbnail fallbacks: manual upload, crop from active diagram, generated placeholder, and generic icon fallback.
