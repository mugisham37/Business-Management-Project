/**
 * Disaster Recovery Module - Business Continuity Management
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

export const DisasterRecoveryDashboard = lazy(() => 
  import('./components/DisasterRecoveryDashboard').then(module => ({
    default: module.DisasterRecoveryDashboard
  }))
);

export const RecoveryPlanning = lazy(() => 
  import('./components/RecoveryPlanning').then(module => ({
    default: module.RecoveryPlanning
  }))
);

export const FailoverManagement = lazy(() => 
  import('./components/FailoverManagement').then(module => ({
    default: module.FailoverManagement
  }))
);

export { useDisasterRecovery } from './hooks/useDisasterRecovery';
export { useFailoverOperations } from './hooks/useFailoverOperations';

export const disasterRecoveryModule = {
  name: 'Disaster Recovery',
  version: '1.0.0',
  description: 'Business continuity and disaster recovery management',
  components: { DisasterRecoveryDashboard, RecoveryPlanning, FailoverManagement },
  routes: ['/disaster-recovery', '/disaster-recovery/planning', '/disaster-recovery/failover'],
  permissions: ['disaster-recovery:read', 'disaster-recovery:admin'],
  businessTier: 'ENTERPRISE',
  dependencies: ['tenant', 'auth', 'backup'],
} as const;