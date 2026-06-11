# CI & Merge Discipline

Why this exists: on 2026-06-10/11, three PRs merged while `Lint & Typecheck`
was red, each leaving main failing its own guards (domain-leak baseline,
boot-health pin) for the next session to absorb. Every guarded metric in this
repo holds; every bypassed guard regresses (`docs/UI-SCORECARD.md` §11).

## Rules

1. **Never merge on red.** If CI is red on the head commit, the PR is not
   done — fix it or hand it off. The only exception is a failure proven to
   pre-exist on `main` AND tracked in an issue; say so in the PR thread.
2. **Baselines only ratchet down.** `scripts/*-baseline.json` may be
   regenerated only when the new totals are **lower** (`--update` after a
   real reduction). Raising a baseline to make CI pass is never acceptable
   (CLAUDE.md invariant). If your change legitimately relocates a tracked
   entry (e.g. a file move shifts a pinned line), update the entry, not the
   ceiling — and explain it in the PR body.
3. **Pins move with their cause, in the same PR.** If you add/remove a
   domain router, bump `EXPECTED_MODULES` in `scripts/check-boot-health.mjs`
   in the same commit, with a comment naming the routers.
4. **Parallel-session etiquette.** Before starting work that touches
   baselines or `server/composition/`, fetch `origin/main` and rebase/merge
   early; baseline files are CODEOWNERS-gated so concurrent edits surface in
   review rather than as silent last-write-wins.
5. **Red main protocol.** If you find main red: (a) identify the breaking
   merge, (b) fix forward on a branch with the proper pattern (composition
   seam, pin bump, real code fix), (c) do not `--write-baseline` upward to
   silence it, (d) note the episode in the PR so the drift record stays
   honest.

## One-time setup still required (repo admin)

Branch protection that makes rule 1 mechanical:

```bash
gh api -X PUT repos/picnickang/Arus/branches/main/protection \
  -f required_status_checks[strict]=true \
  -f "required_status_checks[contexts][]=Lint & Typecheck" \
  -f "required_status_checks[contexts][]=Unit Tests" \
  -f enforce_admins=false \
  -f required_pull_request_reviews=null -f restrictions=null
```

## Nightly drift detection

`.github/workflows/scorecard-drift.yml` runs the full guard chain (including
`check:ui-ratchets`) against `main` every night at 05:00 UTC. A red nightly
means something merged past the guards — apply the red-main protocol above.
Re-score fully with the commands in `docs/UI-SCORECARD.md` §13 after each
gap-closure phase (`docs/GAP-CLOSURE-PLAN.md`).
