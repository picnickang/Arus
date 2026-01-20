import { z } from "zod";

export const mlModelSchema = z.object({
  name: z.string().min(1, "Name is required"),
  version: z.string().min(1, "Version is required"),
  modelType: z.string().min(1, "Model type is required"),
  targetEquipmentType: z.string().optional(),
  status: z.string().default("training"),
});

export const anomalyDetectionSchema = z.object({
  equipmentId: z.string().min(1, "Equipment ID is required"),
  sensorType: z.string().min(1, "Sensor type is required"),
  severity: z.string().min(1, "Severity is required"),
});

export const failurePredictionSchema = z.object({
  equipmentId: z.string().min(1, "Equipment ID is required"),
  riskLevel: z.string().min(1, "Risk level is required"),
  probability: z.number().min(0).max(1, "Probability must be between 0 and 1"),
  estimatedTimeToFailure: z.number().optional(),
});

export const thresholdOptimizationSchema = z.object({
  equipmentId: z.string().min(1, "Equipment ID is required"),
  sensorType: z.string().min(1, "Sensor type is required"),
  optimizationMethod: z.string().optional(),
});

export type MlModelFormData = z.infer<typeof mlModelSchema>;
export type AnomalyDetectionFormData = z.infer<typeof anomalyDetectionSchema>;
export type FailurePredictionFormData = z.infer<typeof failurePredictionSchema>;
export type ThresholdOptimizationFormData = z.infer<typeof thresholdOptimizationSchema>;

export function createDefaultMlModelForm(): MlModelFormData {
  return {
    name: "",
    version: "",
    modelType: "",
    targetEquipmentType: "",
    status: "training",
  };
}
