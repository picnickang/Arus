import type { CustomVariable } from "./types";

interface VariablePanelProps {
  variables: CustomVariable[];
  onInsert?: (variableName: string) => void;
}

export function VariablePanel({ variables, onInsert }: VariablePanelProps) {
  return null;
}
