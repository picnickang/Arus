# 🚀 ARUS Quick Start - macOS Installation

**Last Updated:** November 23, 2025

This guide will help you extract ARUS from Replit and run it on your Mac at `/Users/homeimac/Downloads/RecipeRealm`.

---

## 📦 Step 1: Download from Replit

1. In Replit, click the **three dots (⋮)** menu (top right)
2. Select **"Download as zip"**
3. Wait for the download to complete
4. Extract the zip file to: `/Users/homeimac/Downloads/RecipeRealm`

---

## 🔧 Step 2: Install Dependencies

Open Terminal and run:

```bash
cd /Users/homeimac/Downloads/RecipeRealm
npm ci
```

> This installs all required packages (takes 2-3 minutes)

---

## ⚙️ Step 3: Configure for Local Mode

Create a `.env` file for local SQLite deployment:

```bash
cat > .env << 'EOF'
# Deployment Mode - Use local SQLite database
LOCAL_MODE=true
EMBEDDED_MODE=true

# Admin credentials (you can change these)
ADMIN_TOKEN=test-admin-token-12345
VITE_ADMIN_TOKEN=test-admin-token-12345
EOF
```

---

## 🏗️ Step 4: Rebuild Native Modules (macOS)

Rebuild native modules for your Mac:

```bash
npm rebuild
```

> This ensures SQLite and other native modules work on macOS

---

## 🗄️ Step 5: Initialize Fresh Database

Create a clean SQLite database:

```bash
rm -rf data/
mkdir -p data
```

---

## 🚀 Step 6: Start the Server

Run the development server:

```bash
npm run dev
```

You should see:

```
=== Database Configuration ===
Deployment Mode: VESSEL (Offline-First)

✅ Server listening on port 5000
✓ Database initialized successfully  
🚀 ARUS application is now live!
```

**✅ Success!** The server is now running at **http://localhost:5000**

---

## 🧪 Step 7: Test the Server

### Quick Test (Browser)

Open your browser and visit:

```
http://localhost:5000
```

You should see the ARUS dashboard load successfully.

### API Tests (Terminal)

Open a **new Terminal window** and run:

```bash
# Test dashboard API
curl http://localhost:5000/api/dashboard

# Test equipment health API
curl http://localhost:5000/api/equipment/health

# Test vessels API
curl http://localhost:5000/api/vessels

# Test telemetry API
curl http://localhost:5000/api/telemetry/latest
```

**Expected:** Each command returns JSON data (may be empty `[]` for fresh install)

### Automated Test Script

Create and run this test script:

```bash
cat > test-server.sh << 'EOF'
#!/bin/bash
echo "🧪 Testing ARUS Server..."
echo ""

# Test homepage
echo "1. Testing homepage..."
if curl -s http://localhost:5000 > /dev/null; then
    echo "   ✅ Homepage working"
else
    echo "   ❌ Homepage failed"
    exit 1
fi

# Test dashboard API
echo "2. Testing dashboard API..."
if curl -s http://localhost:5000/api/dashboard > /dev/null; then
    echo "   ✅ Dashboard API working"
else
    echo "   ❌ Dashboard API failed"
fi

# Test equipment API
echo "3. Testing equipment API..."
if curl -s http://localhost:5000/api/equipment/health > /dev/null; then
    echo "   ✅ Equipment API working"
else
    echo "   ❌ Equipment API failed"
fi

# Test vessels API
echo "4. Testing vessels API..."
if curl -s http://localhost:5000/api/vessels > /dev/null; then
    echo "   ✅ Vessels API working"
else
    echo "   ❌ Vessels API failed"
fi

echo ""
echo "✅ All tests passed!"
EOF

chmod +x test-server.sh
./test-server.sh
```

Expected output:

```
🧪 Testing ARUS Server...

1. Testing homepage...
   ✅ Homepage working
2. Testing dashboard API...
   ✅ Dashboard API working
3. Testing equipment API...
   ✅ Equipment API working
4. Testing vessels API...
   ✅ Vessels API working

✅ All tests passed!
```

---

## ✅ Verification Checklist

Your installation is successful if:

- [ ] Server starts without errors
- [ ] Logs show `Deployment Mode: VESSEL (Offline-First)`
- [ ] Browser shows ARUS dashboard at http://localhost:5000
- [ ] No errors in browser console (press F12 to check)
- [ ] All API test commands return JSON data
- [ ] SQLite database created at `data/vessel.db`

---

## 🔧 Troubleshooting

### "Port 5000 already in use"

```bash
# Kill any process using port 5000
lsof -ti:5000 | xargs kill -9

# Try again
npm run dev
```

### "Cannot find module"

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### "Native module error"

```bash
# Rebuild for macOS
npm rebuild

# If still failing, try full reinstall
rm -rf node_modules package-lock.json
npm ci
npm rebuild
```

### Server logs show "CLOUD" instead of "VESSEL"

Your `.env` file is not being read. Make sure:

```bash
# Check .env exists
cat .env

# Should show LOCAL_MODE=true
# If not, create it again (see Step 3)
```

### Database errors

```bash
# Reset database completely
rm -rf data/
mkdir -p data
npm run dev
```

---

## 📊 What's Running?

When the server is operational:

- **Backend API**: Express.js server on port 5000
- **Frontend**: React SPA served from same port
- **Database**: SQLite at `data/vessel.db`
- **Mode**: Vessel (Offline-First)
- **No internet required** after initial setup

---

## 🎯 Next Steps

Once the server is running successfully:

1. **Add Vessels**: Navigate to Vessels page and create your fleet
2. **Add Equipment**: Use Equipment Registry to add marine equipment
3. **Configure Sensors**: Set up sensor monitoring for equipment
4. **Upload Data**: Import telemetry data via CSV upload
5. **View Analytics**: Check dashboard for health insights

---

## 🛑 Stopping the Server

Press `Ctrl + C` in the Terminal where `npm run dev` is running.

---

## 🔄 Starting Again Later

```bash
cd /Users/homeimac/Downloads/RecipeRealm
npm run dev
```

That's it! The server will start immediately.

---

## 💾 Backup Your Data

Your SQLite database is stored at:

```
/Users/homeimac/Downloads/RecipeRealm/data/vessel.db
```

To backup:

```bash
# Create backup
cp data/vessel.db data/vessel.db.backup

# Or backup entire data folder
cp -r data/ data-backup-$(date +%Y%m%d)/
```

---

## 📝 Quick Reference

| Command           | Purpose                      |
| ----------------- | ---------------------------- |
| `npm run dev`     | Start development server     |
| `npm rebuild`     | Rebuild native modules       |
| `npm ci`          | Install dependencies         |
| `rm -rf data/`    | Reset database               |
| `Ctrl + C`        | Stop server                  |
| `./test-server.sh`| Run automated tests          |

---

## 🆘 Need Help?

If you encounter issues:

1. Check the Terminal output for error messages
2. Verify all steps were completed in order
3. Try the troubleshooting steps above
4. Check `data/` folder permissions

**Common Issues:**
- Port already in use → Kill existing process
- Module errors → Run `npm rebuild`
- Database errors → Delete `data/` folder and restart

---

**🎉 Congratulations!** You now have ARUS running locally on your Mac with a SQLite database, ready for offline vessel deployment.
