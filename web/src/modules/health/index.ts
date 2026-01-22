/**
 * Health Module - System Health Monitoring
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

export const HealthDashboard = lazy(() => 
  import('./components/HealthDashboard').then(module => ({
    default: module.HealthDashboard
  }))
);

export const SystemMonitoring = lazy(() => 
  import('./components/SystemMonitoring').then(module => ({
    default: module.SystemMonitoring
  }))
);

export const AlertsManagement = lazy(() => 
  import('./components/AlertsManagement').then(module => ({
    default: module.AlertsManagement
  }))
);

export { useHealthMonitoring } from './hooks/useHealthMonitoring';
export { useSystemAlerts } from './hooks/useSystemAlerts';

export const healthModule = {
  name: 'Health Monitoring',
  version: '1.0.0',
  description: 'System health and performance monitoring',
  components: { HealthDashboard, SystemMonitoring, AlertsManagement },
  routes: ['/health', '/health/monitoring', '/health/alerts'],
  permissions: ['health:read', 'health:admin'],
  businessTier: 'ENTERPRISE',
  dependencies: ['tenant', 'auth'],
} as const;