# Format Burndown

Generated: 2026-06-08T08:05:30.383Z

## Policy

Formatting debt is tracked as a ratcheted release gate:

- `npm run format:check` remains the raw repository-wide Prettier check.
- `npm run check:format-ratchet` is used by `npm run check:guards-full`.
- Existing formatting debt is counted and reported.
- CI fails when the unformatted file count exceeds the committed ceiling.
- CI fails when tracked files touched by the current change are left unformatted.
- The baseline can only stay flat or decrease.
- Production code remains counted.
- Do not run a whole-repo format sweep unless the release branch explicitly accepts that churn.

## Current Count

Current unformatted file count: 1685
Committed ceiling: 1685

| Area    | Count |
| ------- | ----: |
| server  |   739 |
| client  |   308 |
| shared  |    26 |
| tests   |   152 |
| scripts |    41 |
| docs    |   224 |
| config  |    26 |
| other   |   169 |

## Top Directories

| Directory                  | Count |
| -------------------------- | ----: |
| `client/src`               |   300 |
| `server/domains`           |   268 |
| `tests/integration`        |    71 |
| `server/services`          |    68 |
| `artifacts/mockup-sandbox` |    66 |
| `server/db`                |    60 |
| `tests/unit`               |    55 |
| `server/routes`            |    35 |
| `server/lib`               |    30 |
| `docs/audit`               |    29 |
| `tests/playwright`         |    17 |
| `.agents/memory`           |    15 |
| `server/compliance`        |    13 |
| `.agents/skills`           |    10 |
| `docs/operations`          |    10 |
| `shared/schema`            |    10 |
| `docs/design`              |     8 |
| `ops/grafana`              |     8 |
| `server/purchasing`        |     8 |
| `tests/load`               |     8 |
| `docs/architecture`        |     7 |
| `server/beast`             |     7 |
| `server/job-processors`    |     7 |
| `server/middleware`        |     7 |
| `server/observability`     |     7 |
| `server/openai`            |     7 |
| `server/storage`           |     7 |
| `server/utils`             |     7 |
| `client/tests`             |     6 |
| `server/bootstrap`         |     6 |

## Touched-File Enforcement

All tracked touched files passed Prettier at report generation time.

## Recommended Burndown

1. Format files only when already changing them for functional work.
2. Prefer small module-scoped formatting PRs when a team explicitly owns the churn.
3. After debt decreases, regenerate this report and lower `scripts/format-baseline.json`.
4. Keep raw `npm run format:check` available for local inspection and eventual full cleanup.

## Sample Unformatted Files

The first 100 unformatted files are listed as a sample. Use `npm run format:check` for the full raw list.

```text
.agents/memory/MEMORY.md
.agents/memory/arus-access-architecture.md
.agents/memory/arus-migrations.md
.agents/memory/auth-role-vs-permission-gates.md
.agents/memory/crew-rank-role-matching.md
.agents/memory/crew-role-catalog-name-keyed.md
.agents/memory/cross-domain-composition-wiring.md
.agents/memory/dev-auth-bypass-priority.md
.agents/memory/integration-test-jest-esm-mocking.md
.agents/memory/multi-role-capability-scoping.md
.agents/memory/navigation-routing-traps.md
.agents/memory/permission-grants-authz.md
.agents/memory/role-template-grant-drift.md
.agents/memory/stale-sw-app-shell.md
.agents/memory/username-case-insensitivity.md
.agents/skills/brainstorming/SKILL.md
.agents/skills/brainstorming/scripts/frame-template.html
.agents/skills/brainstorming/scripts/helper.js
.agents/skills/brainstorming/scripts/server.cjs
.agents/skills/brainstorming/visual-companion.md
.agents/skills/frontend-design/SKILL.md
.agents/skills/supabase-postgres-best-practices/SKILL.md
.agents/skills/supabase-postgres-best-practices/references/_contributing.md
.agents/skills/supabase-postgres-best-practices/references/_sections.md
.agents/skills/ui-ux-pro-max/SKILL.md
.github/workflows/load-nightly.yml
.github/workflows/tauri-build.yml
.lintstagedrc.json
ARUS_FIX_SUMMARY.md
ARUS_Professional_Evaluation.md
CONTRIBUTING.md
SETUP.md
WORKFLOW_UPDATE_SUMMARY.md
apps/agent/README.md
artifacts/mockup-sandbox/index.html
artifacts/mockup-sandbox/mockupPreviewPlugin.ts
artifacts/mockup-sandbox/src/.generated/mockup-components.ts
artifacts/mockup-sandbox/src/App.tsx
artifacts/mockup-sandbox/src/components/mockups/home-layouts/CardFeed.tsx
artifacts/mockup-sandbox/src/components/mockups/home-layouts/DashboardGrid.tsx
artifacts/mockup-sandbox/src/components/mockups/home-layouts/SidebarSplit.tsx
artifacts/mockup-sandbox/src/components/ui/accordion.tsx
artifacts/mockup-sandbox/src/components/ui/alert-dialog.tsx
artifacts/mockup-sandbox/src/components/ui/alert.tsx
artifacts/mockup-sandbox/src/components/ui/aspect-ratio.tsx
artifacts/mockup-sandbox/src/components/ui/avatar.tsx
artifacts/mockup-sandbox/src/components/ui/badge.tsx
artifacts/mockup-sandbox/src/components/ui/breadcrumb.tsx
artifacts/mockup-sandbox/src/components/ui/button-group.tsx
artifacts/mockup-sandbox/src/components/ui/button.tsx
artifacts/mockup-sandbox/src/components/ui/calendar.tsx
artifacts/mockup-sandbox/src/components/ui/card.tsx
artifacts/mockup-sandbox/src/components/ui/carousel.tsx
artifacts/mockup-sandbox/src/components/ui/chart.tsx
artifacts/mockup-sandbox/src/components/ui/checkbox.tsx
artifacts/mockup-sandbox/src/components/ui/collapsible.tsx
artifacts/mockup-sandbox/src/components/ui/command.tsx
artifacts/mockup-sandbox/src/components/ui/context-menu.tsx
artifacts/mockup-sandbox/src/components/ui/dialog.tsx
artifacts/mockup-sandbox/src/components/ui/drawer.tsx
artifacts/mockup-sandbox/src/components/ui/dropdown-menu.tsx
artifacts/mockup-sandbox/src/components/ui/empty.tsx
artifacts/mockup-sandbox/src/components/ui/field.tsx
artifacts/mockup-sandbox/src/components/ui/form.tsx
artifacts/mockup-sandbox/src/components/ui/hover-card.tsx
artifacts/mockup-sandbox/src/components/ui/input-group.tsx
artifacts/mockup-sandbox/src/components/ui/input-otp.tsx
artifacts/mockup-sandbox/src/components/ui/input.tsx
artifacts/mockup-sandbox/src/components/ui/item.tsx
artifacts/mockup-sandbox/src/components/ui/kbd.tsx
artifacts/mockup-sandbox/src/components/ui/label.tsx
artifacts/mockup-sandbox/src/components/ui/menubar.tsx
artifacts/mockup-sandbox/src/components/ui/navigation-menu.tsx
artifacts/mockup-sandbox/src/components/ui/pagination.tsx
artifacts/mockup-sandbox/src/components/ui/popover.tsx
artifacts/mockup-sandbox/src/components/ui/progress.tsx
artifacts/mockup-sandbox/src/components/ui/radio-group.tsx
artifacts/mockup-sandbox/src/components/ui/resizable.tsx
artifacts/mockup-sandbox/src/components/ui/scroll-area.tsx
artifacts/mockup-sandbox/src/components/ui/select.tsx
artifacts/mockup-sandbox/src/components/ui/separator.tsx
artifacts/mockup-sandbox/src/components/ui/sheet.tsx
artifacts/mockup-sandbox/src/components/ui/sidebar.tsx
artifacts/mockup-sandbox/src/components/ui/skeleton.tsx
artifacts/mockup-sandbox/src/components/ui/slider.tsx
artifacts/mockup-sandbox/src/components/ui/sonner.tsx
artifacts/mockup-sandbox/src/components/ui/spinner.tsx
artifacts/mockup-sandbox/src/components/ui/switch.tsx
artifacts/mockup-sandbox/src/components/ui/table.tsx
artifacts/mockup-sandbox/src/components/ui/tabs.tsx
artifacts/mockup-sandbox/src/components/ui/textarea.tsx
artifacts/mockup-sandbox/src/components/ui/toast.tsx
artifacts/mockup-sandbox/src/components/ui/toaster.tsx
artifacts/mockup-sandbox/src/components/ui/toggle-group.tsx
artifacts/mockup-sandbox/src/components/ui/toggle.tsx
artifacts/mockup-sandbox/src/components/ui/tooltip.tsx
artifacts/mockup-sandbox/src/hooks/use-mobile.tsx
artifacts/mockup-sandbox/src/hooks/use-toast.ts
artifacts/mockup-sandbox/src/index.css
artifacts/mockup-sandbox/src/lib/utils.ts
```
