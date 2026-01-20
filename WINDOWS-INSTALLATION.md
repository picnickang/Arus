# ARUS Windows Installation Guide

**Marine Predictive Maintenance & Scheduling System**  
**Version:** 1.0.0  
**Platform:** Windows 10/11 & Windows Server 2019/2022

---

## 🎯 Quick Start - Choose Your Method

### Option 1: Progressive Web App (PWA) - **Recommended**

**Best for:** Most Windows users  
**Requirements:** Edge, Chrome, or Firefox  
**Setup time:** 30 seconds  
**Install:** Visit ARUS URL → Click install icon in address bar

### Option 2: Standalone Windows Installation

**Best for:** Offline vessels, local development  
**Requirements:** Windows 10/11, 4GB RAM  
**Setup time:** 10-15 minutes  
**Install:** Run automated PowerShell installer

### Option 3: Windows Server Production Deployment

**Best for:** Enterprise, multi-user environments  
**Requirements:** Windows Server 2019+, PostgreSQL  
**Setup time:** 30-45 minutes  
**Install:** Manual setup with IIS + PM2

---

## 📱 Option 1: Install as PWA (Easiest)

### Installation on Windows Desktop

**Using Microsoft Edge:**

1. Visit ARUS in Edge browser
2. Click the install icon (⊕) in the address bar
3. Click "Install"
4. App appears in Start Menu

**Using Google Chrome:**

1. Visit ARUS in Chrome
2. Click three dots → "Install ARUS"
3. Click "Install"
4. App appears in Start Menu and desktop

### PWA Features

- ✅ Works offline after first visit
- ✅ Appears in Start Menu
- ✅ Runs in dedicated window
- ✅ Auto-updates when online
- ✅ No installation required
- ✅ Works on Windows 10/11

---

## 🖥️ Option 2: Standalone Windows Installation

### System Requirements

**Minimum:**

- Windows 10 (version 1909+) or Windows 11
- 4GB RAM (8GB recommended)
- 5GB free disk space
- Internet connection (for initial setup only)

**Architecture:**

- x64 (64-bit) required
- ARM64 not currently supported

### Automatic Installation (Recommended)

**1. Download ARUS**

```powershell
# Open PowerShell as Administrator
# Download and extract ARUS
Invoke-WebRequest -Uri https://github.com/your-org/arus/archive/main.zip -OutFile $env:TEMP\arus.zip
Expand-Archive -Path $env:TEMP\arus.zip -DestinationPath C:\ARUS
cd C:\ARUS\arus-main
```

**2. Run Installer**

```powershell
# Run as Administrator
.\scripts\windows\install.ps1
```

**3. Installation Process (10-15 minutes)**
The installer will:

- ✅ Install Node.js 20 LTS (if not present)
- ✅ Install application dependencies
- ✅ Create SQLite database
- ✅ Configure Windows Service
- ✅ Set up auto-start on boot
- ✅ Open browser to http://localhost:31888

### What Gets Installed

**Application Location:**

```
C:\ProgramData\ARUS\
  ├── app\              # Application files
  ├── data\             # SQLite database
  ├── logs\             # Application logs
  └── config\           # Configuration files
```

**Windows Service:**

- Name: `ARUS-Marine-Management`
- Startup Type: Automatic
- Runs as: Local System Account
- Port: 31888 (localhost only)

**Start Menu Shortcuts:**

- ARUS Web Interface (opens browser)
- ARUS Service Manager
- ARUS Logs Viewer
- Uninstall ARUS

### Manual Installation (Advanced)

**Prerequisites:**

```powershell
# 1. Install Node.js 20 LTS
winget install OpenJS.NodeJS.LTS

# 2. Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

**Setup:**

```powershell
# 1. Create application directory
mkdir C:\ARUS
cd C:\ARUS

# 2. Extract source code
# (Copy ARUS files to C:\ARUS)

# 3. Install dependencies
npm install --production

# 4. Create data directory
mkdir C:\ARUS\data

# 5. Configure environment
Copy-Item .env.example .env
# Edit .env with Notepad
notepad .env
```

**Required Environment Variables:**

```env
# Server Configuration
NODE_ENV=production
PORT=31888
HOST=127.0.0.1

# Database (SQLite for standalone)
DATABASE_PATH=C:\ARUS\data\vessel-local.db
DEPLOYMENT_MODE=STANDALONE

# Features (disable for offline)
ENABLE_ML_FEATURES=false
ENABLE_CLOUD_SYNC=false
ENABLE_OPENAI_REPORTS=false

# Security
SESSION_SECRET=generate-random-string-here
```

**Create Windows Service:**

```powershell
# Install node-windows globally
npm install -g node-windows

# Create service installer script
@"
var Service = require('node-windows').Service;

var svc = new Service({
  name: 'ARUS Marine Management',
  description: 'ARUS Predictive Maintenance System',
  script: 'C:\\ARUS\\server\\index.js',
  nodeOptions: [
    '--max_old_space_size=2048'
  ],
  env: [{
    name: 'NODE_ENV',
    value: 'production'
  }]
});

svc.on('install', function(){
  svc.start();
  console.log('ARUS service installed and started');
});

svc.install();
"@ | Out-File -FilePath install-service.js

# Run installer
node install-service.js
```

---

## 🏢 Option 3: Windows Server Production Deployment

### System Requirements

**Server:**

- Windows Server 2019/2022 (recommended)
- 8GB+ RAM
- 20GB+ disk space
- Static IP or domain name

**Software:**

- Node.js 20 LTS
- PostgreSQL 15/16
- IIS 10 (optional, for reverse proxy)
- SSL certificate (for HTTPS)

### Installation Steps

**Step 1: Install Node.js**

```powershell
# Using winget (Windows Server 2022+)
winget install OpenJS.NodeJS.LTS

# Or download from nodejs.org
# Verify
node --version
npm --version
```

**Step 2: Install PostgreSQL**

```powershell
# Download installer
# https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

# Install PostgreSQL 16 (recommended)
# During installation:
# - Port: 5432
# - Superuser password: [SECURE PASSWORD]
# - Locale: English, United States
# - Data directory: C:\PostgreSQL\16\data
```

**Post-Install PostgreSQL Configuration:**

```powershell
# Navigate to PostgreSQL data directory
cd "C:\Program Files\PostgreSQL\16\data"

# Edit postgresql.conf
notepad postgresql.conf
```

Add these settings (adjust for your server specs):

```ini
# For 8GB RAM server
max_connections = 200
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 5242kB
min_wal_size = 1GB
max_wal_size = 4GB
```

**Configure remote access (pg_hba.conf):**

```ini
# Edit pg_hba.conf
notepad pg_hba.conf

# Add (adjust IP range for your network)
host    all             all             192.168.1.0/24            scram-sha-256
```

**Create ARUS database:**

```powershell
# Open PostgreSQL command line
psql -U postgres

# In psql:
CREATE USER arus_user WITH PASSWORD 'your-secure-password';
CREATE DATABASE arus_db OWNER arus_user;
GRANT ALL PRIVILEGES ON DATABASE arus_db TO arus_user;
\q

# Restart PostgreSQL service
Restart-Service postgresql-x64-16
```

**Step 3: Deploy ARUS Application**

```powershell
# Create application directory
mkdir C:\inetpub\arus
cd C:\inetpub\arus

# Copy ARUS source files
# (Use Git, FTP, or file copy)

# Install dependencies
npm install --production

# Build application
npm run build
```

**Configure Environment:**

```powershell
# Create .env file
@"
NODE_ENV=production
PORT=5000

# PostgreSQL Connection
DATABASE_URL=postgresql://arus_user:your-password@localhost:5432/arus_db
DEPLOYMENT_MODE=CLOUD

# Security
SESSION_SECRET=$(New-Guid)
ADMIN_TOKEN=$(New-Guid)

# Features
ENABLE_ML_FEATURES=true
ENABLE_OPENAI_REPORTS=true

# API Keys (if using cloud features)
OPENAI_API_KEY=your-openai-key
"@ | Out-File -FilePath .env -Encoding utf8
```

**Step 4: Install PM2 Process Manager**

```powershell
# Install PM2 globally
npm install -g pm2
npm install -g pm2-windows-service

# Configure PM2 as Windows Service
pm2-service-install -n PM2

# Start ARUS with PM2
pm2 start dist/index.js --name arus --instances 4 --node-args="--max-old-space-size=2048"
pm2 save
pm2 startup windows

# Verify
pm2 status
pm2 logs arus
```

**Step 5: Configure IIS Reverse Proxy (Optional)**

Install URL Rewrite and Application Request Routing:

```powershell
# Using Web Platform Installer
# Or download manually:
# https://www.iis.net/downloads/microsoft/url-rewrite
# https://www.iis.net/downloads/microsoft/application-request-routing
```

Create IIS website:

```powershell
# Import IIS module
Import-Module WebAdministration

# Create application pool
New-WebAppPool -Name "ARUS_AppPool"
Set-ItemProperty IIS:\AppPools\ARUS_AppPool -Name managedRuntimeVersion -Value ""

# Create website
New-Website -Name "ARUS" -Port 80 -PhysicalPath "C:\inetpub\arus\public" -ApplicationPool "ARUS_AppPool"
```

Create web.config for reverse proxy:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyInboundRule" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://localhost:5000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
    <httpProtocol>
      <customHeaders>
        <add name="X-Frame-Options" value="SAMEORIGIN" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>
```

**Step 6: Configure SSL (HTTPS)**

```powershell
# Install SSL certificate in IIS
# 1. Open IIS Manager
# 2. Select server → Server Certificates
# 3. Import certificate or use Let's Encrypt

# Bind HTTPS to website
New-WebBinding -Name "ARUS" -Protocol "https" -Port 443 -SslFlags 1
```

**Step 7: Configure Firewall**

```powershell
# Allow HTTP/HTTPS
New-NetFirewallRule -DisplayName "ARUS HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "ARUS HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow

# Block direct access to Node.js port (optional)
New-NetFirewallRule -DisplayName "Block Node.js Port" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Block
```

---

## 🔧 Service Management

### Using Windows Services (Standalone Installation)

**Start Service:**

```powershell
Start-Service "ARUS-Marine-Management"
```

**Stop Service:**

```powershell
Stop-Service "ARUS-Marine-Management"
```

**Restart Service:**

```powershell
Restart-Service "ARUS-Marine-Management"
```

**Check Status:**

```powershell
Get-Service "ARUS-Marine-Management"
```

**View Event Log:**

```powershell
Get-EventLog -LogName Application -Source "ARUS-Marine-Management" -Newest 50
```

### Using PM2 (Server Deployment)

**View Status:**

```powershell
pm2 status
```

**View Logs:**

```powershell
pm2 logs arus
pm2 logs arus --lines 100
```

**Restart Application:**

```powershell
pm2 restart arus
```

**Monitor in Real-time:**

```powershell
pm2 monit
```

---

## 📂 File Locations

### Standalone Installation

```
C:\ProgramData\ARUS\
  ├── app\                    # Application files
  ├── data\
  │   └── vessel-local.db     # SQLite database
  ├── logs\
  │   ├── app.log            # Application log
  │   ├── error.log          # Error log
  │   └── install.log        # Installation log
  └── config\
      └── .env               # Configuration

C:\Program Files\nodejs\     # Node.js installation
C:\Users\[User]\AppData\Local\Programs\ARUS\  # Shortcuts
```

### Server Deployment

```
C:\inetpub\arus\             # Application root
  ├── dist\                   # Built application
  ├── public\                 # Static files
  ├── node_modules\           # Dependencies
  └── .env                    # Configuration

C:\Program Files\PostgreSQL\16\
  ├── data\                   # Database files
  └── data\pg_log\           # PostgreSQL logs

C:\Users\[User]\.pm2\
  └── logs\                   # PM2 logs
```

---

## 🔍 Troubleshooting

### Service Won't Start

**Check Port Availability:**

```powershell
# Check if port 31888 is in use
netstat -ano | findstr :31888

# Kill process if needed
taskkill /F /PID [PID]
```

**View Service Logs:**

```powershell
# Application logs
Get-Content C:\ProgramData\ARUS\logs\app.log -Tail 50

# Windows Event Viewer
eventvwr.msc
# → Windows Logs → Application → Filter by source "ARUS"
```

**Check Node.js Installation:**

```powershell
node --version
npm --version

# Reinstall if needed
winget uninstall OpenJS.NodeJS
winget install OpenJS.NodeJS.LTS
```

### Database Connection Errors

**PostgreSQL:**

```powershell
# Check service status
Get-Service postgresql-x64-16

# View logs
Get-Content "C:\Program Files\PostgreSQL\16\data\pg_log\*.log" -Tail 100

# Test connection
psql -U arus_user -d arus_db -h localhost
```

**SQLite (Standalone):**

```powershell
# Check database file exists
Test-Path C:\ProgramData\ARUS\data\vessel-local.db

# Check file permissions
icacls C:\ProgramData\ARUS\data\vessel-local.db
```

### Permission Errors

**Run as Administrator:**

```powershell
# Right-click PowerShell → Run as Administrator
```

**Fix File Permissions:**

```powershell
# Grant full control to SYSTEM account
icacls C:\ProgramData\ARUS /grant "NT AUTHORITY\SYSTEM:(OI)(CI)F" /T
```

### High Memory Usage

**Increase Node.js Memory:**

```powershell
# For standalone (edit service):
# Open services.msc → ARUS service → Properties → Path to executable
# Add: --max-old-space-size=4096

# For PM2:
pm2 stop arus
pm2 delete arus
pm2 start dist/index.js --name arus --node-args="--max-old-space-size=4096"
pm2 save
```

---

## 💾 Backup & Restore

### Standalone (SQLite)

**Manual Backup:**

```powershell
# Stop service
Stop-Service "ARUS-Marine-Management"

# Copy database
$date = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item "C:\ProgramData\ARUS\data\vessel-local.db" "C:\Backups\ARUS\vessel-local-$date.db"

# Start service
Start-Service "ARUS-Marine-Management"
```

**Automated Backup (Task Scheduler):**

```powershell
# Create backup script
@"
Stop-Service "ARUS-Marine-Management"
`$date = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item "C:\ProgramData\ARUS\data\vessel-local.db" "C:\Backups\ARUS\vessel-local-`$date.db"
Start-Service "ARUS-Marine-Management"

# Keep only last 30 backups
Get-ChildItem "C:\Backups\ARUS\vessel-local-*.db" |
  Sort-Object -Property LastWriteTime -Descending |
  Select-Object -Skip 30 |
  Remove-Item
"@ | Out-File -FilePath "C:\ARUS\backup.ps1"

# Schedule daily backup at 2 AM
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\ARUS\backup.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "ARUS Daily Backup" -Action $action -Trigger $trigger -Principal $principal
```

**Restore Backup:**

```powershell
Stop-Service "ARUS-Marine-Management"
Copy-Item "C:\Backups\ARUS\vessel-local-20241029.db" "C:\ProgramData\ARUS\data\vessel-local.db" -Force
Start-Service "ARUS-Marine-Management"
```

### Server (PostgreSQL)

**Backup:**

```powershell
# Set PostgreSQL bin in PATH
$env:Path += ";C:\Program Files\PostgreSQL\16\bin"

# Backup to file
$date = Get-Date -Format "yyyyMMdd_HHmmss"
pg_dump -U arus_user -d arus_db -F c -f "C:\Backups\ARUS\arus_db-$date.backup"

# Or SQL format
pg_dump -U arus_user -d arus_db -f "C:\Backups\ARUS\arus_db-$date.sql"
```

**Restore:**

```powershell
# From custom format
pg_restore -U arus_user -d arus_db -c "C:\Backups\ARUS\arus_db-20241029.backup"

# From SQL format
psql -U arus_user -d arus_db -f "C:\Backups\ARUS\arus_db-20241029.sql"
```

---

## 🗑️ Uninstallation

### Standalone Installation

**Automated:**

```powershell
# Run uninstaller
C:\ProgramData\ARUS\Uninstall.exe
```

**Manual:**

```powershell
# Stop and remove service
Stop-Service "ARUS-Marine-Management"
sc.exe delete "ARUS-Marine-Management"

# Remove application files
Remove-Item -Path "C:\ProgramData\ARUS" -Recurse -Force

# Remove shortcuts
Remove-Item -Path "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\ARUS.lnk" -Force
Remove-Item -Path "$env:PUBLIC\Desktop\ARUS.lnk" -Force
```

### Server Deployment

```powershell
# Stop PM2
pm2 stop arus
pm2 delete arus
pm2 save

# Remove IIS site
Remove-Website -Name "ARUS"
Remove-WebAppPool -Name "ARUS_AppPool"

# Remove application files
Remove-Item -Path "C:\inetpub\arus" -Recurse -Force

# Drop PostgreSQL database (optional)
psql -U postgres -c "DROP DATABASE arus_db;"
psql -U postgres -c "DROP USER arus_user;"
```

---

## 📊 Installation Comparison

| Feature               | PWA       | Standalone | Server     |
| --------------------- | --------- | ---------- | ---------- |
| **Installation Time** | 30 sec    | 10 min     | 45 min     |
| **Complexity**        | Very Easy | Easy       | Advanced   |
| **Offline Support**   | ✅ Yes    | ✅ Yes     | ❌ No      |
| **Multi-User**        | ❌ No     | ❌ No      | ✅ Yes     |
| **Database**          | Cache API | SQLite     | PostgreSQL |
| **Auto-Update**       | ✅ Yes    | ❌ Manual  | ⚙️ CI/CD   |
| **Performance**       | Good      | Excellent  | Excellent  |
| **Best For**          | End users | Single PC  | Enterprise |

---

## 🎯 Recommendations

### For Individual Users

**→ Install as PWA**

- Easiest installation
- Works on any Windows PC
- Auto-updates

### For Offline Vessels

**→ Standalone Installation**

- Complete offline operation
- Local database
- No cloud dependencies

### For Organizations

**→ Server Deployment**

- Multi-user access
- Centralized management
- Scalable architecture

---

## 📞 Support

**Documentation:**

- General: `INSTALLATION-GUIDE.md`
- macOS: `README-MACOS-INSTALLATION.md`
- Deployment: `DEPLOYMENT.md`

**Logs:**

- Standalone: `C:\ProgramData\ARUS\logs\`
- Server: `C:\Users\[User]\.pm2\logs\`

**Common Issues:**

- Port conflicts: Change PORT in .env
- Service errors: Check Windows Event Viewer
- Database issues: Verify connection string

---

## ✅ Quick Reference

### Essential Commands

**PowerShell (Run as Administrator):**

```powershell
# Check service status
Get-Service "ARUS-Marine-Management"

# View logs
Get-Content C:\ProgramData\ARUS\logs\app.log -Tail 50 -Wait

# Restart service
Restart-Service "ARUS-Marine-Management"

# Check port usage
netstat -ano | findstr :31888

# Backup database
Copy-Item C:\ProgramData\ARUS\data\vessel-local.db C:\Backups\vessel-backup.db
```

**URLs:**

- Standalone: http://localhost:31888
- Server: http://your-server-ip or https://your-domain.com

---

**Installation complete! Access ARUS and start managing your marine fleet!** ⚓🚢
