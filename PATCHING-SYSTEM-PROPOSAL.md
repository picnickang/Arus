# ARUS Patching System Proposal

**Marine Vessel Auto-Update & Configuration Management**

---

## 🎯 Executive Summary

**Problem:** Currently, updating ARUS on vessels requires:

- Full reinstall (downloading entire .dmg)
- Manual file editing for config changes
- No way to push critical security patches quickly

**Solution:** Multi-tier patching system with:

- ✅ **Tier 1**: Hot config reload (zero downtime)
- ✅ **Tier 2**: Incremental code patches (small updates)
- ✅ **Tier 3**: Full auto-updates (major versions)

**Key Benefit for Marine Operations:**

- 📡 Works with intermittent connectivity
- 🔒 Cryptographically signed patches
- 📦 Bandwidth-efficient (patches vs full downloads)
- ⚓ Zero-downtime for config changes
- 🚨 Emergency patch capability

---

## 🏗️ Proposed Architecture

### Tier 1: Hot Configuration Reload (Immediate - Phase 1)

**No restart required. Config changes apply within seconds.**

#### Features:

1. **Runtime Config API**
   - REST endpoint: `POST /api/admin/config/reload`
   - Reloads environment variables from `.env`
   - Updates system settings without restart
   - WebSocket broadcasts config changes to all clients

2. **Admin Panel Integration**
   - New "System Configuration" tab in System Administration
   - Live edit environment variables
   - Apply changes with one click
   - Preview changes before applying

3. **File Watcher** (optional)
   - Automatically detect `.env` file changes
   - Hot-reload without manual trigger
   - Audit log all config changes

#### Example Use Cases:

- ✅ Change admin tokens
- ✅ Update API keys (OpenAI, etc.)
- ✅ Adjust rate limits
- ✅ Enable/disable features
- ✅ Update database connection strings

#### Implementation Complexity: **Low** (1-2 days)

---

### Tier 2: Incremental Patch System (Week 1 - Phase 2)

**Download only changed files. Apply without full reinstall.**

#### Architecture:

```
Cloud Patch Server (Render)
    ↓ HTTPS
    ↓ Checks for updates every 6 hours
    ↓
Vessel ARUS Installation
    ↓ Downloads patch manifest (JSON)
    ↓ Verifies signatures
    ↓ Downloads changed files only
    ↓ Applies patch atomically
    ↓ Restarts if needed
```

#### Components:

**1. Patch Manifest Format:**

```json
{
  "version": "1.0.1",
  "released": "2025-10-23T10:00:00Z",
  "fromVersion": "1.0.0",
  "severity": "medium",
  "requiresRestart": false,
  "signature": "SHA256:abc123...",
  "changes": [
    {
      "path": "server/security.ts",
      "action": "update",
      "url": "https://cdn.arus.io/patches/1.0.1/security.ts",
      "hash": "sha256:def456..."
    },
    {
      "path": ".env.template",
      "action": "merge",
      "url": "https://cdn.arus.io/patches/1.0.1/env.patch",
      "hash": "sha256:ghi789..."
    }
  ],
  "migrations": [
    {
      "type": "sql",
      "file": "migrations/001-add-admin-token.sql"
    }
  ]
}
```

**2. Update Checker Service:**

```typescript
// server/services/update-checker.ts
class UpdateChecker {
  async checkForUpdates(): Promise<PatchManifest | null>;
  async downloadPatch(manifest: PatchManifest): Promise<void>;
  async verifyPatch(patch: Patch): Promise<boolean>;
  async applyPatch(patch: Patch): Promise<void>;
  async rollbackPatch(patch: Patch): Promise<void>;
}
```

**3. Patch Application Strategy:**

- Download to staging directory
- Verify cryptographic signatures
- Create backup of files being changed
- Apply atomically (all-or-nothing)
- Run database migrations if needed
- Restart service if required
- Rollback on failure

**4. Admin UI:**

- "Software Updates" page
- Shows available updates
- One-click install
- Changelog display
- Update history
- Rollback capability

#### Security:

- ✅ HTTPS-only downloads
- ✅ Ed25519 signature verification
- ✅ Hash verification per file
- ✅ Atomic apply (no partial states)
- ✅ Automatic rollback on error

#### Bandwidth Optimization:

```
Full reinstall:    ~150 MB .dmg
Incremental patch: ~1-5 MB (typical)
Config patch:      ~10 KB
```

#### Implementation Complexity: **Medium** (5-7 days)

---

### Tier 3: Full Auto-Update System (Week 2 - Phase 3)

**Major version upgrades. Download full package.**

#### Features:

1. **Scheduled Update Window**
   - Configurable maintenance windows
   - "Update during port call" mode
   - Defer updates for critical operations

2. **Background Download**
   - Downloads during low-bandwidth periods
   - Pauses if connectivity is poor
   - Resumes interrupted downloads

3. **Pre-flight Checks**
   - Verify sufficient disk space
   - Check database compatibility
   - Validate system requirements
   - Test connectivity to cloud services

4. **Staged Rollout**
   - Beta channel for test vessels
   - Stable channel for production vessels
   - Manual approval for critical vessels

#### Implementation Complexity: **High** (10-14 days)

---

## 📋 Recommended Implementation Plan

### Phase 1: Hot Config Reload (Week 1)

**Priority: HIGH - Solves immediate .env patching problem**

**Tasks:**

1. Create config reload API endpoint
2. Add file watcher for `.env` changes
3. Build admin UI for config management
4. Add WebSocket broadcasting
5. Write audit logging
6. Create documentation

**Deliverables:**

- ✅ `/api/admin/config/reload` endpoint
- ✅ System Configuration admin page
- ✅ Live config editing UI
- ✅ Automatic reload on `.env` change
- ✅ Audit trail of all changes

**Testing:**

- Change admin token without restart
- Update OpenAI API key live
- Verify WebSocket pushes to clients
- Test rollback on invalid config

---

### Phase 2: Incremental Patches (Week 2-3)

**Priority: MEDIUM - Enables fast bug fixes and security patches**

**Tasks:**

1. Design patch manifest schema
2. Build update checker service
3. Implement signature verification
4. Create patch download/apply logic
5. Build admin UI (Software Updates page)
6. Set up patch CDN endpoint
7. Create patch builder tool
8. Add rollback capability

**Deliverables:**

- ✅ Automated update checking (every 6 hours)
- ✅ One-click patch installation
- ✅ Software Updates admin page
- ✅ Patch history and rollback
- ✅ Bandwidth-optimized downloads

**Testing:**

- Apply patch with 1 file change
- Apply patch with DB migration
- Test rollback on patch failure
- Verify signature validation blocks tampered patches
- Test offline mode (deferred updates)

---

### Phase 3: Full Auto-Updates (Week 4-5)

**Priority: LOW - Nice to have for major versions**

**Tasks:**

1. Build background download manager
2. Implement update scheduling
3. Add pre-flight validation
4. Create staged rollout system
5. Build update channels (beta/stable)
6. Add user notification system

**Deliverables:**

- ✅ Automatic major version updates
- ✅ Configurable update windows
- ✅ Beta testing channel
- ✅ User notifications for updates

---

## 🔧 Technical Implementation Details

### 1. Hot Config Reload API

**Endpoint:**

```typescript
// POST /api/admin/config/reload
router.post("/api/admin/config/reload", requireAdminAuth, async (req, res) => {
  const result = await configManager.reloadConfig();

  // Broadcast to all connected clients
  wsServer.broadcast({
    type: "config_updated",
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    reloaded: result.changed,
    requiresRestart: result.criticalChanges,
  });
});
```

**Config Manager Service:**

```typescript
class ConfigManager {
  private config: Map<string, string>;
  private watchers: FileWatcher[];

  async reloadConfig(): Promise<ReloadResult> {
    const newConfig = this.loadEnvFile();
    const changed = this.detectChanges(this.config, newConfig);

    // Apply non-critical changes immediately
    for (const [key, value] of changed.safe) {
      process.env[key] = value;
      this.config.set(key, value);
    }

    // Critical changes require restart
    return {
      changed: changed.safe.size + changed.critical.size,
      criticalChanges: changed.critical.size > 0,
      requiresRestart: changed.critical.size > 0,
    };
  }

  watchForChanges(): void {
    this.watchers.push(
      fs.watch(".env", (event) => {
        if (event === "change") {
          this.reloadConfig();
        }
      })
    );
  }
}
```

### 2. Patch System Database Schema

```typescript
// shared/schema.ts additions

export const softwarePatches = pgTable("software_patches", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  version: varchar("version").notNull(),
  fromVersion: varchar("from_version").notNull(),
  severity: varchar("severity").notNull(), // 'critical', 'high', 'medium', 'low'
  manifest: jsonb("manifest").notNull(),
  signature: varchar("signature").notNull(),
  appliedAt: timestamp("applied_at"),
  status: varchar("status").notNull(), // 'pending', 'applied', 'failed', 'rolled_back'
  errorLog: text("error_log"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const configAuditLog = pgTable("config_audit_log", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  key: varchar("key").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedBy: varchar("changed_by").notNull(),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
});
```

### 3. Update Checker Cron Job

```typescript
// server/schedulers/update-checker.ts
import cron from "node-cron";

// Check for updates every 6 hours
cron.schedule("0 */6 * * *", async () => {
  if (process.env.AUTO_UPDATE_ENABLED !== "true") return;

  const updateChecker = new UpdateChecker();
  const patch = await updateChecker.checkForUpdates();

  if (patch) {
    console.log(`Update available: ${patch.version}`);

    // Auto-apply if severity is critical
    if (patch.severity === "critical") {
      console.log("Critical patch detected. Auto-applying...");
      await updateChecker.downloadAndApply(patch);
    } else {
      // Notify admin
      await notifyAdmin({
        title: "Software Update Available",
        message: `Version ${patch.version} is available`,
        severity: patch.severity,
      });
    }
  }
});
```

### 4. Patch Builder CLI Tool

```bash
# scripts/build-patch.sh
#!/bin/bash
# Creates incremental patch from git diff

FROM_VERSION=$1
TO_VERSION=$2

# Get changed files between versions
git diff --name-only v${FROM_VERSION}..v${TO_VERSION} > changed-files.txt

# Build patch manifest
node scripts/create-patch-manifest.js \
  --from=$FROM_VERSION \
  --to=$TO_VERSION \
  --files=changed-files.txt \
  --output=patches/${TO_VERSION}/manifest.json

# Sign the patch
node scripts/sign-patch.js patches/${TO_VERSION}/manifest.json

# Upload to CDN
aws s3 sync patches/${TO_VERSION}/ s3://arus-patches/${TO_VERSION}/
```

---

## 🔒 Security Considerations

### 1. Patch Signature Verification

```typescript
import { verifySignature } from "tweetnacl";

async function verifyPatchSignature(
  manifest: PatchManifest,
  publicKey: Uint8Array
): Promise<boolean> {
  const message = JSON.stringify({
    version: manifest.version,
    changes: manifest.changes,
    migrations: manifest.migrations,
  });

  const signature = Buffer.from(manifest.signature, "base64");

  return verifySignature(Buffer.from(message), signature, publicKey);
}
```

### 2. Rollback Safety

```typescript
class PatchApplier {
  async applyPatch(patch: Patch): Promise<void> {
    const backupId = await this.createBackup();

    try {
      await this.applyChanges(patch);
      await this.runMigrations(patch);
      await this.verifyIntegrity();

      // Success!
      await this.commitPatch(patch);
    } catch (error) {
      // Automatic rollback on any error
      console.error("Patch failed, rolling back...", error);
      await this.rollback(backupId);
      throw error;
    }
  }
}
```

### 3. Access Control

- ✅ Only admins can trigger updates
- ✅ Audit log every patch application
- ✅ Require confirmation for major versions
- ✅ Rate limit update endpoints
- ✅ IP whitelist for patch server (optional)

---

## 📊 Benefits Analysis

### Current State (No Patching System)

| Scenario            | Time                  | Bandwidth | Downtime |
| ------------------- | --------------------- | --------- | -------- |
| Fix admin token bug | Manual edit           | 0 MB      | 0 min    |
| Security patch      | Full reinstall        | 150 MB    | 30 min   |
| Feature update      | Full reinstall        | 150 MB    | 30 min   |
| Config change       | Manual edit + restart | 0 MB      | 5 min    |

### With Patching System

| Scenario            | Time          | Bandwidth | Downtime |
| ------------------- | ------------- | --------- | -------- |
| Fix admin token bug | 1-click patch | 10 KB     | 0 min\*  |
| Security patch      | 1-click patch | 2 MB      | 30 sec\* |
| Feature update      | 1-click patch | 15 MB     | 2 min\*  |
| Config change       | Hot reload    | 0 MB      | 0 min    |

**Improvements:**

- ⚡ **98% less bandwidth** (typical patches)
- ⏱️ **95% less downtime** (hot config reload)
- 🎯 **100% automation** (no manual file editing)
- 🔒 **Better security** (signed patches, audit logs)

---

## 🌊 Marine-Specific Considerations

### 1. Intermittent Connectivity

**Problem:** Vessels may lose connection mid-download

**Solution:**

- Resume interrupted downloads
- Queue patches for next connectivity window
- Offline mode: defer non-critical updates
- Bandwidth throttling (don't saturate satellite link)

### 2. Critical Operations

**Problem:** Can't restart during cargo operations

**Solution:**

- Configurable maintenance windows
- "Defer update" button
- Priority levels (critical = auto-apply, normal = schedule)
- "Update during port call" mode

### 3. Multiple Vessel Fleet

**Problem:** Need to update 20+ vessels

**Solution:**

- Centralized patch management dashboard
- Fleet-wide rollout scheduling
- Staged deployment (test on 1 vessel first)
- Rollback entire fleet if patch fails

### 4. Regulatory Compliance

**Problem:** Maritime regulations require audit trails

**Solution:**

- Complete audit log of all patches
- Version history tracking
- Rollback capability (prove you can undo changes)
- Signed patches (prove authenticity)

---

## 💰 Cost Analysis

### Development Costs

| Phase                            | Effort | Developer Days | Cost @ $100/hr |
| -------------------------------- | ------ | -------------- | -------------- |
| **Phase 1: Hot Config**          | Low    | 2 days         | $1,600         |
| **Phase 2: Incremental Patches** | Medium | 7 days         | $5,600         |
| **Phase 3: Full Auto-Update**    | High   | 14 days        | $11,200        |
| **Testing & Documentation**      | -      | 3 days         | $2,400         |
| **TOTAL**                        | -      | **26 days**    | **$20,800**    |

### Operational Savings (Per Year)

**Assumptions:**

- 20 vessels in fleet
- 12 updates/patches per year
- Current: 30 min downtime per update
- New: 2 min average downtime per patch

**Downtime Savings:**

- Current: 20 vessels × 12 updates × 30 min = **120 hours/year**
- New: 20 vessels × 12 patches × 2 min = **8 hours/year**
- **Savings: 112 hours/year of vessel downtime**

**Value @ $5,000/hour vessel operation:**

- **$560,000/year** in prevented downtime

**Bandwidth Savings:**

- Current: 20 vessels × 12 updates × 150 MB = **36 GB/year**
- New: 20 vessels × 12 patches × 5 MB = **1.2 GB/year**
- **Savings: 34.8 GB/year** (~$3,480 @ $0.10/MB satellite)

**Total Annual Savings: ~$563,000**

**ROI: 2,700%** (pays for itself in 2 weeks!)

---

## 🚦 Recommendation

### Immediate Action: **Implement Phase 1 (Hot Config Reload)**

**Why:**

- ✅ Solves your current problem (admin token patching)
- ✅ Low complexity (2 days)
- ✅ Zero downtime
- ✅ Immediate value

**Timeline:**

- Week 1: Implement hot config reload
- Week 2: Add admin UI
- Week 3: Test on development server
- Week 4: Deploy to production

### Future Consideration: **Phases 2 & 3**

**Evaluate after Phase 1:**

- How often do you need to push code updates?
- How critical is bandwidth optimization?
- How large is your vessel fleet?

**If yes to above: Implement Phase 2 (Incremental Patches)**

---

## 📝 Success Metrics

### Phase 1 Success Criteria:

- ✅ Config changes apply within 5 seconds
- ✅ Zero downtime for config updates
- ✅ 100% audit trail coverage
- ✅ Admin UI tested and approved

### Phase 2 Success Criteria:

- ✅ Patches download and apply in < 5 minutes
- ✅ 95% bandwidth reduction vs full reinstall
- ✅ Zero failed rollbacks
- ✅ 100% signature verification pass rate

### Phase 3 Success Criteria:

- ✅ Major updates complete in < 15 minutes
- ✅ 99% success rate on auto-updates
- ✅ Zero unscheduled downtime
- ✅ Fleet-wide updates complete in < 1 day

---

## ❓ Questions for Stakeholders

Before proceeding, please confirm:

1. **Scope:** Start with Phase 1 only, or all 3 phases?
2. **Timeline:** Is 2-4 weeks acceptable for Phase 1?
3. **Hosting:** Can we host patches on Render/CDN, or need on-premise?
4. **Security:** Do we need military-grade signing, or standard crypto?
5. **Fleet Size:** How many vessels will use this system?
6. **Connectivity:** Typical bandwidth available at sea?
7. **Maintenance Windows:** Preferred update times (port calls only?)
8. **Testing:** Beta test on how many vessels first?

---

## 🎯 Next Steps

**If approved:**

1. **Week 1:** I'll implement Phase 1 (Hot Config Reload)
   - Config reload API
   - Admin UI
   - File watcher
   - Documentation

2. **Week 2:** Testing and refinement
   - Test on development server
   - User acceptance testing
   - Documentation and training

3. **Week 3+:** Evaluate Phases 2 & 3 based on results

**Want me to start immediately?** I can have Phase 1 working by end of week.

---

## 📚 Appendix: Alternative Solutions Considered

### Alternative 1: Git-Based Patching

**Rejected:** Too complex for non-technical users, requires git knowledge

### Alternative 2: Docker Container Updates

**Rejected:** Already deprecated Electron/Docker for PWA approach

### Alternative 3: Manual File Upload

**Rejected:** No verification, audit trail, or rollback capability

### Alternative 4: Full Reinstall Only

**Current State:** Works but wastes bandwidth and causes downtime

**Selected Approach:** Multi-tier patching balances ease-of-use, security, and efficiency.
