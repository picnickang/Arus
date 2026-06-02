# Button & Action Trust Verification

> **Status:** Static (source-inspection) verification of high-value action buttons,
> resolving the equipment-hub Acknowledge/Assign contradiction and the three
> reported-but-unverified controls. Runtime browser execution is **not possible in
> the sandbox** (Playwright cannot launch a browser here; integration tests crash
> under cloud-mode db-config), so each control is verified by reading the current
> source end-to-end: button → handler → mutation → backend route → toast.
> **Date:** 2026-06-02
> **Scope:** Phase 1.5 blocker closure — no broad UI deletion, no behavioural
> changes beyond what is explicitly noted. Confirmed-broken controls are
> **documented**, not rebuilt (rebuilding is a feature, out of this pass's scope).

Legend for **Truthful messaging**: ✅ = success only fires on real success and
failure surfaces an error; ⚠️ = no false-positive, but a failure/empty path is
silent; ❌ = can show success when the action did not succeed.

---

## Equipment Hub Acknowledge/Assign Resolution

**Contradiction:** one report said these buttons were removed as dead buttons;
another said they were wired to real mutations.

**Resolution (current source is authoritative):** both buttons **exist and are
real**. The "removed as dead" report reflects an *intermediate* state — git
history shows the dead buttons were removed, then **re-introduced wired to real
mutations** and pinned by a journey test. The current tree has the wired
versions.

| Control | File | onClick → mutation | Backend route | Disabled / loading | Truthful messaging |
|---|---|---|---|---|---|
| **Acknowledge** | `client/src/pages/equipment-hub.tsx` (+ `hooks/useEquipmentHub.ts`) | `acknowledgeMutation` | `POST /api/equipment-intelligence/anomalies/:id/acknowledge` | disabled when `!canAcknowledge` (no active anomaly) or `isPending` | ✅ toast "Anomaly acknowledged" on success; `onError` destructive toast |
| **Assign** | `client/src/pages/equipment-hub.tsx` (+ `hooks/useEquipmentHub.ts`) | `assignMutation` | `PUT /api/work-orders/:id` `{ assignedCrewId, status: "in_progress" }` | disabled while `isPending`; assigns against real WO + crew data | ✅ success toast + invalidates `/api/work-orders`; `onError` destructive toast |

**No workflow was lost.** Both actions operate on real server state (anomaly
acknowledgement; work-order assignment), and both are exercised by an existing
journey test: `tests/playwright/journeys/equipment-hub-actions.spec.ts`.

**Verdict:** real, wired, and tested. **KEEP.** No change required.

---

## Three reported controls

### 1. system-administration "Publish Update" — ❌ CONFIRMED BROKEN (missing backend route)

| Check | Result |
|---|---|
| Button exists | ✅ Full form rendered — `client/src/pages/system-administration.tsx` (~L526–708): publish form + a **Preview** button. |
| Visible only to allowed roles | ✅ The page is admin-portal gated; the "Publish" tab sits inside the System Admin surface. |
| Calls `POST /api/admin/patches/publish` | ✅ on the **frontend** — `publishMutation` (and `previewMutation` → `POST /api/admin/patches/preview`) via `useCustomMutation`. |
| Backend route exists | ❌ **No.** `server/domains/software-updates/routes.ts` registers only `check`, `list`, `history`, `:id/download`, `:id/apply`, `rollback`, `backups` (all `requireAdminAuth` + `auditAdminAction`). A whole-server search finds **no** `patches/publish` or `patches/preview` route. |
| Handles loading / success / failure | ✅ on the frontend — submit + preview buttons disable while `isPending`; `useCustomMutation` toasts success **only** in `onSuccess`, error in `onError`. |
| UI refresh after success | ✅ wired — invalidates the patches + history queries on success. |
| Unauthorized access fails correctly | ✅ — the routes that *do* exist are `requireAdminAuth`-gated; the missing routes simply 404. |
| Success message truthful | ⚠️ Moot — because the route is missing, submit always 404s and the user sees the **error** toast (never a false success). |

**Conclusion:** the control is fully built on the client but its backend
endpoints (`/api/admin/patches/publish`, `/api/admin/patches/preview`) **do not
exist**, so it can never succeed — every submit returns 404 → error toast. This
is a **missing feature (server-side patch publishing/preview pipeline)**, not a
small wiring bug. Per this pass's scope it is **documented, not built**.

**Recommendation:** `FIX (backend)` — either implement the publish/preview
endpoints, or (until then) `HIDE`/disable the Publish tab so admins are not
presented an action that always 404s. Risk: **medium** (admin-only, no data
corruption — it just fails — but it erodes trust in the admin surface).

### 2. ScheduleGeneratorPanel PDF success toast — ⚠️ no false-positive; silent on empty/failure

| Check | Result |
|---|---|
| Success toast only on real success | ✅ `exportTableToPDF` (`client/src/lib/exportUtils.ts`) returns `false` on empty data and `false` in its `catch`; returns `true` only after a successful `doc.save()`. The caller (`ScheduleGeneratorPanel.tsx`) toasts **only** `if (success)`. |
| Empty data shows a no-data message | ⚠️ **No** — empty returns `false` and the caller shows **nothing**. (In practice the export button only renders when there are assignments, so this path is largely unreachable.) |
| Failed export shows failure | ⚠️ **No** — a thrown error returns `false`; the caller shows nothing. |
| Button disabled during export | ⚠️ Not explicitly — export is synchronous (`jsPDF`), sub-second, so there is no meaningful in-flight window. |
| Avoids false-positive success | ✅ **Yes** — this is the primary requirement and it is met. |

**Conclusion:** the reported risk (false-positive success) **does not exist**.
The residual gap is purely *silence* on the near-unreachable empty/failure paths.
Per scope ("fix only confirmed issues; do not change based on speculation") this
is **left as-is and documented** rather than changed — adding a failure/empty
toast is a low-value UI tweak outside the blocker set.

**Recommendation:** `KEEP`. Optional low-risk polish (future): add an
`else` destructive toast for empty/failed export. Risk: **low**.

### 3. RolesDashboardsTab save-toast-on-settled — ✅ CORRECT (concern unfounded)

| Check | Result |
|---|---|
| Save toast only on success | ✅ `saveConfig` toasts in **`onSuccess`** (not `onSettled`) — `client/src/components/.../RolesDashboardsTab.tsx`. |
| Failure shows failure | ✅ `onError` shows a destructive toast. |
| No success shown after a failed mutation | ✅ — there is **no `onSettled`** success path, so a failed save can never surface a success toast. |
| Saved config persists after reload | ✅ Persists via `PUT /api/admin/role-dashboards/:roleId`. |
| Permission restriction applies | ✅ Backend route gated `requireSuperAdminRole`; the frontend tab is super-admin gated to match. |

**Conclusion:** the "toast on settled" concern is **unfounded** in current
source. **No fix.** **Recommendation:** `KEEP`.

---

## Summary

| Control | State | Action taken | Recommendation |
|---|---|---|---|
| Equipment Hub Acknowledge | real + tested | none | KEEP |
| Equipment Hub Assign | real + tested | none | KEEP |
| Publish Update | broken (missing backend route) | documented | FIX (backend) / HIDE until built |
| ScheduleGenerator PDF toast | no false-positive; silent on edge paths | documented | KEEP (optional polish) |
| RolesDashboardsTab save | correct | none | KEEP |

No code was changed for any of these controls in this pass: two are correct, two
are correct-enough (no false success), and one is a missing-backend feature that
is out of scope to build here.
