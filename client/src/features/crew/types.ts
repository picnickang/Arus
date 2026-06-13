export interface CrewMemberRecord {
  id: string;
  orgId: string;
  name: string;
  rank: string;
  department: string;
  email?: string;
  phone?: string;
  nationality?: string;
  dateOfBirth?: Date;
  hireDate?: Date;
  certifications?: string[];
  skills?: string[];
  // Mirrors crew.status in the DB (CHECK crew_status_valid, migration
  // 0048) and CREW_STATUSES in lib/crewManagementUtils.ts.
  status: "active" | "onboard" | "on_leave" | "standby";
  vesselId?: string;
  hourlyRate?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ShiftTemplate {
  id: string;
  orgId: string;
  name: string;
  startTime: string;
  endTime: string;
  color?: string;
  isDefault?: boolean;
}
