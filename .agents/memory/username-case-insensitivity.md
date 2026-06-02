---
name: Username login is case-insensitive
description: How username matching/uniqueness works for login, and the constraint any new write path must respect.
---

# Username login is case-insensitive

Login matches usernames case-insensitively via `sql\`lower(${users.username}) = lower(${input})\`` (not `eq`). Used in the portal login lookup and the `findUserByUsername` uniqueness check.

**Why:** Users expect "John" and "john" to be the same login. Admins also sign in through `/api/portal/login`, so that one path covers both.

**How to apply:** There is **NO DB-level unique constraint** on username — uniqueness is enforced *app-side only*, and only on the account-create and username-update paths (both call `findUserByUsername`, which is case-insensitive). Any NEW code path that writes `users.username` must replicate the case-insensitive duplicate check, or case-variant duplicates can slip in and make login ambiguous (login uses `limit(1)`). A DB-level `unique(org_id, lower(username))` expression index (with dual-mode PG + SQLite/Turso migration + collision backfill) is the robust long-term fix but was out of scope for the simple request.
