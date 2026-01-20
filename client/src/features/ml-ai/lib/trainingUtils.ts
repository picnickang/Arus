export interface TrainingWindowConfig {
  lookbackDays: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  confidenceMultiplier: number;
  warnings: string[];
  recommendations: string[];
  metadata: {
    availableDays: number;
    usedDays: number;
    failureCount: number;
    equipmentType: string;
  };
}

export interface MlModelDisplay {
  id: string;
  orgId: string;
  name: string;
  version: string;
  modelType: string;
  targetEquipmentType?: string;
  status: string;
  deployedAt?: string;
  performance?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    loss?: number;
  };
  hyperparameters?: {
    lookbackDays?: number;
    dataQualityTier?: "bronze" | "silver" | "gold" | "platinum";
    confidenceMultiplier?: number;
    availableDays?: number;
  };
  createdAt: string;
}

export interface LstmConfig {
  sequenceLength: number;
  featureCount: number;
  lstmUnits: number;
  dropoutRate: number;
  learningRate: number;
  epochs: number;
  batchSize: number;
}

export interface RandomForestConfig {
  numTrees: number;
  maxDepth: number;
  minSamplesSplit: number;
  maxFeatures: number;
  bootstrapSampleRatio: number;
}

export function createDefaultLstmConfig(epochs: number = 50, sequenceLength: number = 10): LstmConfig {
  return {
    sequenceLength,
    featureCount: 0,
    lstmUnits: 64,
    dropoutRate: 0.2,
    learningRate: 0.001,
    epochs,
    batchSize: 32,
  };
}

export function createDefaultRandomForestConfig(numTrees: number = 50): RandomForestConfig {
  return {
    numTrees,
    maxDepth: 10,
    minSamplesSplit: 5,
    maxFeatures: 8,
    bootstrapSampleRatio: 0.8,
  };
}

export const DATA_QUALITY_TIERS = [
  { key: "bronze", label: "Bronze", days: "90-180", description: "Basic predictions" },
  { key: "silver", label: "Silver", days: "180-365", description: "Good confidence" },
  { key: "gold", label: "Gold", days: "365-730", description: "High confidence" },
  { key: "platinum", label: "Platinum", days: "730+", description: "Exceptional confidence" },
] as const;

export function getTierIcon(tier: string): string {
  switch (tier) {
    case "bronze": return "🥉";
    case "silver": return "🥈";
    case "gold": return "🥇";
    case "platinum": return "💎";
    default: return "📊";
  }
}

export function getTierColor(tier: string): string {
  switch (tier) {
    case "bronze": return "text-amber-700 dark:text-amber-400";
    case "silver": return "text-gray-500 dark:text-gray-400";
    case "gold": return "text-yellow-600 dark:text-yellow-400";
    case "platinum": return "text-cyan-600 dark:text-cyan-400";
    default: return "text-gray-600 dark:text-gray-400";
  }
}

export function getModelStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "deployed":
    case "active":
      return "default";
    case "training":
    case "validating":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

export function formatModelAccuracy(accuracy: number | undefined): string {
  if (accuracy === undefined) {return "N/A";}
  return `${(accuracy * 100).toFixed(1)}%`;
}

export function parseAcousticData(input: string): number[] {
  return input
    .split(",")
    .map((v) => Number.parseFloat(v.trim()))
    .filter((v) => !Number.isNaN(v));
}

export function validateAcousticData(data: number[]): { valid: boolean; error?: string } {
  if (data.length === 0) {
    return { valid: false, error: "Invalid acoustic data. Please provide comma-separated numbers." };
  }
  return { valid: true };
}

export function getUniqueEquipmentTypes(equipment: Array<{ type?: string }>): string[] {
  return Array.from(new Set(equipment.map((e) => e.type).filter(Boolean))) as string[];
}
