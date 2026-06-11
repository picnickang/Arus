/**
 * Acoustic Monitoring - Fault Detection
 * Equipment fault detection from acoustic signatures
 */

export function detectBearingFault(
  frequencies: number[],
  magnitudes: number[],
  rpm?: number
): { detected: boolean; confidence: number; frequency: number | null } {
  if (!rpm || rpm <= 0) {
    return { detected: false, confidence: 0, frequency: null };
  }
  const rotationFreq = rpm / 60;
  const bearingBandLow = rotationFreq * 2;
  const bearingBandHigh = rotationFreq * 10;
  let maxMagnitude = 0;
  let faultFreq: number | null = null;
  for (let i = 0; i < frequencies.length; i++) {
    const f = frequencies[i];
    const m = magnitudes[i];
    if (f === undefined || m === undefined) {
      continue;
    }
    if (f >= bearingBandLow && f <= bearingBandHigh && m > maxMagnitude) {
      maxMagnitude = m;
      faultFreq = f;
    }
  }
  const avgMagnitude = magnitudes.reduce((sum, mag) => sum + mag, 0) / magnitudes.length;
  const threshold = avgMagnitude * 3;
  const detected = maxMagnitude > threshold;
  const confidence = detected ? Math.min(1, maxMagnitude / (avgMagnitude * 10)) : 0;
  return { detected, confidence, frequency: faultFreq };
}

export function detectGearFault(
  frequencies: number[],
  magnitudes: number[],
  rpm?: number
): { detected: boolean; confidence: number; frequency: number | null } {
  if (!rpm || rpm <= 0) {
    return { detected: false, confidence: 0, frequency: null };
  }
  const rotationFreq = rpm / 60;
  const gearBandLow = rotationFreq * 10;
  const gearBandHigh = rotationFreq * 50;
  let maxMagnitude = 0;
  let faultFreq: number | null = null;
  for (let i = 0; i < frequencies.length; i++) {
    const f = frequencies[i];
    const m = magnitudes[i];
    if (f === undefined || m === undefined) {
      continue;
    }
    if (f >= gearBandLow && f <= gearBandHigh && m > maxMagnitude) {
      maxMagnitude = m;
      faultFreq = f;
    }
  }
  const avgMagnitude = magnitudes.reduce((sum, mag) => sum + mag, 0) / magnitudes.length;
  const threshold = avgMagnitude * 2.5;
  const detected = maxMagnitude > threshold;
  const confidence = detected ? Math.min(1, maxMagnitude / (avgMagnitude * 8)) : 0;
  return { detected, confidence, frequency: faultFreq };
}

export function detectCavitation(
  frequencies: number[],
  magnitudes: number[]
): { detected: boolean; confidence: number; intensity: number } {
  const cavitationBandLow = 2000;
  const cavitationBandHigh = 10000;
  let bandEnergy = 0;
  for (let i = 0; i < frequencies.length; i++) {
    const f = frequencies[i];
    const m = magnitudes[i];
    if (f === undefined || m === undefined) {
      continue;
    }
    if (f >= cavitationBandLow && f <= cavitationBandHigh) {
      bandEnergy += m;
    }
  }
  const totalEnergy = magnitudes.reduce((sum, mag) => sum + mag, 0);
  const bandRatio = totalEnergy > 0 ? bandEnergy / totalEnergy : 0;
  const detected = bandRatio > 0.3;
  const confidence = Math.min(1, bandRatio * 2);
  return { detected, confidence, intensity: bandRatio };
}

export function detectLeakage(
  frequencies: number[],
  magnitudes: number[]
): { detected: boolean; confidence: number; location: "possible" | "likely" | "unknown" } {
  const ultrasonicThreshold = 10000;
  let ultrasonicEnergy = 0;
  for (let i = 0; i < frequencies.length; i++) {
    const f = frequencies[i];
    const m = magnitudes[i];
    if (f === undefined || m === undefined) {
      continue;
    }
    if (f >= ultrasonicThreshold) {
      ultrasonicEnergy += m;
    }
  }
  const totalEnergy = magnitudes.reduce((sum, mag) => sum + mag, 0);
  const ultrasonicRatio = totalEnergy > 0 ? ultrasonicEnergy / totalEnergy : 0;
  const detected = ultrasonicRatio > 0.15;
  const confidence = Math.min(1, ultrasonicRatio * 5);
  let location: "possible" | "likely" | "unknown" = "unknown";
  if (detected) {
    location = ultrasonicRatio > 0.25 ? "likely" : "possible";
  }
  return { detected, confidence, location };
}

export function detectImbalance(
  frequencies: number[],
  magnitudes: number[],
  rpm?: number
): { detected: boolean; confidence: number } {
  if (!rpm || rpm <= 0) {
    return { detected: false, confidence: 0 };
  }
  const rotationFreq = rpm / 60;
  const tolerance = rotationFreq * 0.1;
  let maxMagnitude = 0;
  for (let i = 0; i < frequencies.length; i++) {
    const f = frequencies[i];
    const m = magnitudes[i];
    if (f === undefined || m === undefined) {
      continue;
    }
    if (Math.abs(f - rotationFreq) < tolerance) {
      maxMagnitude = Math.max(maxMagnitude, m);
    }
  }
  const avgMagnitude = magnitudes.reduce((sum, mag) => sum + mag, 0) / magnitudes.length;
  const threshold = avgMagnitude * 4;
  const detected = maxMagnitude > threshold;
  const confidence = detected ? Math.min(1, maxMagnitude / (avgMagnitude * 10)) : 0;
  return { detected, confidence };
}
