import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useSuppliers, useSupplierPerformance, SupplierSelectOption } from "@/features/suppliers";
import { useParts } from "@/features/inventory/hooks/useInventory";
import type { PRItemFormData } from "../types";

const itemSchema = z.object({
  partId: z.string().min(1, "Part is required"),
  supplierId: z.string().optional(),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  uom: z.string().optional(),
  remarks: z.string().optional(),
});

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PRItemFormData) => void;
  isPending?: boolean;
}

export function AddItemDialog({ open, onOpenChange, onSubmit, isPending }: AddItemDialogProps) {
  const { data: parts, isLoading: partsLoading } = useParts();
  const { data: suppliers, isLoading: suppliersLoading } = useSuppliers();
  const { data: perfData } = useSupplierPerformance();
  const perfMap = new Map(perfData?.map((p) => [p.supplierId, p]) ?? []);

  const form = useForm<PRItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: { partId: "", supplierId: "", quantity: 1, uom: "", remarks: "" },
  });

  const handleSubmit = (data: PRItemFormData) => {
    const sanitized: PRItemFormData = {
      partId: data.partId,
      quantity: data.quantity,
      supplierId: data.supplierId && data.supplierId.trim() !== "" ? data.supplierId : undefined,
      uom: data.uom && data.uom.trim() !== "" ? data.uom : undefined,
      remarks: data.remarks && data.remarks.trim() !== "" ? data.remarks : undefined,
    };
    onSubmit(sanitized);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Item to Purchase Request</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="partId" render={({ field }) => (
              <FormItem>
                <FormLabel>Part *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-part">
                      <SelectValue placeholder={partsLoading ? "Loading..." : "Select part"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {parts?.map((part) => (
                      <SelectItem key={part.id} value={part.id}>
                        {part.partNumber} - {part.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="supplierId" render={({ field }) => (
              <FormItem>
                <FormLabel>Preferred Supplier</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-supplier">
                      <SelectValue placeholder={suppliersLoading ? "Loading..." : "Select supplier (optional)"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {suppliers?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <SupplierSelectOption supplierId={s.id} name={s.name} code={s.code} performance={perfMap.get(s.id)} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity *</FormLabel>
                  <FormControl><Input type="number" min="1" {...field} data-testid="input-quantity" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="uom" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit of Measure</FormLabel>
                  <FormControl><Input {...field} placeholder="pcs, kg, etc." data-testid="input-uom" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="remarks" render={({ field }) => (
              <FormItem>
                <FormLabel>Remarks</FormLabel>
                <FormControl><Textarea {...field} placeholder="Additional notes" data-testid="input-remarks" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={isPending} data-testid="button-add-item">
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Item
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
