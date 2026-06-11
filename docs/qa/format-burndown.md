# Prettier format burndown — COMPLETE

The formatting debt tracked here was eliminated in one repo-wide
`prettier --write .` pass (Wave 1 of the debt-to-zero program).

- Unformatted files: 1,685 → 1,540 → **0**.
- The counting ratchet (`scripts/check-format-ratchet.mjs` +
  `scripts/format-baseline.json`) has been deleted.
- The replacement gate is `npm run format:check` (`prettier --check .`),
  wired into CI ("Prettier format gate") and `check:guards-full`.
  Any unformatted file now fails CI outright; run `npm run format`
  before committing.
