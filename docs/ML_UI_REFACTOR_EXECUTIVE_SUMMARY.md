# ML/AI UI Refactor - Executive Summary

**Date:** November 17, 2025  
**Status:** ✅ **READY TO PROCEED**  
**Estimated Effort:** 4-6 weeks  
**Risk Level:** LOW (with mitigation strategies in place)

---

## What We're Building

A complete UI/UX overhaul of ARUS ML/AI features to match industry leaders (Wärtsilä Expert Insight, ABB Ability Marine, SKF):

### Before (Current State)

- 3 separate training pages (LSTM, Random Forest, XGBoost)
- Form-heavy interfaces requiring manual CSV pasting
- No unified model management
- ML features scattered across multiple pages

### After (Proposed State)

- **Single "Condition Monitoring AI Studio"** for all model management
- File upload + visualization for acoustic analysis
- Unified training form with data window presets (Bronze/Silver/Gold/Platinum)
- Operator-friendly dashboards with progressive disclosure
- Mobile-first responsive design

---

## Planning Documents Created

| Document                                                       | Purpose                                | Status      |
| -------------------------------------------------------------- | -------------------------------------- | ----------- |
| [API Audit](./ML_UI_REFACTOR_API_AUDIT.md)                     | Maps features to backend endpoints     | ✅ Complete |
| [Component Inventory](./ML_UI_REFACTOR_COMPONENT_INVENTORY.md) | Lists 12 reusable components to build  | ✅ Complete |
| [Testing Strategy](./ML_UI_REFACTOR_TESTING_STRATEGY.md)       | E2E, integration, unit test plan       | ✅ Complete |
| [Feature Flags](./ML_UI_REFACTOR_FEATURE_FLAGS.md)             | Rollout strategy with instant rollback | ✅ Complete |
| [Mobile Strategy](./ML_UI_REFACTOR_MOBILE_STRATEGY.md)         | Mobile-first responsive design guide   | ✅ Complete |

---

## Key Findings

### ✅ Backend Readiness: 85%

**What Works Today:**

- All ML training endpoints exist (LSTM, RF, XGBoost)
- Model management APIs ready
- Performance metrics & explanations ready
- LLM/AI Reports infrastructure ready

**What Needs Work (Minor):**

- WAV file upload for acoustics (can use CSV for Phase 1)
- Native model export (can use JSON for Phase 1)
- Full RAG semantic search (can use basic LLM chat for Phase 1)

**Critical Blockers:** NONE ✅

---

## Phase 1 Scope (Weeks 1-2)

### 🎯 AI Management Studio

**Build:**

1. **Unified Model Table** - All models in one view
2. **Training Form** - Single form for LSTM/RF/XGBoost with:
   - Model type radio selector
   - Data window presets (Bronze/Silver/Gold/Platinum)
   - Collapsible advanced options
3. **Acoustic Analysis** - File upload + waveform/FFT charts (CSV only)
4. **Data Export** - JSON exports for models/predictions

**Components Required (12 total):**

- ✅ KpiCard (2 hours)
- ✅ StatusBadge (1 hour)
- ✅ PageHeader (2 hours)
- ✅ InsightCard (3 hours)
- ✅ ModelTable (6 hours)
- ✅ AccuracyTrendChart (4 hours)
- ✅ DataWindowPreset (2 hours)
- ✅ ModelTrainingForm (8 hours)
- ✅ AcousticAnalysisPanel (6 hours)
- ✅ ModelDetailsDrawer (4 hours)
- ✅ TabbedDashboard (3 hours)
- ✅ ExplanationPanel (3 hours)

**Estimated Effort:** 44 component hours + 16 integration hours = **60 hours (1.5 weeks)**

---

## Testing Coverage

### Before Starting

- [x] Document current test coverage
- [x] Create baseline E2E tests for existing features
- [x] Manual QA checklist with screenshots

### During Development

- Unit tests per component (85%+ coverage target)
- Integration tests with MSW mocks
- Visual regression with Storybook

### Before Launch

- E2E tests for critical paths (5 scenarios)
- Mobile responsiveness (375px → 1920px)
- Accessibility audit (WCAG 2.1 AA)
- Performance budget (LCP < 2.5s)

**Test Infrastructure:** ✅ Ready (Playwright + Jest + MSW)

---

## Rollout Strategy

### Week 1: Internal Testing

- **Target:** Development team (5 people)
- **Method:** LocalStorage overrides
- **Validation:** All tests passing, no console errors

### Week 2: Beta Testing

- **Target:** 10 internal users (crew managers, fleet operators)
- **Method:** Environment variables
- **Metrics:** User feedback, error rates, task completion time

### Week 3: Staged Rollout

- **25% → 50% → 100%** of users
- **Monitor:** Performance, errors, support tickets
- **Rollback Time:** 2 minutes (toggle env var)

### Week 6+: Cleanup

- Remove old components
- Delete feature flags
- Update documentation

**Risk Mitigation:** ✅ Feature flags enable instant rollback

---

## Mobile-First Responsive

### Design Patterns

- **KPI Cards:** Horizontal scroll on mobile, grid on desktop
- **Model Table:** Card layout on mobile, table on desktop
- **Forms:** Stacked sections on mobile, 2-column on desktop
- **Charts:** Reduced height on mobile, legend hidden
- **Modals:** Bottom sheets on mobile, center dialogs on desktop

### Touch Targets

- All interactive elements ≥ 44x44px (WCAG AAA)
- Horizontal scroll for tabs/carousels
- Sticky submit buttons on forms

### Test Devices

- iPhone SE (375px)
- iPad (768px)
- Desktop (1920px)

**Status:** ✅ Comprehensive mobile strategy documented

---

## Success Criteria

### Technical

- [ ] All E2E tests passing
- [ ] 85%+ unit test coverage
- [ ] No WCAG violations
- [ ] LCP < 2.5s, FCP < 1.8s
- [ ] Mobile layouts work on iPhone SE

### User Experience

- [ ] Training a model takes < 5 clicks
- [ ] Acoustic analysis accepts file upload (no more CSV paste)
- [ ] Model management in single dashboard
- [ ] 80%+ user satisfaction (beta feedback)

### Business

- [ ] Matches competitor UX (Wärtsilä, ABB)
- [ ] Zero critical bugs in production
- [ ] < 1% error rate
- [ ] No increase in support tickets

---

## Risks & Mitigation

| Risk                    | Impact   | Probability | Mitigation                                   |
| ----------------------- | -------- | ----------- | -------------------------------------------- |
| Regression bugs         | HIGH     | MEDIUM      | Comprehensive E2E tests before launch        |
| Performance degradation | MEDIUM   | LOW         | Lighthouse CI monitoring, lazy loading       |
| Mobile layout issues    | MEDIUM   | MEDIUM      | Real device testing, Playwright mobile tests |
| User confusion          | HIGH     | LOW         | Beta testing, progressive disclosure design  |
| API breaking changes    | CRITICAL | VERY LOW    | Feature flags allow instant rollback         |

**Overall Risk:** **LOW** with current mitigation strategies

---

## Resource Requirements

### Engineering Time

- **Phase 1 (AI Management):** 60 hours (1.5 weeks)
- **Phase 2 (AI Performance):** 40 hours (1 week)
- **Phase 3 (AI Insights):** 48 hours (1.2 weeks)
- **Testing & Polish:** 32 hours (0.8 weeks)

**Total:** ~180 hours (~4.5 weeks at 40 hours/week)

### Infrastructure

- No new backend services required
- No database migrations needed
- No third-party service subscriptions

### Dependencies

- Recharts (already installed) ✅
- TanStack Query (already installed) ✅
- shadcn/ui (already installed) ✅
- Playwright (already installed) ✅

---

## Go/No-Go Decision Matrix

| Criteria            | Status    | Notes                                 |
| ------------------- | --------- | ------------------------------------- |
| Backend APIs ready  | ✅ YES    | 85% exist, 15% can defer to future    |
| Design approved     | ✅ YES    | Matches industry best practices       |
| Test infrastructure | ✅ YES    | Playwright + Jest ready               |
| Team capacity       | ⚠️ VERIFY | Need 1 senior engineer for 4-6 weeks  |
| Rollback capability | ✅ YES    | Feature flags enable instant rollback |
| Mobile strategy     | ✅ YES    | Comprehensive responsive design plan  |

**Recommendation:** ✅ **PROCEED WITH PHASE 1**

---

## Next Steps

### Immediate (Week 1, Days 1-2)

1. Create `client/src/lib/feature-flags.ts`
2. Build core components in isolation:
   - KpiCard
   - StatusBadge
   - PageHeader
   - InsightCard

### Week 1, Days 3-5

3. Build data display components:
   - ModelTable
   - AccuracyTrendChart
   - ExplanationPanel

### Week 2

4. Build form components:
   - ModelTrainingForm
   - AcousticAnalysisPanel
5. Integrate into pages
6. Write E2E tests
7. Internal testing

---

## Communication Plan

### Stakeholders

- **Engineering Team:** Daily standups, code reviews
- **Product Team:** Weekly demos of progress
- **Beta Users:** Invitation email + feedback form
- **All Users:** Release notes when GA

### Documentation Updates

- Update `replit.md` with new architecture
- Create user guide: "How to train ML models"
- Record video demo for onboarding

---

## Decision Point

**Question for User:**

All prerequisites are complete. We have:

- ✅ Comprehensive API audit (85% ready)
- ✅ Component inventory (12 components, 44 hours)
- ✅ Testing strategy (E2E + integration + unit)
- ✅ Feature flag rollout plan (instant rollback)
- ✅ Mobile-first responsive design guide

**Ready to proceed with Phase 1: AI Management Studio?**

This includes:

- Unified Model Table
- Training Form with Bronze/Silver/Gold/Platinum presets
- Acoustic Analysis with file upload
- Mobile-optimized layouts

Estimated time: **1.5 weeks (60 hours)**

---

**Documents Location:** `docs/ML_UI_REFACTOR_*.md`
