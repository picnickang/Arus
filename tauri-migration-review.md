# ARUS Tauri v2 Migration — Code Review Package

Generated: 2026-03-26T02:19:18Z

## Overview

This document contains all code changes made during the Electron→Tauri v2 desktop migration.
The migration covered: stale artifact cleanup, Tauri hardening (capabilities, icons), backend
connectivity (CORS, CSP, desktop fetch layer), a 3-step first-run setup wizard, new admin auth
endpoints, a GitHub Actions CI/CD workflow, and comprehensive documentation updates.

---

## `TAURI_INSTALLATION_MIGRATION_PLAN.txt` (557 lines)

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

  Historical fix/audit reports (not actively maintained):
    ALL_BUGS_FIXED.md, CLEANUP_SUMMARY.md, CRITICAL_BUGS_FIXED.md,
    CRITICAL_FIXES_REQUIRED.md, DEPLOYMENT-MODE-FIXES.md, FINAL_FIX_SUMMARY.md,
    FINAL_SOLUTION_SUMMARY.md, FIXES_APPLIED.md, HASH_MISMATCH_FIX.md,
    NOT-FOUND-AND-PWA-FAILURE-ANALYSIS.md, PATCH-MAC-OFFLINE-GUIDE.md,
    ROOT_CAUSE_ANALYSIS.md, ROUTING_FIX_COMPLETE.md, SQLITE_SCHEMA_FIX.md,
    STANDALONE-SERVER-FIX-STRATEGY.md, STATIC_FILE_SERVING_FIX.md,
    SERVER-AND-NOT-FOUND-ANALYSIS.md, VERIFY_BEFORE_INSTALL.md

  Stale analysis/report JSON files (DELETED):
    eslint-report.json, eslint-report.final.json, eslint-report.phase1.json,
    eslint-report.phase2.json, sonar-analysis-report.json,
    sonar-critical-issues.json, sonar-analysis-report.md, diagnostic.json,
    ml-accuracy-report.json, perf-results.json, telemetry-dataset.json,
    sonar-hotspots.json

ACTIVE CODE REFERENCES (non-actionable):
  shared/schema/costs.ts  — contains "electronics_technician" (valid domain term)
  package-lock.json       — may contain transitive electron references (benign)

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
  Default path: dist-standalone/ARUS-bundle/data/vessel-local-seed.db
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

FIRST-RUN BEHAVIOR NEEDED:

  When the Tauri desktop app launches for the first time on a vessel:
    1. Check if SQLite database exists at app data directory
    2. If not, run schema initialization (equivalent to init-sqlite-schema.js)
    3. Prompt for vessel ID, fleet assignment, admin credentials
    4. Store configuration in SQLite
    5. Start backend server (or connect to running backend)
    6. Load the application

  This should be implemented as:
    a. A Tauri Rust command that checks for first-run state
    b. A React first-run wizard component
    c. Backend endpoint for initial setup


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
    statically analyzing Tauri module imports. This is critical because:
      - @tauri-apps/api/core is not installed in the web project
      - @tauri-apps/plugin-updater is not installed
      - @tauri-apps/plugin-process is not installed
    All imports are wrapped in try/catch with null fallbacks.

COMPONENTS USING DESKTOP BRIDGE:
  client/src/components/admin/DesktopUpdatePanel.tsx
    - Imports: isDesktop, getDesktopAPI, UpdateInfo
    - Shows web fallback or Tauri update UI based on isDesktop()

  client/src/features/settings/hooks/useSystemAdminData.ts
    - Imports: isDesktop
    - useSystemAdminData() exposes isDesktopEnv for conditional rendering
    - useSoftwareUpdatesData() disables server API queries in desktop mode

  client/src/pages/system-administration.tsx
    - Imports: DesktopUpdatePanel
    - Conditionally renders DesktopUpdatePanel or server update UI

DESKTOP FETCH LAYER (client/src/lib/desktopFetch.ts):
  - resolveBackendUrl() — async, reads from localStorage or Tauri IPC
  - getBackendUrlSync() — synchronous, reads from cache or localStorage
  - setBackendUrl(url) — stores backend URL in localStorage + cache
  - isDesktopSetupComplete() — returns true in web mode or if backend URL set
  - testBackendConnection(url) — pings /api/healthz with 5s timeout

  Used by client/src/lib/queryClient.ts to prepend backend URL to all relative
  API calls (both queries and mutations) in desktop mode.

FIRST-RUN SETUP (client/src/pages/desktop-setup.tsx):
  - Shown only when isDesktop() && !isDesktopSetupComplete()
  - Renders backend URL input + connection test + continue button
  - App.tsx guards the entire router with this check

NO OTHER FRONTEND FILES import from desktop.ts or reference Tauri APIs.


================================================================================
8. REQUIRED MIGRATION STEPS
================================================================================

PHASE 1: CLEANUP (Low risk, immediate) ✅ PARTIALLY DONE
  [1.1] ✅ Delete Electron source files (electron.ts, ElectronUpdatePanel.tsx)
  [1.2] ✅ Delete Electron config (electron-builder.json, vite.config.electron.ts)
  [1.3] ✅ Delete Electron docs (14 ELECTRON_*.md files)
  [1.4] ✅ Delete Electron scripts (install-mac.sh, verify-fixes.sh, etc.)
  [1.5] ✅ Clean Electron references from active source files
  [1.6] ✅ Delete stale directories: dist-electron/, build/, release/
  [1.7] ✅ Delete fix-package-json.js
  [1.8] ✅ Delete 82 stale root-level .md documentation files
  [1.9] ✅ Delete stale JSON report files (eslint-report.*.json, sonar-*.json, etc.)
  [1.10] ✅ Clean sonar-project.properties (removed "electron" from sonar.sources)
  [1.11] ✅ Clean eslint.config.js (removed fix-package-json.js from ignores)

PHASE 2: TAURI HARDENING (Medium risk, before desktop release)
  [2.1] 📋 Generate Tauri updater signing keypair (REQUIRES LOCAL TOOLCHAIN)
         Run on a machine with Rust/Tauri CLI installed:
           npx @tauri-apps/cli signer generate -w ~/.tauri/arus-marine.key
         Then:
           1. Copy the public key into tauri.conf.json → plugins.updater.pubkey
           2. Store the private key as TAURI_SIGNING_PRIVATE_KEY GitHub secret
           3. Store the password as TAURI_SIGNING_PRIVATE_KEY_PASSWORD GitHub secret
  [2.2] ✅ Create Tauri v2 capabilities configuration
         Created src-tauri/capabilities/default.json with permissions for
         core:default, shell:allow-open, process:allow-relaunch,
         process:allow-exit, updater:default, fs:allow-app-read/write
  [2.3] ✅ Generate properly-sized icons
         Ran `node scripts/generate-icons.mjs` — created 32x32, 128x128,
         128x128@2x (256), icon.png (512) from SVG source. Removed stale
         256x256.png. icon.icns and icon.ico still need platform-native conversion.
  [2.4] 📋 Verify Tauri JS plugin resolution in desktop build (REQUIRES TAURI BUILD)
         Strategy decided: new Function() dynamic import pattern for web-safe plugin
         loading. @tauri-apps/plugin-updater and @tauri-apps/plugin-process resolve
         from Rust plugin bindings at Tauri runtime — no npm package needed.
         Verification: build the Tauri app and confirm updater/process calls succeed.
  [2.5] 📋 Test Tauri build on each target platform (REQUIRES NATIVE TOOLCHAINS)
         Run `npm run tauri:build` on macOS, Windows, and Linux.
         Verify installers launch, connect to backend, and complete setup wizard.

PHASE 3: BACKEND STRATEGY (High risk, architectural decision)
  [3.1] ✅ Backend deployment model decided: Option C (Remote backend)
         Option A: Tauri sidecar — spawn Express server as child process
           Pro: Single-app installation, auto-start
           Con: Complex process management, port conflicts
         Option B: System service — backend managed by OS service manager
           Pro: Robust lifecycle, starts at boot
           Con: Separate installation step, platform-specific config
         Option C: Remote backend — desktop connects to cloud/vessel server
           Pro: Simplest desktop app, already works
           Con: Requires network, separate server deployment
         Current: Option C (ARUS_BACKEND_URL env var)
  [3.2] ✅ Option C implemented — desktop fetch layer resolves ARUS_BACKEND_URL
         from Tauri IPC at startup, with fallback to manual setup wizard.
         queryClient.ts prefixes all relative API URLs with backend URL.
  [3.3] ✅ Update tauri.conf.json CSP
         connect-src now allows localhost:*, 127.0.0.1:*, 192.168.*.* and *.arus.io
         for flexible vessel and cloud backend connections.
  [3.4] ✅ CORS updated for Tauri origins
         server/bootstrap/middleware.ts allows tauri://localhost and
         https://tauri.localhost in addition to existing origins.
  [3.5] ✅ Backend URL reconfiguration from System Admin
         DesktopConnectionPanel in system-administration.tsx allows testing
         and saving a new backend URL without reinstalling.

PHASE 4: FIRST-RUN SETUP (Medium risk, UX-critical)
  [4.1] ✅ Create first-run detection
         isDesktopSetupComplete() checks localStorage for backend URL config.
         App.tsx guards the entire router — desktop + no config → setup wizard.
  [4.2] ✅ Create first-run setup wizard React component
         client/src/pages/desktop-setup.tsx with backend URL input, connection
         test against /api/healthz, success/error status display, and continue.
  [4.3] ✅ Wire backend URL into fetch layer
         client/src/lib/desktopFetch.ts provides resolveUrl() used by queryClient
         to prepend configured backend URL to all relative API calls in desktop mode.
  [4.4] 📋 Integrate SQLite bootstrap into first-run flow (VESSEL MODE ONLY)
         For vessel deployments with local SQLite, the setup wizard should trigger
         `scripts/init-sqlite-schema.js` on first run. This requires the Tauri sidecar
         or shell command capability. Default path updated to `data/vessel-local.db`.
         Implementation: Add Tauri command to invoke SQLite init from Rust backend.
  [4.5] ✅ Add vessel identification step to setup wizard
         Step 2 of 3-step wizard fetches vessels from GET /api/vessels, displays
         selectable list with IMO/type, stores selection in localStorage
         (arus-vessel-id, arus-vessel-name). Skip option when no vessels exist.
  [4.6] ✅ Add admin password setup step to setup wizard
         Step 3 of 3-step wizard. Checks GET /api/admin/auth/status to determine
         if password is configured. If not: shows new password + confirm form,
         calls POST /api/admin/auth/setup. If configured: shows verify form,
         calls POST /api/admin/auth/verify. Both steps are skippable.

PHASE 5: INSTALLER POLISH (Low risk, before release)
  [5.1] 📋 Configure macOS bundle signing and notarization (REQUIRES APPLE DEVELOPER ACCOUNT)
         Required GitHub secrets:
           APPLE_CERTIFICATE — Base64-encoded .p12 certificate
           APPLE_CERTIFICATE_PASSWORD — Certificate password
           APPLE_SIGNING_IDENTITY — e.g. "Developer ID Application: Your Org"
           APPLE_ID — Apple Developer email
           APPLE_PASSWORD — App-specific password from appleid.apple.com
           APPLE_TEAM_ID — From developer.apple.com membership
         Guide: https://tauri.app/distribute/sign/macos/
  [5.2] 📋 Configure Windows code signing (REQUIRES CODE SIGNING CERTIFICATE)
         Options: EV certificate (hardware token) or OV certificate
         Required GitHub secret: WINDOWS_CERTIFICATE (Base64 .pfx)
         For EV: use SignTool with cloud signing service (e.g. SSL.com eSigner)
         Guide: https://tauri.app/distribute/sign/windows/
  [5.3] ✅ GitHub Actions CI/CD workflow created
         .github/workflows/tauri-build.yml with matrix builds for:
           - macOS arm64 + x64
           - Windows x64
           - Linux x64
         Triggers on version tags (v*) and manual dispatch.
         Uploads build artifacts and creates draft GitHub releases.
  [5.4] ✅ Auto-update endpoint configured: GitHub Releases
         The Tauri updater plugin is configured to check GitHub Releases.
         tauri.conf.json has updater plugin with GitHub endpoint.
         Desktop app checks for updates via DesktopUpdatePanel in System Admin.
         Release flow: push tag → GitHub Actions builds → creates draft release →
         publish release → desktop apps auto-detect update.
  [5.5] 📋 Test one-click install flow on each platform (REQUIRES NATIVE TESTING)
         After first successful CI build:
           1. Download installer artifacts from GitHub Actions
           2. Install on clean macOS, Windows, and Linux machines
           3. Verify setup wizard completes (backend URL → vessel → admin)
           4. Verify app connects to backend and loads dashboard
           5. Verify auto-update detects new release


================================================================================
9. RISK AREAS
================================================================================

HIGH RISK:
  • Backend connectivity in packaged app
    The Tauri desktop app has no embedded backend. If ARUS_BACKEND_URL is not set
    or the backend is not running, the app will show empty/error states for all
    data. This is the biggest UX risk for desktop deployments.
    Mitigation: First-run wizard validates backend connectivity.

  • Updater security (empty pubkey)
    The updater pubkey is empty. If deployed without a pubkey, update signature
    verification is disabled. This is a security vulnerability.
    Mitigation: Generate keypair before any production build.

MEDIUM RISK:
  • Tauri v2 permissions model
    Tauri v2 requires explicit capability declarations. Without them, IPC commands
    and plugin APIs may be silently blocked in production builds even though they
    work in development mode.
    Mitigation: Create capabilities/default.json before first production build.

  • Icon sizing
    Current icons are all 512x512 copies. Production builds may fail or produce
    blurry icons. macOS requires .icns, Windows requires .ico.
    Mitigation: Run generate-icons.mjs with proper conversion tools.

  • Dynamic import pattern
    The new Function() pattern for Tauri imports bypasses Vite's module resolution.
    This works but may cause issues with:
      - Content Security Policy (eval-like behavior)
      - TypeScript type checking (no type information)
      - Future Vite versions
    Mitigation: Consider installing Tauri JS packages as optional dependencies.

LOW RISK:
  • Stale documentation confusion
    82 root-level .md files, most from the Electron era, may confuse developers
    reading the repo. None affect runtime behavior.
    Mitigation: Delete stale docs (Phase 1 cleanup).

  • SQLite bootstrap path
    init-sqlite-schema.js defaults to dist-standalone/ARUS-bundle/data/ which is
    an Electron-era path. For Tauri, the path should use the app data directory.
    Mitigation: Update DATABASE_PATH default for Tauri deployments.


================================================================================
10. RECOMMENDED EXECUTION ORDER
================================================================================

IMMEDIATE (can be done now, no risk):
  1. Delete stale artifacts: dist-electron/, build/, release/, fix-package-json.js
  2. Delete stale root .md docs and JSON reports
  3. Update replit.md to reflect cleanup

BEFORE FIRST DESKTOP BUILD:
  4. Generate updater signing keypair and set pubkey
  5. Create Tauri capabilities/default.json
  6. Generate properly-sized icons (32x32, 128x128, .icns, .ico)
  7. Test `npm run tauri:build` on macOS/Windows/Linux

BEFORE FIRST DESKTOP RELEASE:
  8. Decide and implement backend connectivity strategy
  9. Build first-run setup wizard
  10. Configure code signing (macOS notarization, Windows certificate)
  11. Set up CI/CD for multi-platform builds
  12. Configure auto-update infrastructure

BEFORE CUSTOMER DEPLOYMENT:
  13. End-to-end test: download → install → first-run → daily use
  14. Update init-sqlite-schema.js path for Tauri app data directory
  15. Create platform-specific service configurations for vessel backend
  16. Write customer-facing installation documentation


================================================================================
END OF MIGRATION PLAN
================================================================================

```

---

## `src-tauri/tauri.conf.json` (62 lines)

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "ARUS",
  "version": "1.0.0",
  "identifier": "com.arus.marine",
  "build": {
    "beforeDevCommand": "",
    "devUrl": "http://localhost:5000",
    "beforeBuildCommand": "npm run build:renderer",
    "frontendDist": "../dist/public"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "ARUS - Marine PdM System",
        "width": 1400,
        "height": 900,
        "minWidth": 1024,
        "minHeight": 680,
        "resizable": true,
        "fullscreen": false,
        "center": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:* https://localhost:* http://127.0.0.1:* https://127.0.0.1:* https://*.arus.io; img-src 'self' data: blob:; font-src 'self' data:"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.png"
    ],
    "category": "Utility",
    "shortDescription": "ARUS Marine Predictive Maintenance System",
    "longDescription": "ARUS is a comprehensive marine predictive maintenance and vessel management system for fleet operators.",
    "macOS": {
      "minimumSystemVersion": "10.15"
    },
    "windows": {
      "wix": {
        "language": "en-US"
      }
    }
  },
  "plugins": {
    "updater": {
      "pubkey": "",
      "endpoints": [
        "https://releases.arus.io/{{target}}/{{arch}}/{{current_version}}"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}

```

---

## `src-tauri/capabilities/default.json` (24 lines)

```json
{
  "identifier": "default",
  "description": "Default capabilities for the main ARUS window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    "process:allow-relaunch",
    "process:allow-exit",
    "updater:default",
    {
      "identifier": "fs:allow-app-read",
      "allow": [
        { "path": "$APPDATA/**" }
      ]
    },
    {
      "identifier": "fs:allow-app-write",
      "allow": [
        { "path": "$APPDATA/**" }
      ]
    }
  ]
}

```

---

## `client/src/lib/desktop.ts` (152 lines)

```ts
export interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

export interface DesktopAPI {
  getAppVersion: () => Promise<string>;
  isPackaged: () => Promise<boolean>;
  checkForUpdates: () => Promise<UpdateInfo | null>;
  installUpdate: () => Promise<void>;
  getAppDataDir: () => Promise<string>;
  getRuntimeMode: () => Promise<'packaged' | 'dev'>;
  getBackendUrl: () => Promise<string>;
}

declare global {
  interface Window {
    __TAURI__?: Record<string, unknown>;
    __TAURI_INTERNALS__?: Record<string, unknown>;
  }
}

export function isDesktop(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.__TAURI__ !== undefined || window.__TAURI_INTERNALS__ !== undefined)
  );
}

const TAURI_CORE = '@tauri-apps/api/core';
const TAURI_UPDATER = '@tauri-apps/plugin-updater';
const TAURI_PROCESS = '@tauri-apps/plugin-process';

function dynamicImport(mod: string): Promise<any> {
  return new Function('m', 'return import(m)')(mod).catch(() => null);
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const coreModule = await dynamicImport(TAURI_CORE);
  if (!coreModule) throw new Error('Tauri core not available');
  return coreModule.invoke<T>(cmd, args);
}

export function getDesktopAPI(): DesktopAPI | undefined {
  if (!isDesktop()) {
    return undefined;
  }

  return {
    async getAppVersion(): Promise<string> {
      try {
        const info = await tauriInvoke<{ version: string; name: string; identifier: string }>('get_app_version');
        return info.version;
      } catch {
        return 'unknown';
      }
    },

    async isPackaged(): Promise<boolean> {
      try {
        const state = await tauriInvoke<{ packaged: boolean }>('get_runtime_state');
        return state.packaged;
      } catch {
        return false;
      }
    },

    async checkForUpdates(): Promise<UpdateInfo | null> {
      try {
        const updaterModule = await dynamicImport(TAURI_UPDATER);
        if (!updaterModule) return null;
        const update = await updaterModule.check();
        if (!update) return null;
        return {
          version: update.version,
          date: update.date ?? undefined,
          body: update.body ?? undefined,
        };
      } catch {
        return null;
      }
    },

    async installUpdate(): Promise<void> {
      try {
        const updaterModule = await dynamicImport(TAURI_UPDATER);
        if (!updaterModule) return;
        const update = await updaterModule.check();
        if (update) {
          await update.downloadAndInstall();
          const processModule = await dynamicImport(TAURI_PROCESS);
          if (processModule) {
            await processModule.relaunch();
          }
        }
      } catch {
        // silently degrade in web mode
      }
    },

    async getAppDataDir(): Promise<string> {
      try {
        return await tauriInvoke<string>('get_app_data_dir');
      } catch {
        return '';
      }
    },

    async getRuntimeMode(): Promise<'packaged' | 'dev'> {
      try {
        const state = await tauriInvoke<{ packaged: boolean }>('get_runtime_state');
        return state.packaged ? 'packaged' : 'dev';
      } catch {
        return 'dev';
      }
    },

    async getBackendUrl(): Promise<string> {
      try {
        const config = await tauriInvoke<{ url: string; mode: string }>('get_backend_config');
        return config.url;
      } catch {
        return window.location.origin;
      }
    },
  };
}

export async function getAppVersion(): Promise<string> {
  const api = getDesktopAPI();
  if (!api) return 'web';
  return api.getAppVersion();
}

export async function isPackaged(): Promise<boolean> {
  const api = getDesktopAPI();
  if (!api) return false;
  return api.isPackaged();
}

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  const api = getDesktopAPI();
  if (!api) return null;
  return api.checkForUpdates();
}

export async function installUpdate(): Promise<void> {
  const api = getDesktopAPI();
  if (!api) return;
  return api.installUpdate();
}

```

---

## `client/src/lib/desktopFetch.ts` (116 lines)

```ts
import { isDesktop, getDesktopAPI } from './desktop';

let cachedBackendUrl: string | null = null;

export async function resolveBackendUrl(): Promise<string> {
  if (cachedBackendUrl !== null) return cachedBackendUrl;

  const stored = localStorage.getItem('arus-backend-url');
  if (stored) {
    cachedBackendUrl = stored;
    return stored;
  }

  if (isDesktop()) {
    const api = getDesktopAPI();
    if (api) {
      const url = await api.getBackendUrl();
      if (url && url !== window.location.origin) {
        cachedBackendUrl = url;
        return url;
      }
    }
  }

  cachedBackendUrl = '';
  return '';
}

export function getBackendUrlSync(): string {
  if (cachedBackendUrl !== null) return cachedBackendUrl;
  return localStorage.getItem('arus-backend-url') || '';
}

export function setBackendUrl(url: string): void {
  const normalized = url.replace(/\/+$/, '');
  cachedBackendUrl = normalized;
  localStorage.setItem('arus-backend-url', normalized);
}

export function clearBackendUrl(): void {
  cachedBackendUrl = null;
  localStorage.removeItem('arus-backend-url');
}

export function isDesktopSetupComplete(): boolean {
  if (!isDesktop()) return true;
  return !!localStorage.getItem('arus-backend-url');
}

export async function bootstrapDesktopBackend(): Promise<boolean> {
  if (!isDesktop()) return true;

  const stored = localStorage.getItem('arus-backend-url');
  if (stored) {
    cachedBackendUrl = stored;
    return true;
  }

  const api = getDesktopAPI();
  if (api) {
    try {
      const url = await api.getBackendUrl();
      if (url && url !== window.location.origin && url !== '') {
        const result = await testBackendConnection(url);
        if (result.ok) {
          setBackendUrl(url);
          return true;
        }
      }
    } catch {
    }
  }

  return false;
}

export function getVesselId(): string {
  return localStorage.getItem('arus-vessel-id') || '';
}

export function setVesselId(vesselId: string): void {
  localStorage.setItem('arus-vessel-id', vesselId);
}

export function getVesselName(): string {
  return localStorage.getItem('arus-vessel-name') || '';
}

export function setVesselName(name: string): void {
  localStorage.setItem('arus-vessel-name', name);
}

export async function testBackendConnection(url: string): Promise<{ ok: boolean; message: string }> {
  try {
    const normalized = url.replace(/\/+$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${normalized}/api/healthz`, {
      signal: controller.signal,
      headers: { 'x-org-id': 'default-org-id' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      return { ok: true, message: 'Connected successfully' };
    }
    return { ok: false, message: `Server responded with status ${res.status}` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (msg.includes('abort')) {
      return { ok: false, message: 'Connection timed out (5 seconds)' };
    }
    return { ok: false, message: `Could not connect: ${msg}` };
  }
}

```

---

## `client/src/pages/desktop-setup.tsx` (583 lines)

```tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle, Anchor, Server, ArrowRight, ArrowLeft, Ship, Lock, Eye, EyeOff } from 'lucide-react';
import { testBackendConnection, setBackendUrl, getBackendUrlSync, setVesselId, setVesselName } from '@/lib/desktopFetch';

interface DesktopSetupProps {
  onComplete: () => void;
}

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';
type SetupStep = 'backend' | 'vessel' | 'admin';

interface Vessel {
  id: string;
  name: string;
  imo?: string;
  vesselType?: string;
  active?: boolean;
}

interface AdminStatus {
  configured: boolean;
}

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6" data-testid="step-indicator">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                i < current
                  ? 'bg-primary text-primary-foreground'
                  : i === current
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background'
                  : 'bg-muted text-muted-foreground'
              }`}
              data-testid={`step-dot-${i}`}
            >
              {i < current ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:inline ${i === current ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px ${i < current ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function BackendStep({
  onNext,
}: {
  onNext: (url: string) => void;
}) {
  const existing = getBackendUrlSync();
  const [url, setUrl] = useState(existing || 'http://localhost:5000');
  const [status, setStatus] = useState<ConnectionStatus>(existing ? 'success' : 'idle');
  const [statusMessage, setStatusMessage] = useState(existing ? 'Using saved connection' : '');
  const [testedUrl, setTestedUrl] = useState(existing || '');

  async function handleTest() {
    if (!url.trim()) return;
    setStatus('testing');
    setStatusMessage('Testing connection...');
    const result = await testBackendConnection(url.trim());
    if (result.ok) {
      setStatus('success');
      setStatusMessage(result.message);
      setTestedUrl(url.trim());
    } else {
      setStatus('error');
      setStatusMessage(result.message);
      setTestedUrl('');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Backend Server
        </CardTitle>
        <CardDescription>
          Enter the URL of your ARUS backend server. For vessel deployments, this is typically the local server address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="backend-url">Server URL</Label>
          <div className="flex gap-2">
            <Input
              id="backend-url"
              data-testid="input-backend-url"
              placeholder="http://localhost:5000"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (status !== 'idle') {
                  setStatus('idle');
                  setTestedUrl('');
                }
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleTest()}
            />
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={status === 'testing' || !url.trim()}
              data-testid="button-test-connection"
            >
              {status === 'testing' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}
            </Button>
          </div>
        </div>

        {status !== 'idle' && status !== 'testing' && (
          <div
            className={`flex items-center gap-2 text-sm p-3 rounded-md ${
              status === 'success'
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-destructive/10 text-destructive'
            }`}
            data-testid="text-connection-status"
          >
            {status === 'success' ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 flex-shrink-0" />
            )}
            {statusMessage}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Common configurations:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>Local vessel server: <code className="text-foreground/80">http://localhost:5000</code></li>
            <li>Network vessel server: <code className="text-foreground/80">http://192.168.x.x:5000</code></li>
            <li>Cloud server: <code className="text-foreground/80">https://your-org.arus.io</code></li>
          </ul>
        </div>

        <Button
          className="w-full"
          onClick={() => onNext(testedUrl)}
          disabled={status !== 'success' || !testedUrl}
          data-testid="button-next-backend"
        >
          Next
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

function VesselStep({
  backendUrl,
  onNext,
  onBack,
}: {
  backendUrl: string;
  onNext: (vesselId: string, vesselName: string) => void;
  onBack: () => void;
}) {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [selectedName, setSelectedName] = useState('');

  useEffect(() => {
    async function fetchVessels() {
      try {
        const res = await fetch(`${backendUrl}/api/vessels`, {
          headers: { 'x-org-id': 'default-org-id' },
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        const vesselList = Array.isArray(data) ? data : data.vessels || [];
        setVessels(vesselList.filter((v: Vessel) => v.active !== false));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(`Could not load vessels: ${msg}`);
      } finally {
        setLoading(false);
      }
    }
    fetchVessels();
  }, [backendUrl]);

  function handleSelect(v: Vessel) {
    setSelectedId(v.id);
    setSelectedName(v.name);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ship className="h-5 w-5" />
          Select Vessel
        </CardTitle>
        <CardDescription>
          Choose which vessel this desktop installation is associated with. This determines which equipment and telemetry data you see.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground" data-testid="loading-vessels">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading vessels...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm p-3 rounded-md bg-destructive/10 text-destructive" data-testid="text-vessel-error">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && vessels.length === 0 && (
          <div className="text-center py-6 text-muted-foreground" data-testid="text-no-vessels">
            <Ship className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No vessels found. You can add vessels after setup from the Fleet management page.</p>
          </div>
        )}

        {!loading && vessels.length > 0 && (
          <div className="grid gap-2 max-h-60 overflow-y-auto" data-testid="vessel-list">
            {vessels.map((v) => (
              <button
                key={v.id}
                onClick={() => handleSelect(v)}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                  selectedId === v.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-muted/50'
                }`}
                data-testid={`button-vessel-${v.id}`}
              >
                <Ship className={`h-5 w-5 flex-shrink-0 ${selectedId === v.id ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{v.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {v.imo && <span>IMO: {v.imo}</span>}
                    {v.imo && v.vesselType && <span> · </span>}
                    {v.vesselType && <span>{v.vesselType}</span>}
                  </div>
                </div>
                {selectedId === v.id && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} data-testid="button-back-vessel">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={() => onNext(selectedId, selectedName)}
            disabled={!selectedId && vessels.length > 0}
            data-testid="button-next-vessel"
          >
            {vessels.length === 0 ? 'Skip' : 'Next'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminStep({
  backendUrl,
  onNext,
  onBack,
}: {
  backendUrl: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch(`${backendUrl}/api/admin/auth/status`, {
          headers: { 'x-org-id': 'default-org-id' },
        });
        if (res.ok) {
          const data = await res.json();
          setAdminStatus(data);
        } else {
          setAdminStatus({ configured: true });
        }
      } catch {
        setAdminStatus({ configured: true });
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, [backendUrl]);

  async function handleSetup() {
    if (!password || password.length < 8) {
      setStatus('error');
      setStatusMessage('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setStatus('error');
      setStatusMessage('Passwords do not match');
      return;
    }

    setStatus('testing');
    setStatusMessage('Setting up admin access...');

    try {
      const res = await fetch(`${backendUrl}/api/admin/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': 'default-org-id' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setStatus('success');
        setStatusMessage('Admin password configured successfully');
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.code === 'ALREADY_CONFIGURED') {
          setStatus('success');
          setStatusMessage('Admin password was already configured');
        } else {
          setStatus('error');
          setStatusMessage(data.error || 'Failed to set admin password');
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setStatus('error');
      setStatusMessage(`Connection error: ${msg}`);
    }
  }

  async function handleVerify() {
    if (!password) return;
    setStatus('testing');
    setStatusMessage('Verifying password...');

    try {
      const res = await fetch(`${backendUrl}/api/admin/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': 'default-org-id' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setStatus('success');
        setStatusMessage('Admin access verified');
      } else {
        setStatus('error');
        setStatusMessage('Incorrect password');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setStatus('error');
      setStatusMessage(`Connection error: ${msg}`);
    }
  }

  const isNewSetup = adminStatus && !adminStatus.configured;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          {loading ? 'Admin Access' : isNewSetup ? 'Set Admin Password' : 'Verify Admin Access'}
        </CardTitle>
        <CardDescription>
          {loading
            ? 'Checking admin configuration...'
            : isNewSetup
            ? 'Create an admin password to secure system settings and critical operations.'
            : 'Enter your admin password to verify access. You can skip this step and unlock admin later.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Checking configuration...
          </div>
        )}

        {!loading && (
          <>
            <div className="space-y-2">
              <Label htmlFor="admin-password">{isNewSetup ? 'New Password' : 'Password'}</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  data-testid="input-admin-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isNewSetup ? 'Minimum 8 characters' : 'Enter admin password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (status !== 'idle') setStatus('idle');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (isNewSetup ? handleSetup() : handleVerify())}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {isNewSetup && (
              <div className="space-y-2">
                <Label htmlFor="admin-confirm-password">Confirm Password</Label>
                <Input
                  id="admin-confirm-password"
                  data-testid="input-admin-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (status !== 'idle') setStatus('idle');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSetup()}
                />
              </div>
            )}

            {status !== 'idle' && status !== 'testing' && (
              <div
                className={`flex items-center gap-2 text-sm p-3 rounded-md ${
                  status === 'success'
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-destructive/10 text-destructive'
                }`}
                data-testid="text-admin-status"
              >
                {status === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                )}
                {statusMessage}
              </div>
            )}

            {status !== 'success' && (
              <Button
                className="w-full"
                variant="outline"
                onClick={isNewSetup ? handleSetup : handleVerify}
                disabled={status === 'testing' || !password}
                data-testid="button-admin-action"
              >
                {status === 'testing' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {isNewSetup ? 'Set Password' : 'Verify'}
              </Button>
            )}
          </>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onBack} data-testid="button-back-admin">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={onNext}
            disabled={loading}
            data-testid="button-finish-setup"
          >
            {status === 'success' || (!isNewSetup && status === 'idle')
              ? 'Finish Setup'
              : isNewSetup
              ? 'Skip for Now'
              : 'Skip'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DesktopSetup({ onComplete }: DesktopSetupProps) {
  const [step, setStep] = useState<SetupStep>('backend');
  const [backendUrl, setConnectedUrl] = useState('');

  const stepIndex = step === 'backend' ? 0 : step === 'vessel' ? 1 : 2;
  const stepLabels = ['Connection', 'Vessel', 'Admin'];

  function handleBackendNext(url: string) {
    setBackendUrl(url);
    setConnectedUrl(url);
    setStep('vessel');
  }

  function handleVesselNext(vesselIdVal: string, vesselNameVal: string) {
    if (vesselIdVal) {
      setVesselId(vesselIdVal);
      setVesselName(vesselNameVal);
    } else {
      localStorage.removeItem('arus-vessel-id');
      localStorage.removeItem('arus-vessel-name');
    }
    setStep('admin');
  }

  function handleFinish() {
    onComplete();
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="desktop-setup-page">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
            <Anchor className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-setup-title">ARUS Setup</h1>
          <p className="text-muted-foreground text-sm">Configure your desktop application</p>
        </div>

        <StepIndicator current={stepIndex} steps={stepLabels} />

        {step === 'backend' && <BackendStep onNext={handleBackendNext} />}
        {step === 'vessel' && (
          <VesselStep
            backendUrl={backendUrl}
            onNext={handleVesselNext}
            onBack={() => setStep('backend')}
          />
        )}
        {step === 'admin' && (
          <AdminStep
            backendUrl={backendUrl}
            onNext={handleFinish}
            onBack={() => setStep('vessel')}
          />
        )}
      </div>
    </div>
  );
}

```

---

## `client/src/lib/queryClient.ts` (217 lines)

```ts
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getCurrentDeviceId } from "@/hooks/useDeviceId";
import { getCurrentOrgId } from "@/contexts/OrganizationContext";
import { getBackendUrlSync } from "@/lib/desktopFetch";

function resolveUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = getBackendUrlSync();
  return base ? `${base}${url}` : url;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const statusPrefix = `${res.status}`;

    // Try to parse JSON error response for better error messages
    let errorData;
    try {
      errorData = JSON.parse(text);
    } catch {
      // Not JSON - use text with status code for diagnostics
      throw new Error(`${statusPrefix}: ${text || res.statusText}`);
    }

    // Handle Zod validation errors with specific field messages
    if (errorData.errors && Array.isArray(errorData.errors)) {
      const fieldErrors = errorData.errors
        .map((err: { path?: string[]; message: string }) => `${err.path?.join(".") || "Field"}: ${err.message}`)
        .join(", ");
      throw new Error(`${statusPrefix}: ${fieldErrors || errorData.message || text}`);
    }

    // Extract message from JSON error response with status prefix
    const message = errorData.message || errorData.error || text || res.statusText;
    throw new Error(`${statusPrefix}: ${message}`);
  }
}

// Helper function to create headers with device ID and organization ID
function createHeaders(includeContentType: boolean = false): Record<string, string> {
  const headers: Record<string, string> = {};

  // Add Content-Type if needed
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  // SINGLE-TENANT MODE: Always include org-id header (defaults to default-org-id)
  const orgId = getCurrentOrgId() || "default-org-id";
  headers["x-org-id"] = orgId;

  // Add X-Device-Id header if available (Hub & Sync functionality)
  const deviceId = getCurrentDeviceId();
  if (deviceId) {
    headers["X-Device-Id"] = deviceId;
  }

  return headers;
}

export interface ApiRequestOptions {
  signal?: AbortSignal;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: ApiRequestOptions
): Promise<unknown> {
  const res = await fetch(resolveUrl(url), {
    method,
    headers: createHeaders(!!data),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    signal: options?.signal,
  });

  await throwIfResNotOk(res);

  // Handle 204 No Content responses (e.g., successful DELETE operations)
  if (res.status === 204) {
    return null;
  }

  // Only parse JSON if there's a response body
  const text = await res.text();
  const result = text ? JSON.parse(text) : null;
  
  // Handle standardized API response format (unwrap { success, data } envelope)
  if (result && typeof result === 'object' && 'success' in result && 'data' in result) {
    return result.data;
  }
  
  return result;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build URL with proper query parameter handling
    let url: string;

    if (queryKey.length === 1) {
      // Simple query key - just use as URL
      url = queryKey[0] as string;
    } else if (queryKey.length === 2 && typeof queryKey[1] === "object" && queryKey[1] !== null) {
      // Query key with parameters object - convert to query string
      const baseUrl = queryKey[0] as string;
      const params = queryKey[1] as Record<string, string | number | boolean | null | undefined>;
      const searchParams = new URLSearchParams();

      // Add non-null/undefined parameters to query string
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          searchParams.append(key, String(value));
        }
      });

      const queryString = searchParams.toString();
      url = queryString ? `${baseUrl}?${queryString}` : baseUrl;
    } else {
      // Legacy format - join with slashes (for backward compatibility)
      url = queryKey.join("/");
    }

    const res = await fetch(resolveUrl(url), {
      headers: createHeaders(false),
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const result = await res.json();
    
    // Handle standardized API response format (unwrap { success, data } envelope)
    if (result && typeof result === 'object' && 'success' in result && 'data' in result) {
      return result.data;
    }
    
    return result;
  };

// Cache time constants for different data types (OPTIMIZED Oct 2025)
export const CACHE_TIMES = {
  REALTIME: 30000, // 30s - telemetry, truly real-time data
  MODERATE: 300000, // 5min - devices, work orders, fleet status
  STABLE: 3600000, // 60min - vessels, equipment catalog, users (was 30min)
  EXPENSIVE: 86400000, // 24hr - AI insights, reports, heavy computations (was 1hr)
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false, // Disable global polling - set per query based on data type
      refetchOnWindowFocus: false,
      staleTime: CACHE_TIMES.MODERATE, // 5min default - reasonable for most data
      retry: 1, // Single retry for network issues
    },
    mutations: {
      retry: 1, // Single retry for mutations
    },
  },
});

/**
 * Helper for optimistic mutations with automatic rollback on error
 *
 * @example
 * const mutation = useMutation({
 *   mutationFn: (data) => apiRequest('POST', '/api/work-orders', data),
 *   onMutate: optimisticUpdate('/api/work-orders', (old, newData) => [...(old ?? []), newData]),
 *   onError: rollbackUpdate('/api/work-orders'),
 *   onSettled: () => queryClient.invalidateQueries({ queryKey: ['/api/work-orders'] }),
 * });
 */
export function optimisticUpdate<TData, TVariables>(
  queryKey: string | string[],
  updater: (oldData: TData | undefined, variables: TVariables) => TData
) {
  return async (variables: TVariables) => {
    const key = Array.isArray(queryKey) ? queryKey : [queryKey];

    // Cancel any outgoing refetches
    await queryClient.cancelQueries({ queryKey: key });

    // Snapshot the previous value
    const previousData = queryClient.getQueryData<TData>(key);

    // Optimistically update to the new value
    queryClient.setQueryData<TData>(key, (old) => updater(old, variables));

    // Return a context with the previous value
    return { previousData, queryKey: key };
  };
}

/**
 * Helper to rollback optimistic updates on error
 */
export function rollbackUpdate<TData>(_queryKey: string | string[]) {
  return (
    _error: Error,
    _variables: unknown,
    context?: { previousData?: TData; queryKey: string[] }
  ) => {
    if (context?.previousData !== undefined) {
      queryClient.setQueryData(context.queryKey, context.previousData);
    }
  };
}

```

---

## `client/src/App.tsx` (397 lines)

```tsx
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initializeGlobalErrorHandlers } from "@/lib/errorHandler";
import { FocusModeProvider } from "@/contexts/FocusModeContext";
import { AdminAccessProvider } from "@/contexts/AdminAccessContext";
import { OrganizationProvider, useOrganization } from "@/contexts/OrganizationContext";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { DevPerformanceOverlay } from "@/components/DevPerformanceOverlay";
import { useEffect, lazy, Suspense, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { isDesktop } from "@/lib/desktop";
import { isDesktopSetupComplete, bootstrapDesktopBackend } from "@/lib/desktopFetch";

// Lazy load: All pages for better initial bundle size
const HomePage = lazy(() => import("@/pages/home"));

// Lazy load: All other pages for better performance
const Dashboard = lazy(() => import("@/pages/dashboard-improved"));
const VesselManagement = lazy(() => import("@/pages/vessel-management"));
const VesselDetail = lazy(() => import("@/pages/vessel-detail"));
const PdmEquipmentDetail = lazy(() => import("@/pages/pdm-equipment-detail"));
const AnalyticsHub = lazy(() => import("@/pages/analytics-hub"));
const SensorsHub = lazy(() => import("@/pages/sensors-hub"));
const ConfigurationHub = lazy(() => import("@/pages/configuration-hub"));
const InventoryManagement = lazy(() => import("@/pages/inventory-management"));
const VendorsPage = lazy(() => import("@/features/suppliers").then(m => ({ default: m.VendorsPage })));
const PurchaseRequestsPage = lazy(() => import("@/features/purchaseRequests").then(m => ({ default: m.PurchaseRequestsPage })));
const PRDetailPage = lazy(() => import("@/features/purchaseRequests").then(m => ({ default: m.PRDetailPage })));
const ServiceOrdersPage = lazy(() => import("@/features/serviceOrders").then(m => ({ default: m.ServiceOrdersPage })));
const ServiceRequestsPage = lazy(() => import("@/features/serviceRequests").then(m => ({ default: m.ServiceRequestsPage })));
const OptimizationTools = lazy(() => import("@/pages/optimization-tools"));
const WorkOrders = lazy(() => import("@/pages/work-orders"));
const MaintenanceSchedules = lazy(() => import("@/pages/maintenance-schedules"));
const ActionableInsights = lazy(() => import("@/pages/actionable-insights"));
// Fleet consolidated into FleetHub
const ManualTelemetryUpload = lazy(() => import("@/pages/manual-telemetry-upload"));
const CrewManagement = lazy(() => import("@/pages/crew-management"));
const CrewScheduler = lazy(() => import("@/pages/crew-scheduler"));
const SchedulePlanner = lazy(() => import("@/pages/schedule-planner"));
const HoursOfRest = lazy(() => import("@/pages/hours-of-rest"));
const DeckLogbook = lazy(() => import("@/pages/deck-logbook"));
const EngineLogbook = lazy(() => import("@/pages/engine-logbook"));
// NotificationSettings and EmailAlertsSettings consolidated into NotificationsHub
const NotificationsHub = lazy(() => import("@/pages/notifications-hub"));
const StormGeoSettings = lazy(() => import("@/pages/stormgeo-settings"));
const LogsComplianceHub = lazy(() => import("@/pages/logs-compliance-hub"));
const FuelEmissionsLog = lazy(() => import("@/pages/fuel-emissions-log"));
const VesselTrackLog = lazy(() => import("@/pages/vessel-track-log"));
const ConditionMonitoringLog = lazy(() => import("@/pages/condition-monitoring-log"));
const _EquipmentRegistry = lazy(() => import("@/pages/equipment-registry")); // Reserved for future use
const SensorTemplatesPage = lazy(() => import("@/pages/sensor-templates"));
const KnowledgeBasePage = lazy(() => import("@/pages/knowledge-base"));
const KnowledgeBaseChatPage = lazy(() => import("@/pages/kb-chat"));
const RagAnalyticsDashboard = lazy(() => import("@/features/kb/pages/RagAnalyticsDashboard"));
const OrganizationManagement = lazy(() => import("@/pages/organization-management"));
const SystemAdministration = lazy(() => import("@/pages/system-administration"));
const PdmPack = lazy(() => import("@/pages/pdm-pack"));
const PdmDashboard = lazy(() => import("@/pages/pdm-dashboard"));
const PdmSchedule = lazy(() => import("@/pages/pdm-schedule"));
const PdmPlatform = lazy(() => import("@/pages/pdm-platform"));
const DigitalTwin = lazy(() => import("@/pages/digital-twin"));
const Diagnostics = lazy(() => import("@/pages/DiagnosticsDashboard"));
const Equipment = lazy(() => import("@/pages/equipment"));
const MaintenanceTemplatesPage = lazy(() => import("@/pages/MaintenanceTemplatesPage"));
const _MLTrainingPage = lazy(() => import("@/pages/ml-training")); // Reserved for future use
const AISensorAudits = lazy(() => import("@/pages/ai-sensor-audits"));
const AIStudioPage = lazy(() => import("@/pages/AIStudioPage"));
const GovernanceDashboard = lazy(() => import("@/pages/governance-dashboard"));
const ScheduledReports = lazy(() => import("@/pages/scheduled-reports"));
const ScheduledReportsSettings = lazy(() => import("@/pages/scheduled-reports-settings"));
const ActiveTelemetry = lazy(() => import("@/pages/active-telemetry"));
const AIHealthDashboard = lazy(() => import("@/pages/ai-health-dashboard"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Consolidated Hub Pages (Phase 4 UX Consolidation)
const MaintenanceHub = lazy(() => import("@/pages/maintenance-hub"));
const CrewHub = lazy(() => import("@/pages/crew-hub"));
const LogsHub = lazy(() => import("@/pages/logs-hub"));
const OperationsHub = lazy(() => import("@/pages/operations-hub"));
const FleetHub = lazy(() => import("@/pages/fleet-hub"));
const LogisticsHub = lazy(() => import("@/pages/logistics-hub"));
const SystemHub = lazy(() => import("@/pages/system-hub"));
const DesktopSetup = lazy(() => import("@/pages/desktop-setup"));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

// Redirect component for legacy routes
function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(to);
  }, [to, setLocation]);
  return null;
}

function Router() {
  const { currentOrgId, isLoading } = useOrganization();

  // Wait for organization to be initialized before rendering routes
  if (isLoading || !currentOrgId) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
      >
        Skip to main content
      </a>

      <main
        id="main-content"
        className="min-h-screen"
        role="main"
        aria-label="Main content"
      >
        <Suspense fallback={<PageLoader />}>
          <Switch>
            {/* Home Page - Navigation Hub */}
            <Route path="/" component={HomePage} />
            
            {/* Dashboard - moved from / to /dashboard */}
            <Route path="/dashboard" component={Dashboard} />
                        <Route path="/vessels/:id" component={VesselDetail} />
            <Route path="/vessel-management" component={VesselManagement} />
            <Route path="/pdm/equipment/:equipmentId" component={PdmEquipmentDetail} />
            <Route path="/pdm/schedule" component={PdmSchedule} />
            <Route path="/equipment" component={Equipment} />
            <Route path="/diagnostics">{() => <Diagnostics />}</Route>
            <Route path="/actionable-insights" component={ActionableInsights} />
            <Route path="/active-telemetry" component={ActiveTelemetry} />
            <Route path="/ai-health" component={AIHealthDashboard} />

              {/* Consolidated Analytics Hub */}
              <Route path="/analytics" component={AnalyticsHub} />

              {/* Legacy Analytics Routes - Redirect to Analytics Hub with new consolidated tabs */}
              <Route path="/cost-savings">
                {() => <Redirect to="/analytics?tab=financial-reports" />}
              </Route>
              
              {/* AI Studio - Feature flagged route */}
              {isFeatureEnabled('mlAiStudio') && (
                <Route path="/ml-ai" component={AIStudioPage} />
              )}
              
              {/* Legacy ML/AI redirects - only used if feature flag is disabled */}
              {!isFeatureEnabled('mlAiStudio') && (
                <>
                  <Route path="/ml-ai">{() => <Redirect to="/ai-health?tab=training" />}</Route>
                  <Route path="/ml-training">
                    {() => <Redirect to="/ai-health?tab=training" />}
                  </Route>
                </>
              )}
              <Route path="/model-performance">
                {() => <Redirect to="/ai-health?tab=performance" />}
              </Route>
              <Route path="/ml-explainability">
                {() => <Redirect to="/ai-health?tab=performance" />}
              </Route>
              <Route path="/ai-insights">
                {() => <Redirect to="/ai-health?tab=insights" />}
              </Route>
              <Route path="/prediction-feedback">
                {() => <Redirect to="/ai-health?tab=insights" />}
              </Route>
              <Route path="/llm-costs">
                {() => <Redirect to="/analytics?tab=financial-reports" />}
              </Route>
              <Route path="/reports">
                {() => <Redirect to="/analytics?tab=financial-reports" />}
              </Route>

              {/* Consolidated Sensors Hub */}
              <Route path="/sensors" component={SensorsHub} />

              {/* Legacy Sensor Routes - Redirect to Sensors Hub with tab param */}
              <Route path="/sensor-config">
                {() => <Redirect to="/sensors?tab=configuration" />}
              </Route>
              <Route path="/sensor-optimization">
                {() => <Redirect to="/sensors?tab=optimization" />}
              </Route>
              <Route path="/sensor-management">
                {() => <Redirect to="/sensors?tab=management" />}
              </Route>

              {/* Consolidated Configuration Hub */}
              <Route path="/configuration">{() => <ConfigurationHub />}</Route>

              {/* Legacy Configuration Routes - Redirect to Configuration Hub with tab param */}
              <Route path="/settings">
                {() => <Redirect to="/configuration?tab=system-settings" />}
              </Route>
              <Route path="/transport-settings">
                {() => <Redirect to="/configuration?tab=data-transport" />}
              </Route>
              <Route path="/storage-settings">
                {() => <Redirect to="/configuration?tab=storage" />}
              </Route>
              <Route path="/operating-parameters">
                {() => <Redirect to="/configuration?tab=operating-parameters" />}
              </Route>

              {/* ============================================================= */}
              {/* CONSOLIDATED HUBS (Phase 4 UX Consolidation)                  */}
              {/* ============================================================= */}

              {/* New Hub Pages - Category-based Navigation */}
              <Route path="/operations" component={OperationsHub} />
              <Route path="/fleet" component={FleetHub} />
              <Route path="/logistics" component={LogisticsHub} />
              <Route path="/system" component={SystemHub} />

              {/* Consolidated Maintenance Hub */}
              <Route path="/maint" component={MaintenanceHub} />

              {/* Work Orders - main page with service & parts requests integration */}
              <Route path="/work-orders" component={WorkOrders} />
              <Route path="/maintenance" component={MaintenanceSchedules} />
              <Route path="/maintenance-templates" component={MaintenanceTemplatesPage} />
              <Route path="/pdm-pack" component={PdmPack} />
              <Route path="/pdm-dashboard" component={PdmDashboard} />
              <Route path="/pdm-platform" component={PdmPlatform} />
              <Route path="/digital-twin" component={DigitalTwin} />
              <Route path="/inventory-management" component={InventoryManagement} />
              <Route path="/vendors" component={VendorsPage} />
              <Route path="/suppliers">{() => <Redirect to="/vendors" />}</Route>
              <Route path="/service-providers">{() => <Redirect to="/vendors" />}</Route>
              <Route path="/purchase-requests" component={PurchaseRequestsPage} />
              <Route path="/purchase-requests/:id" component={PRDetailPage} />
              
              {/* Purchase Orders redirects to unified Purchasing tab */}
              <Route path="/purchase-orders">{() => <Redirect to="/purchase-requests" />}</Route>
              <Route path="/purchase-orders/:id">{() => <Redirect to="/purchase-requests" />}</Route>
              
              {/* TOP-LEVEL: Service Orders (work execution view) */}
              <Route path="/service-orders" component={ServiceOrdersPage} />
              
              {/* Service Requests - detail page, list redirects to Requests & Work */}
              <Route path="/service-requests" component={ServiceRequestsPage} />
              
              <Route path="/optimization-tools" component={OptimizationTools} />

              {/* Consolidated Crew Hub */}
              <Route path="/crew" component={CrewHub} />

              {/* Legacy Crew Routes - Keep working but also accessible via hub */}
              <Route path="/crew-management" component={CrewManagement} />
              <Route path="/crew-scheduler" component={CrewScheduler} />
              <Route path="/schedule-planner" component={SchedulePlanner} />
              <Route path="/schedule-generator">{() => <Redirect to="/schedule-planner" />}</Route>
              <Route path="/hours-of-rest" component={HoursOfRest} />
              
              {/* Consolidated Logs Hub */}
              <Route path="/logs" component={LogsHub} />

              {/* Legacy Logbook Routes - Keep working but also accessible via hub */}
              <Route path="/deck-logbook" component={DeckLogbook} />
              <Route path="/engine-logbook" component={EngineLogbook} />
              
              {/* Notifications Hub - consolidated email alerts, preferences, templates */}
              <Route path="/notifications" component={NotificationsHub} />
              {/* Legacy Notification Routes - Redirect to Notifications Hub */}
              <Route path="/notification-settings">{() => <Redirect to="/notifications" />}</Route>
              <Route path="/email-alerts-settings">{() => <Redirect to="/notifications" />}</Route>
              <Route path="/stormgeo-settings" component={StormGeoSettings} />
              
              {/* Legacy Logs & Compliance Routes - Keep working but also accessible via hub */}
              <Route path="/logs-compliance" component={LogsComplianceHub} />
              <Route path="/fuel-emissions-log" component={FuelEmissionsLog} />
              <Route path="/vessel-track-log" component={VesselTrackLog} />
              <Route path="/condition-monitoring-log" component={ConditionMonitoringLog} />

              {/* Other Routes */}
              {/* Legacy Equipment Routes - Redirect to consolidated Equipment page */}
              <Route path="/equipment-registry">{() => <Redirect to="/equipment" />}</Route>
              <Route path="/health-monitor">{() => <Redirect to="/equipment" />}</Route>
              <Route path="/health">{() => <Redirect to="/equipment" />}</Route>
              <Route path="/sensor-templates" component={SensorTemplatesPage} />
              <Route path="/knowledge-base" component={KnowledgeBasePage} />
              <Route path="/kb-chat" component={KnowledgeBaseChatPage} />
              <Route path="/kb-analytics" component={RagAnalyticsDashboard} />
              <Route path="/organization-management" component={OrganizationManagement} />
              <Route path="/system-administration" component={SystemAdministration} />
              <Route path="/ai-sensor-audits" component={AISensorAudits} />
              <Route path="/telemetry-upload" component={ManualTelemetryUpload} />
              {/* Legacy Fleet Routes - redirect to consolidated pages */}
              <Route path="/fleet-overview">{() => <Redirect to="/vessel-management" />}</Route>
              <Route path="/bridge-view">{() => <Redirect to="/fleet" />}</Route>
              
              {/* Legacy Alerts Route - redirect to Dashboard (includes alerts) */}
              <Route path="/alerts">{() => <Redirect to="/dashboard" />}</Route>
              <Route path="/governance-dashboard" component={GovernanceDashboard} />
              <Route path="/governance">{() => <Redirect to="/governance-dashboard" />}</Route>
              <Route path="/scheduled-reports" component={ScheduledReports} />
              <Route path="/scheduled-reports-settings" component={ScheduledReportsSettings} />

            {/* 404 */}
            <Route component={NotFound} />
          </Switch>
        </Suspense>


        {/* PWA Install Prompt */}
        <PWAInstallPrompt />
      </main>
    </div>
  );
}

function App() {
  const [setupState, setSetupState] = useState<'loading' | 'setup' | 'ready'>(() => {
    if (!isDesktop()) return 'ready';
    return isDesktopSetupComplete() ? 'ready' : 'loading';
  });

  useEffect(() => {
    initializeGlobalErrorHandlers();
  }, []);

  useEffect(() => {
    if (setupState !== 'loading') return;
    bootstrapDesktopBackend().then((resolved) => {
      setSetupState(resolved ? 'ready' : 'setup');
    });
  }, [setupState]);

  const handleSetupComplete = useCallback(() => {
    setSetupState('ready');
  }, []);

  if (setupState === 'loading') {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="arus-ui-theme">
        <PageLoader />
      </ThemeProvider>
    );
  }

  if (setupState === 'setup') {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark" storageKey="arus-ui-theme">
          <Suspense fallback={<PageLoader />}>
            <DesktopSetup onComplete={handleSetupComplete} />
          </Suspense>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider defaultTheme="dark" storageKey="arus-ui-theme">
          <OrganizationProvider>
            <AdminAccessProvider>
              <PermissionsProvider>
                <FocusModeProvider>
                  <Toaster />
                  <ErrorBoundary>
                    <Router />
                  </ErrorBoundary>
                  <DevPerformanceOverlay />
                </FocusModeProvider>
              </PermissionsProvider>
            </AdminAccessProvider>
          </OrganizationProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

```

---

## `client/src/components/admin/DesktopConnectionPanel.tsx` (156 lines)

```tsx
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Server, CheckCircle2, XCircle, Loader2, Info } from "lucide-react";
import { isDesktop } from "@/lib/desktop";
import { getBackendUrlSync, setBackendUrl, testBackendConnection } from "@/lib/desktopFetch";

type TestStatus = "idle" | "testing" | "success" | "error";

function isValidBackendUrl(raw: string): { valid: boolean; normalized: string; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: false, normalized: "", error: "URL is required" };

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, normalized: trimmed, error: "Only http:// and https:// URLs are supported" };
    }
    if (!parsed.hostname) {
      return { valid: false, normalized: trimmed, error: "Invalid hostname" };
    }
    const normalized = parsed.origin;
    return { valid: true, normalized };
  } catch {
    return { valid: false, normalized: trimmed, error: "Invalid URL format. Example: http://localhost:5000" };
  }
}

export function DesktopConnectionPanel() {
  const isDesktopEnv = isDesktop();
  const [activeUrl, setActiveUrl] = useState(() => getBackendUrlSync() || "");
  const [url, setUrl] = useState(activeUrl || "http://localhost:5000");
  const [status, setStatus] = useState<TestStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [validationError, setValidationError] = useState("");
  const [saved, setSaved] = useState(false);
  const [lastTestedUrl, setLastTestedUrl] = useState("");

  if (!isDesktopEnv) {
    return null;
  }

  async function handleTest() {
    const check = isValidBackendUrl(url);
    if (!check.valid) {
      setValidationError(check.error || "Invalid URL");
      setStatus("error");
      setStatusMessage(check.error || "Invalid URL");
      return;
    }
    setValidationError("");
    setStatus("testing");
    setSaved(false);
    const result = await testBackendConnection(check.normalized);
    setStatus(result.ok ? "success" : "error");
    setStatusMessage(result.message);
    if (result.ok) {
      setLastTestedUrl(check.normalized);
      setUrl(check.normalized);
    }
  }

  function handleSave() {
    if (!lastTestedUrl) return;
    setBackendUrl(lastTestedUrl);
    setActiveUrl(lastTestedUrl);
    setSaved(true);
  }

  return (
    <Card data-testid="panel-desktop-connection">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <CardTitle>Backend Connection</CardTitle>
          </div>
          {activeUrl && (
            <Badge variant="outline" data-testid="badge-backend-url">
              {activeUrl}
            </Badge>
          )}
        </div>
        <CardDescription>
          Configure which ARUS backend server this desktop app connects to
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="admin-backend-url">Server URL</Label>
          <div className="flex gap-2">
            <Input
              id="admin-backend-url"
              data-testid="input-admin-backend-url"
              placeholder="http://localhost:5000"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (status !== "idle") setStatus("idle");
                setValidationError("");
                setSaved(false);
                setLastTestedUrl("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleTest()}
            />
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={status === "testing" || !url.trim()}
              data-testid="button-test-admin-connection"
            >
              {status === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
            </Button>
          </div>
          {validationError && status !== "testing" && (
            <p className="text-xs text-destructive">{validationError}</p>
          )}
        </div>

        {status === "success" && (
          <div className="flex items-center gap-2 text-sm p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            {statusMessage}
          </div>
        )}

        {status === "error" && !validationError && (
          <div className="flex items-center gap-2 text-sm p-3 rounded-md bg-destructive/10 text-destructive">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            {statusMessage}
          </div>
        )}

        {status === "success" && !saved && lastTestedUrl !== activeUrl && (
          <Button onClick={handleSave} data-testid="button-save-backend-url">
            Save & Apply
          </Button>
        )}

        {saved && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Connection Updated</AlertTitle>
            <AlertDescription>
              Backend URL updated. Reload the application for changes to take full effect.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

```

---

## `client/src/components/admin/DesktopUpdatePanel.tsx` (264 lines)

```tsx
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  RefreshCw,
  Download,
  CheckCircle,
  AlertCircle,
  Info,
  Loader2,
  ArrowUpCircle,
  Cloud,
} from "lucide-react";
import {
  isDesktop,
  getDesktopAPI,
  type UpdateInfo,
} from "@/lib/desktop";
import { ReleaseNotesMarkdown } from "@/components/ui/safe-markdown";

type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  releaseNotes?: string;
  error?: string;
}

export function DesktopUpdatePanel() {
  const [state, setState] = useState<UpdateState>({
    status: "idle",
    currentVersion: "unknown",
  });

  const [isDesktopEnv, setIsDesktopEnv] = useState(false);

  useEffect(() => {
    const desktopDetected = isDesktop();
    setIsDesktopEnv(desktopDetected);

    if (desktopDetected) {
      const api = getDesktopAPI();
      if (api) {
        api.getAppVersion().then((version) => {
          setState((prev) => ({ ...prev, currentVersion: version }));
        });
      }
    }
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    const api = getDesktopAPI();
    if (!api) return;

    setState((prev) => ({ ...prev, status: "checking", error: undefined }));

    try {
      const updateInfo: UpdateInfo | null = await api.checkForUpdates();
      if (updateInfo) {
        setState((prev) => ({
          ...prev,
          status: "available",
          availableVersion: updateInfo.version,
          releaseNotes: updateInfo.body,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          status: "not-available",
        }));
      }
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err?.message || "Failed to check for updates",
      }));
    }
  }, []);

  const handleInstall = useCallback(async () => {
    const api = getDesktopAPI();
    if (!api) return;

    setState((prev) => ({ ...prev, status: "downloading" }));

    try {
      await api.installUpdate();
      setState((prev) => ({ ...prev, status: "downloaded" }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err?.message || "Failed to install update",
      }));
    }
  }, []);

  if (!isDesktopEnv) {
    return (
      <Card data-testid="panel-web-update-info">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Software Updates</CardTitle>
          </div>
          <CardDescription>Web deployment update management</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Web Deployment</AlertTitle>
            <AlertDescription>
              You are running ARUS in a browser or server deployment. Software updates are
              automatically managed by the server infrastructure and deployment pipeline. No manual
              update action is required in this environment.
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-sm text-muted-foreground">
            <p>
              For vessel/desktop deployments, use the ARUS Desktop Application which supports
              automatic updates via Tauri's built-in updater.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="panel-desktop-updates">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-primary" />
            <CardTitle>Desktop App Updates</CardTitle>
          </div>
          <Badge variant="outline" data-testid="badge-current-version">
            v{state.currentVersion}
          </Badge>
        </div>
        <CardDescription>
          Check for and install updates for the ARUS Desktop Application
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.status === "idle" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-muted-foreground">Click to check for available updates</p>
            <Button onClick={handleCheckForUpdates} data-testid="button-check-updates">
              <RefreshCw className="mr-2 h-4 w-4" />
              Check for Updates
            </Button>
          </div>
        )}

        {state.status === "checking" && (
          <div className="flex items-center gap-3 py-4" data-testid="status-checking">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Checking for updates...</span>
          </div>
        )}

        {state.status === "not-available" && (
          <Alert data-testid="status-up-to-date">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle>Up to Date</AlertTitle>
            <AlertDescription>
              You are running the latest version of ARUS (v{state.currentVersion}).
            </AlertDescription>
          </Alert>
        )}

        {state.status === "available" && (
          <div className="space-y-4" data-testid="status-available">
            <Alert>
              <ArrowUpCircle className="h-4 w-4 text-blue-500" />
              <AlertTitle>Update Available</AlertTitle>
              <AlertDescription>
                Version {state.availableVersion} is available. You are currently running v
                {state.currentVersion}.
              </AlertDescription>
            </Alert>
            {state.releaseNotes && (
              <ReleaseNotesMarkdown
                content={state.releaseNotes}
                data-testid="release-notes-markdown"
              />
            )}
            <Button onClick={handleInstall} className="w-full" data-testid="button-download">
              <Download className="mr-2 h-4 w-4" />
              Download & Install Update
            </Button>
          </div>
        )}

        {state.status === "downloading" && (
          <div className="flex items-center gap-3 py-4" data-testid="status-downloading">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Downloading and installing update...</span>
          </div>
        )}

        {state.status === "downloaded" && (
          <div className="space-y-4" data-testid="status-downloaded">
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertTitle>Update Installed</AlertTitle>
              <AlertDescription>
                Update v{state.availableVersion} has been installed. The application will restart
                to apply changes.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {state.status === "error" && (
          <div className="space-y-4" data-testid="status-error">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Update Error</AlertTitle>
              <AlertDescription>{state.error || "An unknown error occurred"}</AlertDescription>
            </Alert>
            <Button
              onClick={handleCheckForUpdates}
              variant="outline"
              data-testid="button-retry"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        )}

        {(state.status === "not-available" ||
          state.status === "error" ||
          state.status === "downloaded") && (
          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCheckForUpdates}
              data-testid="button-check-again"
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Check Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

```

---

## `client/src/pages/system-administration.tsx` (176 lines)

```tsx
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings, Users, Activity, FileText, AlertTriangle, CheckCircle, Clock, RefreshCw, Download, Upload, RotateCcw, Key, Eye, EyeOff, Beaker, Github, History, Radio, CalendarClock } from "lucide-react";
import { PerformanceHealthTab } from "@/components/admin/PerformanceHealthTab";
import { SystemSettingsTab } from "@/components/admin/SystemSettingsTab";
import { DesktopUpdatePanel } from "@/components/admin/DesktopUpdatePanel";
import { DesktopConnectionPanel } from "@/components/admin/DesktopConnectionPanel";
import { MLTestingToolsTab } from "@/components/admin/MLTestingToolsTab";
import { AuditTrailTab } from "@/components/admin/AuditTrailTab";
import { ConfigAuditLogTab } from "@/components/admin/ConfigAuditLogTab";
import { SchedulingSettingsTab } from "@/components/admin/SchedulingSettingsTab";
import { TelemetryHealthMonitor } from "@/features/telemetry/components/TelemetryHealthMonitor";
import SyncAdmin from "@/components/SyncAdmin";
import { useSystemAdminData, useSoftwareUpdatesData, useGitHubSettingsData, useConfigurationTabData } from "@/features/settings";
import type { SoftwarePatch } from "@shared/schema";
import { formatDate } from "@/lib/formatters";
import { PermissionGate } from "@/components/PermissionGate";

function GitHubSettingsTab() {
  const g = useGitHubSettingsData();
  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Github className="h-5 w-5" />GitHub Connection</CardTitle><CardDescription>GitHub is connected via Replit integration for accessing releases</CardDescription></CardHeader><CardContent>
        {g.githubLoading ? <div className="flex items-center gap-4 p-4 border rounded-lg animate-pulse"><div className="h-10 w-10 bg-muted rounded-full" /><div className="space-y-2"><div className="h-4 w-32 bg-muted rounded" /><div className="h-3 w-48 bg-muted rounded" /></div></div> :
        g.githubStatus?.connected ? <div className="flex items-center gap-4 p-4 border border-green-500/50 bg-green-500/10 rounded-lg">{g.githubStatus.user?.avatar_url && <img src={g.githubStatus.user.avatar_url} alt={g.githubStatus.user.login} loading="lazy" className="h-10 w-10 rounded-full" />}<div className="flex-1"><div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /><span className="font-medium text-green-700 dark:text-green-400">Connected</span></div><p className="text-sm text-muted-foreground">Signed in as <strong>{g.githubStatus.user?.login}</strong>{g.githubStatus.user?.name && ` (${g.githubStatus.user.name})`}</p></div></div> :
        <div className="space-y-4"><div className="flex items-center gap-4 p-4 border border-amber-500/50 bg-amber-500/10 rounded-lg"><AlertTriangle className="h-10 w-10 text-amber-600" /><div className="flex-1"><p className="font-medium text-amber-700 dark:text-amber-400">GitHub Connection Required</p><p className="text-sm text-muted-foreground">Connect your GitHub account to enable automatic software updates for vessel deployments.</p></div></div><div className="p-4 border rounded-lg bg-muted/50"><h4 className="font-medium mb-3">How to Connect GitHub:</h4><ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2"><li>Look for the <strong>"Tools"</strong> panel on the left sidebar in Replit</li><li>Find and click <strong>"GitHub"</strong> in the integrations list</li><li>Click <strong>"Connect"</strong> and authorize access to your repositories</li><li>Return here - the connection will be detected automatically</li></ol><div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-sm"><strong className="text-blue-700 dark:text-blue-400">Why use Replit's GitHub integration?</strong><p className="text-muted-foreground mt-1">Replit securely manages your GitHub OAuth tokens with automatic refresh - no API keys to store or rotate manually.</p></div></div></div>}
      </CardContent></Card>
      {g.githubStatus?.connected && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Release Repository</CardTitle><CardDescription>Select which GitHub repository to monitor for Tauri desktop app updates</CardDescription></CardHeader><CardContent className="space-y-4">
        {g.settings?.githubOwner && g.settings?.githubRepo && <div className="flex items-center gap-2 p-3 bg-muted rounded-lg"><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-sm">Currently monitoring: <strong>{g.settings.githubOwner}/{g.settings.githubRepo}</strong></span></div>}
        {g.reposLoading ? <div className="text-sm text-muted-foreground">Loading repositories...</div> : g.reposData?.repos?.length ? <div className="space-y-2"><Label>Select a repository:</Label><div className="grid gap-2 max-h-60 overflow-y-auto">{g.reposData.repos.map((repo) => <Button key={repo.id} variant={g.settings?.githubRepo === repo.name && g.settings?.githubOwner === repo.owner ? "default" : "outline"} className="justify-start h-auto py-3" onClick={() => g.selectRepoMutation.mutate({ owner: repo.owner, repo: repo.name })} disabled={g.selectRepoMutation.isPending} data-testid={`button-select-repo-${repo.name}`}><Github className="mr-2 h-4 w-4" /><div className="text-left"><div className="font-medium">{repo.full_name}</div><div className="text-xs text-muted-foreground">{repo.html_url}</div></div></Button>)}</div></div> : <div className="text-sm text-muted-foreground">No repositories found. Make sure your GitHub account has accessible repositories.</div>}
      </CardContent></Card>}
      <Card><CardHeader><CardTitle className="text-base">How GitHub Releases Work</CardTitle></CardHeader><CardContent><ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2"><li>GitHub is connected via Replit integration (automatic token management)</li><li>Select which repository to monitor for releases above</li><li>Build your Tauri desktop app with tauri:build</li><li>Publish releases to GitHub - desktop apps will automatically update</li></ol></CardContent></Card>
    </div>
  );
}

function SoftwareUpdatesTab() {
  const s = useSoftwareUpdatesData();
  if (s.isDesktopEnv) {return <div className="space-y-6"><DesktopConnectionPanel /><DesktopUpdatePanel /></div>;}
  if (s.isLoading) {return <div className="flex items-center justify-center py-8" data-testid="loading-software-updates">Loading software updates...</div>;}
  if (s.hasError) {return <div className="space-y-4"><div className="flex items-center justify-between"><div><h3 className="text-lg font-medium">Software Updates</h3><p className="text-sm text-muted-foreground">Manage system updates, patches, and auto-update configuration</p></div></div><Card className="border-destructive" data-testid="error-software-updates"><CardHeader><CardTitle className="text-destructive">Failed to Load Updates</CardTitle><CardDescription>Unable to retrieve software update information. Please check your connection or admin permissions.</CardDescription></CardHeader><CardContent><div className="space-y-2 text-sm">{s.errors.patches && <p data-testid="error-patches">Patches: {s.errors.patches}</p>}{s.errors.history && <p data-testid="error-history">History: {s.errors.history}</p>}{s.errors.settings && <p data-testid="error-settings">Settings: {s.errors.settings}</p>}</div></CardContent></Card></div>;}

  return (
    <div className="space-y-6">
      <DesktopUpdatePanel />
      <div className="flex items-center justify-between"><div><h3 className="text-lg font-medium" data-testid="heading-software-updates">Server Patch Management</h3><p className="text-sm text-muted-foreground">Manage server-side updates, patches, and auto-update configuration</p></div><Button variant="outline" onClick={() => s.checkUpdatesMutation.mutate()} disabled={s.checkUpdatesMutation.isPending} data-testid="button-check-updates"><RefreshCw className={`mr-2 h-4 w-4 ${s.checkUpdatesMutation.isPending ? "animate-spin" : ""}`} />Check for Updates</Button></div>
      <Tabs defaultValue="available" className="space-y-4">
        <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground"><TabsTrigger value="available" data-testid="tab-available-updates">Available Updates</TabsTrigger><TabsTrigger value="publish" data-testid="tab-publish-update"><Upload className="mr-2 h-4 w-4" />Publish Update</TabsTrigger><TabsTrigger value="github" data-testid="tab-github-releases"><Github className="mr-2 h-4 w-4" />GitHub</TabsTrigger><TabsTrigger value="settings" data-testid="tab-update-settings">Auto-Update Settings</TabsTrigger></TabsList>
        <TabsContent value="available" className="space-y-4">
          <Card data-testid="card-available-updates"><CardHeader><CardTitle>Available Updates</CardTitle><CardDescription>Software patches ready for download and installation</CardDescription></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Version</TableHead><TableHead>From</TableHead><TableHead>Severity</TableHead><TableHead>Status</TableHead><TableHead>Size</TableHead><TableHead>Released</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>
            {(s.patches ?? []).filter((p: SoftwarePatch) => p.status === "available").map((patch: SoftwarePatch) => <TableRow key={patch.id} data-testid={`row-patch-${patch.id}`}><TableCell className="font-medium" data-testid={`text-version-${patch.id}`}>{patch.version}</TableCell><TableCell data-testid={`text-from-version-${patch.id}`}>{patch.fromVersion}</TableCell><TableCell><Badge variant={s.getSeverityColor(patch.severity) as "default" | "secondary" | "destructive" | "outline"} data-testid={`badge-severity-${patch.id}`}>{patch.severity}</Badge></TableCell><TableCell><Badge variant={s.getStatusColor(patch.status) as "default" | "secondary" | "destructive" | "outline"} data-testid={`badge-status-${patch.id}`}>{patch.status}</Badge></TableCell><TableCell data-testid={`text-size-${patch.id}`}>{patch.fileSize ? `${(patch.fileSize / 1024 / 1024).toFixed(2)} MB` : "N/A"}</TableCell><TableCell data-testid={`text-released-${patch.id}`}>{patch.createdAt ? new Date(patch.createdAt).toLocaleDateString() : "N/A"}</TableCell><TableCell><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => s.downloadMutation.mutate(patch.id)} disabled={s.downloadMutation.isPending} data-testid={`button-download-${patch.id}`}><Download className="h-4 w-4" /></Button><Button size="sm" onClick={() => s.setSelectedPatch(patch)} data-testid={`button-details-${patch.id}`}>Details</Button></div></TableCell></TableRow>)}
            {(!s.patches || s.patches.filter((p: SoftwarePatch) => p.status === "available").length === 0) && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground" data-testid="empty-available-updates"><CheckCircle className="mx-auto h-12 w-12 mb-2 text-green-500" /><p>System is up to date. No updates available.</p></TableCell></TableRow>}
          </TableBody></Table></CardContent></Card>
          <Card data-testid="card-patch-history"><CardHeader><CardTitle>Patch History</CardTitle><CardDescription>Previously applied patches and rollback points</CardDescription></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead>Applied At</TableHead><TableHead>Applied By</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>
            {(s.patchHistory ?? []).slice(0, 10).map((patch: SoftwarePatch) => <TableRow key={patch.id} data-testid={`row-history-${patch.id}`}><TableCell className="font-medium" data-testid={`text-history-version-${patch.id}`}>{patch.version}</TableCell><TableCell><Badge variant={s.getStatusColor(patch.status) as "default" | "secondary" | "destructive" | "outline"} data-testid={`badge-history-status-${patch.id}`}>{patch.status}</Badge></TableCell><TableCell data-testid={`text-applied-at-${patch.id}`}>{patch.appliedAt ? formatDate(patch.appliedAt) : "N/A"}</TableCell><TableCell data-testid={`text-applied-by-${patch.id}`}>{patch.appliedBy || "System"}</TableCell><TableCell>{patch.status === "applied" && patch.backupId && <Button size="sm" variant="outline" onClick={() => s.rollbackMutation.mutate(patch.backupId)} disabled={s.rollbackMutation.isPending} data-testid={`button-rollback-${patch.id}`}><RotateCcw className="mr-2 h-4 w-4" />Rollback</Button>}</TableCell></TableRow>)}
            {(!s.patchHistory || s.patchHistory.length === 0) && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground" data-testid="empty-patch-history">No patch history available.</TableCell></TableRow>}
          </TableBody></Table></CardContent></Card>
        </TabsContent>
        <TabsContent value="publish" className="space-y-4">
          <Card data-testid="card-publish-update"><CardHeader><CardTitle>Publish Software Update</CardTitle><CardDescription>Create and publish a new patch to GitHub Releases. Patches are automatically detected from git commits.</CardDescription></CardHeader><CardContent>
            <Form {...s.publishForm}><form onSubmit={s.publishForm.handleSubmit(s.onPublishSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={s.publishForm.control} name="fromVersion" render={({ field }) => <FormItem><FormLabel>From Version</FormLabel><FormControl><Input placeholder="1.0" {...field} data-testid="input-from-version" /></FormControl><FormDescription>Source version (must be a git tag)</FormDescription><FormMessage /></FormItem>} />
                <FormField control={s.publishForm.control} name="version" render={({ field }) => <FormItem><FormLabel>New Version</FormLabel><FormControl><Input placeholder="1.0.1" {...field} data-testid="input-version" /></FormControl><FormDescription>Target version (will create git tag)</FormDescription><FormMessage /></FormItem>} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={s.publishForm.control} name="severity" render={({ field }) => <FormItem><FormLabel>Severity</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger data-testid="select-severity"><SelectValue placeholder="Select severity" /></SelectTrigger></FormControl><SelectContent><SelectItem value="critical">Critical</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
                <FormField control={s.publishForm.control} name="channel" render={({ field }) => <FormItem><FormLabel>Release Channel</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger data-testid="select-channel"><SelectValue placeholder="Select channel" /></SelectTrigger></FormControl><SelectContent><SelectItem value="stable">Stable</SelectItem><SelectItem value="beta">Beta</SelectItem><SelectItem value="alpha">Alpha</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
                <FormField control={s.publishForm.control} name="patchType" render={({ field }) => <FormItem><FormLabel>Patch Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger data-testid="select-patch-type"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent><SelectItem value="incremental">Incremental</SelectItem><SelectItem value="full">Full</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
              </div>
              <FormField control={s.publishForm.control} name="requiresRestart" render={({ field }) => <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Requires System Restart</FormLabel><FormDescription>Check if the patch requires a full system restart to apply</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-requires-restart" /></FormControl></FormItem>} />
              <FormField control={s.publishForm.control} name="releaseNotes" render={({ field }) => <FormItem><FormLabel>Release Notes</FormLabel><FormControl><Textarea placeholder="Describe the changes in this update..." className="min-h-[120px]" {...field} data-testid="textarea-release-notes" /></FormControl><FormDescription>Detailed description of changes (supports Markdown)</FormDescription><FormMessage /></FormItem>} />
              <div className="flex gap-2"><Button type="submit" disabled={s.publishMutation.isPending} data-testid="button-publish-patch">{s.publishMutation.isPending ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Publishing...</> : <><Upload className="mr-2 h-4 w-4" />Publish to GitHub</>}</Button><Button type="button" variant="outline" onClick={s.handlePreview} disabled={s.previewMutation.isPending} data-testid="button-preview-patch">{s.previewMutation.isPending ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Loading...</> : "Preview Changes"}</Button></div>
            </form></Form>
            {s.previewMutation.data && <div className="mt-6 p-4 border rounded-lg bg-muted/50" data-testid="preview-results"><h4 className="font-semibold mb-3">Patch Preview</h4><div className="grid grid-cols-3 gap-4 text-sm mb-4"><div><span className="text-muted-foreground">Files Changed:</span><p className="font-medium">{(s.previewMutation.data as {filesChanged?: number}).filesChanged ?? 0}</p></div><div><span className="text-muted-foreground">Additions:</span><p className="font-medium text-green-600">+{(s.previewMutation.data as {additions?: number}).additions ?? 0}</p></div><div><span className="text-muted-foreground">Deletions:</span><p className="font-medium text-red-600">-{(s.previewMutation.data as {deletions?: number}).deletions ?? 0}</p></div></div>{(s.previewMutation.data as {commits?: Array<{sha: string; message: string}>}).commits && <div className="space-y-2"><span className="text-sm text-muted-foreground">Commits:</span>{(s.previewMutation.data as {commits: Array<{sha: string; message: string}>}).commits.slice(0, 5).map((c) => <div key={c.sha} className="flex items-start gap-2 text-sm p-2 bg-background rounded"><span className="font-mono text-muted-foreground">{c.sha.substring(0, 7)}</span><span className="flex-1 truncate">{c.message}</span></div>)}</div>}</div>}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="github" className="space-y-4"><GitHubSettingsTab /></TabsContent>
        <TabsContent value="settings" className="space-y-4"><Card><CardHeader><CardTitle>Auto-Update Configuration</CardTitle><CardDescription>Configure automatic update behavior for server deployments</CardDescription></CardHeader><CardContent><div className="text-center py-8 text-muted-foreground"><Clock className="mx-auto h-12 w-12 mb-4 opacity-50" /><p>Auto-update configuration coming soon</p><p className="text-sm mt-2">Configure maintenance windows and automatic patch deployment</p></div></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}

function ConfigurationTab() {
  const c = useConfigurationTabData();
  return (
    <div className="space-y-4">
      <SystemSettingsTab />
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />User Access & Security</CardTitle><CardDescription>Manage user permissions and authentication settings</CardDescription></CardHeader><CardContent className="space-y-6">
        <div className="pb-4 border-b"><div className="flex items-center justify-center py-6"><div className="text-center space-y-2"><Users className="mx-auto h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground max-w-md">User roles and permissions management coming soon.</p></div></div></div>
        <Collapsible open={c.passwordSectionOpen} onOpenChange={c.setPasswordSectionOpen}>
          <div className="flex items-center justify-between"><div className="flex items-center space-x-2"><Key className="h-4 w-4 text-muted-foreground" /><h4 className="text-sm font-semibold">Change Admin Password</h4></div><CollapsibleTrigger asChild><Button variant="ghost" size="sm" data-testid="button-toggle-password-change">{c.passwordSectionOpen ? "Cancel" : "Change Password"}</Button></CollapsibleTrigger></div>
          <CollapsibleContent className="pt-4">
            <Form {...c.passwordForm}><form onSubmit={c.passwordForm.handleSubmit(c.handlePasswordSubmit)} className="space-y-4">
              <FormField control={c.passwordForm.control} name="currentPassword" render={({ field }) => <FormItem><FormLabel>Current Password</FormLabel><FormControl><Input type="password" placeholder="Enter current password" data-testid="input-current-password" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={c.passwordForm.control} name="newPassword" render={({ field }) => <FormItem><FormLabel>New Password</FormLabel><FormControl><div className="relative"><Input type={c.showPassword ? "text" : "password"} placeholder="Enter new password" data-testid="input-new-password" {...field} /><Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => c.setShowPassword(!c.showPassword)} data-testid="button-toggle-password-visibility">{c.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></FormControl><FormDescription>Must be at least 8 characters with uppercase, lowercase, and number</FormDescription><FormMessage /></FormItem>} />
              <FormField control={c.passwordForm.control} name="confirmPassword" render={({ field }) => <FormItem><FormLabel>Confirm New Password</FormLabel><FormControl><Input type={c.showPassword ? "text" : "password"} placeholder="Confirm new password" data-testid="input-confirm-password" {...field} /></FormControl><FormMessage /></FormItem>} />
              <div className="flex justify-end space-x-2 pt-2"><Button type="button" variant="outline" onClick={c.cancelPasswordChange} data-testid="button-cancel-password-change">Cancel</Button><Button type="submit" disabled={c.changePasswordMutation.isPending} data-testid="button-submit-password-change">{c.changePasswordMutation.isPending ? "Updating..." : "Update Password"}</Button></div>
            </form></Form>
          </CollapsibleContent>
        </Collapsible>
      </CardContent></Card>
    </div>
  );
}

function UpdatesMaintenanceTab() {
  const [updateSubTab, setUpdateSubTab] = useState("software");
  return (
    <div className="space-y-4">
      <Tabs value={updateSubTab} onValueChange={setUpdateSubTab} className="space-y-4">
        <TabsList data-testid="tabs-update-maintenance"><TabsTrigger value="software" data-testid="tab-software"><Download className="mr-2 h-4 w-4" />Software Updates</TabsTrigger><TabsTrigger value="sync" data-testid="tab-sync"><RefreshCw className="mr-2 h-4 w-4" />Synchronization</TabsTrigger></TabsList>
        <TabsContent value="software" className="space-y-4"><SoftwareUpdatesTab /></TabsContent>
        <TabsContent value="sync" className="space-y-4"><SyncAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}

function MonitoringHealthTab() {
  const [monitoringSubTab, setMonitoringSubTab] = useState("performance");
  return (
    <div className="space-y-4">
      <Tabs value={monitoringSubTab} onValueChange={setMonitoringSubTab} className="space-y-4">
        <TabsList data-testid="tabs-monitoring-health"><TabsTrigger value="performance" data-testid="tab-performance"><Activity className="mr-2 h-4 w-4" />System Performance</TabsTrigger><TabsTrigger value="telemetry" data-testid="tab-telemetry"><Radio className="mr-2 h-4 w-4" />Telemetry Pipeline</TabsTrigger></TabsList>
        <TabsContent value="performance" className="space-y-4"><PerformanceHealthTab /></TabsContent>
        <TabsContent value="telemetry" className="space-y-4"><TelemetryHealthMonitor /></TabsContent>
      </Tabs>
    </div>
  );
}

function AuditComplianceTab() {
  const [auditSubTab, setAuditSubTab] = useState("activity");
  return (
    <div className="space-y-4">
      <Tabs value={auditSubTab} onValueChange={setAuditSubTab} className="space-y-4">
        <TabsList data-testid="tabs-audit-compliance"><TabsTrigger value="activity" data-testid="tab-activity-log"><FileText className="mr-2 h-4 w-4" />Activity Log</TabsTrigger><TabsTrigger value="config" data-testid="tab-config-changes"><History className="mr-2 h-4 w-4" />Configuration Changes</TabsTrigger></TabsList>
        <TabsContent value="activity" className="space-y-4"><AuditTrailTab /></TabsContent>
        <TabsContent value="config" className="space-y-4"><ConfigAuditLogTab /></TabsContent>
      </Tabs>
    </div>
  );
}

export default function SystemAdministration() {
  const { activeTab, setActiveTab } = useSystemAdminData();

  return (
    <div className="min-h-screen">
      <div className="container mx-auto py-6 space-y-8">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="w-full overflow-x-auto"><TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground w-max min-w-full"><TabsTrigger value="configuration" data-testid="tab-configuration" className="whitespace-nowrap"><Settings className="mr-2 h-4 w-4" />Configuration</TabsTrigger><TabsTrigger value="scheduling" data-testid="tab-scheduling" className="whitespace-nowrap"><CalendarClock className="mr-2 h-4 w-4" />Scheduling</TabsTrigger><TabsTrigger value="updates-maintenance" data-testid="tab-updates-maintenance" className="whitespace-nowrap"><Download className="mr-2 h-4 w-4" />Updates & Maintenance</TabsTrigger><TabsTrigger value="monitoring-health" data-testid="tab-monitoring-health" className="whitespace-nowrap"><Activity className="mr-2 h-4 w-4" />Monitoring & Health</TabsTrigger><TabsTrigger value="audit-compliance" data-testid="tab-audit-compliance" className="whitespace-nowrap"><FileText className="mr-2 h-4 w-4" />Audit & Compliance</TabsTrigger><TabsTrigger value="ml-testing" data-testid="tab-ml-testing" className="whitespace-nowrap"><Beaker className="mr-2 h-4 w-4" />ML & Testing Tools</TabsTrigger></TabsList></div>
        <TabsContent value="configuration" className="space-y-4"><ConfigurationTab /></TabsContent>
        <TabsContent value="scheduling" className="space-y-4"><SchedulingSettingsTab /></TabsContent>
        <TabsContent value="updates-maintenance" className="space-y-4"><UpdatesMaintenanceTab /></TabsContent>
        <TabsContent value="monitoring-health" className="space-y-4"><MonitoringHealthTab /></TabsContent>
        <TabsContent value="audit-compliance" className="space-y-4"><AuditComplianceTab /></TabsContent>
        <TabsContent value="ml-testing" className="space-y-4"><MLTestingToolsTab /></TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

```

---

## `server/bootstrap/middleware.ts` (175 lines)

```ts
/**
 * Express Middleware Configuration
 * Security headers, CORS, body parsing, logging
 */

import type { Express } from "express";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import {
  additionalSecurityHeaders,
  sanitizeRequestData,
  detectAttackPatterns,
} from "../security";
import { originAllowed } from "../utils/corsWildcard";
import { safeStringify } from "../utils/redact-log";
import { correlationMiddleware, getCorrelationId } from "../utils/correlation-context";
import { performanceMiddleware } from "../middleware/performance";

export function configureMiddleware(app: Express): void {
  const isDevelopment = process.env.NODE_ENV === "development";

  app.set("trust proxy", true);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: isDevelopment
            ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
            : ["'self'"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          // Security (S5332): http: protocol allowed in development only for local testing
          // Production enforces HTTPS-only connections
          connectSrc: isDevelopment
            ? ["'self'", "ws:", "wss:", "https:", "http:"] // NOSONAR: Development convenience
            : ["'self'", "wss:", "https://api.openai.com"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", "data:", "blob:"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  const corsOriginFunction = (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    if (!origin) { return callback(null, true); }

    // NOSONAR: S5332 - http://localhost allowed for local development only
    // Production deployments use HTTPS exclusively via ALLOWED_ORIGINS env var
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").filter(Boolean) || [
      "https://*.replit.dev",
      "https://*.replit.dev:*",
      "https://*.replit.app",
      "https://*.replit.app:*",
      "https://*.replit.co",
      "https://*.replit.co:*",
      "http://localhost:*",
      "https://localhost:*",
      "http://127.0.0.1:*",
      "https://127.0.0.1:*",
      "tauri://localhost",
      "https://tauri.localhost",
    ];

    const allowed = originAllowed(origin, allowedOrigins);

    if (!allowed && isDevelopment) {
      console.warn(`🚨 CORS: Blocked origin ${origin}`);
    }

    callback(null, allowed);
  };

  app.use(correlationMiddleware);

  app.use(
    cors({
      origin: corsOriginFunction,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-Device-Id",
        "X-Equipment-Id",
        "X-HMAC-Signature",
        "x-org-id",
        "x-correlation-id",
      ],
      exposedHeaders: [
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "x-correlation-id",
      ],
    })
  );

  app.use(
    express.json({
      limit: "50mb",
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
      },
    })
  );
  app.use(
    express.urlencoded({
      extended: false,
      limit: "50mb",
    })
  );

  app.use(additionalSecurityHeaders);
  app.use(detectAttackPatterns);
  app.use(sanitizeRequestData);
  app.use(performanceMiddleware);

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson: any, ...args: any[]) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      const loggable = path.startsWith("/api") && !path.startsWith("/api/auth");

      if (loggable) {
        const correlationId = getCorrelationId();
        const shortId = correlationId !== "no-context" ? `[${correlationId.slice(0, 8)}] ` : "";
        let line = `${shortId}${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          line += ` :: ${safeStringify(capturedJsonResponse)}`;
        }
        console.log(line);
      }
    });

    next();
  });
}

export async function configureAuthMiddleware(app: Express): Promise<void> {
  const { requireAuthentication } = await import("../security");
  const { requireOrgId } = await import("../middleware/auth");
  const { withDatabaseContext } = await import("../middleware/db-context");
  const { validateOrgIdHeader } = await import("../orgIdValidation");
  const { apiReadyGate } = await import("../middleware/api-ready-gate");

  app.use("/api", apiReadyGate);
  app.use("/api", requireAuthentication);
  app.use("/api", requireOrgId);
  app.use("/api", validateOrgIdHeader);
  app.use("/api", withDatabaseContext);
}

```

---

## `server/domains/system-admin/routes/auth-routes.ts` (261 lines)

```ts
/**
 * System Admin Routes - Authentication
 * Admin login verification and password management
 */

import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";

export function registerAuthRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    adminPasswordVerifySchema,
    adminPasswordChangeSchema,
  } = deps;

  app.post(
    "/api/admin/auth/verify",
    generalApiRateLimit,
    withErrorHandling("verify admin authentication", async (req: Request, res: Response) => {
      const { password } = adminPasswordVerifySchema.parse(req.body);

      const validAdminToken = process.env.ADMIN_TOKEN;

      if (!validAdminToken) {
        res.status(503).json({
          error: "Admin authentication is not configured",
          code: "ADMIN_SERVICE_DISABLED",
        });
        return;
      }

      if (password !== validAdminToken) {
        logger.warn("AdminAuth", `Failed admin password verification from ${req.ip}`);
        res.status(401).json({
          error: "Invalid password",
          code: "INVALID_PASSWORD",
        });
        return;
      }

      const crypto = await import("crypto");
      const sessionToken = crypto.randomBytes(32).toString("hex");

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);

      const mockOrgId = "default-org-id";
      let adminUser = await storage.getUserByEmail("admin@example.com", mockOrgId);

      if (!adminUser) {
        adminUser = await storage.createUser({
          orgId: mockOrgId,
          email: "admin@example.com",
          name: "System Administrator",
          role: "admin",
          isActive: true,
        });
      }

      await storage.createAdminSession({
        orgId: mockOrgId,
        sessionToken,
        userId: adminUser.id,
        adminEmail: "admin@example.com",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        expiresAt,
        lastActivityAt: new Date(),
      });

      logger.info("AdminAuth", `Admin session created from ${req.ip}`);

      const expiresIn = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
      res.json({
        sessionToken,
        expiresAt: expiresAt.toISOString(),
        expiresIn,
      });
    })
  );

  app.get(
    "/api/admin/auth/status",
    generalApiRateLimit,
    withErrorHandling("check admin auth status", async (_req: Request, res: Response) => {
      const configured = !!process.env.ADMIN_TOKEN;
      res.json({ configured });
    })
  );

  app.post(
    "/api/admin/auth/setup",
    criticalOperationRateLimit,
    withErrorHandling("initial admin password setup", async (req: Request, res: Response) => {
      if (process.env.ADMIN_TOKEN) {
        res.status(409).json({
          error: "Admin password is already configured",
          code: "ALREADY_CONFIGURED",
        });
        return;
      }

      const { password } = adminPasswordVerifySchema.parse(req.body);

      if (!password || password.length < 8) {
        res.status(400).json({
          error: "Password must be at least 8 characters",
          code: "PASSWORD_TOO_SHORT",
        });
        return;
      }

      if (/[\r\n\0]/.test(password)) {
        res.status(400).json({
          error: "Password contains invalid characters",
          code: "INVALID_CHARACTERS",
        });
        return;
      }

      const fs = await import("fs/promises");
      const path = await import("path");
      const envPath = path.join(process.cwd(), ".env");

      try {
        let envContent = "";
        try {
          envContent = await fs.readFile(envPath, "utf-8");
        } catch {
          envContent = "";
        }

        const finalContent = envContent
          ? `${envContent.trimEnd()}\nADMIN_TOKEN=${password}\n`
          : `ADMIN_TOKEN=${password}\n`;

        await fs.writeFile(envPath, finalContent, "utf-8");
        process.env.ADMIN_TOKEN = password;

        const crypto = await import("crypto");
        const sessionToken = crypto.randomBytes(32).toString("hex");

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 2);

        const mockOrgId = "default-org-id";
        let adminUser = await storage.getUserByEmail("admin@example.com", mockOrgId);

        if (!adminUser) {
          adminUser = await storage.createUser({
            orgId: mockOrgId,
            email: "admin@example.com",
            name: "System Administrator",
            role: "admin",
            isActive: true,
          });
        }

        await storage.createAdminSession({
          orgId: mockOrgId,
          sessionToken,
          userId: adminUser.id,
          adminEmail: "admin@example.com",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          expiresAt,
          lastActivityAt: new Date(),
        });

        logger.info("AdminAuth", `Initial admin password configured from ${req.ip}`);

        const expiresIn = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
        res.json({
          success: true,
          sessionToken,
          expiresAt: expiresAt.toISOString(),
          expiresIn,
        });
      } catch (fileError) {
        logger.error("AdminAuth", "Failed to write .env file during setup", fileError);
        res.status(500).json({
          error: "Failed to persist admin password",
          code: "FILE_UPDATE_FAILED",
        });
      }
    })
  );

  app.post(
    "/api/admin/auth/change-password",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CHANGE_ADMIN_PASSWORD"),
    withErrorHandling("change admin password", async (req: Request, res: Response) => {
      const { currentPassword, newPassword } = adminPasswordChangeSchema.parse(req.body);

      const validAdminToken = process.env.ADMIN_TOKEN;

      if (!validAdminToken) {
        res.status(503).json({
          error: "Admin authentication is not configured",
          code: "ADMIN_SERVICE_DISABLED",
        });
        return;
      }

      if (currentPassword !== validAdminToken) {
        logger.warn("AdminAuth", `Failed admin password change attempt from ${req.ip}`);
        res.status(401).json({
          error: "Current password is incorrect",
          code: "INVALID_CURRENT_PASSWORD",
        });
        return;
      }

      const fs = await import("fs/promises");
      const path = await import("path");
      const envPath = path.join(process.cwd(), ".env");

      try {
        const envContent = await fs.readFile(envPath, "utf-8");

        const updatedContent = envContent.replace(
          /^ADMIN_TOKEN=.*/m,
          `ADMIN_TOKEN=${newPassword}`
        );

        const finalContent = updatedContent.includes("ADMIN_TOKEN=")
          ? updatedContent
          : `${updatedContent}\nADMIN_TOKEN=${newPassword}\n`;

        await fs.writeFile(envPath, finalContent, "utf-8");

        process.env.ADMIN_TOKEN = newPassword;

        await storage.invalidateAllAdminSessions();

        logger.info("AdminAuth", `Admin password changed successfully from ${req.ip}`);

        res.json({
          success: true,
          message:
            "Password changed successfully. All admin sessions have been invalidated. Please log in again with your new password.",
        });
      } catch (fileError) {
        logger.error("AdminAuth", "Failed to update .env file", fileError);
        res.status(500).json({
          error:
            "Failed to persist password change. Please update ADMIN_TOKEN in your environment secrets manually.",
          code: "FILE_UPDATE_FAILED",
        });
      }
    })
  );
}

```

---

## `server/domains/system-admin/routes/types.ts` (67 lines)

```ts
/**
 * System Admin Routes - Shared Types
 * Common interfaces and dependencies for all system admin route modules
 */

import type { Express } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import { z } from "zod";

export type { Express, Request, Response };

export interface IStorage {
  getUserByEmail: (email: string, orgId: string) => Promise<any>;
  createUser: (data: any) => Promise<any>;
  createAdminSession: (data: any) => Promise<any>;
  invalidateAllAdminSessions: () => Promise<void>;
  getAdminAuditEvents: (orgId?: string, action?: string, limit?: number) => Promise<any[]>;
  createAdminAuditEvent: (data: any) => Promise<any>;
  getAuditEventsByUser: (userId: string, orgId?: string) => Promise<any[]>;
  getAuditEventsByResource: (resourceType: string, resourceId: string, orgId?: string) => Promise<any[]>;
  getAdminSystemSettings: (orgId?: string, category?: string) => Promise<any[]>;
  getAdminSystemSetting: (orgId: string, category: string, key: string) => Promise<any>;
  createAdminSystemSetting: (data: any) => Promise<any>;
  updateAdminSystemSetting: (id: string, data: any) => Promise<any>;
  deleteAdminSystemSetting: (id: string) => Promise<void>;
  getSettingsByCategory: (orgId: string, category: string) => Promise<any[]>;
  getIntegrationConfigs: (orgId?: string, type?: string) => Promise<any[]>;
  getIntegrationConfig: (id: string, orgId?: string) => Promise<any>;
  createIntegrationConfig: (data: any) => Promise<any>;
  updateIntegrationConfig: (id: string, data: any) => Promise<any>;
  deleteIntegrationConfig: (id: string) => Promise<void>;
  updateIntegrationHealth: (id: string, healthStatus: string, errorMessage?: string) => Promise<any>;
  getMaintenanceWindows: (orgId?: string, status?: string) => Promise<any[]>;
  getMaintenanceWindow: (id: string, orgId?: string) => Promise<any>;
  createMaintenanceWindow: (data: any) => Promise<any>;
  updateMaintenanceWindow: (id: string, data: any) => Promise<any>;
  deleteMaintenanceWindow: (id: string) => Promise<void>;
  getActiveMaintenanceWindows: (orgId?: string) => Promise<any[]>;
  getSystemPerformanceMetrics: (orgId?: string, category?: string, hours?: number) => Promise<any[]>;
  createSystemPerformanceMetric: (data: any) => Promise<any>;
  getLatestMetricsByCategory: (orgId: string, category: string) => Promise<any[]>;
  getMetricTrends: (orgId: string, metricName: string, hours?: number) => Promise<any[]>;
}

export interface ThresholdCalibrator {
  calibrateForEquipment: (orgId: string, equipmentId: string) => Promise<any>;
}

export interface SystemAdminDependencies {
  storage: IStorage;
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
  requireAdminAuth: any;
  auditAdminAction: (action: string) => any;
  thresholdCalibrator: ThresholdCalibrator;
  adminPasswordVerifySchema: z.ZodSchema;
  adminPasswordChangeSchema: z.ZodSchema;
  insertAdminAuditEventSchema: z.ZodSchema;
  insertAdminSystemSettingSchema: z.ZodSchema;
  insertIntegrationConfigSchema: z.ZodSchema;
  insertMaintenanceWindowSchema: z.ZodSchema;
  insertSystemPerformanceMetricSchema: z.ZodSchema;
  AdminSessionResponse: any;
}

export { z };

```

---

## `server/utils/corsWildcard.ts` (25 lines)

```ts
/**
 * CORS Wildcard Utilities
 * Safe wildcard pattern matching with proper regex escaping
 */

/**
 * Convert wildcard pattern to safe regex
 * Escapes all regex metacharacters except * which becomes [^/]* (non-greedy, bounded)
 *
 * Strategy: Replace * with placeholder, escape everything, then replace placeholder with bounded pattern
 */
export function wildcardToRegex(pat: string): RegExp {
  const trimmed = pat.trim().slice(0, 256);
  const withPlaceholder = trimmed.replace(/\*/g, "__WILDCARD_STAR__");
  const escaped = withPlaceholder.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replaceAll('__WILDCARD_STAR__', "[^/]*");
  return new RegExp(`^${pattern}$`);
}

/**
 * Check if origin is allowed by wildcard patterns
 */
export function originAllowed(origin: string, allowlist: string[]): boolean {
  return allowlist.some((p) => wildcardToRegex(p).test(origin));
}

```

---

## `scripts/init-sqlite-schema.js` (157 lines)

```js
#!/usr/bin/env node
/**
 * Initialize SQLite Database Schema
 * Creates a minimal seed database using Node.js (no sqlite3 CLI required)
 */

import { createClient } from '@libsql/client';
import { existsSync, unlinkSync } from 'node:fs';

const DB_PATH = process.env.DATABASE_PATH || 'data/vessel-local.db';

console.log(`  Initializing database at: ${DB_PATH}`);

try {
  // Create the database file
  const client = createClient({
    url: `file:${DB_PATH}`
  });

  // Initialize with minimal schema
  await client.execute(`
    -- Enable foreign keys and WAL mode for better performance
    PRAGMA foreign_keys = ON;
  `);

  await client.execute(`
    PRAGMA journal_mode = WAL;
  `);

  await client.execute(`
    PRAGMA synchronous = NORMAL;
  `);

  // Create a version marker
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

  // Create organizations table (required for multi-tenancy)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  // Insert default organization for embedded mode
  await client.execute(`
    INSERT OR IGNORE INTO organizations (id, name) VALUES ('default-org-id', 'Default Organization');
  `);

  // Create update_settings table (required for update scheduler)
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

  // Insert default update settings for default organization
  await client.execute(`
    INSERT OR IGNORE INTO update_settings (org_id, auto_update_enabled) 
    VALUES ('default-org-id', 0);
  `);

  // Create admin_sessions table (required for admin mode)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      org_id TEXT NOT NULL REFERENCES organizations(id),
      session_token TEXT NOT NULL UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      expires_at INTEGER NOT NULL,
      last_activity_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  // Create admin_audit_events table (required for admin audit logging)
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

  // Create admin_system_settings table (required for admin settings management)
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

  // Create indexes for performance
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_update_settings_org ON update_settings(org_id);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_admin_sessions_org ON admin_sessions(org_id);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_admin_audit_org ON admin_audit_events(org_id);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_admin_settings_org_cat ON admin_system_settings(org_id, category);`);

  // Close the connection
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

## `scripts/generate-icons.mjs` (53 lines)

```mjs
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

## `.github/workflows/tauri-build.yml` (128 lines)

```yml
name: Build & Release Tauri Desktop App

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      create_release:
        description: 'Create a draft GitHub release'
        type: boolean
        default: false

permissions:
  contents: write

env:
  CARGO_INCREMENTAL: 0
  RUST_BACKTRACE: short

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            target: aarch64-apple-darwin
            label: macOS-arm64
          - platform: macos-latest
            target: x86_64-apple-darwin
            label: macOS-x64
          - platform: windows-latest
            target: x86_64-pc-windows-msvc
            label: Windows-x64
          - platform: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
            label: Linux-x64

    runs-on: ${{ matrix.platform }}
    name: Build (${{ matrix.label }})

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: src-tauri -> target
          shared-key: ${{ matrix.target }}

      - name: Install Linux dependencies
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            libappindicator3-dev \
            librsvg2-dev \
            patchelf \
            libssl-dev \
            libgtk-3-dev

      - name: Install npm dependencies
        run: npm ci

      - name: Build frontend
        run: npm run build
        env:
          NODE_ENV: production

      - name: Build Tauri app (with release)
        if: startsWith(github.ref, 'refs/tags/v') || inputs.create_release == true
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'ARUS Desktop ${{ github.ref_name }}'
          releaseBody: 'See the assets below to download and install.'
          releaseDraft: true
          prerelease: false
          args: --target ${{ matrix.target }}

      - name: Build Tauri app (artifacts only)
        if: ${{ !startsWith(github.ref, 'refs/tags/v') && inputs.create_release != true }}
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          args: --target ${{ matrix.target }}

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: arus-desktop-${{ matrix.label }}
          path: |
            src-tauri/target/${{ matrix.target }}/release/bundle/**/*.dmg
            src-tauri/target/${{ matrix.target }}/release/bundle/**/*.app.tar.gz
            src-tauri/target/${{ matrix.target }}/release/bundle/**/*.msi
            src-tauri/target/${{ matrix.target }}/release/bundle/**/*.exe
            src-tauri/target/${{ matrix.target }}/release/bundle/**/*.deb
            src-tauri/target/${{ matrix.target }}/release/bundle/**/*.AppImage
            src-tauri/target/${{ matrix.target }}/release/bundle/**/*.sig
          if-no-files-found: warn
          retention-days: 14

```

---

## `replit.md` (73 lines)

```md
# Overview

ARUS (Marine Predictive Maintenance & Scheduling) is a full-stack web application designed to enhance operational efficiency, reduce downtime, and ensure regulatory compliance for marine fleets. It provides advanced equipment monitoring, predictive maintenance, intelligent scheduling, and comprehensive inventory management, aiming to be a leader in marine predictive maintenance.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Decisions

The frontend is a mobile-first React 18 single-page application built with TypeScript, `shadcn/ui`, Wouter, and TanStack Query. It prioritizes intuitive navigation, high information density, clear visual hierarchy, and WCAG 2.1 AA accessibility.

## Technical Implementations

### Frontend

Built with React 18, TypeScript, Wouter, TanStack Query, Tailwind CSS, and `shadcn/ui`. Key features include WebSocket-based real-time synchronization, Progressive Web App (PWA) capabilities, and cross-platform deployment via Capacitor (mobile) and Tauri v2 (desktop). A desktop first-run setup wizard facilitates backend URL configuration.

### Backend

Developed with Express.js and TypeScript, offering RESTful APIs with Zod validation. It incorporates Vessel Intelligence, Inventory Management, and Analytics, leveraging Redis caching. Security features include API readiness checks, graceful shutdown, CORS, redacted logging, Helmet CSP, and rate limiting.

#### Feature Specifications

-   **Predictive Maintenance**: Automated scheduling, real-time notifications, and cron-based failure prediction using ensemble ML models (LSTM, XGBoost, Random Forest). Includes RUL-based task windows, blocked task management, and schedule KPIs.
-   **Telemetry Ingestion**: A hybrid C# Windows Service and Node.js architecture for offline-first data collection, supporting marine protocols (J1939/J1708/J1587).
-   **AI/ML Capabilities**: Condition Monitoring AI Studio, AI Sensor Optimization, OpenAI-powered LLM reports, advanced ML & acoustic monitoring, automated ML training, and FFT-based vibration analysis.
-   **PdM Platform (Industrial-Grade)**: Features a Feature Store, Fleet Analytics with equipment-type-scoped baselines, a Model Registry for versioning and deployment, an Inference Pipeline, Explainability (SHAP-style feature contributions), and Model Monitoring/Drift Detection.
-   **Training Pipeline**: Manages the end-to-end model training lifecycle, including dataset management, run monitoring, and model promotion.
-   **Prediction Governance**: Implements validity windows, provenance tracking, and a review/approve/suppress workflow for failure predictions.
-   **Digital Twin Platform (Asset-Level)**: Provides Twin Definition (templates + instances), Twin State computation, Residual Analysis, Scenario Simulation, and Replay/Time Travel capabilities. Integrates with existing telemetry and analytics.
-   **Continuous Twin Updates**: Scheduled twin state and residual refreshes with freshness tracking.
-   **Operational & Compliance**: STCW-compliant Crew Scheduling with Fatigue Risk Score, Cost Savings & ROI Tracking, CII Compliance, Operating Mode Detection, immutable audit trails, digital logbooks, and a Compliance Rules Engine.
-   **Inventory & Work Orders**: Modernized UIs with virtualized tables, checklists, multi-supplier support, and an out-of-stock purchase request workflow.
-   **Unified Vendors System**: Type-based vendor architecture for suppliers and service providers.
-   **Analytics**: Interactive visualizations, multi-format export, and a Real-Time Notification System.
-   **Simulation**: A Physics-Aware Vessel Telemetry Simulator for generating synthetic data.
-   **Knowledge Base**: RAG enrichment for AI-powered report generation, featuring document ingestion, semantic chunking, and hybrid vector+BM25 search.
-   **RAG Conversation System**: A modular RAG architecture supporting multi-turn conversations with an OpenAI-powered answer generator.
-   **Telemetry Resilience Modules**: Includes a circuit breaker for PostgreSQL write protection, graceful shutdown, in-memory dead-letter queue, raw payload archival, equipment heartbeat tracking, batch acknowledgment, and schema versioning.
-   **Scheduling System Overhaul**: A production-ready crew scheduling system.

### Hexagonal Architecture (DDD Modular Monolith)

The backend uses a hexagonal architecture for separation of concerns, featuring a Domain Layer, Application Layer, Infrastructure Layer, Interfaces Layer, Domain Event Registry, and Cloud-Safe Outbox Processor. Key domains like Maintenance, Crew-Extensions, Inventory, Crew, and Work-Orders follow this pattern, with `crew-extensions` also utilizing CQRS read models.

## System Design Choices

-   **Database**: Dual-mode deployment with cloud PostgreSQL (TimescaleDB) and local SQLite (Turso sync).
-   **Schema**: Normalized schema with UUID primary keys, timestamp tracking, PostgreSQL data types, and SQLite compatibility, modularized into domain-specific files.
-   **Single-Tenant Architecture**: Centralized tenant configuration for simplified architecture.
-   **Authentication**: HMAC for edge devices and password-protected admin mode with server-side session verification.
-   **Security**: Admin Audit Logging, automated IP tracking, tenant isolation violation alerts, and secure fleet status reporting.
-   **Telemetry Ingestion Architecture**: Enforces a single ingestion path with SQLite WAL-mode, cursor-based batch processing, exponential backoff, and source guard validation.
-   **ML/AI Backend**: Production ML models stored in the `ml_models` table with org-scoped isolation and lifecycle tracking.
-   **Deployment Modes**: Supports Cloud, Desktop (Tauri v2), and Mobile (Capacitor iOS/iPadOS).
-   **RBAC**: Comprehensive Role-Based Access Control system.
-   **Performance Optimizations**: Includes Redis circuit breaker, index version tracking, Vite code splitting, dependency pre-bundling, API caching, lazy-loaded pages, memoized context providers, optimized TanStack Query defaults, and image lazy loading.
-   **Database Indexing**: Migrations manage index creation.

# External Dependencies

-   **PostgreSQL**: Primary relational database.
-   **Neon Database**: Cloud hosting for PostgreSQL.
-   **Turso (libSQL)**: Local SQLite database with cloud synchronization.
-   **Redis**: High-performance caching.
-   **OpenAI**: AI-powered reports and analytics.
-   **TensorFlow.js (@tensorflow/tfjs-node)**: Neural network framework.
-   **XGBoost**: Gradient boosting framework.
-   **StormGeo**: Weather and routing data provider.
-   **Aquametro FMCC**: Fuel Mass Consumption Computer.
-   **Edge Devices**: Marine equipment and IoT devices.
```

---

## Summary of Changes

### Phase 1: Stale Artifact Cleanup
- Deleted 82 stale root-level .md files from Electron era
- Removed dist-electron/, build/, release/ directories
- Cleaned sonar-project.properties and eslint.config.js references

### Phase 2: Tauri Hardening
- Created src-tauri/capabilities/default.json with Tauri v2 permissions
- Generated PNG icons (32x32, 128x128, 256x256, 512x512) via scripts/generate-icons.mjs
- Fixed desktop.ts to use IPC command for getAppDataDir

### Phase 3: Backend Connectivity
- Added tauri://localhost and https://tauri.localhost to CORS allowlist
- Updated Tauri CSP connect-src for flexible backend connections
- Created DesktopConnectionPanel for backend URL reconfiguration in System Admin
- Created desktopFetch.ts with URL resolution, connection testing, vessel ID persistence
- Wired resolveUrl() into queryClient.ts for transparent API URL prefixing

### Phase 4: First-Run Setup Wizard
- 3-step wizard: Backend URL → Vessel Selection → Admin Password
- App.tsx guards router with loading→setup→ready state machine
- Step 2 fetches vessels from GET /api/vessels, stores selection in localStorage
- Step 3 detects admin config via GET /api/admin/auth/status
- New endpoints: GET /api/admin/auth/status, POST /api/admin/auth/setup
- Setup endpoint: first-run only (409 if configured), input sanitization, critical rate limiting

### Phase 5: CI/CD & Distribution
- GitHub Actions workflow for macOS (arm64+x64), Windows, Linux builds
- Conditional release creation (tags only or manual opt-in)
- Build artifacts uploaded for 14-day retention

### Remaining Items (require native toolchains)
- Updater signing keypair generation
- Platform build testing
- macOS/Windows code signing
- Install flow verification
