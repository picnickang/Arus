import Database from "better-sqlite3";
import type { RawFrame } from "../../telemetry/decode/types";

export interface RawFrameRow {
  id: number;
  unix_time_ms: number;
  source: string;
  protocol: string;
  payload: Buffer;
  quality_flags: number;
  payload_format_version: number;
}

export class SqliteRawFrameSource {
  private db: Database.Database;
  private fetchBatchStmt: Database.Statement;
  private getMaxIdStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;

    this.fetchBatchStmt = db.prepare(`
      SELECT id, unix_time_ms, source, protocol, payload, quality_flags, payload_format_version
      FROM raw_frames
      WHERE id > ?
      ORDER BY id
      LIMIT ?
    `);

    this.getMaxIdStmt = db.prepare(`
      SELECT MAX(id) as max_id FROM raw_frames
    `);
  }

  fetchBatch(afterId: number, limit: number): RawFrame[] {
    const rows = this.fetchBatchStmt.all(afterId, limit) as RawFrameRow[];

    return rows.map((row) => ({
      id: row.id,
      ts: row.unix_time_ms,
      source: row.source,
      protocol: row.protocol,
      payload: Buffer.from(row.payload),
      qualityFlags: row.quality_flags,
      payloadFormatVersion: row.payload_format_version,
    }));
  }

  getMaxId(): number {
    const row = this.getMaxIdStmt.get() as { max_id: number | null };
    return row?.max_id ?? 0;
  }

  getLagFrames(cursorLastId: number): number {
    const maxId = this.getMaxId();
    return Math.max(0, maxId - cursorLastId);
  }
}
