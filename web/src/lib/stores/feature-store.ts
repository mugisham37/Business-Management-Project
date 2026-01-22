/**
 * Feature Flag Store
 * Global state management for feature flags using Zustand
 * Requirements: 6.1, 6.3, 6.6
 */

import { create } from 'zustand';
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware';
import { FeatureFlag, BusinessTier } from '@/types/core';

export interface FeatureConfig {
  enabled: boolean;
  config: Record<string, unknown>;
  requiredTier: BusinessTier;
}

export interface FeatureState {
  // Feature flags
  features: FeatureFlag[];
  
  // Cache management
  featureCache: Map<string, FeatureConfig>;
  lastUpdated: Date | null;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Refresh tracking
  refreshCount: number;
}

export interface FeatureActions {
  // Feature management
  setFeatures: (features: FeatureFlag[]) => void;
  updateFeature: (key: string, updates: Partial<FeatureFlag>) => void;
  
  // Cache management
  clearFeatureCache: () => void;
  cacheFeature: (key: string, config: FeatureConfig) => void;
  
  // Loading states
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Feature queries
  hasFeature: (key: string, businessTier: BusinessTier) => boolean;
  getFeatureConfig: (key: string) => FeatureConfig | null;
  getAvailableFeatures: (businessTier: BusinessTier) => FeatureFlag[];
  
  // Refresh management
  markRefreshed: () => void;
  
  // State management
  reset: () => void;
}

export type FeatureStore = FeatureState & FeatureActions;

const initialState: FeatureState = {
  features: [],
  featureCache: new Map(),
  lastUpdated: null,
  isLoading: false,
  error: null,
  refreshCount: 0,
};

/**
 * Business tier hierarchy for feature validation
 */
const TIER_HIERARCHY: Record<BusinessTier, number> = {
  'MICRO': 1,
  'SMALL': 2,
  'MEDIUM': 3,
  'ENTERPRISE': 4,
};

/**
 * Feature store with persistence (excluding cache Map)
 */
export const useFeatureStore = create<FeatureStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...initialState,

        // Basic setters
        setFeatures: (features) => set((state) => ({
          ...state,
          features,
          lastUpdated: new Date(),
          featureCache: new Map(), // Clear cache when features are updated
        })),

        updateFeature: (key, updates) => set((state) => {
          const featureIndex = state.features.findIndex(f => f.key === key);
          if (featureIndex >= 0) {
            const updatedFeatures = [...state.features];
            const currentFeature = updatedFeatures[featureIndex];
            if (currentFeature) {
              updatedFeatures[featureIndex] = { 
                key: currentFeature.key,
                enabled: currentFeature.enabled,
                config: currentFeature.config,
                requiredTier: currentFeature.requiredTier,
                ...updates,
              };
              
              const newCache = new Map(state.featureCache);
              newCache.delete(key); // Remove from cache to force recalculation
              
              return {
                ...state,
                features: updatedFeatures,
                featureCache: newCache,
                lastUpdated: new Date(),
              };
            }
          }
          return state;
        }),

        clearFeatureCache: () => set((state) => ({
          ...state,
          featureCache: new Map(),
        })),

        cacheFeature: (key, config) => set((state) => {
          const newCache = new Map(state.featureCache);
          newCache.set(key, config);
          return {
            ...state,
            featureCache: newCache,
          };
        }),

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
        })),

        markRefreshed: () => set((state) => ({
          ...state,
          refreshCount: state.refreshCount + 1,
          lastUpdated: new Date(),
        })),

        // Feature query methods
        hasFeature: (key, businessTier) => {
          const state = get();
          const config = state.getFeatureConfig(key);
          
          if (!config) return false;
          
          // Check if feature is enabled
          if (!config.enabled) return false;
          
          // Check if business tier is sufficient
          const currentTierLevel = TIER_HIERARCHY[businessTier];
          const requiredTierLevel = TIER_HIERARCHY[config.requiredTier];
          
          return currentTierLevel >= requiredTierLevel;
        },

        getFeatureConfig: (key) => {
          const state = get();
          
          // Check cache first
          if (state.featureCache.has(key)) {
            return state.featureCache.get(key)!;
          }

          // Find feature in current state
          const feature = state.features.find(f => f.key === key);
          if (!feature) {
            return null;
          }

          const config: FeatureConfig = {
            enabled: feature.enabled,
            config: feature.config,
            requiredTier: feature.requiredTier,
          };

          // Cache the result
          state.cacheFeature(key, config);
          return config;
        },

        getAvailableFeatures: (businessTier) => {
          const state = get();
          const currentTierLevel = TIER_HIERARCHY[businessTier];
          
          return state.features.filter(feature => {
            const requiredTierLevel = TIER_HIERARCHY[feature.requiredTier];
            return feature.enabled && currentTierLevel >= requiredTierLevel;
          });
        },

        reset: () => set(() => ({
          ...initialState,
          featureCache: new Map(), // Reset the Map properly
        })),
      }),
      {
        name: 'feature-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          // Only persist features and metadata, not the cache Map
          features: state.features,
          lastUpdated: state.lastUpdated,
          refreshCount: state.refreshCount,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Reinitialize the cache Map after rehydration
            state.featureCache = new Map();
          }
        },
      }
    )
  )
);

/**
 * Feature store selectors for optimized component subscriptions
 */
export const featureSelectors = {
  features: (state: FeatureStore) => state.features,
  isLoading: (state: FeatureStore) => state.isLoading,
  error: (state: FeatureStore) => state.error,
  lastUpdated: (state: FeatureStore) => state.lastUpdated,
  refreshCount: (state: FeatureStore) => state.refreshCount,
};

/**
 * Feature utilities hook
 */
export const useFeatureUtils = () => {
  const store = useFeatureStore();
  
  return {
    // Feature queries
    hasFeature: (key: string, businessTier: BusinessTier) => 
      store.hasFeature(key, businessTier),
    
    getFeatureConfig: (key: string) => store.getFeatureConfig(key),
    
    getAvailableFeatures: (businessTier: BusinessTier) => 
      store.getAvailableFeatures(businessTier),
    
    // Feature checks with default values
    isFeatureEnabled: (key: string, businessTier: BusinessTier, defaultValue = false) => {
      const config = store.getFeatureConfig(key);
      if (!config) return defaultValue;
      
      const currentTierLevel = TIER_HIERARCHY[businessTier];
      const requiredTierLevel = TIER_HIERARCHY[config.requiredTier];
      
      return config.enabled && currentTierLevel >= requiredTierLevel;
    },
    
    // Feature configuration access
    getFeatureValue: <T = unknown>(key: string, configKey: string, defaultValue?: T): T => {
      const config = store.getFeatureConfig(key);
      if (!config || !config.config) return defaultValue as T;
      
      return (config.config[configKey] as T) ?? defaultValue as T;
    },
    
    // Bulk feature checks
    hasAnyFeature: (keys: string[], businessTier: BusinessTier) =>
      keys.some(key => store.hasFeature(key, businessTier)),
    
    hasAllFeatures: (keys: string[], businessTier: BusinessTier) =>
      keys.every(key => store.hasFeature(key, businessTier)),
  };
};

/**
 * Feature flag hook for specific features
 */
export const useFeatureFlag = (key: string, businessTier: BusinessTier) => {
  const hasFeature = useFeatureStore(state => state.hasFeature(key, businessTier));
  const config = useFeatureStore(state => state.getFeatureConfig(key));
  const isLoading = useFeatureStore(featureSelectors.isLoading);
  
  return {
    enabled: hasFeature,
    config: config?.config || {},
    isLoading,
    exists: config !== null,
  };
};

/**
 * Cross-tab synchronization setup
 */
if (typeof window !== 'undefined') {
  // Listen for storage events from other tabs
  window.addEventListener('storage', (event) => {
    if (event.key === 'feature-store' && event.newValue !== event.oldValue) {
      // Force rehydration when feature state changes in another tab
      useFeatureStore.persist.rehydrate();
    }
  });
}