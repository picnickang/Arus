import type { DefaultValues } from "react-hook-form";
import { z } from "zod";
import { decommissionReasonEnum, disposalDetailsSchema, saleDetailsSchema } from "@shared/schema";

export const decommissionFormSchema = z.object({
  reason: decommissionReasonEnum,
  eventDate: z.string().min(1, "Event date is required"),
  authorizedBy: z.string().optional(),
  finalCondition: z.string().optional(),
  notes: z.string().optional(),
  saleDetails: saleDetailsSchema.optional(),
  disposalDetails: disposalDetailsSchema.optional(),
  replacementEquipmentId: z.string().optional(),
  bookValueAtRemoval: z.number().optional(),
  residualValue: z.number().optional(),
});

export type DecommissionFormData = z.infer<typeof decommissionFormSchema>;

export const REASON_LABELS: Record<string, string> = {
  sold: "Sold",
  scrapped: "Scrapped / Disposed",
  replaced: "Replaced",
  end_of_life: "End of Life",
  transferred: "Transferred to Another Vessel",
  damaged_beyond_repair: "Damaged Beyond Repair",
};

export const CONDITION_OPTIONS = ["excellent", "good", "fair", "poor", "non_functional"];

export interface DepreciationSummary {
  bookValue: number;
  depreciationYears: number;
}

export function formatCondition(condition: string): string {
  return condition
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function calculateDepreciation(
  purchaseValue: number | null | undefined,
  purchaseDate: Date | string | null | undefined
): DepreciationSummary {
  if (!purchaseValue || !purchaseDate) {
    return { bookValue: 0, depreciationYears: 0 };
  }

  const purchaseDateObj = typeof purchaseDate === "string" ? new Date(purchaseDate) : purchaseDate;
  const now = new Date();
  const yearsOwned = (now.getTime() - purchaseDateObj.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const usefulLifeYears = 10;
  const depreciationRate = 1 / usefulLifeYears;
  const depreciatedValue = purchaseValue * (1 - Math.min(yearsOwned * depreciationRate, 1));

  return {
    bookValue: Math.max(0, depreciatedValue),
    depreciationYears: Math.round(yearsOwned * 10) / 10,
  };
}

export function createDecommissionDefaults(
  depreciation: DepreciationSummary
): DefaultValues<DecommissionFormData> {
  return {
    reason: "end_of_life",
    eventDate: new Date().toISOString().slice(0, 10),
    authorizedBy: "",
    finalCondition: "",
    notes: "",
    saleDetails: {
      salePrice: undefined,
      currency: "USD",
      buyerName: "",
      buyerContact: "",
    },
    disposalDetails: {
      method: "",
      vendor: "",
      cost: undefined,
      environmentalNotes: "",
    },
    replacementEquipmentId: "",
    bookValueAtRemoval: depreciation.bookValue,
    residualValue: undefined,
  };
}
