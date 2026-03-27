# ARUS Windows Fix — Setup Guide

## One-Time Pre-Build Steps

These must be done once before the first production build.
They are NOT automated because they involve secrets.

### 1. Generate the updater signing keypair

```bash
npx @tauri-apps/cli signer generate -w ~/.tauri/arus.key
```

This prints a public key to stdout. Copy it into `src-tauri/tauri.conf.json`:

```json
"plugins": {
  "updater": {
    "pubkey": "PASTE_PUBLIC_KEY_HERE",
```

Store the private key and its password as GitHub Actions secrets:
- `TAURI_SIGNING_PRIVATE_KEY`  — contents of ~/.tauri/arus.key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

### 2. Set the updater endpoint URL

In `src-tauri/tauri.conf.json`, replace:
```
arusmarine/arus
```
with your actual GitHub org/repo name.

### 3. Set up Apple signing (macOS releases only)

Add these GitHub Actions secrets:
- `APPLE_SIGNING_IDENTITY`  e.g. `Developer ID Application: ACME Corp (TEAM123)`
- `APPLE_ID`                your Apple ID email
- `APPLE_PASSWORD`          app-specific password from appleid.apple.com
- `APPLE_TEAM_ID`           your 10-character Apple team ID

---

## Development Workflow

```bash
# First time
npm install
node scripts/generate-icons.mjs   # generates PNG icons

# Build the Express sidecar binary
npm run build:sidecar

# Start Tauri dev mode (hot-reload frontend + auto-sidecar)
npm run tauri:dev
```

### Generate icon.icns (macOS, run once or when icon changes)

```bash
node scripts/generate-icons.mjs
iconutil -c icns src-tauri/icons/icon.iconset -o src-tauri/icons/icon.icns
```

### Generate icon.ico (Windows, run once or when icon changes)

```bash
convert src-tauri/icons/32x32.png \
        src-tauri/icons/128x128.png \
        src-tauri/icons/icon.png \
        src-tauri/icons/icon.ico
```

---

## Production Build

```bash
npm run tauri:build
```

This runs `build:sidecar` first, then `tauri build`.

**Output — Windows:**
```
src-tauri/target/release/bundle/
  nsis/   ARUS_1.0.0_x64-setup.exe
  msi/    ARUS_1.0.0_x64_en-US.msi
```

**Output — macOS:**
```
  dmg/    ARUS_1.0.0_aarch64.dmg
          ARUS_1.0.0_x64.dmg
```

**Output — Linux:**
```
  appimage/  arus_1.0.0_amd64.AppImage
  deb/       arus_1.0.0_amd64.deb
```

---

## What the Windows Installer Does

When a customer runs `ARUS_1.0.0_x64-setup.exe`:

1. Installs `ARUS.exe` (Tauri desktop shell) to `C:\Program Files\ARUS Marine\`
2. Installs `bin\arus-server.exe` (Express backend, Node.js compiled in)
3. Installs `bin\nssm.exe` (Windows service wrapper)
4. Creates `C:\ProgramData\ARUS Marine\logs\`
5. Registers `ARUSBackend` as a Windows Service via NSSM
6. Sets service env vars: `PORT=5000`, `DEPLOYMENT_MODE=VESSEL`, `DATABASE_PATH=...`
7. Runs `arus-server.exe --init-db` to bootstrap the SQLite schema
8. Starts the `ARUSBackend` service
9. Installs WebView2 runtime (bundled, works offline)

On first ARUS launch, the first-run wizard:
- Detects the service is running, skips sidecar start
- Asks for vessel ID (optional)
- Sets admin password via POST /api/setup/complete
- Navigates to the main dashboard

On uninstall:
- NSSM stops and removes the `ARUSBackend` service
- Database at `C:\ProgramData\ARUS Marine\` is preserved (user data)

---

## File Locations on Installed Windows System

| What | Path |
|------|------|
| ARUS desktop app | `C:\Program Files\ARUS Marine\ARUS.exe` |
| Backend binary | `C:\Program Files\ARUS Marine\bin\arus-server.exe` |
| NSSM | `C:\Program Files\ARUS Marine\bin\nssm.exe` |
| SQLite database | `C:\ProgramData\ARUS Marine\vessel-local.db` |
| Backend stdout log | `C:\ProgramData\ARUS Marine\logs\backend-stdout.log` |
| Backend stderr log | `C:\ProgramData\ARUS Marine\logs\backend-stderr.log` |
| App config | `C:\Users\{user}\AppData\Roaming\com.arus.marine\` |

---

## Remaining Manual Steps Before First Release

- [ ] Run `npx @tauri-apps/cli signer generate` and set pubkey in tauri.conf.json
- [ ] Replace org/repo in tauri.conf.json updater endpoint
- [ ] Add GitHub Actions secrets (see above)
- [ ] Generate icon.icns and icon.ico (see above)
- [ ] Implement `POST /api/setup/complete` endpoint in the Express server
- [ ] Add the DesktopSetup route to client/src/App.tsx
- [ ] Run a full Windows CI build
