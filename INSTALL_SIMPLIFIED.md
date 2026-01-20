# Simplified Installation Guide for Mac

## Method 1: One-Command Install (Recommended)

**Step 1:** Download `arus-final-electron-fixed.tar.gz` to your Downloads folder

**Step 2:** Open Terminal and run:

```bash
cd ~/Downloads
tar -xzf arus-final-electron-fixed.tar.gz
cd RecipeRealm
bash install-mac.sh
```

That's it! The script will:
- ✅ Check if Node.js is installed
- ✅ Install all dependencies
- ✅ Create necessary directories
- ✅ Ask if you want to launch the app

---

## Method 2: Manual Install (If you prefer step-by-step)

```bash
# 1. Go to Downloads
cd ~/Downloads

# 2. Extract the package
tar -xzf arus-final-electron-fixed.tar.gz

# 3. Enter the directory
cd RecipeRealm

# 4. Install dependencies
npm install

# 5. Create data folder
mkdir -p data

# 6. Run the app
npx electron .
```

---

## Method 3: Double-Click Install (Future Enhancement)

We can create a `.pkg` installer or `.dmg` file for drag-and-drop installation, but this requires:
- Apple Developer Account ($99/year)
- Code signing certificate
- Notarization process

For now, the bash script (Method 1) is the simplest approach!

---

## Troubleshooting

### "Node.js is not installed"
Install from: https://nodejs.org/
Recommended: Node.js 20.x or higher

### "command not found: npm"
Node.js installation includes npm. Try restarting Terminal after installing Node.js.

### "Permission denied"
If you get permission errors when running the script:
```bash
chmod +x install-mac.sh
bash install-mac.sh
```

### App opens but shows errors
Check the console logs in DevTools (Help → Toggle Developer Tools)

---

## What Happens During Installation

The `install-mac.sh` script does the following:

1. **Checks Prerequisites**
   - Verifies Node.js is installed
   - Shows your Node.js version

2. **Installs Dependencies** (167 packages)
   - Express, React, Electron, and all required libraries
   - Uses offline cache when possible for faster installation

3. **Creates Data Directory**
   - Makes a `data/` folder for the local SQLite database

4. **Asks to Launch**
   - Optionally launches the app immediately

Total installation time: ~2-3 minutes (depending on internet speed)

---

## After Installation

### Running the app:
```bash
cd ~/Downloads/RecipeRealm
npx electron .
```

### Building a macOS app bundle:
```bash
npm run electron:build
# Creates a .app file you can move to Applications folder
```

### Updating the app:
Download the new tar.gz file and repeat the installation process.
Your data is stored in `data/` and won't be overwritten.

---

## File Structure After Installation

```
RecipeRealm/
├── install-mac.sh          ← Installation script
├── package.json            ← Dependencies list
├── dist/                   ← Frontend build
├── dist-electron/          ← Electron build
├── server/                 ← Backend files
├── data/                   ← Your database (created on install)
├── node_modules/           ← 167 installed packages
└── electron/               ← Electron configuration
```

---

## Need Help?

- Check `ELECTRON_CSS_FIX_COMPLETE.md` for technical details
- Check `CLEANUP_SUMMARY.md` for dependency information
- Check `SETUP_MAC.md` for full setup guide
