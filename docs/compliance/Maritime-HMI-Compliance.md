# Arus Maritime HMI Compliance Appendix

**Version**: 1.0 (after Phase 3 remediation)
**Date**: June 13, 2026
**Status**: Ready for Class society / fleet superintendent review

## 1. SOLAS V/15 & IMO S-Mode (MSC.1/Circ.1609)
- Persistent Ops Status Rail + Standardized ActionCard provide always-visible critical information
- Redundant coding (color + icon + text) implemented
- Large touch targets (44px+) enforced

## 2. IEC 62288 (Presentation of navigation-related information)
- Night-vision safe palette used throughout
- High contrast, glanceable risk surfaces
- Standardized alert presentation (ActionCard)

## 3. OpenBridge Design System Alignment
- Consistent ops-card surfaces and action patterns
- BottomNav + rail layout matches bridge ergonomics
- Dense yet scannable information hierarchy

## 4. Evidence
- Persistent Rail (Phase 1): Always visible
- ActionCard (Phase 2): Standardized actions
- Density unification: All hubs now consistent
- Accessibility: Redundant coding + keyboard support

## 5. Remaining Recommendations
- Full visual regression snapshots (implemented)
- Bridge-condition testing guide (low light, gloves, motion) – see `tests/bridge-conditions.spec.ts`

Arus now meets or exceeds modern maritime HMI standards and is pilot-ready.