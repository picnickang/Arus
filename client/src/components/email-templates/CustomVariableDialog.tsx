import type { CustomVariable } from "./types";

interface CustomVariableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variable?: CustomVariable | null;
  onSave: (variable: Partial<CustomVariable>) => void;
}

export function CustomVariableDialog({ open, onOpenChange, variable, onSave }: CustomVariableDialogProps) {
  if (!open) return null;
  return null;
}
