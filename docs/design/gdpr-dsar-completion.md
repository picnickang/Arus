# Design proposal — completing GDPR DSAR (access + erasure)

Status: **proposal — needs a compliance owner sign-off before implementation.**

The DSAR (data-subject access request) handling in `server/db/gdpr/db-gdpr.ts`
is partial scaffolding. The **clear bugs** were fixed directly (wrong `crew`
table name in collection; a null-identifier guard at the route — see git
history). The two items below change behaviour in compliance- and
retention-sensitive ways, so they are proposed here rather than implemented
unilaterally.

## 1. Complete the access export (Art. 15)

`collectUserDataForDsar(orgId, identifier, identifierType)` declares five result
categories but only populates `users` + `crewMembers`. It must also populate
`workOrders`, `restRecords`, `auditEvents`, and resolve the subject across id
types. Proposed subject→data mapping (confirm the linking keys with the data
owner):

| Category      | Table                    | Link to subject |
|---------------|--------------------------|-----------------|
| users         | `users`                  | `id` (userId) / `email` |
| crewMembers   | `crew`                   | `id` (crewId) / `email` |
| workOrders    | `work_orders`            | `assigned_crew_id` = crewId; (decide: also `completed_by`/`created_by` = userId?) |
| restRecords   | crew rest table (`crew_rest_*`) | `crew_id` = crewId |
| auditEvents   | `immutable_audit_trail`  | actor/`user_id` = userId |

Also fix the id-type dispatch: today the crew lookup runs `... WHERE email = ?`
for *any* non-`crewId` type (so a `userId` is queried against the crew email
column). Dispatch should be: `crewId` → crew by id; `email` → users+crew by
email; `userId` → users by id, then resolve the linked crew id. Replace the
broad `try/catch {}` that swallows all errors with per-source error capture so a
failed source is reported, not silently dropped.

## 2. Erasure (Art. 17) — the hard part

`executeDataErasure` currently marks the DSAR `status: "completed"` /
`"erasure_recorded"` but **deletes nothing**. That misrepresents compliance.
Two coupled decisions are needed:

**(a) Status truthfulness (do first, low risk):** until real erasure exists, the
endpoint must NOT report `completed`. Use a truthful state (e.g.
`pending_manual_review`) and a response that says erasure is not yet performed.

**(b) Erase vs. anonymize, per table:** maritime data has **legal retention**
requirements that conflict with deletion:
- `immutable_audit_trail` is append-only + hash-chained — it **cannot** be
  deleted without breaking the chain. → **anonymize** the actor identity
  (replace name/email with a tombstone), keep the record.
- STCW rest-hour records, completed work orders, certificates — likely subject
  to **statutory retention** → **anonymize** PII fields, retain the operational
  record.
- Free-PII tables with no retention basis (e.g. contact/profile rows) →
  **hard-delete**.

Proposed shape: a per-table policy map `{ table → delete | anonymize | retain }`,
executed in a single transaction, producing an erasure **report**
(what was deleted / anonymized / retained-with-reason). DSAR status becomes
`completed_with_retention_exemptions` (+ the report stored on the request).

## Why this isn't auto-implemented
Choosing delete-vs-anonymize per table, and which tables are retention-exempt,
is a legal/compliance call — getting it wrong either leaks PII (under-erasure)
or destroys legally-required records (over-erasure). Sign off the table policy
map above, then implementation is mechanical.
