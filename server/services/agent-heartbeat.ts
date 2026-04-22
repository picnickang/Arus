import fs from "fs";
import { logger } from "../utils/logger";

export interface Heartbeat {
  unixTimeMs: number;
  framesWritten: number;
  lastFrameUnixTimeMs: number;
  queueDepth: number;
  serviceVersion: string;
  status: string;
}

export function readHeartbeat(path: string): Heartbeat | null {
  try {
    if (!fs.existsSync(path)) {
      return null;
    }

    const content = fs.readFileSync(path, "utf-8");
    const heartbeat = JSON.parse(content) as Heartbeat;

    if (typeof heartbeat.unixTimeMs !== "number") {
      logger.warn("AgentHeartbeat", "Invalid heartbeat format", { path });
      return null;
    }

    return heartbeat;
  } catch (err) {
    logger.warn("AgentHeartbeat", "Failed to read heartbeat", { path, error: err });
    return null;
  }
}

export function isAgentAlive(heartbeat: Heartbeat | null, maxAgeMs = 5000): boolean {
  if (!heartbeat) {
    return false;
  }

  const now = Date.now();
  const age = now - heartbeat.unixTimeMs;

  return age <= maxAgeMs && heartbeat.status === "running";
}

export function getHeartbeatAge(heartbeat: Heartbeat | null): number | null {
  if (!heartbeat) {
    return null;
  }

  return Date.now() - heartbeat.unixTimeMs;
}
