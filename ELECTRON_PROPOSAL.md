# ARUS Electron Desktop Application - Comprehensive Proposal

**Prepared:** October 23, 2025  
**Status:** Planning Phase  
**Estimated Effort:** 12-16 hours initial implementation  
**Complexity:** Medium

---

## Executive Summary

This proposal outlines a plan to create a native Electron desktop application for ARUS, building on the recently-stabilized standalone architecture. The Electron wrapper would provide a true native application experience while leveraging the existing tsx-based server architecture that eliminates bundling complexity.

**Key Insight:** The recent fix (using tsx runtime instead of bundling) makes Electron integration significantly easier than it would have been previously.

---

## Current Architecture Analysis

### ✅ What Works in Our Favor

1. **Server Architecture (Perfect for Electron)**
   - Already using tsx runtime (no bundling required)
   - 139 dynamic imports work without modification
   - Startup validation and error handling in place
   - Environment-based configuration (LOCAL_MODE, PORT, DATABASE_PATH)
   - SQLite database (ideal for offline desktop app)

2. **Frontend (Ready to Use)**
   - Clean Vite build to `dist/public/`
   - No hardcoded URLs (uses relative paths)
   - Already tested in standalone mode

3. **Dependencies**
   - Electron 38.3.0 already installed
   - electron-builder 26.0.12 configured
   - 2.2GB node_modules already structured for packaging

4. **Build Infrastructure**
   - Comprehensive DMG build pipeline exists
   - Code signing setup (can be adapted)
   - Installer creation scripts

### ⚠️ Current Gaps

1. No `electron/` directory (was deleted)
2. No Electron main process implementation
3. No IPC (inter-process communication) layer
4. No Electron-specific build scripts
5. No auto-updater implementation

---

## Proposed Architecture

### Directory Structure

```
arus/
├── electron/                    # NEW: Electron-specific code
│   ├── main.js                 # Main process (Node.js)
│   ├── preload.js              # Bridge script (security)
│   └── menu.js                 # Application menu
│
├── server/                      # EXISTING: Backend (unchanged)
│   └── index.ts                # Express server with tsx
│
├── client/                      # EXISTING: Frontend source
│   └── src/
│
├── dist/
│   └── public/                 # EXISTING: Built frontend
│
├── scripts/
│   ├── build-electron.sh       # NEW: Electron build script
│   └── build-standalone-bundle.sh  # EXISTING: Reuse logic
│
└── package.json                # UPDATE: Add electron scripts
```

### Process Architecture

```
┌─────────────────────────────────────────────────────┐
│             Electron Main Process                   │
│  (electron/main.js - Node.js environment)          │
│                                                     │
│  ┌──────────────────┐      ┌──────────────────┐   │
│  │  BrowserWindow   │      │  Server Process  │   │
│  │  (UI Container)  │◄─────┤  (tsx runtime)   │   │
│  │                  │ IPC  │                  │   │
│  │  Loads:          │      │  Runs:           │   │
│  │  localhost:31888 │      │  server/index.ts │   │
│  └──────────────────┘      └──────────────────┘   │
│                                      │             │
│                                      ▼             │
│                          ┌─────────────────────┐   │
│                          │  SQLite Database    │   │
│                          │  vessel-local.db    │   │
│                          └─────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Key Design Decisions:**

1. **Embedded Server:** Express server runs as child process
2. **localhost Communication:** Frontend communicates via HTTP (no changes needed)
3. **Process Lifecycle:** Electron manages server startup/shutdown
4. **Database Path:** Same as current standalone (`~/Library/Application Support/ARUS`)

---

## Implementation Plan

### Phase 1: Core Electron Wrapper (4-5 hours)

#### 1.1 Main Process (`electron/main.js`)

```javascript
import { app, BrowserWindow } from "electron";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import waitOn from "wait-on";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === "development";
const SERVER_PORT = 31888;

let mainWindow = null;
let serverProcess = null;

// Start Express server with tsx runtime
async function startServer() {
  const appPath = app.getAppPath();
  const tsxPath = path.join(appPath, "node_modules", ".bin", "tsx");
  const serverPath = path.join(appPath, "server", "index.ts");

  return new Promise((resolve, reject) => {
    // Set environment variables
    const env = {
      ...process.env,
      LOCAL_MODE: "true",
      NODE_ENV: "production",
      PORT: SERVER_PORT.toString(),
      HOST: "127.0.0.1",
      DATABASE_PATH: path.join(app.getPath("appData"), "ARUS", "data", "vessel-local.db"),
    };

    // Spawn server process
    serverProcess = spawn(process.execPath, [tsxPath, serverPath], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Log server output
    serverProcess.stdout.on("data", (data) => {
      console.log(`[Server] ${data.toString().trim()}`);
    });

    serverProcess.stderr.on("data", (data) => {
      console.error(`[Server Error] ${data.toString().trim()}`);
    });

    serverProcess.on("error", (err) => {
      console.error("Failed to start server:", err);
      reject(err);
    });

    // Wait for server to be ready
    waitOn({
      resources: [`http://localhost:${SERVER_PORT}/api/health`],
      timeout: 60000,
      interval: 500,
    })
      .then(() => {
        console.log("✓ Server ready");
        resolve();
      })
      .catch(reject);
  });
}

// Create application window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: "ARUS - Marine Predictive Maintenance",
    backgroundColor: "#0f172a",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    titleBarStyle: "hiddenInset", // macOS-style traffic lights
    trafficLightPosition: { x: 15, y: 15 },
  });

  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Application lifecycle
app.whenReady().then(async () => {
  try {
    console.log("→ Starting ARUS server...");
    await startServer();
    console.log("→ Creating application window...");
    createWindow();
  } catch (error) {
    console.error("Failed to start application:", error);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  // Gracefully shutdown server
  if (serverProcess) {
    console.log("→ Shutting down server...");
    serverProcess.kill("SIGTERM");
  }
});
```

**Features:**

- ✅ Starts Express server as child process using tsx
- ✅ Waits for server health check before opening window
- ✅ Graceful shutdown handling
- ✅ Development mode support (DevTools)
- ✅ macOS native window chrome

#### 1.2 Preload Script (`electron/preload.js`)

```javascript
import { contextBridge, ipcRenderer } from "electron";

// Expose safe IPC methods to renderer (future features)
contextBridge.exposeInMainWorld("electron", {
  // Example: File operations for future features
  selectFile: () => ipcRenderer.invoke("dialog:selectFile"),

  // System info
  platform: process.platform,

  // App info
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
});
```

**Purpose:**

- Security bridge between main and renderer processes
- Minimal for now (HTTP communication works)
- Ready for future native features (file dialogs, notifications)

#### 1.3 Application Menu (`electron/menu.js`)

```javascript
import { app, Menu, shell } from "electron";

export function createMenu(mainWindow) {
  const template = [
    {
      label: "ARUS",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "Open Data Folder",
          click: () => {
            const dataPath = path.join(app.getPath("appData"), "ARUS");
            shell.openPath(dataPath);
          },
        },
        { type: "separator" },
        { role: "close" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Documentation",
          click: () => shell.openExternal("http://localhost:31888/help"),
        },
        {
          label: "GitHub Repository",
          click: () => shell.openExternal("https://github.com/your-repo/arus"),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
```

### Phase 2: Build Configuration (3-4 hours)

#### 2.1 Update `package.json`

```json
{
  "name": "arus-desktop",
  "version": "1.0.0",
  "main": "electron/main.js",
  "type": "module",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build",
    "electron:dev": "NODE_ENV=development electron .",
    "electron:build": "bash scripts/build-electron.sh",
    "electron:build:mac": "electron-builder --mac",
    "electron:build:win": "electron-builder --win",
    "electron:build:linux": "electron-builder --linux"
  },
  "build": {
    "appId": "com.arus.marine",
    "productName": "ARUS",
    "copyright": "Copyright © 2025",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      "electron/**/*",
      "server/**/*",
      "shared/**/*",
      "dist/public/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "extraResources": [
      {
        "from": "data/vessel-local.db",
        "to": "seed-database.db"
      }
    ],
    "mac": {
      "category": "public.app-category.business",
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        },
        {
          "target": "zip",
          "arch": ["x64", "arm64"]
        }
      ],
      "icon": "build/icon.icns",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist"
    },
    "dmg": {
      "contents": [
        {
          "x": 130,
          "y": 220
        },
        {
          "x": 410,
          "y": 220,
          "type": "link",
          "path": "/Applications"
        }
      ],
      "title": "ARUS ${version}",
      "icon": "build/icon.icns",
      "background": "build/background.png",
      "window": {
        "width": 540,
        "height": 380
      }
    },
    "win": {
      "target": ["nsis", "portable"],
      "icon": "build/icon.ico"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "category": "Office",
      "icon": "build/icon.png"
    }
  }
}
```

#### 2.2 Build Script (`scripts/build-electron.sh`)

```bash
#!/bin/bash
# Build Electron Desktop Application
set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║        Building ARUS Electron Desktop Application        ║"
echo "╚═══════════════════════════════════════════════════════════╝"

VERSION=$(node -p "require('./package.json').version")
echo "Version: $VERSION"
echo ""

# Step 1: Build frontend
echo "→ Building frontend..."
npm run build
echo "✓ Frontend built"
echo ""

# Step 2: Create seed database
echo "→ Creating seed database..."
bash scripts/create-seed-database.sh
echo "✓ Seed database created"
echo ""

# Step 3: Build Electron app
echo "→ Building Electron application..."
echo "  Platform: macOS (Universal)"
echo "  This will take 5-10 minutes..."
echo ""

electron-builder --mac --universal

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              ✅  Build Complete!                          ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Output:"
ls -lh dist-electron/
echo ""
echo "Ready to distribute:"
echo "  • ARUS-${VERSION}-universal.dmg  (Intel + Apple Silicon)"
echo "  • ARUS-${VERSION}-mac.zip        (Alternate format)"
```

### Phase 3: Testing & Refinement (3-4 hours)

1. **Development Testing**
   - Test server startup/shutdown
   - Verify database migrations
   - Test window lifecycle
   - Check for memory leaks

2. **Build Testing**
   - Test on Intel Mac
   - Test on Apple Silicon Mac
   - Verify DMG installation
   - Test first-run experience

3. **Performance Optimization**
   - Optimize server startup time
   - Reduce memory footprint
   - Minimize bundle size

### Phase 4: Code Signing & Distribution (2-3 hours)

1. **macOS Code Signing**
   - Apple Developer Certificate required ($99/year)
   - Configure entitlements
   - Notarize application

2. **Windows Code Signing** (optional)
   - EV Code Signing Certificate (~$300/year)
   - Configure SignTool

3. **Auto-Update Infrastructure** (future)
   - electron-updater integration
   - Update server (GitHub Releases or custom)

---

## Challenges & Solutions

### Challenge 1: Bundle Size

**Problem:** 2.2GB node_modules + 300MB Electron = 2.5GB app

**Solutions:**

1. ✅ Use electron-builder compression (reduces to ~1GB DMG)
2. ✅ Exclude dev dependencies (`--production` flag)
3. ✅ Implement optional dependencies based on features
4. 🔄 Future: Lazy-load ML features (TensorFlow only when enabled)

**Result:** ~1-1.2GB DMG (acceptable for B2B desktop software)

### Challenge 2: Server Lifecycle Management

**Problem:** Ensuring clean server startup/shutdown

**Solutions:**

1. ✅ Use `wait-on` to verify server health before showing UI
2. ✅ Implement SIGTERM handler in server/index.ts
3. ✅ Add timeout for server startup (60s max)
4. ✅ Display loading screen during startup

### Challenge 3: Database Path Consistency

**Problem:** Matching standalone installer database location

**Solutions:**

1. ✅ Use same path: `~/Library/Application Support/ARUS/data/`
2. ✅ Create directories on first launch
3. ✅ Copy seed database to user data folder
4. ✅ Implement database migration system

### Challenge 4: Auto-Updates

**Problem:** Users expect automatic updates for desktop apps

**Solutions:**

1. Phase 1: Manual updates (download new DMG)
2. Phase 2: Implement electron-updater
3. Host releases on GitHub Releases (free)
4. Notify users of available updates

### Challenge 5: Multi-Platform Support

**Problem:** Building for Windows/Linux

**Solutions:**

1. ✅ Electron is cross-platform (same code)
2. ⚠️ Need Windows VM for testing/building
3. ⚠️ Need Linux VM for testing/building
4. Alternative: Use GitHub Actions for cross-platform builds

---

## Comparison: Electron vs PWA

| Feature              | Electron               | PWA (Current)     | Winner   |
| -------------------- | ---------------------- | ----------------- | -------- |
| **User Experience**  |
| Native window chrome | ✅ Yes                 | ❌ Browser UI     | Electron |
| Dock/taskbar icon    | ✅ Native              | ⚠️ Manual install | Electron |
| Offline mode         | ✅ Built-in            | ✅ Service Worker | Tie      |
| Multi-window support | ✅ Easy                | ❌ Limited        | Electron |
| Notifications        | ✅ Native              | ⚠️ Limited        | Electron |
| **Distribution**     |
| Download size        | ❌ 1GB                 | ✅ 0 bytes        | PWA      |
| Installation         | ⚠️ DMG mount           | ✅ One-click      | PWA      |
| Updates              | ⚠️ Manual/auto-updater | ✅ Automatic      | PWA      |
| Cross-platform       | ⚠️ Separate builds     | ✅ Universal      | PWA      |
| **Development**      |
| Maintenance          | ❌ More code           | ✅ Less code      | PWA      |
| Testing              | ❌ 3 platforms         | ✅ Browser only   | PWA      |
| Build time           | ❌ 10+ minutes         | ✅ 1 minute       | PWA      |
| Debugging            | ⚠️ DevTools + IPC      | ✅ DevTools only  | PWA      |
| **Features**         |
| File system access   | ✅ Full                | ⚠️ Limited        | Electron |
| System integration   | ✅ Deep                | ❌ Minimal        | Electron |
| USB/serial devices   | ✅ Yes                 | ❌ No             | Electron |
| Custom protocols     | ✅ Yes                 | ❌ No             | Electron |
| **Cost**             |
| Code signing         | ❌ $99/year            | ✅ Free           | PWA      |
| Distribution         | ✅ Self-hosted         | ✅ Self-hosted    | Tie      |
| Support burden       | ❌ Higher              | ✅ Lower          | PWA      |

**Overall Winner:** Depends on use case

- **Electron:** Better for traditional enterprise users, hardware integration
- **PWA:** Better for modern users, rapid deployment, lower costs

---

## Resource Requirements

### Development Resources

| Resource                           | Requirement     | Cost                    |
| ---------------------------------- | --------------- | ----------------------- |
| Developer time                     | 12-16 hours     | $1,200-$2,000 @ $100/hr |
| Testing time                       | 4-6 hours       | $400-$600               |
| Apple Developer Account            | Annual          | $99/year                |
| Code signing certificate (Windows) | Optional        | $300/year               |
| Testing hardware                   | Intel + ARM Mac | Have/rent               |

**Total Initial Investment:** ~$1,700-$3,000

### Ongoing Costs

- Developer account: $99/year
- Windows signing: $300/year (optional)
- Maintenance: 2-4 hours/month (~$200-$400/month)

---

## Timeline

### Optimistic (12 hours total)

- Week 1: Phase 1 (Core wrapper) - 5 hours
- Week 2: Phase 2 (Build config) - 3 hours
- Week 3: Phase 3 (Testing) - 3 hours
- Week 4: Phase 4 (Code signing) - 1 hour

**Launch:** 4 weeks from start

### Realistic (16 hours total)

- Week 1-2: Phase 1 (Core wrapper) - 6 hours
- Week 3: Phase 2 (Build config) - 4 hours
- Week 4-5: Phase 3 (Testing) - 4 hours
- Week 6: Phase 4 (Code signing) - 2 hours

**Launch:** 6 weeks from start

---

## Recommendation

### Option A: Build Electron Version ✅

**Recommended if:**

- ✅ Target users are traditional enterprise/maritime industry
- ✅ Need hardware integration (USB sensors, serial devices)
- ✅ Users expect .dmg/.exe installers
- ✅ Budget available for code signing ($99-$400/year)
- ✅ Can dedicate 12-16 hours development time

**Benefits:**

- Professional appearance (native app)
- Better perceived value (installed software vs website)
- Offline-first mindset (users see it as "installed")
- Future-proof for native features

### Option B: Focus on PWA 🎯

**Recommended if:**

- ✅ Modern user base comfortable with web apps
- ✅ Rapid deployment priority
- ✅ Multi-platform support crucial (iOS/Android/desktop)
- ✅ Limited development resources
- ✅ Prefer lower maintenance burden

**Benefits:**

- Zero distribution costs
- Instant updates
- Smaller download (better for remote vessels with slow internet)
- One codebase for all platforms

### Option C: Hybrid Approach 🌟 (RECOMMENDED)

**Best of both worlds:**

1. **Phase 1 (Now):** Improve PWA discoverability
   - Add install prompts on dashboard
   - Create installation guide
   - Better marketing ("Install ARUS to your desktop")

2. **Phase 2 (Next Quarter):** Build Electron version
   - Test market demand
   - Offer as "Premium" or "Professional" edition
   - Charge premium ($99 vs free PWA) to offset costs

3. **Phase 3 (Future):** Feature differentiation
   - PWA: Cloud-connected, mobile-friendly
   - Electron: Full offline, hardware integration, premium support

---

## Next Steps

### If Approved for Electron Development:

1. **Immediate (Week 1)**
   - Create `electron/` directory structure
   - Implement main.js (5 hours)
   - Test development mode

2. **Short-term (Week 2-3)**
   - Configure electron-builder
   - Create build scripts
   - Test production builds

3. **Medium-term (Week 4-6)**
   - Apple Developer account setup
   - Code signing configuration
   - Internal beta testing

4. **Long-term (Month 2-3)**
   - Public beta release
   - Gather user feedback
   - Windows/Linux versions (if needed)

### Decision Points

**Question 1:** Budget approval?

- [ ] Yes - Proceed with Electron
- [ ] No - Enhance PWA instead

**Question 2:** Timeline acceptable?

- [ ] Yes - 6 weeks is fine
- [ ] No - Need faster (stick with PWA)

**Question 3:** Code signing?

- [ ] Yes - Will purchase Apple Developer account
- [ ] No - Unsigned builds only (users get warning)

**Question 4:** Windows support?

- [ ] Yes - Need Windows version too (+8 hours)
- [ ] No - macOS only for now

---

## Appendix: File Checklist

### New Files to Create

- [ ] `electron/main.js` - Main process entry point
- [ ] `electron/preload.js` - Security bridge
- [ ] `electron/menu.js` - Application menu
- [ ] `scripts/build-electron.sh` - Build automation
- [ ] `build/icon.icns` - macOS app icon
- [ ] `build/icon.ico` - Windows app icon
- [ ] `build/icon.png` - Linux app icon
- [ ] `build/entitlements.mac.plist` - macOS permissions
- [ ] `build/background.png` - DMG background image

### Files to Modify

- [ ] `package.json` - Add Electron scripts and config
- [ ] `server/index.ts` - Add SIGTERM handler (already has it)
- [ ] `.gitignore` - Add `dist-electron/`

### Testing Checklist

- [ ] Server starts successfully
- [ ] Window displays correctly
- [ ] Database migrations work
- [ ] Shutdown is graceful
- [ ] DMG builds successfully
- [ ] DMG installs correctly
- [ ] App survives computer restart
- [ ] Updates work (future)

---

**End of Proposal**

_Ready for implementation upon approval._
