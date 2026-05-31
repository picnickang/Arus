---
name: ARUS env quirks (tsc, domain-leak guardrail)
description: Sandbox/tooling gotchas when validating ARUS changes.
---

# ARUS env quirks

**`npx tsc --noEmit`**: run it **synchronously** with a ~120s timeout. Cached it finishes in ~23s (exit 0). Detached/backgrounded tsc (`setsid`, `&`, redirect-to-logfile) reliably gets killed in this sandbox, so the log file ends up empty and you wait forever.

**`drizzle-kit push` needs a TTY** and fails non-interactively. To apply additive schema changes, run the equivalent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` via `psql "$DATABASE_URL"` directly, then backfill with SQL.

**`npm run check:domain-leaks`** baseline (`scripts/domain-leak-baseline.json`) can be **stale** — it may report a regression (e.g. crossDomainStorage +N) that predates your work. The check only counts `db*Storage` symbol refs. Before assuming the regression is yours: grep your changed files for `db[A-Z][A-Za-z]*Storage` in both the working tree and at HEAD. If none of your changed files contain such refs, the drift is pre-existing — do NOT `--write-baseline` (that would mask someone else's real regression).
