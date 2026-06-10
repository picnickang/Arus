import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deriveHubHealthFields } from "../../server/domains/equipment-intelligence/domain/hub-health";

const PAGE = readFileSync(
  join(process.cwd(), "client/src/pages/pdm-platform.tsx"),
  "utf8"
);

function extractArray(name: string): string[] {
  const match = PAGE.match(new RegExp(`const ${name} = \\[([^\\]]+)\\]`));
  if (!match?.[1]) {
    throw new Error(`${name} not found in pdm-platform.tsx`);
  }
  return [...match[1].matchAll(/"([a-z-]+)"/g)].map((m) => m[1] as string);
}

describe("pdm-platform operator / ML Ops tab partition", () => {
  const valid = extractArray("VALID_TABS");
  const operator = extractArray("OPERATOR_TABS");
  const mlOps = extractArray("ML_OPS_TABS");

  it("keeps all 10 historical tab ids valid (deep links unchanged)", () => {
    expect(valid).toHaveLength(10);
    expect(valid).toEqual(
      expect.arrayContaining(["schedule", "diagnostics", "governance", "decision-support"])
    );
  });

  it("partitions VALID_TABS exactly, with no overlap", () => {
    const union = [...operator, ...mlOps].sort();
    expect(union).toEqual([...valid].sort());
    expect(new Set(union).size).toBe(union.length);
  });

  it("defaults to an operator tab so gated users never land stranded", () => {
    const def = PAGE.match(/const DEFAULT_TAB = "([a-z-]+)"/)?.[1];
    expect(def).toBeDefined();
    expect(operator).toContain(def);
    expect(mlOps).not.toContain(def);
  });

  it("gates the ML Ops group on the existing predictive_maintenance permission", () => {
    expect(PAGE).toContain('hasPermission("predictive_maintenance", "manage_config")');
  });
});

describe("equipment hub honest health derivation", () => {
  it("returns nulls (not fake-healthy defaults) when no score or prediction exists", () => {
    expect(deriveHubHealthFields(null, null)).toEqual({
      health: null,
      rul: null,
      confidence: null,
    });
  });

  it("passes through real values when present", () => {
    expect(
      deriveHubHealthFields(62, { remainingUsefulLife: 38, failureProbability: 0.81 })
    ).toEqual({ health: 62, rul: 38, confidence: 81 });
  });

  it("never resurrects the historical 100/365/85 fabrications", () => {
    const empty = deriveHubHealthFields(null, {});
    expect(empty.health).not.toBe(100);
    expect(empty.rul).not.toBe(365);
    expect(empty.confidence).not.toBe(85);
  });
});
