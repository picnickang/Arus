import type { EmailTemplate, TemplateKey } from "./types";

export const DEFAULT_TEMPLATES: Record<TemplateKey, EmailTemplate> = {
  service_order: {
    name: "Service Order Request",
    subject: "Service Request - {{equipment.name}} - {{vessel.name}}",
    body: `Dear {{serviceProvider.name}},

We are requesting service for the following equipment:

EQUIPMENT DETAILS
-----------------
Vessel: {{vessel.name}}
Equipment: {{equipment.name}}
Type: {{equipment.type}}
Manufacturer: {{equipment.manufacturer}}
Model: {{equipment.model}}
Serial Number: {{equipment.serialNumber}}
Location: {{equipment.location}}

SERVICE SCOPE
-------------
{{serviceOrder.scope}}

SERVICE DETAILS
---------------
{{serviceOrder.serviceDetails}}

SPECIAL REQUIREMENTS
--------------------
{{serviceOrder.specialRequirements}}

SCHEDULE
--------
Requested Start: {{serviceOrder.scheduledStartDate}}
Estimated Duration: {{serviceOrder.estimatedDurationHours}} hours

Please confirm availability and provide a quotation.

Best regards,
{{organization.name}}`,
    variables: [
      "equipment.name", "equipment.type", "equipment.manufacturer", "equipment.model",
      "equipment.serialNumber", "equipment.location", "vessel.name",
      "serviceProvider.name", "serviceOrder.scope", "serviceOrder.serviceDetails",
      "serviceOrder.specialRequirements", "serviceOrder.scheduledStartDate",
      "serviceOrder.estimatedDurationHours", "organization.name"
    ],
  },
  replacement_quote: {
    name: "Replacement Quote Request",
    subject: "Equipment Replacement Quote Request - {{equipment.name}} - {{vessel.name}}",
    body: `Dear {{serviceProvider.name}},

We are requesting a quotation for equipment replacement on behalf of {{organization.name}}.

EQUIPMENT TO BE REPLACED
------------------------
Vessel: {{vessel.name}}
Equipment: {{equipment.name}}
Type: {{equipment.type}}
Manufacturer: {{equipment.manufacturer}}
Model: {{equipment.model}}
Serial Number: {{equipment.serialNumber}}
Install Date: {{equipment.purchaseDate}}
Current Value: {{equipment.purchaseValue}} {{equipment.purchaseCurrency}}
Location: {{equipment.location}}

REPLACEMENT JUSTIFICATION
-------------------------
{{serviceOrder.justification}}

QUOTE REQUIREMENTS
------------------
Urgency: {{serviceOrder.urgency}}
Acceptable Downtime Window: {{serviceOrder.downtimeWindowStart}} to {{serviceOrder.downtimeWindowEnd}}
Budget Range: {{serviceOrder.budgetMin}} - {{serviceOrder.budgetMax}} {{serviceOrder.currency}}

PLEASE PROVIDE
--------------
1. Itemized quote (equipment, labor, shipping)
2. Warranty terms and duration
3. Estimated lead time for delivery
4. Installation support availability

Response requested by: {{serviceOrder.responseDeadline}}

Best regards,
{{organization.name}}`,
    variables: [
      "equipment.name", "equipment.type", "equipment.manufacturer", "equipment.model",
      "equipment.serialNumber", "equipment.location", "equipment.purchaseDate",
      "equipment.purchaseValue", "equipment.purchaseCurrency", "vessel.name",
      "serviceProvider.name", "serviceOrder.justification", "serviceOrder.urgency",
      "serviceOrder.downtimeWindowStart", "serviceOrder.downtimeWindowEnd",
      "serviceOrder.budgetMin", "serviceOrder.budgetMax", "serviceOrder.currency",
      "serviceOrder.responseDeadline", "organization.name"
    ],
  },
  purchase_order: {
    name: "Purchase Order Request",
    subject: "Purchase Order Request - {{purchaseOrder.poNumber}}",
    body: `Dear {{supplier.name}},

We would like to place the following purchase order:

ORDER DETAILS
-------------
PO Number: {{purchaseOrder.poNumber}}
Order Date: {{purchaseOrder.orderDate}}
Requested Delivery: {{purchaseOrder.requestedDeliveryDate}}

ITEMS
-----
{{purchaseOrder.items}}

DELIVERY ADDRESS
----------------
{{organization.address}}

PAYMENT TERMS
-------------
{{purchaseOrder.paymentTerms}}

Please confirm receipt and provide expected delivery date.

Best regards,
{{organization.name}}`,
    variables: [
      "supplier.name", "purchaseOrder.poNumber", "purchaseOrder.orderDate",
      "purchaseOrder.requestedDeliveryDate", "purchaseOrder.items",
      "purchaseOrder.paymentTerms", "organization.name", "organization.address"
    ],
  },
};

export const SAMPLE_DATA = {
  equipment: {
    name: "Main Engine Seawater Pump",
    type: "Centrifugal Pump",
    manufacturer: "Alfa Laval",
    model: "SX-450",
    serialNumber: "AL-2019-78432",
    location: "Engine Room, Port Side",
    purchaseDate: "March 2019",
    purchaseValue: "22,500",
    purchaseCurrency: "USD",
  },
  vessel: { name: "MV Pacific Voyager" },
  serviceProvider: { name: "Marine Equipment Corp" },
  supplier: { name: "Parts Unlimited Inc" },
  organization: { 
    name: "Pacific Maritime Fleet",
    address: "123 Harbor Drive, Singapore 018956"
  },
  serviceOrder: {
    scope: "Full inspection and repair of seawater cooling pump",
    serviceDetails: "Replace worn bearings and seals, check impeller for corrosion",
    specialRequirements: "Must be completed during scheduled port call",
    scheduledStartDate: "January 15, 2025",
    estimatedDurationHours: "8",
    justification: "Repeated bearing failures over past 6 months despite multiple repairs. Vibration analysis indicates internal wear beyond acceptable thresholds.",
    urgency: "Urgent",
    downtimeWindowStart: "January 15, 2025",
    downtimeWindowEnd: "January 25, 2025",
    budgetMin: "15,000",
    budgetMax: "25,000",
    currency: "USD",
    responseDeadline: "January 5, 2025",
  },
  purchaseOrder: {
    poNumber: "PO-2025-001234",
    orderDate: "December 20, 2024",
    requestedDeliveryDate: "January 10, 2025",
    items: "1x Seawater Pump Bearing Kit (Part# SK-450-BRG)\n2x Mechanical Seal Set (Part# MS-450-SEAL)\n1x Impeller Assembly (Part# IMP-450-SS)",
    paymentTerms: "Net 30 days",
  },
};

export const VARIABLE_CATEGORIES: Record<string, string[]> = {
  equipment: ["equipment.name", "equipment.type", "equipment.manufacturer", "equipment.model", "equipment.serialNumber", "equipment.location", "equipment.purchaseDate", "equipment.purchaseValue", "equipment.purchaseCurrency"],
  vessel: ["vessel.name"],
  serviceProvider: ["serviceProvider.name"],
  supplier: ["supplier.name"],
  organization: ["organization.name", "organization.address"],
  serviceOrder: ["serviceOrder.scope", "serviceOrder.serviceDetails", "serviceOrder.specialRequirements", "serviceOrder.scheduledStartDate", "serviceOrder.estimatedDurationHours", "serviceOrder.justification", "serviceOrder.urgency", "serviceOrder.downtimeWindowStart", "serviceOrder.downtimeWindowEnd", "serviceOrder.budgetMin", "serviceOrder.budgetMax", "serviceOrder.currency", "serviceOrder.responseDeadline"],
  purchaseOrder: ["purchaseOrder.poNumber", "purchaseOrder.orderDate", "purchaseOrder.requestedDeliveryDate", "purchaseOrder.items", "purchaseOrder.paymentTerms"],
};

export const CATEGORY_LABELS: Record<string, string> = {
  equipment: "Equipment",
  vessel: "Vessel",
  serviceProvider: "Service Provider",
  supplier: "Supplier",
  organization: "Organization",
  serviceOrder: "Service Order",
  purchaseOrder: "Purchase Order",
};
