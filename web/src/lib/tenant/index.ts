/**
 * Tenant Management Module
 * Central exports for tenant context, hooks, and providers
 * Requirements: 4.1, 4.3, 4.2, 4.5, 4.6, 4.7
 */

// Core tenant context management
export {
  TenantContextManager,
  createTenantContextManager,
  getDefaultTenantManager,
  setDefaultTenantManager,
  tenantContextManager,
} from './tenant-context';

export type {
  TenantContextState,
  TenantContextConfig,
  FeatureConfig,
} from './tenant-context';

// React hooks for tenant functionality
export {
  useTenantContext,
  useCurrentTenant,
  useFeatureFlags,
  useTenantSwitching,
  useBusinessTier,
  useTenantSettings,
  useFeatureGate,
  useTierGate,
  useFeatureAndTierGate,
} from './tenant-hooks';

// React context provider and components
export {
  TenantProvider,
  useTenantProvider,
  withTenantContext,
  FeatureGate,
  TierGate,
  TenantGate,
  TenantLoading,
  TenantError,
} from './tenant-provider';

// Tenant switching and validation
export {
  TenantSwitchingService,
  tenantSwitchingService,
} from './tenant-switching';

export type {
  TenantSwitchResult,
  TenantAccessValidation,
  TenantSwitchOptions,
} from './tenant-switching';

// Tenant theming system
export {
  TenantThemingService,
  tenantThemingService,
  useTenantTheming,
} from './tenant-theming';

export type {
  ThemeConfig,
  ThemeVariables,
} from './tenant-theming';

// Theme provider components
export {
  ThemeProvider,
  useTheme,
  withTheme,
  ThemeFeature,
} from './theme-provider';

// Re-export core types for convenience
export type {
  Tenant,
  TenantSettings,
  TenantLimits,
  BrandingConfig,
  FeatureFlag,
  BusinessTier,
} from '@/types/core';