/**
 * Realtime Module - Real-time Data and Notifications
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

export const RealtimeDashboard = lazy(() => 
  import('./components/RealtimeDashboard').then(module => ({
    default: module.RealtimeDashboard
  }))
);

export const LiveDataView = lazy(() => 
  import('./components/LiveDataView').then(module => ({
    default: module.LiveDataView
  }))
);

export const NotificationCenter = lazy(() => 
  import('./components/NotificationCenter').then(module => ({
    default: module.NotificationCenter
  }))
);

export { useRealtime } from './hooks/useRealtime';
export { useLiveData } from './hooks/useLiveData';

export const realtimeModule = {
  name: 'Real-time Dashboard',
  version: '1.0.0',
  description: 'Real-time data monitoring and notifications',
  components: { RealtimeDashboard, LiveDataView, NotificationCenter },
  routes: ['/realtime', '/realtime/data', '/realtime/notifications'],
  permissions: ['realtime:read', 'realtime:write'],
  businessTier: 'MEDIUM',
  dependencies: ['tenant', 'auth'],
} as const;