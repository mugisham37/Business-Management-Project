import { AppConfig, ConfigProfile, EnvironmentProfile } from './types';

// Default configuration profiles for different environments
const profiles: Record<EnvironmentProfile, ConfigProfile> = {
  development: {
    name: 'development',
    description: 'Local development environment',
    requiredSecrets: ['JWT_SECRET'],
    overrides: {
      server: {
        host: 'localhost',
        port: 3000,
        cors: {
          origin: true,
          credentials: true,
        },
        helmet: {
          contentSecurityPolicy: true,
          crossOriginEmbedderPolicy: false,
        },
      },
      database: {
        pool: {
          min: 2,
          max: 5,
          idleTimeout: 30000,
          connectionTimeout: 5000,
        },
      },
      logging: {
        level: 'debug',
        format: 'json',
        file: {
          enabled: true,
          path: 'logs/app.log',
          maxSize: '10m',
          maxFiles: 5,
        },
        console: {
          enabled: true,
          colorize: true,
        },
        audit: {
          enabled: true,
          path: 'logs/audit.log',
          maxSize: '100m',
          maxFiles: 10,
        },
      },
      monitoring: {
        metrics: {
          enabled: true,
          port: 9090,
          path: '/metrics',
        },
        tracing: {
          enabled: false,
          serviceName: 'auth-dev',
          sampleRate: 1.0,
        },
      },
      security: {
        rateLimit: {
          global: {
            max: 10000,
            window: 900000,
          },
          auth: {
            max: 10,
            window: 900000,
          },
          api: {
            max: 1000,
            window: 900000,
          },
        },
      },
    },
  },

  test: {
    name: 'test',
    description: 'Automated testing environment',
    requiredSecrets: [],
    overrides: {
      database: {
        pool: {
          min: 1,
          max: 3,
          idleTimeout: 30000,
          connectionTimeout: 5000,
        },
      },
      logging: {
        level: 'error',
        format: 'json',
        console: {
          enabled: false,
          colorize: false,
        },
        file: {
          enabled: false,
          path: 'logs/test.log',
          maxSize: '10m',
          maxFiles: 1,
        },
        audit: {
          enabled: false,
          path: 'logs/test-audit.log',
          maxSize: '10m',
          maxFiles: 1,
        },
      },
      monitoring: {
        metrics: {
          enabled: false,
          port: 9090,
          path: '/metrics',
        },
        tracing: {
          enabled: false,
          serviceName: 'auth-test',
          sampleRate: 1.0,
        },
      },
    },
  },

  staging: {
    name: 'staging',
    description: 'Pre-production staging environment',
    requiredSecrets: ['JWT_SECRET', 'DATABASE_URL'],
    overrides: {
      server: {
        host: 'localhost',
        port: 3000,
        cors: {
          origin: false,
          credentials: true,
        },
        helmet: {
          contentSecurityPolicy: true,
          crossOriginEmbedderPolicy: true,
        },
      },
      database: {
        pool: {
          min: 3,
          max: 10,
          idleTimeout: 30000,
          connectionTimeout: 5000,
        },
      },
      logging: {
        level: 'info',
        format: 'json',
        file: {
          enabled: true,
          path: 'logs/staging.log',
          maxSize: '50m',
          maxFiles: 10,
        },
        console: {
          enabled: true,
          colorize: false,
        },
        audit: {
          enabled: true,
          path: 'logs/staging-audit.log',
          maxSize: '100m',
          maxFiles: 10,
        },
      },
      monitoring: {
        metrics: {
          enabled: true,
          port: 9090,
          path: '/metrics',
        },
        health: {
          enabled: true,
          path: '/health',
          checks: {
            database: true,
            redis: true,
            external: true,
          },
        },
        tracing: {
          enabled: true,
          serviceName: 'auth-staging',
          sampleRate: 0.5,
        },
      },
      security: {
        rateLimit: {
          global: {
            max: 5000,
            window: 900000,
          },
          auth: {
            max: 5,
            window: 900000,
          },
          api: {
            max: 500,
            window: 900000,
          },
        },
      },
    },
  },

  production: {
    name: 'production',
    description: 'Production environment',
    requiredSecrets: ['JWT_SECRET', 'DATABASE_URL', 'REDIS_URL', 'SMTP_PASSWORD'],
    overrides: {
      server: {
        host: '0.0.0.0',
        port: 3000,
        cors: {
          origin: false, // Should be configured with specific origins
          credentials: false,
        },
        helmet: {
          contentSecurityPolicy: true,
          crossOriginEmbedderPolicy: true,
        },
      },
      database: {
        pool: {
          min: 5,
          max: 20,
          idleTimeout: 30000,
          connectionTimeout: 5000,
        },
      },
      logging: {
        level: 'warn',
        format: 'json',
        file: {
          enabled: true,
          path: 'logs/production.log',
          maxSize: '100m',
          maxFiles: 20,
        },
        console: {
          enabled: true,
          colorize: false,
        },
        audit: {
          enabled: true,
          path: 'logs/production-audit.log',
          maxSize: '500m',
          maxFiles: 50,
        },
      },
      monitoring: {
        metrics: {
          enabled: true,
          port: 9090,
          path: '/metrics',
        },
        health: {
          enabled: true,
          path: '/health',
          checks: {
            database: true,
            redis: true,
            external: true,
          },
        },
        tracing: {
          enabled: true,
          serviceName: 'auth-production',
          sampleRate: 0.1,
        },
      },
      security: {
        rateLimit: {
          global: {
            max: 1000,
            window: 900000,
          },
          auth: {
            max: 5,
            window: 900000,
          },
          api: {
            max: 100,
            window: 900000,
          },
        },
      },
    },
  },
};

export function getProfile(environment: EnvironmentProfile): ConfigProfile {
  const profile = profiles[environment];
  if (!profile) {
    throw new Error(`Unknown environment profile: ${environment}`);
  }
  return profile;
}

export function getAllProfiles(): ConfigProfile[] {
  return Object.values(profiles);
}

export function validateProfileRequirements(
  profile: ConfigProfile,
  availableSecrets: string[]
): { valid: boolean; missingSecrets: string[] } {
  const missingSecrets = profile.requiredSecrets.filter(
    secret => !availableSecrets.includes(secret)
  );

  return {
    valid: missingSecrets.length === 0,
    missingSecrets,
  };
}

export function mergeProfileOverrides(
  baseConfig: Partial<AppConfig>,
  profile: ConfigProfile
): Partial<AppConfig> {
  return deepMerge(baseConfig, profile.overrides);
}

// Deep merge utility function
function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

export function createCustomProfile(
  name: string,
  description: string,
  baseProfile: EnvironmentProfile,
  overrides: Partial<AppConfig>
): ConfigProfile {
  const base = getProfile(baseProfile);

  return {
    name: name as EnvironmentProfile,
    description,
    requiredSecrets: base.requiredSecrets,
    overrides: deepMerge(base.overrides, overrides),
  };
}
