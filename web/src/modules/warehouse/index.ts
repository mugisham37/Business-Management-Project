/**
 * Warehouse Module - Lazy loaded business module
 * Demonstrates module-based code splitting implementation
 */

import { lazy } from 'react';

// Lazy load components for better code splitting
export const WarehouseDashboard = lazy(() => 
  import('./components/WarehouseDashboard').then(module => ({
    default: module.WarehouseDashboard
  }))
);

export const InventoryView = lazy(() => 
  import('./components/InventoryView').then(module => ({
    default: module.InventoryView
  }))
);

export const ShippingView = lazy(() => 
  import('./components/ShippingView').then(module => ({
    default: module.ShippingView
  }))
);

// Export module metadata
export const warehouseModule = {
  name: 'Warehouse Management',
  version: '1.0.0',
  description: 'Comprehensive warehouse management system',
  components: {
    WarehouseDashboard,
    InventoryView,
    ShippingView,
  },
  routes: [
    '/warehouse',
    '/warehouse/inventory',
    '/warehouse/shipping',
  ],
  permissions: ['warehouse:read', 'warehouse:write'],
  businessTier: 'SMALL',
} as const;