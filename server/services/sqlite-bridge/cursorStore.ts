import Database from "better-sqlite3";
import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Services:SqliteBridge:CursorStore");

export interface CursorState {
  lastId: number;
  lastTs: number;
  updatedAt: number;
}

export class CursorStore {
  private db: Database.Database;
  private getCursorStmt: Database.Statement;
  private advanceCursorStmt: Database.Statement;
  private tableExists: boolean;

  constructor(db: Database.Database) {
    this.db = db;
    this.tableExists = this.ensureTable();

    this.getCursorStmt = db.prepare(
      `SELECT last_id, last_ts, updated_at FROM ingest_cursor WHERE key = 'raw_frames'`
    );

    this.advanceCursorStmt = db.prepare(
      `UPDATE ingest_cursor 
       SET last_id = ?, last_ts = ?, updated_at = ? 
       WHERE key = 'raw_frames' AND last_id < ?`
    );
  }

  private ensureTable(): boolean {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ingest_cursor (
          key TEXT PRIMARY KEY,
          last_id INTEGER NOT NULL,
          last_ts INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        INSERT OR IGNORE INTO ingest_cursor (key, last_id, last_ts, updated_at)
        VALUES ('raw_frames', 0, 0, 0);
      `);
      return true;
    } catch (err) {
      logger.error("[CursorStore] Failed to ensure cursor table:", undefined, err);
      return false;
    }
  }

  hasTable(): boolean {
    return this.tableExists;
  }

  getCursor(): CursorState {
    if (!this.tableExists) {
      return { lastId: 0, lastTs: 0, updatedAt: 0 };
    }

    try {
      const row = this.getCursorStmt.get() as
        | { last_id: number; last_ts: number; updated_at: number }
        | undefined;

      if (!row) {
        return { lastId: 0, lastTs: 0, updatedAt: 0 };
      }

      return {
        lastId: row.last_id,
        lastTs: row.last_ts,
        updatedAt: row.updated_at,
      };
    } catch (err) {
      logger.error("[CursorStore] Failed to get cursor:", undefined, err);
      return { lastId: 0, lastTs: 0, updatedAt: 0 };
    }
  }

  setCursor(lastId: number, lastTs: number): boolean {
    if (!this.tableExists) {
      logger.warn("[CursorStore] Cannot set cursor - table does not exist");
      return false;
    }

    const updatedAt = Date.now();

    try {
      const result = this.advanceCursorStmt.run(lastId, lastTs, updatedAt, lastId);

      if (result.changes === 0) {
        const current = this.getCursor();
        if (current.lastId >= lastId) {
          return true;
        }
        logger.warn(`[CursorStore] Cursor not advanced: current=${current.lastId}, attempted=${lastId}`);
        return false;
      }

      return true;
    } catch (err) {
      logger.error("[CursorStore] Failed to set cursor:", undefined, err);
      return false;
    }
  }
}
