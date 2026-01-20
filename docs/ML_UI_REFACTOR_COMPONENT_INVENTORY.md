# ML/AI UI Refactor - Component Inventory

**Date:** November 17, 2025  
**Purpose:** Catalog of reusable components to build before refactor  
**Strategy:** Build in isolation → Test → Integrate

---

## Design System Foundation

### Core Principles
- **Consistency:** Reuse shadcn/ui primitives (Card, Badge, Button, Table)
- **Composition:** Build complex components from simple ones
- **Accessibility:** WCAG 2.1 AA compliance, keyboard navigation
- **Mobile-First:** Responsive at all breakpoints (sm, md, lg, xl)
- **Dark Mode:** Support existing theme system

---

## Shared Components Library

### Location: `client/src/components/ml-ai/`

---

## 1. Data Display Components

### `KpiCard.tsx`

**Purpose:** Standardized KPI metric display for dashboards

**Props:**
```typescript
interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: number;
    label: string;
  };
  loading?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  tooltip?: string;
  'data-testid'?: string;
}
```

**Example Usage:**
```tsx
<KpiCard
  icon={Activity}
  label="Active AI Models"
  value={12}
  subtitle="Deployed"
  trend={{ direction: 'up', value: 2, label: 'vs last month' }}
  tooltip="Number of ML models currently making predictions"
  data-testid="kpi-active-models"
/>
```

**Visual Specs:**
- Adaptive sizing: `min-w-[200px]` for horizontal scroll on mobile
- Icon size: `w-5 h-5`
- Value font: `text-2xl font-bold`
- Trend indicators: Arrow + percentage

**Dependencies:** `@/components/ui/card`, `@/components/ui/info-tooltip`, `lucide-react`

---

### `ModelTable.tsx`

**Purpose:** Unified table for displaying ML models with actions

**Props:**
```typescript
interface Model {
  id: string;
  name: string;
  modelType: 'lstm' | 'random-forest' | 'xgboost';
  objective: 'health' | 'failure' | 'rul';
  scope: string; // "All Equipment" or specific type
  status: 'training' | 'deployed' | 'archived';
  accuracy: number | null;
  lastValidation: Date | null;
  createdAt: Date;
}

interface ModelTableProps {
  models: Model[];
  loading?: boolean;
  onViewDetails: (modelId: string) => void;
  onTrain: (modelId: string) => void;
  onDeploy: (modelId: string) => void;
  onArchive: (modelId: string) => void;
  'data-testid'?: string;
}
```

**Features:**
- Sortable columns (name, type, accuracy, last validation)
- Status badges with color coding
- Action dropdown menu per row
- Empty state: "No models yet. Train your first model below."
- Mobile: Stacked card layout instead of table

**Visual Specs:**
- Table: `@/components/ui/table`
- Action menu: `@/components/ui/dropdown-menu`
- Status badges: `@/components/ui/badge`

---

### `InsightCard.tsx`

**Purpose:** Collapsible insight/recommendation card

**Props:**
```typescript
interface InsightCardProps {
  title: string;
  description: string;
  bullets: string[];
  status: 'active' | 'configured' | 'not-configured';
  icon: LucideIcon;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  'data-testid'?: string;
}
```

**Example:**
```tsx
<InsightCard
  title="Weather-Aware Threshold Adjustment"
  description="AI automatically adjusts sensor thresholds based on sea state and weather"
  bullets={[
    "Reduces false alarms in rough seas by 60%",
    "Dynamically adapts to operational conditions",
    "Integrates with OpenWeatherMap API"
  ]}
  status="active"
  icon={Waves}
  data-testid="insight-weather-aware"
/>
```

**Visual Specs:**
- Uses `@/components/ui/collapsible`
- Status badge in header
- Bullet list with checkmarks
- Expand/collapse icon

---

## 2. Form Components

### `ModelTrainingForm.tsx`

**Purpose:** Unified training form for all model types

**Props:**
```typescript
interface ModelTrainingFormProps {
  onSubmit: (config: TrainingConfig) => Promise<void>;
  equipmentTypes: string[];
  defaultValues?: Partial<TrainingConfig>;
  loading?: boolean;
}

interface TrainingConfig {
  modelType: 'lstm' | 'random-forest' | 'xgboost';
  objective: 'health' | 'failure' | 'rul';
  equipmentScope: string | 'all';
  dataWindow: 'bronze' | 'silver' | 'gold' | 'platinum';
  advancedOptions?: {
    epochs?: number;
    sequenceLength?: number;
    learningRate?: number;
    numTrees?: number;
    maxDepth?: number;
    // ... other advanced params
  };
}
```

**Features:**
- Model type radio selector with descriptions
- Equipment scope dropdown
- Data window preset buttons (Bronze/Silver/Gold/Platinum)
- Collapsible "Advanced Options" section (hidden by default)
- Form validation with Zod
- Progress indicator during training

**Visual Specs:**
- Uses `@/components/ui/form` (react-hook-form wrapper)
- Radio cards with icons and descriptions
- Preset buttons: Badge-styled clickable cards
- Advanced section: `@/components/ui/collapsible`

---

### `AcousticAnalysisPanel.tsx`

**Purpose:** File upload + visualization for acoustic data

**Props:**
```typescript
interface AcousticAnalysisPanelProps {
  equipmentId?: string;
  sensorType?: string;
  onAnalyze: (data: AcousticData) => Promise<AnalysisResult>;
  loading?: boolean;
}

interface AcousticData {
  source: 'file' | 'paste';
  data: number[];
  sampleRate: number;
  rpm?: number;
  metadata?: {
    fileName?: string;
    fileSize?: number;
  };
}
```

**Features:**
- Left panel: File upload (CSV) or paste textarea
- Right panel: Waveform chart (time-domain) + FFT chart (frequency)
- Analysis results card: Dominant frequencies, anomaly score
- Collapsible "Advanced/Paste Raw Data" toggle

**Visual Specs:**
- Split layout: `grid grid-cols-1 lg:grid-cols-2`
- File upload: `@/components/ui/input` type="file"
- Charts: Recharts `LineChart` and `BarChart`

---

## 3. Visualization Components

### `AccuracyTrendChart.tsx`

**Purpose:** Bar/Line chart showing model accuracy over time

**Props:**
```typescript
interface AccuracyTrendChartProps {
  data: Array<{
    date: string;
    accuracy: number;
    modelName?: string;
  }>;
  timeRange: '7d' | '30d' | '90d';
  onTimeRangeChange: (range: string) => void;
  loading?: boolean;
}
```

**Features:**
- Toggle: Bar chart vs Line chart
- Time range selector (7/30/90 days)
- Multi-model comparison (stacked or grouped)
- Tooltip with date + accuracy percentage

**Visual Specs:**
- Recharts `ResponsiveContainer`
- Custom colors from theme variables
- Responsive breakpoints

---

### `ExplanationPanel.tsx`

**Purpose:** Display AI prediction explanations with feature importance

**Props:**
```typescript
interface ExplanationPanelProps {
  prediction: {
    equipmentName: string;
    predictionType: string;
    value: number;
    confidence: number;
    timestamp: Date;
  };
  explanation: {
    naturalLanguage: string;
    topFeatures: Array<{
      name: string;
      importance: number;
      value: number;
      contribution: 'positive' | 'negative';
    }>;
    trend?: {
      historical: number[];
      labels: string[];
    };
  };
  loading?: boolean;
}
```

**Features:**
- Natural language explanation at top
- Feature importance horizontal bar chart
- Mini trend sparkline
- Link to full equipment details

**Visual Specs:**
- Uses `ExplainabilityVisualization` (existing component)
- Responsive layout: stack on mobile

---

## 4. Layout Components

### `TabbedDashboard.tsx`

**Purpose:** Wrapper for multi-tab dashboards with lazy loading

**Props:**
```typescript
interface TabbedDashboardProps {
  title: string;
  description?: string;
  tabs: Array<{
    id: string;
    label: string;
    icon: LucideIcon;
    component: React.LazyExoticComponent<React.ComponentType<any>>;
  }>;
  defaultTab?: string;
  'data-testid'?: string;
}
```

**Features:**
- Lazy-loaded tab content (Suspense boundaries)
- URL sync for tab state
- Loading skeletons per tab
- Mobile-optimized tabs (horizontal scroll)

**Visual Specs:**
- Uses `@/components/ui/tabs`
- Tab triggers: Icon + label
- Suspense fallback: `@/components/ui/skeleton`

---

### `PageHeader.tsx`

**Purpose:** Standardized page header with actions

**Props:**
```typescript
interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}
```

**Example:**
```tsx
<PageHeader
  title="Condition Monitoring AI Studio"
  description="Train and manage machine learning models for predictive maintenance"
  icon={Brain}
  actions={
    <Button onClick={handleTrainNew}>
      <Plus className="h-4 w-4 mr-2" />
      Train New Model
    </Button>
  }
/>
```

---

## 5. Utility Components

### `DataWindowPreset.tsx`

**Purpose:** Clickable preset card for training data windows

**Props:**
```typescript
interface DataWindowPresetProps {
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  days: number;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}
```

**Visual Specs:**
- Card with tier icon/emoji
- Border highlight when selected
- Disabled state with tooltip

---

### `StatusBadge.tsx`

**Purpose:** Reusable status badge with consistent styling

**Props:**
```typescript
interface StatusBadgeProps {
  status: 'active' | 'pending' | 'configured' | 'not-configured' | 'critical' | 'warning' | 'normal';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}
```

**Mapping:**
- `active` → Green
- `pending` → Yellow
- `configured` → Blue
- `not-configured` → Gray
- `critical` → Red
- `warning` → Orange
- `normal` → Green

---

## 6. Modal/Dialog Components

### `ModelDetailsDrawer.tsx`

**Purpose:** Right-hand drawer for model details

**Props:**
```typescript
interface ModelDetailsDrawerProps {
  model: Model;
  open: boolean;
  onClose: () => void;
  onAction: (action: 'deploy' | 'archive' | 'retrain') => void;
}
```

**Features:**
- Accuracy trend mini-chart
- Validation stats table
- Quick actions: Deploy, Retrain, Archive
- Link to full performance dashboard

**Visual Specs:**
- Uses `@/components/ui/sheet` (right drawer)
- Scrollable content area

---

## Component Build Order

### Phase 1 (Core Foundation) - Week 1
1. ✅ `KpiCard` (2 hours)
2. ✅ `StatusBadge` (1 hour)
3. ✅ `PageHeader` (2 hours)
4. ✅ `InsightCard` (3 hours)

### Phase 2 (Data Display) - Week 1-2
5. ✅ `ModelTable` (6 hours)
6. ✅ `AccuracyTrendChart` (4 hours)
7. ✅ `ExplanationPanel` (3 hours)

### Phase 3 (Forms) - Week 2
8. ✅ `DataWindowPreset` (2 hours)
9. ✅ `ModelTrainingForm` (8 hours)
10. ✅ `AcousticAnalysisPanel` (6 hours)

### Phase 4 (Advanced) - Week 2-3
11. ✅ `ModelDetailsDrawer` (4 hours)
12. ✅ `TabbedDashboard` (3 hours)

**Total Estimated Effort:** ~44 hours

---

## Testing Requirements Per Component

Each component must include:

### Unit Tests (Jest + React Testing Library)
- ✅ Renders without crashing
- ✅ Props are correctly applied
- ✅ Callbacks are triggered
- ✅ Loading states work
- ✅ Error states work
- ✅ Accessibility (keyboard nav, aria labels)

### Visual Regression Tests (Storybook)
- ✅ Default state
- ✅ Loading state
- ✅ Error state
- ✅ Empty state
- ✅ Dark mode
- ✅ Mobile viewport
- ✅ Desktop viewport

### Integration Tests (Playwright - after assembly)
- ✅ E2E workflows using the components
- ✅ Real API data rendering
- ✅ User interactions

---

## File Structure

```
client/src/components/ml-ai/
├── data-display/
│   ├── KpiCard.tsx
│   ├── KpiCard.test.tsx
│   ├── KpiCard.stories.tsx
│   ├── ModelTable.tsx
│   ├── ModelTable.test.tsx
│   ├── InsightCard.tsx
│   └── ...
├── forms/
│   ├── ModelTrainingForm.tsx
│   ├── ModelTrainingForm.test.tsx
│   ├── AcousticAnalysisPanel.tsx
│   └── ...
├── visualizations/
│   ├── AccuracyTrendChart.tsx
│   ├── ExplanationPanel.tsx
│   └── ...
├── layouts/
│   ├── TabbedDashboard.tsx
│   ├── PageHeader.tsx
│   └── ...
├── modals/
│   ├── ModelDetailsDrawer.tsx
│   └── ...
└── utils/
    ├── StatusBadge.tsx
    ├── DataWindowPreset.tsx
    └── ...
```

---

## Shared Hooks & Utilities

### `useModelPerformance.ts`
Fetch and cache model performance data

### `useTrainingSubmit.ts`
Handle training form submission with proper error handling

### `useAcousticAnalysis.ts`
Parse CSV/file upload and submit to API

### `ml-formatters.ts`
- `formatAccuracy(value: number): string`
- `formatConfidence(value: number): string`
- `formatModelType(type: string): string`

---

**Next Step:** Proceed to Testing Strategy
