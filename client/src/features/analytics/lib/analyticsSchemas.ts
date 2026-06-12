import { z } from "zod";

export const mlModelSchema = z.object({
  name: z.string().min(1, "Name is required"),
  version: z.string().min(1, "Version is required"),
  modelType: z.string().min(1, "Model type is required"),
  targetEquipmentType: z.string().optional(),
  status: z.string().default("training"),
});

export type MlModelFormData = z.infer<typeof mlModelSchema>;
export interface AnomalyDetectionFormData {
  equipmentId: string;
  sensorType: string;
  severity: string;
}
export interface FailurePredictionFormData {
  equipmentId: string;
  riskLevel: string;
  probability: number;
  estimatedTimeToFailure?: number;
}
export interface ThresholdOptimizationFormData {
  equipmentId: string;
  sensorType: string;
  optimizationMethod?: string;
}

export function createDefaultMlModelForm(): MlModelFormData {
  return {
    name: "",
    version: "",
    modelType: "",
    targetEquipmentType: "",
    status: "training",
  };
}
