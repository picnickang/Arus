import type { ProjectionViolation } from "@/features/crew/hooks/useHoRSync";

export interface DragCompliancePreview {
  canAssign: boolean;
  violations: ProjectionViolation[];
  projectedRestHours: number;
  isLoading: boolean;
}
