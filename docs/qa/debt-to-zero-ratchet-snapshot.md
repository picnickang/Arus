# Debt-to-Zero Ratchet Snapshot

Current source-of-truth counts for the PR #26 strictness and ratchet alignment
work. These numbers replace stale planning notes from earlier Wave 1 drafts.

| Ratchet                      |           Current count | Gate                                  |
| ---------------------------- | ----------------------: | ------------------------------------- |
| TypeScript strictness target |               9/9 flags | `npm run check:tsconfig-target`       |
| TypeScript errors            |                       0 | `npm run check:ts-burndown`           |
| Test-file typecheck          |                0 errors | `npm run check:tests`                 |
| ESLint warnings              |                   2,662 | `npm run check:lint-warnings`         |
| Prettier format debt         |                       0 | `npm run format:check`                |
| Knip atomic findings         |                   4,015 | `npm run check:dead-code`             |
| Domain leaks                 |                     598 | `npm run check:domain-leaks`          |
| Typed casts                  |                   1,297 | `npm run check:typed-casts`           |
| Bare casts                   | 4 production + 83 tests | `npm run check:cast-burndown`         |
| Explicit `any`               |                       0 | `npm run check:explicit-any-burndown` |

`tsconfig.eslint.json` intentionally keeps `noUncheckedIndexedAccess` and
`exactOptionalPropertyTypes` pinned off for the type-aware lint project. Unpin
those flags only with the planned nullish-coalescing burn-down and an explicit
`scripts/lint-warnings-baseline.json` refresh in the same change.

Wave 2 should burn down knip findings against `scripts/knip-baseline.json`;
it should not raise any bucket as part of routine cleanup.
