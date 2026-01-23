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

// Export hooks
export {
  useInventoryLevel,
  useInventoryLevels,
  useInventoryHistory,
  useInventoryTransfer,
  useInventoryReservation,
  useInventorySummary,
  useLowStockItems,
  useOutOfStockItems,
  useInventorySubscriptions,
  useInventoryManagement,
} from '@/hooks/useInventory';

export {
  useProduct,
  useProducts,
  useProductSearch,
  useFeaturedProducts,
  useProductSubscriptions,
  useProductManagement,
} from '@/hooks/useProducts';

export {
  useCategory,
  useCategoryBySlug,
  useCategories,
  useCategoryTree,
  useCategorySearch,
  useCategoryManagement,
} from '@/hooks/useCategories';

export {
  useBrand,
  useBrandBySlug,
  useBrands,
  useBrandSearch,
  usePopularBrands,
  useBrandManagement,
} from '@/hooks/useBrands';

export {
  useBatchTracking,
  useBatchTrackings,
  useExpiringBatches,
  useFIFOBatches,
  useBatchSubscriptions,
  useBatchTrackingManagement,
} from '@/hooks/useBatchTracking';

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