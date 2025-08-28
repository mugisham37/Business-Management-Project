import { config } from 'dotenv';

// Load environment variables
config();

// Environment variable type definitions
export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'production' | 'test' | 'staging';

  // Server configuration
  SERVER_HOST: string;
  SERVER_PORT: number;

  // Database configuration
  DATABASE_URL: string;
  DATABASE_HOST: string | undefined;
  DATABASE_PORT: number | undefined;
  DATABASE_NAME: string | undefined;
  DATABASE_USER: string | undefined;
  DATABASE_PASSWORD: string | undefined;
  DATABASE_SSL: boolean;
  DATABASE_POOL_MIN: number;
  DATABASE_POOL_MAX: number;

  // Redis configuration
  REDIS_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD: string | undefined;
  REDIS_DB: number;

  // Logging configuration
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  LOG_FORMAT: 'json' | 'simple';
  LOG_FILE_PATH: string | undefined;

  // Monitoring configuration
  METRICS_ENABLED: boolean;
  METRICS_PORT: number;
  HEALTH_CHECK_ENABLED: boolean;
}

// Helper function to get environment variable with type conversion
function getEnvVar<T>(key: string, defaultValue: T, converter?: (value: string) => T): T {
  const value = process.env[key];

  if (value === undefined) {
    return defaultValue;
  }

  if (converter) {
    try {
      return converter(value);
    } catch (error) {
      console.warn(`Failed to convert environment variable ${key}:`, error);
      return defaultValue;
    }
  }

  return value as unknown as T;
}

// Convert string to boolean
function toBool(value: string): boolean {
  return value.toLowerCase() === 'true' || value === '1';
}

// Convert string to number
function toNumber(value: string): number {
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`Invalid number: ${value}`);
  }
  return num;
}

// Environment configuration object
export const env: EnvironmentVariables = {
  NODE_ENV: getEnvVar('NODE_ENV', 'development') as
    | 'development'
    | 'production'
    | 'test'
    | 'staging',

  // Server
  SERVER_HOST: getEnvVar('SERVER_HOST', 'localhost'),
  SERVER_PORT: getEnvVar('SERVER_PORT', 3000, toNumber),

  // Database
  DATABASE_URL: getEnvVar('DATABASE_URL', 'postgresql://localhost:5432/auth_db'),
  DATABASE_HOST: process.env.DATABASE_HOST,
  DATABASE_PORT: process.env.DATABASE_PORT ? toNumber(process.env.DATABASE_PORT) : undefined,
  DATABASE_NAME: process.env.DATABASE_NAME,
  DATABASE_USER: process.env.DATABASE_USER,
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
  DATABASE_SSL: getEnvVar('DATABASE_SSL', false, toBool),
  DATABASE_POOL_MIN: getEnvVar('DATABASE_POOL_MIN', 2, toNumber),
  DATABASE_POOL_MAX: getEnvVar('DATABASE_POOL_MAX', 20, toNumber),

  // Redis
  REDIS_URL: getEnvVar('REDIS_URL', 'redis://localhost:6379'),
  REDIS_HOST: getEnvVar('REDIS_HOST', 'localhost'),
  REDIS_PORT: getEnvVar('REDIS_PORT', 6379, toNumber),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_DB: getEnvVar('REDIS_DB', 0, toNumber),

  // Logging
  LOG_LEVEL: getEnvVar('LOG_LEVEL', 'info') as 'error' | 'warn' | 'info' | 'debug',
  LOG_FORMAT: getEnvVar('LOG_FORMAT', 'json') as 'json' | 'simple',
  LOG_FILE_PATH: process.env.LOG_FILE_PATH,

  // Monitoring
  METRICS_ENABLED: getEnvVar('METRICS_ENABLED', true, toBool),
  METRICS_PORT: getEnvVar('METRICS_PORT', 9090, toNumber),
  HEALTH_CHECK_ENABLED: getEnvVar('HEALTH_CHECK_ENABLED', true, toBool),
};

// Validation function
export function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required environment variables
  const required = ['DATABASE_URL'];

  for (const key of required) {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // Environment-specific validations
  if (env.NODE_ENV === 'production') {
    const productionRequired = ['JWT_SECRET'];

    for (const key of productionRequired) {
      if (!process.env[key]) {
        errors.push(`Missing required production environment variable: ${key}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export individual environment checkers
export const isDevelopment = () => env.NODE_ENV === 'development';
export const isProduction = () => env.NODE_ENV === 'production';
export const isTest = () => env.NODE_ENV === 'test';
export const isStaging = () => env.NODE_ENV === 'staging';
