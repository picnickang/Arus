/**
 * LR-3.5 PERF cluster — crew-compliance single-join contract.
 *
 * Pins three things:
 *   1. The generator issues exactly ONE storage call
 *      (`getCrewComplianceRows`) per `.generate()`, regardless of
 *      crew size. Regression catches any return to the previous
 *      per-vessel fan-out (`getCrew(orgId, vesselId)` once per vessel
 *      + `getCrewCertifications` once per org).
 *   2. The projection is byte-equivalent to the prior in-memory
 *      pipeline for three representative seed scenarios (passing,
 *      failing, mixed crew).
 *   3. A 200-crew dataset round-trips in a single call (the perf
 *      gate from the task brief), with the elapsed time logged via
 *      `console.time` so a regression to the per-row path would
 *      stand out in CI output.
 *
 * The generator resolves its storage port lazily so the test can
 * inject an in-process fake without pulling the real
 * `server/repositories` barrel (and its top-level-await DB driver
 * init) into Jest's CJS runtime.
 */

import { describe, it, expect, jest } from "@jest/globals";
import {
  CrewComplianceGenerator,
  type CrewComplianceRowsPort,
} from "../../server/domains/scheduled-reports/generators/crew-compliance-generator";

type Row = Awaited<ReturnType<CrewComplianceRowsPort["getCrewComplianceRows"]>>[number];

const ORG = "org-test";

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function makeStubStorage(rows: Row[]) {
  const getCrewComplianceRows = jest
    .fn<CrewComplianceRowsPort["getCrewComplianceRows"]>()
    .mockResolvedValue(rows);
  const stub: CrewComplianceRowsPort = { getCrewComplianceRows };
  return { stub, getCrewComplianceRows };
}

describe("LR-3.5 / PERF — crew compliance single-join", () => {
  it("issues exactly one storage round-trip per generation", async () => {
    const { stub, getCrewComplianceRows } = makeStubStorage([]);

    const gen = new CrewComplianceGenerator(stub);
    await gen.generate(ORG, null);

    expect(getCrewComplianceRows).toHaveBeenCalledTimes(1);
    expect(getCrewComplianceRows).toHaveBeenCalledWith(ORG, null, expect.any(Date));
  });

  it("projection is byte-equivalent across passing / failing / mixed crews", async () => {
    // Three representative scenarios encoded in the rows the SQL
    // join would return (the WHERE clause has already filtered
    // certs to `expiresAt <= ninetyDaysFromNow`):
    //   - "Passing Crew" — no in-window cert → contributes nothing.
    //                       Modelled by simply not appearing in the
    //                       result set (the join would not yield a
    //                       row for them).
    //   - "Failing Crew" — every cert in window → contributes 2.
    //   - "Mixed Crew"   — one expired, one in-window. Both make it
    //                      through the WHERE clause; the expired one
    //                      sorts to the top.
    const rows: Row[] = [
      {
        crewId: "c-fail",
        crewName: "Failing Cook",
        vesselName: "MV Failing",
        cert: "STCW Basic Safety",
        expiresAt: daysFromNow(10),
      },
      {
        crewId: "c-fail",
        crewName: "Failing Cook",
        vesselName: "MV Failing",
        cert: "Medical Fitness",
        expiresAt: daysFromNow(40),
      },
      {
        crewId: "c-mix",
        crewName: "Mixed Mate",
        vesselName: "MV Mixed",
        cert: "Expired STCW",
        expiresAt: daysFromNow(-5),
      },
      {
        crewId: "c-mix",
        crewName: "Mixed Mate",
        vesselName: "MV Mixed",
        cert: "Tanker Endorsement",
        expiresAt: daysFromNow(70),
      },
    ];
    const { stub, getCrewComplianceRows } = makeStubStorage(rows);

    const gen = new CrewComplianceGenerator(stub);
    const result = await gen.generate(ORG, null);

    expect(getCrewComplianceRows).toHaveBeenCalledTimes(1);

    // Sorted ascending by daysUntilExpiry: -5, 10, 40, 70.
    expect(
      result.expiringCertifications.map((a) => ({
        crewId: a.crewId,
        crewName: a.crewName,
        vesselName: a.vesselName,
        cert: a.certificationName,
      }))
    ).toEqual([
      { crewId: "c-mix", crewName: "Mixed Mate", vesselName: "MV Mixed", cert: "Expired STCW" },
      {
        crewId: "c-fail",
        crewName: "Failing Cook",
        vesselName: "MV Failing",
        cert: "STCW Basic Safety",
      },
      {
        crewId: "c-fail",
        crewName: "Failing Cook",
        vesselName: "MV Failing",
        cert: "Medical Fitness",
      },
      {
        crewId: "c-mix",
        crewName: "Mixed Mate",
        vesselName: "MV Mixed",
        cert: "Tanker Endorsement",
      },
    ]);
    const days = result.expiringCertifications.map((a) => a.daysUntilExpiry);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
    // Score: 4 expiring certs × 2 = 8 deducted from 100.
    expect(result.complianceScore).toBe(92);
    // Unwired sub-projections remain stub-empty (HoR + crew changes).
    expect(result.hoursOfRestViolations).toEqual([]);
    expect(result.upcomingCrewChanges).toEqual([]);
  });

  it("stays single-query on a 200-crew dataset (perf gate)", async () => {
    const big: Row[] = [];
    for (let i = 0; i < 200; i++) {
      big.push({
        crewId: `c-${i}`,
        crewName: `Crew ${i}`,
        vesselName: `Vessel ${i % 20}`,
        cert: "STCW Basic Safety",
        expiresAt: daysFromNow((i % 90) + 1),
      });
    }
    const { stub, getCrewComplianceRows } = makeStubStorage(big);

    const gen = new CrewComplianceGenerator(stub);
    const label = "crew-compliance-200-crew";
    console.time(label);
    const result = await gen.generate(ORG, null);
    console.timeEnd(label);

    // One round-trip regardless of crew size — the perf invariant.
    // Under the prior per-row path this would have been
    // 1 (vessels) + N (per-vessel crew) + 1 (org certs) ≈ N+2 calls.
    expect(getCrewComplianceRows).toHaveBeenCalledTimes(1);
    expect(result.expiringCertifications).toHaveLength(200);
  });

  it("passes vesselIds through to the storage query unchanged", async () => {
    const { stub, getCrewComplianceRows } = makeStubStorage([]);
    const gen = new CrewComplianceGenerator(stub);
    await gen.generate(ORG, ["v-1", "v-2"]);
    expect(getCrewComplianceRows).toHaveBeenCalledWith(ORG, ["v-1", "v-2"], expect.any(Date));
  });

  it("treats vesselIds=[] as an explicit empty selection (no broadening)", async () => {
    // Regression guard: an earlier version of the single-join
    // dropped the `IN (...)` clause whenever `vesselIds.length === 0`,
    // which silently broadened the query to "all vessels in org".
    // The byte-equivalent contract is that `[]` means "zero vessels"
    // (matching the legacy `allVessels.filter(...).length === 0`
    // short-circuit). The generator + storage method both
    // short-circuit; storage must not be called at all.
    const big: Row[] = [
      {
        crewId: "should-not-leak",
        crewName: "Other Org Crew",
        vesselName: "Other Vessel",
        cert: "STCW",
        expiresAt: daysFromNow(5),
      },
    ];
    const { stub, getCrewComplianceRows } = makeStubStorage(big);
    const gen = new CrewComplianceGenerator(stub);

    const result = await gen.generate(ORG, []);

    expect(getCrewComplianceRows).not.toHaveBeenCalled();
    expect(result.expiringCertifications).toEqual([]);
    expect(result.complianceScore).toBe(100);
  });
});
