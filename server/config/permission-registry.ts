/**
 * Permission Registry - Centralized Resource and Action Definitions
 *
 * Single source of truth for all resources and actions in the application.
 * Add new pages/features here to make them available for permission management.
 */

import { ACTIONS } from "./permission-registry-parts/actions";
import { RESOURCES } from "./permission-registry-parts/resources";
import type { ActionDefinition, ResourceDefinition } from "./permission-registry-parts/types";

export { ACTIONS } from "./permission-registry-parts/actions";
export { RESOURCES, RESOURCE_CATEGORIES } from "./permission-registry-parts/resources";
export type { ActionCode } from "./permission-registry-parts/types";

export function getResourceByCode(code: string): ResourceDefinition | undefined {
  return RESOURCES.find((r) => r.code === code);
}

export function getAllActions(): ActionDefinition[] {
  return Object.values(ACTIONS).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getActionsForResource(resourceCode: string): ActionDefinition[] {
  const resource = getResourceByCode(resourceCode);
  if (!resource) {
    return [];
  }
  return resource.actions.map((actionCode) => ACTIONS[actionCode]);
}
