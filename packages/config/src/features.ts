// Feature flags configuration and management

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number;
  conditions?: FeatureCondition[];
  metadata?: Record<string, any>;
}

export interface FeatureCondition {
  type: 'user' | 'environment' | 'date' | 'custom';
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in';
  value: any;
  field?: string;
}

export class FeatureFlagManager {
  private flags = new Map<string, FeatureFlag>();
  private context: Record<string, any> = {};

  constructor(initialFlags: FeatureFlag[] = []) {
    initialFlags.forEach(flag => this.flags.set(flag.name, flag));
  }

  setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
  }

  addFlag(flag: FeatureFlag): void {
    this.flags.set(flag.name, flag);
  }

  removeFlag(name: string): void {
    this.flags.delete(name);
  }

  isEnabled(flagName: string, userContext?: Record<string, any>): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    const context = { ...this.context, ...userContext };

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined) {
      const hash = this.hashString(flagName + JSON.stringify(context));
      const percentage = (hash % 100) + 1;
      if (percentage > flag.rolloutPercentage) {
        return false;
      }
    }

    // Check conditions
    if (flag.conditions) {
      return flag.conditions.every(condition => this.evaluateCondition(condition, context));
    }

    return true;
  }

  private evaluateCondition(condition: FeatureCondition, context: Record<string, any>): boolean {
    let contextValue = context;

    if (condition.field) {
      contextValue = this.getNestedValue(context, condition.field);
    }

    switch (condition.operator) {
      case 'equals':
        return contextValue === condition.value;
      case 'contains':
        return Array.isArray(contextValue)
          ? contextValue.includes(condition.value)
          : String(contextValue).includes(String(condition.value));
      case 'greater_than':
        return Number(contextValue) > Number(condition.value);
      case 'less_than':
        return Number(contextValue) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) ? condition.value.includes(contextValue) : false;
      default:
        return false;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  getFlag(name: string): FeatureFlag | undefined {
    return this.flags.get(name);
  }
}

// Default feature flags
export const defaultFeatureFlags: FeatureFlag[] = [
  {
    name: 'oauth_google',
    enabled: true,
    description: 'Enable Google OAuth authentication',
  },
  {
    name: 'oauth_github',
    enabled: true,
    description: 'Enable GitHub OAuth authentication',
  },
  {
    name: 'mfa_enabled',
    enabled: true,
    description: 'Enable multi-factor authentication',
  },
  {
    name: 'rate_limiting',
    enabled: true,
    description: 'Enable API rate limiting',
  },
  {
    name: 'audit_logging',
    enabled: true,
    description: 'Enable detailed audit logging',
  },
  {
    name: 'metrics_collection',
    enabled: true,
    description: 'Enable metrics collection and monitoring',
  },
];

// Export singleton instance
export const featureFlags = new FeatureFlagManager(defaultFeatureFlags);
