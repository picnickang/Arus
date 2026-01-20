# ML/AI UI Refactor - Mobile Responsive Strategy

**Date:** November 17, 2025  
**Purpose:** Ensure mobile-first responsive design for all ML/AI pages  
**Target Devices:** iPhone SE (375px) → Desktop (1920px+)

---

## Design Philosophy

### Mobile-First Approach

1. **Start with mobile (375px)** → Scale up to desktop
2. **Touch-friendly targets** → All interactive elements ≥44px
3. **Vertical layouts** → Stack components on small screens
4. **Progressive disclosure** → Show essentials, hide details in accordions
5. **Horizontal scroll** → Allow for KPI cards, tabs, charts

---

## Breakpoints (Tailwind CSS)

```typescript
// Standard Tailwind breakpoints
const breakpoints = {
  sm: '640px',   // Small tablets
  md: '768px',   // Tablets (portrait)
  lg: '1024px',  // Tablets (landscape) / Small laptops
  xl: '1280px',  // Laptops
  '2xl': '1536px' // Large desktops
};
```

**Usage Pattern:**
```tsx
// Mobile-first: Default is mobile, add larger screens
<div className="flex flex-col lg:flex-row gap-4">
  {/* Stacks vertically on mobile, horizontal on lg+ */}
</div>
```

---

## Component-Level Responsive Patterns

### 1. KPI Cards

**Mobile (< 768px):**
- Horizontal scroll container
- Cards: `min-w-[200px]` to prevent shrinking
- Snap scroll for smooth UX

**Desktop (≥ 768px):**
- Grid layout: `grid-cols-2` → `lg:grid-cols-4`
- Cards expand to fill space

**Implementation:**
```tsx
<div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-2 lg:grid lg:grid-cols-4 md:overflow-x-visible">
  <KpiCard
    className="flex-shrink-0 min-w-[200px] snap-start md:min-w-0"
    icon={Activity}
    label="Active Models"
    value={12}
  />
  {/* More cards */}
</div>
```

---

### 2. Model Table

**Mobile (< 768px):**
- **Transform table → stacked cards**
- Each row becomes a vertical card
- Critical info visible, details in "View More" accordion

**Desktop (≥ 768px):**
- Standard table with all columns

**Implementation:**
```tsx
// Mobile card layout
<div className="space-y-3 md:hidden">
  {models.map(model => (
    <Card key={model.id} className="p-4" data-testid={`model-card-${model.id}`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{model.name}</h3>
            <p className="text-sm text-muted-foreground">{model.modelType}</p>
          </div>
          <StatusBadge status={model.status} />
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Accuracy:</span>
            <span className="ml-1 font-medium">{model.accuracy}%</span>
          </div>
          <div>
            <span className="text-muted-foreground">Last Updated:</span>
            <span className="ml-1 font-medium">{formatDate(model.lastValidation)}</span>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              Actions
            </Button>
          </DropdownMenuTrigger>
          {/* Action menu items */}
        </DropdownMenu>
      </div>
    </Card>
  ))}
</div>

// Desktop table layout
<div className="hidden md:block">
  <Table>
    {/* Standard table markup */}
  </Table>
</div>
```

---

### 3. Training Form (Unified)

**Mobile (< 768px):**
- Full-width form
- Stacked sections (model type, data window, equipment)
- Collapsible advanced options (closed by default)
- Sticky submit button at bottom

**Desktop (≥ 768px):**
- Two-column layout where appropriate
- Advanced options visible but collapsed

**Implementation:**
```tsx
<form className="space-y-6">
  {/* Model Type Selection - Full width on mobile */}
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <ModelTypeCard type="lstm" />
    <ModelTypeCard type="random-forest" />
    <ModelTypeCard type="xgboost" />
  </div>
  
  {/* Equipment & Data Window - Stack on mobile */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormField name="equipmentScope">
      <Select>{/* ... */}</Select>
    </FormField>
    
    <FormField name="objective">
      <Select>{/* ... */}</Select>
    </FormField>
  </div>
  
  {/* Data Window Presets - Horizontal scroll on mobile */}
  <div className="flex gap-3 overflow-x-auto pb-2 snap-x md:grid md:grid-cols-4">
    <DataWindowPreset tier="bronze" className="min-w-[150px] snap-start md:min-w-0" />
    <DataWindowPreset tier="silver" className="min-w-[150px] snap-start md:min-w-0" />
    <DataWindowPreset tier="gold" className="min-w-[150px] snap-start md:min-w-0" />
    <DataWindowPreset tier="platinum" className="min-w-[150px] snap-start md:min-w-0" />
  </div>
  
  {/* Advanced Options - Collapsible */}
  <Collapsible defaultOpen={false}>
    <CollapsibleTrigger>
      <Button variant="ghost">Advanced Options</Button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Advanced fields */}
      </div>
    </CollapsibleContent>
  </Collapsible>
  
  {/* Submit Button - Sticky on mobile */}
  <div className="sticky bottom-0 bg-background p-4 border-t md:static md:p-0 md:border-0">
    <Button type="submit" className="w-full md:w-auto">
      Start Training
    </Button>
  </div>
</form>
```

---

### 4. Charts (Recharts)

**Mobile (< 768px):**
- Full width
- Reduce height: `h-[300px]` instead of `h-[400px]`
- Hide legend or move to bottom
- Reduce tick count for x-axis

**Desktop (≥ 768px):**
- Standard sizing
- Legend visible on right/top
- More granular tick marks

**Implementation:**
```tsx
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useMediaQuery } from '@/hooks/useMediaQuery';

function AccuracyChart({ data }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  return (
    <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
      <LineChart data={data}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: isMobile ? 10 : 12 }}
          interval={isMobile ? 'preserveStartEnd' : 0}
        />
        <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
        <Tooltip />
        {!isMobile && <Legend />}
        <Line type="monotone" dataKey="accuracy" stroke="#8884d8" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

**Custom Hook:**
```typescript
// client/src/hooks/useMediaQuery.ts
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
```

---

### 5. Tabs (Multi-tab Dashboards)

**Mobile (< 768px):**
- Horizontal scroll tabs
- Snap scroll for smooth navigation
- Minimum touch target: 44px height
- Active tab indicator highly visible

**Desktop (≥ 768px):**
- Standard tab layout
- All tabs visible (no scroll)

**Implementation:**
```tsx
<Tabs defaultValue="metrics">
  <div className="overflow-x-auto pb-2">
    <TabsList className="inline-flex w-full min-w-fit p-1 gap-1">
      <TabsTrigger
        value="metrics"
        className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px]"
        data-testid="tab-metrics"
      >
        <Target className="h-4 w-4 mr-2" />
        Metrics
      </TabsTrigger>
      <TabsTrigger
        value="explanations"
        className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px]"
        data-testid="tab-explanations"
      >
        <Lightbulb className="h-4 w-4 mr-2" />
        Explanations
      </TabsTrigger>
      {/* More tabs */}
    </TabsList>
  </div>
  
  <TabsContent value="metrics">{/* Content */}</TabsContent>
  {/* More content */}
</Tabs>
```

---

### 6. Split Panels (Left/Right Layouts)

**Mobile (< 768px):**
- Stack vertically (left panel on top)
- Use accordions to show/hide panels
- OR: Single panel with navigation breadcrumbs

**Desktop (≥ 768px):**
- Side-by-side layout
- Resizable divider (optional)

**Implementation Pattern 1: Stack on Mobile**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  {/* Left Panel - Full width on mobile, 1/3 on desktop */}
  <div className="lg:col-span-1">
    <Card className="p-4">
      <h2>Predictions List</h2>
      {/* List of items */}
    </Card>
  </div>
  
  {/* Right Panel - Full width on mobile, 2/3 on desktop */}
  <div className="lg:col-span-2">
    <Card className="p-4">
      <h2>Explanation Details</h2>
      {/* Details view */}
    </Card>
  </div>
</div>
```

**Implementation Pattern 2: Mobile Drawer**
```tsx
// Mobile: Click item → Opens drawer
// Desktop: Click item → Updates right panel

const isMobile = useMediaQuery('(max-width: 1024px)');
const [selectedItem, setSelectedItem] = useState<string | null>(null);

return (
  <>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <ItemList onSelect={setSelectedItem} />
      </div>
      
      {!isMobile && (
        <div className="lg:col-span-2">
          <ItemDetails itemId={selectedItem} />
        </div>
      )}
    </div>
    
    {/* Mobile Drawer */}
    {isMobile && (
      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="bottom" className="h-[80vh]">
          <ItemDetails itemId={selectedItem} />
        </SheetContent>
      </Sheet>
    )}
  </>
);
```

---

### 7. Modals & Drawers

**Mobile (< 768px):**
- **Prefer bottom sheets** over center modals
- Full height (80-90vh)
- Swipe-to-dismiss gesture
- Content scrollable

**Desktop (≥ 768px):**
- Center modal or right drawer
- Fixed max-width (600-800px)

**Implementation:**
```tsx
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';

function ModelDetailsModal({ model, open, onClose }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-xl">
          <ModelDetailsContent model={model} />
        </SheetContent>
      </Sheet>
    );
  }
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <ModelDetailsContent model={model} />
      </DialogContent>
    </Dialog>
  );
}
```

---

## Page-Level Layouts

### Condition Monitoring AI Studio

**Mobile Layout:**
```
┌──────────────────────┐
│  Page Header         │
│  Title + Description │
├──────────────────────┤
│  KPI Cards           │
│  [Scroll →]          │
├──────────────────────┤
│  Model Card 1        │
│  ┌────────────────┐  │
│  │ Name           │  │
│  │ Type           │  │
│  │ Status         │  │
│  │ [Actions ▼]    │  │
│  └────────────────┘  │
├──────────────────────┤
│  Model Card 2        │
│  ...                 │
├──────────────────────┤
│  [+ Train New Model] │
│  (Sticky Bottom)     │
└──────────────────────┘
```

**Desktop Layout:**
```
┌────────────────────────────────────────────────┐
│  Page Header     [+ Train New Model Button]    │
├──────┬────────┬────────┬────────────────────┬──┤
│ KPI  │  KPI   │  KPI   │       KPI          │  │
├──────┴────────┴────────┴────────────────────┴──┤
│                                                 │
│  Model Table                                    │
│  ┌─────┬──────┬──────┬────────┬──────┬─────┐  │
│  │ Name│ Type │Objctv│Accuracy│Status│Acts │  │
│  ├─────┼──────┼──────┼────────┼──────┼─────┤  │
│  │ ... │ ...  │ ...  │  ...   │ ...  │ ... │  │
│  └─────┴──────┴──────┴────────┴──────┴─────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

### AI Performance Dashboard

**Mobile Layout:**
```
┌──────────────────────┐
│  Tabs                │
│  [Metrics][Explain]  │
├──────────────────────┤
│  KPI Cards (Scroll)  │
├──────────────────────┤
│  Chart               │
│  (Reduced height)    │
├──────────────────────┤
│  Insight Card 1      │
│  [Expand ▼]          │
├──────────────────────┤
│  Insight Card 2      │
│  ...                 │
└──────────────────────┘
```

**Desktop Layout:**
```
┌────────────────────────────────────────────────┐
│  [Metrics]  [Explanations]  [Feedback]         │
├──────┬────────┬────────┬────────────────────┬──┤
│ KPI  │  KPI   │  KPI   │       KPI          │  │
├──────┴────────┴────────┴────────────────────┴──┤
│                                                 │
│  Chart (Full Width)                             │
│                                                 │
├─────────────────┬───────────────────────────────┤
│ Insight Card 1  │  Insight Card 2               │
├─────────────────┼───────────────────────────────┤
│ Insight Card 3  │  Insight Card 4               │
└─────────────────┴───────────────────────────────┘
```

---

### AI Insights (Reports)

**Mobile Layout:**
```
┌──────────────────────┐
│  Form                │
│  [Vessel ▼]          │
│  [Type ▼]            │
│  [Model ▼]           │
│  [Generate Report]   │
├──────────────────────┤
│  Report Preview      │
│  (Scroll vertically) │
│                      │
│  ...                 │
│                      │
└──────────────────────┘
```

**Desktop Layout:**
```
┌────────────────────────────────────────────────┐
│  Left Panel (Form)   │   Right Panel (Preview) │
│  ┌──────────────┐    │   ┌──────────────────┐ │
│  │ [Vessel ▼]   │    │   │                  │ │
│  │ [Type ▼]     │    │   │  Report Content  │ │
│  │ [Model ▼]    │    │   │  (Live Preview)  │ │
│  │              │    │   │                  │ │
│  │ [Generate]   │    │   │                  │ │
│  └──────────────┘    │   └──────────────────┘ │
└────────────────────────────────────────────────┘
```

---

## Touch & Interaction Patterns

### Minimum Touch Targets

**WCAG 2.1 AAA Standard:** 44x44 CSS pixels

**Implementation:**
```tsx
// Buttons
<Button className="min-h-[44px] min-w-[44px]">Click Me</Button>

// Tab triggers
<TabsTrigger className="min-h-[44px] px-4">Tab</TabsTrigger>

// Icon buttons
<button className="p-3">
  <Icon className="h-5 w-5" />
</button>
```

---

### Gestures

**Horizontal Scroll:**
- KPI cards
- Tabs
- Data window presets

**Swipe:**
- Bottom sheets (dismiss)
- Image galleries (if applicable)

**Long Press:**
- Context menus (optional)

---

## Typography Scaling

### Mobile (< 768px)
```css
h1: text-2xl (24px)
h2: text-xl (20px)
h3: text-lg (18px)
body: text-sm (14px)
small: text-xs (12px)
```

### Desktop (≥ 768px)
```css
h1: text-3xl lg:text-4xl (30px → 36px)
h2: text-2xl lg:text-3xl (24px → 30px)
h3: text-xl lg:text-2xl (20px → 24px)
body: text-base (16px)
small: text-sm (14px)
```

**Implementation:**
```tsx
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
  Condition Monitoring AI Studio
</h1>
```

---

## Spacing & Padding

### Mobile
- Container padding: `p-4` (16px)
- Card padding: `p-3` (12px)
- Section gaps: `gap-4` (16px)

### Desktop
- Container padding: `p-6` (24px)
- Card padding: `p-4` to `p-6` (16-24px)
- Section gaps: `gap-6` (24px)

**Implementation:**
```tsx
<div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
  <Card className="p-3 md:p-4 lg:p-6">
    {/* Content */}
  </Card>
</div>
```

---

## Testing Responsive Layouts

### Manual Testing Devices

**Physical Devices:**
- iPhone SE (375x667) - Smallest modern iPhone
- iPhone 12 Pro (390x844)
- iPad Mini (768x1024)
- iPad Pro (1024x1366)

**Browser DevTools:**
- Chrome DevTools responsive mode
- Test all breakpoints: 375px, 640px, 768px, 1024px, 1280px, 1920px

---

### Playwright Mobile Tests

```typescript
// Mobile viewport
test.use({ viewport: { width: 375, height: 667 } });

test('Model table switches to card layout on mobile', async ({ page }) => {
  await page.goto('/ml-training');
  await page.getByTestId('tab-models').click();
  
  // Desktop table should be hidden
  const table = page.locator('table');
  await expect(table).toBeHidden();
  
  // Mobile cards should be visible
  const mobileCards = page.getByTestId(/model-card-/);
  await expect(mobileCards.first()).toBeVisible();
});

test('KPI cards are horizontally scrollable', async ({ page }) => {
  await page.goto('/ai-performance');
  
  const kpiContainer = page.getByTestId('kpi-container');
  await expect(kpiContainer).toHaveCSS('overflow-x', 'auto');
  
  // Verify scrollable
  const scrollWidth = await kpiContainer.evaluate(el => el.scrollWidth);
  const clientWidth = await kpiContainer.evaluate(el => el.clientWidth);
  expect(scrollWidth).toBeGreaterThan(clientWidth);
});
```

---

## Performance Considerations

### Lazy Loading Images
```tsx
<img
  src={imageUrl}
  alt={description}
  loading="lazy"
  className="w-full h-auto"
/>
```

### Conditional Rendering
```tsx
// Don't render desktop components on mobile
const isMobile = useMediaQuery('(max-width: 768px)');

return (
  <>
    {isMobile ? <MobileLayout /> : <DesktopLayout />}
  </>
);
```

### Virtual Scrolling for Long Lists
```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

// For mobile card lists with 100+ items
```

---

## Accessibility (Mobile)

### Focus Management
- Ensure keyboard users can navigate (external keyboards on tablets)
- Focus trap in modals/drawers

### Screen Reader Announcements
```tsx
<div aria-live="polite" aria-atomic="true">
  {message}
</div>
```

### Zoom Support
- Test at 200% zoom
- Text must be readable
- Buttons still tappable

---

## Summary Checklist

For each page/component:

- [ ] Tested at 375px (iPhone SE)
- [ ] Tested at 768px (iPad portrait)
- [ ] Tested at 1024px (iPad landscape)
- [ ] Tested at 1920px (Desktop)
- [ ] All touch targets ≥ 44px
- [ ] Tables transform to cards on mobile
- [ ] Charts scale appropriately
- [ ] Forms are vertically stacked
- [ ] No horizontal scroll (except intentional carousels)
- [ ] Text is readable at all sizes
- [ ] Images scale/crop appropriately
- [ ] Modals → Bottom sheets on mobile
- [ ] Tabs are horizontally scrollable if needed
- [ ] Sticky elements work correctly
- [ ] Dark mode works on all viewports

---

**Implementation Priority:**

1. **Week 1:** Build mobile layouts first (375px)
2. **Week 2:** Add tablet breakpoints (768px, 1024px)
3. **Week 3:** Optimize for desktop (1280px+)
4. **Week 4:** Polish, test, fix edge cases

**Tools:**
- Chrome DevTools Device Mode
- BrowserStack (real device testing)
- Playwright mobile viewports

---

**All Prerequisites Complete! Ready to proceed with Phase 1.**
