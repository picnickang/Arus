# ARUS Installation Guide

ARUS is a Progressive Web App (PWA) that works on any device with a web browser. No traditional installation required!

## 🌐 Access ARUS

Your ARUS system is deployed on **Render** cloud hosting and accessible from anywhere:

```
https://your-arus-app.onrender.com
```

(Replace with your actual Render URL)

---

## 📱 Install as Progressive Web App (PWA)

ARUS can be installed like a native app on any device for offline access and better performance.

### iPhone & iPad

1. Open **Safari** and navigate to your ARUS URL
2. Tap the **Share** button (square with arrow ↑)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** to install

**Features:**

- ✅ Full-screen mode (no browser bars)
- ✅ Offline access to cached data
- ✅ Home screen icon like a native app
- ✅ Background data sync

### Android

1. Open **Chrome** and navigate to your ARUS URL
2. Tap **"Install"** when the banner appears
3. Or use **Menu (⋮) → "Install app"**

**Features:**

- ✅ Standalone app mode
- ✅ Offline functionality
- ✅ Background sync
- ✅ Push notifications

### Desktop (Chrome/Edge/Safari)

1. Visit your ARUS URL in Chrome, Edge, or Safari
2. Click the **install icon (⊕)** in the address bar
3. Or use **Menu → "Install ARUS Marine"**

**Features:**

- ✅ Native window (no browser toolbar)
- ✅ Launch from desktop/dock
- ✅ Keyboard shortcuts
- ✅ Offline mode

---

## 🔐 First-Time Setup

When you first access ARUS:

1. **Admin Access**: Use the admin token configured during deployment
2. **Create Vessels**: Add your fleet vessels
3. **Add Equipment**: Register equipment on each vessel
4. **Configure Sensors**: Set up monitoring parameters
5. **Import Data**: Upload historical telemetry (optional)

---

## 💡 PWA Capabilities

ARUS works seamlessly across all your devices:

- **Offline Mode**: Access dashboard, equipment health, and work orders even without internet
- **Real-Time Sync**: Automatic updates when connection is restored
- **Cross-Platform**: Same app on iPhone, Android, tablets, and desktop
- **Shared Database**: All devices connect to the same cloud PostgreSQL database
- **Maritime Ready**: Perfect for at-sea operations with limited connectivity

---

## ❓ Troubleshooting

### Can't Install PWA

- **Safari (iOS)**: Must use Safari browser, not Chrome/Firefox
- **Chrome (Android/Desktop)**: Make sure HTTPS is enabled
- **Check Requirements**: PWA requires modern browser (Chrome 67+, Safari 11.1+, Edge 79+)

### Offline Mode Not Working

- Visit the app at least once while online to cache data
- Cached data expires after 24 hours (refresh when online)
- Some features require internet connection (AI reports, real-time sync)

### Can't Access Application

- Verify your Render deployment URL is correct
- Check that the Render service is running (login to Render dashboard)
- Clear browser cache and try again

---

## 📊 System Requirements

- **Web Browser**: Chrome 67+, Safari 11.1+, Edge 79+, Firefox 68+
- **Internet**: Required for initial access (offline mode available after)
- **Storage**: ~50 MB for cached data
- **Platform**: iOS 11.3+, Android 5+, macOS 10.13+, Windows 10+

---

## 🎉 You're Ready!

Once installed, you can:

- 🚢 Monitor your fleet from anywhere
- ⚙️ Track equipment health in real-time
- 📊 View AI-powered insights
- 🔧 Manage work orders and maintenance
- 👥 Schedule crew assignments
- 📱 Work offline at sea, sync when connected

Enjoy using ARUS! 🌊
