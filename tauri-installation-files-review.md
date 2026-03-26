# ARUS Tauri v2 Installation & Build Files — Complete Code for Review

## File Tree (Installation-Related)

```
Root:
├── TAURI_INSTALLATION_MIGRATION_PLAN.txt   (557 lines — migration plan & status tracker)
├── tauri-migration-review.md               (3846 lines — full migration code review package)

docs/
├── BUILD_GUIDE.md                          (build & distribution reference)
└── CODE_SIGNING_GUIDE.md                   (macOS/Windows signing & notarization)

scripts/
├── dev-setup.sh                            (developer environment setup)
├── generate-icons.mjs                      (SVG → PNG icon generation for Tauri)
└── init-sqlite-schema.js                   (vessel-mode SQLite bootstrap)

package.json (relevant scripts & deps)
```

---

## 1. `TAURI_INSTALLATION_MIGRATION_PLAN.txt`

```txt
================================================================================
  ARUS MARINE — TAURI & INSTALLATION MIGRATION PLAN
  Generated: 2026-03-09
  Status: Post-initial-migration audit (Electron source removed, Tauri shell built)
================================================================================

================================================================================
1. REPOSITORY OVERVIEW
================================================================================

ARUS (Marine Predictive Maintenance & Scheduling) is a full-stack web application
for marine fleet management. It provides predictive maintenance, crew scheduling,
inventory management, compliance tracking, and AI-powered analytics.

Tech Stack:
  Frontend:    React 18, TypeScript, Tailwind CSS, shadcn/ui, Wouter, TanStack Query
  Backend:     Express.js, TypeScript, Zod validation, PostgreSQL (Drizzle ORM)
  Desktop:     Tauri v2 (Rust) — recently migrated from Electron
  Mobile:      Capacitor (iOS/iPadOS)
  Database:    PostgreSQL (cloud) / SQLite via libSQL (vessel/embedded mode)
  AI/ML:       TensorFlow.js, XGBoost, OpenAI integration

Deployment Modes:
  CLOUD    — PostgreSQL, hosted on Neon/Replit, accessed via browser
  VESSEL   — SQLite (WAL mode), offline-first, runs on vessel hardware
  DESKTOP  — Tauri v2 native app connecting to local or remote backend
  MOBILE   — Capacitor iOS app

Repository Structure (key directories):
  client/           — React frontend (Vite)
  server/           — Express.js backend (hexagonal architecture)
  shared/           — Shared types, schemas, config (Drizzle schema)
  src-tauri/        — Tauri v2 desktop shell (Rust)
  ios/              — Capacitor iOS project
  scripts/          — Build and setup scripts
  docs/             — Technical documentation


================================================================================
2. CURRENT DESKTOP RUNTIME ARCHITECTURE
================================================================================

The Electron→Tauri migration (Phase 1) was completed in the previous session.
The current architecture is:

Desktop Shell (src-tauri/):
  - src-tauri/src/lib.rs: Production-ready Tauri app shell with 4 IPC commands:
      get_app_version  — returns {version, name, identifier} from Tauri config
      get_runtime_state — returns {packaged, debug, platform, arch}
      get_app_data_dir  — resolves app data directory path
      get_backend_config — returns {url, mode} from env vars
  - Plugins: tauri-plugin-shell, tauri-plugin-process, tauri-plugin-fs,
             tauri-plugin-updater
  - Window: 1400x900 (min 1024x680), labeled "main", DevTools auto-open in debug
  - Updater: configured with endpoint template, empty pubkey (dev mode)

Frontend Desktop Bridge (client/src/lib/desktop.ts):
  - Runtime-agnostic abstraction over Tauri APIs
  - isDesktop() — detects Tauri via window.__TAURI__ / __TAURI_INTERNALS__
  - getDesktopAPI() — returns typed API object with version, update, runtime methods
  - All Tauri imports use "new Function('m','return import(m)')" pattern to prevent
    Vite from statically analyzing the dynamic imports at build time
  - Safe degradation: all functions return sensible defaults in web mode

Update Panel (client/src/components/admin/DesktopUpdatePanel.tsx):
  - Shows "Web Deployment" info card when running in browser
  - Shows Tauri update UI (check/download/install) when running in desktop
  - State machine: idle → checking → available → downloading → downloaded

Backend Connectivity Strategy:
  - The Tauri app bundles only the frontend (frontendDist: ../dist/public)
  - Backend runs as a separate process (not embedded as a Tauri sidecar)
  - ARUS_BACKEND_URL env var configures the backend URL (default: localhost:5000)
  - In production vessel deployments, the Express server runs as a system service
    and the Tauri desktop app connects to it


================================================================================
3. ELECTRON DEPENDENCIES FOUND
================================================================================

All primary Electron source code was removed in the initial migration session.
The following residual artifacts were identified and cleaned up in this audit:

STALE DIRECTORIES (DELETED):
  dist-electron/          — 1.4 MB: legacy main.cjs, icons, manifest, service-worker
  build/                  — 784 KB: Electron-era icon files, empty .icns/.ico,
                            entitlements.mac.plist, .placeholder files
  release/                — 0 B: empty directory (was electron-builder output)

STALE FILES (DELETED):
  fix-package-json.js     — Electron-only utility that sets main: electron/main.js,
                            pins electron@38.3.0, moves electron-builder to devDeps

STALE DOCUMENTATION (82 root-level .md files, ALL DELETED):
  Electron-specific build/install docs:
    BUILD_INSTRUCTIONS.md, DMG_BUILD_STATUS.md, DMG-FIX-COMPLETE.md,
    DMG_PACKAGING_GUIDE.md, DMG_SUCCESS_GUARANTEES.md, INSTALL_SIMPLIFIED.md,
    INSTALL.md, INSTALLATION-GUIDE.md, INSTALLER_FIXES_APPLIED.md,
    LAUNCHER-FIX.md, MACOS-DEPLOYMENT.md, MACOS_INSTALLATION_PLAN.md,
    MACOS_STANDALONE_SUMMARY.md, QUICK-START-MACOS.md, QUICK_START.md,
    README-MACOS-INSTALLATION.md, SETUP_MAC.md, START_HERE.md,
    WINDOWS-INSTALLATION.md, WINDOWS_INSTALLATION_SUMMARY.md

ACTIVE CODE REFERENCES (already cleaned):
  client/src/lib/electron.ts              — DELETED
  client/src/components/admin/ElectronUpdatePanel.tsx — DELETED
  electron-builder.json                   — DELETED
  vite.config.electron.ts                 — DELETED
  install-mac.sh                          — DELETED
  verify-fixes.sh                         — DELETED
  test-bundle-structure.sh                — DELETED
  test-final-bundle.sh                    — DELETED
  test-minimal-build.sh                   — DELETED
  14 ELECTRON_*.md root docs              — DELETED


================================================================================
4. TAURI IMPLEMENTATION STATUS
================================================================================

COMPLETED:
  ✅ Tauri v2 scaffold with production Rust commands (lib.rs)
  ✅ 4 IPC commands: version, runtime state, app data dir, backend config
  ✅ 4 plugins: shell, process, fs, updater
  ✅ Window configuration with proper sizing and label
  ✅ CSP security policy in tauri.conf.json
  ✅ Release profile optimized (LTO, strip, codegen-units=1)
  ✅ Frontend desktop bridge (client/src/lib/desktop.ts)
  ✅ DesktopUpdatePanel component with web fallback
  ✅ useSystemAdminData hook migrated to isDesktop()
  ✅ Build docs rewritten for Tauri (docs/BUILD_GUIDE.md, CODE_SIGNING_GUIDE.md)
  ✅ Developer setup script (scripts/dev-setup.sh)
  ✅ Icon files in src-tauri/icons/ (copied from PWA icons)

MISSING / INCOMPLETE:
  ❌ Updater public key (plugins.updater.pubkey is empty in tauri.conf.json)
     Required before any production release; must be generated with
     `npx @tauri-apps/cli signer generate`
  
  ✅ Tauri v2 capabilities/permissions
     Created src-tauri/capabilities/default.json with core, shell, process,
     updater, and filesystem permissions scoped to the main window.
  
  ✅ Properly-sized PNG icon files
     Generated 32x32, 128x128, 128x128@2x (256), icon.png (512) from SVG source.
     Remaining: icon.icns (macOS) and icon.ico (Windows) need platform-native
     conversion tools (iconutil, ImageMagick, or online converters).
  
  ❌ Tauri JS plugin packages not in package.json
     @tauri-apps/plugin-updater and @tauri-apps/plugin-process are
     dynamically imported but not listed in package.json dependencies.
     Works in web mode (imports fail silently) but the Tauri build
     may need them. Currently mitigated by the new Function() pattern.
  
  ❌ Backend sidecar / process management
     No mechanism to start the Express.js backend automatically when
     the desktop app launches. Options:
       a) Tauri sidecar plugin — spawn node server as child process
       b) External service manager — systemd/launchd manages the backend
       c) Remote backend — desktop connects to cloud/vessel server
     Current approach: option (c) via ARUS_BACKEND_URL env var.
  
  ❌ First-run setup wizard
     No UI for initial configuration when the desktop app is first
     launched (database setup, vessel ID, backend URL, admin password).
  
  ❌ One-click customer installer
     Tauri's built-in bundler creates platform installers (DMG, MSI,
     AppImage, DEB) but no post-install hooks are configured for
     database initialization or service registration.
  
  ❌ beforeBuildCommand references "npm run build:renderer"
     This script exists but only builds the frontend. The backend
     is not built or bundled as part of the Tauri build process.


================================================================================
5. INSTALLATION WORKFLOW ANALYSIS
================================================================================

CURRENT STATE:

  Developer Setup:
    scripts/dev-setup.sh — checks Node.js/Rust prerequisites, runs npm install,
    creates data directory, prints instructions for web/desktop development.
    Status: ✅ Complete and functional.

  Customer Installation:
    No customer-facing installer exists. The previous Electron installer scripts
    (install-mac.sh, build-electron-complete.sh, etc.) have been deleted.
    Status: ❌ Not implemented.

TAURI NATIVE INSTALLER SUPPORT:

  Tauri's bundler (invoked by `npm run tauri:build`) automatically produces
  platform-native installers:
    macOS:   .dmg and .app bundle
    Windows: .msi (WiX) and .exe (NSIS)
    Linux:   .deb and .AppImage

  These are configured in tauri.conf.json under bundle.targets: "all".

RECOMMENDED INSTALLATION FLOW:

  1. Customer downloads platform-specific installer from GitHub Releases
  2. Installer runs (DMG drag-to-Applications / MSI wizard / dpkg)
  3. First launch triggers first-run setup wizard:
     a. Backend configuration (cloud URL or local server)
     b. Vessel identification (for vessel deployments)
     c. Admin password setup
     d. SQLite database initialization (if vessel mode)
  4. Application connects to backend and loads dashboard

POST-INSTALL HOOKS:

  macOS:   No post-install hooks needed; first-run handles setup
  Windows: WiX supports custom actions for service registration
  Linux:   .deb postinst script can register systemd service

  For vessel deployments where the backend runs as a service:
    - macOS:  launchd plist for Express server
    - Windows: Windows Service or NSSM wrapper
    - Linux:  systemd unit file for Express server


================================================================================
6. SQLITE BOOTSTRAP ANALYSIS
================================================================================

CURRENT IMPLEMENTATION (scripts/init-sqlite-schema.js):

  Uses @libsql/client to create a SQLite database file.
  Default path: data/vessel-local.db
  (Configurable via DATABASE_PATH env var)

  Initialization sequence:
    1. Enable foreign keys and WAL mode
    2. Set synchronous = NORMAL for performance
    3. Create _schema_version table (version marker: '1.0.0-embedded')
    4. Create organizations table + seed default org ('default-org-id')
    5. Create update_settings table + seed default settings
    6. Create admin_sessions table
    7. Create admin_audit_events table
    8. Create admin_system_settings table
    9. Create performance indexes

  Additional tables are created on first application start by the server
  (Drizzle ORM pushes the full schema).

LOCAL MODE DETECTION (server/config/runtimeEnv.ts):
  isLocalMode = LOCAL_MODE=true OR EMBEDDED_MODE=true OR DEPLOYMENT_MODE=VESSEL
  isVesselMode = DEPLOYMENT_MODE=VESSEL OR EMBEDDED_MODE=true
  isCloudMode = !isLocalMode

  Database selection:
    Cloud mode  → PostgreSQL via DATABASE_URL
    Vessel mode → SQLite via libSQL (TURSO_DB_URL or local file)


================================================================================
7. FRONTEND RUNTIME DEPENDENCIES
================================================================================

DESKTOP BRIDGE (client/src/lib/desktop.ts):
  Exports:
    isDesktop()        — synchronous check for Tauri runtime
    getDesktopAPI()    — returns DesktopAPI object or undefined
    getAppVersion()    — async, returns version string or 'web'
    isPackaged()       — async, returns boolean
    checkForUpdates()  — async, returns UpdateInfo | null
    installUpdate()    — async, downloads and relaunches

  Dynamic Import Strategy:
    Uses `new Function('m', 'return import(m)')` to prevent Vite from
    statically analyzing Tauri module imports.

DESKTOP FETCH LAYER (client/src/lib/desktopFetch.ts):
  - resolveBackendUrl() — async, reads from localStorage or Tauri IPC
  - getBackendUrlSync() — synchronous, reads from cache or localStorage
  - setBackendUrl(url) — stores backend URL in localStorage + cache
  - isDesktopSetupComplete() — returns true in web mode or if backend URL set
  - testBackendConnection(url) — pings /api/healthz with 5s timeout

FIRST-RUN SETUP (client/src/pages/desktop-setup.tsx):
  - 3-step wizard: Backend URL → Vessel Selection → Admin Password
  - Shown only when isDesktop() && !isDesktopSetupComplete()
  - App.tsx guards the entire router with this check


================================================================================
8. REQUIRED MIGRATION STEPS (STATUS)
================================================================================

PHASE 1: CLEANUP ✅ COMPLETE
PHASE 2: TAURI HARDENING — Partially complete (signing keys still needed)
PHASE 3: BACKEND STRATEGY ✅ COMPLETE (Option C: Remote backend)
PHASE 4: FIRST-RUN SETUP ✅ COMPLETE
PHASE 5: INSTALLER POLISH — CI/CD done, code signing pending
```

---

## 2. `scripts/dev-setup.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "========================================"
echo "  ARUS Developer Setup"
echo "  (Not for customer/vessel installation)"
echo "========================================"
echo ""

check_command() {
  if command -v "$1" &>/dev/null; then
    echo "  ✅ $1 found: $($1 --version 2>&1 | head -1)"
    return 0
  else
    echo "  ❌ $1 not found"
    return 1
  fi
}

echo "🔍 Checking prerequisites..."
echo ""

MISSING=0

check_command node || MISSING=1
check_command npm || MISSING=1

echo ""
echo "  Optional (for desktop/Tauri development):"
if check_command rustc; then
  check_command cargo || true
else
  echo "     Install Rust: https://rustup.rs"
  echo "     (Only needed for Tauri desktop builds)"
fi

echo ""

if [ "$MISSING" -eq 1 ]; then
  echo "❌ Missing required tools. Please install them before continuing."
  exit 1
fi

echo "📦 Installing npm dependencies..."
npm install

echo ""
echo "📁 Creating data directory..."
mkdir -p data

echo ""
echo "========================================"
echo "  ✅ Setup Complete"
echo "========================================"
echo ""
echo "  Web development:"
echo "    npm run dev"
echo ""
echo "  Desktop development (requires Rust):"
echo "    npm run tauri:dev"
echo ""
echo "  Desktop build:"
echo "    npm run tauri:build"
echo ""
echo "  Database push:"
echo "    npm run db:push"
echo ""
```

---

## 3. `scripts/generate-icons.mjs`

```javascript
#!/usr/bin/env node

import sharp from 'sharp';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

async function generateIcons() {
  console.log('Generating Tauri icon files...\n');

  const svgSource = join(rootDir, 'client/public/icon-512.svg');
  const tauriIconDir = join(rootDir, 'src-tauri/icons');

  if (!existsSync(svgSource)) {
    console.error(`Source SVG not found: ${svgSource}`);
    process.exit(1);
  }

  mkdirSync(tauriIconDir, { recursive: true });

  try {
    const svgBuffer = readFileSync(svgSource);

    const targets = [
      { file: '32x32.png', size: 32 },
      { file: '128x128.png', size: 128 },
      { file: '128x128@2x.png', size: 256 },
      { file: 'icon.png', size: 512 },
    ];

    for (const { file, size } of targets) {
      await sharp(svgBuffer, { density: Math.round((size / 512) * 72 * 4) })
        .resize(size, size)
        .png()
        .toFile(join(tauriIconDir, file));
      console.log(`  Created ${file} (${size}x${size})`);
    }

    console.log('\nIcon generation complete.');
    console.log('\nFor .ico and .icns conversion (needed for Windows/macOS builds):');
    console.log('  macOS: Use iconutil or https://cloudconvert.com/png-to-icns');
    console.log('  Windows: Use https://cloudconvert.com/png-to-ico');
    console.log('  Or install ImageMagick: convert icon.png icon.ico');
  } catch (error) {
    console.error('Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();
```

---

## 4. `scripts/init-sqlite-schema.js`

```javascript
#!/usr/bin/env node
import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DATABASE_PATH || 'data/vessel-local.db';

console.log(`  Initializing database at: ${DB_PATH}`);

const dbDir = dirname(DB_PATH);
mkdirSync(dbDir, { recursive: true });

try {
  const client = createClient({
    url: `file:${DB_PATH}`
  });

  await client.execute(`
    PRAGMA foreign_keys = ON;
  `);

  await client.execute(`
    PRAGMA journal_mode = WAL;
  `);

  await client.execute(`
    PRAGMA synchronous = NORMAL;
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS _schema_version (
      version TEXT PRIMARY KEY,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  await client.execute(`
    INSERT OR REPLACE INTO _schema_version (version) VALUES ('1.0.0-embedded');
  `);

  console.log('  Creating critical system tables for embedded mode...');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  await client.execute(`
    INSERT OR IGNORE INTO organizations (id, name) VALUES ('default-org-id', 'Default Organization');
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS update_settings (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      org_id TEXT NOT NULL REFERENCES organizations(id),
      vessel_id TEXT,
      auto_update_enabled INTEGER DEFAULT 0,
      auto_update_critical_only INTEGER DEFAULT 1,
      update_check_interval INTEGER DEFAULT 21600,
      update_window_start TEXT,
      update_window_end TEXT,
      deferred_update_deadline INTEGER,
      last_check_at INTEGER,
      last_update_at INTEGER,
      current_version TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  await client.execute(`
    INSERT OR IGNORE INTO update_settings (org_id, auto_update_enabled) 
    VALUES ('default-org-id', 0);
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      org_id TEXT NOT NULL REFERENCES organizations(id),
      session_token TEXT NOT NULL UNIQUE,
      user_id TEXT,
      admin_email TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      expires_at INTEGER NOT NULL,
      last_activity_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS admin_audit_events (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      org_id TEXT NOT NULL REFERENCES organizations(id),
      user_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details TEXT DEFAULT '{}',
      ip_address TEXT,
      user_agent TEXT,
      outcome TEXT DEFAULT 'success',
      error_message TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS admin_system_settings (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      org_id TEXT NOT NULL REFERENCES organizations(id),
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      data_type TEXT DEFAULT 'string',
      description TEXT,
      is_sensitive INTEGER DEFAULT 0,
      last_modified_by TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      UNIQUE(org_id, category, key)
    );
  `);

  await client.execute(`CREATE INDEX IF NOT EXISTS idx_update_settings_org ON update_settings(org_id);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_admin_sessions_org ON admin_sessions(org_id);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_admin_audit_org ON admin_audit_events(org_id);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_admin_settings_org_cat ON admin_system_settings(org_id, category);`);

  client.close();

  console.log('  ✓ Core schema created with critical tables');
  console.log('  ✓ Default organization configured');
  console.log('  ℹ️  Additional tables will be created on first application start');
  process.exit(0);

} catch (error) {
  console.error('  ❌ Database initialization failed:', error.message);
  process.exit(1);
}
```

---

## 5. `docs/BUILD_GUIDE.md`

```markdown
# ARUS Marine - Build & Distribution Guide

Quick reference for building and distributing the ARUS Marine application across all platforms.

## Quick Start

### Web Build

\`\`\`bash
npm run build
\`\`\`

**Output location:** `dist/public/` directory

### Desktop Build (Tauri v2)

\`\`\`bash
# Build for current platform
npm run tauri:build

# Development mode with hot reload
npm run tauri:dev
\`\`\`

**Output location:** `src-tauri/target/release/bundle/`

### Prerequisites

- **Web:** Node.js 20+
- **Desktop:** Node.js 20+ and Rust toolchain (install via https://rustup.rs)

## Build Process

### Web Build

1. **Build frontend** (Vite) → `dist/public/`
2. **Build server** (esbuild) → production server bundle
3. Deploy to cloud infrastructure

### Desktop Build (Tauri)

1. **Build frontend** (Vite) → `dist/public/`
2. **Compile Rust backend** (Tauri) → native binary
3. **Bundle installer** → platform-specific package

### Manual Step-by-Step

\`\`\`bash
# 1. Build frontend
npm run build

# 2. Build desktop app (includes frontend build automatically)
npm run tauri:build
\`\`\`

## Production Builds (Signed)

### Prerequisites

1. **macOS:** Apple Developer certificate + notarization credentials
2. **Windows:** Code signing certificate (.pfx file)

See [Code Signing Guide](./CODE_SIGNING_GUIDE.md) for detailed setup instructions.

### Environment Variables

\`\`\`bash
# macOS Code Signing
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
export APPLE_ID="your-apple-id@example.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAM_ID"

# Windows Code Signing
export TAURI_SIGNING_PRIVATE_KEY="path/to/private-key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="YOUR_PASSWORD"
\`\`\`

### Build Commands

\`\`\`bash
# Build signed desktop app for current platform
npm run tauri:build
\`\`\`

## Build Artifacts

### macOS

| File | Type | Size | Use Case |
|------|------|------|----------|
| `ARUS Marine.app` | App Bundle | ~30MB | Direct use |
| `ARUS Marine_x.x.x_aarch64.dmg` | DMG | ~35MB | Apple Silicon Macs |
| `ARUS Marine_x.x.x_x64.dmg` | DMG | ~35MB | Intel Macs |

### Windows

| File | Type | Size | Use Case |
|------|------|------|----------|
| `ARUS Marine_x.x.x_x64-setup.exe` | NSIS Installer | ~25MB | Standard installation |
| `ARUS Marine_x.x.x_x64_en-US.msi` | MSI Installer | ~25MB | Enterprise deployment |

### Linux

| File | Type | Size | Use Case |
|------|------|------|----------|
| `arus-marine_x.x.x_amd64.AppImage` | AppImage | ~30MB | Universal Linux |
| `arus-marine_x.x.x_amd64.deb` | DEB | ~25MB | Debian/Ubuntu |

## Mobile Build (Capacitor)

### iOS/iPadOS

\`\`\`bash
npx cap sync ios
npx cap open ios
\`\`\`

Build via Xcode for iOS/iPadOS deployment.

## Icon Generation

Icons are generated from `public/icon-512x512.png`:

\`\`\`bash
node scripts/generate-icons.mjs
\`\`\`

**Generated icons:**
- `src-tauri/icons/` — Tauri desktop icons (32x32, 128x128, 256x256, icon.png)
- `build/icon-1024.png` — macOS base icon
- `build/icon-*.png` — Multi-resolution PNGs

## Testing Builds

### Before Distribution

1. **Test development mode first:**
   \`\`\`bash
   npm run tauri:dev
   \`\`\`

2. **Build and test release:**
   \`\`\`bash
   npm run tauri:build
   \`\`\`

3. **Check application launches:**
   - Verify UI loads correctly
   - Test database connection
   - Check all core features work

### Common Issues

**Issue:** App won't open on macOS

\`\`\`bash
xattr -cr /Applications/ARUS\ Marine.app
\`\`\`

**Issue:** "Unidentified developer" warning
- **Cause:** App is not signed or notarized
- **Solution:** Follow [Code Signing Guide](./CODE_SIGNING_GUIDE.md)

**Issue:** Build fails on missing Rust toolchain

\`\`\`bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
\`\`\`

## CI/CD Integration

### GitHub Actions Example

\`\`\`yaml
name: Build & Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: macos-latest
            target: aarch64-apple-darwin
          - os: macos-latest
            target: x86_64-apple-darwin
          - os: windows-latest
            target: x86_64-pc-windows-msvc
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu

    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: dtolnay/rust-toolchain@stable

      - name: Install dependencies
        run: npm install

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
\`\`\`

## Version Management

### Updating Version Number

Update in both `package.json` and `src-tauri/tauri.conf.json`:

\`\`\`json
{
  "version": "1.2.3"
}
\`\`\`

## Distribution

### macOS
- **Direct Distribution:** Distribute signed/notarized DMG via website
- **Mac App Store:** Submit via Xcode after App Store provisioning

### Windows
- **Direct Distribution:** Distribute signed NSIS/MSI installer
- **Microsoft Store:** Submit via Microsoft Partner Center

### Linux
- **AppImage:** Universal distribution
- **DEB package:** Debian/Ubuntu
- **Snapcraft/Flatpak:** Package manager distribution

## Resources

- [Tauri v2 Documentation](https://v2.tauri.app/)
- [Tauri Build Guide](https://v2.tauri.app/distribute/)
- [Code Signing Guide](./CODE_SIGNING_GUIDE.md)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
```

---

## 6. `docs/CODE_SIGNING_GUIDE.md`

```markdown
# Code Signing Guide for ARUS Marine

This guide covers code signing and distributing the ARUS Marine Tauri v2 desktop application for macOS and Windows.

## Table of Contents

1. [macOS Code Signing & Notarization](#macos-code-signing--notarization)
2. [Windows Code Signing](#windows-code-signing)
3. [Tauri Updater Signing](#tauri-updater-signing)
4. [Testing Unsigned Builds](#testing-unsigned-builds)
5. [Troubleshooting](#troubleshooting)

---

## macOS Code Signing & Notarization

### Prerequisites

1. **Apple Developer Account**
   - Enroll at: https://developer.apple.com/programs/
   - Cost: $99/year (individual) or $299/year (organization)

2. **Xcode Command Line Tools**
   \`\`\`bash
   xcode-select --install
   \`\`\`

### Step 1: Create Certificates

1. Open **Keychain Access** on macOS
2. Go to **Keychain Access > Certificate Assistant > Request a Certificate from a Certificate Authority**
3. Enter your email and name, select "Saved to disk"
4. Go to [Apple Developer Certificates](https://developer.apple.com/account/resources/certificates)
5. Click **+** → Select **Developer ID Application** → Upload CSR
6. Download and install the certificate

### Step 2: Create App ID

1. Go to [Identifiers](https://developer.apple.com/account/resources/identifiers)
2. Click **+** → Select **App IDs** → Choose **App** type
3. Enter:
   - Description: "ARUS Marine"
   - Bundle ID: `com.arus.marine` (matches `src-tauri/tauri.conf.json`)
4. Register

### Step 3: Configure Notarization

Create an app-specific password:
1. Go to [Apple ID account](https://appleid.apple.com/)
2. Go to **Security > App-Specific Passwords** → Generate
3. Name it "ARUS Marine Notarization"

Store credentials:
\`\`\`bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
export APPLE_ID="your-apple-id@example.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAM_ID"
\`\`\`

### Step 4: Build and Sign

\`\`\`bash
npm run tauri:build
\`\`\`

Tauri v2 handles signing and notarization automatically when the environment variables are set.

### Step 5: Verify Signing

\`\`\`bash
codesign --verify --deep --strict --verbose=2 "src-tauri/target/release/bundle/macos/ARUS Marine.app"

spctl -a -t exec -vv "src-tauri/target/release/bundle/macos/ARUS Marine.app"
\`\`\`

---

## Windows Code Signing

### Prerequisites

1. **Code Signing Certificate** from a Certificate Authority:
   - **DigiCert** (recommended): ~$500/year
   - **Sectigo**: ~$200/year
   - **GlobalSign**: ~$250/year

2. **Certificate Format:** `.pfx` or `.p12` (PKCS#12)

### Step 1: Obtain Certificate

1. Purchase "Code Signing Certificate" or "EV Code Signing Certificate"
2. Complete identity verification
3. Download certificate as `.pfx`

**Note:** EV certificates provide instant SmartScreen reputation (no "unknown publisher" warning).

### Step 2: Configure Signing

Set environment variables:
\`\`\`bash
export TAURI_SIGNING_PRIVATE_KEY="path/to/certificate.pfx"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="YOUR_PASSWORD"
\`\`\`

### Step 3: Build and Sign

\`\`\`bash
npm run tauri:build
\`\`\`

### Step 4: Verify Signing (Windows)

\`\`\`powershell
Get-AuthenticodeSignature "src-tauri\target\release\bundle\nsis\ARUS Marine Setup.exe"
\`\`\`

---

## Tauri Updater Signing

Tauri's built-in updater requires a signing key to verify update integrity.

### Generate Update Signing Keys

\`\`\`bash
npx @tauri-apps/cli signer generate -w ~/.tauri/arus-marine.key
\`\`\`

This generates a keypair. Store the private key securely.

### Configure for Builds

\`\`\`bash
export TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/arus-marine.key)
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your-password"
\`\`\`

The public key is configured in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.

---

## Testing Unsigned Builds

### macOS

Unsigned builds will show a Gatekeeper warning. Workaround:
\`\`\`bash
xattr -cr "/Applications/ARUS Marine.app"
\`\`\`

Or go to **System Preferences > Security & Privacy > Open Anyway**.

### Windows

Unsigned builds will show SmartScreen warning. Click **More info > Run anyway**.

---

## Troubleshooting

### macOS

**"No identity found":**
\`\`\`bash
security find-identity -v -p codesigning
\`\`\`

**Notarization fails:**
\`\`\`bash
xcrun notarytool log <submission-id> --keychain-profile "ARUS-Marine-Profile"
\`\`\`

### Windows

**Certificate not trusted:**
- Ensure certificate chain is complete
- CA certificate must be from a trusted authority

### General

**Build fails — missing Rust:**
\`\`\`bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
\`\`\`

**Build fails — missing system dependencies (Linux):**
\`\`\`bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev
\`\`\`

---

## Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| **macOS** | | |
| Apple Developer Program | $99 | Annual |
| Code signing certificate | Included | - |
| Notarization | Free | - |
| **Windows** | | |
| Standard Code Signing | $200-300 | Annual |
| EV Code Signing | $300-500 | Annual |
| **TOTAL (Standard)** | **$299-399/year** | |
| **TOTAL (with EV)** | **$399-599/year** | |

---

## Resources

- [Tauri v2 Code Signing](https://v2.tauri.app/distribute/sign/)
- [Tauri v2 Updater](https://v2.tauri.app/plugin/updater/)
- [Apple Developer Portal](https://developer.apple.com/)
- [Notarizing macOS Software](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Windows Code Signing](https://docs.microsoft.com/en-us/windows/win32/seccrypto/using-signtool-to-sign-a-file)
```

---

## 7. `package.json` (relevant excerpts)

```json
{
  "scripts": {
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "build:renderer": "vite build",
    "build:server": "esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outfile=server/index.js --allow-overwrite",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.9.1",
    "@tauri-apps/cli": "^2.9.6"
  }
}
```

---

## Note on Files Referenced But Not Present in Repository

The following files are referenced in `TAURI_INSTALLATION_MIGRATION_PLAN.txt` and `tauri-migration-review.md` as having been created during the migration, but do **not** currently exist as separate files in the project (their code exists only inside the migration review document):

- `client/src/lib/desktopFetch.ts` — Desktop fetch layer (backend URL resolution)
- `client/src/pages/desktop-setup.tsx` — First-run setup wizard (3-step)
- `client/src/components/admin/DesktopUpdatePanel.tsx` — Desktop update panel
- `.github/workflows/tauri-build.yml` — GitHub Actions CI/CD workflow

These components were designed and reviewed but may need to be re-created from the code captured in `tauri-migration-review.md`.
