# Performance Optimization Library

This library provides comprehensive performance optimization utilities for the Next.js GraphQL Foundation, implementing code splitting, lazy loading, bundle optimization, SSR/SSG strategies, and performance monitoring.

## Features

### 1. Module Loading and Code Splitting

**Module Loader** (`module-loader.ts`)
- Dynamic import utilities for 18+ business modules
- Lazy loading with error handling and fallback UI
- Module registry with permissions and business tier support
- Preloading capabilities for critical modules

```typescript
import { moduleLoader, LazyModule } from '@/lib/performance';

// Load a module dynamically
const warehouseModule = await moduleLoader.loadModule('warehouse');

// Use lazy module component
<LazyModule moduleName="warehouse">
  <WarehouseDashboard />
</LazyModule>
```

### 2. Route-Based Code Splitting

**Route Loader** (`route-loader.ts`)
- Route-based code splitting for Next.js app router
- Intelligent preloading based on navigation patterns
- Permission and business tier filtering
- Route registry with component mapping

```typescript
import { routeLoader } from '@/lib/performance';

// Load route component
const component = await routeLoader.loadRoute('/warehouse');

// Preload likely next routes
await routeLoader.preloadLikelyRoutes('/dashboard');
```

### 3. Bundle Analysis and Optimization

**Bundle Analyzer** (`bundle-analyzer.ts`)
- Runtime bundle analysis and optimization insights
- Chunk size monitoring and recommendations
- Bundle validation against size limits
- Development-mode bundle analysis integration

```typescript
import { useBundleAnalysis } from '@/lib/performance';

const { stats, analyze, recommendations } = useBundleAnalysis();
await analyze(); // Development mode only
```

**Tree Shaking** (`tree-shaking.ts`)
- Dead code elimination analysis
- Import optimization recommendations
- Unused import detection
- Webpack optimization suggestions

### 4. Asset Optimization

**Asset Optimizer** (`asset-optimizer.ts`)
- Optimized image component with lazy loading
- Automatic format selection (WebP, AVIF)
- Asset preloading utilities
- Performance metrics collection

```typescript
import { OptimizedImage, useAssetOptimization } from '@/lib/performance';

// Optimized image with lazy loading
<OptimizedImage
  src="/image.jpg"
  alt="Description"
  width={800}
  height={600}
  priority={false}
/>

// Asset optimization hook
const { metrics, preloadImage } = useAssetOptimization();
```

### 5. SSR/SSG Optimization

**SSR Optimizer** (`ssr-optimizer.ts`)
- Intelligent rendering strategy selection
- ISR (Incremental Static Regeneration) configuration
- Metadata generation for SEO
- Conditional rendering based on user context

```typescript
import { ssrOptimizer } from '@/lib/performance';

// Get rendering strategy
const strategy = ssrOptimizer.getRenderingStrategy('/dashboard', {
  isAuthenticated: true,
  permissions: ['dashboard:read']
});

// Generate metadata
export async function generateMetadata() {
  return ssrOptimizer.generateMetadata('/dashboard');
}
```

### 6. Performance Monitoring

**Performance Monitor** (`performance-monitor.ts`)
- Core Web Vitals tracking (LCP, FID, CLS)
- Custom performance metrics
- Real-time performance scoring
- Performance report generation

```typescript
import { usePerformanceMonitoring } from '@/lib/performance';

const {
  metrics,
  startMonitoring,
  getScore,
  recordModuleLoad
} = usePerformanceMonitoring();

// Record custom metrics
recordModuleLoad('warehouse', 1200); // 1.2 seconds
```

## Components

### LazyModule
Wrapper component for lazy loading business modules with error boundaries and loading states.

### PerformanceMetrics
Real-time performance metrics display (toggle with Ctrl+Shift+P in development).

### PerformanceDashboard
Comprehensive performance dashboard with metrics, recommendations, and bundle analysis.

### OptimizedImage
Image component with automatic optimization, lazy loading, and format selection.

## Configuration

### Next.js Configuration
The library integrates with Next.js configuration for:
- Advanced code splitting
- Bundle optimization
- Image optimization
- Performance headers

### Webpack Integration
- Custom chunk splitting strategies
- Bundle analyzer integration
- Tree shaking optimization
- Module concatenation

## Usage Examples

### Basic Setup

```typescript
// In your app layout
import { PerformanceMetrics } from '@/lib/performance';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <PerformanceMetrics />
      </body>
    </html>
  );
}
```

### Module Lazy Loading

```typescript
// In a page component
import { LazyModule } from '@/lib/performance';
import { WarehouseDashboard } from '@/modules/warehouse';

export default function WarehousePage() {
  return (
    <LazyModule moduleName="warehouse">
      <WarehouseDashboard />
    </LazyModule>
  );
}
```

### Performance Monitoring

```typescript
// In a component
import { usePerformanceMonitoring } from '@/lib/performance';

export function MyComponent() {
  const { startMonitoring, recordModuleLoad } = usePerformanceMonitoring();
  
  useEffect(() => {
    startMonitoring();
    
    const startTime = performance.now();
    // ... module loading logic
    const loadTime = performance.now() - startTime;
    recordModuleLoad('my-module', loadTime);
  }, []);
}
```

## Performance Thresholds

The library uses industry-standard performance thresholds:

- **LCP (Largest Contentful Paint)**: Good < 2.5s, Poor > 4s
- **FID (First Input Delay)**: Good < 100ms, Poor > 300ms
- **CLS (Cumulative Layout Shift)**: Good < 0.1, Poor > 0.25
- **Module Load Time**: Good < 1s, Poor > 3s
- **Route Change Time**: Good < 500ms, Poor > 1.5s

## Development Tools

### Bundle Analysis
Run `npm run build:analyze` to analyze bundle size and get optimization recommendations.

### Performance Metrics
Press `Ctrl+Shift+P` in development to toggle the performance metrics overlay.

### Tree Shaking Analysis
Use the `useTreeShakingAnalysis` hook to analyze import optimization opportunities.

## Best Practices

1. **Lazy Load Non-Critical Modules**: Use `LazyModule` for business modules that aren't immediately needed.

2. **Preload Critical Resources**: Use `assetPreloader` for images and modules that will be needed soon.

3. **Monitor Performance**: Regularly check Core Web Vitals and custom metrics.

4. **Optimize Images**: Use `OptimizedImage` component for automatic format selection and lazy loading.

5. **Choose Appropriate Rendering Strategy**: Use static generation for public pages, ISR for semi-dynamic content, and SSR for user-specific data.

6. **Clean Up Imports**: Regularly review and remove unused imports to improve tree shaking.

## Integration with Backend

The performance library is designed to work with the NestJS GraphQL backend:

- **Module Structure**: Frontend modules mirror backend business modules
- **Permissions**: Module loading respects user permissions from backend
- **Business Tiers**: Feature availability based on tenant business tier
- **Caching**: Respects backend Redis caching patterns

## Monitoring and Analytics

Performance metrics can be sent to monitoring services:

```typescript
// Example integration with monitoring service
const metrics = performanceMonitor.getMetrics();
analytics.track('performance_metrics', metrics);
```

## Future Enhancements

- Integration with Web Vitals API
- Advanced bundle splitting strategies
- Service Worker integration for offline performance
- Real-time performance alerts
- A/B testing for performance optimizations