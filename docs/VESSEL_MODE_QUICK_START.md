# 🚀 ARUS Vessel Mode - Quick Start Guide

## Overview

ARUS now supports **dual-mode deployment**:
- **Cloud Mode**: Full features for shore offices (PostgreSQL)
- **Vessel Mode**: Core operations for offline vessels (SQLite)

## Quick Setup

### Option 1: Cloud Mode (Default)
No configuration needed. Uses PostgreSQL via DATABASE_URL.

```bash
npm run dev
```

### Option 2: Vessel Mode (Offline-First)

1. **Set environment variable**:
```bash
export LOCAL_MODE=true
```

2. **Optional: Enable cloud sync** (recommended):
```bash
export TURSO_SYNC_URL=your_turso_url
export TURSO_AUTH_TOKEN=your_auth_token
```

3. **Start the application**:
```bash
npm run dev
```

The system will automatically:
- ✅ Create `data/vessel-local.db` SQLite database
- ✅ Initialize 9 core operational tables
- ✅ Set up auto-sync (if configured)

## What's Included in Vessel Mode

### Tables (9)
- Organizations, Users (auth/config)
- Sync Journal, Sync Outbox (synchronization)
- Vessels, Equipment, Devices (operations)
- Equipment Telemetry, Downtime Events (monitoring)

### Features
- ✅ Fleet management
- ✅ Equipment tracking
- ✅ Real-time telemetry
- ✅ Downtime logging
- ✅ Offline operation
- ✅ Auto-sync (60s interval when online)

## Verify Installation

Check vessel mode status:
```bash
ls -lh data/vessel-local.db  # Should show database file
```

## Need More Features?

The current vessel mode includes 9 core tables. To add more:

1. Identify table in `shared/schema.ts`
2. Convert to SQLite in `shared/schema-sqlite-vessel.ts`
3. Update `server/sqlite-init.ts`
4. Test and deploy

See `docs/VESSEL_MODE_REVIEW.md` for full details.

## Troubleshooting

**Database not created?**
- Check `LOCAL_MODE=true` is set
- Ensure `data/` directory is writable

**Sync not working?**
- Verify `TURSO_SYNC_URL` and `TURSO_AUTH_TOKEN`
- Check network connectivity
- Review logs for sync errors

**Missing features?**
- Current vessel mode: 9 tables (core operations)
- Remaining features: 176 tables (to be migrated)
- Cloud mode: All features available

## Support

- Full documentation: `docs/VESSEL_MODE_REVIEW.md`
- Architecture details: `replit.md`
- Type conversions: `shared/schema-sqlite-*.ts`
