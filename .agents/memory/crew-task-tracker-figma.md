---
name: Crew Task Tracker linked-source editing
description: Edit-mode pitfall when a picker only represents a subset of a polymorphic link's source types.
---

The crew task `linkedSourceType` is polymorphic (`crew_document | certificate`), but the
Tracker's create/edit picker only loads `/api/crew/:crewId/documents` — it cannot represent
a certificate link.

**Rule:** In edit mode, only send `linkedSourceType/Id/Label` when the user actually changed
the picker selection (compare against `task.linkedSourceId`). Never recompute-and-send them
unconditionally.

**Why:** A controlled `<select>` whose value (e.g. a certificate id) matches no option renders
blank; an unconditional "find doc → else null" recompute then silently clears a valid link on
any unrelated edit. Found in architect review of the Figma 58:1716 reshape.

**How to apply:** Any widget that edits a subset of a polymorphic FK must treat "value not in
my option set" as "leave untouched", not "clear".
