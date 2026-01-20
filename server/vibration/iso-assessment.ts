/**
 * ISO 10816 Vibration Assessment Module
 * Implements severity zone classification per ISO standard
 */

import type { ISO10816Assessment, ISO10816MachineClass } from "./types";

const iso10816ThresholdMap: Record<ISO10816MachineClass, { zoneALimit: number; zoneBLimit: number; zoneCLimit: number }> = {
  I: { zoneALimit: 0.71, zoneBLimit: 1.8, zoneCLimit: 4.5 },
  II: { zoneALimit: 1.12, zoneBLimit: 2.8, zoneCLimit: 7.1 },
  III: { zoneALimit: 1.8, zoneBLimit: 4.5, zoneCLimit: 11.2 },
  IV: { zoneALimit: 2.8, zoneBLimit: 7.1, zoneCLimit: 18 },
};

/**
 * Get ISO 10816 severity zone thresholds based on machine class
 */
function getISO10816Thresholds(machineClass: ISO10816MachineClass): {
  zoneALimit: number;
  zoneBLimit: number;
  zoneCLimit: number;
} {
  return iso10816ThresholdMap[machineClass] ?? iso10816ThresholdMap.III;
}

/**
 * Assess vibration severity according to ISO 10816 standard
 */
export function assessISO10816(
  velocityRms: number,
  machineClass: ISO10816MachineClass
): ISO10816Assessment {
  const thresholds = getISO10816Thresholds(machineClass);

  let severityZone: "A" | "B" | "C" | "D";
  let assessment: string;

  if (velocityRms <= thresholds.zoneALimit) {
    severityZone = "A";
    assessment = "Good - Newly commissioned machines in excellent condition";
  } else if (velocityRms <= thresholds.zoneBLimit) {
    severityZone = "B";
    assessment = "Satisfactory - Machines considered acceptable for unrestricted long-term operation";
  } else if (velocityRms <= thresholds.zoneCLimit) {
    severityZone = "C";
    assessment = "Unsatisfactory - Machines where action should be taken to reduce vibration";
  } else {
    severityZone = "D";
    assessment = "Unacceptable - Machines where urgent action is required to prevent damage";
  }

  return {
    severityZone,
    velocityRms,
    machineClass,
    thresholds,
    assessment,
  };
}

/**
 * Convert acceleration to velocity using integration approximation
 */
export function accelerationToVelocity(accelerationRms: number, dominantFrequency: number): number {
  if (dominantFrequency === 0) {return 0;}
  return (accelerationRms / (2 * Math.PI * dominantFrequency)) * 1000;
}
