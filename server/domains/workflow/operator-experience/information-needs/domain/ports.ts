import type { OperatorRole, OperatorExperienceSignalSnapshot } from "../../domain/types.js";
import type { RoleInformationNeedDefinition } from "./types.js";

export interface RoleInformationNeedCatalogPort {
  listRoles(): OperatorRole[];
  listForRole(role: OperatorRole): RoleInformationNeedDefinition[];
}

export interface RoleInformationSignalPort {
  getSnapshot(orgId: string): Promise<OperatorExperienceSignalSnapshot>;
}
