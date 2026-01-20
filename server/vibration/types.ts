/**
 * Vibration Analysis Types - Shared interfaces and type definitions
 */

export interface VibrationFeatures {
  rms: number;
  crestFactor: number;
  kurtosis: number;
  peakFrequency: number;
  bands: [number, number, number, number];
  rawDataLength: number;
  sampleRate: number;
  analysisMetadata?: {
    noiseFloor: number;
    spectralCentroid: number;
    totalPower: number;
  };
  isoAssessment?: ISO10816Assessment;
  bearingFaults?: BearingFaultFrequencies;
}

export interface ISO10816Assessment {
  severityZone: "A" | "B" | "C" | "D";
  velocityRms: number;
  machineClass: ISO10816MachineClass;
  thresholds: {
    zoneALimit: number;
    zoneBLimit: number;
    zoneCLimit: number;
  };
  assessment: string;
}

export type ISO10816MachineClass = "I" | "II" | "III" | "IV";

export interface BearingGeometry {
  innerRaceDiameter: number;
  outerRaceDiameter: number;
  ballDiameter: number;
  numberOfBalls: number;
  contactAngle: number;
}

export interface BearingFaultFrequencies {
  bpfo: number;
  bpfi: number;
  ftf: number;
  bsf: number;
  rpm: number;
  geometry: BearingGeometry;
}

export interface BearingFaultDetection {
  bpfoDetected: boolean;
  bpfiDetected: boolean;
  ftfDetected: boolean;
  bsfDetected: boolean;
  amplitudes: {
    bpfo: number;
    bpfi: number;
    ftf: number;
    bsf: number;
  };
}
