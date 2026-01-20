export interface CustomVariable {
  id: string;
  orgId: string;
  name: string;
  value: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

export type TemplateKey = "service_order" | "replacement_quote" | "purchase_order";

export type TemplateField = "subject" | "body";
