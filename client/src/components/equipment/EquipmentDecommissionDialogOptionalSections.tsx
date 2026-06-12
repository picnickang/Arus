import type { UseFormReturn } from "react-hook-form";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, DollarSign, Trash2 } from "lucide-react";
import type { DecommissionFormData } from "./EquipmentDecommissionDialogModel";

type DecommissionForm = UseFormReturn<DecommissionFormData, unknown, DecommissionFormData>;

interface FormSectionProps {
  form: DecommissionForm;
}

export function DecommissionSaleDetails({
  form,
  open,
  onOpenChange,
}: FormSectionProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="border rounded-md">
      <CollapsibleTrigger
        className="flex items-center justify-between w-full p-4"
        data-testid="collapsible-sale-details"
      >
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          <span className="font-medium">Sale Details</span>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="saleDetails.salePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sale Price</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="15000"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                    }
                    data-testid="input-sale-price"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="saleDetails.currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || "USD"}>
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
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="saleDetails.buyerName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Buyer Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Company or individual name"
                    {...field}
                    data-testid="input-buyer-name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="saleDetails.buyerContact"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Buyer Contact</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Email or phone"
                    {...field}
                    data-testid="input-buyer-contact"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DecommissionDisposalDetails({
  form,
  open,
  onOpenChange,
}: FormSectionProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="border rounded-md">
      <CollapsibleTrigger
        className="flex items-center justify-between w-full p-4"
        data-testid="collapsible-disposal-details"
      >
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          <span className="font-medium">Disposal Details</span>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="disposalDetails.method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Disposal Method</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="recycled">Recycled</SelectItem>
                    <SelectItem value="landfill">Landfill</SelectItem>
                    <SelectItem value="hazmat_disposal">Hazmat Disposal</SelectItem>
                    <SelectItem value="parts_salvaged">Parts Salvaged</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="disposalDetails.vendor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Disposal Vendor</FormLabel>
                <FormControl>
                  <Input placeholder="Vendor name" {...field} data-testid="input-disposal-vendor" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="disposalDetails.cost"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Disposal Cost</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="500"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  data-testid="input-disposal-cost"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="disposalDetails.environmentalNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Environmental Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any environmental considerations or certifications..."
                  {...field}
                  data-testid="textarea-environmental-notes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
