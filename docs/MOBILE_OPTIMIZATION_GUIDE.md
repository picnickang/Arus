# Mobile Optimization Guide - ARUS

## Overview
This guide documents the mobile optimization patterns implemented in ARUS for converting desktop-centric UIs to mobile-friendly responsive interfaces.

## Phase 1: Foundation ✅
**Goal:** Core mobile navigation and layout

### Components Created:
- **BottomNavigation**: Mobile-optimized bottom tab bar
- **Mobile CSS Utilities**: Touch targets, safe areas, scroll containers

### Key Features:
- Thumb-zone optimized navigation (bottom 64px)
- 44px+ minimum touch targets
- FAB positioning above bottom nav
- Horizontal scroll for card grids on mobile
- Safe area support for notched devices

### Usage:
```tsx
// App.tsx automatically shows bottom nav on mobile (<768px)
// Desktop users see the sidebar
```

## Phase 2: Responsive Components ✅  
**Goal:** Reusable mobile-adaptive UI patterns

### Components Created:

#### 1. ResponsiveDialog
Auto-converts between Dialog (desktop) and Sheet (mobile) based on viewport.

**Import:**
```tsx
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
```

**Usage:**
```tsx
<ResponsiveDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  title="Form Title"
  description="Optional description"
  footer={
    <div className="flex gap-2 w-full">
      <Button variant="outline" onClick={onCancel} className="flex-1">
        Cancel
      </Button>
      <Button onClick={onSubmit} className="flex-1">
        Submit
      </Button>
    </div>
  }
>
  {/* Your form content */}
</ResponsiveDialog>
```

**Behavior:**
- **Mobile (<768px)**: Bottom sheet, slides up, max-height 90vh, thumb-friendly
- **Desktop (≥768px)**: Standard centered modal

#### 2. useMediaQuery Hook
React hook for responsive behavior.

**Import:**
```tsx
import { useMediaQuery } from "@/hooks/use-media-query";
```

**Usage:**
```tsx
const isMobile = useMediaQuery("(max-width: 768px)");

return (
  <div>
    {isMobile ? <MobileLayout /> : <DesktopLayout />}
  </div>
);
```

**Features:**
- Safe for SSR/test environments
- Automatic cleanup
- Re-renders on viewport change

### Mobile Form CSS Utilities

Add these classes to form elements for mobile optimization:

#### Form Fields:
```tsx
<div className="mobile-form-field">
  <Label className="mobile-label">Field Name</Label>
  <Input className="mobile-input" />
</div>
```

#### Available Classes:
- `.mobile-form-field` - Extra spacing (mb-6 mobile, mb-4 desktop)
- `.mobile-input` - Larger inputs (h-12/text-base mobile, h-10/text-sm desktop)
- `.mobile-select` - Larger selects
- `.mobile-textarea` - Optimized min-height (120px mobile, 80px desktop)
- `.mobile-label` - Larger labels (text-base mobile, text-sm desktop)

#### Sticky Form Actions:
```tsx
{/* Without bottom nav */}
<div className="sticky-form-actions">
  <Button>Submit</Button>
</div>

{/* With bottom nav - positions above it */}
<div className="sticky-form-actions-with-nav">
  <Button>Submit</Button>
</div>
```

**Behavior:**
- **Mobile**: Sticks to bottom of screen with backdrop blur
- **Desktop**: Static positioning in normal flow

## Phase 3: Data-Heavy Pages 🔄
**Goal:** Optimize complex data displays for mobile

### Conversion Pattern: Dialog → ResponsiveDialog

#### Before (Desktop-only Dialog):
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    <div className="space-y-4">
      {/* Form fields */}
    </div>
    <div className="flex justify-end space-x-2">
      <Button onClick={onCancel}>Cancel</Button>
      <Button onClick={onSubmit}>Submit</Button>
    </div>
  </DialogContent>
</Dialog>
```

#### After (Mobile-Responsive):
```tsx
import { ResponsiveDialog } from "@/components/ResponsiveDialog";

<ResponsiveDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  title="Title"
  description="Description"
  footer={
    <div className="flex gap-2 w-full">
      <Button variant="outline" onClick={onCancel} className="flex-1">
        Cancel
      </Button>
      <Button onClick={onSubmit} className="flex-1">
        Submit
      </Button>
    </div>
  }
>
  <div className="space-y-2">
    <div className="mobile-form-field">
      <Label className="mobile-label">Field 1</Label>
      <Input className="mobile-input" />
    </div>
    <div className="mobile-form-field">
      <Label className="mobile-label">Field 2</Label>
      <Select className="mobile-select">
        {/* options */}
      </Select>
    </div>
  </div>
</ResponsiveDialog>
```

### Key Improvements:
1. **Auto-responsive**: No manual viewport checks needed
2. **Larger touch targets**: Mobile-optimized input sizes
3. **Sticky footer**: Buttons always visible on mobile
4. **Better spacing**: More breathing room on small screens
5. **Thumb-friendly**: Bottom sheet UI pattern

### Data Table Optimization

For data-heavy tables, use ResponsiveTable component (already exists):

```tsx
import { ResponsiveTable } from "@/components/shared/ResponsiveTable";

<ResponsiveTable
  headers={["Name", "Status", "Actions"]}
  data={items}
  renderRow={(item) => (
    <>
      <TableCell>{item.name}</TableCell>
      <TableCell><Badge>{item.status}</Badge></TableCell>
      <TableCell>
        <Button size="sm">View</Button>
      </TableCell>
    </>
  )}
  mobileCardRender={(item) => (
    <Card>
      <CardHeader>
        <CardTitle>{item.name}</CardTitle>
        <Badge>{item.status}</Badge>
      </CardHeader>
      <CardContent>
        <Button>View Details</Button>
      </CardContent>
    </Card>
  )}
/>
```

## Breakpoint Strategy

### Viewports:
- **Mobile**: < 768px (Tailwind `md` breakpoint)
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px (Tailwind `lg` breakpoint)

### CSS Breakpoints:
```css
/* Mobile-first approach */
.element {
  /* Mobile styles (default) */
  @apply text-base p-4;
}

/* Tablet */
@media (min-width: 768px) {
  .element {
    @apply text-sm p-3;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .element {
    @apply text-sm p-2;
  }
}
```

### Tailwind Classes:
```tsx
<div className="text-base md:text-sm lg:text-xs">
  Responsive text
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  Responsive grid
</div>
```

## Testing Checklist

When implementing mobile optimizations:

### Manual Testing:
- [ ] Test on mobile viewport (375x667 - iPhone SE)
- [ ] Test on tablet viewport (768x1024 - iPad)
- [ ] Test on desktop viewport (1920x1080)
- [ ] Verify touch targets are 44px+ minimum
- [ ] Check FAB doesn't overlap bottom nav
- [ ] Ensure forms are scrollable with sticky actions
- [ ] Verify no horizontal scroll on mobile

### E2E Testing:
```typescript
// Example test plan
1. [New Context] Mobile viewport (375x667)
2. [Browser] Navigate to page
3. [Verify] Bottom nav visible
4. [Verify] Dialog opens as bottom sheet
5. [Verify] Form fields are 48px+ height
6. [Verify] Submit button visible/sticky
7. [New Context] Desktop viewport (1920x1080)
8. [Verify] Sidebar visible (not bottom nav)
9. [Verify] Dialog opens as modal
10. [Verify] Desktop layout intact
```

## Common Patterns

### Pattern 1: Create/Edit Forms
```tsx
// Use ResponsiveDialog + mobile form classes
<ResponsiveDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  title={isEdit ? "Edit Item" : "Create Item"}
  footer={
    <div className="flex gap-2 w-full">
      <Button variant="outline" onClick={onCancel} className="flex-1">
        Cancel
      </Button>
      <Button onClick={onSubmit} className="flex-1">
        {isEdit ? "Save" : "Create"}
      </Button>
    </div>
  }
>
  {/* Form with mobile classes */}
</ResponsiveDialog>
```

### Pattern 2: Data Lists
```tsx
// Horizontal scroll on mobile, grid on desktop
<div className="mobile-scroll-container lg:overflow-visible">
  <div className="mobile-scroll-items lg:grid lg:grid-cols-3 lg:gap-6">
    {items.map(item => (
      <div key={item.id} className="mobile-scroll-item">
        <Card>{/* item */}</Card>
      </div>
    ))}
  </div>
</div>
```

### Pattern 3: Responsive Actions
```tsx
// Stack buttons on mobile, inline on desktop
<div className="flex flex-col gap-2 md:flex-row md:justify-end md:gap-0 md:space-x-2">
  <Button variant="outline" className="w-full md:w-auto">
    Cancel
  </Button>
  <Button className="w-full md:w-auto">
    Submit
  </Button>
</div>
```

## Performance Considerations

### useMediaQuery Performance:
- Uses native `matchMedia` API (very efficient)
- Only re-renders when viewport crosses breakpoint
- Automatic cleanup on unmount
- Safe for SSR/test environments

### ResponsiveDialog Performance:
- Only renders one component (Dialog OR Sheet, not both)
- No layout shift during resize
- Minimal re-renders

### CSS Utilities:
- All styles in `@layer components` for proper cascade
- Uses Tailwind's JIT for minimal CSS bundle
- No runtime JS for styling

## Migration Priority

### High Priority (Phase 3):
1. ✅ Work Orders - Critical operational flow
2. Hours of Rest - Compliance-critical table
3. Crew Scheduler - Complex scheduling UI
4. Inventory Management - Data-heavy forms

### Medium Priority (Phase 4):
1. Equipment Registry
2. Maintenance Templates
3. Sensor Configuration
4. Analytics Pages

### Low Priority:
1. Settings pages (already mostly responsive)
2. Read-only dashboards (horizontal scroll acceptable)

## Rollback Procedures

If mobile optimizations cause issues:

### Level 1 - Component Rollback (< 30 seconds):
```tsx
// Replace ResponsiveDialog with Dialog
import { Dialog, DialogContent } from "@/components/ui/dialog";
// Remove mobile-* CSS classes
```

### Level 2 - CSS Rollback (< 1 minute):
```bash
# Remove mobile CSS utilities from index.css
# Lines 292-327
```

### Level 3 - Full Rollback (< 3 minutes):
```bash
# Use Replit checkpoint restore
# Navigate to: More → Checkpoints → Select pre-mobile version
```

## Support

For issues or questions:
1. Check this guide first
2. Review test results in test logs
3. Check architect reviews in task history
4. Verify LSP diagnostics are clean

---

**Last Updated:** Phase 2 Complete
**Status:** ResponsiveDialog & mobile utilities production-ready
**Next:** Phase 3 - Apply patterns to data-heavy pages
