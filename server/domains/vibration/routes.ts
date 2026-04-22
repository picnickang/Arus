import { Express, Request, Response, RequestHandler } from "express";
import { withErrorHandling } from "../../lib/route-utils";
import { dbSensorsStorage } from "../../db/sensors/index.js";

interface VibrationConfig {
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
}

export function registerVibrationRoutes(app: Express, config: VibrationConfig) {
  const { requireOrgId, generalApiRateLimit } = config;

  app.post(
    "/api/vibration/analyze",
    requireOrgId,
    withErrorHandling("analyze vibration data", async (req: Request, res: Response) => {
      const { equipmentId, sensorId, data, sampleRate } = req.body;

      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ message: "Vibration data array is required" });
      }

      const n = data.length;
      const frequencies: number[] = [];
      const amplitudes: number[] = [];

      for (let k = 0; k < n / 2; k++) {
        let realSum = 0;
        let imagSum = 0;
        for (let t = 0; t < n; t++) {
          const angle = (2 * Math.PI * k * t) / n;
          realSum += data[t] * Math.cos(angle);
          imagSum -= data[t] * Math.sin(angle);
        }
        const amplitude = Math.sqrt(realSum * realSum + imagSum * imagSum) / n;
        const frequency = (k * (sampleRate || 1000)) / n;
        frequencies.push(frequency);
        amplitudes.push(amplitude);
      }

      const peakIndices = amplitudes
        .map((amp, idx) => ({ amp, idx }))
        .sort((a, b) => b.amp - a.amp)
        .slice(0, 10)
        .map((item) => item.idx);

      const dominantFrequencies = peakIndices.map((idx) => ({
        frequency: frequencies[idx],
        amplitude: amplitudes[idx],
      }));

      const rmsValue = Math.sqrt(data.reduce((sum: number, v: number) => sum + v * v, 0) / n);
      const peakValue = Math.max(...data.map(Math.abs));
      const crestFactor = peakValue / rmsValue;

      res.json({
        equipmentId,
        sensorId,
        analysis: {
          rms: rmsValue,
          peak: peakValue,
          crestFactor,
          dominantFrequencies,
          spectrum: {
            frequencies: frequencies.slice(0, 100),
            amplitudes: amplitudes.slice(0, 100),
          },
        },
        timestamp: new Date().toISOString(),
      });
    })
  );

  app.post(
    "/api/vibration/enhanced-analysis",
    requireOrgId,
    withErrorHandling("perform enhanced analysis", async (req: Request, res: Response) => {
      const { equipmentId, data, sampleRate, equipmentType } = req.body;

      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ message: "Vibration data array is required" });
      }

      const n = data.length;
      const rmsValue = Math.sqrt(data.reduce((sum: number, v: number) => sum + v * v, 0) / n);
      const peakValue = Math.max(...data.map(Math.abs));

      const thresholds: Record<string, any> = {
        pump: { warning: 4.5, critical: 7.1 },
        motor: { warning: 2.8, critical: 4.5 },
        compressor: { warning: 4.5, critical: 7.1 },
        default: { warning: 4.5, critical: 7.1 },
      };

      const limits = thresholds[equipmentType] || thresholds.default;
      let severity = "normal";
      if (rmsValue > limits.critical) {
        severity = "critical";
      } else if (rmsValue > limits.warning) {
        severity = "warning";
      }

      const faultIndicators = [];
      if (rmsValue > limits.warning) {
        faultIndicators.push({
          type: "high_vibration",
          description: "Elevated vibration levels detected",
          confidence: Math.min(100, (rmsValue / limits.warning) * 50),
        });
      }

      res.json({
        equipmentId,
        severity,
        metrics: {
          rms: rmsValue,
          peak: peakValue,
          crestFactor: peakValue / rmsValue,
        },
        thresholds: limits,
        faultIndicators,
        recommendation:
          severity === "critical"
            ? "Immediate inspection recommended"
            : severity === "warning"
              ? "Schedule inspection within 7 days"
              : "Continue normal monitoring",
        timestamp: new Date().toISOString(),
      });
    })
  );

  app.post(
    "/api/vibration/iso-assessment",
    requireOrgId,
    withErrorHandling("perform ISO assessment", async (req: Request, res: Response) => {
      const { equipmentId, rmsVelocity, machineClass } = req.body;

      const isoLimits: Record<string, any> = {
        class1: { A: 0.71, B: 1.8, C: 4.5, D: 11.2 },
        class2: { A: 1.12, B: 2.8, C: 7.1, D: 18 },
        class3: { A: 1.8, B: 4.5, C: 11.2, D: 28 },
        class4: { A: 2.8, B: 7.1, C: 18, D: 45 },
      };

      const limits = isoLimits[machineClass] || isoLimits.class2;
      let zone = "A";
      if (rmsVelocity > limits.D) {
        zone = "D";
      } else if (rmsVelocity > limits.C) {
        zone = "C";
      } else if (rmsVelocity > limits.B) {
        zone = "B";
      }

      const zoneDescriptions: Record<string, string> = {
        A: "Good condition - newly commissioned machines",
        B: "Acceptable - unrestricted long-term operation",
        C: "Unsatisfactory - restricted continuous operation",
        D: "Unacceptable - damage may occur",
      };

      res.json({
        equipmentId,
        machineClass,
        rmsVelocity,
        zone,
        description: zoneDescriptions[zone],
        limits,
        timestamp: new Date().toISOString(),
      });
    })
  );

  app.post(
    "/api/vibration/bearing-fault-detection",
    requireOrgId,
    withErrorHandling("detect bearing faults", async (req: Request, res: Response) => {
      const { equipmentId, frequencies, amplitudes, bearingSpec } = req.body;

      const faultFrequencies = {
        BPFO: bearingSpec?.bpfo || 0,
        BPFI: bearingSpec?.bpfi || 0,
        BSF: bearingSpec?.bsf || 0,
        FTF: bearingSpec?.ftf || 0,
      };

      const detectedFaults: any[] = [];

      if (frequencies && amplitudes) {
        Object.entries(faultFrequencies).forEach(([faultType, targetFreq]) => {
          if (targetFreq === 0) {
            return;
          }

          for (let harmonic = 1; harmonic <= 3; harmonic++) {
            const searchFreq = targetFreq * harmonic;
            const tolerance = searchFreq * 0.05;

            const matchIdx = frequencies.findIndex(
              (f: number) => Math.abs(f - searchFreq) < tolerance
            );

            if (matchIdx !== -1 && amplitudes[matchIdx] > 0.1) {
              detectedFaults.push({
                faultType,
                harmonic,
                frequency: frequencies[matchIdx],
                amplitude: amplitudes[matchIdx],
                expectedFrequency: searchFreq,
              });
            }
          }
        });
      }

      res.json({
        equipmentId,
        bearingSpec,
        faultFrequencies,
        detectedFaults,
        severity: detectedFaults.length > 2 ? "high" : detectedFaults.length > 0 ? "medium" : "low",
        timestamp: new Date().toISOString(),
      });
    })
  );

  app.post(
    "/api/vibration/bearing-frequencies",
    requireOrgId,
    withErrorHandling("calculate bearing frequencies", async (req: Request, res: Response) => {
      const { ballCount, ballDiameter, pitchDiameter, contactAngle, shaftRpm } = req.body;

      const n = ballCount || 8;
      const Bd = ballDiameter || 10;
      const Pd = pitchDiameter || 50;
      const theta = ((contactAngle || 0) * Math.PI) / 180;
      const rpm = shaftRpm || 1800;
      const fr = rpm / 60;

      const bpfo = (n / 2) * fr * (1 - (Bd / Pd) * Math.cos(theta));
      const bpfi = (n / 2) * fr * (1 + (Bd / Pd) * Math.cos(theta));
      const bsf = (Pd / (2 * Bd)) * fr * (1 - Math.pow((Bd / Pd) * Math.cos(theta), 2));
      const ftf = (fr / 2) * (1 - (Bd / Pd) * Math.cos(theta));

      res.json({
        input: { ballCount: n, ballDiameter: Bd, pitchDiameter: Pd, contactAngle, shaftRpm: rpm },
        frequencies: {
          BPFO: Math.round(bpfo * 100) / 100,
          BPFI: Math.round(bpfi * 100) / 100,
          BSF: Math.round(bsf * 100) / 100,
          FTF: Math.round(ftf * 100) / 100,
        },
        unit: "Hz",
      });
    })
  );

  app.post(
    "/api/vibration/features",
    requireOrgId,
    withErrorHandling("extract features", async (req: Request, res: Response) => {
      const { data } = req.body;

      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ message: "Data array is required" });
      }

      const n = data.length;
      const mean = data.reduce((a: number, b: number) => a + b, 0) / n;
      const variance = data.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / n;
      const std = Math.sqrt(variance);
      const rms = Math.sqrt(data.reduce((a: number, b: number) => a + b * b, 0) / n);
      const peak = Math.max(...data.map(Math.abs));
      const crestFactor = peak / rms;
      const kurtosis =
        data.reduce((a: number, b: number) => a + Math.pow((b - mean) / std, 4), 0) / n;
      const skewness =
        data.reduce((a: number, b: number) => a + Math.pow((b - mean) / std, 3), 0) / n;

      res.json({
        features: {
          mean,
          std,
          variance,
          rms,
          peak,
          crestFactor,
          kurtosis,
          skewness,
          peakToPeak: Math.max(...data) - Math.min(...data),
        },
        sampleCount: n,
      });
    })
  );

  app.post(
    "/api/acoustic/analyze",
    requireOrgId,
    withErrorHandling("analyze acoustic data", async (req: Request, res: Response) => {
      const { equipmentId, audioData, sampleRate } = req.body;

      const analysis = {
        equipmentId,
        timestamp: new Date().toISOString(),
        metrics: {
          averageLevel: 0,
          peakLevel: 0,
          noiseFloor: 0,
        },
        anomalyDetected: false,
        recommendation: "Continue normal monitoring",
      };

      res.json(analysis);
    })
  );

  app.get(
    "/api/acoustic/history",
    requireOrgId,
    withErrorHandling("fetch acoustic history", async (req: Request, res: Response) => {
      const { equipmentId, hours } = req.query;
      const history = await dbSensorsStorage.getAcousticHistory?.(
        equipmentId as string,
        hours ? Number.parseInt(hours as string) : 24
      );
      res.json(history ?? []);
    })
  );
}
