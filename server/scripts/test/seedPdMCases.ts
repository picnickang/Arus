/**
 * Seed script for PdM test cases
 * Creates canonical test scenarios using the failurePredictions table:
 *
 * Case A: "Schedulable High Risk" - Should be scheduled within the week
 * Case B: "Scheduling Conflict" - P10 > P90 so earliestStart > latestFinish
 * Case C: "Capacity Conflict" - Two tasks same vessel same preferred date
 * Case D: "Insufficient Confidence" - Confidence below 50% threshold
 */

import { db } from "../../db";
import { failurePredictions } from "../../../shared/schema/ml-analytics-core";
import { equipment, vessels } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_ORG_ID } from "../../../shared/config/tenant";
import { v4 as uuid } from "uuid";
import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Scripts:Test:SeedPdMCases");

interface SeedOptions {
  clearExisting?: boolean;
}

export async function seedPdMTestCases(options: SeedOptions = {}) {
  const now = new Date();

  if (options.clearExisting) {
    await db.delete(failurePredictions).execute();
    logger.info("[SeedPdM] Cleared existing failure predictions");
  }

  const allVessels = await db
    .select()
    .from(vessels)
    .where(eq(vessels.orgId, DEFAULT_ORG_ID))
    .limit(1);

  if (allVessels.length === 0) {
    logger.error("[SeedPdM] No vessels found. Please seed vessels first.");
    logger.info("[SeedPdM] Run: npx tsx server/scripts/seed-vessels.ts");
    return;
  }

  const testVesselId = allVessels[0]!.id;
  const testVesselName = allVessels[0]!.name;
  logger.info(`[SeedPdM] Using vessel: ${testVesselName} (${testVesselId})`);

  let vesselEquipment = await db
    .select()
    .from(equipment)
    .where(eq(equipment.vesselId, testVesselId))
    .limit(4);

  if (vesselEquipment.length < 4) {
    logger.info(
      `[SeedPdM] Only ${vesselEquipment.length} equipment on vessel. Creating test equipment...`
    );

    const needed = 4 - vesselEquipment.length;
    const testEquipmentTypes = ["Pump", "Generator", "Engine", "Compressor"];

    for (let i = 0; i < needed; i++) {
      const eqId = uuid();
      const eqType = testEquipmentTypes[(vesselEquipment.length + i) % testEquipmentTypes.length];
      try {
        await (
          db.insert(equipment).values as object as (v: Record<string, unknown>) => Promise<unknown>
        )({
          id: eqId,
          orgId: DEFAULT_ORG_ID,
          vesselId: testVesselId,
          name: `PdM Test ${eqType} ${i + 1}`,
          type: eqType,
          manufacturer: "Test Manufacturer",
          model: "Test Model",
          serialNumber: `PDM-TEST-${i + 1}`,
          status: "operational",
        });
        logger.info(`[SeedPdM] Created equipment: PdM Test ${eqType} ${i + 1}`);
      } catch (err) {
        logger.error(`[SeedPdM] Failed to create equipment: ${err}`);
      }
    }

    vesselEquipment = await db
      .select()
      .from(equipment)
      .where(eq(equipment.vesselId, testVesselId))
      .limit(4);
  }

  if (vesselEquipment.length < 4) {
    logger.error("[SeedPdM] Could not ensure 4 equipment on vessel. Aborting.");
    return;
  }
  const eq0 = vesselEquipment[0];
  const eq1 = vesselEquipment[1];
  const eq2 = vesselEquipment[2];
  const eq3 = vesselEquipment[3];
  if (!eq0 || !eq1 || !eq2 || !eq3) {
    logger.error("[SeedPdM] vesselEquipment slice undefined. Aborting.");
    return;
  }

  logger.info(
    `[SeedPdM] Using ${vesselEquipment.length} equipment items on vessel ${testVesselName}`
  );

  const testCases = [
    {
      orgId: DEFAULT_ORG_ID,
      equipmentId: eq0.id,
      predictionTimestamp: now,
      failureProbability: 0.25,
      predictedFailureDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      remainingUsefulLife: 10,
      confidenceInterval: { lowDays: 7, highDays: 14 },
      failureMode: "Case A: Schedulable High Risk",
      riskLevel: "high",
      maintenanceRecommendations: ["Schedule maintenance within scheduling window"],
    },
    {
      orgId: DEFAULT_ORG_ID,
      equipmentId: eq1.id,
      predictionTimestamp: now,
      failureProbability: 0.4,
      predictedFailureDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
      remainingUsefulLife: 5,
      confidenceInterval: { lowDays: 6, highDays: 3 },
      failureMode: "Case B: Scheduling Conflict (P10 > P90)",
      riskLevel: "critical",
      maintenanceRecommendations: ["Blocked - earliestStart > latestFinish"],
    },
    {
      orgId: DEFAULT_ORG_ID,
      equipmentId: eq2.id,
      predictionTimestamp: now,
      failureProbability: 0.35,
      predictedFailureDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      remainingUsefulLife: 10,
      confidenceInterval: { lowDays: 7, highDays: 14 },
      failureMode: "Case C1: Capacity Test - First Task",
      riskLevel: "medium",
      maintenanceRecommendations: ["Replace pump seals"],
    },
    {
      orgId: DEFAULT_ORG_ID,
      equipmentId: eq3.id,
      predictionTimestamp: now,
      failureProbability: 0.4,
      predictedFailureDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      remainingUsefulLife: 10,
      confidenceInterval: { lowDays: 7, highDays: 14 },
      failureMode: "Case C2: Capacity Test - Blocked by capacity",
      riskLevel: "medium",
      maintenanceRecommendations: ["Replace pump seals"],
    },
    {
      orgId: DEFAULT_ORG_ID,
      equipmentId: eq0.id,
      predictionTimestamp: new Date(now.getTime() - 1000),
      failureProbability: 0.75,
      predictedFailureDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
      remainingUsefulLife: 15,
      confidenceInterval: { lowDays: 10, highDays: 20 },
      failureMode: "Case D: Insufficient Confidence (25%)",
      riskLevel: "low",
      maintenanceRecommendations: ["Monitor - confidence too low for scheduling"],
    },
  ];

  for (const testCase of testCases) {
    try {
      await db.insert(failurePredictions).values(testCase);
      logger.info(`[SeedPdM] Created: ${testCase.failureMode}`);
    } catch (error) {
      logger.error(`[SeedPdM] Failed to create: ${testCase.failureMode}`, undefined, error);
    }
  }

  logger.info("\n[SeedPdM] Completed seeding test cases");
  logger.info("\n=== Expected Results ===");
  logger.info("Case A: SCHEDULED (failureProb=0.25 -> confidence=75%, good RUL window)");
  logger.info(
    "Case B: BLOCKED scheduling_conflict (failureProb=0.40 -> confidence=60%, P10=6 > P90=3)"
  );
  logger.info("Case C1: SCHEDULED (failureProb=0.35 -> confidence=65%, first on vessel)");
  logger.info("Case C2: BLOCKED capacity (failureProb=0.40 -> confidence=60%, same vessel/date)");
  logger.info("Case D: BLOCKED insufficient_confidence (failureProb=0.75 -> confidence=25% < 50%)");
  logger.info("\nNote: C1 and C2 must be on same vessel for capacity test to work");
  logger.info(`All equipment is on vessel: ${testVesselName} (${testVesselId})`);

  return testCases;
}

seedPdMTestCases({ clearExisting: false })
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error("[SeedPdM] Error:", undefined, err);
    process.exit(1);
  });
