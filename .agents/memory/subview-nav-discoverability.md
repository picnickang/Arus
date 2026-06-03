---
name: In-page subview discoverability
description: A crew/feature subview reachable only via an in-page tile is invisible from the app's nav menu — add a deep-link nav entry.
---

When a new module is built as a state-driven subview of an existing page
(e.g. `view==="tasks"` inside `/crew-management`) and is only reachable via
an in-page tile/button, users report it as "not accessible" even though the
code, permissions, and rendering are all correct.

**Why:** The app's main navigation (`client/src/config/navigationConfig.ts`)
is how users discover features. A subview with no nav entry is effectively
hidden from the menu, no matter how correct the in-page entry point is.

**How to apply:** Give the subview a deep-linkable URL (e.g.
`/crew-management?view=tasks`) and add it as a child under the relevant nav
hub. Read the `?view=` param in the page component and open the subview in an
effect (placed ABOVE any early return to keep hook order stable). Make the
subview URL-driven (tile click + in-page back both navigate the URL, effect
reconciles subview<->URL) so sibling nav entries pointing at the same page
with different query params stay consistent. Nav permission gating is
pathname-based, so query params don't affect it.
