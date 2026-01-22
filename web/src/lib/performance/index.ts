/**
 * Performance Optimization Library
 * Exports all performance-related utilities and components
 */

// Module loading and code splitting
export {
  moduleLoader,
  MODULE_REGISTRY,
  type ModuleConfig,
  type LoadedModule,
} from './module-loader';

// Route-based code splitting
export {
  routeLoader,
  ROUTE_REGISTRY,
  type RouteConfig,
} from './route-loader';

// Bundle analysis and optimization
export {
  bundleAnalyzer,
  useBundleAnalysis,
  type BundleStats,
  type ChunkInfo,
  type ModuleInfo,
  type OptimizationRecommendation,
} from './bundle-analyzer';

// SSR/SSG optimization
export {
  ssrOptimizer,
  useSSROptimization,
  PAGE_CONFIGS,
  type SSRConfig,
  type PageConfig,
  type SSRCondition,
} from './ssr-optimizer';

// Performance monitoring
export {
  performanceMonitor,
  usePerformanceMonitoring,
  DEFAULT_THRESHOLDS,
  type PerformanceMetrics,
  type PerformanceThresholds,
} from './performance-monitor';

// Asset optimization
export {
  OptimizedImage,
  assetPreloader,
  assetMetricsCollector,
  useAssetOptimization,
  type ImageOptimizationConfig,
  type AssetMetrics,
} from './asset-optimizer';

// Tree shaking and dead code elimination
export {
  treeShakingAnalyzer,
  ImportOptimizer,
  useTreeShakingAnalysis,
  type ImportAnalysis,
  type TreeShakingReport,
} from './tree-shaking';

// Re-export components
export { LazyModule, useLazyModule } from '@/components/common/LazyModule';
export { LoadingSpinner } from '@/components/common/LoadingSpinner';
export { ModuleErrorFallback } from '@/components/common/ModuleErrorFallback';
export { PerformanceDashboard } from '@/components/performance/PerformanceDashboard';
export { PerformanceMetrics } from '@/components/performance/PerformanceMetrics';