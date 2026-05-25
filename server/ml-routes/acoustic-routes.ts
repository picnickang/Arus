/**
 * ML Routes - Acoustic Analysis Routes
 * FFT-based acoustic analysis endpoint
 */

import { Router, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { mlAcousticDataSchema } from "@shared/schema-runtime";
import { z } from "zod";
import { createRequire } from "node:module";
import { structuredLog } from "../logging.js";
import { sendSuccess, sendBadRequest, handleError } from "../utils/api-response.js";

const require = createRequire(import.meta.url);
interface FFTUtils {
  fftMag: (phasors: [number, number][]) => number[];
  fftFreq: (phasors: [number, number][], sampleRate: number) => number[];
}
// ESM-safe import of the CJS `fft-js` package. With esModuleInterop the
// default import returns `module.exports`, which is `{ fft, ifft, util, … }`.
import fftjsDefault from "fft-js";
const fftjs = fftjsDefault as object as {
  fft: (signal: number[]) => [number, number][];
  util: FFTUtils;
};

const router = Router();

router.post("/ml/acoustic-analysis", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = mlAcousticDataSchema.parse(req.body);
    const dataPoints: number[] = parsed.data;
    const samplingRate: number = parsed.sampleRate;
    const equipmentTypeMeta = parsed.metadata?.['equipmentType'];
    const equipmentType: string =
      typeof equipmentTypeMeta === "string" ? equipmentTypeMeta : "unknown";

    const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(dataPoints.length)));
    const paddedSignal = [...dataPoints];
    while (paddedSignal.length < nextPowerOf2) {
      paddedSignal.push(0);
    }

    const phasors = fftjs.fft(paddedSignal);
    const magnitudes = fftjs.util.fftMag(phasors);
    const frequencies = fftjs.util.fftFreq(phasors, samplingRate);
    const nyquistIndex = Math.floor(magnitudes.length / 2);
    const validMagnitudes = magnitudes.slice(0, nyquistIndex);
    const validFrequencies = frequencies.slice(0, nyquistIndex);

    const rmsValue = Math.sqrt(
      dataPoints.reduce((sum: number, val: number) => sum + val * val, 0) / dataPoints.length
    );
    let maxMagnitude = 0,
      peakFrequencyIndex = 0;
    for (let i = 1; i < validMagnitudes.length; i++) {
      if (validMagnitudes[i] > maxMagnitude) {
        maxMagnitude = validMagnitudes[i];
        peakFrequencyIndex = i;
      }
    }
    const peakFrequency = validFrequencies[peakFrequencyIndex];

    const freqMagPairs = validFrequencies
      .slice(1)
      .map((freq, i) => ({ frequency: freq, magnitude: validMagnitudes[i + 1] }));
    freqMagPairs.sort((a, b) => b.magnitude - a.magnitude);
    const dominantFrequencies = freqMagPairs.slice(0, 5).map((p) => Math.round(p.frequency));

    const meanMag = validMagnitudes.reduce((sum, m) => sum + m, 0) / validMagnitudes.length;
    const variance =
      validMagnitudes.reduce((sum, m) => sum + Math.pow(m - meanMag, 2), 0) /
      validMagnitudes.length;
    const stdDev = Math.sqrt(variance);
    const spectralKurtosis =
      stdDev > 0
        ? validMagnitudes.reduce((sum, m) => sum + Math.pow((m - meanMag) / stdDev, 4), 0) /
          validMagnitudes.length
        : 3;

    const anomalies: string[] = [];
    let healthScore = 100;

    if (rmsValue > 0.1) {
      anomalies.push(`High overall vibration RMS (${rmsValue.toFixed(3)} g)`);
      healthScore -= 25;
    } else if (rmsValue > 0.05) {
      anomalies.push(`Elevated vibration RMS (${rmsValue.toFixed(3)} g)`);
      healthScore -= 10;
    }

    const totalSpectralEnergy = validMagnitudes.reduce((sum, m) => sum + m * m, 0);
    const avgSpectralEnergy = totalSpectralEnergy / validMagnitudes.length;

    const bearingFaultBands = [
      { min: 100, max: 300, name: "inner race", threshold: 3 },
      { min: 200, max: 500, name: "outer race", threshold: 2.5 },
      { min: 300, max: 600, name: "ball pass", threshold: 2.5 },
    ];

    for (const band of bearingFaultBands) {
      const bandPairs = freqMagPairs.filter(
        (p) => p.frequency >= band.min && p.frequency <= band.max && p.magnitude > meanMag * 2
      );
      if (bandPairs.length >= 2) {
        const bandEnergy =
          bandPairs.reduce((sum, p) => sum + p.magnitude * p.magnitude, 0) / bandPairs.length;
        if (bandEnergy > avgSpectralEnergy * band.threshold) {
          anomalies.push(
            `Elevated energy in ${band.name} frequency band (${band.min}-${band.max}Hz)`
          );
          healthScore -= 15;
        }
      }
    }

    const f1 = dominantFrequencies[0] || peakFrequency;
    const strongHarmonics = dominantFrequencies.filter((f) => {
      if (f === f1) {
        return false;
      }
      for (let h = 2; h <= 5; h++) {
        if (Math.abs(f - f1 * h) < 10) {
          return true;
        }
      }
      return false;
    });
    if (strongHarmonics.length >= 3) {
      anomalies.push("Multiple strong harmonics detected");
      healthScore -= 10;
    }

    if (spectralKurtosis > 8 && healthScore < 90) {
      anomalies.push("High spectral kurtosis indicates impulsive vibration");
      healthScore -= 10;
    }

    let health: "healthy" | "warning" | "critical";
    let recommendation: string;
    if (healthScore >= 85) {
      health = "healthy";
      recommendation =
        anomalies.length > 0
          ? "Minor issues detected. Continue monitoring."
          : "Equipment operating normally.";
    } else if (healthScore >= 50) {
      health = "warning";
      recommendation =
        healthScore >= 70
          ? "Monitor vibration levels closely."
          : "Schedule inspection within 7 days.";
    } else {
      health = "critical";
      recommendation = "Immediate inspection recommended.";
    }

    const confidence = Math.min(
      0.95,
      0.7 + (dataPoints.length / 4096) * 0.2 + (anomalies.length > 0 ? 0.05 : 0)
    );

    structuredLog("info", `Acoustic FFT analysis completed: ${health}`, {
      operation: "acoustic_analysis",
      metadata: { health, confidence, equipmentType },
    });

    sendSuccess(res, {
      health,
      confidence: Number.parseFloat(confidence.toFixed(2)),
      dominantFrequencies,
      anomalies: anomalies.length > 0 ? anomalies : ["No significant anomalies detected"],
      recommendation,
      rmsValue: Number.parseFloat(rmsValue.toFixed(4)),
      peakFrequency: Math.round(peakFrequency),
      spectralKurtosis: Number.parseFloat(spectralKurtosis.toFixed(2)),
      samplingRate,
      dataPointsAnalyzed: dataPoints.length,
      frequencyResolution: Number.parseFloat((samplingRate / nextPowerOf2).toFixed(2)),
      nyquistFrequency: samplingRate / 2,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendBadRequest(res, "Invalid acoustic data", { errors: error.errors });
    }
    handleError(error, res, "perform acoustic analysis");
  }
});

export const acousticRoutes = router;
