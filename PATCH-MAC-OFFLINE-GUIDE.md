# How to Patch Offline Mac Version Without Reinstalling

**Quick Answer:** You can edit files inside the `.app` bundle to add environment variables.

---

## 🎯 Two Patching Methods

### **Method 1: Add .env File (Recommended)**

Easy to maintain and follows best practices.

### **Method 2: Edit Launcher Script**

More permanent, doesn't require .env file.

---

## 📦 Method 1: Add .env File to App Bundle

### Step 1: Open the App Bundle

```bash
# Right-click ARUS.app in Finder
# Select "Show Package Contents"

# Or use Terminal:
cd /Applications
open -a Finder "ARUS.app/Contents"
```

### Step 2: Navigate to App Resources

```
ARUS.app/
  └── Contents/
      └── Resources/
          └── ARUS-bundle/    ← Navigate here
```

### Step 3: Create .env File

Create a file named `.env` in the `ARUS-bundle` directory:

```bash
# Use Terminal (easier for hidden files):
cd "/Applications/ARUS.app/Contents/Resources/ARUS-bundle"

# Create .env file
cat > .env << 'EOF'
# Admin Authentication
ADMIN_TOKEN=Admin123
VITE_ADMIN_TOKEN=Admin123

# Application Settings
NODE_ENV=production
LOCAL_MODE=true
PORT=31888

# Database (SQLite for offline mode)
DATABASE_PATH=$HOME/Library/Application Support/ARUS/data/vessel-local.db

# Session Secret (change in production!)
SESSION_SECRET=change-this-to-random-secret
EOF

echo "✅ .env file created!"
```

### Step 4: Verify .env File

```bash
# Check the file exists
ls -la .env

# View contents
cat .env
```

### Step 5: Restart ARUS

```bash
# Stop ARUS if running
killall node 2>/dev/null || true

# Start ARUS again
open -a "ARUS"
# Or use the launcher directly:
./arus-start.sh
```

**Done!** Admin features should now work.

---

## 🔧 Method 2: Edit Launcher Script

This method modifies the startup script to set environment variables permanently.

### Step 1: Locate the Launcher

```bash
cd "/Applications/ARUS.app/Contents/Resources/ARUS-bundle"
```

### Step 2: Backup Original

```bash
# Always backup before editing!
cp arus-start.sh arus-start.sh.backup
```

### Step 3: Edit the Launcher

Open `arus-start.sh` in a text editor:

```bash
nano arus-start.sh
# Or use: vim, TextEdit, VS Code, etc.
```

Find this section:

```bash
# Set environment variables
export LOCAL_MODE=true
export NODE_ENV=production
export PORT=${PORT:-31888}
export HOST=${HOST:-127.0.0.1}
```

Add these lines after it:

```bash
# Admin authentication
export ADMIN_TOKEN="Admin123"
export VITE_ADMIN_TOKEN="Admin123"

# Session security
export SESSION_SECRET="your-random-secret-here"
```

### Step 4: Save and Make Executable

```bash
# Save the file (Ctrl+O in nano, :wq in vim)

# Ensure it's executable
chmod +x arus-start.sh

# Verify changes
cat arus-start.sh | grep ADMIN_TOKEN
```

### Step 5: Restart ARUS

```bash
killall node 2>/dev/null || true
./arus-start.sh
```

**Done!** The launcher now sets admin tokens on every startup.

---

## 🔍 Which Method to Use?

| Criteria              | .env File             | Launcher Script           |
| --------------------- | --------------------- | ------------------------- |
| **Ease of editing**   | ✅ Easy               | ⚠️ Requires text editor   |
| **Future updates**    | ✅ Preserved          | ⚠️ May be overwritten     |
| **Standard practice** | ✅ Industry standard  | ❌ Non-standard           |
| **Multiple configs**  | ✅ Supports many vars | ⚠️ Gets cluttered         |
| **Recommended**       | **YES**               | Only if .env doesn't work |

**Use Method 1 (.env file)** unless you have a specific reason not to.

---

## 🧪 Testing the Patch

### 1. Check Environment Variables

```bash
# Start ARUS and check logs
cd "/Applications/ARUS.app/Contents/Resources/ARUS-bundle"
./arus-start.sh

# In another terminal, check the process environment
ps aux | grep "node.*arus"
# Note the PID, then:
cat /proc/<PID>/environ | tr '\0' '\n' | grep ADMIN
```

### 2. Test Admin Endpoints

```bash
# Test backend auth
curl -H "Authorization: Bearer Admin123" \
     -H "x-org-id: default-org-id" \
     http://localhost:31888/api/admin/settings

# Should return JSON, not "401 Unauthorized"
```

### 3. Test Frontend

1. Open browser: http://localhost:31888
2. Navigate to: System Administration
3. Open browser console (F12)
4. Check for errors

**Should NOT see:**

- "VITE_ADMIN_TOKEN not configured"
- "Admin authentication not configured"

**Should see:**

- Settings loading successfully
- No console errors

---

## 🐛 Troubleshooting

### "Permission denied" when creating .env

**Solution:**

```bash
# Check permissions
ls -la "/Applications/ARUS.app/Contents/Resources/ARUS-bundle"

# Fix permissions (may need sudo)
sudo chmod 755 "/Applications/ARUS.app/Contents/Resources/ARUS-bundle"

# Try creating .env again
cd "/Applications/ARUS.app/Contents/Resources/ARUS-bundle"
cat > .env << 'EOF'
ADMIN_TOKEN=Admin123
VITE_ADMIN_TOKEN=Admin123
EOF
```

### .env file not being loaded

**Check if Node.js loads .env automatically:**

The current `arus-start.sh` doesn't explicitly load `.env`. You need to either:

**Option A: Install dotenv (recommended)**

```bash
cd "/Applications/ARUS.app/Contents/Resources/ARUS-bundle"

# Install dotenv package
npm install dotenv

# Edit server/index.ts to load .env at the top:
# Add this line at the very beginning:
# import 'dotenv/config'
```

**Option B: Use Method 2 (edit launcher script)**

- See Method 2 above
- Sets variables directly, no .env loading needed

### Admin endpoints still return 401

**Verify both tokens match:**

```bash
# Check backend token
echo $ADMIN_TOKEN

# Check frontend token (in browser console)
console.log(import.meta.env.VITE_ADMIN_TOKEN)

# Both should show: "Admin123"
```

**If they don't match:**

- Backend uses `ADMIN_TOKEN`
- Frontend uses `VITE_ADMIN_TOKEN`
- **They must be identical!**

### Changes not taking effect

**Hard restart everything:**

```bash
# 1. Kill all Node processes
killall node

# 2. Clear browser cache
# Chrome: Ctrl+Shift+Delete → Clear browsing data
# Safari: Cmd+Option+E

# 3. Restart ARUS
cd "/Applications/ARUS.app/Contents/Resources/ARUS-bundle"
./arus-start.sh

# 4. Hard refresh browser
# Ctrl+Shift+R (Windows/Linux)
# Cmd+Shift+R (Mac)
```

---

## 🔒 Production Security

### Current Tokens Are Insecure!

```bash
ADMIN_TOKEN=Admin123          # ❌ Too simple!
VITE_ADMIN_TOKEN=Admin123     # ❌ Exposed to browser!
```

### Generate Secure Tokens

```bash
# Generate a strong random token
openssl rand -base64 32

# Example output:
# K8vN2xP9mQwR5tY7uZ3aB6cD1eF4gH0iJ2kL3mN5oP8q

# Use this in your .env:
ADMIN_TOKEN=K8vN2xP9mQwR5tY7uZ3aB6cD1eF4gH0iJ2kL3mN5oP8q
VITE_ADMIN_TOKEN=K8vN2xP9mQwR5tY7uZ3aB6cD1eF4gH0iJ2kL3mN5oP8q
```

### Security Best Practices

1. **Change default tokens immediately**
2. **Use long random strings** (32+ characters)
3. **Don't share tokens** in screenshots/logs
4. **Rotate tokens periodically**
5. **Consider user-based auth** for production

---

## 📋 Complete Patching Checklist

- [ ] Navigate to ARUS.app bundle
- [ ] Create `.env` file with both admin tokens
- [ ] Verify file permissions (readable by app)
- [ ] Restart ARUS application
- [ ] Clear browser cache
- [ ] Test admin endpoints (curl)
- [ ] Test System Administration page
- [ ] Verify no console errors
- [ ] Change tokens to secure values
- [ ] Document changes for team

---

## 🎓 Understanding the App Structure

### Installed App Layout

```
/Applications/ARUS.app/              ← Main app bundle
  Contents/
    MacOS/
      arus                           ← Binary launcher (if Electron)
                                     ← OR shell script launcher
    Resources/
      ARUS-bundle/                   ← Your application files
        client/                      ← Frontend (React)
        server/                      ← Backend (Express)
        data/                        ← SQLite database
        scripts/                     ← Utility scripts
        arus-start.sh                ← Startup script
        package.json                 ← Dependencies
        .env                         ← CONFIG FILE (add this!)
```

### User Data Location

```
~/Library/Application Support/ARUS/
  data/
    vessel-local.db                  ← SQLite database
  logs/
    arus.log                         ← Application logs
  config/
    settings.json                    ← User preferences
```

### Why Two Locations?

- **App bundle** (`/Applications/ARUS.app/`): Read-only app code
- **User data** (`~/Library/Application Support/ARUS/`): Writable data

**Important:** Put `.env` in the **app bundle**, not user data directory!

---

## 🔄 Alternative: Patch via Script

Create an auto-patcher script:

```bash
#!/bin/bash
# patch-arus-admin.sh
# Automatically patches ARUS with admin tokens

set -e

APP_DIR="/Applications/ARUS.app/Contents/Resources/ARUS-bundle"

if [ ! -d "$APP_DIR" ]; then
  echo "❌ ARUS not installed at $APP_DIR"
  exit 1
fi

echo "🔧 Patching ARUS with admin tokens..."

cat > "$APP_DIR/.env" << 'EOF'
# Admin Authentication
ADMIN_TOKEN=Admin123
VITE_ADMIN_TOKEN=Admin123

# Application Settings
NODE_ENV=production
LOCAL_MODE=true
PORT=31888

# Session Secret
SESSION_SECRET=change-this-secret
EOF

echo "✅ Patch complete!"
echo "   Location: $APP_DIR/.env"
echo ""
echo "Next steps:"
echo "  1. Restart ARUS"
echo "  2. Visit http://localhost:31888/system-administration"
echo "  3. Change tokens to secure values!"
```

**Usage:**

```bash
chmod +x patch-arus-admin.sh
./patch-arus-admin.sh
```

---

## 💡 Key Takeaways

1. **Mac .app bundles are just folders** - Right-click → Show Package Contents
2. **Config goes in ARUS-bundle/** - Not in user data directory
3. **.env file is the cleanest solution** - Standard practice
4. **Both tokens must match** - ADMIN_TOKEN = VITE_ADMIN_TOKEN
5. **Restart after changes** - Kill node, restart app
6. **No reinstall needed!** - Just edit files in place

---

## ✅ Success Criteria

After patching, you should have:

- ✅ `.env` file in app bundle
- ✅ Both ADMIN_TOKEN and VITE_ADMIN_TOKEN set
- ✅ Tokens match each other
- ✅ ARUS restarts successfully
- ✅ System Administration page loads
- ✅ No authentication errors in console
- ✅ Admin API endpoints return 200 OK

**If all checked, your offline Mac version is successfully patched!** 🎉
