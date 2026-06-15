import { z } from "zod";
import type { Supplier, SupplierFormData, VendorType } from "../types";

const optionalNumber = z.preprocess(
  (val) =>
    val === "" || val === undefined || val === null || Number.isNaN(Number(val))
      ? undefined
      : Number(val),
  z.number().optional()
);

const optionalStringArray = z.preprocess(
  (val) =>
    typeof val === "string"
      ? val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : val,
  z.array(z.string()).optional()
);

export const supplierFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(10, "Code must be at most 10 characters"),
  type: z.enum(["supplier", "service_provider", "both"]),
  contactName: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  email: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().email("Invalid email").optional()
  ),
  phone: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  address: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  paymentTerms: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  isActive: z.boolean().optional(),
  notes: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  leadTimeDays: optionalNumber.refine((v) => v === undefined || v >= 0, {
    message: "Must be non-negative",
  }),
  qualityRating: optionalNumber.refine((v) => v === undefined || (v >= 0 && v <= 10), {
    message: "Must be 0-10",
  }),
  defectRate: optionalNumber.refine((v) => v === undefined || (v >= 0 && v <= 100), {
    message: "Must be 0-100",
  }),
  isPreferred: z.boolean().optional(),
  serviceCapabilities: optionalStringArray,
  certifications: optionalStringArray,
  responseSlaHours: optionalNumber.refine((v) => v === undefined || v >= 0, {
    message: "Must be non-negative",
  }),
  equipmentTypesServiced: optionalStringArray,
});

export function buildSupplierFormDefaultValues(
  supplier: Supplier | undefined,
  defaultType: VendorType
): SupplierFormData {
  return {
    name: supplier?.name ?? "",
    code: supplier?.code ?? "",
    type: supplier?.type ?? defaultType,
    contactName: supplier?.contactName ?? "",
    email: supplier?.email ?? "",
    phone: supplier?.phone ?? "",
    address: supplier?.address ?? "",
    paymentTerms: supplier?.paymentTerms ?? "",
    isActive: supplier?.isActive ?? true,
    notes: supplier?.notes ?? "",
    ...(supplier?.leadTimeDays != null ? { leadTimeDays: supplier.leadTimeDays } : {}),
    qualityRating: supplier?.qualityRating ?? 5,
    defectRate: supplier?.defectRate ?? 0,
    isPreferred: supplier?.isPreferred ?? false,
    serviceCapabilities: supplier?.serviceCapabilities ?? [],
    certifications: supplier?.certifications ?? [],
    ...(supplier?.responseSlaHours != null ? { responseSlaHours: supplier.responseSlaHours } : {}),
    equipmentTypesServiced: supplier?.equipmentTypesServiced ?? [],
  };
}
