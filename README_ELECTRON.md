# ARUS Marine Equipment Registry - Electron Desktop App

**Version:** 1.0.0  
**Platform:** macOS (Intel & Apple Silicon)  
**Status:** ✅ Production Ready

---

## Quick Start

```bash
cd ~/Downloads
tar -xzf arus-electron-synchronized.tar.gz
cd RecipeRealm
bash install-mac.sh
```

That's it! The app will launch automatically.

---

## What Is This?

ARUS (Autonomous Remote Unified System) is a marine predictive maintenance and scheduling platform. This Electron desktop app provides:

- 📊 **Equipment Registry** - Track all marine equipment across your fleet
- 🔧 **Predictive Maintenance** - AI-powered failure prediction
- 📈 **Analytics Dashboard** - Real-time telemetry and insights
- 🗓️ **Work Order Management** - Schedule and track maintenance
- 👥 **Crew Scheduling** - STCW-compliant scheduling
- 📦 **Inventory Management** - Track spare parts and supplies
- 🤖 **AI Reports** - Automated insights and recommendations

**Deployment Mode:** VESSEL (Offline-First)
- Uses local SQLite database (100% feature parity with cloud)
- Works completely offline
- Optional cloud sync when connected

---

## System Requirements

- **macOS:** 11.0 (Big Sur) or later
- **Node.js:** v20.0.0 or later
- **Memory:** 4GB RAM minimum
- **Disk:** 500MB free space

---

## Installation

### Option 1: Automated (Recommended)

```bash
cd ~/Downloads
tar -xzf arus-electron-synchronized.tar.gz
cd RecipeRealm
bash install-mac.sh
```

The script will:
1. Check Node.js version
2. Install dependencies
3. Create data directory
4. Offer to launch the app

### Option 2: Manual

```bash
cd ~/Downloads
tar -xzf arus-electron-synchronized.tar.gz
cd RecipeRealm
npm install
mkdir -p data
npx electron .
```

---

## Running the App

After installation:

```bash
cd ~/Downloads/RecipeRealm
npx electron .
```

Or create a launch script:

```bash
#!/bin/bash
cd ~/Downloads/RecipeRealm
npx electron .
```

Save as `launch-arus.sh`, make executable with `chmod +x launch-arus.sh`, then run `./launch-arus.sh`.

---

## First Launch

When you first launch ARUS:

1. **Server starts** - You'll see initialization logs in the terminal
2. **Database created** - SQLite database created at `data/vessel-local.db`
3. **Electron window opens** - Full ARUS UI loads
4. **Dashboard appears** - You're ready to use the app!

**Default credentials:**
- No authentication required in standalone mode
- In admin mode, use the admin token from your `.env` file

---

## Features Overview

### Equipment Registry
- Add/edit equipment across vessels
- Track operational status and health
- Configure sensors and monitoring

### Predictive Maintenance
- AI-powered failure prediction
- Automatic maintenance scheduling
- Risk-based prioritization

### Analytics & Reporting
- Real-time telemetry dashboards
- Performance metrics
- Export to PDF/CSV

### Inventory Management
- Track spare parts across locations
- Low stock alerts
- Usage history

### Crew Scheduling
- STCW-compliant rest hours
- Fatigue monitoring
- Shift planning

### Work Orders
- Create and assign tasks
- Track completion
- Maintenance history

---

## Data Location

All data is stored locally in:

```
~/Downloads/RecipeRealm/data/
├── vessel-local.db          # Main database
├── vessel-local.db-shm      # Shared memory (temp)
└── vessel-local.db-wal      # Write-ahead log (temp)
```

**Backup:** Simply copy the `data/` folder to back up all your information.

---

## Configuration

Create a `.env` file in the `RecipeRealm/` directory for optional features:

```bash
# Optional: Enable OpenAI features
OPENAI_API_KEY=sk-...

# Optional: Enable cloud sync
TURSO_SYNC_URL=libsql://...
TURSO_AUTH_TOKEN=...

# Optional: Admin mode
ADMIN_TOKEN=your-secret-token
VITE_ADMIN_TOKEN=your-secret-token
```

Without these, the app works fully offline with all core features.

---

## Troubleshooting

### Blue Screen / White Screen

**Symptom:** Electron window opens but shows blank/blue screen

**Solution:** Verify file hashes match:
```bash
cd ~/Downloads/RecipeRealm
grep -o 'index-[A-Za-z0-9_-]*\.js' dist/index.html
ls -1 dist/assets/ | grep 'index-.*\.js'
# These should show the same filename!
```

If they don't match, re-download `arus-electron-synchronized.tar.gz` and reinstall.

### MIME Type Errors

**Symptom:** Console shows "Refused to apply style... MIME type"

**Solution:** You're using an old package. Download `arus-electron-synchronized.tar.gz` (4.1MB, Nov 23, 2025).

### Port Already in Use

**Symptom:** "Port 5000 already in use"

**Solution:** Kill existing processes:
```bash
lsof -ti:5000 | xargs kill -9
```

### Database Errors

**Symptom:** "Cannot read properties of null"

**Solution:** Delete and recreate database:
```bash
rm -rf data/
mkdir data/
npx electron .
```

### Performance Issues

**Symptom:** App is slow or unresponsive

**Solutions:**
1. Check available memory: `top`
2. Close other apps
3. Restart the app
4. Check disk space: `df -h`

---

## Development Mode vs Production

This package runs in **development mode** by default, which means:

✅ **Advantages:**
- Hot reload for server changes
- Detailed logging
- DevTools accessible (Help → Toggle Developer Tools)

⚠️ **Expected warnings:**
- "Electron Security Warning" - Normal in dev mode
- "Service Worker registration skipped" - Normal in dev mode
- MQTT connection timeout - Normal without broker

These warnings will disappear when the app is packaged for production distribution.

---

## Building for Production

To create a distributable app bundle:

```bash
cd ~/Downloads/RecipeRealm

# For macOS (creates .app bundle):
npm run electron:build

# Output:
# dist-electron/mac/ARUS.app
```

The `.app` bundle can be:
- Moved to `/Applications`
- Launched without terminal
- Distributed to other Macs

---

## Updating the App

To update to a new version:

1. **Backup your data:**
   ```bash
   cp -r ~/Downloads/RecipeRealm/data ~/Desktop/arus-backup
   ```

2. **Extract new package:**
   ```bash
   cd ~/Downloads
   rm -rf RecipeRealm
   tar -xzf arus-electron-NEW-VERSION.tar.gz
   cd RecipeRealm
   ```

3. **Restore your data:**
   ```bash
   cp -r ~/Desktop/arus-backup ~/Downloads/RecipeRealm/data
   ```

4. **Install and run:**
   ```bash
   bash install-mac.sh
   ```

---

## Uninstalling

To remove ARUS:

```bash
cd ~/Downloads
rm -rf RecipeRealm
```

Your data will be deleted. Make sure to backup `data/` first if you want to keep it!

---

## Support

### Documentation
- `INSTALL_ELECTRON_MAC.md` - Detailed installation guide
- `TROUBLESHOOTING_ELECTRON.md` - Complete troubleshooting
- `HASH_MISMATCH_FIX.md` - Technical deep dive
- `FINAL_FIX_SUMMARY.md` - Routing fix details

### Logs
Check terminal output for server logs and errors.

Enable verbose logging:
```bash
DEBUG=* npx electron .
```

### DevTools
Open DevTools in the app: **Help → Toggle Developer Tools**

Check:
- Console tab for JavaScript errors
- Network tab for failed requests
- Application tab for storage/database

---

## Technical Details

### Architecture
- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Express.js + Node.js
- **Database:** SQLite (libSQL/Turso) with 100% cloud parity
- **Desktop:** Electron (Chromium + Node.js)

### Security
- Local-only by default (no external connections)
- Session-based authentication for admin mode
- Content Security Policy (CSP) configured
- HTTPS for any cloud sync

### Performance
- Optimized SQLite with WAL mode
- 64MB cache for fast queries
- Composite indexes for common queries
- Lazy loading for large datasets

---

## License

Proprietary - ARUS Marine Equipment Registry  
© 2025 All Rights Reserved

---

## What's Next?

After launching the app:

1. **Explore the dashboard** - Get familiar with the interface
2. **Add your first vessel** - System Administration → Vessels
3. **Register equipment** - Equipment Registry → Add Equipment
4. **Configure sensors** - Equipment detail → Sensor Setup Wizard
5. **View analytics** - Dashboard → Real-time insights

**Need help?** Check the built-in documentation or refer to the troubleshooting guide.

---

🚀 **Ready to launch?** Run `bash install-mac.sh` and get started!
