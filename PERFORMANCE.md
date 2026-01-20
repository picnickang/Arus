# Performance Guidelines & Bundle Size Monitoring

## Performance Budgets

### Initial Bundle Sizes (Target)

- **Main Bundle**: < 250 KB (gzipped)
- **Vendor Bundle**: < 400 KB (gzipped)
- **Total Initial Load**: < 650 KB (gzipped)
- **Per-Route Chunks**: < 150 KB (gzipped)

### Lazy Loading Strategy

**Eager Load (Critical Path)**:

- Dashboard (most common route)
- Core UI components (Sidebar, Navigation)
- Shared contexts and providers

**Lazy Load (On-Demand)**:

- All secondary pages (Analytics, Sensors, Configuration, etc.)
- Admin pages
- Settings and management pages

### Current Implementation

We use `React.lazy()` and `Suspense` to implement code splitting:

```typescript
// Eager load critical routes
import Dashboard from "@/pages/dashboard-improved";

// Lazy load everything else
const AnalyticsHub = lazy(() => import("@/pages/analytics-hub"));
const SensorsHub = lazy(() => import("@/pages/sensors-hub"));
// ... etc

// Wrap routes in Suspense
<Suspense fallback={<PageLoader />}>
  <Switch>
    <Route path="/" component={Dashboard} />
    <Route path="/analytics" component={AnalyticsHub} />
    {/* ... */}
  </Switch>
</Suspense>
```

## Monitoring Bundle Size

### Manual Monitoring

1. **Build and analyze**:

   ```bash
   npm run build
   ls -lh dist/public/assets/*.js
   ```

2. **Check for large chunks**:

   ```bash
   find dist/public/assets -name "*.js" -size +500k
   ```

3. **Gzip sizes** (more accurate for production):
   ```bash
   find dist/public/assets -name "*.js" -exec gzip -c {} \; -exec ls -lh {}.gz \; -exec rm {}.gz \;
   ```

### Automated Monitoring (Recommended)

Add to CI/CD pipeline:

```bash
#!/bin/bash
# Check bundle sizes against budgets

MAX_MAIN_BUNDLE=256000  # 250KB gzipped
MAX_VENDOR_BUNDLE=409600  # 400KB gzipped

# Build
npm run build

# Find largest bundles
MAIN_SIZE=$(find dist/public/assets -name "index-*.js" -exec gzip -c {} \; | wc -c)
VENDOR_SIZE=$(find dist/public/assets -name "vendor-*.js" -exec gzip -c {} \; | wc -c)

# Check against budgets
if [ "$MAIN_SIZE" -gt "$MAX_MAIN_BUNDLE" ]; then
  echo "❌ Main bundle ($MAIN_SIZE bytes) exceeds budget ($MAX_MAIN_BUNDLE bytes)"
  exit 1
fi

if [ "$VENDOR_SIZE" -gt "$MAX_VENDOR_BUNDLE" ]; then
  echo "❌ Vendor bundle ($VENDOR_SIZE bytes) exceeds budget ($MAX_VENDOR_BUNDLE bytes)"
  exit 1
fi

echo "✅ All bundles within budget"
```

## Performance Optimization Checklist

### Frontend Optimizations

- [x] Lazy loading for route components
- [x] Code splitting via React.lazy()
- [x] Suspense boundaries for loading states
- [ ] Image optimization (WebP, lazy loading)
- [ ] Virtual scrolling for large lists (>100 items)
- [ ] Memoization for expensive computations
- [ ] Service worker for offline caching (PWA)

### Backend Optimizations

- [x] Database indexing on frequent queries
- [x] Rate limiting on API endpoints
- [ ] Response compression (gzip/brotli)
- [ ] CDN for static assets
- [ ] Database connection pooling
- [ ] Query result caching (Redis)

### Network Optimizations

- [x] TanStack Query for request deduplication
- [x] WebSocket for real-time updates (reduces polling)
- [ ] HTTP/2 server push for critical resources
- [ ] Preconnect to external APIs
- [ ] DNS prefetch for third-party domains

## Performance Monitoring in Production

### Core Web Vitals Targets

- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1

### Monitoring Tools

**Recommended**:

- Lighthouse CI for automated testing
- Web Vitals library for real-user monitoring
- Sentry for performance tracking

**Quick Lighthouse Check**:

```bash
npx lighthouse https://your-app.replit.app --view
```

## Bundle Analysis

### Using Rollup Plugin Visualizer (Optional)

If you need detailed bundle analysis, add to package.json:

```json
{
  "devDependencies": {
    "rollup-plugin-visualizer": "^5.x.x"
  }
}
```

Then run:

```bash
npx vite build --mode analyze
```

This generates `stats.html` showing:

- Bundle composition
- Largest dependencies
- Duplicate modules
- Code splitting effectiveness

## Action Items When Budget is Exceeded

### If Main Bundle > 250KB:

1. Check for accidentally eager-loaded pages
2. Move large libraries to lazy-loaded routes
3. Consider splitting large pages into tabs

### If Vendor Bundle > 400KB:

1. Audit dependencies with `npm list`
2. Find alternatives to large libraries
3. Use tree-shaking compatible imports
4. Remove unused dependencies

### If Route Chunk > 150KB:

1. Split into multiple routes/tabs
2. Lazy load charts/visualizations within the page
3. Extract shared code to common chunks

## Performance Testing Commands

```bash
# Build with source maps for analysis
npm run build -- --mode production --sourcemap

# Check gzipped sizes
du -h dist/public/assets/*.js | sort -h

# Find duplicate code across chunks
npx source-map-explorer dist/public/assets/*.js

# Lighthouse performance audit
npx lighthouse https://your-app.replit.app \
  --only-categories=performance \
  --output=html \
  --output-path=./lighthouse-report.html
```

## Continuous Improvement

### Monthly Review

- [ ] Run bundle size analysis
- [ ] Check Core Web Vitals in production
- [ ] Review largest dependencies
- [ ] Identify optimization opportunities

### Before Major Releases

- [ ] Full Lighthouse audit (Performance, A11y, Best Practices, SEO)
- [ ] Bundle size comparison with previous version
- [ ] Load testing for backend endpoints
- [ ] Performance regression testing

---

**Last Updated**: 2025-10-27
**Target Review Date**: 2025-11-27
