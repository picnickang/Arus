/**
 * Default Role Templates - Maritime Crew Hierarchies
 *
 * Pre-configured permission sets for common maritime positions.
 * Organizations can use these as starting points.
 */

import { ADMIN_ROLE_TEMPLATES } from "./role-templates/admin";
import { BRIDGE_ROLE_TEMPLATES } from "./role-templates/bridge";
import { OPERATIONS_ROLE_TEMPLATES } from "./role-templates/operations";
import type { RoleTemplateConfig } from "./role-templates/types";

export type { RoleTemplateConfig } from "./role-templates/types";

export const DEFAULT_ROLE_TEMPLATES: RoleTemplateConfig[] = [
  ...ADMIN_ROLE_TEMPLATES,
  ...BRIDGE_ROLE_TEMPLATES,
  ...OPERATIONS_ROLE_TEMPLATES,
];

export function getTemplateByName(name: string): RoleTemplateConfig | undefined {
  return DEFAULT_ROLE_TEMPLATES.find((t) => t.name === name);
}

export function getTemplatesByDepartment(
  department: RoleTemplateConfig["department"]
): RoleTemplateConfig[] {
  return DEFAULT_ROLE_TEMPLATES.filter((t) => t.department === department);
}
