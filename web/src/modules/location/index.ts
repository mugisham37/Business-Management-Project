/**
 * Location Module - Location and Geography Management
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

export const LocationDashboard = lazy(() => 
  import('./components/LocationDashboard').then(module => ({
    default: module.LocationDashboard
  }))
);

export const SiteManagement = lazy(() => 
  import('./components/SiteManagement').then(module => ({
    default: module.SiteManagement
  }))
);

export const GeographicView = lazy(() => 
  import('./components/GeographicView').then(module => ({
    default: module.GeographicView
  }))
);

export { useLocations } from './hooks/useLocations';
export { useGeography } from './hooks/useGeography';

export const locationModule = {
  name: 'Location Management',
  version: '1.0.0',
  description: 'Geographic locations and site management',
  components: { LocationDashboard, SiteManagement, GeographicView },
  routes: ['/location', '/location/sites', '/location/geography'],
  permissions: ['location:read', 'location:write'],
  businessTier: 'SMALL',
  dependencies: ['tenant', 'auth'],
} as const;