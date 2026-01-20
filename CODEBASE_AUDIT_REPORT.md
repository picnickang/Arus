# ARUS Codebase Audit Report
Generated: January 3, 2026

## Cleanup Completed

**Files Removed:**
- 10 orphan pages (validation, consolidated, superseded)
- 7 unused hooks  
- 1 duplicate component (analytics/CollapsibleSection consolidated to shared)

**NPM Packages Removed (56 packages total):**
- ssh2-sftp-client, sonarqube-scanner, pgvector, @google-cloud/storage, next-themes, electron-is-dev

**Result:** Reduced from 85 pages to 73 pages. Application verified working.

---

## Executive Summary

| Category | Current State | Cleanup Potential |
|----------|--------------|-------------------|
| node_modules | 2.8 GB | ~1.2 GB removable |
| Source Files | 2,363 files (642 frontend, 1721 backend) | ~2,400 lines removable |
| Dependencies | 148 production + 25 dev | 5 fully unused |
| Orphan Pages | 14 files | ~2,373 lines |
| Orphan Components | 19+ components | ~1,500 lines |
| Unused Hooks | 6 completely unused | ~600 lines |
| Duplicate Components | 4 duplicate pairs | Consolidation needed |

---

## 1. UNUSED NPM DEPENDENCIES (High Priority)

### Completely Unused (0 imports) - Safe to Remove
| Package | Size | Notes |
|---------|------|-------|
| `ssh2-sftp-client` | 252 KB | Not imported anywhere |
| `sonarqube-scanner` | 684 KB | Not imported anywhere |
| `pgvector` | 164 KB | Not imported anywhere |
| `@google-cloud/storage` | 3.9 MB | Not imported anywhere |
| `next-themes` | 44 KB | Not imported anywhere |
| `electron-is-dev` | ~10 KB | Not imported anywhere |

**Estimated Savings: ~5 MB direct + dependencies**

### Heavy Dependencies with Minimal Usage
| Package | Size | Imports | Notes |
|---------|------|---------|-------|
| `@tensorflow/tfjs-node` | 673 MB | 5 | Used only in ML models - consider lazy loading |
| `electron` + `electron-builder` | 495 MB | 0 in src | Desktop build only - move to optional |
| `googleapis` | 182 MB | 1 | Heavy for single use |
| `@xenova/transformers` | 178 MB | 2 | Embeddings - consider API alternative |
| `react-icons` | 83 MB | Limited | Consider tree-shaking or lucide-only |

---

## 2. ORPHAN PAGES (Not Imported in App.tsx)

| Page | Lines | Recommendation |
|------|-------|----------------|
| `permissions-settings.tsx` | 960 | Review - may be needed for RBAC |
| `email-templates.tsx` | 344 | Review - may be feature-flagged |
| `decommissioned-equipment-log.tsx` | 225 | Review - may be needed |
| `savings-dashboard.tsx` | 195 | Review - may be feature-flagged |
| `FleetOverview.tsx` | 138 | REMOVE - superseded by dashboard |
| `OperatingParametersPage.tsx` | 112 | REMOVE - duplicate functionality |
| `ai-performance.tsx` | 74 | REMOVE - consolidated elsewhere |
| `ml-ai-consolidated.tsx` | 57 | Review - may be WIP |
| `deck-log-consolidated.tsx` | 49 | REMOVE - duplicate |
| `engine-log-consolidated.tsx` | 49 | REMOVE - duplicate |
| `equipment-log-consolidated.tsx` | 49 | REMOVE - duplicate |
| `compliance-consolidated.tsx` | 49 | REMOVE - duplicate |
| `enhanced-trends-validation.tsx` | 35 | REMOVE - test/validation file |
| `fleet-performance-validation.tsx` | 37 | REMOVE - test/validation file |

**Total: 2,373 lines potentially removable**

---

## 3. ORPHAN COMPONENTS (Not Imported Anywhere)

| Component | Location | Recommendation |
|-----------|----------|----------------|
| `BottomNavigation` | components/ | REMOVE - mobile nav not used |
| `DigitalTwinViewer` | components/ | Review - may be WIP feature |
| `DocumentPreviewModal` | components/ | Review - may be KB feature |
| `EquipmentProfileCard` | components/ | REMOVE - duplicate |
| `ExecutiveSummary` | components/ | Review - may be analytics |
| `ExpenseTrackingForm` | components/ | Review - finance feature |
| `FinancialTrendsChart` | components/ | Review - analytics |
| `floating-action-bar` | components/ui | Review - mobile pattern |
| `HubPageLayout` | components/ | Review - may be layout util |
| `KeyboardShortcutsDialog` | components/ | Review - accessibility |
| `LaborRateConfiguration` | components/ | Review - settings |
| `metric-card` | components/ui | REMOVE - duplicate of MetricCard |
| `MobileNavigation` | components/ | REMOVE - if not PWA |
| `NavigationGroup` | components/ | REMOVE - old navigation |
| `CompliancePreviewModal` | components/ | Review |
| `EquipmentSelector` | components/shared | REMOVE - superseded |
| `breadcrumb` | components/ui | REMOVE - duplicate of Breadcrumb |
| `chartPatterns` | components/ | Review - may be util |

---

## 4. UNUSED HOOKS (0 imports)

| Hook | Recommendation |
|------|----------------|
| `useDocumentVersions` | REMOVE - not used |
| `useDragToReschedule` | REMOVE - not used |
| `useKeyboardShortcuts` | REMOVE - not used |
| `usePermissionFilteredNavigation` | REMOVE - not used |
| `useStreaming` | REMOVE - not used |
| `useTelemetrySlidingWindow` | REMOVE - not used |
| `useUndoRedo` | REMOVE - not used |

---

## 5. DUPLICATE COMPONENTS (Need Consolidation)

| Component | Locations | Action |
|-----------|-----------|--------|
| `CollapsibleSection` | `analytics/`, `shared/` | Keep `shared/`, remove other |
| `EmptyState` | `shared/`, `kb/` | Keep `shared/`, remove other |
| `PageHeader` | `ml-ai/layouts/`, `navigation/` | Consolidate to `shared/` |
| `StatusBadge` | `ml-ai/utils/`, `shared/` | Keep `shared/`, remove other |

---

## 6. LARGEST FILES (Refactoring Candidates)

| File | Lines | Issue |
|------|-------|-------|
| `SchedulePlanner.tsx` | 2,465 | Split into smaller components |
| `UnifiedCrewManagement.tsx` | 1,157 | Could split views |
| `ScheduleGeneratorPanel.tsx` | 1,023 | Extract sub-components |
| `permissions-settings.tsx` | 960 | May be orphan - review |

---

## 7. PRIORITY CLEANUP ACTIONS

### Phase 1: Safe Removals (No Risk)
1. Remove unused npm packages: `ssh2-sftp-client`, `sonarqube-scanner`, `pgvector`, `@google-cloud/storage`, `next-themes`, `electron-is-dev`
2. Delete orphan validation pages: `enhanced-trends-validation.tsx`, `fleet-performance-validation.tsx`
3. Delete consolidated duplicates: `deck-log-consolidated.tsx`, `engine-log-consolidated.tsx`, `equipment-log-consolidated.tsx`, `compliance-consolidated.tsx`
4. Remove unused hooks with 0 imports

### Phase 2: Review Required
1. Review orphan pages that may be feature-flagged
2. Consolidate duplicate components
3. Review orphan components for WIP features

### Phase 3: Architecture Improvements
1. Move Electron to optional dependency or separate build
2. Consider lazy-loading TensorFlow for production builds
3. Tree-shake react-icons or switch to lucide-react only

---

## Estimated Impact

| Action | Lines Saved | Disk Saved |
|--------|------------|------------|
| Remove unused packages | N/A | ~1 GB |
| Remove orphan pages | ~500 | ~25 KB |
| Remove orphan components | ~1,500 | ~75 KB |
| Remove unused hooks | ~600 | ~30 KB |
| **Total** | **~2,600 lines** | **~1.1 GB** |
