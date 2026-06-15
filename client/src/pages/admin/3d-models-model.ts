export interface ModelEquipmentPin {
  equipmentId: string;
  x: number;
  y: number;
  z: number;
  label?: string;
}

export interface ModelMetadata {
  id: string;
  orgId: string;
  vesselId: string;
  filename: string;
  mimetype: string;
  sizeBytes: number;
  equipmentPins: ModelEquipmentPin[];
  createdAt: string | null;
  updatedAt: string | null;
}

export type PlacementArm = { mode: "add" } | { mode: "move"; targetIdx: number } | null;

export function formatBytes(n: number): string {
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function isForbiddenError(error: Error | null | undefined): boolean {
  return !!error && (/^403:/.test(error.message) || /forbidden/i.test(error.message));
}
