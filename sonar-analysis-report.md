# SonarCloud Issue Analysis Report
Generated: 2025-12-14T16:40:26.204Z
Project: picnickang_ARUSAPP

## Summary
- **Total Issues**: 6169
- **Blockers**: 0
- **Critical**: 249
- **Major**: 2660
- **Minor**: 3257
- **Info**: 3

## By Type
- **Bugs**: 5
- **Vulnerabilities**: 0
- **Code Smells**: 6164

## Top 30 Rules (Most Issues)
| Rule | Count | Severity | Sample Message |
|------|-------|----------|----------------|
| typescript:S2681 | 1044 | MAJOR | This statement will not be executed conditionally; only the ... |
| typescript:S7773 | 512 | MINOR | Prefer `Number.isNaN` over `isNaN`.... |
| typescript:S7748 | 450 | MINOR | Don't use a zero fraction in the number.... |
| typescript:S3358 | 374 | MAJOR | Extract this nested ternary operation into an independent st... |
| typescript:S2933 | 338 | MAJOR | Member 'config' is never reassigned; mark it as `readonly`.... |
| typescript:S6759 | 246 | MINOR | Mark the props of the component as read-only.... |
| typescript:S7772 | 244 | MINOR | Prefer `node:child_process` over `child_process`.... |
| typescript:S7763 | 235 | MINOR | Use `export…from` to re-export `WorkOrderFilters`.... |
| typescript:S4325 | 222 | MINOR | This assertion is unnecessary since it does not change the t... |
| javascript:S7763 | 213 | MINOR | Use `export…from` to re-export `adminPasswordChangeSchema`.... |
| typescript:S2486 | 190 | MINOR | Handle this exception or don't catch it at all.... |
| typescript:S3776 | 155 | CRITICAL | Refactor this function to reduce its Cognitive Complexity fr... |
| typescript:S7778 | 146 | MINOR | Do not call `Array#push()` multiple times.... |
| typescript:S6582 | 143 | MAJOR | Prefer using an optional chain expression instead, as it's m... |
| typescript:S6479 | 135 | MAJOR | Do not use Array index in keys... |
| typescript:S7735 | 129 | MINOR | Unexpected negated condition.... |
| typescript:S7781 | 122 | MINOR | Prefer `String#replaceAll()` over `String#replace()`.... |
| typescript:S7764 | 114 | MINOR | Prefer `globalThis.window` over `window`.... |
| typescript:S1854 | 113 | MAJOR | Remove this useless assignment to variable "status".... |
| shelldre:S7688 | 103 | MAJOR | Use '[[' instead of '[' for conditional tests. The '[[' cons... |
| typescript:S4624 | 66 | MAJOR | Refactor this code to not use nested template literals.... |
| typescript:S2004 | 57 | CRITICAL | Refactor this code to not nest functions more than 4 levels ... |
| typescript:S7785 | 51 | MAJOR | Prefer top-level await over an async function `getUpdateChec... |
| typescript:S7755 | 42 | MINOR | Prefer `.at(…)` over `[….length - index]`.... |
| typescript:S6478 | 42 | MAJOR | Move this component definition out of the parent component a... |
| typescript:S7723 | 36 | MINOR | Use `new Array()` instead of `Array()`.... |
| javascript:S7772 | 36 | MINOR | Prefer `node:child_process` over `child_process`.... |
| typescript:S3863 | 36 | MINOR | '@/components/fleet' imported multiple times.... |
| typescript:S6853 | 33 | MAJOR | A form label must be associated with a control.... |
| shelldre:S7677 | 29 | MAJOR | Redirect this error message to stderr (>&2).... |

## Top 30 Hot Files (Most Issues)
| File | Issues | Top Rules |
|------|--------|-----------|
| shared/schema-runtime.js | 213 | javascript:S7763 |
| server/storage/mem-storage.ts | 205 | typescript:S7776, typescript:S2681, typescript:S7772 |
| tests/mlops-readiness-test.ts | 62 | typescript:S7772, typescript:S7784, typescript:S3358 |
| server/tests/money-utils.test.ts | 54 | typescript:S7748, typescript:S7773 |
| server/db/analytics/db-analytics.ts | 50 | typescript:S2681, typescript:S6606, typescript:S7735 |
| shared/schema.ts | 50 | typescript:S125, typescript:S7748, typescript:S7773 |
| server/sqlite/index.ts | 36 | typescript:S7763 |
| tests/mlops-readiness-test.py | 35 | python:S6711, python:S3358, python:S1192 |
| server/db/checklists/db-checklists.ts | 34 | typescript:S2681, typescript:S107, typescript:S3776 |
| server/db/ml-analytics/db-ml-analytics.ts | 34 | typescript:S7772, typescript:S2681 |
| server/db/ml-analytics/mem-ml-analytics.ts | 30 | typescript:S6582, typescript:S2681, typescript:S7744 |
| shared/schema.js | 29 | javascript:S7773, javascript:S3358, javascript:S125 |
| server/db/analytics/mem-analytics.ts | 28 | typescript:S7772, typescript:S2933, typescript:S2681 |
| server/diagnostics-smoke-tests.ts | 28 | typescript:S7778 |
| server/db/operating-conditions/db-operating-conditions.ts | 26 | typescript:S3776, typescript:S2681, typescript:S2486 |
| server/db/maintenance-templates/db-maintenance-templates.ts | 26 | typescript:S2681, typescript:S6582 |
| server/db/system-admin/db-settings.ts | 26 | typescript:S2681 |
| server/db/condition-monitoring/db-condition-monitoring.ts | 25 | typescript:S2681, typescript:S4325 |
| server/db/settings.repo.ts | 24 | typescript:S2681, typescript:S2933 |
| server/db/maintenance-templates/mem-maintenance-templates.ts | 24 | typescript:S7772, typescript:S2933, typescript:S2681 |
| server/domains/health-monitoring/routes.ts | 24 | typescript:S2486, typescript:S7773, typescript:S1854 |
| server/db/hub-sync/db-hub-sync.ts | 23 | typescript:S4325, typescript:S2681 |
| server/db/hub-sync/mem-hub-sync.ts | 22 | typescript:S2681, typescript:S4043, typescript:S7772 |
| client/src/components/equipment/EquipmentViewDialog.tsx | 22 | typescript:S6759, typescript:S6853, typescript:S7773 |
| server/db/logbooks/db-logbooks.ts | 22 | typescript:S2681 |
| server/db/logbooks/mem-logbooks.ts | 22 | typescript:S7772, typescript:S2933, typescript:S2681 |
| server/db/system-admin/mem-settings.ts | 22 | typescript:S7772, typescript:S2681, typescript:S4325 |
| server/domains/sensor-management/routes/sensor-optimization-routes.ts | 22 | typescript:S4325, typescript:S2486, typescript:S7773 |
| server/domains/storage-backup/routes.ts | 22 | typescript:S1854, typescript:S2486 |
| server/domains/sensor-management/routes/sensor-config-routes.ts | 21 | typescript:S2486, typescript:S4325, typescript:S2681 |

## Prioritized Fix Plan

### Priority 1: Security & Bugs (Fix Immediately)
- [ ] **typescript:S1082** (4 issues) - Visible, non-interactive elements with click handlers must have at least one key
- [ ] **typescript:S5256** (1 issues) - Add a valid header row or column to this "<table>".

### Priority 2: High-Impact Code Smells
- [ ] **typescript:S2681** (1044 issues, MAJOR) - This statement will not be executed conditionally; only the first statement will
- [ ] **typescript:S3358** (374 issues, MAJOR) - Extract this nested ternary operation into an independent statement.
- [ ] **typescript:S2933** (338 issues, MAJOR) - Member 'config' is never reassigned; mark it as `readonly`.
- [ ] **typescript:S3776** (155 issues, CRITICAL) - Refactor this function to reduce its Cognitive Complexity from 23 to the 15 allo
- [ ] **typescript:S6582** (143 issues, MAJOR) - Prefer using an optional chain expression instead, as it's more concise and easi
- [ ] **typescript:S6479** (135 issues, MAJOR) - Do not use Array index in keys
- [ ] **typescript:S1854** (113 issues, MAJOR) - Remove this useless assignment to variable "status".
- [ ] **shelldre:S7688** (103 issues, MAJOR) - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and m
- [ ] **typescript:S4624** (66 issues, MAJOR) - Refactor this code to not use nested template literals.
- [ ] **typescript:S2004** (57 issues, CRITICAL) - Refactor this code to not nest functions more than 4 levels deep.
- [ ] **typescript:S7785** (51 issues, MAJOR) - Prefer top-level await over an async function `getUpdateChecker` call.
- [ ] **typescript:S6478** (42 issues, MAJOR) - Move this component definition out of the parent component and pass data as prop
- [ ] **typescript:S6853** (33 issues, MAJOR) - A form label must be associated with a control.
- [ ] **shelldre:S7677** (29 issues, MAJOR) - Redirect this error message to stderr (>&2).
- [ ] **typescript:S6819** (21 issues, MAJOR) - Use <input type="button">, <input type="image">, <input type="reset">, <input ty

### Priority 3: Bulk-Fixable Rules
These rules can potentially be fixed with ESLint auto-fix or simple scripts:
- [ ] **typescript:S6582** (143 issues) - Auto-fixable
- [ ] **typescript:S7764** (114 issues) - Auto-fixable
- [ ] **typescript:S7735** (129 issues) - Auto-fixable
- [ ] **typescript:S6606** (19 issues) - Auto-fixable
- [ ] **typescript:S7781** (122 issues) - Auto-fixable
- [ ] **javascript:S7764** (9 issues) - Auto-fixable
- [ ] **typescript:S1854** (113 issues) - Auto-fixable
- [ ] **typescript:S7763** (235 issues) - Auto-fixable
- [ ] **javascript:S1481** (2 issues) - Auto-fixable
- [ ] **javascript:S1854** (3 issues) - Auto-fixable
- [ ] **typescript:S7778** (146 issues) - Auto-fixable
- [ ] **javascript:S7763** (213 issues) - Auto-fixable
- [ ] **typescript:S1128** (12 issues) - Auto-fixable
- [ ] **javascript:S1128** (3 issues) - Auto-fixable
- [ ] **javascript:S7735** (1 issues) - Auto-fixable
- [ ] **python:S1481** (2 issues) - Auto-fixable
- [ ] **javascript:S7778** (1 issues) - Auto-fixable
- [ ] **typescript:S3626** (1 issues) - Auto-fixable
- [ ] **typescript:S6598** (1 issues) - Auto-fixable
