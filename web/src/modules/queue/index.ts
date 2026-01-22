/**
 * Queue Module - Queue and Job Management
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

export const QueueDashboard = lazy(() => 
  import('./components/QueueDashboard').then(module => ({
    default: module.QueueDashboard
  }))
);

export const JobManagement = lazy(() => 
  import('./components/JobManagement').then(module => ({
    default: module.JobManagement
  }))
);

export const WorkerMonitoring = lazy(() => 
  import('./components/WorkerMonitoring').then(module => ({
    default: module.WorkerMonitoring
  }))
);

export { useQueues } from './hooks/useQueues';
export { useJobs } from './hooks/useJobs';

export const queueModule = {
  name: 'Queue Management',
  version: '1.0.0',
  description: 'Background job and queue management',
  components: { QueueDashboard, JobManagement, WorkerMonitoring },
  routes: ['/queue', '/queue/jobs', '/queue/workers'],
  permissions: ['queue:read', 'queue:write', 'queue:admin'],
  businessTier: 'MEDIUM',
  dependencies: ['tenant', 'auth'],
} as const;