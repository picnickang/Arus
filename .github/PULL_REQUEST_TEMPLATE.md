## Summary

<!-- What and why. Link the audit/gap-plan item if this executes one
     (docs/UI-CONSOLIDATION-AUDIT.md, docs/GAP-CLOSURE-PLAN.md). -->

## Guard checklist

- [ ] `npm run check` (tsc) and `npm run lint` pass locally
- [ ] `npm run check:guards` passes — **no baseline was raised** (baselines
      only ratchet down; if a counter regressed, fix the code, don't edit
      `scripts/*-baseline.json` upward)
- [ ] `npm run test:unit` passes
- [ ] If a domain router was added/removed: boot-health pin updated in
      `scripts/check-boot-health.mjs` (expected module count)
- [ ] If routes/redirects changed: `tests/unit/route-shadow.test.ts` and
      `tests/unit/navigation-canonical.test.ts` still pass
- [ ] No new `db*Storage` refs in routes/interfaces layers — cross-domain
      reads go through `server/composition/` seams

## Merge discipline

- [ ] CI is green on the head commit (do **not** merge red — see
      `docs/runbooks/ci-merge-discipline.md`)
