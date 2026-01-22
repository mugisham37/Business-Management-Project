// Core application types

export type BusinessTier = 'MICRO' | 'SMALL' | 'MEDIUM' | 'ENTERPRISE';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'error';

export type CacheStrategy = 'cache-first' | 'network-first' | 'cache-only' | 'network-only' | 'cache-and-network';

export type ErrorPolicy = 'none' | 'ignore' | 'all';

export type FetchPolicy = 'cache-first' | 'cache-and-network' | 'network-only' | 'cache-only' | 'standby';

// User and Authentication Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  tenants: UserTenant[];
  permissions: Permission[];
  mfaEnabled: boolean;
  lastLoginAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserTenant {
  tenantId: string;
  role: Role;
  permissions: Permission[];
  isActive: boolean;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tokenType: 'Bearer';
}

export interface AuthState {
  user: User | null;
  tokens: TokenPair | null;
  permissions: Permission[];
  mfaRequired: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Multi-Tenant Types
export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  businessTier: BusinessTier;
  settings: TenantSettings;
  branding: BrandingConfig;
}

export interface TenantSettings {
  timezone: string;
  currency: string;
  dateFormat: string;
  language: string;
  features: Record<string, boolean>;
  limits: TenantLimits;
}

export interface TenantLimits {
  maxUsers: number;
  maxStorage: number;
  maxApiCalls: number;
  maxIntegrations: number;
}

export interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  logo?: string;
  favicon?: string;
  customCss?: string;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  config: Record<string, any>;
  requiredTier: BusinessTier;
}

export interface TenantContext {
  currentTenant: Tenant | null;
  availableTenants: Tenant[];
  businessTier: BusinessTier;
  features: FeatureFlag[];
}

// GraphQL Types
export interface GraphQLOperation {
  query: string;
  variables?: Record<string, any>;
  context?: Record<string, any>;
  errorPolicy?: ErrorPolicy;
  fetchPolicy?: FetchPolicy;
}

export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, any>;
}

// Cache Types
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  tenant?: string;
}

// Subscription Types
export interface SubscriptionOptions {
  tenantFilter?: string;
  errorPolicy?: ErrorPolicy;
  fetchPolicy?: FetchPolicy;
  onError?: (error: Error) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  userId?: string;
  tenantId?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

// Performance Types
export interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  bundleSize: number;
  cacheHitRate: number;
}

// Module Types
export interface ModuleConfig {
  name: string;
  path: string;
  lazy: boolean;
  permissions?: Permission[];
  businessTier?: BusinessTier;
}

export interface ModuleRegistry {
  modules: Map<string, ModuleConfig>;
  loadedModules: Set<string>;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;