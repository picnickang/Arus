import { logger } from "../utils/logger";

const LOG_CTX = "LlmStatisticalFallback";

interface EquipmentHealthItem {
  id: string;
  name?: string;
  healthIndex: number;
  vessel?: string;
  status?: string;
  [key: string]: unknown;
}

interface FallbackAnalysis {
  totalEquipment: number;
  healthyEquipment: number;
  equipmentAtRisk: number;
  criticalEquipment: number;
  avgHealthIndex: number;
  topRecommendations: string[];
  costEstimate: number;
  summary: string;
  riskMatrix: Array<{ equipment: string; healthIndex: number; risk: string; trend: string }>;
  prioritizedActions: string[];
  isFallback: true;
  fallbackReason: string;
}

export function generateStatisticalFallback(
  equipmentHealth: EquipmentHealthItem[],
  telemetryTrends?: any[],
  fallbackReason = "AI analysis unavailable"
): FallbackAnalysis {
  if (equipmentHealth.length === 0) {
    return {
      totalEquipment: 0,
      healthyEquipment: 0,
      equipmentAtRisk: 0,
      criticalEquipment: 0,
      avgHealthIndex: 0,
      topRecommendations: ["No equipment data available for analysis"],
      costEstimate: 0,
      summary: "No equipment health data available. Ensure telemetry is flowing from vessel systems.",
      riskMatrix: [],
      prioritizedActions: [],
      isFallback: true,
      fallbackReason,
    };
  }

  const sorted = [...equipmentHealth].sort((a, b) => a.healthIndex - b.healthIndex);
  const critical = sorted.filter(e => e.healthIndex < 30);
  const atRisk = sorted.filter(e => e.healthIndex >= 30 && e.healthIndex < 70);
  const healthy = sorted.filter(e => e.healthIndex >= 70);

  const avgHealth = Math.round(
    equipmentHealth.reduce((s, e) => s + e.healthIndex, 0) / equipmentHealth.length
  );

  const p10Index = Math.floor(sorted.length * 0.1);
  const p10Health = sorted[p10Index]?.healthIndex ?? 0;
  const medianHealth = sorted[Math.floor(sorted.length / 2)]?.healthIndex ?? avgHealth;

  const riskMatrix = sorted.slice(0, 10).map(e => ({
    equipment: e.name || e.id,
    healthIndex: e.healthIndex,
    risk: e.healthIndex < 30 ? "critical" : e.healthIndex < 50 ? "high" : e.healthIndex < 70 ? "medium" : "low",
    trend: "unknown",
  }));

  const recommendations: string[] = [];
  const actions: string[] = [];

  if (critical.length > 0) {
    const critNames = critical.slice(0, 3).map(e => e.name || e.id).join(", ");
    recommendations.push(`URGENT: ${critical.length} equipment item(s) in critical condition (health < 30%). Worst: ${critNames}`);
    actions.push(`Schedule immediate inspection for: ${critNames}`);
  }

  if (atRisk.length > 0) {
    const atRiskNames = atRisk.slice(0, 3).map(e => e.name || e.id).join(", ");
    recommendations.push(`${atRisk.length} equipment item(s) at risk (health 30-70%). Monitor closely: ${atRiskNames}`);
    actions.push(`Create preventive maintenance work orders for at-risk equipment within 7 days`);
  }

  if (avgHealth < 60) {
    recommendations.push(`Fleet average health (${avgHealth}%) is below acceptable threshold. Systemic maintenance review recommended.`);
    actions.push(`Review maintenance scheduling — fleet-wide health below 60% suggests deferred maintenance backlog`);
  }

  if (p10Health < 40) {
    recommendations.push(`Bottom 10% of equipment has health index below ${p10Health}%. These are immediate failure candidates.`);
  }

  const costEstimate = critical.length * 10000 + atRisk.length * 2500;

  const summaryParts: string[] = [];
  summaryParts.push(`Statistical summary (${fallbackReason}).`);
  summaryParts.push(`Fleet: ${equipmentHealth.length} equipment, average health ${avgHealth}%, median ${medianHealth}%.`);
  summaryParts.push(`${healthy.length} healthy, ${atRisk.length} at risk, ${critical.length} critical.`);
  if (critical.length > 0) {
    summaryParts.push(`Immediate attention needed for ${critical.length} critical item(s).`);
  }
  summaryParts.push(`Estimated maintenance cost: $${costEstimate.toLocaleString()}.`);

  return {
    totalEquipment: equipmentHealth.length,
    healthyEquipment: healthy.length,
    equipmentAtRisk: atRisk.length,
    criticalEquipment: critical.length,
    avgHealthIndex: avgHealth,
    topRecommendations: recommendations.length > 0 ? recommendations : ["All equipment within acceptable health parameters"],
    costEstimate,
    summary: summaryParts.join(" "),
    riskMatrix,
    prioritizedActions: actions.length > 0 ? actions : ["Continue standard monitoring schedule"],
    isFallback: true,
    fallbackReason,
  };
}
