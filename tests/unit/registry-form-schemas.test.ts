/**
 * Batch 4 registry-form migration schemas — pins the zod validation rules and,
 * critically, the payload mappers that preserve each legacy handleSubmit's
 * wire format:
 *  - Certificate create: required keys always sent, optional keys omitted when
 *    empty; edit patch: keys omitted when empty EXCEPT notes, which is always
 *    sent so an emptied textarea clears the stored note.
 *  - Service request edit: cleared optional fields map to null (not undefined)
 *    so the backend PATCH actually clears them; estimatedCost "" -> null.
 *  - Sensor template: fieldsJson superRefine surfaces invalid JSON as a
 *    field-level issue (replacing the old Invalid-JSON toast), and the
 *    create/edit schemas enforce the legacy isFormValid required sets.
 */

import {
  certificateCreateSchema,
  certificateEditSchema,
  toCreatePayload,
  toEditPatch,
  type CertificateFormData,
} from "@/pages/certificate-registry/certificateFormSchema";
import {
  editServiceRequestSchema,
  toUpdatePayload,
} from "@/features/serviceRequests/lib/editServiceRequestSchema";
import {
  sensorTemplateCreateSchema,
  sensorTemplateEditSchema,
} from "@/components/sensors/useSensorTemplateForm";

const emptyCertificate: CertificateFormData = {
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

const filledCertificate: CertificateFormData = {
  ...emptyCertificate,
  vesselId: "vessel-1",
  certificateType: "safety_equipment",
  certificateName: "Cargo Ship Safety Equipment Certificate",
  issuingAuthority: "Lloyd's Register",
  issueDate: "2026-01-15",
};

describe("certificate registry form schemas", () => {
  it("create schema accepts the five required fields and round-trips", () => {
    const result = certificateCreateSchema.safeParse(filledCertificate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(filledCertificate);
    }
  });

  it.each([
    "vesselId",
    "certificateType",
    "certificateName",
    "issuingAuthority",
    "issueDate",
  ] as const)("create schema rejects an empty %s with a field-level issue", (field) => {
    const result = certificateCreateSchema.safeParse({ ...filledCertificate, [field]: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual([field]);
    }
  });

  it("edit schema accepts an entirely empty form", () => {
    expect(certificateEditSchema.safeParse(emptyCertificate).success).toBe(true);
  });

  it("toCreatePayload sends only the required keys when optionals are empty", () => {
    expect(toCreatePayload(filledCertificate)).toEqual({
      vesselId: "vessel-1",
      certificateType: "safety_equipment",
      certificateName: "Cargo Ship Safety Equipment Certificate",
      issuingAuthority: "Lloyd's Register",
      issueDate: "2026-01-15",
    });
  });

  it("toCreatePayload includes optional keys only when non-empty", () => {
    const payload = toCreatePayload({
      ...filledCertificate,
      certificateNumber: "CERT-42",
      issuingAuthorityType: "class_society",
      expiryDate: "2031-01-15",
      equipmentId: "eq-9",
      notes: "Renewal survey due",
    });
    expect(payload).toEqual({
      vesselId: "vessel-1",
      certificateType: "safety_equipment",
      certificateName: "Cargo Ship Safety Equipment Certificate",
      issuingAuthority: "Lloyd's Register",
      issueDate: "2026-01-15",
      certificateNumber: "CERT-42",
      issuingAuthorityType: "class_society",
      expiryDate: "2031-01-15",
      equipmentId: "eq-9",
      notes: "Renewal survey due",
    });
  });

  it("toEditPatch omits empty keys but always sends notes (clearing supported)", () => {
    expect(toEditPatch(emptyCertificate)).toEqual({ notes: "" });
  });

  it("toEditPatch includes status/number/dates when set", () => {
    const patch = toEditPatch({
      ...emptyCertificate,
      status: "expired",
      certificateNumber: "CERT-42",
      expiryDate: "2026-12-31",
      nextSurveyDue: "2026-09-30",
      notes: "Condition of class added",
    });
    expect(patch).toEqual({
      status: "expired",
      certificateNumber: "CERT-42",
      expiryDate: "2026-12-31",
      nextSurveyDue: "2026-09-30",
      notes: "Condition of class added",
    });
  });
});

describe("edit service request schema", () => {
  const validForm = {
    title: "Replace fuel injectors",
    description: "Cylinder 3 misfiring",
    urgency: "high",
    estimatedCost: "1250.50",
    serviceDetails: "OEM parts only",
    specialRequirements: "Night shift access",
  };

  it("parses a filled form, coercing estimatedCost text to a number", () => {
    const result = editServiceRequestSchema.safeParse(validForm);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.estimatedCost).toBe(1250.5);
    }
  });

  it("rejects an empty or whitespace-only title on the title path", () => {
    for (const title of ["", "   "]) {
      const result = editServiceRequestSchema.safeParse({ ...validForm, title });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(["title"]);
      }
    }
  });

  it("maps an empty estimatedCost input to null", () => {
    const result = editServiceRequestSchema.safeParse({ ...validForm, estimatedCost: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.estimatedCost).toBeNull();
    }
  });

  it("toUpdatePayload maps cleared optional fields to null so PATCH clears them", () => {
    const parsed = editServiceRequestSchema.parse({
      title: "  Trimmed title  ",
      description: "",
      urgency: "medium",
      estimatedCost: "",
      serviceDetails: "",
      specialRequirements: "",
    });
    expect(toUpdatePayload(parsed)).toEqual({
      title: "Trimmed title",
      description: null,
      urgency: "medium",
      estimatedCost: null,
      serviceDetails: null,
      specialRequirements: null,
    });
  });

  it("toUpdatePayload passes non-empty values through unchanged", () => {
    const parsed = editServiceRequestSchema.parse(validForm);
    expect(toUpdatePayload(parsed)).toEqual({
      title: "Replace fuel injectors",
      description: "Cylinder 3 misfiring",
      urgency: "high",
      estimatedCost: 1250.5,
      serviceDetails: "OEM parts only",
      specialRequirements: "Night shift access",
    });
  });
});

describe("sensor template form schemas", () => {
  const validCreate = {
    templateId: "CUSTOM-PRESSURE-01",
    name: "Custom Pressure Sensor",
    kind: "pressure",
    unit: "bar",
    equipmentTypes: ["marine_pump"],
    fields: { warn_high: 8 },
    fieldsJson: '{"warn_high": 8}',
    notes: "",
  };

  it("create schema accepts a valid template", () => {
    expect(sensorTemplateCreateSchema.safeParse(validCreate).success).toBe(true);
  });

  it("flags invalid fieldsJson with an issue on the fieldsJson path", () => {
    const result = sensorTemplateCreateSchema.safeParse({
      ...validCreate,
      fieldsJson: "{not valid json",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "fieldsJson");
      expect(issue).toBeDefined();
      expect(issue?.message).toBe("Please enter valid JSON for fields");
    }
  });

  it("create schema enforces the legacy required set (templateId, name, kind)", () => {
    for (const field of ["templateId", "name", "kind"] as const) {
      const result = sensorTemplateCreateSchema.safeParse({ ...validCreate, [field]: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual([field]);
      }
    }
    // Whitespace-only fails too, matching the old trim()-based isFormValid.
    expect(sensorTemplateCreateSchema.safeParse({ ...validCreate, name: "  " }).success).toBe(
      false
    );
  });

  it("edit schema only requires name (templateId/kind are immutable in edit)", () => {
    const editable = { ...validCreate, templateId: "", kind: "" };
    expect(sensorTemplateEditSchema.safeParse(editable).success).toBe(true);
    expect(sensorTemplateEditSchema.safeParse({ ...editable, name: " " }).success).toBe(false);
  });
});
