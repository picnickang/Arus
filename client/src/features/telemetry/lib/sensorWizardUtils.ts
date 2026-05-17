import type { Equipment } from "@shared/schema";

export type WizardStep = 1 | 2 | 3;

export interface WizardState {
  currentStep: WizardStep;
  selectedBundleId?: string;
  customSensorSelections?: string[];
  thresholds?: Record<
    string,
    { warnHi?: number; warnLo?: number; critHi?: number; critLo?: number }
  >;
}

export interface SensorSetupWizardProps {
  equipment: Pick<Equipment, "id" | "name" | "type" | "location"> & { status?: string };
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function createInitialWizardState(): WizardState {
  return {
    currentStep: 1,
  };
}

export function calculateProgress(step: WizardStep): number {
  return (step / 3) * 100;
}

export function getStepTitle(step: WizardStep): string {
  switch (step) {
    case 1:
      return "Equipment Confirmation";
    case 2:
      return "Bundle Selection";
    case 3:
      return "Threshold Tuning";
    default:
      return "";
  }
}

export function getStepDescription(step: WizardStep): string {
  switch (step) {
    case 1:
      return "Verify equipment details and sensor count";
    case 2:
      return "Choose sensor bundle or manual configuration";
    case 3:
      return "Configure warning and critical thresholds";
    default:
      return "";
  }
}

export function canNavigateToNextStep(state: WizardState): boolean {
  switch (state.currentStep) {
    case 1:
      return true;
    case 2:
      return !!state.selectedBundleId || (state.customSensorSelections?.length ?? 0) > 0;
    case 3:
      return true;
    default:
      return false;
  }
}

export function getThresholdValidationError(
  warnLo: number | undefined,
  warnHi: number | undefined,
  critLo: number | undefined,
  critHi: number | undefined
): string | null {
  if (critLo !== undefined && warnLo !== undefined && critLo >= warnLo) {
    return "Critical low must be less than warning low";
  }

  if (warnLo !== undefined && warnHi !== undefined && warnLo >= warnHi) {
    return "Warning low must be less than warning high";
  }

  if (warnHi !== undefined && critHi !== undefined && warnHi >= critHi) {
    return "Warning high must be less than critical high";
  }
  return null;
}
