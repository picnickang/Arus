---
name: Crew document renewal-task pattern
description: How "renewal task near expiry" is implemented for crew documents, and the dedupe rule.
---

When a crew document is saved/renewed within ~90 days of expiry, the client raises a
renewal **crew task** via the existing `POST /api/crew-tasks` mechanism (no new backend).
The task is linked with `linkedSourceType: "crew_document"` + `linkedSourceId: <doc.id>`
(the linked-source enum is `crew_document | certificate`).

**Why:** there is no dedicated "renewal task" entity; crew tasks are the canonical
action surface, and linked-source fields tie the task back to the document.

**How to apply:** any code path that auto-creates a linked task on a repeatable
save MUST first query open tasks (`GET /api/crew-tasks?assignedCrewId=…`) and skip if
one already exists for the same `linkedSourceType`+`linkedSourceId`. Re-saving an
unchanged near-expiry document otherwise spawns duplicate open tasks. Lookup failure
should fall through and create (a possible dup beats a dropped reminder).

Profile-photo crop (CrewPhotoModal) exports a **square** 512px JPEG, not a circular
PNG: JPEG has no alpha so a circular mask bakes black corners; avatars are clipped
circular via CSS instead.
