# ARUS Installation Guide

**Updated:** October 23, 2025

---

## 🎯 Quick Start - Choose Your Method

### Option 1: Progressive Web App (PWA) - **Recommended**

**Best for:** Everyone - works on all devices  
**Requirements:** Modern web browser (Chrome, Edge, Safari)  
**Setup time:** 30 seconds

### Option 2: Cloud Access

**Best for:** Quick testing, team collaboration  
**Requirements:** Internet connection  
**Setup time:** Instant

### Option 3: Standalone Desktop App

**Best for:** Offline vessel deployment  
**Requirements:** Windows/macOS, local SQLite database  
**Setup time:** 5-15 minutes

- **Windows:** Automated PowerShell installer
- **macOS:** Automated bash installer

---

## 📱 Option 1: Install as Progressive Web App (PWA)

### What is a PWA?

A PWA is a website that installs like a native app. It works offline, appears in your dock/taskbar, and runs in a dedicated window without browser tabs.

### Installation Steps

#### On Desktop (Chrome/Edge)

1. **Visit ARUS** in your browser

   ```
   https://your-replit-url.replit.dev
   ```

2. **Look for install prompt**
   - Chrome: Click the install icon (⊕) in the address bar
   - Or: Click the three dots menu → "Install ARUS"

3. **Click "Install"**
   - App appears in Applications folder (Mac) or Start menu (Windows)
   - Opens in its own window
   - Works offline after first visit

#### On Mobile (iOS/Android)

**iPhone/iPad (Safari):**

1. Visit ARUS in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"

**Android (Chrome):**

1. Visit ARUS in Chrome
2. Tap the three dots menu
3. Tap "Add to Home screen"
4. Tap "Add"

### PWA Features

- ✅ Works offline (caches data locally)
- ✅ Full-screen app experience
- ✅ Home screen icon
- ✅ Push notifications
- ✅ Background sync
- ✅ Auto-updates when online
- ✅ No app store required

---

## ☁️ Option 2: Cloud Access (No Installation)

### Current Replit Deployment

**URL:** `https://[your-replit-name].replit.dev`

**Features:**

- ✅ Instant access (no installation)
- ✅ Always latest version
- ✅ Access from any device
- ✅ Team collaboration
- ✅ Cloud PostgreSQL database

**Limitations:**

- ❌ Requires internet connection
- ❌ Replit dev domains may change
- ❌ Not suitable for offline vessel deployment

### For Production Cloud Deployment

See "Deploy to Render" section below.

---

## 🖥️ Option 3: Standalone Desktop App

**Note:** This is for **offline vessel deployment** only. For most users, the PWA (Option 1) is simpler and better.

### Choose Your Platform

#### Windows Installation

**Requirements:**

- Windows 10/11 (64-bit)
- 4GB RAM, 5GB disk space
- Administrator access

**Installation Steps:**

```powershell
# Open PowerShell as Administrator
cd path\to\arus
.\scripts\windows\install.ps1
```

**Access:** http://localhost:31888

📖 **Full Guide:** See [WINDOWS-INSTALLATION.md](WINDOWS-INSTALLATION.md)

#### macOS Installation

**Requirements:**

- macOS 12.0+ (Intel or Apple Silicon)
- 2GB RAM, 2GB disk space

**Installation Steps:**

```bash
cd arus
./scripts/macos/install.sh
```

**Access:** http://localhost:31888

📖 **Full Guide:** See [README-MACOS-INSTALLATION.md](README-MACOS-INSTALLATION.md)

### Standalone App Features

- ✅ Runs completely offline
- ✅ Local SQLite database
- ✅ No internet required after installation
- ✅ Full feature parity with cloud version
- ✅ Perfect for vessels at sea
- ✅ Auto-starts on boot (Windows Service / macOS launchd)

### Platform Support

| Platform           | Status    | Installer  | Service         |
| ------------------ | --------- | ---------- | --------------- |
| **Windows 10/11**  | ✅ Full   | PowerShell | Windows Service |
| **Windows Server** | ✅ Full   | PowerShell | Windows Service |
| **macOS 12+**      | ✅ Full   | Bash       | launchd         |
| **Linux**          | ⚠️ Manual | N/A        | systemd         |

---

## 🚀 Deploy to Production Cloud (Render)

### For Team/Production Use

1. **Fork the repository** to your GitHub account

2. **Sign up** at [render.com](https://render.com)

3. **Create new Web Service**
   - Connect your GitHub repository
   - Build Command: `bash scripts/build.sh`
   - Start Command: `node dist/server.js`
   - Environment: Node 20

4. **Set Environment Variables**

   ```
   DATABASE_URL=<your-postgresql-url>
   OPENAI_API_KEY=<your-openai-key>
   SESSION_SECRET=<random-string>
   ```

5. **Deploy**
   - Render builds and deploys automatically
   - Get your production URL: `https://your-app.onrender.com`

6. **Install as PWA** (see Option 1)

---

## 🔧 Development Installation

### For Developers

```bash
# 1. Clone repository
git clone [your-repo-url]
cd arus

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your database URL, API keys, etc.

# 4. Push database schema
npm run db:push

# 5. Start development server
npm run dev

# 6. Visit http://localhost:5000
```

---

## 📊 Installation Comparison

| Feature               | PWA                 | Cloud Access   | Standalone Desktop |
| --------------------- | ------------------- | -------------- | ------------------ |
| **Installation Time** | 30 seconds          | Instant        | 10-15 minutes      |
| **Offline Support**   | ✅ Yes              | ❌ No          | ✅ Yes             |
| **Auto Updates**      | ✅ Yes              | ✅ Yes         | ❌ Manual          |
| **Cross-Platform**    | ✅ All devices      | ✅ All devices | ⚠️ Windows/Mac     |
| **App Store**         | ❌ Not needed       | ❌ Not needed  | ❌ Not needed      |
| **Internet Required** | ⚠️ First visit only | ✅ Always      | ❌ Never           |
| **Best For**          | Most users          | Testing        | Offline vessels    |

---

## 🎯 Recommendations

### For Most Users

**→ Install as PWA (Option 1)**

- Easiest installation
- Works on all devices
- Automatic updates
- Offline support

### For Teams/Production

**→ Deploy to Render + Install as PWA**

- Professional hosting
- Custom domain support
- SSL/HTTPS automatic
- Scalable infrastructure

### For Offline Vessels

**→ Install Standalone Desktop App (Option 3)**

- Complete offline operation
- Local SQLite database
- No cloud dependencies
- Windows or macOS support

---

## ❓ FAQs

### Do I need to install anything?

**No!** For most users, just visit the website and optionally install it as a PWA.

### Will it work offline?

**Yes**, if you install as a PWA or use the standalone Mac app.

### How do I update?

- **PWA:** Updates automatically when online
- **Cloud:** Always latest version
- **Standalone:** Download and install new .dmg

### Can I use it on my phone?

**Yes!** Install as PWA on iPhone or Android.

### Is there a Windows version?

**Yes!** Windows standalone installation is fully supported with automated PowerShell installer. See [WINDOWS-INSTALLATION.md](WINDOWS-INSTALLATION.md) for details.

### Which installation method is best?

For **99% of users**: Install as PWA from your browser.  
For **offline vessels (Windows)**: Run PowerShell installer.  
For **offline vessels (Mac)**: Run macOS installer.

---

## 🆘 Troubleshooting

### PWA Install Button Not Showing

**Chrome/Edge:**

- Make sure you're on HTTPS (not HTTP)
- Check if already installed (look in chrome://apps)
- Try Menu → "Install ARUS"

**Safari:**

- Must use Share → Add to Home Screen
- No automatic install prompt

### Standalone Mac App Won't Start

```bash
# Check if port 31888 is available
lsof -i :31888

# View server logs
tail -f ~/Library/Logs/ARUS/app.log
```

### Database Connection Errors

**PWA/Cloud:** Contact your administrator  
**Standalone:** Check `~/Library/Application Support/ARUS/arus.db` exists

---

## 📞 Support

- **Documentation:** See `replit.md`
- **Issues:** Create GitHub issue
- **Email:** [your-support-email]

---

**Recommendation:** Start with the PWA installation - it's the easiest way to get started!
