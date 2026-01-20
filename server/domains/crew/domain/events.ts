/**
 * Crew Domain Events
 * Domain events for crew lifecycle and operations
 */

export interface CrewMemberCreated {
  type: "CREW_MEMBER_CREATED";
  crewMemberId: string;
  orgId: string;
  vesselId?: string;
  timestamp: Date;
}

export interface CrewMemberUpdated {
  type: "CREW_MEMBER_UPDATED";
  crewMemberId: string;
  changes: Record<string, unknown>;
  timestamp: Date;
}

export interface CrewMemberDeleted {
  type: "CREW_MEMBER_DELETED";
  crewMemberId: string;
  timestamp: Date;
}

export interface CrewAssigned {
  type: "CREW_ASSIGNED";
  crewMemberId: string;
  vesselId: string;
  assignmentId: string;
  startDate: Date;
  endDate?: Date;
  timestamp: Date;
}

export interface CrewUnassigned {
  type: "CREW_UNASSIGNED";
  crewMemberId: string;
  vesselId: string;
  assignmentId: string;
  timestamp: Date;
}

export interface LeaveRequested {
  type: "LEAVE_REQUESTED";
  crewMemberId: string;
  leaveId: string;
  startDate: Date;
  endDate: Date;
  leaveType: string;
  timestamp: Date;
}

export interface LeaveApproved {
  type: "LEAVE_APPROVED";
  crewMemberId: string;
  leaveId: string;
  approvedBy: string;
  timestamp: Date;
}

export interface CertificationExpiring {
  type: "CERTIFICATION_EXPIRING";
  crewMemberId: string;
  certificationId: string;
  expiryDate: Date;
  daysRemaining: number;
  timestamp: Date;
}

export type CrewDomainEvent =
  | CrewMemberCreated
  | CrewMemberUpdated
  | CrewMemberDeleted
  | CrewAssigned
  | CrewUnassigned
  | LeaveRequested
  | LeaveApproved
  | CertificationExpiring;
