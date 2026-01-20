# Missing Launcher Script Fix

**Issue:** LaunchAgent service errors about missing `arus-start.sh`  
**Impact:** Low - App works but auto-start service fails  
**Status:** ✅ FIXED

---

## The Problem

Your stderr.log shows:

```
/bin/bash: /Users/homeimac/Library/Application Support/ARUS/arus-start.sh: No such file or directory
```

This happens because:

1. The macOS LaunchAgent (auto-start service) is configured to run `arus-start.sh`
2. But this launcher script is missing from your installation
3. **However**, the app still works because you're running it manually somehow

---

## Why It's Missing

The launcher script should be created in TWO places:

### 1. During Build (scripts/build-standalone-bundle.sh)

Creates `arus-start.sh` in the bundle directory

### 2. During Installation (scripts/macos/05-configure.sh)

Creates `arus-start.sh` in the installation directory

**The issue:** If the installation script (05-configure.sh) didn't run or failed, the launcher won't exist.

---

## Fixes Applied

### Fix #1: Quick Fix Script (Run on Mac)

**File:** `scripts/macos-fix-launcher.sh`

Download this script and run on your Mac:

```bash
cd ~/Downloads/RecipeRealm
bash scripts/macos-fix-launcher.sh
```

This creates the missing `arus-start.sh` file.

### Fix #2: Installation Script Update

**File:** `scripts/macos/03-install-app.sh`

Now copies `arus-start.sh` from bundle to installation directory as a backup.

**Before:**

```bash
cp "$SOURCE_DIR/package.json" "$ARUS_HOME/"
echo "✓ Application installation complete"
```

**After:**

```bash
cp "$SOURCE_DIR/package.json" "$ARUS_HOME/"

# Copy launcher script if it exists in bundle
if [ -f "$SOURCE_DIR/arus-start.sh" ]; then
  cp "$SOURCE_DIR/arus-start.sh" "$ARUS_HOME/"
  chmod +x "$ARUS_HOME/arus-start.sh"
  echo "  ✓ Launcher script installed"
fi

echo "✓ Application installation complete"
```

---

## How To Fix On Your Mac

### Option 1: Quick Fix (Recommended)

Download and run the fix script:

```bash
cd ~/Downloads/RecipeRealm

# Download the fix script from Replit
# Then run:
bash scripts/macos-fix-launcher.sh
```

### Option 2: Manual Fix

Create the launcher script manually:

```bash
cat > "$HOME/Library/Application Support/ARUS/arus-start.sh" << 'EOF'
#!/bin/bash
# ARUS Application Launcher

cd "$HOME/Library/Application Support/ARUS" || exit 1

if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

export LOCAL_MODE=true
export NODE_ENV=production
export PORT=${PORT:-31888}
export HOST=${HOST:-127.0.0.1}

if [ -z "$DATABASE_PATH" ]; then
  export DATABASE_PATH="$HOME/Library/Application Support/ARUS/data/vessel-local.db"
fi

LOG_FILE="$HOME/Library/Logs/ARUS/app.log"

echo "Starting ARUS..."
echo "Access at: http://localhost:${PORT}"
echo "Logs: $LOG_FILE"

exec node_modules/.bin/tsx server/minimal-server.ts >> "$LOG_FILE" 2>&1
EOF

chmod +x "$HOME/Library/Application Support/ARUS/arus-start.sh"
```

### Option 3: Rebuild Everything (Clean Slate)

If you want a completely fresh installation:

```bash
cd ~/Downloads/RecipeRealm

# Get latest code with fixes
# Clean and rebuild
rm -rf dist dist-standalone node_modules
npm install
bash scripts/build-dmg-release.sh

# Uninstall old version
open ~/Library/Application\ Support/ARUS/Uninstall\ ARUS.app

# Install new DMG
open dist-standalone/ARUS-*.dmg
```

---

## After Fixing

### Restart the LaunchAgent Service

```bash
# Stop the service (will stop the errors)
launchctl stop com.arus.app

# Start the service (will use the new launcher)
launchctl start com.arus.app

# Check status
launchctl list | grep arus
```

### Verify It Works

```bash
# Check logs (should show no more errors)
tail -f ~/Library/Logs/ARUS/stderr.log

# Should see:
# (nothing - no errors!)

# Check app log
tail -f ~/Library/Logs/ARUS/app.log

# Should see:
# ✓ Using frontend from: /Users/homeimac/Library/Application Support/ARUS/client
# ✅ ARUS Server running on http://localhost:31888
```

### Access the App

```
http://localhost:31888/
```

---

## Why The App Was Working Despite The Error

Your app was working because:

1. **LaunchAgent Failed** - The auto-start service couldn't run due to missing launcher
2. **But You Started It Manually** - You probably ran the server some other way
3. **Only LaunchAgent Complained** - The errors are just the LaunchAgent retrying

The LaunchAgent is configured to:

- Auto-start ARUS when you log in
- Keep it running if it crashes
- Restart it if needed

Without the launcher script, these features don't work, but manual startup still works fine.

---

## Files Changed

| File                              | Status                     | Purpose                             |
| --------------------------------- | -------------------------- | ----------------------------------- |
| `scripts/macos-fix-launcher.sh`   | ✅ NEW                     | Quick fix script to create launcher |
| `scripts/macos/03-install-app.sh` | ✅ UPDATED                 | Now copies launcher from bundle     |
| `scripts/macos/05-configure.sh`   | ✓ Already creates launcher | Creates launcher during install     |

---

## Summary

- **Problem:** Missing `arus-start.sh` causes LaunchAgent errors
- **Impact:** App works but no auto-start
- **Fix:** Run fix script or rebuild with updated installer
- **Result:** LaunchAgent will work correctly

The app is working fine, this just fixes the auto-start service! ✓
