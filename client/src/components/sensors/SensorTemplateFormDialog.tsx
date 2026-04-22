import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCreateSensorTemplate, useUpdateSensorTemplate } from "@/hooks/useSensorData";
import { SENSOR_KIND_PRESETS, getDefaultUnit, getDefaultFields } from "@shared/sensorKindPresets";
import { Settings, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { SensorTemplate } from "@shared/schema";

const SENSOR_KINDS = [
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

const EQUIPMENT_TYPES = [
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

type SensorTemplateFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & ({ mode: "create"; template?: never } | { mode: "edit"; template: SensorTemplate });

export function SensorTemplateFormDialog({
  open,
  onOpenChange,
  mode,
  template,
}: SensorTemplateFormDialogProps) {
  const { toast } = useToast();
  const [advancedMode, setAdvancedMode] = useState(false);
  const isCreate = mode === "create";

  const [formData, setFormData] = useState({
    templateId: "",
    name: "",
    kind: "",
    unit: "",
    equipmentTypes: [] as string[],
    fields: {} as Record<string, unknown>,
    notes: "",
  });
  const [fieldsJson, setFieldsJson] = useState("{}");

  useEffect(() => {
    if (template && mode === "edit") {
      setFormData({
        templateId: template.templateId,
        name: template.name,
        kind: template.kind,
        unit: template.unit || "",
        equipmentTypes: template.equipmentTypes ?? [],
        fields: template.fields,
        notes: template.notes || "",
      });
      setFieldsJson(JSON.stringify(template.fields, null, 2));
    } else if (mode === "create" && open) {
      resetForm();
    }
  }, [template, mode, open]);

  const createMutation = useCreateSensorTemplate({
    successMessage: "Template created successfully",
    onSuccess: () => {
      onOpenChange(false);
      resetForm();
    },
  });

  const updateMutation = useUpdateSensorTemplate({
    successMessage: "Template updated successfully",
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const isPending = isCreate ? createMutation.isPending : updateMutation.isPending;

  const resetForm = () => {
    setFormData({
      templateId: "",
      name: "",
      kind: "",
      unit: "",
      equipmentTypes: [],
      fields: {},
      notes: "",
    });
    setFieldsJson("{}");
    setAdvancedMode(false);
  };

  const handleSubmit = () => {
    try {
      const fields = JSON.parse(fieldsJson);
      if (isCreate) {
        createMutation.mutate({ ...formData, fields });
      } else if (template) {
        updateMutation.mutate({
          id: template.id,
          data: {
            name: formData.name,
            unit: formData.unit,
            equipmentTypes: formData.equipmentTypes,
            fields,
            notes: formData.notes,
          },
        });
      }
    } catch {
      toast({
        title: "Invalid JSON",
        description: "Please enter valid JSON for fields",
        variant: "destructive",
      });
    }
  };

  const handleKindChange = (value: string) => {
    const defaultUnit = getDefaultUnit(value as keyof typeof SENSOR_KIND_PRESETS);
    const defaultFields = getDefaultFields(value as keyof typeof SENSOR_KIND_PRESETS);
    setFormData({
      ...formData,
      kind: value,
      unit: defaultUnit,
      fields: defaultFields,
    });
    setFieldsJson(JSON.stringify(defaultFields, null, 2));
    toast({
      title: "Defaults Applied",
      description: `Auto-filled with ${SENSOR_KIND_PRESETS[value as keyof typeof SENSOR_KIND_PRESETS]?.label || value} preset defaults`,
    });
  };

  const handleEquipmentTypeToggle = (type: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        equipmentTypes: [...formData.equipmentTypes, type],
      });
    } else {
      setFormData({
        ...formData,
        equipmentTypes: formData.equipmentTypes.filter((t) => t !== type),
      });
    }
  };

  const isFormValid = isCreate
    ? formData.templateId.trim() !== "" && formData.name.trim() !== "" && formData.kind !== ""
    : formData.name.trim() !== "";

  const testIdPrefix = isCreate ? "create-" : "edit-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Create Sensor Template" : "Edit Sensor Template"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Create a new sensor configuration template for standardized deployment"
              : "Update the sensor template configuration"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="templateId" className="text-right">
              Template ID {isCreate && "*"}
            </Label>
            <Input
              id="templateId"
              className={`col-span-3 ${!isCreate ? "bg-muted" : ""}`}
              value={formData.templateId}
              onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
              placeholder="e.g., CUSTOM-PRESSURE-01"
              disabled={!isCreate}
              data-testid={`input-${testIdPrefix}templateId`}
            />
          </div>

          {isCreate ? (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="kind" className="text-right">
                Kind *
              </Label>
              <div className="col-span-3 space-y-2">
                <Select value={formData.kind} onValueChange={handleKindChange}>
                  <SelectTrigger data-testid={`select-${testIdPrefix}kind`}>
                    <SelectValue placeholder="Select sensor kind" />
                  </SelectTrigger>
                  <SelectContent>
                    {SENSOR_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        <div className="flex items-center gap-2">
                          {kind}
                          {SENSOR_KIND_PRESETS[kind as keyof typeof SENSOR_KIND_PRESETS] && (
                            <span className="text-xs text-muted-foreground">
                              (
                              {
                                SENSOR_KIND_PRESETS[kind as keyof typeof SENSOR_KIND_PRESETS]
                                  .defaultUnit
                              }
                              )
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.kind &&
                  SENSOR_KIND_PRESETS[formData.kind as keyof typeof SENSOR_KIND_PRESETS]
                    ?.description && (
                    <p className="text-xs text-muted-foreground">
                      {
                        SENSOR_KIND_PRESETS[formData.kind as keyof typeof SENSOR_KIND_PRESETS]
                          .description
                      }
                    </p>
                  )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Kind</Label>
              <Input
                className="col-span-3 bg-muted"
                value={formData.kind}
                disabled
                data-testid={`input-${testIdPrefix}kind-readonly`}
              />
            </div>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name *
            </Label>
            <Input
              id="name"
              className="col-span-3"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Custom Pressure Sensor"
              data-testid={`input-${testIdPrefix}name`}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="unit" className="text-right">
              Unit
            </Label>
            <Input
              id="unit"
              className="col-span-3"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              placeholder="e.g., bar, psi, °C"
              data-testid={`input-${testIdPrefix}unit`}
            />
          </div>

          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Equipment Types</Label>
            <div className="col-span-3">
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                {EQUIPMENT_TYPES.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`equipment-${type}`}
                      checked={formData.equipmentTypes.includes(type)}
                      onCheckedChange={(checked) =>
                        handleEquipmentTypeToggle(type, checked as boolean)
                      }
                      data-testid={`checkbox-${testIdPrefix}equipment-${type}`}
                    />
                    <label
                      htmlFor={`equipment-${type}`}
                      className="text-sm cursor-pointer select-none"
                    >
                      {type.replaceAll("_", " ")}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Select applicable equipment types (optional)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Configuration</Label>
            <div className="col-span-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Fields (JSON) *</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAdvancedMode(!advancedMode)}
                  className="h-7 text-xs"
                  data-testid={`button-${testIdPrefix}toggle-advanced`}
                >
                  {advancedMode ? (
                    <>
                      <Sparkles className="h-3 w-3 mr-1" />
                      Simple Mode
                    </>
                  ) : (
                    <>
                      <Settings className="h-3 w-3 mr-1" />
                      Advanced Mode
                    </>
                  )}
                </Button>
              </div>
              {advancedMode ? (
                <Textarea
                  className="font-mono text-sm"
                  value={fieldsJson}
                  onChange={(e) => setFieldsJson(e.target.value)}
                  placeholder='{"key": "value"}'
                  rows={8}
                  data-testid={`input-${testIdPrefix}fields`}
                />
              ) : (
                <div className="rounded-md border p-3 bg-muted/30">
                  {isCreate && !formData.kind ? (
                    <p className="text-sm text-muted-foreground mb-2">
                      Select a sensor kind above to auto-fill with industry-standard defaults.
                    </p>
                  ) : null}
                  {formData.kind && (
                    <div className="text-xs font-mono bg-background p-2 rounded border">
                      <pre>{JSON.stringify(formData.fields, null, 2)}</pre>
                    </div>
                  )}
                  {!isCreate && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Enable Advanced Mode to edit the JSON configuration
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="notes" className="text-right pt-2">
              Notes
            </Label>
            <Textarea
              id="notes"
              className="col-span-3"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this template"
              rows={3}
              data-testid={`input-${testIdPrefix}notes`}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              if (isCreate) {
                resetForm();
              }
            }}
            data-testid={`button-cancel-${isCreate ? "create" : "edit"}`}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isPending}
            data-testid={`button-submit-${isCreate ? "create" : "edit"}`}
          >
            {isPending
              ? isCreate
                ? "Creating..."
                : "Updating..."
              : isCreate
                ? "Create Template"
                : "Update Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SensorTemplateCreateDialog(
  props: Omit<SensorTemplateFormDialogProps, "mode" | "template">
) {
  return <SensorTemplateFormDialog mode="create" {...props} />;
}

export function SensorTemplateEditDialog(
  props: Omit<SensorTemplateFormDialogProps, "mode"> & { template: SensorTemplate }
) {
  return <SensorTemplateFormDialog mode="edit" {...props} />;
}
