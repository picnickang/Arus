---
name: FormerCrewMember runtime shape vs declared type
description: The former-crew API returns full crew rows, so casts/mappers to CrewListItem carry real metric fields the declared type omits — don't zero them.
---

# FormerCrewMember runtime payload understates its declared type

`GET /api/crew/former` (former-crew repository) does an unprojected `select()` on
the `crew` table and returns `{ ...crewRow, employmentPeriods }`. So at **runtime**
each `FormerCrewMember` object also carries `maxHours7d` / `minRestH` (real `crew`
columns, DB defaults 72 / 10) even though the declared `FormerCrewMember` interface
omits them. `skills` is a **separate table** (not joined), so it is genuinely
runtime-undefined.

**Rule:** When replacing a blanket `as unknown as CrewListItem` cast with a real
mapper, preserve the runtime fields by spreading the source object first, then only
normalize true type mismatches and supply defaults for genuinely-absent fields.
Read the extra runtime fields through a constrained widening
(`member as FormerCrewMember & Partial<Pick<CrewListItem, ...>>`) — a plain `as`,
not `as unknown as`, so it stays off the cast-burndown gate.

**Why:** A naive mapper that hard-sets `maxHours7d: 0` silently zeroes real values
in the CSV export / profile dialog. And `0` violates the form-schema domain rules
(`maxHours7d >= 40`, `minRestH >= 6` in `crewManagementUtils.ts`), so fall back to
the schema column defaults (72 / 10), never `0`, when a value is truly absent.

**How to apply:** Any time a narrow declared type is fed by a `select *`/full-row
backend handler, assume the runtime object is wider than its TS type; spread to
preserve, default sanely.
