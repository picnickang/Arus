# ARUS macOS Standalone Installation Guide

**Marine Predictive Maintenance & Scheduling System**  
**Version:** 1.0.0  
**Platform:** macOS 12.0+ (Intel & Apple Silicon)

---

## Quick Start

### Installation

```bash
cd arus
./scripts/macos/install.sh
```

### Access

Open http://localhost:31888 in your browser

### Default Credentials

- Organization ID: `default-org-id`
- No password required (local installation)

---

## System Requirements

### Minimum Requirements

- **macOS:** 12.0 (Monterey) or later
- **Disk Space:** 2 GB free
- **RAM:** 2 GB minimum, 4 GB recommended
- **Architecture:** Intel x86_64 or Apple Silicon ARM64

### Automatically Installed

- Node.js 20.x (via nvm if not present)
- SQLite database
- All application dependencies

### Optional (For Advanced Features)

- Xcode Command Line Tools
  - Install: `xcode-select --install`
  - Enables: ML predictions, crew optimization

---

## Installation Process

### What Gets Installed

**Application:**

- Location: `~/Library/Application Support/ARUS`
- Database: `~/Library/Application Support/ARUS/data/vessel-local.db`
- Logs: `~/Library/Logs/ARUS`

**Service:**

- Auto-starts on login via launchd
- Runs on port 31888 (localhost only)
- No internet connection required

### Installation Steps

1. **Run Installer**

   ```bash
   ./scripts/macos/install.sh
   ```

2. **Wait for Completion** (3-5 minutes)
   - System validation
   - Node.js installation (if needed)
   - Application setup
   - Database initialization
   - Service registration

3. **Access ARUS**
   - Opens automatically in your browser
   - Or visit: http://localhost:31888

---

## Core Features (Always Available)

### ✅ Guaranteed to Work

**Fleet Management:**

- Vessel registry and tracking
- Equipment health monitoring
- Real-time dashboard

**Maintenance:**

- Work order management
- Maintenance scheduling
- Service history tracking

**Inventory:**

- Parts catalog
- Stock management
- Inventory movements

**Crew:**

- Crew management
- Skills and certifications
- Assignment tracking

**Reports:**

- Downtime analysis
- Cost tracking
- PDF/CSV export

---

## Optional Features (Require Configuration)

### ML Predictions (TensorFlow)

**Status:** Disabled by default

**Enable:**

1. Install Xcode Command Line Tools:

   ```bash
   xcode-select --install
   ```

2. Edit configuration:

   ```bash
   nano ~/Library/Application\ Support/ARUS/.env
   ```

3. Set:

   ```
   ENABLE_ML_FEATURES=true
   ```

4. Restart:
   ```bash
   launchctl restart com.arus.app
   ```

### Crew Optimization (OR-Tools)

**Status:** Disabled by default

**Enable:**

```
ENABLE_CREW_OPTIMIZATION=true
```

### Hardware Telemetry (Serial Ports)

**Status:** Disabled by default

**Enable:**

```
ENABLE_HARDWARE_TELEMETRY=true
```

---

## Service Management

### Start Service

```bash
launchctl start com.arus.app
```

### Stop Service

```bash
launchctl stop com.arus.app
```

### Restart Service

```bash
launchctl stop com.arus.app && launchctl start com.arus.app
```

### Check Status

```bash
launchctl list | grep arus
```

### View Logs

```bash
# Application logs
tail -f ~/Library/Logs/ARUS/app.log

# Error logs
tail -f ~/Library/Logs/ARUS/stderr.log

# Installation log
cat ~/Library/Logs/ARUS/install.log
```

---

## Configuration

### Main Configuration File

```
~/Library/Application Support/ARUS/.env
```

### Common Settings

```bash
# Server
PORT=31888              # Web interface port
HOST=127.0.0.1         # Bind to localhost only

# Database
DATABASE_PATH=~/Library/Application Support/ARUS/data/vessel-local.db

# Features (false = disabled, true = enabled)
ENABLE_ML_FEATURES=false
ENABLE_CREW_OPTIMIZATION=false
ENABLE_HARDWARE_TELEMETRY=false
```

### Advanced Configuration

```
~/Library/Application Support/ARUS/config/standalone.json
```

---

## Troubleshooting

### Server Won't Start

**Check if port is in use:**

```bash
lsof -i :31888
```

**Solution:** Stop other service or change PORT in .env

### Database Locked

**Check who's using database:**

```bash
lsof ~/Library/Application\ Support/ARUS/data/vessel-local.db
```

**Solution:** Stop all ARUS instances

### Permission Denied

**Fix permissions:**

```bash
chmod -R 700 ~/Library/Application\ Support/ARUS
```

### Native Module Errors

**Disable problematic features:**

```bash
cd ~/Library/Application\ Support/ARUS
echo "ENABLE_ML_FEATURES=false" >> .env
echo "ENABLE_CREW_OPTIMIZATION=false" >> .env
launchctl restart com.arus.app
```

### Database Corruption

**Restore from backup:**

```bash
cd ~/Library/Application\ Support/ARUS/data
mv vessel-local.db vessel-local.db.corrupt
cp backups/vessel-local-*.db vessel-local.db
launchctl restart com.arus.app
```

---

## Backup & Restore

### Manual Backup

```bash
cd ~/Library/Application\ Support/ARUS/data
cp vessel-local.db backups/vessel-local-$(date +%Y%m%d).db
```

### Restore Backup

```bash
cd ~/Library/Application\ Support/ARUS/data
cp backups/vessel-local-YYYYMMDD.db vessel-local.db
launchctl restart com.arus.app
```

### Export to Desktop

```bash
cp ~/Library/Application\ Support/ARUS/data/vessel-local.db ~/Desktop/
```

---

## Uninstallation

### Complete Removal

```bash
./scripts/macos/uninstall.sh
```

**What Gets Deleted:**

- Application files
- Database (all data)
- Configuration
- Logs
- Service registration

**Note:** Uninstaller offers to backup database before deletion

---

## Support & Documentation

### Installation Issues

Check: `~/Library/Logs/ARUS/install.log`

### Application Errors

Check: `~/Library/Logs/ARUS/app.log`

### Detailed Documentation

- [Installation Plan](MACOS_INSTALLATION_PLAN.md)
- [Main README](README.md)

### System Status

Visit: http://localhost:31888/system/status

Shows:

- Feature availability
- Background job status
- Database connection
- Uptime and memory usage

---

## Comparison: Standalone vs Cloud

| Aspect          | macOS Standalone | Cloud (Replit)  |
| --------------- | ---------------- | --------------- |
| **Cost**        | Free             | $20-50/month    |
| **Internet**    | Not required     | Required        |
| **Setup**       | 5 minutes        | Instant         |
| **Multi-user**  | Single machine   | Multiple users  |
| **Backup**      | Manual           | Automatic       |
| **Updates**     | Reinstall        | Auto-deploy     |
| **Performance** | Fast (local)     | Network latency |

---

## FAQ

**Q: Can I access ARUS from other devices on my network?**  
A: No, it's bound to localhost (127.0.0.1) for security. For network access, consider cloud deployment.

**Q: Will ARUS work without internet?**  
A: Yes! It's completely offline-capable. Some features (LLM reports, cloud sync) require internet but are disabled by default.

**Q: Can I use PostgreSQL instead of SQLite?**  
A: Not in standalone mode. PostgreSQL support requires cloud deployment.

**Q: How do I update ARUS?**  
A: Run the installer again. It will preserve your database and configuration.

**Q: Can I run multiple instances?**  
A: No, only one instance per Mac due to port binding and database locking.

**Q: Is my data secure?**  
A: Yes. Database is stored with user-only permissions (chmod 600), and the server only listens on localhost.

---

## Next Steps

1. ✅ **Install** - Run `./scripts/macos/install.sh`
2. 🚀 **Access** - Visit http://localhost:31888
3. 📊 **Setup** - Add your first vessel
4. ⚙️ **Configure** - Enable optional features if needed
5. 📚 **Learn** - Check out the user guide

---

**Installation complete!** Enjoy using ARUS! 🚢
