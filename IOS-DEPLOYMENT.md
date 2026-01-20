# ARUS iOS Deployment Guide

## Overview

ARUS can be deployed as a native iOS app with an embedded Node.js server for offline-first vessel deployment. The iOS app runs a complete ARUS instance locally using SQLite, requiring no internet connection for core functionality.

## Prerequisites

- macOS with Xcode 14+ installed
- Node.js 20+ and npm
- iOS device or simulator (iOS 13+)
- Apple Developer Account (for device testing and App Store deployment)

## Architecture

### Embedded Server Mode

The iOS app includes:

- **Embedded Node.js Server**: Runs on `http://localhost:5000`
- **SQLite Database**: Local offline-first storage
- **Auto-Generated Security**: Session secrets generated on first boot
- **Optimized for Mobile**: Background jobs and schedulers disabled

### Environment Configuration

The embedded server runs with:

```bash
EMBEDDED_MODE=true         # Enables embedded mode features
LOCAL_MODE=true            # Uses SQLite instead of PostgreSQL
NODE_ENV=production        # Production optimizations
ENABLE_BACKGROUND_JOBS=false   # Disabled for mobile
ENABLE_SCHEDULERS=false        # Disabled for mobile
```

## Build Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Frontend

```bash
npm run build
```

This creates the production frontend in `dist/`.

### 3. Initialize Capacitor

```bash
# Initialize Capacitor (first time only)
npx cap init

# Add iOS platform
npx cap add ios

# Sync files to iOS project
npx cap sync ios
```

### 4. Configure iOS Project

The iOS project will be created in `ios/App/`.

**Important Configuration:**

1. Open `ios/App/App.xcworkspace` in Xcode
2. Select your development team in Signing & Capabilities
3. Update the Bundle Identifier if needed (`com.arus.marine`)

### 5. Embed Node.js Server

Copy the server files to the iOS project:

```bash
# Copy server files
cp -r server ios/App/App/server
cp -r shared ios/App/App/shared
cp -r scripts ios/App/App/scripts
cp package.json ios/App/App/
cp tsconfig.json ios/App/App/

# Copy node_modules (or install fresh)
cp -r node_modules ios/App/App/node_modules
```

### 6. Configure iOS Build Phase

In Xcode, add a "Run Script" build phase to start the server:

1. Select your app target in Xcode
2. Go to "Build Phases"
3. Click "+" and add "New Run Script Phase"
4. Add this script:

```bash
# Start embedded Node.js server
cd "$BUILT_PRODUCTS_DIR/$CONTENTS_FOLDER_PATH"
node scripts/ios-server.js &
```

### 7. Build and Run

```bash
# Open in Xcode
npx cap open ios

# Or build from command line
npx cap run ios
```

## Testing on Device

### Local Testing

```bash
# Run on connected iOS device
npx cap run ios --target=<device-id>

# List available devices
xcrun xctrace list devices
```

### TestFlight Distribution

1. Archive the app in Xcode (Product > Archive)
2. Upload to App Store Connect
3. Add to TestFlight
4. Invite beta testers

## Production Deployment

### App Store Submission

1. **Prepare App Store Listing**
   - App name: ARUS Marine
   - Description: Marine predictive maintenance and fleet management
   - Screenshots for required device sizes
   - Privacy policy URL

2. **Archive and Upload**

   ```bash
   # In Xcode:
   # Product > Archive
   # Window > Organizer > Upload to App Store
   ```

3. **Submit for Review**
   - Complete App Store Connect listing
   - Submit for Apple review
   - Respond to any feedback

### Version Updates

When deploying updates:

```bash
# Update version in package.json
npm version patch  # or minor, major

# Rebuild
npm run build
npx cap sync ios

# Archive and upload in Xcode
```

## Troubleshooting

### Server Won't Start

Check logs in Xcode console:

```
Window > Devices and Simulators > Select device > View Device Logs
```

Common issues:

- Node.js not found: Ensure Node is in PATH
- Port conflict: Server may already be running
- SQLite initialization failed: Check file permissions

### Database Issues

Reset SQLite database:

```bash
# Delete local database
rm -rf ios/App/App/data/vessel-local.db

# Rebuild and sync
npx cap sync ios
```

### Performance Issues

The embedded server is optimized for mobile with:

- Background jobs disabled
- Schedulers disabled
- Reduced logging in production

If experiencing issues:

1. Check available storage space
2. Monitor memory usage in Xcode
3. Review server logs for errors

## Feature Limitations

Embedded iOS mode has the following limitations:

**Disabled Features:**

- ❌ Cloud sync (unless configured with Turso)
- ❌ Background prediction jobs
- ❌ Automated schedulers
- ❌ Real-time cloud updates

**Enabled Features:**

- ✅ Complete ARUS UI/UX
- ✅ Local SQLite database
- ✅ Manual data entry and import
- ✅ Equipment monitoring
- ✅ Work order management
- ✅ Offline-first operation
- ✅ AI-powered reports (if OpenAI API key configured)

## Optional Cloud Sync

To enable cloud sync, configure Turso:

```bash
# In Xcode build settings, add environment variables:
TURSO_SYNC_URL=<your-turso-url>
TURSO_AUTH_TOKEN=<your-turso-token>
```

This enables automatic bi-directional sync with the cloud when internet is available.

## Support

For issues or questions:

1. Check server logs in Xcode console
2. Review this documentation
3. Contact ARUS support team

## License

Copyright © 2025 ARUS Marine. All rights reserved.
