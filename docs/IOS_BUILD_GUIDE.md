# ARUS iPad App Build Guide

## Prerequisites

- macOS with Xcode 16+ installed
- Apple Developer account (for device testing & App Store)
- ARUS repository cloned

## Quick Start

### 1. Build Frontend

```bash
npm run build:renderer
```

### 2. Add iOS Platform (First Time Only)

```bash
npx cap add ios
```

### 3. Sync Assets to iOS

```bash
npx cap sync ios
```

### 4. Open in Xcode

```bash
npx cap open ios
```

### 5. Configure in Xcode

1. **Select Team**:
   - Click on project name in left sidebar
   - Under "Signing & Capabilities" tab
   - Select your Apple Developer team

2. **Choose Device**:
   - Top toolbar: Select "Any iOS Device (arm64)" or connected iPad
   - Or choose iPad simulator

3. **Build & Run**:
   - Click Run button (▶️) or press Cmd + R
   - App will launch on simulator/device

## App Configuration

### Bundle Identifier

`com.arus.marine`

### Display Name

ARUS Marine

### Minimum iOS Version

iOS 13.0+ (supports iPad, iPhone)

## Development Workflow

### Make Changes to React App

```bash
# 1. Edit your React code in client/src/
# 2. Build
npm run build:renderer

# 3. Sync to iOS
npx cap sync ios

# 4. Xcode will hot-reload automatically
```

### Add Native Plugins

```bash
# Example: Add camera plugin
npm install @capacitor/camera
npx cap sync ios
```

## Production Build

### 1. Build Optimized Frontend

```bash
NODE_ENV=production npm run build:renderer
```

### 2. Sync to iOS

```bash
npx cap sync ios
```

### 3. Archive in Xcode

1. Product → Archive
2. Distribute App → App Store Connect
3. Upload for TestFlight or App Store Review

## Troubleshooting

### "No development team selected"

- Xcode → Preferences → Accounts → Add Apple ID
- Select team in project settings

### "Module 'Capacitor' not found"

```bash
npx cap sync ios
```

### Changes not showing in app

```bash
npm run build:renderer
npx cap sync ios
# Then re-run in Xcode
```

### App crashes on launch

- Check Console.app for crash logs
- Verify all Capacitor plugins are installed
- Rebuild: Xcode → Product → Clean Build Folder

## Testing on Real iPad

### 1. Connect iPad via USB

### 2. Trust Computer on iPad

### 3. In Xcode, select your iPad from device menu

### 4. Click Run (may need to enable Developer Mode on iPad)

## Distribution

### TestFlight (Beta Testing)

1. Archive app in Xcode
2. Upload to App Store Connect
3. Manage builds in TestFlight section
4. Add testers via email

### App Store

1. Complete App Store Connect listing
2. Submit for review
3. Requires screenshots, description, privacy policy

## Key Features for iPad

### Supported

✅ Multi-window support (iPadOS 13+)
✅ Apple Pencil input
✅ Split View / Slide Over
✅ Keyboard shortcuts
✅ Touch gestures
✅ Offline mode (SQLite database)

### Capacitor Plugins Used

- `@capacitor/app` - App lifecycle
- `@capacitor/filesystem` - File storage
- `@capacitor/network` - Network status
- `@capacitor/status-bar` - Status bar styling

## App Icons & Splash Screens

Located in `ios/App/App/Assets.xcassets/`

### Required Assets

- **AppIcon.appiconset** - App icons (all sizes)
- **Splash.imageset** - Splash screen image

### Generate Icons

Use online tool: https://www.appicon.co/
Upload 1024x1024 icon, download iOS assets, replace in Xcode.

## App Store Requirements

- **Privacy Policy** (required URL)
- **App Screenshots** (iPad Pro 12.9", iPad Pro 11")
- **App Description** (max 4000 characters)
- **Keywords** (max 100 characters)
- **Support URL**
- **Marketing URL** (optional)

## Performance Tips

✅ Enable WebView caching
✅ Optimize images (use WebP)
✅ Lazy load routes
✅ Use production builds for testing
✅ Profile in Instruments (Xcode)

## Next Steps

1. Test all features on iPad simulator
2. Add app icons and splash screens
3. Configure App Store Connect
4. Submit for TestFlight beta
5. Gather feedback and iterate

---

Built with ❤️ using Capacitor 7
