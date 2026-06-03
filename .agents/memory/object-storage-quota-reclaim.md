---
name: Object-storage upload routes & storage_bytes quota
description: Replace/delete semantics an upload route must implement so the per-org storage_bytes quota doesn't drift
---

When a route uploads a user file to object storage AND charges the per-org
`storage_bytes` quota (`quotaService.incrementUsage`), it must also handle the
two ways that quota/object state can silently drift:

1. **Replace** — if the row already had a photo/file path, the OLD object must
   be best-effort deleted AND its bytes reclaimed (`incrementUsage(orgId, "storage_bytes", -freed)`)
   after the new upload + DB write succeed. Skipping this orphans the old
   object and permanently inflates the org's usage on every replace.
2. **DB-write failure after a successful PUT** — delete the just-uploaded
   object (compensation) but do NOT reclaim quota, because you only charge the
   quota AFTER the DB write succeeds. Charge order: PUT → set ACL → DB update
   → `incrementUsage(+size)` → reclaim previous object's bytes.

**Why:** object PUT and the DB row update are two non-transactional steps;
without explicit compensation/reclaim the storage_bytes counter drifts
upward over time (commercial-billing concern flagged in code review).

**How to apply:** factor a single best-effort `deleteObject(path, reclaimQuota: boolean)`
helper (swallow missing/unreadable-object errors so the primary flow is
unaffected) and call it from both the replace branch (reclaim=true), the
delete route (reclaim=true), and the upload compensation branch
(reclaim=false). Example: crew profile photo routes in
`server/domains/crew/interfaces/crew-member-routes.ts`. Re-validate image
magic bytes on the buffer too — multer's fileFilter only sees the spoofable
Content-Type (`server/lib/image-magic-bytes.ts`).
