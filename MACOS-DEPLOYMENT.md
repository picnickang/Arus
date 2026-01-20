# ARUS macOS Deployment Guide

## Overview

ARUS can be deployed as a native macOS desktop application using Electron. The macOS app includes an embedded Node.js server for offline-first operation, requiring no cloud connection for core functionality.

## Prerequisites

- macOS 10.13 or later
- Node.js 20+ and npm
- Xcode Command Line Tools (for native builds)
- Apple Developer ID (for code signing and notarization)

## Architecture

### Embedded Server Mode

The macOS app includes:

- **Embedded Node.js Server**: Runs on `http://localhost:5000`
- **SQLite Database**: Local offline-first storage in `~/Library/Application Support/ARUS Marine/`
- **Auto-Generated Security**: Session secrets generated on first boot
- **Native macOS Integration**: Menu bar, window management, dock integration

### Environment Configuration

The embedded server runs with:

```bash
EMBEDDED_MODE=true         # Enables embedded mode features
LOCAL_MODE=true            # Uses SQLite instead of PostgreSQL
NODE_ENV=production        # Production optimizations
ENABLE_BACKGROUND_JOBS=false   # Disabled for desktop
ENABLE_SCHEDULERS=false        # Disabled for desktop
```

## Quick Start (Development)

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Application

```bash
# Build frontend
npm run build

# Build Electron main process
npx vite build --config electron.vite.config.ts
```

### 3. Run in Development Mode

```bash
# Start Electron app (development)
npx electron dist-electron/main.js
```

The app will:

1. Start the embedded Node.js server
2. Open the main window
3. Load the ARUS interface

## Production Build

### 1. Build Everything

```bash
# Build frontend
npm run build

# Build Electron main process
npx vite build --config electron.vite.config.ts
```

### 2. Package with Electron Builder

```bash
# Install electron-builder if not already installed
npm install --save-dev electron-builder

# Build macOS app
npx electron-builder --mac
```

This creates:

- `.dmg` installer in `release/` directory
- `.zip` archive for distribution
- Universal binary (Intel + Apple Silicon)

### 3. Code Signing (Optional but Recommended)

For distribution outside the App Store:

```bash
# Set up code signing identity
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="your-app-specific-password"
export TEAM_ID="your-team-id"

# Build and sign
npx electron-builder --mac --publish never
```

### 4. Notarization (Optional)

For Gatekeeper compatibility:

```bash
# Notarize the built app
npx electron-notarize --bundle-id com.arus.marine \
  --app-path release/ARUS\ Marine.app \
  --apple-id your-apple-id@example.com \
  --password your-app-specific-password \
  --team-id your-team-id
```

## Installation

### For Users

1. **Download the DMG**
   - Download `ARUS-Marine-1.0.0.dmg` from releases

2. **Install**
   - Open the DMG file
   - Drag ARUS Marine to Applications folder
   - Eject the DMG

3. **First Launch**
   - Open Applications > ARUS Marine
   - Right-click and select "Open" (first time only)
   - Click "Open" in the security dialog

4. **Usage**
   - The app runs completely offline
   - Data is stored in `~/Library/Application Support/ARUS Marine/`
   - No internet connection required

## Configuration

### Database Location

The SQLite database is stored in:

```
~/Library/Application Support/ARUS Marine/data/vessel-local.db
```

### Application Logs

Logs are available in:

```
~/Library/Logs/ARUS Marine/
```

View logs with Console.app or:

```bash
tail -f ~/Library/Logs/ARUS\ Marine/main.log
```

### Environment Variables

Create a `.env` file in the app's resources folder to configure:

```bash
# Optional: Enable cloud sync
TURSO_SYNC_URL=your-turso-url
TURSO_AUTH_TOKEN=your-turso-token

# Optional: Enable AI features
OPENAI_API_KEY=your-openai-key
```

## Development

### Project Structure

```
electron/
  ├── main.ts           # Electron main process
  └── preload.ts        # Preload script
dist-electron/          # Compiled Electron code
release/                # Built applications
electron-builder.json   # Build configuration
```

### Running Tests

```bash
# Build and test
npm run build
npx vite build --config electron.vite.config.ts
npx electron dist-electron/main.js
```

### Debugging

1. **Enable DevTools**
   - Uncomment in `electron/main.ts`:

   ```typescript
   mainWindow?.webContents.openDevTools();
   ```

2. **Server Logs**
   - Check Console.app for server output
   - Look for `[Server]` prefixed logs

3. **Database Inspection**
   ```bash
   sqlite3 ~/Library/Application\ Support/ARUS\ Marine/data/vessel-local.db
   ```

## Troubleshooting

### App Won't Open

**Issue**: "App is damaged and can't be opened"

**Solution**: Remove quarantine attribute

```bash
xattr -cr /Applications/ARUS\ Marine.app
```

### Server Won't Start

**Check logs**:

```bash
cat ~/Library/Logs/ARUS\ Marine/main.log
```

**Common causes**:

- Port 5000 already in use
- Node.js not bundled correctly
- SQLite database corruption

### Port Already in Use

Kill any process using port 5000:

```bash
lsof -ti:5000 | xargs kill -9
```

### Reset Database

Delete and restart:

```bash
rm -rf ~/Library/Application\ Support/ARUS\ Marine/data/
# Restart the app - database will be recreated
```

## Updates

### Manual Updates

1. Download new DMG
2. Close running ARUS app
3. Replace in Applications folder
4. Restart app

### Auto-Updates (Future)

The app can be configured for automatic updates using:

- GitHub Releases
- Custom update server
- In-app update notifications

## Distribution

### Direct Distribution

1. Build the app
2. Upload `.dmg` to your server
3. Share download link

### Mac App Store

1. Create App Store provisioning profile
2. Build with App Store target:
   ```bash
   npx electron-builder --mac mas
   ```
3. Submit via App Store Connect

### Enterprise Distribution

For internal deployment:

1. Sign with Developer ID
2. Distribute via MDM or internal portal
3. Provide installation instructions

## Feature Comparison

### macOS Desktop App vs Web App

**Desktop App Advantages**:

- ✅ Complete offline operation
- ✅ Native menu bar and shortcuts
- ✅ Dock integration
- ✅ No browser required
- ✅ Auto-start on login (configurable)
- ✅ Better file system access

**Web App Advantages**:

- ✅ No installation required
- ✅ Auto-updates
- ✅ Cross-platform access
- ✅ Centralized data management

## Performance

The macOS app is optimized with:

- Background jobs disabled
- Schedulers disabled
- Reduced logging in production
- Efficient SQLite WAL mode

Expected resource usage:

- **Memory**: 200-300 MB
- **CPU**: <5% idle, 10-20% active use
- **Disk**: ~500 MB installed, data varies

## Security

### Code Signing

Apps should be signed with:

```bash
codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" ARUS\ Marine.app
```

### Hardened Runtime

Enabled by default in `electron-builder.json`

### Entitlements

Required entitlements in `build/entitlements.mac.plist`:

- `com.apple.security.cs.allow-unsigned-executable-memory`
- `com.apple.security.network.client`
- `com.apple.security.files.user-selected.read-write`

## Support

For issues:

1. Check logs in Console.app
2. Review this documentation
3. Contact ARUS support

## License

Copyright © 2025 ARUS Marine. All rights reserved.
