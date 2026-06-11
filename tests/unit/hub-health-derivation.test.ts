/**
 * deriveHubHealthFields — the one honest health derivation now shared by the
 * equipment hub AND the fleet-level repository (postgres-repository). When no
 * PdM score row exists every surface must say so (null) rather than fabricate
 * health=100 / RUL=365 / confidence=85%.
 */

import { deriveHubHealthFields } from "../../server/domains/equipment-intelligence/domain/hub-health";

describe("deriveHubHealthFields", () => {
  it("returns all nulls when there is no score and no prediction", () => {
    expect(deriveHubHealthFields(null, null)).toEqual({
      health: null,
      rul: null,
      confidence: null,
    });
  });

  it("passes a real health index through unchanged", () => {
    const r = deriveHubHealthFields(62, null);
    expect(r.health).toBe(62);
    expect(r.rul).toBeNull();
    expect(r.confidence).toBeNull();
  });

  it("derives rul and confidence only from a real prediction", () => {
    const r = deriveHubHealthFields(38, { remainingUsefulLife: 12, failureProbability: 0.76 });
    expect(r).toEqual({ health: 38, rul: 12, confidence: 76 });
  });

  it("never substitutes defaults for missing prediction fields", () => {
    const r = deriveHubHealthFields(90, {
      remainingUsefulLife: null,
      failureProbability: null,
    });
    expect(r.rul).toBeNull();
    expect(r.confidence).toBeNull();
  });
});
