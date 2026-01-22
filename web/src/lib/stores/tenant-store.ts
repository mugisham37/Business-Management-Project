/**
 * Tenant Store
 * Global state management for multi-tenant context using Zustand
 * Requirements: 6.1, 6.3, 6.6
 */

import { create } from 'zustand';
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware';
import { Tenant, TenantSettings, BusinessTier } from '@/types/core';

export interface TenantState {
  // Current tenant context
  currentTenant: Tenant | null;
  availableTenants: Tenant[];
  businessTier: BusinessTier;
  
  // Tenant switching
  isSwitching: boolean;
  switchError: string | null;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Cache management
  lastCacheCleared: Date | null;
}

export interface TenantActions {
  // Tenant management
  setCurrentTenant: (tenant: Tenant | null) => void;
  setAvailableTenants: (tenants: Tenant[]) => void;
  setBusinessTier: (tier: BusinessTier) => void;
  
  // Tenant switching
  setSwitching: (isSwitching: boolean) => void;
  setSwitchError: (error: string | null) => void;
  
  // Loading states
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Cache management
  markCacheCleared: () => void;
  
  // Composite actions
  switchTenant: (tenantId: string) => Promise<boolean>;
  initializeTenant: (tenant: Tenant, availableTenants: Tenant[]) => void;
  clearTenantData: () => void;
  
  // Validation
  validateTenantAccess: (tenantId: string) => boolean;
  isTierSufficient: (requiredTier: BusinessTier) => boolean;
  
  // State management
  reset: () => void;
}

export type TenantStore = TenantState & TenantActions;

const initialState: TenantState = {
  currentTenant: null,
  availableTenants: [],
  businessTier: 'MICRO',
  isSwitching: false,
  switchError: null,
  isLoading: false,
  error: null,
  lastCacheCleared: null,
};

/**
 * Business tier hierarchy for validation
 */
const TIER_HIERARCHY: Record<BusinessTier, number> = {
  'MICRO': 1,
  'SMALL': 2,
  'MEDIUM': 3,
  'ENTERPRISE': 4,
};

/**
 * Cross-tab synchronization storage for tenant data
 */
const tenantStorage = createJSONStorage(() => ({
  getItem: (name: string) => {
    const item = localStorage.getItem(name);
    if (!item) return null;
    
    try {
      return item;
    } catch {
      localStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    localStorage.setItem(name, value);
    
    // Broadcast tenant changes to other tabs
    window.dispatchEvent(new StorageEvent('storage', {
      key: name,
      newValue: value,
      storageArea: localStorage,
    }));
  },
  removeItem: (name: string) => {
    localStorage.removeItem(name);
    
    // Broadcast removal to other tabs
    window.dispatchEvent(new StorageEvent('storage', {
      key: name,
      newValue: null,
      storageArea: localStorage,
    }));
  },
}));

/**
 * Tenant Store
 * Manages global tenant context with persistence and cross-tab sync
 */
export const useTenantStore = create<TenantStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...initialState,

        // Basic setters
        setCurrentTenant: (tenant) => set((state) => ({
          ...state,
          currentTenant: tenant,
          businessTier: tenant?.businessTier || 'MICRO',
        })),

        setAvailableTenants: (tenants) => set((state) => ({
          ...state,
          availableTenants: tenants,
        })),

        setBusinessTier: (tier) => set((state) => ({
          ...state,
          businessTier: tier,
        })),

        setSwitching: (isSwitching) => set((state) => ({
          ...state,
          isSwitching,
        })),

        setSwitchError: (error) => set((state) => ({
          ...state,
          switchError: error,
        })),

        setLoading: (isLoading) => set((state) => ({
          ...state,
          isLoading,
        })),

        setError: (error) => set((state) => ({
          ...state,
          error,
        })),

        clearError: () => set((state) => ({
          ...state,
          error: null,
          switchError: null,
        })),

        markCacheCleared: () => set((state) => ({
          ...state,
          lastCacheCleared: new Date(),
        })),

        // Composite actions
        switchTenant: async (tenantId) => {
          const state = get();
          
          // Validate access
          if (!state.validateTenantAccess(tenantId)) {
            state.setSwitchError('Access denied to the specified tenant');
            return false;
          }

          state.setSwitching(true);
          state.clearError();

          try {
            // Find the target tenant
            const targetTenant = state.availableTenants.find(t => t.id === tenantId);
            if (!targetTenant) {
              throw new Error('Tenant not found');
            }

            // Update current tenant
            state.setCurrentTenant(targetTenant);
            
            // Mark cache as needing to be cleared
            state.markCacheCleared();

            return true;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to switch tenant';
            state.setSwitchError(errorMessage);
            return false;
          } finally {
            state.setSwitching(false);
          }
        },

        initializeTenant: (tenant, availableTenants) => set((state) => ({
          ...state,
          currentTenant: tenant,
          availableTenants,
          businessTier: tenant.businessTier,
          isLoading: false,
          error: null,
        })),

        clearTenantData: () => set((state) => ({
          ...state,
          currentTenant: null,
          availableTenants: [],
          businessTier: 'MICRO',
          isSwitching: false,
          switchError: null,
          error: null,
          lastCacheCleared: new Date(),
        })),

        // Validation methods
        validateTenantAccess: (tenantId) => {
          const state = get();
          return state.availableTenants.some(tenant => tenant.id === tenantId);
        },

        isTierSufficient: (requiredTier) => {
          const state = get();
          const currentTierLevel = TIER_HIERARCHY[state.businessTier];
          const requiredTierLevel = TIER_HIERARCHY[requiredTier];
          return currentTierLevel >= requiredTierLevel;
        },

        reset: () => set(() => ({ ...initialState })),
      }),
      {
        name: 'tenant-store',
        storage: tenantStorage,
        partialize: (state) => ({
          // Only persist essential tenant data
          currentTenant: state.currentTenant,
          availableTenants: state.availableTenants,
          businessTier: state.businessTier,
          lastCacheCleared: state.lastCacheCleared,
        }),
      }
    )
  )
);

/**
 * Tenant store selectors for optimized component subscriptions
 */
export const tenantSelectors = {
  currentTenant: (state: TenantStore) => state.currentTenant,
  availableTenants: (state: TenantStore) => state.availableTenants,
  businessTier: (state: TenantStore) => state.businessTier,
  isLoading: (state: TenantStore) => state.isLoading,
  isSwitching: (state: TenantStore) => state.isSwitching,
  error: (state: TenantStore) => state.error || state.switchError,
  tenantSettings: (state: TenantStore) => state.currentTenant?.settings || null,
  tenantBranding: (state: TenantStore) => state.currentTenant?.branding || null,
};

/**
 * Tenant utilities hook
 */
export const useTenantUtils = () => {
  const store = useTenantStore();
  
  return {
    // Tenant information
    getCurrentTenant: () => store.currentTenant,
    getBusinessTier: () => store.businessTier,
    getTenantSettings: () => store.currentTenant?.settings || null,
    
    // Tenant validation
    hasAccess: (tenantId: string) => store.validateTenantAccess(tenantId),
    canAccessTier: (requiredTier: BusinessTier) => store.isTierSufficient(requiredTier),
    
    // Tenant operations
    switchTenant: store.switchTenant,
    
    // State queries
    isCurrentTenant: (tenantId: string) => store.currentTenant?.id === tenantId,
    getTenantById: (tenantId: string) => 
      store.availableTenants.find(t => t.id === tenantId) || null,
  };
};

/**
 * Cross-tab synchronization setup
 */
if (typeof window !== 'undefined') {
  // Listen for storage events from other tabs
  window.addEventListener('storage', (event) => {
    if (event.key === 'tenant-store' && event.newValue !== event.oldValue) {
      // Force rehydration when tenant state changes in another tab
      useTenantStore.persist.rehydrate();
    }
  });
}