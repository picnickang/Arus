# UI mockups — workflow efficiency & information density follow-ups

Visual before/after mockups for the highest-leverage UX changes identified in
the June 2026 follow-up evaluation (post-Phase-2 navigation simplification).
They use the app's real design tokens (`client/src/index.css`) — light shadcn
shell for hub pages, the dark `IntelligenceLayout` theme for equipment pages.

| Image | Proposal | Key code touchpoints |
|---|---|---|
| `1-command-palette.png` | Global Cmd/Ctrl-K quick-switcher (vessels, equipment, WOs, pages, verb actions) | `client/src/components/ui/command.tsx` (exists, unmounted), `App.tsx` |
| `2-equipment-detail.png` | Equipment detail: 12 stacked sections → answer-first hero + 4 tabs | `client/src/pages/equipment-hub.tsx` |
| `3-wo-prefill.png` | Fix dropped `equipmentId` handoff; open WO dialog prefilled; URL-persisted filters | `usePdmEquipmentDetailData.ts:79`, `pages/work-orders.tsx`, `WorkOrderFormDialog` (`defaultVesselId`/`defaultEquipmentId` props exist) |
| `4-quick-work-order.png` | Surface the 3-field quick-create sheet from equipment pages/dashboard | `components/work-orders/QuickWorkOrderSheet.tsx` (exists, unmounted) |
| `5-pdm-tabs.png` | PdM Platform: 10 peer tabs → 4 operator tabs + role-gated "ML Ops" group | `pages/pdm-platform.tsx` |
| `6-system-hub.png` | System hub: 8 flat tiles → 5 purpose-named groups (audit target) | `config/navigationConfig.ts`, `pages/system-hub.tsx` |

The `.html` files are the editable sources (self-contained, no build step;
the `@font-face` rules expect `@fontsource/inter` under a local
`node_modules/` — without it they fall back to system fonts). Screenshots
were rendered headless at 2× via `playwright-core` + `@sparticuz/chromium`.

These are directional mockups, not pixel specs: data values are illustrative.
