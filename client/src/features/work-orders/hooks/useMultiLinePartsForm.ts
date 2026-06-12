import { useCallback, useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

/**
 * Multi-line purchase-request form (MultiLinePartsRequestDialog): dynamic rows
 * via useFieldArray, per-row description/quantity validation, and an
 * array-level "add at least one part" rule. Rows carry their inventory
 * metadata (part number, stock, supplier) through the form values so the
 * payload mapping stays in one place.
 */

const partsRequestRowSchema = z.object({
  rowId: z.string(),
  inventoryItemId: z.string().optional(),
  partNumber: z.string().optional(),
  partName: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().int("Whole numbers only").min(1, "Quantity must be at least 1"),
  notes: z.string(),
  unitCost: z.number().optional(),
  quantityOnHand: z.number().optional(),
  isCustom: z.boolean(),
  selectedSupplierId: z.string().optional(),
});

export const partsRequestSchema = z.object({
  globalNotes: z.string(),
  items: z.array(partsRequestRowSchema).min(1, "Add at least one part"),
});

export type PartsRequestValues = z.infer<typeof partsRequestSchema>;
export type PartsRequestRow = z.infer<typeof partsRequestRowSchema>;

export interface SuggestedPart {
  partId: string;
  partNo: string;
  partName: string;
  quantityNeeded: number;
  quantityOnHand: number;
  shortfall: number;
  suggestedOrderQuantity: number;
}

export interface PartsRequestPayload {
  notes?: string | undefined;
  items: Array<{
    partId?: string | undefined;
    description: string;
    quantity: number;
    notes?: string | undefined;
    supplierId?: string | undefined;
  }>;
}

export function toPartsRequestPayload(data: PartsRequestValues): PartsRequestPayload {
  return {
    notes: data.globalNotes || undefined,
    items: data.items.map((item) => ({
      partId: item.inventoryItemId,
      description: item.description,
      quantity: item.quantity,
      notes: item.notes || undefined,
      supplierId: item.selectedSupplierId || undefined,
    })),
  };
}

const generateId = () => `item-${Date.now()}-${crypto.randomUUID().slice(0, 7)}`;

export function useMultiLinePartsForm(open: boolean, suggestions: SuggestedPart[]) {
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  const form = useForm<PartsRequestValues, unknown, PartsRequestValues>({
    resolver: zodResolver(partsRequestSchema),
    defaultValues: { globalNotes: "", items: [] },
  });
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Pre-fill out-of-stock suggestions once per open.
  useEffect(() => {
    if (open && !suggestionsLoaded && suggestions.length > 0) {
      replace(
        suggestions.map((s) => ({
          rowId: generateId(),
          inventoryItemId: s.partId,
          partNumber: s.partNo,
          partName: s.partName,
          description: `${s.partNo} - ${s.partName}`,
          quantity: s.suggestedOrderQuantity,
          notes: "",
          quantityOnHand: s.quantityOnHand,
          isCustom: false,
        }))
      );
      setSuggestionsLoaded(true);
    }
  }, [open, suggestions, suggestionsLoaded, replace]);

  const addInventoryItem = useCallback(
    (part: {
      id: string;
      partNumber: string;
      partName: string;
      unitCost?: number | undefined;
      quantityOnHand?: number | undefined;
    }) => {
      append({
        rowId: generateId(),
        inventoryItemId: part.id,
        partNumber: part.partNumber,
        partName: part.partName,
        description: `${part.partNumber} - ${part.partName}`,
        quantity: 1,
        notes: "",
        ...(part.unitCost !== undefined && { unitCost: part.unitCost }),
        ...(part.quantityOnHand !== undefined && { quantityOnHand: part.quantityOnHand }),
        isCustom: false,
      });
    },
    [append]
  );

  const addCustomItem = useCallback(() => {
    append({
      rowId: generateId(),
      description: "",
      quantity: 1,
      notes: "",
      isCustom: true,
    });
  }, [append]);

  const resetForm = useCallback(() => {
    form.reset({ globalNotes: "", items: [] });
    setSuggestionsLoaded(false);
  }, [form]);

  return {
    form,
    fields,
    removeItem: remove,
    addInventoryItem,
    addCustomItem,
    resetForm,
    suggestionsLoaded,
  };
}
