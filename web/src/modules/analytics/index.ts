/**
 * Analytics Module - Business Intelligence and Reporting
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

// Lazy load components for better code splitting
export const AnalyticsDashboard = lazy(() => 
  import('./components/AnalyticsDashboard').then(module => ({
    default: module.AnalyticsDashboard
  }))
);

export const ReportsView = lazy(() => 
  import('./components/ReportsView').then(module => ({
    default: module.ReportsView
  }))
);

export const MetricsView = lazy(() => 
  import('./components/MetricsView').then(module => ({
    default: module.MetricsView
  }))
);

// Export hooks
export { useAnalytics } from './hooks/useAnalytics';
export { useReports } from './hooks/useReports';

// Export module metadata
export const analyticsModule = {
  name: 'Analytics & Reporting',
  version: '1.0.0',
  description: 'Business intelligence and analytics platform',
  components: {
    AnalyticsDashboard,
    ReportsView,
    MetricsView,
  },
  routes: [
    '/analytics',
    '/analytics/reports',
    '/analytics/metrics',
  ],
  permissions: ['analytics:read', 'analytics:write'],
  businessTier: 'MEDIUM',
  dependencies: ['tenant', 'auth'],
} as const;

export const ANALYTICS_MODULE_CONFIG = {
  name: 'analytics',
  displayName: 'Analytics & Reporting',
  description: 'Business intelligence and analytics platform with real-time metrics',
  version: '1.0.0',
  features: [
    'Real-time business metrics',
    'Custom report generation',
    'Data visualization',
    'Export capabilities',
    'Scheduled reports',
    'Multi-tenant analytics',
  ],
  dependencies: [
    '@apollo/client',
    'react',
    'recharts',
  ],
  permissions: [
    'analytics:read',
    'analytics:write',
    'analytics:admin',
  ],
};