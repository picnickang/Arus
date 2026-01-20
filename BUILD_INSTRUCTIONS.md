# ARUS Electron App - Complete Build Instructions

## Problem Solved

The "Cannot GET /" issue was caused by **not running the frontend Vite build** before launching Electron. The server found `dist/` but it didn't contain the React app's `index.html`.

## ✅ Current Build System

### Vite Configuration
- **Location**: `vite.config.ts` (project root)
- **Source**: `client/` directory (React app)
- **Output**: `dist/public/` directory
- **Build command**: `vite build` or `npm run build:renderer`

### Post-Build Process
After Vite builds to `dist/public/`, the `scripts/post-build.js` script copies all frontend files to `dist/` (where the server serves from).

## 🚀 Complete Build Sequence for Mac

When you download the project to `/Users/homeimac/Downloads/RecipeRealm`, run:

```bash
cd /Users/homeimac/Downloads/RecipeRealm

# Install dependencies (if not already done)
npm install

# Build everything in the correct order:

# 1. Build React frontend (Vite)
npm run build:renderer
# This outputs to: dist/public/

# 2. Copy frontend to dist/ (post-build)
node scripts/post-build.js
# This copies: dist/public/* → dist/

# 3. Build server bundle
npm run build:server
# This creates: server/index.js

# 4. Build Electron main process
npm run build:electron-main
# This creates: dist-electron/main.cjs

# 5. Run the Electron app
npx electron .
```

## 📦 Quick Build Command (All-in-One)

For convenience, you can run:

```bash
npm run build && npx electron .
```

This runs:
1. `vite build` (builds React frontend to `dist/public/`)
2. Post-build copy (implicit in next step)
3. `esbuild server/index.ts` (builds server to `dist/index.js`)

Then manually run:
```bash
node scripts/post-build.js  # Copy frontend to dist/
npm run build:electron-main  # Build Electron main
npx electron .               # Launch app
```

## 🔍 Verification - Expected Server Logs

When you run `npx electron .`, you should see these logs in the Electron console:

```
→ Setting up static file serving (embedded mode - HMR disabled)...
[Static] Candidate roots: [
  '/Users/homeimac/Downloads/RecipeRealm/dist',
  '/Users/homeimac/Downloads/RecipeRealm/dist/public',
  '/Users/homeimac/Downloads/RecipeRealm/client/dist'
]
[Static] Checking: /Users/homeimac/Downloads/RecipeRealm/dist
[Static]   - Directory exists: YES
[Static]   - Has index.html: YES
[Static] ✓ Selected frontend build from: /Users/homeimac/Downloads/RecipeRealm/dist
[Static] Contents of staticRoot (12 items): assets, icon-192.png, icon-192.png.TODO, icon-192.svg, icon-512.png, icon-512.png.TODO, icon-512.svg, index.html, index.js, manifest.json...
[Static] ✓ express.static() configured for: /Users/homeimac/Downloads/RecipeRealm/dist
[Static] ✓ SPA fallback route (GET *) configured
✓ Static file serving fully configured from: /Users/homeimac/Downloads/RecipeRealm/dist
✅ Server listening on port 5000
🚀 ARUS application is now live!
```

### Key Indicators of Success:

✅ **Has index.html: YES** - This confirms the frontend build exists  
✅ **Contents of staticRoot** shows `index.html` in the list  
✅ **express.static() configured** - Static file middleware active  
✅ **SPA fallback route (GET *) configured** - Client-side routing will work  

## ⚠️ Common Issues & Fixes

### Issue 1: "Cannot GET /" in Electron window

**Cause**: No `index.html` in the served directory.

**Fix**:
```bash
# Check if index.html exists
ls dist/index.html

# If NOT found, rebuild frontend
npm run build:renderer
node scripts/post-build.js
```

### Issue 2: Server logs show "Has index.html: NO"

**Cause**: Frontend build didn't run or output to wrong directory.

**Fix**:
```bash
# Clean and rebuild
rm -rf dist/public dist/*.html dist/assets
npm run build:renderer
node scripts/post-build.js
ls dist/index.html  # Should exist now
```

### Issue 3: Blank screen but no "Cannot GET /"

**Cause**: Frontend loaded but has JavaScript errors.

**Fix**:
- Open Electron DevTools (View → Toggle Developer Tools)
- Check console for React/JS errors
- Verify all assets loaded (Network tab)

## 📁 Expected Directory Structure After Build

```
RecipeRealm/
├── dist/                          ← Server serves from here
│   ├── index.html                 ← React app entry (MUST EXIST)
│   ├── index.js                   ← Server bundle
│   ├── assets/                    ← React app assets
│   │   ├── index-C5tNOPsY.js     ← Main React bundle
│   │   ├── index-C8omU17M.css    ← Styles
│   │   └── ...
│   ├── manifest.json
│   ├── service-worker.js
│   └── public/                    ← Vite's original output
│       ├── index.html
│       └── assets/
├── dist-electron/
│   └── main.cjs                   ← Electron main process
├── server/
│   └── index.js                   ← Server bundle (alternative location)
└── client/
    └── src/                       ← React source code
```

## 🔧 Server Static Serving Logic

The server checks directories in this order:

1. **`<projectRoot>/dist`** ← FIRST (preferred)
2. **`<projectRoot>/dist/public`** ← Fallback (Vite default output)
3. **`<projectRoot>/client/dist`** ← Alternative

It selects the **first directory that contains `index.html`**.

## 🎯 SPA Fallback Route

The server is configured with:

```javascript
app.use(express.static(staticRoot));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(staticRoot, "index.html"));
});
```

This ensures:
- All static files (JS, CSS, images) are served from `staticRoot`
- API routes (`/api/*`) are handled by the server
- **All other routes** return `index.html` (for client-side routing)

## 📝 Build Scripts Reference

Current scripts in `package.json`:

```json
{
  "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
  "build:renderer": "vite build",
  "build:server": "esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outfile=server/index.js --allow-overwrite",
  "build:electron-main": "NODE_ENV=production vite build --config electron.vite.config.ts",
  "dist:mac": "npm run build:renderer && npm run build:electron-main && npm run build:server && electron-builder --mac"
}
```

## 🚀 Production Distribution Build

For a full macOS `.app` bundle:

```bash
npm run dist:mac
```

This will:
1. Build the frontend
2. Build the Electron main process
3. Build the server
4. Package everything into `dist/ARUS-1.0.0.dmg`

## ✅ Final Checklist

Before running `npx electron .`:

- [ ] `npm install` completed
- [ ] `npm run build:renderer` completed (creates `dist/public/`)
- [ ] `node scripts/post-build.js` completed (copies to `dist/`)
- [ ] `dist/index.html` exists
- [ ] `npm run build:server` completed (creates server bundle)
- [ ] `npm run build:electron-main` completed (creates Electron main)
- [ ] All builds succeeded without errors

After `npx electron .`:

- [ ] Server logs show "Has index.html: YES"
- [ ] Server logs show "Static file serving fully configured"
- [ ] Electron window shows ARUS React UI (not "Cannot GET /")
- [ ] Navigation works (sidebar, pages)
- [ ] No console errors in DevTools

## 🆘 Still Getting "Cannot GET /"?

Run this diagnostic:

```bash
# 1. Verify index.html exists
ls -la dist/index.html
# Expected: -rw-r--r-- ... index.html

# 2. Check file contents (first 5 lines)
head -5 dist/index.html
# Expected: <!doctype html><html lang="en">...

# 3. Check server bundle includes fixes
grep -a "Candidate roots" dist/index.js
# Expected: "Candidate roots" found in bundle

# 4. Clean rebuild
rm -rf dist dist-electron
npm run build:renderer
node scripts/post-build.js
npm run build:server
npm run build:electron-main
npx electron .
```

If it **still** fails, check the Electron console logs and look for:
- What directory the server selected (`[Static] ✓ Selected frontend build from:`)
- Whether it has `index.html` (`[Static]   - Has index.html: YES/NO`)
- Any errors during static setup

---

## Summary

The fix was simple but critical:

**Before**: Only ran `build:server` + `build:electron-main` → No React frontend  
**After**: Run `build:renderer` + post-build script → React app in `dist/`

Now the server finds `index.html` and serves the full React UI! 🎉
