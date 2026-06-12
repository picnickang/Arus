interface FailureSignature {
  name: string;
  requiredSensors: string[];
  optionalSensors: string[];
  diagnosis: string;
  rootCause: string;
  action: string;
  baseSeverity: "critical" | "high" | "medium";
  confidenceBoostPerOptional: number;
}

const FAILURE_SIGNATURES: FailureSignature[] = [
  {
    name: "bearing_failure",
    requiredSensors: ["vibration"],
    optionalSensors: ["temperature", "acoustic", "oil_analysis"],
    diagnosis: "Bearing degradation detected",
    rootCause: "Bearing wear, misalignment, or lubrication failure",
    action:
      "Schedule bearing inspection within 48 hours. Check lubrication system. Order replacement bearings.",
    baseSeverity: "high",
    confidenceBoostPerOptional: 0.1,
  },
  {
    name: "overheating",
    requiredSensors: ["temperature"],
    optionalSensors: ["pressure", "coolant_flow", "rpm"],
    diagnosis: "Equipment overheating",
    rootCause: "Cooling system failure, blocked flow, or excessive load",
    action: "Reduce load immediately. Inspect cooling system. Check coolant levels and flow rates.",
    baseSeverity: "critical",
    confidenceBoostPerOptional: 0.08,
  },
  {
    name: "fuel_system_degradation",
    requiredSensors: ["fuel_consumption", "exhaust_temperature"],
    optionalSensors: ["rpm", "power", "pressure"],
    diagnosis: "Fuel system performance degradation",
    rootCause: "Injector wear, fuel filter clogging, or fuel quality issues",
    action: "Check fuel filters. Test injector spray patterns. Sample fuel quality.",
    baseSeverity: "medium",
    confidenceBoostPerOptional: 0.1,
  },
  {
    name: "pump_cavitation",
    requiredSensors: ["pressure", "vibration"],
    optionalSensors: ["flow_rate", "temperature", "acoustic"],
    diagnosis: "Pump cavitation detected",
    rootCause: "Low suction pressure, air ingestion, or impeller wear",
    action:
      "Check suction line for restrictions. Verify inlet pressure. Inspect impeller condition.",
    baseSeverity: "high",
    confidenceBoostPerOptional: 0.1,
  },
  {
    name: "electrical_degradation",
    requiredSensors: ["voltage", "current"],
    optionalSensors: ["temperature", "insulation_resistance", "power_factor"],
    diagnosis: "Electrical system degradation",
    rootCause: "Insulation breakdown, loose connections, or winding deterioration",
    action:
      "Perform insulation resistance test. Check terminal connections. Monitor for thermal hotspots.",
    baseSeverity: "high",
    confidenceBoostPerOptional: 0.1,
  },
  {
    name: "lubrication_failure",
    requiredSensors: ["oil_pressure"],
    optionalSensors: ["temperature", "vibration", "oil_analysis", "wear_particles"],
    diagnosis: "Lubrication system failure",
    rootCause: "Oil pump degradation, filter clogging, or oil contamination",
    action: "Check oil level and pressure. Replace filters. Sample oil for analysis.",
    baseSeverity: "critical",
    confidenceBoostPerOptional: 0.08,
  },
];

export function normalizeSensorType(sensorType: string): string {
  const type = sensorType.toLowerCase().replace(/[_-]/g, "");
  if (type.includes("temp") || type.includes("thermal")) {
    return "temperature";
  }
  if (type.includes("vib") || type.includes("accel")) {
    return "vibration";
  }
  if (type.includes("press")) {
    return "pressure";
  }
  if (type.includes("rpm") || type.includes("speed")) {
    return "rpm";
  }
  if (type.includes("flow")) {
    return "flow_rate";
  }
  if (type.includes("volt")) {
    return "voltage";
  }
  if (type.includes("curr") || type.includes("amp")) {
    return "current";
  }
  if (type.includes("fuel") && type.includes("cons")) {
    return "fuel_consumption";
  }
  if (type.includes("exhaust")) {
    return "exhaust_temperature";
  }
  if (type.includes("oil") && type.includes("press")) {
    return "oil_pressure";
  }
  if (type.includes("oil")) {
    return "oil_analysis";
  }
  if (type.includes("wear") || type.includes("particle")) {
    return "wear_particles";
  }
  if (type.includes("acoustic") || type.includes("sound")) {
    return "acoustic";
  }
  if (type.includes("cool")) {
    return "coolant_flow";
  }
  if (type.includes("power")) {
    return "power";
  }
  if (type.includes("insul")) {
    return "insulation_resistance";
  }
  return sensorType.toLowerCase();
}

export function matchFailureSignature(sensorTypes: string[]): {
  diagnosis: string;
  rootCause: string;
  action: string;
  severity: "critical" | "high" | "medium";
  confidence: number;
} | null {
  let bestMatch: FailureSignature | null = null;
  let bestConfidence = 0;

  for (const sig of FAILURE_SIGNATURES) {
    const hasAllRequired = sig.requiredSensors.every((req) =>
      sensorTypes.some((st) => st === req || st.includes(req))
    );

    if (!hasAllRequired) {
      continue;
    }

    const optionalMatches = sig.optionalSensors.filter((opt) =>
      sensorTypes.some((st) => st === opt || st.includes(opt))
    ).length;

    const confidence = Math.min(
      0.95,
      0.6 +
        optionalMatches * sig.confidenceBoostPerOptional +
        (sensorTypes.length > sig.requiredSensors.length ? 0.05 : 0)
    );

    if (confidence > bestConfidence) {
      bestMatch = sig;
      bestConfidence = confidence;
    }
  }

  if (!bestMatch) {
    return null;
  }

  return {
    diagnosis: bestMatch.diagnosis,
    rootCause: bestMatch.rootCause,
    action: bestMatch.action,
    severity: bestMatch.baseSeverity,
    confidence: Math.round(bestConfidence * 100) / 100,
  };
}
