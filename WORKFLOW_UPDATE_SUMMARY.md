# ARUS Workflow Update - Replit Upload Package

This update improves the day-to-day user workflow by adding an action-oriented workflow layer on top of the existing modular vessel-management app.

## What changed

### 1. Unified Attention Inbox
Added `/attention-inbox`, a single operational queue that aggregates:
- overdue work orders
- unacknowledged alerts
- high-risk equipment
- blocked work
- work due today
- work ready for verification/closeout
- handover summary items

Each item now presents:
- what happened
- source/domain
- why it matters
- recommended next action
- owner
- due timing
- link to the related operational screen

### 2. Role-based command center on Home
The Home page now includes an Operations Command Center with:
- work queues
- highest-priority items
- role-specific next actions
- direct link to Attention Inbox

This makes the first screen action-oriented instead of just module-oriented.

### 3. Queue-based operating model
Added a reusable workflow model for:
- Needs Review
- Assigned to Me
- Due Today
- Blocked
- Waiting on Parts
- Ready to Close
- Recently Completed
- Overdue

### 4. Handover workflow
The Attention Inbox includes a Handover tab showing:
- open attention items
- blocked jobs
- ready-for-closeout work
- total open work orders

This provides a practical watch-change / shift-change view.

### 5. Work order lifecycle strip
Added a reusable lifecycle visual:
Created → Planned → Parts Ready → In Progress → Verification → Closed

This can be reused on work order detail screens later.

### 6. Production session workflow fix
Added an app-level `SessionGate` so production users unlock an authenticated session before protected queries run.

Also added `client/src/lib/sessionToken.ts` so:
- `AdminAccessContext` owns login/unlock state
- `queryClient` automatically attaches `Authorization: Bearer <token>`
- `admin-api` reads the same in-memory token source
- token remains out of localStorage/sessionStorage

This addresses the earlier workflow problem where `/api/permissions/me` and normal API calls could run without a bearer token in production.

### 7. Navigation updates
Added Attention Inbox to:
- Operations routes
- Operations hub
- main navigation config
- role quick actions

## Key files changed

- `client/src/App.tsx`
- `client/src/lib/queryClient.ts`
- `client/src/lib/sessionToken.ts`
- `client/src/contexts/AdminAccessContext.tsx`
- `client/src/lib/admin-api.ts`
- `client/src/components/auth/SessionGate.tsx`
- `client/src/pages/home.tsx`
- `client/src/pages/operations-hub.tsx`
- `client/src/routes/operations.ts`
- `client/src/config/navigationConfig.ts`
- `client/src/config/roles.ts`
- `client/src/features/workflow/**`

## Verification commands

After uploading to Replit:

```bash
npm install
npm run check:workflow-routes
npm run check:guards
npm run typecheck
npm run test:pdm
npm run build
```

Recommended manual workflow test:

1. Start the app in production-like mode.
2. Confirm the session gate appears before app API calls are used.
3. Unlock with the admin password.
4. Confirm Home loads the Operations Command Center.
5. Open `/attention-inbox`.
6. Confirm Attention, Blockers, and Handover tabs render.
7. Create/open a work order and verify related queue links resolve.

## Notes

This update intentionally does not replace the existing domain modules. It adds a workflow layer over them, preserving hexagonal modularity by keeping the workflow UI under `client/src/features/workflow` and using existing APIs as ports.
