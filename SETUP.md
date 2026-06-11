# ARUS Desktop Build & Deployment Setup

## Prerequisites

- Node.js 20+
- Rust toolchain (via `rustup`)
- Tauri CLI: `npm install -g @tauri-apps/cli`
- Platform-specific build tools:
  - **macOS**: Xcode command-line tools, `iconutil`
  - **Windows**: Visual Studio Build Tools (C++ workload), WiX Toolset v3.11+
  - **Linux**: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`

## Quick Start

```bash
npm ci
npm run setup:signing -- --repo YOUR_ORG/YOUR_REPO
npm run generate-icons
npm run build:sidecar
npm run tauri:build:vessel    # or tauri:build:cloud
```

## Signing Setup

Generate the Tauri updater keypair and patch config files:

```bash
node scripts/setup-signing.mjs --repo YOUR_ORG/YOUR_REPO
```

This creates `~/.tauri/arus.key` and updates the `pubkey` field in all three
`tauri.*.conf.json` files. Add the private key as a GitHub Actions secret:

| Secret name                          | Value                           |
| ------------------------------------ | ------------------------------- |
| `TAURI_SIGNING_PRIVATE_KEY`          | Contents of `~/.tauri/arus.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password entered during keygen  |

## Icon Generation

Place a 512x512 SVG at `client/public/icon-512.svg`, then:

```bash
node scripts/generate-icons.mjs
# macOS only:
iconutil -c icns src-tauri/icons/icon.iconset -o src-tauri/icons/icon.icns
# Windows (ImageMagick):
convert src-tauri/icons/32x32.png src-tauri/icons/128x128.png \
        src-tauri/icons/icon.png  src-tauri/icons/icon.ico
```

## Sidecar Build Pipeline

The 4-stage pipeline in `scripts/build-sidecar.mjs`:

1. **esbuild bundle** — bundles `server/index.ts` into a single CJS file,
   externalizing native modules (`@libsql/client`, `better-sqlite3`, `sharp`).
2. **Asset manifest** — scans `node_modules` for `.node` and `.wasm` files
   required by externalized packages, writes `dist/pkg-assets.json`.
3. **pkg compile** — compiles the bundle + assets into a standalone binary
   using `@yao-pkg/pkg`. Outputs to `src-tauri/binaries/arus-server-{triple}`.
4. **Smoke test** — runs `arus-server --health-check` to verify native modules
   load correctly inside the pkg snapshot.

```bash
npm run build:sidecar           # current platform only
npm run build:sidecar:all       # all platforms (cross-compile)
npm run build:sidecar:notest    # skip smoke test
```

## Windows Installer Variants

### Vessel (Air-Gapped, ~145 MB)

- WebView2 bundled offline (`offlineInstaller`)
- NSSM service registration via WiX custom actions
- Dedicated `ARUS_svc` service account
- Database at `%ProgramData%\ARUS Marine\vessel-local.db`

```bash
npm run tauri:build:vessel
```

### Cloud (~25 MB)

- WebView2 downloaded at install time (`downloadBootstrapper`)
- Same service setup, connects to remote backend

```bash
npm run tauri:build:cloud
```

## Windows Service Details

The WiX fragment (`src-tauri/windows/wix/service-component.wxs`) installs:

- `nssm.exe` and `arus-server.exe` into `<install_dir>/bin/`
- Creates `ARUS_svc` local service account
- Registers `ARUSBackend` Windows service via NSSM
- Configures auto-start, logging, and environment variables
- Runs `arus-server --init-db` post-install to initialize SQLite DB

Service management:

```powershell
nssm status ARUSBackend
nssm restart ARUSBackend
nssm stop ARUSBackend
```

Logs at: `%ProgramData%\ARUS Marine\logs\`

## bcrypt to bcryptjs Migration

The sidecar binary uses `bcryptjs` (pure JS) instead of `bcrypt` (native addon).
To migrate existing code:

```bash
npm run migrate:bcrypt          # dry run — shows what would change
npm run migrate:bcrypt:apply    # apply changes
npm uninstall bcrypt            # remove native addon
```

## CI/CD

The GitHub Actions workflow (`.github/workflows/tauri-build.yml`) builds on push
to `v*` tags:

| Job                 | Runner         | Config                 |
| ------------------- | -------------- | ---------------------- |
| macOS Apple Silicon | macos-latest   | tauri.vessel.conf.json |
| macOS Intel         | macos-latest   | tauri.vessel.conf.json |
| Linux x64           | ubuntu-22.04   | tauri.vessel.conf.json |
| Windows Vessel      | windows-latest | tauri.vessel.conf.json |
| Windows Cloud       | windows-latest | tauri.cloud.conf.json  |

Required GitHub Actions secrets:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` (macOS only)

## First-Run Setup Wizard

On desktop, when the app launches for the first time:

1. The frontend checks `GET /api/setup/status` to see if setup is complete
2. If not complete, the setup wizard collects:
   - Deployment mode (vessel/cloud)
   - Backend URL configuration
   - Vessel ID (for vessel mode)
   - Admin password
3. On completion, `POST /api/setup/complete` persists the configuration
4. The app reloads into the main dashboard

## Project Structure (Desktop-Specific)

```
src-tauri/
  src/lib.rs              Tauri commands, sidecar management
  src/main.rs             Entry point
  Cargo.toml              Rust dependencies
  tauri.conf.json         Base Tauri config
  tauri.vessel.conf.json  Vessel variant (offline WebView2)
  tauri.cloud.conf.json   Cloud variant (download WebView2)
  capabilities/           Permission declarations
  windows/wix/            WiX installer fragments
  binaries/               Compiled sidecar binaries (git-ignored)
  icons/                  App icons (generated)

scripts/
  build-sidecar.mjs       4-stage sidecar build pipeline
  generate-icons.mjs      Icon generation from SVG
  migrate-bcrypt.mjs      bcrypt -> bcryptjs codemod
  setup-signing.mjs       Updater key generation

server/
  desktop-init.ts         CLI flag handler (--init-db, --health-check)
  init-db-entry.ts        SQLite database initializer
  routes/setup.ts         First-run setup API endpoints

client/src/
  lib/desktop.ts          Tauri API wrapper
  lib/desktopFetch.ts     Desktop-aware fetch, URL resolution
  components/DesktopSetupGuard.tsx  Route guard for setup wizard
  pages/desktop-setup.tsx Setup wizard UI
```
