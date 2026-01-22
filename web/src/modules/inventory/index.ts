/**
 * Inventory Module - Inventory Management System
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

export const InventoryDashboard = lazy(() => 
  import('./components/InventoryDashboard').then(module => ({
    default: module.InventoryDashboard
  }))
);

export const StockManagement = lazy(() => 
  import('./components/StockManagement').then(module => ({
    default: module.StockManagement
  }))
);

export const ProductCatalog = lazy(() => 
  import('./components/ProductCatalog').then(module => ({
    default: module.ProductCatalog
  }))
);

export { useInventory } from './hooks/useInventory';
export { useProducts } from './hooks/useProducts';

export const inventoryModule = {
  name: 'Inventory Management',
  version: '1.0.0',
  description: 'Product inventory and stock management',
  components: { InventoryDashboard, StockManagement, ProductCatalog },
  routes: ['/inventory', '/inventory/stock', '/inventory/catalog'],
  permissions: ['inventory:read', 'inventory:write'],
  businessTier: 'MICRO',
  dependencies: ['tenant', 'auth'],
} as const;