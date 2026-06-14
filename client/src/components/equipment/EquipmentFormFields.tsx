import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { EQUIPMENT_LOCATIONS, EQUIPMENT_TYPES } from "@/constants/equipment";
import { formatLocation, formatType } from "@/utils/equipmentHelpers";
import type { InsertEquipment, Vessel } from "@shared/schema";

interface EquipmentFormFieldsProps {
  form: UseFormReturn<InsertEquipment>;
  vessels: Vessel[];
  isCreate: boolean;
  isPending: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (data: InsertEquipment) => void;
}

export function EquipmentFormFields({
  form,
  vessels,
  isCreate,
  isPending,
  submitLabel,
  onCancel,
  onSubmit,
}: EquipmentFormFieldsProps) {
  const testIdPrefix = isCreate ? "" : "edit-";

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
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
                    value={field.value ?? ""}
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
                    value={field.value ?? ""}
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
                    value={field.value ?? ""}
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
                      .filter((vessel) => vessel.id)
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
                value={field.value ?? undefined}
                defaultValue={field.value ?? undefined}
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
                    onChange={(event) =>
                      field.onChange(event.target.value ? parseFloat(event.target.value) : undefined)
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
                          ? (field.value as string).split("T")[0]
                          : new Date(field.value as string | Date).toISOString().split("T")[0]
                        : ""
                    }
                    onChange={(event) => field.onChange(event.target.value || undefined)}
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
                      onChange={(event) =>
                        field.onChange(event.target.value ? parseFloat(event.target.value) : undefined)
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
                      onChange={(event) =>
                        field.onChange(event.target.value ? parseFloat(event.target.value) : undefined)
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
                      onChange={(event) =>
                        field.onChange(event.target.value ? parseFloat(event.target.value) : undefined)
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
                      onChange={(event) =>
                        field.onChange(event.target.value ? parseFloat(event.target.value) : undefined)
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
                  checked={field.value ?? undefined}
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
            onClick={onCancel}
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
  );
}
