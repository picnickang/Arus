# ARUS Windows Fix — Setup Guide

## What Changed in This Version

| Issue | Fix |
|---|---|
| `bcrypt` native addon crashes in pkg | Replaced with `bcryptjs` (pure JS) in package.json |
| `$(var.SourceDir)` WiX paths unreliable | CI "Stage WiX resources" step copies binaries to the exact path WiX expects |
| libsql .node files missing from binary | Explicit asset manifest with deterministic paths + Stage 4 smoke test |
| No upgrade path | WiX stop-before-upgrade + restart-after-upgrade actions |
| Service ran as SYSTEM | Dedicated `ARUS_svc` local account with scoped permissions |
| Single ~145 MB installer for everyone | Two variants: vessel (offline WebView2) and cloud (download bootstrapper) |

---

## One-Time Pre-Build Steps

### 1. Replace `bcrypt` with `bcryptjs` in your server code

Search your server code for any `import` or `require` of `bcrypt` and replace:

```typescript
// Before
import bcrypt from 'bcrypt';
const hash = await bcrypt.hash(password, 12);
const ok   = await bcrypt.compare(password, hash);

// After
import bcrypt from 'bcryptjs';
const hash = await bcrypt.hash(password, 12);    // same API
const ok   = await bcrypt.compare(password, hash);
```

`bcryptjs` is a drop-in replacement with an identical API. It's pure JavaScript
so it compiles cleanly into the pkg binary with no native addon issues.

### 2. Generate the updater signing keypair

```bash
npx @tauri-apps/cli signer generate -w ~/.tauri/arus.key
```

Paste the public key output into both:
- `src-tauri/tauri.vessel.conf.json` -> `plugins.updater.pubkey`
- `src-tauri/tauri.cloud.conf.json`  -> `plugins.updater.pubkey`

Add GitHub Actions secrets:
- `TAURI_SIGNING_PRIVATE_KEY`           -- contents of `~/.tauri/arus.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`  -- the password you chose

### 3. Set the GitHub repo in both config files

Replace `YOUR_ORG/arus-marine` in the updater endpoints in both
`tauri.vessel.conf.json` and `tauri.cloud.conf.json`.

### 4. Set up Apple signing (macOS releases only)

Add GitHub Actions secrets:
- `APPLE_SIGNING_IDENTITY`  e.g. `Developer ID Application: ACME Corp (TEAM123)`
- `APPLE_ID`                your Apple ID email
- `APPLE_PASSWORD`          app-specific password from appleid.apple.com
- `APPLE_TEAM_ID`           your 10-character Apple team ID

### 5. Wire `--init-db` and `--health-check` into server/index.ts

See `server/index-patch.ts` for the exact block to add at the top of your
`server/index.ts` before any other code runs.

### 6. Add the DesktopSetup route to App.tsx

```tsx
import DesktopSetup from '@/pages/desktop-setup';

// In your router, add before the main routes:
<Route path="/setup" component={DesktopSetup} />
```

And in the root component, guard the router:

```tsx
import { isDesktop } from '@/lib/desktop';
import { isDesktopSetupComplete } from '@/lib/desktopFetch';

// On mount:
if (isDesktop() && !isDesktopSetupComplete()) {
  navigate('/setup');
}
```

### 7. Implement POST /api/setup/complete

The first-run wizard calls this endpoint on finish. Minimum implementation:

```typescript
app.post('/api/setup/complete', async (req, res) => {
  const { mode, vesselId, adminPassword } = req.body;
  // 1. Hash and store admin password
  // 2. Store vesselId in update_settings if provided
  // 3. Return 200 OK
  res.json({ ok: true });
});
```

---

## Development Workflow

```bash
npm install                    # installs bcryptjs, plugin-updater, plugin-process
node scripts/generate-icons.mjs

# macOS only:
iconutil -c icns src-tauri/icons/icon.iconset -o src-tauri/icons/icon.icns

# Windows only (with ImageMagick):
magick convert src-tauri/icons/32x32.png \
               src-tauri/icons/128x128.png \
               src-tauri/icons/icon.png \
               src-tauri/icons/icon.ico

npm run build:sidecar          # builds + smoke tests the Express binary
npm run tauri:dev              # starts Tauri with hot reload + auto sidecar
```

---

## Production Builds

```bash
# Vessel installer (offline WebView2 bundled, ~145 MB, for air-gapped installs)
npm run tauri:build:vessel

# Cloud installer (WebView2 downloaded at install time, ~25 MB)
npm run tauri:build:cloud
```

---

## What the Windows Installer Does (Vessel variant)

1. Installs `ARUS.exe` to `C:\Program Files\ARUS Marine\`
2. Installs `bin\arus-server.exe` (Express + Node.js, no runtime needed)
3. Installs `bin\nssm.exe` (service wrapper)
4. Installs WebView2 runtime (bundled, no internet required)
5. Creates `C:\ProgramData\ARUS Marine\logs\`
6. Creates local Windows account `ARUS_svc` (no login, service only)
7. Grants `ARUS_svc` write access to `C:\ProgramData\ARUS Marine\`
8. Registers `ARUSBackend` Windows Service via NSSM, running as `ARUS_svc`
9. Runs `arus-server.exe --init-db` to bootstrap SQLite schema
10. Starts the `ARUSBackend` service
11. On first ARUS launch -> first-run wizard -> done

On upgrade: service stops before files are replaced, restarts after.
On uninstall: service stops, is removed, `ARUS_svc` account is deleted.
Database at `C:\ProgramData\ARUS Marine\` is preserved.

---

## File Locations on Installed Windows System

| What | Path |
|------|------|
| ARUS desktop app | `C:\Program Files\ARUS Marine\ARUS.exe` |
| Backend binary | `C:\Program Files\ARUS Marine\bin\arus-server.exe` |
| NSSM | `C:\Program Files\ARUS Marine\bin\nssm.exe` |
| SQLite database | `C:\ProgramData\ARUS Marine\vessel-local.db` |
| Backend stdout log | `C:\ProgramData\ARUS Marine\logs\backend.log` |
| Backend stderr log | `C:\ProgramData\ARUS Marine\logs\backend-error.log` |
| App config / cache | `C:\Users\{user}\AppData\Roaming\com.arus.marine\` |
| Service account | Local user `ARUS_svc` |
