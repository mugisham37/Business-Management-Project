import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, or } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { tenantFeatureFlags, tenants } from '../../database/schema';
import { BusinessMetricsService } from './business-metrics.service';
import { CustomLoggerService } from '../../logger/logger.service';
import { 
  FeatureFlag, 
  FeatureFlagStatus, 
  FEATURE_DEFINITIONS, 
  FeatureDefinition,
  FeatureRule 
} from '../entities/feature-flag.entity';
import { BusinessTier, BusinessMetrics } from '../entities/tenant.entity';

export interface FeatureEvaluationContext {
  tenantId: string;
  businessTier: BusinessTier;
  businessMetrics: BusinessMetrics;
  userId?: string;
  userRoles?: string[];
}

@Injectable()
export class FeatureFlagService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
    private readonly businessMetricsService: BusinessMetricsService,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * Check if a tenant has access to a specific feature
   */
  async hasFeature(
    tenantId: string,
    featureName: string,
    context?: Partial<FeatureEvaluationContext>,
  ): Promise<boolean> {
    const cacheKey = `feature:${tenantId}:${featureName}`;
    
    // Check cache first
    let hasAccess = await this.cacheService.get<boolean>(cacheKey);
    if (hasAccess !== null) {
      return hasAccess;
    }

    try {
      // Get tenant information
      const [tenant] = await this.drizzle.getDb()
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId));

      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      // Build evaluation context
      const evaluationContext: FeatureEvaluationContext = {
        tenantId,
        businessTier: tenant!.businessTier as BusinessTier,
        businessMetrics: tenant!.metrics as BusinessMetrics,
        ...context,
      };

      // Evaluate feature access
      hasAccess = await this.evaluateFeatureAccess(featureName, evaluationContext);

      // Cache result for 5 minutes
      await this.cacheService.set(cacheKey, hasAccess, { ttl: 300 });

      return hasAccess;
    } catch (error) {
      const errorMessage = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack;
      this.logger.error(
        `Failed to check feature access: ${errorMessage}`,
        errorStack,
      );
      
      // Default to false on error
      return false;
    }
  }

  /**
   * Evaluate feature access based on multiple criteria
   */
  private async evaluateFeatureAccess(
    featureName: string,
    context: FeatureEvaluationContext,
  ): Promise<boolean> {
    // Get feature definition
    const featureDefinition = FEATURE_DEFINITIONS[featureName];
    if (!featureDefinition) {
      this.logger.warn(`Unknown feature: ${featureName}`);
      return false;
    }

    // Check if tenant meets the required business tier
    if (!this.meetsTierRequirement(context.businessTier, featureDefinition.requiredTier)) {
      return false;
    }

    // Check dependencies
    if (featureDefinition.dependencies) {
      for (const dependency of featureDefinition.dependencies) {
        const hasDependency = await this.hasFeature(context.tenantId, dependency, context);
        if (!hasDependency) {
          return false;
        }
      }
    }

    // Check custom tenant-specific feature flag
    const tenantFeatureFlag = await this.getTenantFeatureFlag(context.tenantId, featureName);
    if (tenantFeatureFlag) {
      return this.evaluateTenantFeatureFlag(tenantFeatureFlag, context);
    }

    // Default: feature is available if tier requirement is met
    return true;
  }

  /**
   * Check if current tier meets required tier
   */
  private meetsTierRequirement(currentTier: BusinessTier, requiredTier: BusinessTier): boolean {
    const tierOrder = [BusinessTier.MICRO, BusinessTier.SMALL, BusinessTier.MEDIUM, BusinessTier.ENTERPRISE];
    const currentIndex = tierOrder.indexOf(currentTier);
    const requiredIndex = tierOrder.indexOf(requiredTier);
    
    return currentIndex >= requiredIndex;
  }

  /**
   * Get tenant-specific feature flag
   */
  private async getTenantFeatureFlag(tenantId: string, featureName: string): Promise<FeatureFlag | null> {
    try {
      const [flag] = await this.drizzle.getDb()
        .select()
        .from(tenantFeatureFlags)
        .where(
          and(
            eq(tenantFeatureFlags.tenantId, tenantId),
            eq(tenantFeatureFlags.featureName, featureName),
            eq(tenantFeatureFlags.isActive, true),
          ),
        );

      return flag ? this.mapFeatureFlagToEntity(flag) : null;
    } catch (error) {
      const errorMessage = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack;
      this.logger.error(
        `Failed to get tenant feature flag: ${errorMessage}`,
        errorStack,
      );
      return null;
    }
  }

  /**
   * Evaluate tenant-specific feature flag
   */
  private evaluateTenantFeatureFlag(
    featureFlag: FeatureFlag,
    context: FeatureEvaluationContext,
  ): boolean {
    // Check if feature is explicitly disabled
    if (!featureFlag.isEnabled || featureFlag.status === FeatureFlagStatus.DISABLED) {
      return false;
    }

    // Check rollout percentage
    if (featureFlag.rolloutPercentage !== undefined && featureFlag.rolloutPercentage < 100) {
      const hash = this.hashString(`${context.tenantId}:${featureFlag.featureName}`);
      const percentage = hash % 100;
      if (percentage >= featureFlag.rolloutPercentage) {
        return false;
      }
    }

    // Evaluate custom rules
    if (featureFlag.customRules && featureFlag.customRules.length > 0) {
      return this.evaluateCustomRules(featureFlag.customRules, context);
    }

    return true;
  }

  /**
   * Evaluate custom rules for feature access
   */
  private evaluateCustomRules(rules: FeatureRule[], context: FeatureEvaluationContext): boolean {
    for (const rule of rules) {
      if (!this.evaluateRule(rule, context)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate a single rule
   */
  private evaluateRule(rule: FeatureRule, context: FeatureEvaluationContext): boolean {
    try {
      // Simple rule evaluation - in production, use a proper expression evaluator
      const condition = (rule.condition || '').toLowerCase();
      const metrics = context.businessMetrics;

      if (condition.includes('employeecount')) {
        const match = condition.match(/employeecount\s*([><=]+)\s*(\d+)/);
        if (match) {
          const operator = match[1] || '';
          const value = parseInt(match[2] || '0');
          return this.compareValues(metrics.employeeCount, operator, value);
        }
      }

      if (condition.includes('locationcount')) {
        const match = condition.match(/locationcount\s*([><=]+)\s*(\d+)/);
        if (match) {
          const operator = match[1] || '';
          const value = parseInt(match[2] || '0');
          return this.compareValues(metrics.locationCount, operator, value);
        }
      }

      if (condition.includes('monthlyrevenue')) {
        const match = condition.match(/monthlyrevenue\s*([><=]+)\s*(\d+)/);
        if (match) {
          const operator = match[1] || '';
          const value = parseInt(match[2] || '0');
          return this.compareValues(metrics.monthlyRevenue, operator, value);
        }
      }

      if (condition.includes('monthlytransactionvolume')) {
        const match = condition.match(/monthlytransactionvolume\s*([><=]+)\s*(\d+)/);
        if (match) {
          const operator = match[1] || '';
          const value = parseInt(match[2] || '0');
          return this.compareValues(metrics.monthlyTransactionVolume, operator, value);
        }
      }

      // Default to rule value if condition can't be evaluated
      return rule.value;
    } catch (error) {
      this.logger.error(
        `Failed to evaluate rule: ${rule.condition || 'unknown'} - ${(error as Error).message}`,
        (error as Error).stack,
      );
      return rule.value;
    }
  }

  /**
   * Compare values based on operator
   */
  private compareValues(actual: number, operator: string, expected: number): boolean {
    switch (operator) {
      case '>':
        return actual > expected;
      case '>=':
        return actual >= expected;
      case '<':
        return actual < expected;
      case '<=':
        return actual <= expected;
      case '=':
      case '==':
        return actual === expected;
      case '!=':
        return actual !== expected;
      default:
        return false;
    }
  }

  /**
   * Get all available features for a tenant
   */
  async getAvailableFeatures(tenantId: string): Promise<{
    available: FeatureDefinition[];
    unavailable: FeatureDefinition[];
    upgradeRequired: FeatureDefinition[];
  }> {
    const [tenant] = await this.drizzle.getDb()
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const context: FeatureEvaluationContext = {
      tenantId,
      businessTier: tenant!.businessTier as BusinessTier,
      businessMetrics: tenant!.metrics as BusinessMetrics,
    };

    const available: FeatureDefinition[] = [];
    const unavailable: FeatureDefinition[] = [];
    const upgradeRequired: FeatureDefinition[] = [];

    for (const [featureName, definition] of Object.entries(FEATURE_DEFINITIONS)) {
      const hasAccess = await this.hasFeature(tenantId, featureName, context);
      
      if (hasAccess) {
        available.push(definition);
      } else if (this.meetsTierRequirement(context.businessTier, definition.requiredTier)) {
        unavailable.push(definition);
      } else {
        upgradeRequired.push(definition);
      }
    }

    return { available, unavailable, upgradeRequired };
  }

  /**
   * Create or update a tenant-specific feature flag
   */
  async setTenantFeatureFlag(
    tenantId: string,
    featureName: string,
    isEnabled: boolean,
    options?: {
      rolloutPercentage?: number;
      customRules?: FeatureRule[];
      status?: FeatureFlagStatus;
    },
  ): Promise<FeatureFlag> {
    const existingFlag = await this.getTenantFeatureFlag(tenantId, featureName);

    try {
      if (existingFlag) {
        // Update existing flag
        const [updatedFlag] = await this.drizzle.getDb()
          .update(tenantFeatureFlags)
          .set({
            isEnabled,
            rolloutPercentage: options?.rolloutPercentage,
            customRules: options?.customRules || [],
            enabledAt: isEnabled ? new Date() : undefined,
            disabledAt: !isEnabled ? new Date() : undefined,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(tenantFeatureFlags.tenantId, tenantId),
              eq(tenantFeatureFlags.featureName, featureName),
            ),
          )
          .returning();

        // Invalidate cache
        await this.invalidateFeatureCache(tenantId, featureName);

        return this.mapFeatureFlagToEntity(updatedFlag);
      } else {
        // Create new flag
        const [newFlag] = await this.drizzle.getDb()
          .insert(tenantFeatureFlags)
          .values({
            tenantId,
            featureName,
            isEnabled,
            rolloutPercentage: options?.rolloutPercentage || 100,
            customRules: options?.customRules || [],
            enabledAt: isEnabled ? new Date() : undefined,
            disabledAt: !isEnabled ? new Date() : undefined,
          })
          .returning();

        // Invalidate cache
        await this.invalidateFeatureCache(tenantId, featureName);

        return this.mapFeatureFlagToEntity(newFlag);
      }
    } catch (error) {
      const errorMessage = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack;
      this.logger.error(
        `Failed to set tenant feature flag: ${errorMessage}`,
        errorStack,
      );
      throw new BadRequestException('Failed to update feature flag');
    }
  }

  /**
   * Invalidate feature cache for a tenant
   */
  async invalidateFeatureCache(tenantId: string, featureName?: string): Promise<void> {
    if (featureName) {
      await this.cacheService.invalidatePattern(`feature:${tenantId}:${featureName}`);
    } else {
      await this.cacheService.invalidatePattern(`feature:${tenantId}:*`);
    }
  }

  /**
   * Get feature definitions
   */
  getFeatureDefinitions(): Record<string, FeatureDefinition> {
    return FEATURE_DEFINITIONS;
  }

  /**
   * Get features by category
   */
  getFeaturesByCategory(category: string): FeatureDefinition[] {
    return Object.values(FEATURE_DEFINITIONS).filter(
      (definition) => definition.category === category,
    );
  }

  /**
   * Get features by tier
   */
  getFeaturesByTier(tier: BusinessTier): FeatureDefinition[] {
    return Object.values(FEATURE_DEFINITIONS).filter(
      (definition) => definition.requiredTier === tier,
    );
  }

  /**
   * Map database record to entity
   */
  private mapFeatureFlagToEntity(record: any): FeatureFlag {
    return {
      id: record.id,
      tenantId: record.tenantId,
      featureName: record.featureName,
      isEnabled: record.isEnabled,
      rolloutPercentage: record.rolloutPercentage,
      customRules: record.customRules || [],
      status: record.isEnabled ? FeatureFlagStatus.ENABLED : FeatureFlagStatus.DISABLED,
      enabledAt: record.enabledAt,
      disabledAt: record.disabledAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Simple hash function for consistent rollout percentages
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}