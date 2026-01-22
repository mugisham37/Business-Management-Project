/**
 * Mobile Module - Mobile Application Management
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

export const MobileDashboard = lazy(() => 
  import('./components/MobileDashboard').then(module => ({
    default: module.MobileDashboard
  }))
);

export const AppManagement = lazy(() => 
  import('./components/AppManagement').then(module => ({
    default: module.AppManagement
  }))
);

export const DeviceManagement = lazy(() => 
  import('./components/DeviceManagement').then(module => ({
    default: module.DeviceManagement
  }))
);

export { useMobileApps } from './hooks/useMobileApps';
export { useDeviceManagement } from './hooks/useDeviceManagement';

export const mobileModule = {
  name: 'Mobile Management',
  version: '1.0.0',
  description: 'Mobile application and device management',
  components: { MobileDashboard, AppManagement, DeviceManagement },
  routes: ['/mobile', '/mobile/apps', '/mobile/devices'],
  permissions: ['mobile:read', 'mobile:write', 'mobile:admin'],
  businessTier: 'MEDIUM',
  dependencies: ['tenant', 'auth'],
} as const;