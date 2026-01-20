# ARUS - Mac Setup Instructions

## Quick Start

This tarball contains a **pre-built** version of ARUS ready to run on macOS.

### Step 1: Extract the Files

```bash
cd /Users/homeimac/Downloads
tar -xzf arus-mac-runtime.tar.gz -C RecipeRealm
cd RecipeRealm
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all Node.js dependencies from `package-lock.json`.

### Step 3: Create Data Directory

```bash
mkdir -p data
```

### Step 4: Run the Application

```bash
npx electron .
```

The Electron app will:
- ✅ Start the embedded Express server on port 5000
- ✅ Create a local SQLite database in `data/vessel-local.db`
- ✅ Load the frontend from the pre-built `dist/` folder
- ✅ Open the application window

## Important Notes

### ✅ **DO NOT REBUILD**

The `dist/` folder contains **pre-built assets** with matching hashes:
- `dist/index.html` → references `/assets/index-C5tNOPsY.js`
- `dist/assets/index-C5tNOPsY.js` → exists and matches

**If you run `npm run build:renderer`, Vite will generate NEW hashes that won't match!**

### Files Included

- ✅ `dist/` - Pre-built frontend (ready to serve)
- ✅ `server/index.js` - Bundled Express server
- ✅ `dist-electron/main.cjs` - Bundled Electron main process
- ✅ `package.json` & `package-lock.json` - Dependency manifests
- ✅ `electron/` - Electron source files
- ✅ `shared/` - Shared TypeScript schemas
- ✅ `scripts/` - Build and utility scripts

### Troubleshooting

**If you see "Cannot GET /" or MIME errors:**
1. Verify `dist/index.html` exists
2. Check `dist/assets/index-C5tNOPsY.js` exists
3. Stop any previous server instances (check port 5000)
4. Run `npx electron .` again

**If port 5000 is in use:**
```bash
lsof -ti:5000 | xargs kill -9
npx electron .
```

**Database issues:**
The app creates `data/vessel-local.db` automatically on first run. This is a local SQLite database for offline operation.

## Architecture

- **Deployment Mode:** VESSEL (Offline-First)
- **Database:** SQLite (libSQL/Turso) with 131 tables
- **Frontend:** React 18 + TypeScript + Vite (pre-built)
- **Backend:** Express.js (bundled)
- **Platform:** Electron (macOS desktop app)

## Need to Rebuild?

If you absolutely must rebuild (e.g., after source code changes):

```bash
# Full rebuild sequence
npm run build:renderer    # Vite build → dist/public/
node scripts/post-build.js # Copy to dist/
npm run build:server      # Bundle server
npm run build:electron-main # Bundle Electron

# Then run
npx electron .
```

**⚠️ Warning:** This will create new asset hashes and you must use the NEWLY built version!

---

**Built on:** November 22, 2025 (Singapore Time)
**Replit Build:** Pre-built with matching asset hashes
**Ready for:** macOS (Darwin) - Electron
