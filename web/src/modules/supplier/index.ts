/**
 * Supplier Module - Supplier and Vendor Management
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

export const SupplierDashboard = lazy(() => 
  import('./components/SupplierDashboard').then(module => ({
    default: module.SupplierDashboard
  }))
);

export const VendorManagement = lazy(() => 
  import('./components/VendorManagement').then(module => ({
    default: module.VendorManagement
  }))
);

export const ProcurementView = lazy(() => 
  import('./components/ProcurementView').then(module => ({
    default: module.ProcurementView
  }))
);

export { useSuppliers } from './hooks/useSuppliers';
export { useProcurement } from './hooks/useProcurement';

export const supplierModule = {
  name: 'Supplier Management',
  version: '1.0.0',
  description: 'Supplier and vendor relationship management',
  components: { SupplierDashboard, VendorManagement, ProcurementView },
  routes: ['/supplier', '/supplier/vendors', '/supplier/procurement'],
  permissions: ['supplier:read', 'supplier:write'],
  businessTier: 'SMALL',
  dependencies: ['tenant', 'auth'],
} as const;