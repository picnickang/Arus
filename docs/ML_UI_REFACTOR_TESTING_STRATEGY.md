# ML/AI UI Refactor - Testing Strategy

**Date:** November 17, 2025  
**Purpose:** Comprehensive testing plan for ML/AI UI refactor  
**Risk Level:** HIGH (large refactor touching 15+ components)

---

## Testing Philosophy

### Zero Regression Policy
- All existing functionality must continue to work
- No feature should be silently broken
- Test coverage must increase, not decrease

### Test Pyramid (Target Coverage)
```
        /\
       /E2E\           10% - Critical user journeys
      /------\
     /  API   \        20% - Integration tests
    /----------\
   /   Unit     \      70% - Component & logic tests
  /--------------\
```

---

## 1. Pre-Refactor Testing (Baseline)

### Purpose: Establish current state before changes

### Action Items:
1. **Document Current Coverage**
   ```bash
   npm run test:coverage
   # Save output to docs/coverage-baseline.txt
   ```

2. **Create E2E Test Suite for Existing Features**
   - Test current ML Training page workflows
   - Test current AI Performance page workflows
   - Test current AI Insights page workflows
   - Save as `playwright-tests/baseline-ml-features.spec.ts`

3. **Manual QA Checklist** (Screenshot + verify):
   - LSTM training form submits successfully
   - Random Forest training form submits successfully
   - Acoustic analysis accepts CSV paste
   - Model performance table displays
   - Prediction feedback table displays
   - AI report generation works
   - Vessel intelligence loads

**Deliverable:** ✅ Baseline test suite (run before refactor begins)

---

## 2. Component-Level Unit Tests

### Framework: Jest + React Testing Library

### Test Files Required:

#### Data Display Components
```
client/src/components/ml-ai/data-display/__tests__/
├── KpiCard.test.tsx
├── ModelTable.test.tsx
├── InsightCard.test.tsx
└── StatusBadge.test.tsx
```

**Test Coverage Per Component:**
- ✅ Renders with required props
- ✅ Renders loading state
- ✅ Renders empty state
- ✅ Renders error state
- ✅ Handles user interactions (clicks, hovers)
- ✅ Calls callbacks with correct arguments
- ✅ Keyboard navigation works
- ✅ Screen reader labels are correct
- ✅ Dark mode renders correctly

**Example Test Template:**
```typescript
// KpiCard.test.tsx
import { render, screen } from '@testing-library/react';
import { KpiCard } from '../KpiCard';
import { Activity } from 'lucide-react';

describe('KpiCard', () => {
  it('renders label and value correctly', () => {
    render(
      <KpiCard
        icon={Activity}
        label="Active Models"
        value={12}
        data-testid="kpi-test"
      />
    );
    expect(screen.getByText('Active Models')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('displays loading skeleton when loading=true', () => {
    render(<KpiCard icon={Activity} label="Test" value={0} loading={true} />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('shows trend indicator when provided', () => {
    render(
      <KpiCard
        icon={Activity}
        label="Test"
        value={10}
        trend={{ direction: 'up', value: 5, label: 'vs last month' }}
      />
    );
    expect(screen.getByText('vs last month')).toBeInTheDocument();
    expect(screen.getByTestId('trend-up')).toBeInTheDocument();
  });
});
```

---

#### Form Components
```
client/src/components/ml-ai/forms/__tests__/
├── ModelTrainingForm.test.tsx
└── AcousticAnalysisPanel.test.tsx
```

**Test Coverage:**
- ✅ Form validation (required fields, format checks)
- ✅ Submit with valid data
- ✅ Submit with invalid data (shows errors)
- ✅ Loading state during submission
- ✅ Success callback triggered
- ✅ Error callback triggered
- ✅ Advanced options collapse/expand
- ✅ File upload parsing

**Example:**
```typescript
describe('ModelTrainingForm', () => {
  it('requires model type selection', async () => {
    const onSubmit = jest.fn();
    render(<ModelTrainingForm onSubmit={onSubmit} equipmentTypes={[]} />);
    
    const submitButton = screen.getByRole('button', { name: /train/i });
    await userEvent.click(submitButton);
    
    expect(screen.getByText(/model type is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits form with correct payload', async () => {
    const onSubmit = jest.fn();
    render(<ModelTrainingForm onSubmit={onSubmit} equipmentTypes={['Engine']} />);
    
    // Select LSTM
    await userEvent.click(screen.getByLabelText(/lstm/i));
    // Select data window
    await userEvent.click(screen.getByText(/gold/i));
    // Select equipment
    await userEvent.selectOptions(screen.getByLabelText(/equipment/i), 'Engine');
    
    await userEvent.click(screen.getByRole('button', { name: /train/i }));
    
    expect(onSubmit).toHaveBeenCalledWith({
      modelType: 'lstm',
      dataWindow: 'gold',
      equipmentScope: 'Engine',
      objective: 'health'
    });
  });
});
```

---

### Coverage Targets (Jest)
- **Statements:** 85%+
- **Branches:** 80%+
- **Functions:** 85%+
- **Lines:** 85%+

**Run Tests:**
```bash
npm run test:unit -- --coverage
```

---

## 3. Integration Tests (API + UI)

### Framework: Vitest + MSW (Mock Service Worker)

### Test Files:
```
client/src/pages/__tests__/integration/
├── ml-training-integration.test.tsx
├── ai-performance-integration.test.tsx
└── ai-insights-integration.test.tsx
```

**Scenarios:**

### ML Training Integration
1. ✅ Fetch models list → Display in table
2. ✅ Submit training form → Show success toast → Refetch models
3. ✅ Submit with invalid data → Show API error message
4. ✅ Deploy model → Update status in table
5. ✅ Delete model → Remove from table + show confirmation

### AI Performance Integration
1. ✅ Load performance metrics → Display KPIs
2. ✅ Load predictions → Render list
3. ✅ Select prediction → Load explanation → Display SHAP chart
4. ✅ Filter by equipment → Re-fetch data

### AI Insights Integration
1. ✅ Select vessel → Generate report → Display content
2. ✅ Load vessel intelligence → Display patterns
3. ✅ Report generation fails → Show error state

**Example:**
```typescript
// ml-training-integration.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { MLTrainingPage } from '../ml-training';

const server = setupServer(
  rest.get('/api/analytics/ml-models', (req, res, ctx) => {
    return res(ctx.json([
      { id: '1', name: 'Engine LSTM', modelType: 'lstm', status: 'deployed' }
    ]));
  }),
  rest.post('/api/ml/train/lstm', (req, res, ctx) => {
    return res(ctx.json({ success: true, modelId: '2' }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ML Training Integration', () => {
  it('loads models and displays in table', async () => {
    render(<MLTrainingPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Engine LSTM')).toBeInTheDocument();
    });
  });

  it('trains new model and updates list', async () => {
    render(<MLTrainingPage />);
    
    // Fill form and submit
    await userEvent.click(screen.getByLabelText(/lstm/i));
    await userEvent.click(screen.getByText(/train/i));
    
    // Wait for success
    await waitFor(() => {
      expect(screen.getByText(/model trained successfully/i)).toBeInTheDocument();
    });
  });
});
```

---

## 4. End-to-End Tests (Critical User Journeys)

### Framework: Playwright

### Test Files:
```
playwright-tests/ml-ai/
├── 01-model-training-workflow.spec.ts
├── 02-ai-performance-dashboard.spec.ts
├── 03-ai-insights-report-generation.spec.ts
├── 04-acoustic-analysis.spec.ts
└── 05-mobile-responsiveness.spec.ts
```

---

### Critical Path Tests

#### Test 1: Train LSTM Model End-to-End
```typescript
// 01-model-training-workflow.spec.ts
test('Train LSTM model from start to finish', async ({ page }) => {
  // Navigate to ML Training
  await page.goto('/ml-ai-consolidated');
  await page.getByTestId('tab-training').click();
  
  // Open training form
  await page.getByRole('button', { name: /train new model/i }).click();
  
  // Select LSTM
  await page.getByTestId('radio-lstm').click();
  
  // Select data window (Gold)
  await page.getByTestId('preset-gold').click();
  
  // Select equipment type
  await page.getByLabel('Equipment Type').selectOption('Engine');
  
  // Submit
  await page.getByRole('button', { name: /start training/i }).click();
  
  // Wait for success
  await expect(page.getByText(/model trained successfully/i)).toBeVisible({ timeout: 60000 });
  
  // Verify model appears in table
  await expect(page.getByTestId('model-table')).toContainText('Engine LSTM');
});
```

---

#### Test 2: View AI Performance Dashboard
```typescript
// 02-ai-performance-dashboard.spec.ts
test('Load AI Performance dashboard and view explanation', async ({ page }) => {
  await page.goto('/ai-performance');
  
  // Verify KPIs load
  await expect(page.getByTestId('stat-active-models')).toBeVisible();
  await expect(page.getByTestId('stat-total-predictions')).toBeVisible();
  
  // Navigate to Explanations tab
  await page.getByTestId('tab-explanations').click();
  
  // Select a prediction
  await page.getByTestId('button-prediction-0').click();
  
  // Verify explanation renders
  await expect(page.getByText(/key input features/i)).toBeVisible();
  await expect(page.getByTestId('shap-chart')).toBeVisible();
});
```

---

#### Test 3: Generate AI Report
```typescript
// 03-ai-insights-report-generation.spec.ts
test('Generate vessel health report', async ({ page }) => {
  await page.goto('/ai-insights');
  
  // Select vessel
  await page.getByLabel('Vessel').selectOption({ index: 1 });
  
  // Select report type
  await page.getByLabel('Report Type').selectOption('health');
  
  // Select AI model
  await page.getByLabel('AI Model').selectOption('gpt-4o');
  
  // Generate report
  await page.getByRole('button', { name: /generate report/i }).click();
  
  // Wait for report (LLM can be slow)
  await expect(page.getByTestId('report-content')).toBeVisible({ timeout: 120000 });
  
  // Verify report has content
  await expect(page.getByTestId('report-content')).not.toBeEmpty();
});
```

---

#### Test 4: Acoustic Analysis CSV Upload
```typescript
// 04-acoustic-analysis.spec.ts
test('Upload CSV and analyze acoustic data', async ({ page }) => {
  await page.goto('/ml-training');
  await page.getByTestId('tab-acoustic').click();
  
  // Upload CSV file
  const fileInput = page.getByLabel('Upload CSV');
  await fileInput.setInputFiles('./test-data/acoustic-sample.csv');
  
  // Set parameters
  await page.getByLabel('Sample Rate').fill('44100');
  await page.getByLabel('RPM').fill('1800');
  
  // Analyze
  await page.getByRole('button', { name: /analyze/i }).click();
  
  // Wait for results
  await expect(page.getByTestId('waveform-chart')).toBeVisible();
  await expect(page.getByTestId('fft-chart')).toBeVisible();
  await expect(page.getByText(/health score/i)).toBeVisible();
});
```

---

#### Test 5: Mobile Responsiveness
```typescript
// 05-mobile-responsiveness.spec.ts
test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

test('ML Training page is usable on mobile', async ({ page }) => {
  await page.goto('/ml-training');
  
  // Verify tabs are horizontally scrollable
  const tabsList = page.getByRole('tablist');
  await expect(tabsList).toHaveCSS('overflow-x', 'auto');
  
  // Verify model table switches to card layout
  await page.getByTestId('tab-models').click();
  const modelCards = page.getByTestId(/model-card-/);
  await expect(modelCards.first()).toBeVisible();
  
  // Verify KPI cards are horizontally scrollable
  await page.goto('/ai-performance');
  const kpiContainer = page.getByTestId('kpi-container');
  await expect(kpiContainer).toHaveCSS('overflow-x', 'auto');
});
```

---

### Playwright Test Execution

**Run all tests:**
```bash
npm run test:e2e
```

**Run in headed mode (watch tests):**
```bash
npm run test:e2e -- --headed
```

**Run specific test:**
```bash
npm run test:e2e -- ml-ai/01-model-training-workflow.spec.ts
```

---

## 5. Visual Regression Tests (Optional but Recommended)

### Framework: Percy.io or Chromatic

### Screenshots to Capture:
1. ML Training page - LSTM tab
2. ML Training page - Random Forest tab
3. ML Training page - Acoustic Analysis tab
4. Model table - 5 models loaded
5. AI Performance - Metrics tab
6. AI Performance - Explanations tab
7. AI Insights - Report generated
8. Mobile viewport (375px) - all pages

**Setup:**
```bash
npm install --save-dev @percy/cli @percy/playwright
```

**Example:**
```typescript
import percySnapshot from '@percy/playwright';

test('ML Training visual regression', async ({ page }) => {
  await page.goto('/ml-training');
  await percySnapshot(page, 'ML Training - LSTM Tab');
  
  await page.getByTestId('tab-rf').click();
  await percySnapshot(page, 'ML Training - RF Tab');
});
```

---

## 6. Accessibility (a11y) Tests

### Framework: axe-playwright

### Test Coverage:
- ✅ All interactive elements have accessible names
- ✅ Form inputs have labels
- ✅ Focus indicators visible
- ✅ Keyboard navigation works
- ✅ ARIA roles correct
- ✅ Color contrast passes WCAG AA

**Example:**
```typescript
import { injectAxe, checkA11y } from 'axe-playwright';

test('ML Training page has no a11y violations', async ({ page }) => {
  await page.goto('/ml-training');
  await injectAxe(page);
  
  await checkA11y(page, null, {
    detailedReport: true,
    detailedReportOptions: { html: true }
  });
});
```

---

## 7. Performance Tests

### Metrics to Track:
- **First Contentful Paint (FCP):** < 1.8s
- **Largest Contentful Paint (LCP):** < 2.5s
- **Time to Interactive (TTI):** < 3.8s
- **Bundle size increase:** < 10% vs baseline

**Lighthouse CI:**
```bash
npm install --save-dev @lhci/cli
```

**lighthouse.config.js:**
```javascript
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:5000/ml-training', 'http://localhost:5000/ai-performance'],
      numberOfRuns: 3
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
      }
    }
  }
};
```

---

## 8. Testing Workflow

### Development Phase (Per Component)
1. Write component
2. Write unit tests (TDD recommended)
3. Run tests: `npm run test:unit ComponentName`
4. Achieve 85%+ coverage
5. Visual QA in Storybook
6. Commit

### Integration Phase (Per Page)
1. Integrate components into page
2. Write integration tests
3. Run tests: `npm run test:integration`
4. Fix any issues
5. Commit

### E2E Phase (After Full Refactor)
1. Write critical path E2E tests
2. Run baseline tests (before refactor)
3. Run new tests (after refactor)
4. Compare results
5. Fix regressions

### Pre-Merge Checklist
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] No a11y violations
- [ ] Performance budget maintained
- [ ] Visual regression approved (if using Percy/Chromatic)
- [ ] Code review approved
- [ ] Documentation updated

---

## 9. CI/CD Integration

### GitHub Actions Workflow

```yaml
name: ML UI Refactor Tests

on:
  pull_request:
    paths:
      - 'client/src/pages/ml-*.tsx'
      - 'client/src/pages/ai-*.tsx'
      - 'client/src/components/ml-ai/**'

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v3
  
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:integration
  
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install
      - run: npm run build
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 10. Test Data Management

### Mock Data Repository
```
server/test-data/
├── ml-models.json          # Sample ML models
├── predictions.json        # Sample predictions
├── acoustic-sample.csv     # Acoustic test data
├── vessel-intelligence.json # Sample LLM responses
└── performance-metrics.json # Sample analytics
```

### Seed Script
```bash
# For development/testing
npm run seed:ml-test-data
```

**Implementation:**
```typescript
// server/scripts/seed-ml-test-data.ts
import fs from 'fs';
import { storage } from '../storage';

async function seed() {
  const models = JSON.parse(fs.readFileSync('./test-data/ml-models.json', 'utf-8'));
  for (const model of models) {
    await storage.createMlModel(model);
  }
  console.log(`✅ Seeded ${models.length} ML models`);
}
```

---

## Risk Mitigation

### High-Risk Areas
1. **Form submission logic** - Ensure validation doesn't break
2. **API endpoint mapping** - Verify all endpoints still work
3. **Chart rendering** - Test with empty/large datasets
4. **Mobile layout** - Test on real devices

### Fallback Strategy
- Feature flags enable/disable new UI
- Ability to rollback to old pages if critical bugs found
- Progressive rollout (internal testing → beta users → all users)

---

**Next Step:** Proceed to Feature Flags Plan
