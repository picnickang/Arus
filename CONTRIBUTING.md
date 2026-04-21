# Contributing to ARUS

This document covers the conventions and automated guards that keep the codebase healthy. Read it before opening your first PR.

---

## Quality guards (run in CI on every PR)

The full guard chain: `npm run check:guards-full`

| Guard | What it checks | Fix if it fails |
|---|---|---|
| `check:schema` | Dual-schema export pattern, column parity, missing tables | Update `shared/schema/*` and `shared/sqlite-schema/*` to match; or update `scripts/drift-baseline.json` if drift is intentional |
| `check:storage-imports` | No imports of the deleted `server/storage.ts` facade | Use `server/repositories.ts` (the canonical entry) |
| `check:schema-imports` | Schema imports respect the boundary rules | Import from `@shared/schema` (or `@shared/schema-runtime` if dialect-aware) |
| `check:domain-boundaries` | Cross-domain imports don't violate hexagonal layering | Re-route through the domain barrel; don't reach into `internal/` of another domain |
| `check:route-registration` | All API routes register through `domain-router-registry.ts` | Don't add `app.get/post("/api/...")` outside approved files |
| `check:domain-leaks` | Domain implementation details don't leak across boundaries | Keep types and helpers behind the barrel |
| `check:ts-burndown` | TypeScript error count is **monotonically decreasing** | Fix the regression — or, if you reduced the count, regenerate the baseline |
| `check:cast-burndown` | `as any` and `as unknown as` cast count is monotonically decreasing | Same as above — these are holes in the type system |
| `check:boot-health` | Server boots cleanly with all 99 dynamic-import modules registered | Check the boot log for "Failed to register" lines |

---

## Burndown ratchets

Several guards use a **burndown baseline** pattern: the metric must monotonically decrease over time. New code can't make things worse, and the cleanup is gradual rather than a giant rewrite.

### TypeScript error burndown

- Baseline: `scripts/ts-burndown-baseline.json`
- Current floor: tracked in the baseline file
- Increase the count → CI fails
- Decrease the count → CI passes; regenerate the baseline to lock in the win:
  ```bash
  node scripts/check-ts-burndown.mjs --write-baseline
  ```
- See top offenders:
  ```bash
  node scripts/check-ts-burndown.mjs --report
  ```

### Type-cast burndown (`as any`, `as unknown as`)

- Baseline: `scripts/cast-burndown-baseline.json`
- Excludes adapter boundaries (`server/telemetry/`, `server/sync/`, `server/vessel-simulator/`, `server/external-integrations/`) where raw external data legitimately requires `any`
- Same workflow as TS burndown:
  ```bash
  node scripts/check-cast-burndown.mjs --report          # see top offenders
  node scripts/check-cast-burndown.mjs --write-baseline  # lock new floor after a reduction
  ```

**Why these guards exist:** every `as any` or `as unknown as` is a hole in the type system. They turn off TypeScript's protection for the rest of the file. We're not banning them outright (too disruptive at current count), but we're committed to never adding more.

If you genuinely need a cast at an external boundary that isn't in the exempt list, prefer:
1. A Zod schema parse (gives a runtime check + narrowed type)
2. A type predicate (`function isFoo(x: unknown): x is Foo`)
3. A branded type at the boundary

If none of those fit, ask in PR review before adding the cast.

---

## Architecture quick-reference

Full architecture details are in `replit.md`. The non-obvious things to know before editing:

### The Dynamic-Loader Map (will trip up static analyzers)

Three patterns make files appear "unused" to knip / ts-prune / IDE find-references while being load-bearing at runtime:

1. **Domain Router Registry** (`server/routes/domain-router-registry.ts`) declares 99 entries with `importPath: "../domains/<name>/index.js"` and loads them via `await import(config.importPath)`. All 99 real targets are pinned in `knip.json` as `entry` paths. **Adding/removing a registry entry must be matched in `knip.json`.**

2. **Domain Barrel Re-Exports** (`server/domains/<domain>/index.ts`) — registry imports the barrel, but the barrel keeps every named export reachable. Deleting "unused" exports from a barrel can silently break route registration.

3. **Repository Modular Loaders** (`server/repositories/<domain>/index.ts`) load sub-files via `loadModularFiles()`. The boot log line `[X Repository] Loaded N modular files` confirms the count.

**Always run `npm run check:boot-health` after any deletion in `server/domains/`, `server/routes/`, `server/repositories/`, or any file matching a knip `entry` path.**

### Storage layer

- Single canonical entry: `server/repositories.ts`
- Direct imports of `server/storage.ts` will fail `check:storage-imports` (the file no longer exists)
- Use specific repositories (`dbWorkOrderStorage`, etc.) rather than the deprecated facade pattern

### Dual-mode deployment

- Cloud mode (`LOCAL_MODE=false`): Postgres via Neon, full schema
- Vessel mode (`LOCAL_MODE=true`): SQLite via libSQL/Turso, offline-first
- The dialect switcher is `shared/schema-runtime.ts` — it uses ternary patterns enforced by `check:schema`

---

## Pre-PR checklist

Before opening a PR:

```bash
npm run lint                # ESLint
npm run check               # tsc --noEmit
npm run check:guards-full   # full guard chain (TS + casts + boot health + boundaries)
npm run test:unit           # unit tests
```

If `check:guards-full` fails on burndown, **don't bypass it by regenerating the baseline upward** — that defeats the ratchet. Either fix the regression, or post in PR review explaining why the increase is justified (rare).

---

## Code style

- ESLint config in `eslint.config.js` is the source of truth
- `@typescript-eslint/no-explicit-any` is currently `warn` (not `error`) at the codebase level — but `check:cast-burndown` enforces no new `as any` casts in non-adapter code
- Adapter boundaries (`server/telemetry/`, `server/sync/`, `server/vessel-simulator/`, `server/external-integrations/`) have `no-explicit-any: off` because they handle raw external data
- Console: `console.log` is restricted in client code; `warn`/`error`/`info` are allowed everywhere; backend code can use `console.log` for operational logging

---

## Where to ask

- Architecture questions: read `replit.md` first, then ADR docs in `docs/adr/`
- Pattern questions: check existing implementations in `server/domains/<similar-domain>/`
- Anything that touches the dynamic-loader landmines or the dual-schema layer: ask in PR review before merging
