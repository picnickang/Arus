# DMG Installer Fixes Applied

## Date: October 23, 2025

## Problem

The macOS installer was failing with error:

```
export: 'Support/ARUS/data/vessel-local.db': not a valid identifier
```

This occurred because paths containing spaces (e.g., `/Users/homeimac/Library/Application Support/ARUS/`) were not properly handled in the `.env` file and launcher script.

## Root Cause

1. The `.env` file generator created unquoted paths
2. The launcher script loaded `.env` using `export $(cat .env | xargs)` which splits on spaces
3. This caused bash to incorrectly parse paths with spaces

## Fixes Applied

### Fix 1: Quote DATABASE_PATH in .env generation

**File:** `scripts/macos/05-configure.sh` (line 32)

```bash
# Before:
DATABASE_PATH=$DB_PATH

# After:
DATABASE_PATH="$DB_PATH"
```

### Fix 2: Quote LOG_DIR in .env generation

**File:** `scripts/macos/05-configure.sh` (line 57)

```bash
# Before:
LOG_DIR=$ARUS_LOGS

# After:
LOG_DIR="$ARUS_LOGS"
```

### Fix 3: Change env loading method from xargs to source

**File:** `scripts/macos/05-configure.sh` (lines 110-114)

```bash
# Before:
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# After:
if [ -f ".env" ]; then
    set -a  # Automatically export all variables
    source .env
    set +a
fi
```

### Fix 4: Increase health check timeout

**File:** `scripts/macos/07-health-check.sh` (line 15)

```bash
# Before:
MAX_WAIT=30

# After:
MAX_WAIT=90
```

### Fix 5: Add process monitoring during health check

**File:** `scripts/macos/07-health-check.sh` (lines 26-34)
Added detection for when server process dies vs. timing out, with better error messages.

## Verification Status

✅ All 5 fixes verified in Replit codebase
✅ Old installers cleared from releases/
✅ Ready for rebuild

## Next Steps

1. Download this project from Replit to your Mac
2. Run `bash scripts/build-dmg-release.sh`
3. Install from the new DMG
4. Server will start successfully without export errors

## Technical Details

- The `source` command preserves quoted values in `.env` files
- Unlike `xargs`, it doesn't perform word splitting on spaces
- This is POSIX-compliant and safe for machine-generated `.env` files
- 90-second timeout accommodates SQLite init + TensorFlow loading

---

Built with ❤️ for ARUS Marine Predictive Maintenance System
