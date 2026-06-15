# Design proposal — completing GDPR DSAR (access + erasure)

Status: **both access-export (§1) and erasure (§2) are DRAFTED in
`server/db/gdpr/db-gdpr.ts`. Before the erasure endpoint is relied on, a
compliance owner must sign off the per-table policy below and a `dryRun` should
be run on staging.** Open sign-off questions are listed inline in each section.

## Erasure — what the draft does (vs. this design)
`executeDataErasure(dsarId, orgId, erasedBy, reason, { dryRun })` now:
- resolves the subject from the DSAR (`requesterId`/`requesterEmail`),
- **anonymizes** identifying PII on `users` (name/email/username/phone) and
  `crew` (name/email/phone/address/photo/emergency-contact/crew-code/notes) in
  a single transaction,
- **retains** `immutable_audit_trail` (hash-chained — modifying breaks chain
  verification), `crew_rest_sheet` (STCW retention), and `work_orders`
  (operational retention) — they reference the now-anonymized ids,
- returns a per-table **report**, and (non-dry-run) sets the DSAR
  `status = 'completed'` with the report in `processing_notes`.
- `POST /dsar/:id/execute-erasure` accepts `dryRun: true` (preview, no confirm
  needed) and still requires `confirmErasure: true` for a real run.

**Sign-off checklist before enabling:** confirm the table policy map below
(which additional tables hold subject PII? any that must be hard-deleted rather
than anonymized?), and run `dryRun` against staging to confirm match counts.

The DSAR (data-subject access request) handling in `server/db/gdpr/db-gdpr.ts`
is partial scaffolding. The **clear bugs** were fixed directly (wrong `crew`
table name in collection; a null-identifier guard at the route — see git
history). The two items below change behaviour in compliance- and
retention-sensitive ways, so they are proposed here rather than implemented
unilaterally.

## 1. Complete the access export (Art. 15) — DRAFTED

`collectUserDataForDsar` now resolves the subject across id types
(crewId ↔ userId ↔ email) and populates all five categories, capturing
per-source failures in `_errors` instead of a blanket `try/catch {}`. Linking
keys used (confirm with the data owner):

| Category      | Table                    | Link to subject |
|---------------|--------------------------|-----------------|
| users         | `users`                  | `id` (userId) / `email` / via `crew.user_id` |
| crewMembers   | `crew`                   | `id` (crewId) / `email` / `user_id` |
| workOrders    | `work_orders`            | `assigned_crew_id` = crewId  *(open: also `completed_by` = userId?)* |
| restRecords   | `crew_rest_sheet`        | `crew_id` = crewId |
| auditEvents   | `immutable_audit_trail`  | `performed_by` IN (userId, email) |

**Open sign-off question:** should `workOrders` also include work orders a user
`completed_by` (not just those `assigned_crew_id` to them)?

## 2. Erasure (Art. 17) — DRAFTED

`executeDataErasure` previously marked the DSAR `completed` while deleting
nothing. It now **anonymizes** identity PII per the policy below, in one
transaction, with a `dryRun` preview and a per-table report.

**Per-table policy as implemented:**
- `users` / `crew` → **anonymize** identity fields (tombstone name/email, null
  phone/address/photo/emergency-contact/crew-code/notes). Not hard-deleted —
  referenced by retained records + the hash-chained audit trail.
- `crew_rest_sheet` → **retain record, anonymize the denormalized `crew_name`**
  (STCW retention keeps the rest hours; the name copy is scrubbed).
- `work_orders` → **retain** (operational retention; references anonymized crew).
- `immutable_audit_trail` → **retain, untouched** — append-only + hash-chained,
  so modifying it breaks chain verification.

**Open sign-off questions / residual PII:**
- `immutable_audit_trail.performed_by_name` and `work_orders.completed_by_name`
  are denormalized name copies on retained records. Audit cannot be modified
  (chain); work-order actor names *could* be anonymized — decide whether to.
- Any **free-PII tables** with no retention basis that should be **hard-deleted**
  rather than anonymized (none are today; add to the transaction if identified).
- DSAR status is set to `completed` with the report in `processing_notes`;
  switch to `completed_with_retention_exemptions` if a distinct UI state is
  wanted.

## Why this isn't auto-implemented
Choosing delete-vs-anonymize per table, and which tables are retention-exempt,
is a legal/compliance call — getting it wrong either leaks PII (under-erasure)
or destroys legally-required records (over-erasure). Sign off the table policy
map above, then implementation is mechanical.
