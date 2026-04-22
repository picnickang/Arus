import { z } from "zod";

export const EQUIPMENT_TYPES = [
  { value: "engine", label: "Engine" },
  { value: "pump", label: "Pump" },
  { value: "compressor", label: "Compressor" },
  { value: "gearbox", label: "Gearbox" },
  { value: "propulsion", label: "Propulsion" },
  { value: "generator", label: "Generator" },
  { value: "hvac", label: "HVAC" },
  { value: "other", label: "Other" },
] as const;

export const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi-annually", label: "Semi-Annually" },
  { value: "annually", label: "Annually" },
  { value: "hours-based", label: "Hours-Based" },
  { value: "condition-based", label: "Condition-Based" },
] as const;

export const PRIORITY_OPTIONS_TEMPLATE = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export const templateSchema = z.object({
  equipmentType: z.string().min(1, "Equipment type is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  frequency: z.string().min(1, "Frequency is required"),
  estimatedDuration: z.coerce.number().min(1, "Estimated duration must be at least 1 minute"),
  priority: z.string().min(1, "Priority is required"),
});

export type TemplateFormData = z.infer<typeof templateSchema>;

export const checklistItemSchema = z.object({
  stepNumber: z.coerce.number().min(1),
  description: z.string().min(1, "Description is required"),
  required: z.boolean().default(false),
  estimatedMinutes: z.coerce.number().min(0).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

export type ChecklistItemFormData = z.infer<typeof checklistItemSchema>;

export function createDefaultTemplateFormValues(): Partial<TemplateFormData> {
  return {
    equipmentType: "",
    name: "",
    description: "",
    frequency: "",
    estimatedDuration: 30,
    priority: "medium",
  };
}

export function createDefaultChecklistItemValues(): Partial<ChecklistItemFormData> {
  return {
    stepNumber: 1,
    description: "",
    required: false,
    estimatedMinutes: 5,
    imageUrl: "",
  };
}

export function getFrequencyLabel(frequency: string): string {
  const option = FREQUENCY_OPTIONS.find((o) => o.value === frequency);
  return option?.label || frequency;
}

export function getPriorityBadgeVariant(
  priority: string
): "default" | "destructive" | "secondary" | "outline" {
  switch (priority) {
    case "critical":
      return "destructive";
    case "high":
      return "default";
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}min`;
}

export function getEquipmentTypeLabel(type: string): string {
  const option = EQUIPMENT_TYPES.find((o) => o.value === type);
  return option?.label || type;
}
