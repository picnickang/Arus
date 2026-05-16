import type {
  OperatorExperienceEvent,
  OperatorExperienceSignalSnapshot,
  OperatorRole,
  RecordedOperatorExperienceEvent,
  RoleExperienceProfile,
} from "./types.js";

export interface OperatorExperienceSignalsPort {
  getSnapshot(orgId: string): Promise<OperatorExperienceSignalSnapshot>;
}

export interface OperatorRoleProfilePort {
  getProfile(role: OperatorRole): RoleExperienceProfile;
  listProfiles(): RoleExperienceProfile[];
}

export interface OperatorExperienceEventPort {
  record(orgId: string, event: OperatorExperienceEvent): Promise<RecordedOperatorExperienceEvent>;
  listRecent(orgId: string, limit: number): Promise<RecordedOperatorExperienceEvent[]>;
}
