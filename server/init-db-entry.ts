import { createClient } from '@libsql/client';
import { mkdirSync }    from 'node:fs';
import { dirname }      from 'node:path';

export async function initDb(dbPath?: string): Promise<void> {
  const path = dbPath
    ?? process.env.DATABASE_PATH
    ?? 'data/vessel-local.db';

  console.log(`[ARUS] Initialising database: ${path}`);
  mkdirSync(dirname(path), { recursive: true });

  const client = createClient({ url: `file:${path}` });

  try {
    await client.execute('PRAGMA foreign_keys = ON');
    await client.execute('PRAGMA journal_mode = WAL');
    await client.execute('PRAGMA synchronous   = NORMAL');

    await client.execute(`
      CREATE TABLE IF NOT EXISTS _schema_version (
        version    TEXT PRIMARY KEY,
        created_at INTEGER DEFAULT (strftime('%s','now'))
      )
    `);
    await client.execute(
      `INSERT OR IGNORE INTO _schema_version (version) VALUES ('1.0.0-embedded')`
    );

    await client.execute(`
      CREATE TABLE IF NOT EXISTS organizations (
        id         TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name       TEXT    NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s','now')),
        updated_at INTEGER DEFAULT (strftime('%s','now'))
      )
    `);
    await client.execute(
      `INSERT OR IGNORE INTO organizations (id, name) VALUES ('default-org-id','Default Organization')`
    );

    await client.execute(`
      CREATE TABLE IF NOT EXISTS update_settings (
        id                        TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        org_id                    TEXT    NOT NULL REFERENCES organizations(id),
        vessel_id                 TEXT,
        auto_update_enabled       INTEGER DEFAULT 0,
        auto_update_critical_only INTEGER DEFAULT 1,
        update_check_interval     INTEGER DEFAULT 21600,
        update_window_start       TEXT,
        update_window_end         TEXT,
        deferred_update_deadline  INTEGER,
        last_check_at             INTEGER,
        last_update_at            INTEGER,
        current_version           TEXT,
        created_at                INTEGER DEFAULT (strftime('%s','now')),
        updated_at                INTEGER DEFAULT (strftime('%s','now'))
      )
    `);
    await client.execute(
      `INSERT OR IGNORE INTO update_settings (org_id, auto_update_enabled)
       VALUES ('default-org-id', 0)`
    );

    await client.execute(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id               TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        org_id           TEXT    NOT NULL REFERENCES organizations(id),
        session_token    TEXT    NOT NULL UNIQUE,
        user_id          TEXT,
        admin_email      TEXT,
        ip_address       TEXT,
        user_agent       TEXT,
        created_at       INTEGER DEFAULT (strftime('%s','now')),
        expires_at       INTEGER NOT NULL,
        last_activity_at INTEGER DEFAULT (strftime('%s','now'))
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS admin_audit_events (
        id            TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        org_id        TEXT    NOT NULL REFERENCES organizations(id),
        user_id       TEXT,
        action        TEXT    NOT NULL,
        resource_type TEXT    NOT NULL,
        resource_id   TEXT,
        details       TEXT    DEFAULT '{}',
        ip_address    TEXT,
        user_agent    TEXT,
        outcome       TEXT    DEFAULT 'success',
        error_message TEXT,
        created_at    INTEGER DEFAULT (strftime('%s','now'))
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS admin_system_settings (
        id               TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        org_id           TEXT    NOT NULL REFERENCES organizations(id),
        category         TEXT    NOT NULL,
        key              TEXT    NOT NULL,
        value            TEXT    NOT NULL,
        data_type        TEXT    DEFAULT 'string',
        description      TEXT,
        is_sensitive     INTEGER DEFAULT 0,
        last_modified_by TEXT,
        created_at       INTEGER DEFAULT (strftime('%s','now')),
        updated_at       INTEGER DEFAULT (strftime('%s','now')),
        UNIQUE(org_id, category, key)
      )
    `);

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_update_settings_org     ON update_settings(org_id)',
      'CREATE INDEX IF NOT EXISTS idx_admin_sessions_org      ON admin_sessions(org_id)',
      'CREATE INDEX IF NOT EXISTS idx_admin_sessions_token    ON admin_sessions(session_token)',
      'CREATE INDEX IF NOT EXISTS idx_admin_audit_org         ON admin_audit_events(org_id)',
      'CREATE INDEX IF NOT EXISTS idx_admin_settings_org_cat ON admin_system_settings(org_id, category)',
    ];
    for (const sql of indexes) {await client.execute(sql);}

    console.log('[ARUS] Database initialised successfully.');
  } finally {
    client.close();
  }
}

