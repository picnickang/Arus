---
name: me-tasks personal feed is role-config gated
description: Why a new task type may not appear in /api/me/tasks or "My Tasks" filters even when assigned.
---

The personal task feed (`/api/me/tasks`, `MePortalService.getTasks`) only
materializes a task source if that source key is present in the user's role
dashboard config `taskSources` (`shared/role-dashboard.ts`,
`DEFAULT_ROLE_DASHBOARD_CONFIGS`). Client-side "My Tasks" style filters that
derive "mine" from this feed inherit the same gate.

**Why:** task-source selection is per-role product config, not automatic. A
brand-new source key (e.g. `crew_tasks`) must be added to: the `TASK_SOURCES`
vocab, `IMPLEMENTED_TASK_SOURCES`, `TASK_SOURCE_LABELS`, and each relevant
role's `taskSources` array — otherwise assigned items silently never reach
that role's personal feed.

**How to apply:** when adding a new task type that should show up in a user's
personal/"my tasks" view, wire the source into me-portal AND add it to the
default `taskSources` of the roles that should see it. Note the seeding gap:
default-config changes only apply to newly seeded orgs — existing orgs keep
their stored role configs and need a backfill (same class as
role-template-grant-drift). Do NOT try to resolve current-user → crew id on
the client to bypass this: `CrewMemberRecord` intentionally omits `userId`
(see `shared/schema/crew.ts`), so the role-gated server feed is the correct
resolution path.
