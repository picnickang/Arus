/**
 * Operating Mode Detector
 * Infers vessel operating mode from real telemetry data
 *
 * Operating Modes:
 * - DP (Dynamic Positioning): High thruster load, low/zero speed
 * - Transit: High speed, stable RPM, low thruster load
 * - Harbor: Low speed, variable RPM, maneuvering
 * - Cargo_Ops: Hydraulic activity, stationary or slow
 * - Standby: Low RPM, minimal movement
 * - Docking: Very low speed, high maneuvering activity
 */

import type { EquipmentTelemetry } from "@shared/schema";

export type OperatingMode =
  | "DP" // Dynamic Positioning
  | "Transit" // Underway transit
  | "Harbor" // Harbor operations / maneuvering
  | "Cargo_Ops" // Cargo operations (crane, winch, etc.)
  | "Standby" // Idle / standby
  | "Docking" // Docking / undocking operations
  | "Unknown"; // Cannot determine

export interface ModeDetectionResult {
  mode: OperatingMode;
  confidence: number; // 0-1, how confident we are
  indicators: string[]; // reasons for the classification
  timestamp: Date;
}

export interface TelemetryWindow {
  rpm?: number;
  stw?: number; // speed through water (knots)
  sog?: number; // speed over ground (knots)
  heading?: number;
  thrusterLoad?: number; // % load on thrusters
  hydraulicPressure?: number; // bar
  fuelRate?: number; // l/h
  loadPercent?: number; // engine load %
  latitude?: number;
  longitude?: number;
  timestamp: Date;
}

export class ModeDetector {
  /**
   * Detect operating mode from a telemetry point
   */
  detectMode(telemetry: TelemetryWindow): ModeDetectionResult {
    const indicators: string[] = [];
    let confidence = 0.5; // start with medium confidence

    const {
      rpm = 0,
      stw = 0,
      sog = 0,
      thrusterLoad = 0,
      hydraulicPressure = 0,
      loadPercent = 0,
      timestamp,
    } = telemetry;

    // Rule 1: Dynamic Positioning (DP)
    // High thruster load + very low speed = DP operations
    if (thrusterLoad > 30 && stw < 1.5) {
      indicators.push(`High thruster load (${thrusterLoad.toFixed(1)}%)`);
      indicators.push(`Very low speed (${stw.toFixed(1)} kn)`);
      confidence = 0.85;
      return { mode: "DP", confidence, indicators, timestamp };
    }

    // Rule 2: Transit
    // High speed + stable engine load + minimal thruster activity = Transit
    if (stw > 5 && loadPercent > 40 && thrusterLoad < 15) {
      indicators.push(`Transit speed (${stw.toFixed(1)} kn)`);
      indicators.push(`Cruising engine load (${loadPercent.toFixed(1)}%)`);
      indicators.push(`Minimal thruster activity`);
      confidence = 0.9;
      return { mode: "Transit", confidence, indicators, timestamp };
    }

    // Rule 3: Cargo Operations
    // High hydraulic pressure + low/zero speed = Cargo ops (crane, winch, ramp)
    if (hydraulicPressure > 100 && stw < 2) {
      indicators.push(`High hydraulic pressure (${hydraulicPressure.toFixed(1)} bar)`);
      indicators.push(`Stationary/slow (${stw.toFixed(1)} kn)`);
      confidence = 0.8;
      return { mode: "Cargo_Ops", confidence, indicators, timestamp };
    }

    // Rule 4: Harbor / Maneuvering
    // Low speed + moderate engine activity + some thruster use = Harbor ops
    if (stw < 3 && stw > 0.5 && (thrusterLoad > 10 || loadPercent > 20)) {
      indicators.push(`Maneuvering speed (${stw.toFixed(1)} kn)`);
      if (thrusterLoad > 10) {
        indicators.push(`Active thrusters (${thrusterLoad.toFixed(1)}%)`);
      }
      confidence = 0.75;
      return { mode: "Harbor", confidence, indicators, timestamp };
    }

    // Rule 5: Docking Operations
    // Very low speed + variable RPM + thruster activity = Docking
    if (stw < 0.8 && thrusterLoad > 15 && rpm > 500) {
      indicators.push(`Very slow (${stw.toFixed(1)} kn)`);
      indicators.push(`Active maneuvering`);
      confidence = 0.7;
      return { mode: "Docking", confidence, indicators, timestamp };
    }

    // Rule 6: Standby
    // Low RPM + minimal speed = Standby/Idle
    if (rpm < 800 && stw < 0.5 && loadPercent < 20) {
      indicators.push(`Low RPM (${rpm.toFixed(0)})`);
      indicators.push(`Minimal movement`);
      indicators.push(`Low engine load (${loadPercent.toFixed(1)}%)`);
      confidence = 0.8;
      return { mode: "Standby", confidence, indicators, timestamp };
    }

    // Default: Unknown
    indicators.push("Ambiguous telemetry pattern");
    confidence = 0.3;
    return { mode: "Unknown", confidence, indicators, timestamp };
  }

  /**
   * Detect mode from multiple telemetry points (more accurate)
   * Uses a sliding window to reduce noise
   */
  detectModeFromWindow(telemetryPoints: TelemetryWindow[]): ModeDetectionResult {
    if (telemetryPoints.length === 0) {
      return {
        mode: "Unknown",
        confidence: 0,
        indicators: ["No telemetry data"],
        timestamp: new Date(),
      };
    }

    // Detect mode for each point
    const detections = telemetryPoints.map((t) => this.detectMode(t));

    // Vote: most common mode wins
    const modeCounts = new Map<OperatingMode, number>();
    const modeConfidences = new Map<OperatingMode, number[]>();

    detections.forEach((detection) => {
      const count = modeCounts.get(detection.mode) ?? 0;
      modeCounts.set(detection.mode, count + 1);

      const confidences = modeConfidences.get(detection.mode) ?? [];
      confidences.push(detection.confidence);
      modeConfidences.set(detection.mode, confidences);
    });

    // Find mode with highest vote count
    let bestMode: OperatingMode = "Unknown";
    let maxCount = 0;

    modeCounts.forEach((count, mode) => {
      if (count > maxCount) {
        maxCount = count;
        bestMode = mode;
      }
    });

    // Calculate average confidence for the winning mode
    const confidences = modeConfidences.get(bestMode) ?? [0];
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

    // Gather unique indicators
    const allIndicators = detections
      .filter((d) => d.mode === bestMode)
      .flatMap((d) => d.indicators);
    const uniqueIndicators = Array.from(new Set(allIndicators));

    // Boost confidence if mode is consistent across window
    const consistency = maxCount / detections.length;
    const finalConfidence = Math.min(1, avgConfidence * (0.5 + 0.5 * consistency));

    return {
      mode: bestMode,
      confidence: Math.round(finalConfidence * 100) / 100,
      indicators: uniqueIndicators,
      timestamp: telemetryPoints[telemetryPoints.length - 1].timestamp,
    };
  }

  /**
   * Convert EquipmentTelemetry to TelemetryWindow format
   */
  toTelemetryWindow(telemetry: EquipmentTelemetry): TelemetryWindow {
    const t = telemetry as object as Record<string, number | undefined>;
    return {
      rpm: t.rpm || undefined,
      stw: t.stw || undefined,
      sog: t.sog || undefined,
      heading: t.heading || undefined,
      thrusterLoad: t.thrusterLoad || undefined,
      hydraulicPressure: t.hydraulicPressure || undefined,
      fuelRate: t.fuelRate || undefined,
      loadPercent: t.loadPercent || undefined,
      latitude: t.latitude || undefined,
      longitude: t.longitude || undefined,
      timestamp: new Date(telemetry.ts),
    };
  }

  /**
   * Get mode color for UI display
   */
  getModeColor(mode: OperatingMode): string {
    const colors: Record<OperatingMode, string> = {
      DP: "#3b82f6", // blue
      Transit: "#10b981", // green
      Harbor: "#f59e0b", // amber
      Cargo_Ops: "#8b5cf6", // purple
      Standby: "#6b7280", // gray
      Docking: "#f97316", // orange
      Unknown: "#9ca3af", // light gray
    };
    return colors[mode];
  }

  /**
   * Get mode label for UI display
   */
  getModeLabel(mode: OperatingMode): string {
    const labels: Record<OperatingMode, string> = {
      DP: "Dynamic Positioning",
      Transit: "Underway Transit",
      Harbor: "Harbor Operations",
      Cargo_Ops: "Cargo Operations",
      Standby: "Standby / Idle",
      Docking: "Docking",
      Unknown: "Unknown Mode",
    };
    return labels[mode];
  }
}
