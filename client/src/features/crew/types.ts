export interface CrewMember {
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
  status: "active" | "on_leave" | "off_duty" | "inactive";
  vesselId?: string;
  hourlyRate?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CrewCertification {
  id: string;
  crewId: string;
  certificationType: string;
  certificateName: string;
  issueDate: Date;
  expiryDate: Date;
  issuingAuthority?: string;
  certificateNumber?: string;
  status: "valid" | "expiring" | "expired";
}

export interface CrewLeave {
  id: string;
  crewId: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason?: string;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface CrewAssignment {
  id: string;
  crewId: string;
  vesselId: string;
  shiftId?: string;
  assignmentDate: Date;
  role?: string;
  startTime?: string;
  endTime?: string;
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

export interface CrewRestSheet {
  id: string;
  crewId: string;
  month: string;
  vesselId: string;
  status: "draft" | "submitted" | "approved";
  totalRestHours?: number;
  complianceStatus?: "compliant" | "non_compliant" | "pending";
}

export interface CrewRestDay {
  id: string;
  sheetId: string;
  date: string;
  restPeriods: RestPeriod[];
  totalRestHours?: number;
  isCompliant?: boolean;
  remarks?: string;
}

export interface RestPeriod {
  startHour: number;
  endHour: number;
  isRest: boolean;
}

export const DEPARTMENTS = ["Deck", "Engine", "Catering", "Radio", "Medical"] as const;

export const RANKS = {
  Deck: [
    "Master",
    "Chief Officer",
    "Second Officer",
    "Third Officer",
    "Bosun",
    "Able Seaman",
    "Ordinary Seaman",
    "Deck Cadet",
  ],
  Engine: [
    "Chief Engineer",
    "Second Engineer",
    "Third Engineer",
    "Fourth Engineer",
    "Electrical Officer",
    "Motorman",
    "Oiler",
    "Fitter",
    "Engine Cadet",
  ],
  Catering: ["Chief Cook", "Second Cook", "Steward", "Messman"],
  Radio: ["Radio Officer"],
  Medical: ["Ship's Doctor", "Nurse"],
} as const;

export const LEAVE_TYPES = [
  "Annual Leave",
  "Sick Leave",
  "Compassionate Leave",
  "Training Leave",
  "Shore Leave",
] as const;

export type Department = (typeof DEPARTMENTS)[number];
