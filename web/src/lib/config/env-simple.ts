// Simplified environment configuration without Zod for initial setup

// Type-safe environment configuration
export const config = {
  graphql: {
    uri: process.env.NEXT_PUBLIC_GRAPHQL_URI || 'http://localhost:4000/graphql',
    wsUri: process.env.NEXT_PUBLIC_GRAPHQL_WS_URI || 'ws://localhost:4000/graphql',
  },
  auth: {
    jwtSecret: process.env.NEXT_PUBLIC_JWT_SECRET || 'development-jwt-secret',
    refreshTokenSecret: process.env.NEXT_PUBLIC_REFRESH_TOKEN_SECRET || 'development-refresh-secret',
  },
  tenant: {
    defaultTenant: process.env.NEXT_PUBLIC_DEFAULT_TENANT || 'default',
    domainStrategy: (process.env.NEXT_PUBLIC_TENANT_DOMAIN_STRATEGY as 'subdomain' | 'path' | 'header') || 'subdomain',
  },
  cache: {
    ttl: Number(process.env.NEXT_PUBLIC_CACHE_TTL) || 300000,
    enablePersistence: process.env.NEXT_PUBLIC_ENABLE_CACHE_PERSISTENCE === 'true',
  },
  development: {
    enableDevtools: process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS === 'true',
    logLevel: (process.env.NEXT_PUBLIC_LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
  },
  security: {
    cspEnabled: process.env.NEXT_PUBLIC_CSP_ENABLED === 'true',
    secureCookies: process.env.NEXT_PUBLIC_SECURE_COOKIES === 'true',
  },
  performance: {
    enableServiceWorker: process.env.NEXT_PUBLIC_ENABLE_SW === 'true',
    bundleAnalyzer: process.env.NEXT_PUBLIC_BUNDLE_ANALYZER === 'true',
  },
  features: {
    analytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
    realTime: process.env.NEXT_PUBLIC_ENABLE_REAL_TIME === 'true',
    offlineMode: process.env.NEXT_PUBLIC_ENABLE_OFFLINE_MODE === 'true',
  },
  monitoring: {
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    analyticsId: process.env.NEXT_PUBLIC_ANALYTICS_ID,
  },
} as const;

export type Config = typeof config;