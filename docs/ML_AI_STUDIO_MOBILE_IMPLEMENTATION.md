# AI Studio Mobile-First Implementation Guide

## Overview

The Condition Monitoring AI Studio is built with a mobile-first approach, ensuring optimal user experience across all device sizes from iPhone SE (375px) to 4K desktops (1920px+).

## Responsive Breakpoints

### Mobile (< 768px)
- **Target Devices**: iPhone SE, iPhone 12/13/14, Android phones
- **Layout Strategy**: Single column, stacked components, card-based views
- **Touch Targets**: Minimum 44x44 pixels for all interactive elements
- **Navigation**: Collapsible sidebar, hamburger menu, vertical tabs

### Tablet (768px - 1024px)
- **Target Devices**: iPad, iPad Pro, Android tablets
- **Layout Strategy**: Two-column grids where appropriate, responsive tables
- **Touch Targets**: Minimum 44x44 pixels maintained
- **Navigation**: Expanded sidebar, horizontal tabs visible

### Desktop (1024px+)
- **Target Devices**: Laptops, desktops, large monitors
- **Layout Strategy**: Multi-column layouts, full-width tables, side-by-side panels
- **Navigation**: Persistent sidebar, horizontal tabs, enhanced hover states

## Component-Specific Mobile Adaptations

### ModelTable
**Desktop (≥768px)**:
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Model Name</TableHead>
      <TableHead>Type</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Accuracy</TableHead>
      <TableHead>Trained On</TableHead>
      <TableHead>Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {/* Row data */}
  </TableBody>
</Table>
```

**Mobile (<768px)**:
```tsx
<div className="grid gap-4">
  {models.map((model) => (
    <Card key={model.id} className="cursor-pointer">
      <CardHeader>
        <CardTitle>{model.name}</CardTitle>
        <StatusBadge status={model.status} />
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div>Type: {model.type}</div>
          <div>Accuracy: {model.accuracy}%</div>
          <div>Trained: {format(model.trainedOn, 'MMM d, yyyy')}</div>
        </div>
      </CardContent>
    </Card>
  ))}
</div>
```

**Implementation**: Uses CSS media queries with `hidden md:table` and `md:hidden` classes to toggle between table and card layouts.

### TabbedDashboard
**Desktop**: Horizontal tab list with full labels
**Mobile**: Scrollable horizontal tabs with icons, compact labels

```tsx
<Tabs defaultValue="models" className="w-full">
  <TabsList className="w-full overflow-x-auto flex-nowrap">
    <TabsTrigger value="models" className="flex items-center gap-2">
      <List className="h-4 w-4" />
      <span className="hidden sm:inline">Model Management</span>
      <span className="sm:hidden">Models</span>
    </TabsTrigger>
    {/* Other tabs */}
  </TabsList>
</Tabs>
```

### ModelTrainingForm
**Desktop**: Side-by-side form fields, inline validation
**Mobile**: Stacked fields, full-width inputs

```tsx
<div className="grid gap-4 md:grid-cols-2">
  <FormField name="equipmentType" />
  <FormField name="algorithm" />
</div>
<div className="w-full">
  <FormField name="dataWindowDays" className="w-full" />
</div>
```

### DataWindowPreset Cards
**Desktop**: 4 cards in a row (grid-cols-4)
**Mobile**: 2 cards per row (grid-cols-2)

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <DataWindowPreset tier="bronze" days={90} />
  <DataWindowPreset tier="silver" days={180} />
  <DataWindowPreset tier="gold" days={365} />
  <DataWindowPreset tier="platinum" days={730} />
</div>
```

### AcousticAnalysisPanel
**Desktop**: Side-by-side charts (waveform + FFT)
**Mobile**: Stacked charts, full-width visualization

```tsx
<div className="grid gap-6 md:grid-cols-2">
  <Card>
    <CardHeader><CardTitle>Waveform</CardTitle></CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={waveformData}>
          {/* Chart configuration */}
        </LineChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
  <Card>
    <CardHeader><CardTitle>FFT Spectrum</CardTitle></CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={fftData}>
          {/* Chart configuration */}
        </LineChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
</div>
```

## Tailwind CSS Utilities Used

### Responsive Display
- `hidden md:block` - Hide on mobile, show on desktop
- `md:hidden` - Show on mobile, hide on desktop
- `flex md:grid` - Flex on mobile, grid on desktop

### Responsive Grids
- `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` - Adaptive column counts
- `gap-4 md:gap-6` - Responsive spacing

### Responsive Typography
- `text-sm md:text-base` - Smaller text on mobile
- `text-lg md:text-xl lg:text-2xl` - Adaptive heading sizes

### Responsive Spacing
- `p-4 md:p-6` - Responsive padding
- `space-y-4 md:space-y-6` - Adaptive vertical spacing

## Touch Interaction Guidelines

### Touch Target Sizing
All interactive elements meet WCAG 2.1 AA standards:
- **Buttons**: Minimum 44x44 pixels
- **Links**: Minimum 44x44 pixels with adequate padding
- **Form Inputs**: Minimum 44px height
- **Tab Triggers**: Minimum 44px height

### Touch Feedback
- **Hover States**: Preserved for desktop, enhanced for touch devices
- **Active States**: Clear visual feedback on tap
- **Focus States**: Keyboard navigation support with visible focus rings

## Performance Considerations

### Image Optimization
- Responsive images with `srcset` for different screen densities
- Lazy loading for below-the-fold content
- WebP format with fallbacks

### Code Splitting
- Lazy loading of heavy components (charts, modals)
- Route-based code splitting with React.lazy()
- Dynamic imports for large libraries

### Viewport Management
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
```

## Accessibility (a11y) Compliance

### Screen Readers
- Semantic HTML5 elements
- ARIA labels for interactive elements
- Alt text for all images
- Role attributes for custom components

### Keyboard Navigation
- Tab order follows logical flow
- Escape key closes modals
- Arrow keys navigate lists and tabs
- Enter/Space activates buttons

### Color Contrast
- WCAG 2.1 AA compliant (4.5:1 minimum for normal text)
- High contrast mode support
- Non-color indicators for status (icons + text)

## Testing Checklist

### Device Testing
- ✅ iPhone SE (375x667)
- ✅ iPhone 12 Pro (390x844)
- ✅ iPad (768x1024)
- ✅ iPad Pro (1024x1366)
- ✅ Desktop (1920x1080)

### Orientation Testing
- ✅ Portrait mode
- ✅ Landscape mode
- ✅ Orientation change handling

### Browser Testing
- ✅ Safari (iOS/macOS)
- ✅ Chrome (Android/Windows)
- ✅ Firefox (Desktop)
- ✅ Edge (Windows)

## Known Limitations

### Mobile-Specific
1. **Chart Interactions**: Complex hover tooltips may be challenging on touch devices
   - **Solution**: Implemented tap-to-view tooltip behavior
   
2. **Large Data Tables**: Extensive model lists may require pagination
   - **Solution**: Card view with infinite scroll on mobile

3. **File Upload**: Native camera access not yet implemented
   - **Future Enhancement**: Add camera capture for acoustic analysis

### Performance
1. **Chart Rendering**: Large datasets (>1000 points) may cause lag on older devices
   - **Solution**: Data decimation, canvas rendering optimization

2. **Memory Usage**: Multiple charts may impact low-end devices
   - **Solution**: Unmount off-screen charts, lazy load visualizations

## Future Enhancements

### Phase 2 Improvements
1. **Progressive Web App (PWA)**
   - Offline mode for critical features
   - Install to home screen
   - Push notifications for model completion

2. **Gesture Support**
   - Swipe to navigate tabs
   - Pinch to zoom charts
   - Pull to refresh data

3. **Haptic Feedback**
   - Vibration on form submission
   - Tactile feedback for errors
   - Success confirmation vibrations

### Phase 3 Mobile Optimizations
1. **Network Awareness**
   - Detect slow connections
   - Reduce data transfer on 3G/4G
   - Offline-first architecture

2. **Battery Optimization**
   - Reduce animation on low battery
   - Throttle background updates
   - Efficient WebSocket management

## Component Library Integration

All components use `shadcn/ui` which provides:
- Built-in responsive behavior
- Consistent Tailwind utility patterns
- Accessibility best practices
- Dark mode support

## Conclusion

The AI Studio is production-ready for mobile deployment with:
- ✅ 100% mobile-responsive components
- ✅ Touch-optimized interactions
- ✅ WCAG 2.1 AA accessibility
- ✅ Performance optimized for all devices
- ✅ Cross-browser compatibility

The mobile-first architecture ensures marine operators can access predictive maintenance insights anytime, anywhere, on any device.
