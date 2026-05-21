import type { TelemetryBatchReading } from "../../telemetry-batch-writer";
import type { RawFrame, DecodeContext } from "./types";
import { decodeJ1939 } from "./j1939";
import { decodeJ1587 } from "./j1587";

export function decodeFrame(frame: RawFrame, ctx: DecodeContext = {}): TelemetryBatchReading[] {
  const protocol = (frame.protocol || "").toUpperCase();

  if (protocol === "J1939") {
    return decodeJ1939(frame, ctx);
  }

  if (protocol === "J1587" || protocol === "J1708") {
    return decodeJ1587(frame, ctx);
  }

  return [];
}

export type { RawFrame, DecodeContext, PgnDecodeInput } from "./types";
export { validateReading, filterValidReadings } from "./validation";
export { registerPgn, decodePgn, hasPgnDecoder, getRegisteredPgns } from "./registry";
export { decodeJ1939 } from "./j1939";
export { decodeJ1587 } from "./j1587";
export { extractPgn, extractSa, readU32LE, readU16LE, readU8, clamp } from "./util";
