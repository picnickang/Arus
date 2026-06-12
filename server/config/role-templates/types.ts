export interface RoleTemplateConfig {
  name: string;
  displayName: string;
  description: string;
  department: "bridge" | "engine" | "deck" | "steward" | "admin";
  hierarchyLevel: number;
  permissions: Array<{ resource: string; action: string }>;
  fleetType?: "deep_sea" | "offshore" | "cruise" | "cargo" | "tanker";
}
