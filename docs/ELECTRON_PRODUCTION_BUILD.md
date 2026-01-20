# Electron Production Build Guide

## Overview

ARUS Marine supports macOS, Windows, and Linux desktop deployments via Electron. This guide covers building production-ready installers with code signing and auto-updates.

---

## Quick Start

### Development Build (Testing)

```bash
# Build all components
npm run build:renderer  # Build React frontend
npm run build:electron-main  # Build Electron main process
npm run build:server  # Compile TypeScript server

# Run in dev mode
npm run electron:dev
```

### Production Build

```bash
# macOS (DMG + ZIP)
npm run dist:mac

# Windows (NSIS + Portable)
npm run dist:win

# Linux (AppImage + DEB)
npm run dist:linux

# All platforms
npm run build:electron
```

**Output**: `release/` directory with installers

---

## Build Configuration

### electron-builder.json

```json
{
  "appId": "com.arus.marine",
  "productName": "ARUS Marine",
  "compression": "maximum",          // Optimize build size
  "publish": {                        // Auto-updater configuration
    "provider": "github",
    "owner": "YOUR_GITHUB_ORG",
    "repo": "YOUR_REPO_NAME"
  }
}
```

### Architecture Support

- **macOS**: Universal builds (x64 + ARM64/Apple Silicon)
- **Windows**: x64
- **Linux**: x64

---

## Code Signing (macOS)

### Requirements

1. **Apple Developer Account** ($99/year)
2. **Developer ID Application Certificate**
3. **Developer ID Installer Certificate** (for DMG notarization)

### Setup

```bash
# 1. Install certificates from Apple Developer portal
# 2. Set environment variables
export CSC_LINK="/path/to/certificate.p12"
export CSC_KEY_PASSWORD="your-certificate-password"
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="YOUR_TEAM_ID"

# 3. Build with signing
npm run dist:mac
```

### Entitlements

The app uses hardened runtime with these entitlements (`build/entitlements.mac.plist`):

- ✅ Allow JIT (for V8 engine)
- ✅ Unsigned executable memory (for Node.js)
- ✅ Disable library validation (for native modules)

### Notarization

electron-builder automatically notarizes when credentials are set:

```bash
# Notarization happens automatically if you set:
export APPLE_ID="..."
export APPLE_ID_PASSWORD="..."
export APPLE_TEAM_ID="..."
```

---

## Auto-Updates (GitHub Releases)

### 1. Configure GitHub Repository

Update `electron-builder.json`:

```json
{
  "publish": {
    "provider": "github",
    "owner": "your-org",
    "repo": "arus-marine"
  }
}
```

### 2. Publish Release

```bash
# Build and publish to GitHub Releases
GH_TOKEN="your-github-token" npm run dist:mac -- --publish always

# Or publish manually:
npm run dist:mac
# Then upload files from release/ to GitHub Releases
```

### 3. App Checks for Updates

The app will automatically:
- Check for updates on startup
- Download in background
- Prompt user to restart and install

**Update Channels**:
- `release` - Stable releases
- `beta` - Beta testing
- `alpha` - Nightly builds

---

## Build Optimizations

### Compression

```json
{
  "compression": "maximum"  // Reduces build size by ~30%
}
```

### ASAR Packaging

```json
{
  "asar": true,              // Package app into ASAR archive
  "asarUnpack": [            // Exclude from ASAR (needs file system access)
    "server/**/*",
    "shared/**/*"
  ]
}
```

### File Exclusions

Automatically excludes:
- Source maps (`*.map`)
- Tests (`**/__tests__/**`, `*.test.*`)
- TypeScript configs (`tsconfig.json`)
- Environment files (`.env.local`)
- Logs (`*.log`)

---

## Icons

### Requirements

- **macOS**: `build/icon.icns` (1024x1024 PNG → convert to ICNS)
- **Windows**: `build/icon.ico` (256x256 PNG → convert to ICO)
- **Linux**: `build/icon.png` (512x512 PNG)

### Convert Icons

```bash
# macOS (requires iconutil)
mkdir icon.iconset
sips -z 1024 1024 source.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o build/icon.icns

# Windows (requires imagemagick)
convert source.png -resize 256x256 build/icon.ico
```

### Placeholder Icons

Current build uses placeholders:
- `build/icon.icns.placeholder`
- `build/icon.ico.placeholder`

**Replace these with real icons before production release!**

---

## Security Hardening

### Content Security Policy

Environment-aware CSP in `electron/main.ts`:

**Development**:
```typescript
"script-src 'self' 'unsafe-inline' 'unsafe-eval'"  // Vite HMR
```

**Production**:
```typescript
"script-src 'self'"  // NO unsafe-inline/eval
```

### Sandboxing

```typescript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  safeDialogs: true
}
```

### Network Restrictions

- No remote URLs loaded in production
- All assets bundled locally
- API calls restricted to localhost in embedded mode

---

## Troubleshooting

### "Code signing failed"

**Solution**: Verify certificates installed and environment variables set:
```bash
security find-identity -v -p codesigning
```

### "Notarization failed"

**Solutions**:
1. Ensure app-specific password created (not Apple ID password)
2. Check hardened runtime enabled: `hardenedRuntime: true`
3. Verify entitlements file exists: `build/entitlements.mac.plist`

### "Server not starting in production build"

**Check**:
1. Server files unpacked from ASAR: `asarUnpack: ["server/**/*"]`
2. Correct path in main.ts: `process.resourcesPath/app.asar.unpacked/server`
3. ELECTRON_RUN_AS_NODE set for production

### "App won't open on macOS"

**Solutions**:
1. Code sign and notarize the app
2. User may need to allow in System Preferences → Security
3. Check console: `Console.app` → filter by "ARUS"

---

## Distribution

### macOS

**DMG** (recommended):
- Double-click to mount
- Drag to Applications folder
- Eject DMG

**ZIP** (auto-update):
- Extract and run
- Used by auto-updater

### Windows

**NSIS Installer**:
- Install wizard
- Optional desktop shortcut
- Uninstaller included

**Portable**:
- Single executable
- No installation required
- Run from USB drive

### Linux

**AppImage**:
- Single file
- No installation
- `chmod +x` and run

**DEB Package**:
- `sudo dpkg -i arus-marine.deb`
- System integration

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build Desktop App
on:
  push:
    tags:
      - 'v*'

jobs:
  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build macOS app
        env:
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npm run dist:mac -- --publish always
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: macos-build
          path: release/*.dmg
```

---

## Deployment Checklist

Before releasing to production:

### Pre-Build
- [ ] Update version in `package.json`
- [ ] Replace placeholder icons with real icons
- [ ] Test in development mode
- [ ] Update changelog

### Build
- [ ] Build for all platforms
- [ ] Test installers on clean systems
- [ ] Verify code signing (macOS)
- [ ] Check file sizes

### Release
- [ ] Create GitHub Release
- [ ] Upload DMG, ZIP, NSIS, AppImage
- [ ] Write release notes
- [ ] Tag version in git
- [ ] Announce to users

### Post-Release
- [ ] Monitor crash reports
- [ ] Test auto-updater
- [ ] Gather user feedback

---

## Resources

- [electron-builder Documentation](https://www.electron.build/)
- [Code Signing Guide](https://www.electron.build/code-signing)
- [Auto-Update Guide](https://www.electron.build/auto-update)
- [macOS Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

---

**Last Updated**: November 18, 2025  
**Build System**: electron-builder 26.x  
**Electron Version**: Check `package.json`
