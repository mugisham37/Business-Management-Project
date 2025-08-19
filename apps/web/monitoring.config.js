// Web application monitoring configuration
module.exports = {
  // Performance monitoring configuration
  performance: {
    // Core Web Vitals thresholds
    thresholds: {
      // Largest Contentful Paint (LCP) - should be 2.5s or less
      lcp: 2500,
      // First Input Delay (FID) - should be 100ms or less
      fid: 100,
      // Cumulative Layout Shift (CLS) - should be 0.1 or less
      cls: 0.1,
      // First Contentful Paint (FCP) - should be 1.8s or less
      fcp: 1800,
      // Time to Interactive (TTI) - should be 3.8s or less
      tti: 3800,
    },

    // Bundle size thresholds (in KB)
    bundleSize: {
      // Main bundle should be under 250KB
      main: 250,
      // Vendor bundle should be under 500KB
      vendor: 500,
      // Individual chunks should be under 100KB
      chunk: 100,
    },

    // Performance budget
    budget: {
      // Total JavaScript size
      javascript: 500, // KB
      // Total CSS size
      css: 100, // KB
      // Total image size
      images: 1000, // KB
      // Total font size
      fonts: 200, // KB
    },
  },

  // Monitoring endpoints
  endpoints: {
    // Where to send performance metrics
    metrics: process.env.METRICS_ENDPOINT || 'http://localhost:9090/metrics',
    // Health check endpoint
    health: '/api/health',
    // Performance API endpoint
    performance: '/api/performance',
  },

  // Real User Monitoring (RUM) configuration
  rum: {
    enabled: process.env.NODE_ENV === 'production',
    sampleRate: 0.1, // Sample 10% of users
    trackInteractions: true,
    trackLongTasks: true,
    trackResources: true,
  },

  // Error tracking
  errorTracking: {
    enabled: true,
    sampleRate: 1.0, // Track all errors
    ignoreErrors: [
      // Common errors to ignore
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],
  },

  // Analytics
  analytics: {
    // Track page views
    pageViews: true,
    // Track user interactions
    interactions: true,
    // Track performance metrics
    performance: true,
    // Custom events
    customEvents: true,
  },
};
