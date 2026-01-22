/**
 * Communication Module - Messaging and Notifications
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

export const CommunicationDashboard = lazy(() => 
  import('./components/CommunicationDashboard').then(module => ({
    default: module.CommunicationDashboard
  }))
);

export const MessagingCenter = lazy(() => 
  import('./components/MessagingCenter').then(module => ({
    default: module.MessagingCenter
  }))
);

export const NotificationSettings = lazy(() => 
  import('./components/NotificationSettings').then(module => ({
    default: module.NotificationSettings
  }))
);

export { useCommunication } from './hooks/useCommunication';
export { useNotifications } from './hooks/useNotifications';

export const communicationModule = {
  name: 'Communication Center',
  version: '1.0.0',
  description: 'Internal and external communication management',
  components: { CommunicationDashboard, MessagingCenter, NotificationSettings },
  routes: ['/communication', '/communication/messages', '/communication/notifications'],
  permissions: ['communication:read', 'communication:write'],
  businessTier: 'SMALL',
  dependencies: ['tenant', 'auth'],
} as const;