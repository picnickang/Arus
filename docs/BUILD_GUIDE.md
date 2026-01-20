# ARUS Marine - Build & Distribution Guide

Quick reference for building and distributing the ARUS Marine application across all platforms.

## Quick Start

### Development Builds (Unsigned)

```bash
# Build for macOS (creates DMG + ZIP)
npm run dist:mac

# Build for Windows (creates NSIS installer + portable)
npm run dist:win

# Build for Linux (creates AppImage + DEB)
npm run dist:linux

# Build all platforms
npm run dist
```

**Output location:** `release/` directory

### Custom Build Script (Recommended)

Uses the optimized build process with TypeScript transpilation:

```bash
# Build for macOS
./scripts/build-electron-complete.sh mac

# Build for Windows
./scripts/build-electron-complete.sh win

# Build for Linux
./scripts/build-electron-complete.sh linux

# Build all platforms
./scripts/build-electron-complete.sh
```

## Build Process

The complete build process includes 5 steps:

1. **Transpile shared/ TypeScript** → JavaScript (reduces package size)
2. **Build frontend** (Vite) → `dist/`
3. **Build Electron main process** → `dist-electron/`
4. **Build server bundle** (esbuild) → `server/index.js`
5. **Package with electron-builder** → `release/`

### Manual Step-by-Step

```bash
# 1. Transpile shared TypeScript files
node scripts/build-shared.mjs

# 2. Build frontend
npm run build:renderer

# 3. Build Electron main process
npm run build:electron-main

# 4. Build server bundle
npm run build:server

# 5. Package (choose platform)
electron-builder --mac
electron-builder --win
electron-builder --linux
```

## Production Builds (Signed & Notarized)

### Prerequisites

1. **macOS:** Apple Developer certificate + notarization credentials
2. **Windows:** Code signing certificate (.pfx file)

See [Code Signing Guide](./CODE_SIGNING_GUIDE.md) for detailed setup instructions.

### Environment Variables

```bash
# macOS Code Signing
export CSC_NAME="Developer ID Application: Your Name (TEAM_ID)"
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAM_ID"

# Windows Code Signing
export WIN_CSC_LINK="./certs/windows-cert.pfx"
export WIN_CSC_KEY_PASSWORD="YOUR_PASSWORD"
```

### Build Commands

```bash
# Build signed macOS app (with notarization)
npm run dist:mac

# Build signed Windows app
npm run dist:win

# Build all platforms signed
npm run dist
```

## Build Artifacts

### macOS

| File | Type | Size | Use Case |
|------|------|------|----------|
| `ARUS Marine-x.x.x-arm64.dmg` | DMG | ~150MB | Apple Silicon Macs |
| `ARUS Marine-x.x.x-x64.dmg` | DMG | ~150MB | Intel Macs |
| `ARUS Marine-x.x.x-arm64-mac.zip` | ZIP | ~120MB | Alternative distribution |
| `ARUS Marine-x.x.x-x64-mac.zip` | ZIP | ~120MB | Alternative distribution |

**Universal Binary:** Both architectures included in each DMG

### Windows

| File | Type | Size | Use Case |
|------|------|------|----------|
| `ARUS Marine Setup x.x.x.exe` | NSIS Installer | ~100MB | Standard installation |
| `ARUS Marine x.x.x.exe` | Portable | ~100MB | No installation required |

### Linux

| File | Type | Size | Use Case |
|------|------|------|----------|
| `ARUS Marine-x.x.x.AppImage` | AppImage | ~120MB | Universal Linux |
| `arus-marine_x.x.x_amd64.deb` | DEB | ~100MB | Debian/Ubuntu |

## Icon Generation

Icons are automatically generated from `public/icon-512x512.png`:

```bash
node scripts/generate-icons.mjs
```

**Generated icons:**
- `build/icon-1024.png` → Auto-converts to ICNS (macOS)
- `build/icon-256.png` → Auto-converts to ICO (Windows)
- Plus intermediate sizes for proper multi-resolution support

## Package Size Optimization

### TypeScript Exclusion

The build process now excludes TypeScript source files from the package:

**Before optimization:**
- Package includes: 100+ server .ts files + 12 shared .ts files (~500KB)
- Total package: ~150MB

**After optimization:**
- TypeScript transpiled to JavaScript first
- Only .js files included in package
- TypeScript sources excluded via electron-builder.json
- **Size reduction:** ~500KB smaller package

### What's Included

```
release/mac/ARUS Marine.app/
├── Contents/
│   ├── MacOS/
│   │   └── ARUS Marine (executable)
│   └── Resources/
│       ├── app.asar (compressed application)
│       │   ├── dist/ (frontend - Vite build)
│       │   ├── dist-electron/ (Electron main process)
│       │   ├── server/
│       │   │   ├── index.js (bundled backend - 3.4MB)
│       │   │   ├── index-wrapper.js
│       │   │   └── data/ (runtime data)
│       │   ├── shared/ (JavaScript only - .ts excluded)
│       │   ├── scripts/ (build scripts)
│       │   └── node_modules/
│       └── app.asar.unpacked/
│           ├── server/ (for native modules)
│           └── shared/ (for runtime access)
```

### What's Excluded

- ❌ TypeScript source files (`**/*.ts`)
- ❌ Source maps (`**/*.map`)
- ❌ Test files (`**/*.test.*`, `**/*.spec.*`)
- ❌ Test directories (`__tests__`, `test/`)
- ❌ Development configs (`tsconfig.json`)
- ❌ Log files (`**/*.log`)
- ❌ Local env files (`.env.local`)

## Testing Builds

### Before Distribution

1. **Test unsigned build first:**
   ```bash
   npm run dist:mac
   open release/mac/ARUS\ Marine.app
   ```

2. **Check application launches:**
   - Verify UI loads correctly
   - Test database connection (SQLite mode)
   - Check all core features work

3. **Verify package contents:**
   ```bash
   # macOS
   ls -lh release/mac/ARUS\ Marine.app/Contents/Resources/
   
   # Windows
   7z l "release/ARUS Marine Setup.exe"
   ```

4. **Check file sizes:**
   ```bash
   du -sh release/mac/*.dmg
   du -sh release/*.exe
   ```

### Common Issues

**Issue:** App won't open on macOS

```bash
# Check why app was blocked
xattr -l /Applications/ARUS\ Marine.app

# Remove quarantine attribute for testing
xattr -cr /Applications/ARUS\ Marine.app
```

**Issue:** "Unidentified developer" warning

- **Cause:** App is not signed or notarized
- **Solution:** Follow [Code Signing Guide](./CODE_SIGNING_GUIDE.md)
- **Workaround:** System Preferences → Security → "Open Anyway"

**Issue:** Build fails on missing modules

```bash
# Clean and rebuild
rm -rf node_modules dist dist-electron server/index.js
npm install
npm run build:electron
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build & Release

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
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build application
        env:
          CSC_NAME: ${{ secrets.MAC_CSC_NAME }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: ./scripts/build-electron-complete.sh mac
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: mac-builds
          path: release/*.dmg

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build application
        env:
          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_PASSWORD }}
        run: npm run dist:win
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: windows-builds
          path: release/*.exe
```

### Secrets Configuration

**GitHub Repository Settings → Secrets:**

- `MAC_CSC_NAME`: Developer ID Application certificate name
- `APPLE_ID`: Apple Developer email
- `APPLE_PASSWORD`: App-specific password
- `APPLE_TEAM_ID`: Team ID from Apple Developer
- `WIN_CSC_LINK`: Base64-encoded .pfx certificate
- `WIN_CSC_PASSWORD`: Certificate password

## Version Management

### Updating Version Number

Update in `package.json`:

```json
{
  "version": "1.2.3"
}
```

Electron-builder automatically uses this version for all builds.

### Release Naming Convention

```
ARUS Marine-{version}-{arch}-{platform}.{ext}

Examples:
- ARUS Marine-1.2.3-arm64.dmg
- ARUS Marine-1.2.3-x64.dmg
- ARUS Marine Setup 1.2.3.exe
- ARUS Marine-1.2.3.AppImage
```

## Distribution

### macOS

**Option 1: Direct Distribution (Notarized)**
- Distribute DMG via website download
- Users can install immediately (no warnings)

**Option 2: Mac App Store**
- Requires App Store provisioning profile
- Apple review process (1-7 days)
- 30% revenue share for paid apps

### Windows

**Option 1: Direct Distribution (Signed)**
- Distribute NSIS installer or portable exe
- Standard certificate: SmartScreen warnings for 3-6 months
- EV certificate: No warnings from day 1

**Option 2: Microsoft Store**
- Requires Microsoft Developer account ($19 one-time)
- Microsoft review process
- Better discoverability

### Linux

**Option 1: Direct Distribution**
- AppImage (universal)
- DEB package (Debian/Ubuntu)

**Option 2: Package Managers**
- Snapcraft
- Flatpak
- AUR (Arch User Repository)

## Resources

- [Electron Builder Docs](https://www.electron.build/)
- [Code Signing Guide](./CODE_SIGNING_GUIDE.md)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Windows Code Signing](https://docs.microsoft.com/en-us/windows/win32/seccrypto/using-signtool-to-sign-a-file)

---

**Questions or Issues?**

Check the troubleshooting sections in:
1. This guide (above)
2. [Code Signing Guide](./CODE_SIGNING_GUIDE.md)
3. Electron Builder documentation
