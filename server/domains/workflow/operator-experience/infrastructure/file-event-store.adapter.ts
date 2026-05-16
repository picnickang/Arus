import { randomUUID } from "node:crypto";
import { mkdir, readFile, appendFile } from "node:fs/promises";
import path from "node:path";
import type { OperatorExperienceEventPort } from "../domain/ports.js";
import type { OperatorExperienceEvent, RecordedOperatorExperienceEvent } from "../domain/types.js";

const DATA_DIR = process.env.ARUS_OPERATOR_EXPERIENCE_DATA_DIR || path.resolve(process.cwd(), "data", "operator-experience");
const EVENTS_FILE = path.join(DATA_DIR, "events.jsonl");

export class FileOperatorExperienceEventStore implements OperatorExperienceEventPort {
  async record(orgId: string, event: OperatorExperienceEvent): Promise<RecordedOperatorExperienceEvent> {
    await mkdir(DATA_DIR, { recursive: true });
    const record: RecordedOperatorExperienceEvent = {
      ...event,
      id: randomUUID(),
      orgId,
      occurredAt: event.occurredAt ?? new Date().toISOString(),
    };
    await appendFile(EVENTS_FILE, JSON.stringify(record) + "\n", "utf8");
    return record;
  }

  async listRecent(orgId: string, limit: number): Promise<RecordedOperatorExperienceEvent[]> {
    try {
      const raw = await readFile(EVENTS_FILE, "utf8");
      return raw
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as RecordedOperatorExperienceEvent)
        .filter((record) => record.orgId === orgId)
        .slice(-Math.max(1, Math.min(limit, 200)))
        .reverse();
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }
}
