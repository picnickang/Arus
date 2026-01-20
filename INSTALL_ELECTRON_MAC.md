# ARUS Electron Installation for Mac - UPDATED ✅

**Date:** November 23, 2025  
**Package:** `arus-electron-synchronized.tar.gz` (4.1MB)  
**Status:** ✅ **File hashes synchronized - Ready to use**

---

## ⚠️ IMPORTANT: Use the New Package!

**The old package had mismatched file hashes.** You need to:

1. **Delete the old RecipeRealm folder** (if it exists)
2. **Download the NEW package:** `arus-electron-synchronized.tar.gz`
3. **Extract and install fresh**

---

## Quick Installation (3 Commands)

```bash
cd ~/Downloads
rm -rf RecipeRealm  # Remove old folder if it exists
tar -xzf arus-electron-synchronized.tar.gz
cd RecipeRealm
bash install-mac.sh
```

When prompted "Launch ARUS now? (y/n)", type **`y`** and press Enter.

---

## What's Fixed

### ✅ The Problem Was:
- `index.html` referenced `index-C5tNOPsY.js` (old hash)
- Actual file was `index-DvZ77ZfH.js` (new hash)
- Browser couldn't find the file → Got HTML instead → MIME type error

### ✅ The Solution:
- Rebuilt frontend with synchronized hashes
- All files now match what `index.html` expects
- Verified:
  - `index.html` → references `index-DvZ77ZfH.js` ✅
  - `dist/assets/` → contains `index-DvZ77ZfH.js` ✅

---

## Expected Behavior (After Installation)

### ✅ Server Logs (No Errors):
```
🚀 Starting ARUS embedded server...
→ Setting up static file serving (embedded mode - HMR disabled)...
[Static] ✓ Selected frontend build from: /Users/.../RecipeRealm/dist
[Static] ✓ express.static() configured
[Static] ✓ SPA fallback route (GET *) configured
✅ Server listening on port 5000
🚀 ARUS application is now live!
```

### ✅ Electron Window:
- Full ARUS dashboard UI (NOT blue screen)
- Navigation sidebar visible
- Equipment registry, vessels, analytics all load
- CSS styling applied correctly

### ✅ DevTools Console (No MIME Errors):
- Open DevTools: Help → Toggle Developer Tools
- Network tab should show:
  ```
  GET /assets/index-DvZ77ZfH.js    200  application/javascript  ✅
  GET /assets/index-C8omU17M.css   200  text/css  ✅
  ```
- No "Refused to apply style" errors
- No "Failed to load resource: 404" errors

### ⚠️ Expected Warnings (Harmless):
```
Electron Security Warning (Insecure Content-Security-Policy)
  → This is expected in development mode
  → Will disappear when app is packaged for production
```

---

## Troubleshooting

### Still seeing MIME type errors?

**Step 1:** Verify you're using the NEW package
```bash
cd ~/Downloads
ls -lh arus-electron-synchronized.tar.gz
# Should be 4.1MB, dated Nov 23, 2025
```

**Step 2:** Clean install
```bash
cd ~/Downloads
rm -rf RecipeRealm  # Delete old folder completely
tar -xzf arus-electron-synchronized.tar.gz
cd RecipeRealm
npm install
npx electron .
```

**Step 3:** Check what files exist
```bash
cd ~/Downloads/RecipeRealm
ls -la dist/assets/ | grep index
# Should show:
# index-C8omU17M.css
# index-DvZ77ZfH.js
```

**Step 4:** Check what index.html references
```bash
grep -o 'index-[A-Za-z0-9_-]*\.\(js\|css\)' dist/index.html
# Should show:
# index-C8omU17M.css
# index-DvZ77ZfH.js
```

If these don't match, you have the wrong package!

---

## Manual Installation (If Script Fails)

```bash
cd ~/Downloads
rm -rf RecipeRealm
tar -xzf arus-electron-synchronized.tar.gz
cd RecipeRealm

# Check Node version (need 20+)
node --version
# If < v20, install from: https://nodejs.org/

# Install dependencies
npm install

# Create data directory
mkdir -p data

# Launch app
npx electron .
```

---

## Verification Checklist

After launching, verify these:

- [ ] Server logs show "Setting up static file serving (embedded mode)"
- [ ] Server logs show "Server listening on port 5000"
- [ ] Electron window opens (not blank/blue)
- [ ] ARUS dashboard UI visible
- [ ] Left sidebar navigation visible
- [ ] No red errors in terminal
- [ ] DevTools Network tab shows CSS/JS with correct MIME types

---

## File Hash Reference

For verification, the synchronized package contains:

**Frontend Build:**
- `dist/index.html` → 5.3KB
- `dist/assets/index-DvZ77ZfH.js` → 930KB
- `dist/assets/index-C8omU17M.css` → 131KB

**Server Build:**
- `server/index.js` → 3.4MB (with routing fix)
- `server/index-wrapper.js` → Small wrapper

**Electron:**
- `dist-electron/main.cjs` → 9.1KB

---

## Common Issues

### Issue: "Cannot find module"
**Solution:** Run `npm install` again

### Issue: "Port 5000 already in use"
**Solution:** Kill other processes:
```bash
lsof -ti:5000 | xargs kill -9
```

### Issue: Still seeing old file hashes
**Solution:** You're using the old package! Download `arus-electron-synchronized.tar.gz`

---

## Support

If you still see MIME type errors after following these steps:

1. Verify package name is `arus-electron-synchronized.tar.gz` (4.1MB)
2. Check terminal logs for the exact error
3. Open DevTools (Help → Toggle Developer Tools)
4. Check Network tab to see what files are being requested
5. Share the terminal output and DevTools screenshots

---

## Success Indicators

You'll know it's working when:

✅ Server starts without database errors  
✅ Electron window shows ARUS UI (not blue)  
✅ DevTools shows no MIME type errors  
✅ All CSS/JS files load with status 200  
✅ You can navigate between pages  

---

**Ready to install?** Run the 3 commands at the top! 🚀
