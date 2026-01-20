/**
 * Data Anonymization Service - PII Field Definitions
 * Entity-specific PII field mappings for GDPR/PDPA compliance
 */

export const PII_FIELDS: Record<string, string[]> = {
  users: ["name", "firstName", "lastName", "email", "phone", "mobile", "address", "addressLine1", "addressLine2", "city", "state", "postalCode", "country", "emergencyContact", "emergencyPhone", "profilePhoto", "avatar", "notes", "bio", "description"],
  crew: ["name", "firstName", "lastName", "email", "phone", "mobile", "address", "nationality", "passportNumber", "seamanBookNumber", "emergencyContact", "emergencyContactPhone", "emergencyContactRelation", "medicalNotes", "notes", "photoUrl"],
  crew_certifications: ["certificateNumber", "issuingAuthority", "notes"],
  crew_assignments: ["notes", "assignedBy", "assignedByName"],
  organizations: ["name", "contactName", "contactEmail", "contactPhone", "address", "billingAddress", "billingEmail"],
  vessels: ["registrationNumber", "ownerName", "ownerContact", "insuranceDetails", "notes"],
  equipment: ["installedBy", "notes", "serialNumber", "manufacturer"],
  devices: ["notes", "serialNumber", "macAddress", "ipAddress"],
  maintenance_records: ["performedBy", "notes", "technicianName", "approvedBy"],
  maintenance_schedules: ["notes", "assignedTo", "createdBy"],
  work_orders: ["assignedTo", "createdBy", "approvedBy", "completedBy", "notes", "description", "reason"],
  work_order_completions: ["completedBy", "completedByName", "notes", "verifiedBy"],
  alert_notifications: ["recipientEmail", "recipientPhone", "acknowledgedBy", "notes"],
  sensor_configurations: ["notes", "configuredBy"],
  kb_docs: ["author", "reviewer", "approvedBy"],
  parts_inventory: ["supplierContact", "supplierEmail", "supplierPhone", "notes"],
  equipment_telemetry: ["notes", "operatorId", "crewId"],
  raw_telemetry: ["notes", "sourceDevice", "operatorId"]
};

export const COMMON_PII_PATTERNS = [
  /name/i, /email/i, /phone/i, /mobile/i, /address/i, /contact/i,
  /passport/i, /license/i, /certificate/i, /seaman/i, /emergency/i,
  /notes$/i, /description$/i, /^author$/i, /^reviewer$/i, /by$/i,
  /photo/i, /avatar/i, /signature/i, /ssn/i, /taxId/i
];

export const PARTIAL_ANONYMIZE_FIELDS: Record<string, string[]> = {
  users: ["email", "phone"],
  crew: ["email", "phone", "passportNumber", "seamanBookNumber"],
  organizations: ["contactEmail", "contactPhone"],
  vessels: ["registrationNumber"],
  alert_notifications: ["recipientEmail", "recipientPhone"]
};
