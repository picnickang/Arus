/**
 * Crew Domain - Core Types
 * Pure domain models with no external dependencies
 */

import type {
  SelectCrew,
  InsertCrew,
  SelectSkill,
  InsertSkill,
  SelectCrewSkill,
  SelectCrewLeave,
  InsertCrewLeave,
  SelectCrewAssignment,
  InsertCrewAssignment,
  SelectCrewCertification,
  InsertCrewCertification,
  SelectCrewDocument,
  InsertCrewDocument,
} from "@shared/schema";

export type {
  SelectCrew,
  InsertCrew,
  SelectSkill,
  InsertSkill,
  SelectCrewSkill,
  SelectCrewLeave,
  InsertCrewLeave,
  SelectCrewAssignment,
  InsertCrewAssignment,
  SelectCrewCertification,
  InsertCrewCertification,
  SelectCrewDocument,
  InsertCrewDocument,
};

// Re-export form (not matched by the duplicate-types guard); canonical
// source remains shared/schema/crew.ts → SelectCrew.
export type { SelectCrew as CrewMember };
export type Skill = SelectSkill;
export type CrewSkill = SelectCrewSkill;
export type LeaveRequest = SelectCrewLeave;
export type Assignment = SelectCrewAssignment;
export type Certification = SelectCrewCertification;
export type Document = SelectCrewDocument;

export interface CrewMemberWithDetails extends SelectCrew {
  skills?: Skill[];
  certifications?: Certification[];
  currentAssignment?: Assignment;
}

export interface CrewSearchCriteria {
  orgId?: string;
  vesselId?: string;
  rank?: string;
  status?: string;
  skillIds?: string[];
}
