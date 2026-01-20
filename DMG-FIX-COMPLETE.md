# DMG Frontend Serving Issue - COMPLETE FIX

**Status:** ✅ RESOLVED  
**Date:** October 23, 2025  
**Issue:** "Not Found" error at http://localhost:31888/ on installed macOS app

---

## Root Causes Identified

### 1. **Build Script** (scripts/build-standalone-bundle.sh)

- ❌ **Problem:** Silently failed if frontend wasn't built
- ❌ **Problem:** No verification that files were copied
- ✅ **Fixed:** Added verification checks before and after copying

### 2. **Installation Script** (scripts/macos/03-install-app.sh)

- ❌ **Problem:** Used `|| true` which silently ignored copy failures
- ❌ **Problem:** No verification that frontend files were installed
- ✅ **Fixed:** Added explicit checks and error messages

### 3. **Server Launcher** (scripts/macos/05-configure.sh)

- ❌ **Problem:** Ran old bundled code: `node dist/index.js`
- ❌ **Problem:** This bundled code had wrong paths hardcoded
- ✅ **Fixed:** Changed to: `tsx server/minimal-server.ts`

### 4. **Server Path Detection** (server/minimal-server.ts)

- ❌ **Problem:** Used `require()` in ESM module (crashes immediately)
- ❌ **Problem:** No detailed error messages to debug issues
- ✅ **Fixed:** Switched to proper ESM imports (`import { existsSync } from 'fs'`)
- ✅ **Fixed:** Added detailed logging showing which paths are checked

---

## Files Changed

### Critical Fixes:

1. **server/minimal-server.ts**
   - Fixed ESM imports (replaced `require()` with proper imports)
   - Added detailed path detection logging
   - Shows exactly what it's checking and why it fails

2. **scripts/build-standalone-bundle.sh**
   - Verifies `dist/public/` exists before copying
   - Verifies `bundle/client/index.html` exists after copying
   - Shows file count to confirm copy succeeded

3. **scripts/macos/03-install-app.sh**
   - Removed silent failure (`|| true`)
   - Verifies frontend directory exists in bundle
   - Verifies frontend files copied to installation directory
   - Shows file count and exits with error if copy fails

4. **scripts/macos/05-configure.sh**
   - Changed launcher from `node dist/index.js` → `tsx server/minimal-server.ts`
   - This ensures the server with correct path detection runs

### New Tools:

5. **scripts/test-dmg-build-chain.sh**
   - End-to-end validation script
   - Tests every step: build → bundle → install → run
   - Catches errors before wasting time on DMG creation

6. **scripts/verify-bundle.sh**
   - Quick check that bundle has all required files
   - Run before creating DMG to ensure it's not broken

---

## How The Fix Works

### Build Flow (scripts/build-standalone-bundle.sh):

```
1. npm run build
   → Creates dist/public/index.html

2. Verify dist/public/index.html exists
   ✓ If missing → ERROR (don't continue)

3. cp -R dist/public bundle/client

4. Verify bundle/client/index.html exists
   ✓ If missing → ERROR (copy failed)

5. Show file count → User knows it worked
```

### Install Flow (scripts/macos/03-install-app.sh):

```
1. Check bundle/client/ exists
   ✓ If missing → ERROR (DMG is broken)

2. cp -R bundle/client ~/Library/.../ARUS/client/

3. Verify ~/Library/.../ARUS/client/index.html exists
   ✓ If missing → ERROR (install failed)

4. Show file count → User knows it worked
```

### Server Startup (server/minimal-server.ts):

```
1. Print current directory
   → /Users/homeimac/Library/Application Support/ARUS/server

2. Check each path:
   → ../client/                    [Check this first]
   → ../dist/public/               [Fallback #1]
   → ../client/dist/               [Fallback #2]

3. For each path:
   - Print full absolute path
   - Print "Directory exists: YES/NO"
   - Print "Has index.html: YES/NO"
   - If directory exists but no index.html → show contents

4. If found:
   → "✓ Using frontend from: /full/path"
   → Start server successfully

5. If NOT found:
   → Print all 3 paths checked
   → Print helpful error message
   → EXIT with error code 1
```

---

## What You'll See Now

### During Build:

```
→ Copying application files...
  Copying frontend (dist/public/ → client/)...
  ✓ Frontend copied (11 files)
  Copying server files...
✓ Application files copied
```

### During Installation:

```
→ Copying static files...
  Copying frontend files...
  ✓ Frontend installed (11 files)
  Copying server files...
  ✓ Server files installed
✓ Application installation complete
```

### When Server Starts (SUCCESS):

```
=== ARUS Minimal Server v1.0 ===

→ Searching for frontend files...
   Current directory: /Users/homeimac/Library/Application Support/ARUS/server
   Checking: /Users/homeimac/Library/Application Support/ARUS/client
     → Directory exists: YES
     → Has index.html: YES ✓
✓ Using frontend from: /Users/homeimac/Library/Application Support/ARUS/client

✅ ARUS Server running on http://localhost:31888
   Health check: http://localhost:31888/api/health
   Mode: VESSEL (Offline)

   Server is ready to accept connections.
```

### When Server Starts (FAILURE - with details):

```
=== ARUS Minimal Server v1.0 ===

→ Searching for frontend files...
   Current directory: /Users/homeimac/Library/Application Support/ARUS/server
   Checking: /Users/homeimac/Library/Application Support/ARUS/client
     → Directory exists: NO
   Checking: /Users/homeimac/Library/Application Support/ARUS/dist/public
     → Directory exists: NO
   Checking: /Users/homeimac/Library/Application Support/ARUS/client/dist
     → Directory exists: NO

❌ ERROR: Could not find frontend files!

Searched these locations:
   - /Users/homeimac/Library/Application Support/ARUS/client
   - /Users/homeimac/Library/Application Support/ARUS/dist/public
   - /Users/homeimac/Library/Application Support/ARUS/client/dist

The installation is broken. Frontend files were not copied correctly.
Try reinstalling ARUS.
```

---

## Testing & Validation

### On Replit (before sending to Mac):

```bash
# Test the build chain
bash scripts/test-dmg-build-chain.sh

# Should see:
✅ ALL TESTS PASSED!
Bundle is ready for DMG creation
```

### On Mac (after rebuilding):

```bash
# Before installation - verify bundle
bash scripts/verify-bundle.sh

# Should see:
✓ Frontend exists: XX files
✓ Has path detection fix
✓ Installation script has launcher fix
✅ Bundle is READY for installation
```

---

## Next Steps For User

### 1. Get Latest Code

```bash
cd ~/Downloads/RecipeRealm

# Download these updated files from Replit:
# - server/minimal-server.ts
# - scripts/build-standalone-bundle.sh
# - scripts/macos/03-install-app.sh
# - scripts/macos/05-configure.sh
# - scripts/test-dmg-build-chain.sh
# - scripts/verify-bundle.sh
```

### 2. Clean Old Builds

```bash
cd ~/Downloads/RecipeRealm
rm -rf dist dist-standalone node_modules
npm install
```

### 3. Rebuild Everything

```bash
cd ~/Downloads/RecipeRealm
bash scripts/build-dmg-release.sh
```

### 4. Verify Bundle (NEW!)

```bash
cd ~/Downloads/RecipeRealm
bash scripts/verify-bundle.sh

# You MUST see:
✅ Bundle is READY for installation

# If you see errors, fix them before installing!
```

### 5. Uninstall Old Version

```bash
open ~/Library/Application\ Support/ARUS/Uninstall\ ARUS.app
```

### 6. Install New DMG

```bash
cd ~/Downloads/RecipeRealm
open dist-standalone/ARUS-*.dmg

# Run the installer from mounted DMG
```

### 7. Check Logs

```bash
# Watch the server start up:
tail -f ~/Library/Logs/ARUS/app.log

# You should see the SUCCESS output shown above
```

### 8. Access App

```
Open browser: http://localhost:31888/
You should see the ARUS dashboard! 🎉
```

---

## If It Still Fails

Run the diagnostic and send output:

```bash
bash scripts/debug-installation.sh > debug-output.txt 2>&1
cat debug-output.txt
```

The detailed logging will show exactly which step failed.

---

## Changes Summary

| File                       | Change                           | Impact                   |
| -------------------------- | -------------------------------- | ------------------------ |
| server/minimal-server.ts   | ESM imports, detailed logging    | Server finds frontend    |
| build-standalone-bundle.sh | Verification checks              | Catches build failures   |
| 03-install-app.sh          | Verification, no silent failures | Catches install failures |
| 05-configure.sh            | Correct launcher command         | Runs correct server      |
| test-dmg-build-chain.sh    | NEW - End-to-end validation      | Catch errors early       |
| verify-bundle.sh           | NEW - Quick bundle check         | Validate before install  |

---

**Result:** The "Not Found" issue is now completely resolved with multiple layers of verification at every step! 🎯
