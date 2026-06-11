import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import type { VesselCertificate } from "@shared/schema";
import {
  certificateCreateSchema,
  certificateEditSchema,
  type CertificateFormData,
} from "./certificateFormSchema";

const emptyFormValues: CertificateFormData = {
  vesselId: "",
  certificateType: "",
  certificateName: "",
  certificateNumber: "",
  issuingAuthority: "",
  issuingAuthorityType: "",
  issueDate: "",
  expiryDate: "",
  equipmentId: "",
  notes: "",
  status: "",
  nextSurveyDue: "",
};

function toDateInput(value: string | Date | null | undefined): string {
  if (!value) {
    return "";
  }
  return format(typeof value === "string" ? parseISO(value) : value, "yyyy-MM-dd");
}

export function useCertificateForm({
  open,
  mode,
  initialData,
}: {
  open: boolean;
  mode: "create" | "edit";
  initialData?: VesselCertificate | null;
}) {
  const form = useForm<CertificateFormData, unknown, CertificateFormData>({
    resolver: zodResolver(mode === "create" ? certificateCreateSchema : certificateEditSchema),
    defaultValues: emptyFormValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    if (mode === "edit" && initialData) {
      form.reset({
        vesselId: initialData.vesselId || "",
        certificateType: initialData.certificateType || "",
        certificateName: initialData.certificateName || "",
        certificateNumber: initialData.certificateNumber || "",
        issuingAuthority: initialData.issuingAuthority || "",
        issuingAuthorityType:
          (initialData as { issuingAuthorityType?: string }).issuingAuthorityType || "",
        issueDate: toDateInput(initialData.issueDate),
        expiryDate: toDateInput(initialData.expiryDate),
        equipmentId: initialData.equipmentId || "",
        notes: initialData.notes || "",
        status: initialData.status || "valid",
        nextSurveyDue: toDateInput(initialData.nextSurveyDue),
      });
    } else {
      form.reset(emptyFormValues);
    }
  }, [open, mode, initialData, form]);

  return form;
}
