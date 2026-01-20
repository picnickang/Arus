export type VendorType = "supplier" | "service_provider" | "both";

export interface Supplier {
  id: string;
  orgId: string;
  name: string;
  code: string;
  type: VendorType;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  contactInfo?: Record<string, unknown> | null;
  paymentTerms?: string | null;
  isActive: boolean;
  notes?: string | null;
  leadTimeDays?: number | null;
  qualityRating?: number | null;
  defectRate?: number | null;
  isPreferred: boolean;
  serviceCapabilities?: string[] | null;
  certifications?: string[] | null;
  responseSlaHours?: number | null;
  equipmentTypesServiced?: string[] | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface SupplierWithStats extends Supplier {
  orderCount: number;
}

export interface SupplierFormData {
  name: string;
  code: string;
  type: VendorType;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTerms?: string;
  isActive?: boolean;
  notes?: string;
  leadTimeDays?: number;
  qualityRating?: number;
  defectRate?: number;
  isPreferred?: boolean;
  serviceCapabilities?: string[];
  certifications?: string[];
  responseSlaHours?: number;
  equipmentTypesServiced?: string[];
}

export interface SupplierFilters {
  search?: string;
  isActive?: boolean;
  isPreferred?: boolean;
  type?: VendorType | VendorType[];
  limit?: number;
  offset?: number;
}

export const VENDOR_TYPES: { value: VendorType; label: string }[] = [
  { value: "supplier", label: "Supplier" },
  { value: "service_provider", label: "Service Provider" },
  { value: "both", label: "Both" },
];

export const PAYMENT_TERMS = [
  "NET15",
  "NET30",
  "NET45",
  "NET60",
  "COD",
  "Prepaid",
  "Letter of Credit",
] as const;

export type PaymentTerm = typeof PAYMENT_TERMS[number];

export const SERVICE_CAPABILITIES = [
  "Engine Overhaul",
  "Electrical Systems",
  "Navigation Equipment",
  "Hull Maintenance",
  "Safety Equipment",
  "HVAC Systems",
  "Propulsion Systems",
  "Deck Machinery",
  "Hydraulic Systems",
  "Welding & Fabrication",
] as const;

export const EQUIPMENT_TYPES = [
  "Main Engine",
  "Generator",
  "Pump",
  "Compressor",
  "Crane",
  "Winch",
  "Boiler",
  "Separator",
  "Steering Gear",
  "Anchor Windlass",
] as const;
