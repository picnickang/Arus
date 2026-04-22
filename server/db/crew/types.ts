/**
 * Crew - Types
 */

export type {
  Crew,
  InsertCrew,
  CrewAssignment,
  InsertCrewAssignment,
  CrewCertification,
  InsertCrewCertification,
  CrewLeave,
  InsertCrewLeave,
} from "@shared/schema-runtime";

export interface CrewFilters {
  vesselId?: string;
  rank?: string;
  status?: string;
  departmentId?: string;
}
export interface CrewAssignmentFilters {
  crewId?: string;
  vesselId?: string;
  startDate?: Date;
  endDate?: Date;
}
