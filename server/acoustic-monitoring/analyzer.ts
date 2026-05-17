/**
 * Acoustic Monitoring - Analyzer
 * Main acoustic analysis functions
 */

import { fft } from "fft-js";
import { mean } from "simple-statistics";
import type { AcousticFeatures, AcousticAnalysisResult } from "./types.js";
import {
  calculateZeroCrossingRate,
  calculateSpectralCentroid,
  calculateSpectralRolloff,
  calculateHarmonicRatio,
} from "./spectral-analysis.js";
import {
  detectBearingFault,
  detectGearFault,
  detectCavitation,
  detectLeakage,
  detectImbalance,
} from "./fault-detection.js";

function createEmptyAcousticFeatures(): AcousticFeatures {
  return {
    rms: 0,
    peakAmplitude: 0,
    spectralCentroid: 0,
    spectralRolloff: 0,
    zeroCrossingRate: 0,
    dominantFrequency: 0,
    harmonicRatio: 0,
    noiseFloor: 0,
    snr: 0,
    frequencyBands: { lowFreq: 0, midFreq: 0, highFreq: 0, ultrasonic: 0 },
    faultIndicators: {
      bearingFault: { detected: false, confidence: 0, frequency: null },
      gearFault: { detected: false, confidence: 0, frequency: null },
      cavitation: { detected: false, confidence: 0, intensity: 0 },
      leakage: { detected: false, confidence: 0, location: "unknown" },
      imbalance: { detected: false, confidence: 0 },
    },
  };
}

export function analyzeAcoustic(
  values: number[],
  sampleRate: number,
  rpm?: number
): AcousticFeatures {
  const n = values.length;
  if (n < 8) {
    return createEmptyAcousticFeatures();
  }

  const meanVal = mean(values);
  const acValues = values.map((x) => x - meanVal);
  const rms = Math.sqrt(mean(acValues.map((x) => x * x)));
  const peakAmplitude = Math.max(...acValues.map(Math.abs));
  const zeroCrossingRate = calculateZeroCrossingRate(acValues);

  const fftInput = acValues.map((x) => [x, 0] as [number, number]);
  const fftResult = fft(fftInput as unknown as number[]);
  const magnitudes = fftResult.slice(0, Math.floor(n / 2) + 1).map((complex: [number, number]) => {
    const [real, imag] = complex;
    return Math.sqrt(real * real + imag * imag) / n;
  });

  const frequencies: number[] = [];
  for (let i = 0; i < magnitudes.length; i++) {
    frequencies.push((i * sampleRate) / n);
  }

  let maxMagIndex = 0;
  let maxMag = magnitudes[0];
  for (let i = 1; i < magnitudes.length; i++) {
    if (magnitudes[i] > maxMag) {
      maxMag = magnitudes[i];
      maxMagIndex = i;
    }
  }
  const dominantFrequency = frequencies[maxMagIndex];

  const spectralCentroid = calculateSpectralCentroid(frequencies, magnitudes);
  const spectralRolloff = calculateSpectralRolloff(frequencies, magnitudes);
  const harmonicRatio = calculateHarmonicRatio(magnitudes, maxMagIndex);
  const noiseFloor = magnitudes
    .slice(1)
    .reduce((min: number, mag: number) => Math.min(min, mag), magnitudes[1] ?? 0);
  const snr = noiseFloor > 0 ? 20 * Math.log10(maxMag / noiseFloor) : 0;

  const frequencyBands = { lowFreq: 0, midFreq: 0, highFreq: 0, ultrasonic: 0 };
  for (let i = 0; i < frequencies.length; i++) {
    const freq = frequencies[i];
    const energy = magnitudes[i];
    if (freq < 500) {
      frequencyBands.lowFreq += energy;
    } else if (freq < 2000) {
      frequencyBands.midFreq += energy;
    } else if (freq < 10000) {
      frequencyBands.highFreq += energy;
    } else {
      frequencyBands.ultrasonic += energy;
    }
  }

  return {
    rms,
    peakAmplitude,
    spectralCentroid,
    spectralRolloff,
    zeroCrossingRate,
    dominantFrequency,
    harmonicRatio,
    noiseFloor,
    snr,
    frequencyBands,
    faultIndicators: {
      bearingFault: detectBearingFault(frequencies, magnitudes, rpm),
      gearFault: detectGearFault(frequencies, magnitudes, rpm),
      cavitation: detectCavitation(frequencies, magnitudes),
      leakage: detectLeakage(frequencies, magnitudes),
      imbalance: detectImbalance(frequencies, magnitudes, rpm),
    },
  };
}

type AnalysisState = {
  healthScore: number;
  severity: "normal" | "warning" | "critical";
  issues: string[];
  recs: string[];
};

function updateSeverity(
  current: "normal" | "warning" | "critical",
  newLevel: "warning" | "critical"
): "normal" | "warning" | "critical" {
  return current === "critical" ? "critical" : newLevel;
}

function assessBearingFault(f: AcousticFeatures, state: AnalysisState): void {
  const fault = f.faultIndicators.bearingFault;
  if (!fault.detected) {
    return;
  }
  state.healthScore -= fault.confidence * 30;
  if (fault.confidence > 0.7) {
    state.issues.push(`Critical bearing fault detected at ${fault.frequency?.toFixed(1)} Hz`);
    state.recs.push("Immediate bearing inspection required");
    state.severity = "critical";
  } else {
    state.issues.push(`Bearing wear detected at ${fault.frequency?.toFixed(1)} Hz`);
    state.recs.push("Schedule bearing inspection within 7 days");
    state.severity = updateSeverity(state.severity, "warning");
  }
}

function assessGearFault(f: AcousticFeatures, state: AnalysisState): void {
  const fault = f.faultIndicators.gearFault;
  if (!fault.detected) {
    return;
  }
  state.healthScore -= fault.confidence * 25;
  if (fault.confidence > 0.6) {
    state.issues.push(`Gear fault detected at ${fault.frequency?.toFixed(1)} Hz`);
    state.recs.push("Inspect gear teeth for wear or damage");
    state.severity = "critical";
  } else {
    state.issues.push("Early gear wear indicators present");
    state.recs.push("Monitor gear mesh frequency trend");
    state.severity = updateSeverity(state.severity, "warning");
  }
}

function assessCavitation(f: AcousticFeatures, state: AnalysisState): void {
  const fault = f.faultIndicators.cavitation;
  if (!fault.detected) {
    return;
  }
  state.healthScore -= fault.confidence * 35;
  if (fault.confidence > 0.6) {
    state.issues.push(
      `Severe cavitation detected (intensity: ${(fault.intensity * 100).toFixed(0)}%)`
    );
    state.recs.push("Check suction conditions and NPSH immediately");
    state.severity = "critical";
  } else {
    state.issues.push("Cavitation indicators present");
    state.recs.push("Verify pump inlet pressure and flow conditions");
    state.severity = updateSeverity(state.severity, "warning");
  }
}

function assessLeakage(f: AcousticFeatures, state: AnalysisState): void {
  const fault = f.faultIndicators.leakage;
  if (!fault.detected) {
    return;
  }
  state.healthScore -= fault.confidence * 20;
  state.issues.push(`Potential leakage detected (${fault.location})`);
  state.recs.push("Perform ultrasonic leak detection survey");
  state.severity = updateSeverity(state.severity, "warning");
}

function assessImbalance(f: AcousticFeatures, state: AnalysisState): void {
  const fault = f.faultIndicators.imbalance;
  if (!fault.detected) {
    return;
  }
  state.healthScore -= fault.confidence * 15;
  if (fault.confidence > 0.7) {
    state.issues.push("Significant rotor imbalance detected");
    state.recs.push("Balance rotor or check for mass loss/buildup");
    state.severity = updateSeverity(state.severity, "warning");
  } else {
    state.issues.push("Minor imbalance present");
    state.recs.push("Monitor imbalance trend");
  }
}

function assessNoiseQuality(f: AcousticFeatures, state: AnalysisState): void {
  if (f.noiseFloor > f.rms * 0.5) {
    state.healthScore -= 10;
    state.issues.push("High background noise detected");
    state.recs.push("Check for external noise sources or sensor placement");
  }
  if (f.snr < 10) {
    state.healthScore -= 5;
    state.recs.push("Improve signal quality or sensor placement");
  }
}

export function performAcousticAnalysis(
  values: number[],
  sampleRate: number,
  equipmentType?: string,
  rpm?: number
): AcousticAnalysisResult {
  const features = analyzeAcoustic(values, sampleRate, rpm);
  const state: AnalysisState = { healthScore: 100, severity: "normal", issues: [], recs: [] };

  assessBearingFault(features, state);
  assessGearFault(features, state);
  assessCavitation(features, state);
  assessLeakage(features, state);
  assessImbalance(features, state);
  assessNoiseQuality(features, state);

  state.healthScore = Math.max(0, Math.min(100, state.healthScore));
  if (state.issues.length === 0) {
    state.issues.push("No acoustic anomalies detected");
    state.recs.push("Continue routine monitoring");
  }

  return {
    features,
    severity: state.severity,
    primaryIssues: state.issues,
    recommendations: state.recs,
    healthScore: state.healthScore,
  };
}
