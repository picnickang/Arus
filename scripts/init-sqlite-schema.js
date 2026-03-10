#!/usr/bin/env node
/**
 * Initialize SQLite Database Schema
 * Creates a minimal seed database using Node.js (no sqlite3 CLI required)
 */

import { createClient } from '@libsql/client';
import { existsSync, unlinkSync } from 'node:fs';

const DB_PATH = process.env.DATABASE_PATH || 'data/vessel-local.db';

console.log(`  Initializing database at: ${DB_PATH}`);

try {
  // Create the database file
  const client = createClient({
    url: `file:${DB_PATH}`
  });

  // Initialize with minimal schema
  await client.execute(`
    -- Enable foreign keys and WAL mode for better performance
    PRAGMA foreign_keys = ON;
  `);

  await client.execute(`
    PRAGMA journal_mode = WAL;
  `);

  await client.execute(`
    PRAGMA synchronous = NORMAL;
  `);

  // Create a version marker
  await client.execute(`
    CREATE TABLE IF NOT EXISTS _schema_version (
      version TEXT PRIMARY KEY,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  await client.execute(`
    INSERT OR REPLACE INTO _schema_version (version) VALUES ('1.0.0-embedded');
  `);

  console.log('  Creating critical system tables for embedded mode...');

  // Create organizations table (required for multi-tenancy)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  // Insert default organization for embedded mode
  await client.execute(`
    INSERT OR IGNORE INTO organizations (id, name) VALUES ('default-org-id', 'Default Organization');
  `);

  // Create update_settings table (required for update scheduler)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS update_settings (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      org_id TEXT NOT NULL REFERENCES organizations(id),
      vessel_id TEXT,
      auto_update_enabled INTEGER DEFAULT 0,
      auto_update_critical_only INTEGER DEFAULT 1,
      update_check_interval INTEGER DEFAULT 21600,
      update_window_start TEXT,
      update_window_end TEXT,
      deferred_update_deadline INTEGER,
      last_check_at INTEGER,
      last_update_at INTEGER,
      current_version TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  // Insert default update settings for default organization
  await client.execute(`
    INSERT OR IGNORE INTO update_settings (org_id, auto_update_enabled) 
    VALUES ('default-org-id', 0);
  `);

  // Create admin_sessions table (required for admin mode)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      org_id TEXT NOT NULL REFERENCES organizations(id),
      session_token TEXT NOT NULL UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      expires_at INTEGER NOT NULL,
      last_activity_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  // Create admin_audit_events table (required for admin audit logging)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS admin_audit_events (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      org_id TEXT NOT NULL REFERENCES organizations(id),
      user_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details TEXT DEFAULT '{}',
      ip_address TEXT,
      user_agent TEXT,
      outcome TEXT DEFAULT 'success',
      error_message TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  // Create admin_system_settings table (required for admin settings management)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS admin_system_settings (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      org_id TEXT NOT NULL REFERENCES organizations(id),
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      data_type TEXT DEFAULT 'string',
      description TEXT,
      is_sensitive INTEGER DEFAULT 0,
      last_modified_by TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      UNIQUE(org_id, category, key)
    );
  `);

  // Create indexes for performance
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_update_settings_org ON update_settings(org_id);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_admin_sessions_org ON admin_sessions(org_id);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_admin_audit_org ON admin_audit_events(org_id);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_admin_settings_org_cat ON admin_system_settings(org_id, category);`);

  // Close the connection
  client.close();

  console.log('  ✓ Core schema created with critical tables');
  console.log('  ✓ Default organization configured');
  console.log('  ℹ️  Additional tables will be created on first application start');
  process.exit(0);

} catch (error) {
  console.error('  ❌ Database initialization failed:', error.message);
  process.exit(1);
}
