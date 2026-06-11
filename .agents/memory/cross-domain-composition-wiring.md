---
name: Cross-domain wiring vs domain-leak guard
description: Where to put code that legitimately needs another domain's storage, and how the alerts table doubles as the notification channel.
---

## Rule

When one bounded context must react to another's domain event and write into a
third domain's storage (e.g. work-orders accept/decline → write an alert),
put the subscriber/wiring in `server/composition/` (mirrors
`workflow-attention-sources.ts`), NOT under `server/domains/**`.

**Why:** `scripts/check-domain-leaks.mjs` section C ("cross-domain db\*Storage
refs") computes `domainOf(file)` via `relative(server/domains, file)`; anything
outside `server/domains/**` returns null and is skipped. Composition-root files
are therefore exempt by design. Dynamic `await import(...)` of internal modules
DOES count in section A, so prefer a static top-level import for composition
wiring to keep the leak count flat.

**How to apply:** new event subscriber that crosses domains → new file under
`server/composition/`, register it from `server/index.ts` (static import) right
after `initAllBridges()`.

## Notification channel reality

There is no per-user notification table. The org-scoped `alert_notifications`
table is the de-facto notification surface: it feeds the alerts UI AND the
pull-based attention inbox (`getAlertNotifications(false, orgId)` =
unacknowledged-only → surfaces as the "alerts-unacknowledged" count item).
`alert_notifications` is equipment-coupled: `equipmentId` (FK to equipment),
`sensorType`, `alertType`, `message`, `value`, `threshold` are all NOT NULL and
there is NO severity column. To emit a non-sensor notification, supply a real
`equipmentId`, set `sensorType` to a sentinel ("assignment"), and `value`/
`threshold` to 0.

## Baseline drift

`scripts/domain-leak-baseline.json` can lag behind main (its `samples` only
store the first 25 of each category, so a manual sample-diff is inconclusive).
A failing crossDomain delta that touches none of your files is upstream drift —
don't absorb it into your commit by regenerating the baseline; let the platform
merge bring main's newer baseline.
