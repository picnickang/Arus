import { z } from "zod";

/**
 * Certificate registry form schemas (create vs edit) plus the payload mappers
 * that preserve the legacy submit behavior: required keys are always sent,
 * optional keys are omitted when empty so the API never receives "" values.
 */

export const certificateEditSchema = z.object({
  vesselId: z.string(),
  certificateType: z.string(),
  certificateName: z.string(),
  certificateNumber: z.string(),
  issuingAuthority: z.string(),
  issuingAuthorityType: z.string(),
  issueDate: z.string(),
  expiryDate: z.string(),
  equipmentId: z.string(),
  notes: z.string(),
  status: z.string(),
  nextSurveyDue: z.string(),
});

export const certificateCreateSchema = certificateEditSchema.extend({
  vesselId: z.string().min(1, "Vessel is required"),
  certificateType: z.string().min(1, "Certificate type is required"),
  certificateName: z.string().min(1, "Certificate name is required"),
  issuingAuthority: z.string().min(1, "Issuing authority is required"),
  issueDate: z.string().min(1, "Issue date is required"),
});

export type CertificateFormData = z.infer<typeof certificateCreateSchema>;

/** POST /api/certificates payload: required keys always, optional keys only when non-empty. */
export function toCreatePayload(data: CertificateFormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    vesselId: data.vesselId,
    certificateType: data.certificateType,
    certificateName: data.certificateName,
    issuingAuthority: data.issuingAuthority,
    issueDate: data.issueDate,
  };
  if (data.certificateNumber) {
    payload["certificateNumber"] = data.certificateNumber;
  }
  if (data.issuingAuthorityType) {
    payload["issuingAuthorityType"] = data.issuingAuthorityType;
  }
  if (data.expiryDate) {
    payload["expiryDate"] = data.expiryDate;
  }
  if (data.equipmentId) {
    payload["equipmentId"] = data.equipmentId;
  }
  if (data.notes) {
    payload["notes"] = data.notes;
  }
  return payload;
}

/**
 * PATCH /api/certificates/:id payload: keys included only when non-empty,
 * except notes which is always sent (a defined empty string clears notes).
 */
export function toEditPatch(data: CertificateFormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (data.status) {
    payload["status"] = data.status;
  }
  if (data.certificateNumber) {
    payload["certificateNumber"] = data.certificateNumber;
  }
  if (data.expiryDate) {
    payload["expiryDate"] = data.expiryDate;
  }
  if (data.nextSurveyDue) {
    payload["nextSurveyDue"] = data.nextSurveyDue;
  }
  if (data.notes !== undefined) {
    payload["notes"] = data.notes;
  }
  return payload;
}
