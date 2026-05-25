export interface SchedulingConstraint {
  type:
    | "rest_hours"
    | "max_weekly"
    | "leave"
    | "certification"
    | "vessel_match"
    | "skill_match"
    | "overlap";
  enforcement: "hard" | "soft";
  threshold?: number;
  description: string;
}

export interface ConstraintViolation {
  constraint: SchedulingConstraint;
  crewId: string;
  crewName?: string | undefined;
  date: string;
  description: string;
  severity: "error" | "warning";
  details?: Record<string, unknown> | undefined;
}

export interface CrewAvailability {
  crewId: string;
  crewName: string;
  rank?: string;
  vesselId?: string;
  isAvailable: boolean;
  unavailabilityReason?: string;
  currentHoursThisWeek: number;
  maxWeeklyHours: number;
  lastShiftEnd?: Date;
  certExpiryWarnings?: string[];
  fatigueRisk: "low" | "medium" | "high";
}

export interface CrewSuggestion {
  crewId: string;
  crewName: string;
  rank?: string | undefined;
  avatarUrl?: string | undefined;
  score: number;
  availability: "available" | "soft_conflict" | "hard_conflict" | "on_leave" | "requires_cert";
  availabilityTag: string;
  reasons: string[];
  constraints: ConstraintViolation[];
}

export interface AssignmentDetails {
  id?: string;
  crewId: string;
  crewName: string;
  vesselId: string;
  vesselName?: string;
  shiftId: string;
  shiftName?: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  role?: string;
  status: "draft" | "published" | "confirmed";
  constraints: ConstraintViolation[];
  suggestions: CrewSuggestion[];
}

export interface SchedulingPreferences {
  weights: {
    fairness: number;
    continuity: number;
    fatiguePenalty: number;
    certExpiryProximity: number;
  };
  rules: {
    maxOnboardDays: number;
    minRestHours: number;
    certExpiryWarningDays: number;
    overlapBufferHours: number;
  };
  ruleEnforcement: {
    maxOnboardDays: "hard" | "soft";
    minRestHours: "hard" | "soft";
    certExpiryWarning: "hard" | "soft";
    overlapBuffer: "hard" | "soft";
  };
}

export interface RotationTemplate {
  id: string;
  name: string;
  daysOn: number;
  daysOff: number;
  isDefault: boolean;
  vesselId?: string;
  rankFilter?: string[];
}

export interface NotificationSettings {
  assignmentCreated: "crew" | "admin" | "both" | "none";
  assignmentUpdated: "crew" | "admin" | "both" | "none";
  assignmentCancelled: "crew" | "admin" | "both" | "none";
  schedulePublished: "crew" | "admin" | "both" | "none";
  complianceWarning: "crew" | "admin" | "both" | "none";
  restHoursViolation: "crew" | "admin" | "both" | "none";
}

export interface PublishBehavior {
  whoCanPublish: "admins_only" | "supervisors" | "anyone";
  allowCrewToSeeDrafts: boolean;
  autoEmailOnPublish: boolean;
  lockScheduleAfterPublish: boolean;
}

export interface SchedulingSettings {
  id: string;
  orgId: string;
  vesselId?: string;
  notificationSettings: NotificationSettings;
  preferences: SchedulingPreferences;
  rotationTemplates: RotationTemplate[];
  publishBehavior: PublishBehavior;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  assignmentCreated: "both",
  assignmentUpdated: "admin",
  assignmentCancelled: "both",
  schedulePublished: "both",
  complianceWarning: "admin",
  restHoursViolation: "both",
};

export const DEFAULT_SCHEDULING_PREFERENCES: SchedulingPreferences = {
  weights: {
    fairness: 50,
    continuity: 50,
    fatiguePenalty: 50,
    certExpiryProximity: 50,
  },
  rules: {
    maxOnboardDays: 28,
    minRestHours: 10,
    certExpiryWarningDays: 30,
    overlapBufferHours: 4,
  },
  ruleEnforcement: {
    maxOnboardDays: "hard",
    minRestHours: "soft",
    certExpiryWarning: "soft",
    overlapBuffer: "hard",
  },
};

export const DEFAULT_ROTATION_TEMPLATES: RotationTemplate[] = [
  { id: "28-28", name: "28/28 Rotation", daysOn: 28, daysOff: 28, isDefault: true },
  { id: "35-35", name: "35/35 Rotation", daysOn: 35, daysOff: 35, isDefault: false },
];

export const DEFAULT_PUBLISH_BEHAVIOR: PublishBehavior = {
  whoCanPublish: "admins_only",
  allowCrewToSeeDrafts: false,
  autoEmailOnPublish: false,
  lockScheduleAfterPublish: true,
};
