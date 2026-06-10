import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

/**
 * Enhanced service request / service order form (EnhancedServiceRequestDialog).
 * Create mode requires provider + equipment + description + requested date;
 * edit mode only requires the description (matching the dialog's previous
 * canSubmit split). Certificate renewals are a dynamic row array. Numeric
 * text inputs stay strings in the form and are parsed in the payload mapper,
 * with a field-level "enter a number" rule.
 */

const numericText = (message: string) =>
  z.string().refine((v) => v.trim() === "" || Number.isFinite(Number(v)), message);

const certItemSchema = z.object({
  certId: z.string(),
  name: z.string(),
  expiryDate: z.date().optional(),
  remarks: z.string(),
});

export function makeEnhancedServiceRequestSchema(isEditing: boolean) {
  return z.object({
    providerId: isEditing ? z.string() : z.string().min(1, "Service provider is required"),
    equipmentIds: isEditing
      ? z.array(z.string())
      : z.array(z.string()).min(1, "Select at least one equipment item"),
    severity: z.string(),
    assistanceTags: z.array(z.string()),
    symptomDescription: z
      .string()
      .min(1, "Description is required")
      .transform((v) => v.trim())
      .refine((v) => v.length > 0, "Description is required"),
    probableCause: z.string(),
    actionTakenSoFar: z.string(),
    isRecurringDefect: z.boolean(),
    requestedStartDate: isEditing
      ? z.date().optional()
      : z.date({ required_error: "Requested date is required" }),
    requestedEndDate: z.date().optional(),
    estimatedHours: numericText("Enter a number of hours"),
    quotedAmount: numericText("Enter an amount"),
    notes: z.string(),
    mocRequired: z.boolean(),
    mocNumber: z.string(),
    certificateItems: z.array(certItemSchema),
  });
}

export type EnhancedSrValues = {
  providerId: string;
  equipmentIds: string[];
  severity: string;
  assistanceTags: string[];
  symptomDescription: string;
  probableCause: string;
  actionTakenSoFar: string;
  isRecurringDefect: boolean;
  requestedStartDate?: Date | undefined;
  requestedEndDate?: Date | undefined;
  estimatedHours: string;
  quotedAmount: string;
  notes: string;
  mocRequired: boolean;
  mocNumber: string;
  certificateItems: Array<z.infer<typeof certItemSchema>>;
};

export interface EnhancedServiceRequestData {
  serviceProviderId: string;
  equipmentIds: string[];
  severity: string;
  assistanceTags: string[];
  symptomDescription: string;
  probableCause?: string | undefined;
  actionTakenSoFar?: string | undefined;
  isRecurringDefect: boolean;
  requestedStartDate?: Date | undefined;
  requestedEndDate?: Date | undefined;
  estimatedDurationHours?: number | undefined;
  quotedAmount?: number | undefined;
  notes?: string | undefined;
  mocRequired: boolean;
  mocNumber?: string | undefined;
  certificateItems?:
    | Array<{ name: string; expiryDate?: string | undefined; remarks?: string | undefined }>
    | undefined;
  scope?: string | undefined;
}

export interface InitialServiceOrderData {
  serviceProviderId?: string | undefined;
  scope?: string | undefined;
  scheduledStartDate?: string | undefined;
  scheduledEndDate?: string | undefined;
  estimatedDurationHours?: number | undefined;
}

export const ENHANCED_SR_DEFAULTS: EnhancedSrValues = {
  providerId: "",
  equipmentIds: [],
  severity: "general",
  assistanceTags: [],
  symptomDescription: "",
  probableCause: "",
  actionTakenSoFar: "",
  isRecurringDefect: false,
  estimatedHours: "",
  quotedAmount: "",
  notes: "",
  mocRequired: false,
  mocNumber: "",
  certificateItems: [],
};

export function toEnhancedServiceRequestData(
  v: EnhancedSrValues,
  opts: { showAdvanced: boolean; showCertificates: boolean }
): EnhancedServiceRequestData {
  const data: EnhancedServiceRequestData = {
    serviceProviderId: v.providerId,
    equipmentIds: v.equipmentIds,
    severity: opts.showAdvanced ? v.severity : "general",
    assistanceTags: opts.showAdvanced ? v.assistanceTags : [],
    symptomDescription: v.symptomDescription,
    isRecurringDefect: opts.showAdvanced ? v.isRecurringDefect : false,
    requestedStartDate: v.requestedStartDate,
    mocRequired: opts.showAdvanced ? v.mocRequired : false,
    scope: v.symptomDescription,
  };

  if (opts.showAdvanced) {
    data.probableCause = v.probableCause || undefined;
    data.actionTakenSoFar = v.actionTakenSoFar || undefined;
    data.requestedEndDate = v.requestedEndDate;
    data.estimatedDurationHours = v.estimatedHours
      ? Number.parseFloat(v.estimatedHours)
      : undefined;
    data.quotedAmount = v.quotedAmount ? Number.parseFloat(v.quotedAmount) : undefined;
    data.notes = v.notes || undefined;
    data.mocNumber = v.mocRequired ? v.mocNumber || undefined : undefined;
    data.certificateItems =
      opts.showCertificates && v.certificateItems.length > 0
        ? v.certificateItems
            .filter((c) => c.name.trim())
            .map((c) => ({
              name: c.name,
              expiryDate: c.expiryDate?.toISOString(),
              remarks: c.remarks || undefined,
            }))
        : undefined;
  }

  return data;
}

export function useEnhancedServiceRequestForm(
  open: boolean,
  isEditing: boolean,
  initialData?: InitialServiceOrderData
) {
  const form = useForm<EnhancedSrValues, unknown, EnhancedSrValues>({
    resolver: zodResolver(makeEnhancedServiceRequestSchema(isEditing)),
    defaultValues: ENHANCED_SR_DEFAULTS,
  });
  const certArray = useFieldArray({ control: form.control, name: "certificateItems" });

  // Re-seed on every open: edit mode maps the service order in, create mode
  // starts blank.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (isEditing && initialData) {
      form.reset({
        ...ENHANCED_SR_DEFAULTS,
        providerId: initialData.serviceProviderId ?? "",
        symptomDescription: initialData.scope ?? "",
        ...(initialData.scheduledStartDate && {
          requestedStartDate: new Date(initialData.scheduledStartDate),
        }),
        ...(initialData.scheduledEndDate && {
          requestedEndDate: new Date(initialData.scheduledEndDate),
        }),
        estimatedHours: initialData.estimatedDurationHours
          ? String(initialData.estimatedDurationHours)
          : "",
      });
    } else {
      form.reset(ENHANCED_SR_DEFAULTS);
    }
  }, [open, isEditing, initialData, form]);

  const addCertificate = () =>
    certArray.append({ certId: `cert-${Date.now()}`, name: "", remarks: "" });

  return { form, certArray, addCertificate };
}
