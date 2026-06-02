---
name: External "hardened patch" archive merges
description: How to merge a user-supplied patch/archive into main without regressing — main is often already ahead.
---

# Merging supplied "hardened" patch archives into main

When the user drops a full project archive (e.g. a "hardened gap-closure
patch") and asks to merge it file-by-file: the archive is frequently an
OLDER or parallel snapshot, and main already contains most/all of it —
sometimes more completely.

**Rule:** never blindly copy archive files over main. First run
`git --no-optional-locks diff --no-index <main> <archive>` and numstat
across the tree, then per-file classify into: (A) genuine net-new
improvement main lacks, (B) regression / main-ahead, (C) mixed (hand-merge
only the good side).

**Why:** blindly copying regresses main — observed losses included mobile
responsiveness (`grid-cols-1 sm:grid-cols-2` → `grid-cols-2`), richer
TanStack query invalidation being stripped, and re-introducing a
deliberately-retired auth endpoint (`/admin/auth/verify`).

**How to apply:** confirm each claimed "gap fix" is actually absent in main
by grepping for its markers before applying. `numstat NNN+/0-` means pure-
additive (safe to copy); any `-` count means modifications exist (hand-merge).
Verify the archive's net-new component's data deps (endpoints, types) already
exist in main before swapping it in.
