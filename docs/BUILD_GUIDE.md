# ARUS Marine - Build & Distribution Guide

Quick reference for building and distributing the ARUS Marine application across all platforms.

## Quick Start

### Web Build

```bash
npm run build
```

**Output location:** `dist/public/` directory

### Desktop Build (Tauri v2)

```bash
# Build for current platform
npm run tauri:build

# Development mode with hot reload
npm run tauri:dev
```

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

```bash
# 1. Build frontend
npm run build

# 2. Build desktop app (includes frontend build automatically)
npm run tauri:build
```

## Production Builds (Signed)

### Prerequisites

1. **macOS:** Apple Developer certificate + notarization credentials
2. **Windows:** Code signing certificate (.pfx file)

See [Code Signing Guide](./CODE_SIGNING_GUIDE.md) for detailed setup instructions.

### Environment Variables

```bash
# macOS Code Signing
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
export APPLE_ID="your-apple-id@example.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAM_ID"

# Windows Code Signing
export TAURI_SIGNING_PRIVATE_KEY="path/to/private-key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="YOUR_PASSWORD"
```

### Build Commands

```bash
# Build signed desktop app for current platform
npm run tauri:build
```

## Build Artifacts

### macOS

| File                            | Type       | Size  | Use Case           |
| ------------------------------- | ---------- | ----- | ------------------ |
| `ARUS Marine.app`               | App Bundle | ~30MB | Direct use         |
| `ARUS Marine_x.x.x_aarch64.dmg` | DMG        | ~35MB | Apple Silicon Macs |
| `ARUS Marine_x.x.x_x64.dmg`     | DMG        | ~35MB | Intel Macs         |

### Windows

| File                              | Type           | Size  | Use Case              |
| --------------------------------- | -------------- | ----- | --------------------- |
| `ARUS Marine_x.x.x_x64-setup.exe` | NSIS Installer | ~25MB | Standard installation |
| `ARUS Marine_x.x.x_x64_en-US.msi` | MSI Installer  | ~25MB | Enterprise deployment |

### Linux

| File                               | Type     | Size  | Use Case        |
| ---------------------------------- | -------- | ----- | --------------- |
| `arus-marine_x.x.x_amd64.AppImage` | AppImage | ~30MB | Universal Linux |
| `arus-marine_x.x.x_amd64.deb`      | DEB      | ~25MB | Debian/Ubuntu   |

## Mobile Build (Capacitor)

### iOS/iPadOS

```bash
npx cap sync ios
npx cap open ios
```

Build via Xcode for iOS/iPadOS deployment.

## Icon Generation

Icons are generated from `public/icon-512x512.png`:

```bash
node scripts/generate-icons.mjs
```

**Generated icons:**

- `src-tauri/icons/` — Tauri desktop icons (32x32, 128x128, 256x256, icon.png)
- `build/icon-1024.png` — macOS base icon
- `build/icon-*.png` — Multi-resolution PNGs

## Testing Builds

### Before Distribution

1. **Test development mode first:**

   ```bash
   npm run tauri:dev
   ```

2. **Build and test release:**

   ```bash
   npm run tauri:build
   ```

3. **Check application launches:**
   - Verify UI loads correctly
   - Test database connection
   - Check all core features work

### Common Issues

**Issue:** App won't open on macOS

```bash
xattr -cr /Applications/ARUS\ Marine.app
```

**Issue:** "Unidentified developer" warning

- **Cause:** App is not signed or notarized
- **Solution:** Follow [Code Signing Guide](./CODE_SIGNING_GUIDE.md)

**Issue:** Build fails on missing Rust toolchain

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build & Release

on:
  push:
    tags:
      - "v*"

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
          node-version: "20"
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
```

## Version Management

### Updating Version Number

Update in both `package.json` and `src-tauri/tauri.conf.json`:

```json
{
  "version": "1.2.3"
}
```

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
