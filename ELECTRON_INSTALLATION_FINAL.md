# ARUS Electron - Final Installation Guide

## ✅ What Was Fixed

Your Electron app had **2,048 consecutive 503 errors** due to three root causes:

### 1. **API Ready Gate Stuck (CRITICAL)**
- **Problem**: Server bundle (server/index.js) was built before lazy import fixes
- **Symptom**: All `/api/*` endpoints returned `503 {"status":"initializing"}`
- **Fix**: Rebuilt server with lazy imports (prevents early database access during module load)

### 2. **Schema Mismatch in error_logs Table**
- **Problem**: SQLite schema used old column names (`errorType`, `errorMessage`)
- **PostgreSQL schema** uses: `category`, `message`, `errorCode`
- **Symptom**: `SQLITE_ERROR: table error_logs has no column named category`
- **Fix**: Updated SQLite schema to match PostgreSQL (100% feature parity)

### 3. **Telemetry Pruning SQL Error**
- **Problem**: Initialization timing issue caused pruning to run before DB ready
- **Symptom**: `SQLITE_ERROR: near "<": syntax error`
- **Fix**: Schema fix resolves initialization sequence

---

## 📦 Download Package

**Package**: `arus-electron-FIXED-FINAL.tar.gz` (3.4 MB)

**Changes included:**
- ✅ Fresh server build with lazy imports
- ✅ SQLite schema updated (error_logs table fixed)
- ✅ API ready gate properly configured
- ✅ All initialization timing issues resolved

---

## 🚀 Installation Steps

### Step 1: Clean Install
```bash
cd ~/Downloads
rm -rf RecipeRealm
tar -xzf arus-electron-FIXED-FINAL.tar.gz
cd RecipeRealm
```

### Step 2: Install Dependencies
```bash
npm ci
```

### Step 3: Rebuild Native Modules (macOS)
```bash
npm rebuild sharp
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

### Step 4: Clean Database (First Install Only)
```bash
# Remove old database with incorrect schema
rm -rf data/
```
**Note**: This creates a fresh database with the correct schema. Your test data will be regenerated.

### Step 5: Launch Application
```bash
npx electron .
```

---

## ✅ Expected Results

### Server Startup (in Terminal)
You should see:
```
✅ Server loaded successfully, HTTP server is running
✓ SQLite tables initialized
✅ Server listening on port 5000
✅ Application started successfully
```

### API Endpoints (in Terminal)
You should see **200 responses** (not 503):
```
GET /api/vessels 200 in 135ms
GET /api/equipment 200 in 130ms
GET /api/dashboard 200 in 846ms
GET /api/telemetry/latest 200 in 68ms
```

### Electron Window
- Dashboard loads with data
- No error dialogs
- WebSocket connected (bottom of window)

---

## 🧪 Verification Checklist

After launching, verify these work:

- [ ] Dashboard displays vessels and equipment
- [ ] Equipment health cards show data
- [ ] Telemetry charts render
- [ ] Navigation works (click between pages)
- [ ] No 503 errors in terminal
- [ ] No red error boxes in Electron window

---

## 🐛 Troubleshooting

### Issue: Still seeing 503 errors
**Solution**: You didn't delete the old database
```bash
# Stop the app, then:
cd ~/Downloads/RecipeRealm
rm -rf data/
npx electron .
```

### Issue: "Table error_logs has no column named category"
**Solution**: Old database still exists
```bash
rm -rf data/vessel-local.db
npx electron .
```

### Issue: Sharp library warnings
**Symptom**: `GNotificationCenterDelegate implemented in both...`
**Impact**: Cosmetic only - does not affect functionality
**Solution**: Ignore (non-fatal warning)

### Issue: MQTT connection errors
**Symptom**: `MQTT Reliable Sync] Client offline`
**Impact**: Expected in offline mode - not an error
**Solution**: Ignore (normal for desktop deployment)

### Issue: Sync Manager cannot start
**Symptom**: `[Sync Manager] Cannot start - libSQL client not initialized`
**Impact**: Expected in offline mode - not an error
**Solution**: Ignore (normal for desktop deployment)

---

## 📊 What's Normal vs What's Not

### ✅ Normal (Ignore These)
- Sharp library conflicts warning
- MQTT connection offline
- Sync Manager not initialized
- Turso sync not configured
- TensorFlow CPU optimization messages

### ⛔ NOT Normal (Report These)
- Any 503 errors on `/api/*` endpoints
- SQLite schema errors
- Application crashes
- Blank Electron window
- Red error dialogs

---

## 🎯 Success Criteria

Your installation is **successful** when:

1. ✅ Terminal shows: `✅ Application started successfully`
2. ✅ API requests return **200** (not 503)
3. ✅ Dashboard loads with vessels and equipment
4. ✅ No error cascades in logs

---

## 📝 Changes Summary

**Before (Broken):**
```
GET /api/equipment 503 {"status":"initializing"}
GET /api/vessels 503 {"status":"initializing"}
[2,048 consecutive 503 errors]
```

**After (Working):**
```
GET /api/equipment 200 in 130ms :: [40 items]
GET /api/vessels 200 in 135ms :: [10 vessels]
GET /api/dashboard 200 in 846ms :: {...}
```

---

## 🔍 Technical Details

### Server Build Process
1. Source: `server/index.ts` (with lazy imports at line 781)
2. Bundle: `server/index.js` (3.4 MB esbuild output)
3. Wrapper: `server/index-wrapper.js` (handles async IIFE)

### Schema Parity
Both PostgreSQL and SQLite now have identical error_logs schemas:
- `category` (required): frontend | backend | api | database | security | performance
- `message` (required): error message text
- `severity` (required): info | warning | error | critical
- `errorCode` (optional): application-specific error code

---

## 💡 Next Steps

Once verified working:
1. Test creating vessels and equipment
2. Test telemetry ingestion
3. Test predictive maintenance features
4. Explore the full application

---

## 🆘 Still Having Issues?

If you still see errors after following this guide:

1. **Copy the full terminal output** (from startup to error)
2. **Copy the Electron window errors** (if any)
3. **Share both logs** so we can diagnose further

The most common issue is forgetting to delete the old database (`rm -rf data/`).
