import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Equipment, Vessel, InsertEquipment } from "@shared/schema";
import { formatType, formatLocation } from "@/utils/equipmentHelpers";
import { useEquipmentForm, useEquipmentEditForm } from "@/hooks/useEquipmentForm";
import { EQUIPMENT_TYPES, EQUIPMENT_LOCATIONS } from "@/constants/equipment";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { equipmentKeys } from "@/utils/queryKeys";

type FormMode = "create" | "edit";

interface EquipmentFormDialogProps {
  mode: FormMode;
  open?: boolean;
  isOpen?: boolean;
  onOpenChange: (open: boolean) => void;
  vessels: Vessel[];
  equipment?: Equipment | null;
  onSubmit?: (data: InsertEquipment | Partial<InsertEquipment>, id?: string) => void;
  onSuccess?: () => void;
  isPending?: boolean;
  onClose?: () => void;
}

export function EquipmentFormDialog({
  mode,
  open,
  isOpen,
  onOpenChange,
  vessels,
  equipment,
  onSubmit,
  onSuccess,
  isPending: externalPending,
  onClose,
}: EquipmentFormDialogProps) {
  const createForm = useEquipmentForm();
  const editForm = useEquipmentEditForm(equipment);
  const form = mode === "create" ? createForm : editForm;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const dialogOpen = open ?? isOpen ?? false;

  const createMutation = useMutation({
    mutationFn: (data: InsertEquipment) => apiRequest("POST", "/api/equipment", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.list() });
      toast({
        title: "Equipment created",
        description: "The equipment has been added successfully",
      });
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create equipment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertEquipment> }) =>
      apiRequest("PUT", `/api/equipment/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.list() });
      toast({
        title: "Equipment updated",
        description: "The equipment has been updated successfully",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update equipment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: InsertEquipment | Partial<InsertEquipment>) => {
    const submissionData = {
      ...data,
      vesselId: data.vesselId === "unassigned" || data.vesselId === "" ? null : data.vesselId,
    };

    if (onSubmit) {
      onSubmit(submissionData, equipment?.id);
    } else if (mode === "create") {
      createMutation.mutate(submissionData as InsertEquipment);
    } else if (equipment) {
      updateMutation.mutate({ id: equipment.id, data: submissionData });
    }
  };

  const isPending =
    externalPending ?? (mode === "create" ? createMutation.isPending : updateMutation.isPending);

  const handleClose = () => {
    onOpenChange(false);
    onClose?.();
  };

  const isCreate = mode === "create";
  const testIdPrefix = isCreate ? "" : "edit-";
  const dialogTitle = isCreate ? "Add New Equipment" : "Edit Equipment";
  const dialogDescription = isCreate
    ? "Register new equipment in your fleet inventory"
    : "Update equipment information";
  const submitLabel = isCreate
    ? isPending
      ? "Creating..."
      : "Create Equipment"
    : isPending
      ? "Updating..."
      : "Update Equipment";

  return (
    <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit as never)}
            className="space-y-4"
            data-testid={`form-${isCreate ? "create" : "edit"}-equipment`}
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Main Engine #1"
                        {...field}
                        data-testid={`input-${testIdPrefix}name`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      defaultValue={field.value}
                      data-testid={`select-${testIdPrefix}type`}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select equipment type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EQUIPMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {formatType(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Caterpillar"
                        {...field}
                        data-testid={`input-${testIdPrefix}manufacturer`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="3516C"
                        {...field}
                        data-testid={`input-${testIdPrefix}model`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ABC123456"
                        {...field}
                        data-testid={`input-${testIdPrefix}serial`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vesselId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vessel</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      defaultValue={field.value}
                      data-testid={`select-${testIdPrefix}vessel`}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vessel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unassigned">No vessel assigned</SelectItem>
                        {vessels
                          .filter((v) => v.id)
                          .map((vessel) => (
                            <SelectItem key={vessel.id} value={vessel.id}>
                              {vessel.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                    data-testid={`select-${testIdPrefix}location`}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EQUIPMENT_LOCATIONS.map((location) => (
                        <SelectItem key={location} value={location}>
                          {formatLocation(location)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="purchaseValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Value</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="25000"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                        }
                        data-testid={`input-${testIdPrefix}purchase-value`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purchaseCurrency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || "USD"}
                      data-testid={`select-${testIdPrefix}currency`}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="USD" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="SGD">SGD</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={
                          field.value
                            ? typeof field.value === "string"
                              ? field.value.split("T")[0]
                              : new Date(field.value).toISOString().split("T")[0]
                            : ""
                        }
                        onChange={(e) => field.onChange(e.target.value || undefined)}
                        data-testid={`input-${testIdPrefix}purchase-date`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4 mt-2">
              <h4 className="text-sm font-medium mb-3">Depreciation & Service Life</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="serviceLifeHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Life (Hours)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="20000"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                          data-testid={`input-${testIdPrefix}service-life-hours`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="serviceLifeYears"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Life (Years)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.5"
                          placeholder="10"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                          data-testid={`input-${testIdPrefix}service-life-years`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <FormField
                  control={form.control}
                  name="depreciationMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Depreciation Method</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || "straight_line"}
                        data-testid={`select-${testIdPrefix}depreciation-method`}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="straight_line">Straight Line</SelectItem>
                          <SelectItem value="declining_balance">Declining Balance</SelectItem>
                          <SelectItem value="units_of_production">Units of Production</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="depreciationRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Depreciation Rate (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="10"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                          data-testid={`input-${testIdPrefix}depreciation-rate`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="salvageValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salvage Value</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="2500"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                          data-testid={`input-${testIdPrefix}salvage-value`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Equipment</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Equipment is currently in service
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid={`switch-${testIdPrefix}active`}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                data-testid={`button-cancel-${isCreate ? "create" : "edit"}`}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid={`button-submit-${isCreate ? "create" : "edit"}`}
              >
                {submitLabel}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function EquipmentCreateDialog(props: Omit<EquipmentFormDialogProps, "mode" | "equipment">) {
  return <EquipmentFormDialog mode="create" {...props} />;
}

export function EquipmentEditDialog(
  props: Omit<EquipmentFormDialogProps, "mode"> & { equipment: Equipment | null }
) {
  return <EquipmentFormDialog mode="edit" {...props} />;
}
