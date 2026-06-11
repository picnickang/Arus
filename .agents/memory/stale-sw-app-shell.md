---
name: Stale service-worker app shell
description: Why "changes have not been applied" can happen with correct code — SW caching the non-hashed app shell cache-first.
---

# Stale service-worker app shell ("changes have not been applied")

When the current code is verifiably correct but a user reports they still see an
OLD version (old layout/colors, "changes not applied"), suspect the service
worker before suspecting a code bug — especially on PWAs / installed shortcuts /
desktop builds / custom domains.

**The trap:** `client/public/service-worker.js` precaches and serves the
NON-content-hashed app shell (`/`, `/index.html`) cache-first. A controlling SW
then serves the old `index.html`, which references old (now-deleted) JS bundle
hashes, pinning the browser to the old app. Because the served old `index.html`
carries the old registration script, any newer "unregister on dev/replit" logic
in the live `index.html` never runs — a deadlock.

**Why the dev preview isn't immune:** the live `index.html` unregisters the SW on
`*.replit.dev`, but only AFTER it loads — and the stale SW serves the old
`index.html` first, so the unregister never executes.

**Self-heal fix (the right shape):**

- Navigation/HTML requests → **network-first** (fall back to cache only offline);
  cache fresh HTML only when `response.ok`. Content-hashed static assets stay
  cache-first (safe — new build = new filenames).
- **Bump `CACHE_NAME`** so the existing `activate` handler purges the old shell cache.
- The SW already calls `skipWaiting()` + `clients.claim()`, so a stuck device
  recovers on its next SW update check (browser re-fetches `/service-worker.js`
  directly, bypassing the SW) — no production redeploy needed.

**How to apply:** if a "changes not applied" report survives a normal refresh and
the code is correct, check the SW fetch strategy for cache-first on `/` /
`index.html` and the cache-name version. User-side recovery: fully close the
tab/app and reopen (one extra reload), or delete + re-add the home-screen PWA.
