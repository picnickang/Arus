import type { UseFormReturn } from "react-hook-form";
import type { Equipment } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { FileText, RefreshCw } from "lucide-react";
import {
  CONDITION_OPTIONS,
  type DecommissionFormData,
  type DepreciationSummary,
  REASON_LABELS,
  formatCondition,
} from "./EquipmentDecommissionDialogModel";

type DecommissionForm = UseFormReturn<DecommissionFormData, unknown, DecommissionFormData>;

interface FormSectionProps {
  form: DecommissionForm;
}

export function EquipmentDecommissionSummary({
  equipment,
  depreciation,
}: {
  equipment: Equipment;
  depreciation: DepreciationSummary;
}) {
  return (
    <div className="bg-muted/50 rounded-md p-4 space-y-2">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Equipment:</span>{" "}
          <span className="font-medium">{equipment.name}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Type:</span>{" "}
          <span className="font-medium">{equipment.type}</span>
        </div>
        {equipment.purchaseValue && (
          <>
            <div>
              <span className="text-muted-foreground">Purchase Value:</span>{" "}
              <span className="font-medium">{formatCurrency(equipment.purchaseValue)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Est. Book Value:</span>{" "}
              <span className="font-medium">{formatCurrency(depreciation.bookValue)}</span>
              <span className="text-xs text-muted-foreground ml-1">
                ({depreciation.depreciationYears} yrs)
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function DecommissionReasonFields({ form }: FormSectionProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason for Decommission *</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                data-testid="select-decommission-reason"
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(REASON_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="eventDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Decommission Date *</FormLabel>
              <FormControl>
                <Input type="date" {...field} data-testid="input-decommission-date" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="authorizedBy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Authorized By</FormLabel>
              <FormControl>
                <Input placeholder="Chief Engineer" {...field} data-testid="input-authorized-by" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="finalCondition"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Final Condition</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value || ""}
                data-testid="select-final-condition"
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CONDITION_OPTIONS.map((condition) => (
                    <SelectItem key={condition} value={condition}>
                      {formatCondition(condition)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
}

export function DecommissionReplacementSection({
  form,
  replacementOptions,
}: FormSectionProps & {
  replacementOptions: Equipment[];
}) {
  return (
    <div className="border rounded-md p-4">
      <div className="flex items-center gap-2 mb-4">
        <RefreshCw className="h-4 w-4" />
        <span className="font-medium">Replacement Equipment</span>
      </div>
      <FormField
        control={form.control}
        name="replacementEquipmentId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Link to Replacement</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value || ""}
              data-testid="select-replacement"
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select replacement equipment" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {replacementOptions.map((eq) => (
                  <SelectItem key={eq.id} value={eq.id}>
                    {eq.name} ({eq.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export function DecommissionFinancialSummary({
  form,
  depreciation,
}: FormSectionProps & {
  depreciation: DepreciationSummary;
}) {
  return (
    <>
      <Separator />

      <div className="border rounded-md p-4">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4" />
          <span className="font-medium">Financial Summary</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="bookValueAtRemoval"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Book Value at Removal</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder={String(Math.round(depreciation.bookValue))}
                    {...field}
                    value={field.value ?? Math.round(depreciation.bookValue)}
                    onChange={(e) =>
                      field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                    }
                    data-testid="input-book-value"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="residualValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Residual/Salvage Value</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="0"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                    }
                    data-testid="input-residual-value"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </>
  );
}

export function DecommissionNotesAndActions({
  form,
  isPending,
  onCancel,
}: FormSectionProps & {
  isPending?: boolean | undefined;
  onCancel: () => void;
}) {
  return (
    <>
      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Additional Notes</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Any additional information about the decommission..."
                {...field}
                data-testid="textarea-decommission-notes"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          data-testid="button-cancel-decommission"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={isPending}
          data-testid="button-submit-decommission"
        >
          {isPending ? "Processing..." : "Confirm Decommission"}
        </Button>
      </div>
    </>
  );
}
