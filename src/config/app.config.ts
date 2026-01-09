import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigin: string[];
  corsCredentials: boolean;
  logLevel: string;
  rateLimitTtl: number;
  rateLimitMax: number;
  graphqlPlayground: boolean;
  graphqlIntrospection: boolean;
  healthCheckTimeout: number;
  healthCheckInterval: number;
}

export const appConfig = registerAs('app', (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
  corsCredentials: process.env.CORS_CREDENTIALS === 'true',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL ?? '60', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
  graphqlPlayground: process.env.GRAPHQL_PLAYGROUND === 'true',
  graphqlIntrospection: process.env.GRAPHQL_INTROSPECTION === 'true',
  healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT ?? '5000', 10),
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL ?? '30000', 10),
}));