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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { SENSOR_KIND_PRESETS } from "@shared/sensorKindPresets";
import { Settings, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { SensorTemplate } from "@shared/schema";
import {
  EQUIPMENT_TYPES,
  SENSOR_KINDS,
  useSensorTemplateForm,
  type SensorTemplateFormData,
} from "./useSensorTemplateForm";

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

  const { form, applyKindPreset, resetForm } = useSensorTemplateForm({ open, mode, template });

  useEffect(() => {
    if (mode === "create" && open) {
      setAdvancedMode(false);
    }
  }, [mode, open]);

  const createMutation = useCreateSensorTemplate({
    successMessage: "Template created successfully",
    onSuccess: () => {
      onOpenChange(false);
      resetForm();
      setAdvancedMode(false);
    },
  });

  const updateMutation = useUpdateSensorTemplate({
    successMessage: "Template updated successfully",
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const isPending = isCreate ? createMutation.isPending : updateMutation.isPending;

  const onSubmit = (data: SensorTemplateFormData) => {
    const fields = JSON.parse(data.fieldsJson) as Record<string, unknown>;
    if (isCreate) {
      createMutation.mutate({
        templateId: data.templateId,
        name: data.name,
        kind: data.kind,
        unit: data.unit,
        equipmentTypes: data.equipmentTypes,
        fields,
        notes: data.notes,
      });
    } else if (template) {
      updateMutation.mutate({
        id: template.id,
        data: {
          name: data.name,
          unit: data.unit,
          equipmentTypes: data.equipmentTypes,
          fields,
          notes: data.notes,
        },
      });
    }
  };

  const handleKindChange = (value: string) => {
    applyKindPreset(value);
    toast({
      title: "Defaults Applied",
      description: `Auto-filled with ${SENSOR_KIND_PRESETS[value as keyof typeof SENSOR_KIND_PRESETS]?.label || value} preset defaults`,
    });
  };

  const watchedKind = form.watch("kind");
  const watchedFields = form.watch("fields");

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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="templateId"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4 space-y-0">
                    <FormLabel className="text-right" required={isCreate}>
                      Template ID
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className={`col-span-3 ${!isCreate ? "bg-muted" : ""}`}
                        placeholder="e.g., CUSTOM-PRESSURE-01"
                        disabled={!isCreate}
                        data-testid={`input-${testIdPrefix}templateId`}
                      />
                    </FormControl>
                    <FormMessage className="col-span-3 col-start-2" />
                  </FormItem>
                )}
              />

              {isCreate ? (
                <FormField
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4 space-y-0">
                      <FormLabel className="text-right" required>
                        Kind
                      </FormLabel>
                      <div className="col-span-3 space-y-2">
                        <Select value={field.value} onValueChange={handleKindChange}>
                          <FormControl>
                            <SelectTrigger data-testid={`select-${testIdPrefix}kind`}>
                              <SelectValue placeholder="Select sensor kind" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SENSOR_KINDS.map((kind) => (
                              <SelectItem key={kind} value={kind}>
                                <div className="flex items-center gap-2">
                                  {kind}
                                  {SENSOR_KIND_PRESETS[
                                    kind as keyof typeof SENSOR_KIND_PRESETS
                                  ] && (
                                    <span className="text-xs text-muted-foreground">
                                      (
                                      {
                                        SENSOR_KIND_PRESETS[
                                          kind as keyof typeof SENSOR_KIND_PRESETS
                                        ].defaultUnit
                                      }
                                      )
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {field.value &&
                          SENSOR_KIND_PRESETS[field.value as keyof typeof SENSOR_KIND_PRESETS]
                            ?.description && (
                            <p className="text-xs text-muted-foreground">
                              {
                                SENSOR_KIND_PRESETS[field.value as keyof typeof SENSOR_KIND_PRESETS]
                                  .description
                              }
                            </p>
                          )}
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              ) : (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Kind</Label>
                  <Input
                    className="col-span-3 bg-muted"
                    value={watchedKind}
                    disabled
                    data-testid={`input-${testIdPrefix}kind-readonly`}
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4 space-y-0">
                    <FormLabel className="text-right" required>
                      Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="col-span-3"
                        placeholder="e.g., Custom Pressure Sensor"
                        data-testid={`input-${testIdPrefix}name`}
                      />
                    </FormControl>
                    <FormMessage className="col-span-3 col-start-2" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4 space-y-0">
                    <FormLabel className="text-right">Unit</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="col-span-3"
                        placeholder="e.g., bar, psi, °C"
                        data-testid={`input-${testIdPrefix}unit`}
                      />
                    </FormControl>
                    <FormMessage className="col-span-3 col-start-2" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="equipmentTypes"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-start gap-4 space-y-0">
                    <FormLabel className="text-right pt-2">Equipment Types</FormLabel>
                    <div className="col-span-3">
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                        {EQUIPMENT_TYPES.map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={`equipment-${type}`}
                              checked={field.value.includes(type)}
                              onCheckedChange={(checked) =>
                                field.onChange(
                                  checked
                                    ? [...field.value, type]
                                    : field.value.filter((t) => t !== type)
                                )
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
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fieldsJson"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-start gap-4 space-y-0">
                    <FormLabel className="text-right pt-2">Configuration</FormLabel>
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
                        <FormControl>
                          <Textarea
                            {...field}
                            className="font-mono text-sm"
                            placeholder='{"key": "value"}'
                            rows={8}
                            data-testid={`input-${testIdPrefix}fields`}
                          />
                        </FormControl>
                      ) : (
                        <div className="rounded-md border p-3 bg-muted/30">
                          {isCreate && !watchedKind ? (
                            <p className="text-sm text-muted-foreground mb-2">
                              Select a sensor kind above to auto-fill with industry-standard
                              defaults.
                            </p>
                          ) : null}
                          {watchedKind && (
                            <div className="text-xs font-mono bg-background p-2 rounded border">
                              <pre>{JSON.stringify(watchedFields, null, 2)}</pre>
                            </div>
                          )}
                          {!isCreate && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Enable Advanced Mode to edit the JSON configuration
                            </p>
                          )}
                        </div>
                      )}
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-start gap-4 space-y-0">
                    <FormLabel className="text-right pt-2">Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="col-span-3"
                        placeholder="Additional notes about this template"
                        rows={3}
                        data-testid={`input-${testIdPrefix}notes`}
                      />
                    </FormControl>
                    <FormMessage className="col-span-3 col-start-2" />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  if (isCreate) {
                    resetForm();
                    setAdvancedMode(false);
                  }
                }}
                data-testid={`button-cancel-${isCreate ? "create" : "edit"}`}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
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
          </form>
        </Form>
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
