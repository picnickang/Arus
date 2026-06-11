# ARUS Vessel Deployment Playbook

## Overview

This document covers deploying ARUS on a vessel running alongside SHIPMATE.
ARUS is the AI/analytics layer; SHIPMATE remains the system of record for PMS, stores, and crew.

**Target deployment:** ARUS Tauri desktop app on vessel bridge/engine room laptop,
connecting to the ARUS Express backend running as a Windows Service on the vessel server.

**Time estimate:** 4-6 hours per vessel for initial deployment.

---

## Pre-Deployment Checklist

### Shore Office (1-2 days before vessel visit)

- [ ] Vessel created in ARUS cloud instance (name, IMO number, flag state, class society)
- [ ] Equipment register exported from SHIPMATE PMS (CSV)
- [ ] Job history exported from SHIPMATE PMS (last 2 years minimum)
- [ ] Spare parts/ROB exported from SHIPMATE SPS
- [ ] SHIPMATE data imported into ARUS via `/api/import/shipmate` endpoints
- [ ] Vessel user accounts created (Chief Engineer, 2nd Engineer, Deck Officers)
- [ ] Tauri installer (.msi) copied to USB drive
- [ ] SQLite seed database generated from cloud PostgreSQL for this vessel
- [ ] SSL certificates generated for vessel backend (self-signed is acceptable)

### Vessel Hardware Requirements

- [ ] Laptop/tablet: Windows 10/11, 8GB RAM minimum, SSD
- [ ] Network: Vessel LAN connectivity to SHIPMATE server (if direct DB integration)
- [ ] Optional: VSAT/satellite modem access for cloud sync
- [ ] EFMS (Electronic Fuel Monitoring System) data feed accessible (Modbus TCP or serial)

---

## Deployment Steps

### Step 1: Install ARUS Backend (Windows Service)

The backend runs as a Windows Service via NSSM, started automatically on boot.

```powershell
# Run as Administrator

# 1. Copy backend files from USB
xcopy /E /I "E:\arus-backend" "C:\ARUS\backend"

# 2. Install Node.js (if not present)
# Download from https://nodejs.org/en/download/ — LTS version
# Or use the bundled installer on the USB drive

# 3. Install dependencies
cd C:\ARUS\backend
npm ci --production

# 4. Configure environment
copy .env.example .env
notepad .env
```

Edit `.env` with vessel-specific values:

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=file:./data/arus-vessel.db
DATABASE_PROVIDER=sqlite

# Cloud sync (when satellite is available)
CLOUD_API_URL=https://cloud.arus.io/api
CLOUD_SYNC_ENABLED=true
SYNC_INTERVAL_MS=300000

# SHIPMATE integration (if direct DB access)
SHIPMATE_DB_HOST=192.168.1.100
SHIPMATE_DB_PORT=1433
SHIPMATE_DB_NAME=SHIPMATE
# Leave blank if using CSV import instead of direct DB
SHIPMATE_DB_USER=
SHIPMATE_DB_PASSWORD=

# Telemetry
TELEMETRY_HMAC_KEY=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

# AI (optional — works without, degrades to statistical fallback)
OPENAI_API_KEY=
```

```powershell
# 5. Initialize the database
node scripts/init-sqlite-schema.js

# 6. Seed with vessel data from cloud
node scripts/seed-vessel-data.js --vessel-id=<VESSEL_ID>

# 7. Install as Windows Service
nssm install ARUSBackend "C:\Program Files\nodejs\node.exe"
nssm set ARUSBackend AppDirectory "C:\ARUS\backend"
nssm set ARUSBackend AppParameters "dist/server/index.js"
nssm set ARUSBackend AppStdout "C:\ARUS\logs\backend-stdout.log"
nssm set ARUSBackend AppStderr "C:\ARUS\logs\backend-stderr.log"
nssm set ARUSBackend AppRotateFiles 1
nssm set ARUSBackend AppRotateBytes 10485760
nssm start ARUSBackend

# 8. Verify
curl http://localhost:5000/api/healthz
# Should return: {"status":"ok","database":"connected","version":"..."}
```

### Step 2: Install ARUS Desktop App (Tauri)

```powershell
# Run the MSI installer from USB drive
msiexec /i "E:\ARUS-Setup-1.0.0.msi"

# Or double-click the installer
```

First launch:

1. App shows the Setup Wizard (Connection → Vessel → Admin)
2. Connection: Enter `http://localhost:5000` as backend URL
3. Vessel: Select the vessel from the dropdown (seeded in Step 1)
4. Admin: Create or verify the local admin account

### Step 3: Import SHIPMATE Data (if not done from shore)

If the shore office didn't pre-import SHIPMATE data, do it on the vessel:

```powershell
# Export from SHIPMATE (on the SHIPMATE workstation):
# PMS → Reports → Equipment Register → Export CSV
# PMS → Reports → Job History (Last 2 Years) → Export CSV
# SPS → Reports → ROB (Current) → Export CSV

# Then import into ARUS:
# Open ARUS → System → Data Import → Select "SHIPMATE" source
# Upload each CSV file and select the correct module type
```

### Step 4: Configure Telemetry Sources

If the vessel has telemetry sensors (EFMS, vibration, temperature):

```powershell
# In .env, configure the telemetry endpoint
TELEMETRY_MQTT_BROKER=mqtt://localhost:1883
# Or for direct Modbus:
TELEMETRY_MODBUS_HOST=192.168.1.50
TELEMETRY_MODBUS_PORT=502
```

Register sensors in ARUS:

1. Open ARUS → System → Sensor Management
2. Add each sensor with its tag, type, equipment link, and calibration data
3. Verify telemetry is flowing: System → Diagnostics → Telemetry Status

### Step 5: Verify Everything Works

Run through this checklist with the Chief Engineer:

- [ ] Home screen shows the correct vessel and role-based layout
- [ ] Equipment list matches SHIPMATE register (spot-check 10 items)
- [ ] Work order history shows imported SHIPMATE jobs
- [ ] Spare parts/ROB matches SHIPMATE inventory
- [ ] AI assistant responds to questions about imported equipment
- [ ] Connectivity banner shows correct status (green = connected, offline = red)
- [ ] Bridge night mode works (Settings → Theme → Bridge)
- [ ] Logbook entry can be created and saved
- [ ] PdM dashboard loads (even if empty — confirms the page works)

---

## Crew Training (30 minutes)

### For Chief Engineer / 2nd Engineer:

- How to check PdM alerts and equipment health scores
- How to use the AI assistant for technical questions
- How to view maintenance history imported from SHIPMATE
- How SHIPMATE remains the system of record — ARUS is for analysis

### For Deck Officers:

- How to use the role-based home screen
- How to create logbook entries (with auto-fill from telemetry)
- How to check hours of rest compliance
- Bridge night mode toggle location

### For All Users:

- The connectivity indicator and what it means
- What "saved locally" vs "synced to server" means
- How to change roles on the home screen
- Emergency: if ARUS crashes, SHIPMATE is unaffected — continue using SHIPMATE

---

## Crash Recovery

### ARUS Backend Won't Start

```powershell
# Check the service status
nssm status ARUSBackend

# Check logs
type C:\ARUS\logs\backend-stderr.log

# Common fixes:
# 1. Port 5000 in use → change PORT in .env
# 2. Database locked → stop any other ARUS processes
# 3. Node.js not found → verify PATH includes Node.js

# Restart the service
nssm restart ARUSBackend
```

### ARUS Desktop App Won't Launch

```powershell
# Clear the app's local data (resets to setup wizard)
rmdir /S /Q "%APPDATA%\com.arus.marine"

# Reinstall from USB if needed
msiexec /i "E:\ARUS-Setup-1.0.0.msi" /repair
```

### Database Corrupted

```powershell
# Stop the service
nssm stop ARUSBackend

# Backup current database
copy "C:\ARUS\backend\data\arus-vessel.db" "C:\ARUS\backup\arus-vessel-%date%.db"

# Re-seed from cloud (requires satellite connectivity)
node scripts/seed-vessel-data.js --vessel-id=<VESSEL_ID> --force

# Restart
nssm start ARUSBackend
```

### Sync Failures

The sync system is designed to be resilient:

- Failed syncs are queued and retried automatically
- The vessel database is always the authoritative source during offline periods
- When connectivity returns, the sync runs in order (oldest first)
- Conflict resolution: vessel wins for data created during offline period

To force a sync:

```powershell
curl -X POST http://localhost:5000/api/sync/force
```

To check sync status:

```powershell
curl http://localhost:5000/api/sync/status
```

---

## Ongoing Maintenance

### Weekly

- Check ARUS is running: `curl http://localhost:5000/api/healthz`
- Verify telemetry is flowing: System → Diagnostics → Telemetry Status
- Check for overdue sensor calibrations: System → Sensor Calibration → Overdue

### Monthly

- Export fresh SHIPMATE data and re-import to keep ARUS in sync
- Review PdM alerts and equipment health trends
- Check disk space: `dir C:\ARUS\backend\data\`

### On Crew Change

- Brief incoming crew on ARUS (30-minute walkthrough)
- Verify incoming Chief Engineer can access the system
- No account transfers needed — accounts are role-based, not person-based

### Software Updates

- Updates are delivered via the Tauri auto-updater (when connectivity is available)
- Backend updates: copy new files from USB, restart service
- Database migrations run automatically on startup

---

## Support Contacts

- **Shore office IT:** it@arussb.com
- **ARUS platform issues:** support@arus.io (when available)
- **SHIPMATE issues:** Contact SBN Technologics via your existing support channel
- **Emergency (ARUS down, need to revert):** SHIPMATE is unaffected. Continue all operations in SHIPMATE. ARUS is supplementary.
