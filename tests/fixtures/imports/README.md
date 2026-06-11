# Import Adapter Golden Fixtures (LR-2)

Deterministic CSV fixtures consumed by `tests/integration/import-amos-golden.test.ts`
and `tests/integration/import-shipmate-golden.test.ts`. Two principles:

1.  **Realistic but minimal.** Each fixture has 4–5 rows — enough to
    exercise upsert, hierarchy, parent linkage, and field-mapping
    transforms (criticality, dates, booleans) without bloating the
    test runtime.
2.  **Vessel codes are fictional.** `LR-FIXT-001` (AMOS) and
    `SHIPMATE-FIXT-001` (SHIPMATE) are namespaced with `LR-FIXT-` /
    `SHIPMATE-FIXT-` so they cannot collide with real vessel codes in
    any tenant's data.

| File                               | Module                 | Purpose                                                                                                 |
| ---------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `amos-equipment-valid.csv`         | AMOS equipment         | Happy-path import — 5 rows, hierarchical (pumps reference `ME-001`)                                     |
| `amos-equipment-malformed.csv`     | AMOS equipment         | Mixed valid/invalid — 3 broken rows (missing required `EQUIPMENT_NO` or `DESCRIPTION`) + 1 valid row    |
| `shipmate-equipment-valid.csv`     | SHIPMATE pms_equipment | Happy-path with dot-notation hierarchy + DD/MM/YYYY dates                                               |
| `shipmate-equipment-malformed.csv` | SHIPMATE pms_equipment | Mixed valid/invalid — 3 broken rows (missing required `Component No` or `Component Name`) + 1 valid row |

## Idempotency-test contract

The "duplicate / idempotent" specs import the same valid fixture twice
under a freshly-generated tenant id. The first call must report
`imported > 0`; the second call must report `updated > 0` and zero
errors. The tenant id is suite-scoped and the suite teardown deletes
all data it created — fixtures never leak into shared dev data.
