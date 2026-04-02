# Copilot Agent Domain — Code Quality Fixes

## Files Changed

### 1. `server/domains/agent/application/orchestrator.ts` — Major Refactor

**Problem:** `run()`, `runWithAttachments()`, and `runStream()` duplicated ~700 lines
of nearly identical code (conversation init, context building, iteration loop, tool
execution, post-run cleanup). A bug fix in one path would inevitably be missed in another.

**Fix — Consolidated architecture:**

| Old (3 copies)                  | New (single implementation)                |
|---------------------------------|--------------------------------------------|
| Client init in each method      | `initRun()` — shared initialisation        |
| History/compaction in each      | `buildContext()` — shared context builder   |
| Tool loop in each               | `executeLoop()` — unified loop with `mode`  |
| Title/audit in each             | `completeRun()` — shared post-run cleanup   |
| Attachment parsing inline       | `processAttachments()` — extracted helper   |
| Draft approval inline in tool   | `handleDraftApproval()` — extracted helper  |

The three public methods (`run`, `runWithAttachments`, `runStream`) are now thin
wrappers (~30 lines each) that call the shared pipeline.

**Additional fixes in orchestrator:**

- **Removed dead `buildOpenAIMessages()` method** — was never called; replaced
  by `buildCompactedMessages` from context-compaction.ts.
- **Clarified stream persistence** — stream mode explicitly persists the final
  assistant message after the loop (clearly separated from sync mode which
  persists inside the loop), eliminating any ambiguity about double-persist.
- **Extracted `persistUserMessage()`** — DRY helper for user message + count.

**Line count:** 1140 → ~670 (−41%)

---

### 2. `server/domains/agent/infrastructure/file-registry.ts` — Security Fix

**Problems:**
- Upload directory was `/tmp/agent-uploads` (world-writable on Linux).
- Path traversal check used `startsWith` without trailing separator, which could
  match `/tmp/agent-uploads-evil/` as valid.
- No validation that sanitised orgId is non-empty or not `.`/`..`.

**Fixes:**
- **Preferred directory** is now `{cwd}/.data/agent-uploads` with `0o700`
  permissions. Falls back to `/tmp/agent-uploads` only if `.data` isn't writable.
- **Path traversal guard** now appends `path.sep` before `startsWith` check.
- **orgId validation** rejects empty, `.`, or `..` after sanitisation.
- Directories are created with `mode: 0o700` (owner-only).

---

### 3. `server/domains/agent/application/scheduler-service.ts` — Non-blocking Retry

**Problem:** When a scheduled run failed, the retry was executed synchronously
inside `executeSchedule()`. This blocked the cron thread for the full duration
of the retry (including the agent run + OpenAI API calls), which could delay
other scheduled jobs.

**Fixes:**
- **Retry is now async via `setImmediate`** — `scheduleRetry()` queues the
  retry outside the cron callback so other jobs aren't blocked.
- **Extracted `handleConsecutiveFailure()`** — failure counting and auto-disable
  logic pulled into a dedicated method for clarity.
- No functional change to retry semantics (still one retry, same failure
  counting, same auto-disable at 3 consecutive failures).

---

## Issues Documented But Not Changed in This Patch

These require broader changes or product decisions:

| Issue | Risk | Recommendation |
|-------|------|----------------|
| Report artifact registry is in-memory + JSON file | Won't survive multi-instance; no cleanup | Move to DB table with TTL |
| Stream endpoint uses GET with query params | URL length limits (~2KB) for long messages | Switch to POST with SSE response (requires frontend change) |
| No user-level ownership check on conversations | Any user in same org can access any conversation | Add `userId` check in orchestrator or routes |
| Suggestion engine `setInterval` with no shutdown hook | Interval leak on hot reload / process restart | Wire `stopBackgroundEvaluation` to process SIGTERM |
| Safety service uses raw SQL bypassing Drizzle | Loses type safety, fragile casts | Rewrite with Drizzle query builder |
| Frontend `AgentChatPanel.tsx` is 997 lines | Hard to maintain | Extract streaming hook, file-handling hook, message renderer |
| Frontend `copilot-admin.tsx` is 1252 lines | Hard to maintain | Extract each tab into its own component file |
