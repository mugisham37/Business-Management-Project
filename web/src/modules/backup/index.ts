/**
 * Backup Module - Data Backup and Recovery
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

// Lazy load components for better code splitting
export const BackupDashboard = lazy(() => 
  import('./components/BackupDashboard').then(module => ({
    default: module.BackupDashboard
  }))
);

export const BackupScheduler = lazy(() => 
  import('./components/BackupScheduler').then(module => ({
    default: module.BackupScheduler
  }))
);

export const RestoreManager = lazy(() => 
  import('./components/RestoreManager').then(module => ({
    default: module.RestoreManager
  }))
);

// Export hooks
export { useBackupOperations } from './hooks/useBackupOperations';
export { useRestoreOperations } from './hooks/useRestoreOperations';

// Export module metadata
export const backupModule = {
  name: 'Backup & Recovery',
  version: '1.0.0',
  description: 'Data backup and disaster recovery management',
  components: {
    BackupDashboard,
    BackupScheduler,
    RestoreManager,
  },
  routes: [
    '/backup',
    '/backup/schedule',
    '/backup/restore',
  ],
  permissions: ['backup:read', 'backup:write', 'backup:admin'],
  businessTier: 'ENTERPRISE',
  dependencies: ['tenant', 'auth', 'security'],
} as const;

export const BACKUP_MODULE_CONFIG = {
  name: 'backup',
  displayName: 'Backup & Recovery',
  description: 'Automated data backup and disaster recovery management',
  version: '1.0.0',
  features: [
    'Automated backups',
    'Scheduled operations',
    'Point-in-time recovery',
    'Cross-region replication',
    'Encryption at rest',
    'Compliance reporting',
  ],
  dependencies: [
    '@apollo/client',
    'react',
  ],
  permissions: [
    'backup:read',
    'backup:write',
    'backup:admin',
  ],
};