import type { TelemetryBatchReading } from "../../telemetry-batch-writer";
import type { RawFrame, DecodeContext } from "./types";
import { readU32LE, clamp, extractPgn, extractSa } from "./util";
import { decodePgn } from "./registry";

const CURRENT_PAYLOAD_VERSION = 1;

export function decodeJ1939(frame: RawFrame, ctx: DecodeContext = {}): TelemetryBatchReading[] {
  if (frame.payloadFormatVersion !== CURRENT_PAYLOAD_VERSION) {
    return [];
  }

  const buf = frame.payload;
  if (buf.length < 6) {
    return [];
  }

  const canId = readU32LE(buf, 0);
  const dlc = buf.readUInt8(4);
  const data = buf.subarray(5, 5 + clamp(dlc, 0, 8));

  if (data.length === 0) {
    return [];
  }

  const pgn = extractPgn(canId);
  const sa = extractSa(canId);

  const equipmentId = ctx.resolveEquipmentId?.(frame.source) ?? ctx.defaultEquipmentId ?? "unknown";

  return decodePgn({
    pgn,
    sa,
    data,
    ts: frame.ts,
    equipmentId,
    source: frame.source,
  });
}
