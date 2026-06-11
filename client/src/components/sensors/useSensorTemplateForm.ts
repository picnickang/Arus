import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  getDefaultFields,
  getDefaultUnit,
  SENSOR_KIND_PRESETS,
  type SensorKind,
} from "@shared/sensorKindPresets";

function isSensorKind(kind: string): kind is SensorKind {
  return kind in SENSOR_KIND_PRESETS;
}
import type { SensorTemplate } from "@shared/schema";

export const SENSOR_KINDS = [
  "vibration",
  "pressure",
  "temperature",
  "flow",
  "level",
  "voltage",
  "current",
  "frequency",
  "rpm",
  "oil_debris",
  "acoustic",
  "position",
];

export const EQUIPMENT_TYPES = [
  "main_engine",
  "auxiliary_engine",
  "gearbox",
  "marine_pump",
  "compressor",
  "generator",
  "boiler",
  "heat_exchanger",
  "propeller",
  "rudder",
  "thruster",
  "winch",
  "crane",
  "ballast_pump",
  "fire_pump",
  "hvac",
  "navigation_system",
];

const requiredTrimmed = (message: string) =>
  z.string().refine((value) => value.trim() !== "", { message });

const fieldsJsonSchema = z.string().superRefine((value, ctx) => {
  try {
    JSON.parse(value);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please enter valid JSON for fields",
    });
  }
});

/** Edit mode only requires a name; templateId and kind are immutable after create. */
export const sensorTemplateEditSchema = z.object({
  templateId: z.string(),
  name: requiredTrimmed("Name is required"),
  kind: z.string(),
  unit: z.string(),
  equipmentTypes: z.array(z.string()),
  fields: z.record(z.unknown()),
  fieldsJson: fieldsJsonSchema,
  notes: z.string(),
});

/** Create mode additionally requires templateId and kind. */
export const sensorTemplateCreateSchema = sensorTemplateEditSchema.extend({
  templateId: requiredTrimmed("Template ID is required"),
  kind: z.string().min(1, "Kind is required"),
});

export type SensorTemplateFormData = z.infer<typeof sensorTemplateCreateSchema>;

const emptyFormValues: SensorTemplateFormData = {
  templateId: "",
  name: "",
  kind: "",
  unit: "",
  equipmentTypes: [],
  fields: {},
  fieldsJson: "{}",
  notes: "",
};

export function useSensorTemplateForm({
  open,
  mode,
  template,
}: {
  open: boolean;
  mode: "create" | "edit";
  template?: SensorTemplate | undefined;
}) {
  const form = useForm<SensorTemplateFormData, unknown, SensorTemplateFormData>({
    resolver: zodResolver(
      mode === "create" ? sensorTemplateCreateSchema : sensorTemplateEditSchema
    ),
    defaultValues: emptyFormValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    if (template && mode === "edit") {
      form.reset({
        templateId: template.templateId,
        name: template.name,
        kind: template.kind,
        unit: template.unit || "",
        equipmentTypes: template.equipmentTypes ?? [],
        fields: template.fields,
        fieldsJson: JSON.stringify(template.fields, null, 2),
        notes: template.notes || "",
      });
    } else if (mode === "create" && open) {
      form.reset(emptyFormValues);
    }
  }, [template, mode, open, form]);

  /** Kind-preset autofill: marks the form dirty so guards see the change. */
  const applyKindPreset = (kind: string) => {
    form.setValue("kind", kind, { shouldDirty: true });
    if (!isSensorKind(kind)) {
      return;
    }
    const defaultFields = getDefaultFields(kind);
    form.setValue("unit", getDefaultUnit(kind), { shouldDirty: true });
    form.setValue("fields", defaultFields, { shouldDirty: true });
    form.setValue("fieldsJson", JSON.stringify(defaultFields, null, 2), { shouldDirty: true });
  };

  const resetForm = () => {
    form.reset(emptyFormValues);
  };

  return { form, applyKindPreset, resetForm };
}
