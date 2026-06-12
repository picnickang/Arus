export interface ResourceDefinition {
  code: string;
  name: string;
  description: string;
  category: ResourceCategory;
  icon?: string;
  actions: ActionCode[];
  sortOrder: number;
}

export interface ActionDefinition {
  code: string;
  name: string;
  description: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  sortOrder: number;
}

export type ResourceCategory =
  | "operations"
  | "maintenance"
  | "crew"
  | "inventory"
  | "analytics"
  | "compliance"
  | "settings";

export type ActionCode =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "export"
  | "approve"
  | "assign"
  | "complete"
  | "manage_parts"
  | "manage_config"
  | "manage"
  | "trigger"
  | "clear"
  | "acknowledge"
  | "sign_off"
  | "override"
  | "configure"
  | "upload-diagram"
  | "publish-map"
  | "rollback-diagram"
  | "edit-section-map"
  | "replace-section-thumbnail"
  | "replace-equipment-thumbnail"
  | "assign-equipment"
  | "create-work-order"
  | "create-expert-case";
