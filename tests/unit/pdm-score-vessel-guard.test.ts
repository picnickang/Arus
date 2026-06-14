/**
 * PdM-score reads degrade gracefully in vessel/local mode.
 *
 * `pdm_score_logs` is a cloud-only table (undefined in the runtime schema when
 * LOCAL_MODE/EMBEDDED_MODE is set), so the DatabaseDevicesStorage PdM-score
 * methods previously dereferenced an undefined table and threw — which surfaced
 * as a 500 on GET /api/pdm/health and the other read paths that call
 * getPdmScores (fleet summaries, exports, LLM dossiers). The guards now return
 * empty instead. The unit lane runs in embedded/local mode, so these exercise
 * the guarded branch directly.
 */

import { describe, it, expect } from "@jest/globals";

import { dbDevicesStorage } from "../../server/db/devices";

describe("PdM score reads in vessel/local mode", () => {
  it("getPdmScores resolves to [] instead of throwing", async () => {
    await expect(dbDevicesStorage.getPdmScores("eq-x")).resolves.toEqual([]);
    await expect(dbDevicesStorage.getPdmScores()).resolves.toEqual([]);
  });

  it("getLatestPdmScore resolves to undefined", async () => {
    await expect(dbDevicesStorage.getLatestPdmScore("eq-x")).resolves.toBeUndefined();
  });
});
