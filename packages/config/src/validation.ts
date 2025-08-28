import { z } from 'zod';
import { AppConfig, ConfigSchema, ConfigValidationResult } from './types';

export class ConfigValidator {
  private schema: z.ZodSchema;

  constructor(schema: z.ZodSchema = ConfigSchema) {
    this.schema = schema;
  }

  validate(config: unknown): ConfigValidationResult {
    try {
      const result = this.schema.safeParse(config);

      if (result.success) {
        return {
          valid: true,
          errors: [],
          warnings: this.generateWarnings(result.data),
        };
      } else {
        return {
          valid: false,
          errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
          warnings: [],
        };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
      };
    }
  }

  private generateWarnings(config: AppConfig): string[] {
    const warnings: string[] = [];

    // Environment-specific warnings
    if (config.env === 'production') {
      if (config.logging.level === 'debug') {
        warnings.push('Debug logging is enabled in production');
      }

      if (config.security.rateLimit.global.max > 10000) {
        warnings.push('Rate limit is very high for production');
      }
    }

    // Security warnings
    if (config.jwt.secret.length < 64) {
      warnings.push('JWT secret should be at least 64 characters for better security');
    }

    if (config.server.cors.origin === true && config.env === 'production') {
      warnings.push('CORS is set to allow all origins in production');
    }

    // Performance warnings
    if (config.database.pool.max > 50) {
      warnings.push('Database pool max connections is very high');
    }

    return warnings;
  }

  validateSection<K extends keyof AppConfig>(
    section: K,
    value: AppConfig[K]
  ): ConfigValidationResult {
    try {
      // Get the schema for this specific section
      const sectionSchema = this.getSectionSchema(section);
      const result = sectionSchema.safeParse(value);

      if (result.success) {
        return {
          valid: true,
          errors: [],
          warnings: [],
        };
      } else {
        return {
          valid: false,
          errors: result.error.errors.map(
            err => `${section}.${err.path.join('.')}: ${err.message}`
          ),
          warnings: [],
        };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [
          `Section validation error: ${error instanceof Error ? error.message : String(error)}`,
        ],
        warnings: [],
      };
    }
  }

  private getSectionSchema(section: keyof AppConfig): z.ZodSchema {
    // Extract the schema for a specific section from the main schema
    const shape = (this.schema as any)._def.shape();
    return shape[section] || z.any();
  }
}

// Validation rules for different environments
export const validationRules = {
  development: {
    required: ['jwt.secret'],
    warnings: [],
  },
  test: {
    required: [],
    warnings: [],
  },
  staging: {
    required: ['jwt.secret', 'database.url'],
    warnings: ['logging.level should not be debug'],
  },
  production: {
    required: ['jwt.secret', 'database.url', 'redis.url'],
    warnings: [
      'logging.level should not be debug',
      'server.cors.origin should not be true',
      'security.rateLimit should be configured',
    ],
  },
};

// Export singleton validator
export const configValidator = new ConfigValidator();
