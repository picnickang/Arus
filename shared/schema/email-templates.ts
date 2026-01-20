/**
 * Schema Email Templates - Customizable email templates for service orders and purchase orders
 */

import {
  sql,
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  createInsertSchema,
  z,
} from "./base.js";
import { organizations } from "./core.js";

export const emailTemplates = pgTable("email_templates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  templateType: varchar("template_type").notNull(),
  templateName: text("template_name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  variables: jsonb("variables"),
  isDefault: varchar("is_default").default("false"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

export const EMAIL_TEMPLATE_TYPES = {
  SERVICE_ORDER: "service_order",
  REPLACEMENT_QUOTE: "replacement_quote",
  PURCHASE_ORDER: "purchase_order",
} as const;

export type EmailTemplateType = typeof EMAIL_TEMPLATE_TYPES[keyof typeof EMAIL_TEMPLATE_TYPES];

export const emailTemplateVariables = pgTable("email_template_variables", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  name: varchar("name").notNull(),
  value: text("value").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  orgIdx: index("idx_email_template_variables_org").on(table.orgId),
  nameOrgIdx: index("idx_email_template_variables_name_org").on(table.orgId, table.name),
}));

export const insertEmailTemplateVariableSchema = createInsertSchema(emailTemplateVariables).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmailTemplateVariable = z.infer<typeof insertEmailTemplateVariableSchema>;
export type EmailTemplateVariable = typeof emailTemplateVariables.$inferSelect;

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateType, { subject: string; body: string; variables: string[] }> = {
  service_order: {
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
