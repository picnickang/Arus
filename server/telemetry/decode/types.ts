export interface RawFrame {
  id: number;
  ts: number;
  source: string;
  protocol: string;
  payload: Buffer;
  qualityFlags?: number;
  payloadFormatVersion: number;
}

export interface DecodeContext {
  resolveEquipmentId?: (source: string) => string | null;
  defaultEquipmentId?: string;
  nowMs?: () => number;
}

export interface PgnDecodeInput {
  pgn: number;
  sa: number;
  data: Buffer;
  ts: number;
  equipmentId: string;
  source: string;
}
