/**
 * Tenant Hook
 * Wrapper hook for accessing tenant context and current tenant information
 * Re-exports useCurrentTenant and related functionality from @/lib/tenant
 */

export {
  useTenantContext,
  useCurrentTenant as useTenant,
  useFeatureFlags,
  useTenantSwitching,
  useBusinessTier,
  useTenantSettings,
  useFeatureGate,
  useTierGate,
  useFeatureAndTierGate,
} from '@/lib/tenant';
