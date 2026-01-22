/**
 * SSR Optimizer - Server-side rendering and static generation utilities
 * Implements intelligent SSR/SSG strategies based on content type and user context
 */

import { Metadata } from 'next';

export interface SSRConfig {
  enabled: boolean;
  cacheStrategy: 'static' | 'isr' | 'ssr' | 'csr';
  revalidate?: number;
  tags?: string[];
  conditions?: SSRCondition[];
}

export interface SSRCondition {
  type: 'auth' | 'tenant' | 'permission' | 'device' | 'geo';
  value: string | string[];
  strategy: 'static' | 'isr' | 'ssr' | 'csr';
}

export interface PageConfig {
  path: string;
  title: string;
  description: string;
  ssrConfig: SSRConfig;
  preloadData?: string[];
  criticalCSS?: string[];
}

/**
 * Page configuration registry for SSR/SSG optimization
 */
export const PAGE_CONFIGS: Record<string, PageConfig> = {
  // Public pages - Static generation
  '/': {
    path: '/',
    title: 'Next.js GraphQL Foundation',
    description: 'Enterprise-grade Next.js foundation with GraphQL integration',
    ssrConfig: {
      enabled: true,
      cacheStrategy: 'static',
      tags: ['homepage'],
    },
  },
  
  '/login': {
    path: '/login',
    title: 'Login - Next.js GraphQL Foundation',
    description: 'Secure login to your business management platform',
    ssrConfig: {
      enabled: true,
      cacheStrategy: 'static',
      tags: ['auth'],
    },
  },

  // Dashboard - ISR with auth check
  '/dashboard': {
    path: '/dashboard',
    title: 'Dashboard',
    description: 'Business management dashboard',
    ssrConfig: {
      enabled: true,
      cacheStrategy: 'isr',
      revalidate: 300, // 5 minutes
      tags: ['dashboard'],
      conditions: [
        {
          type: 'auth',
          value: 'required',
          strategy: 'ssr',
        },
      ],
    },
    preloadData: ['user', 'tenant', 'permissions'],
  },

  // Module pages - SSR for authenticated users
  '/warehouse': {
    path: '/warehouse',
    title: 'Warehouse Management',
    description: 'Comprehensive warehouse management system',
    ssrConfig: {
      enabled: true,
      cacheStrategy: 'ssr',
      conditions: [
        {
          type: 'auth',
          value: 'required',
          strategy: 'ssr',
        },
        {
          type: 'permission',
          value: ['warehouse:read'],
          strategy: 'ssr',
        },
      ],
    },
    preloadData: ['warehouse-summary', 'inventory-levels'],
  },

  '/pos': {
    path: '/pos',
    title: 'Point of Sale',
    description: 'Modern point of sale system',
    ssrConfig: {
      enabled: true,
      cacheStrategy: 'ssr',
      conditions: [
        {
          type: 'auth',
          value: 'required',
          strategy: 'ssr',
        },
        {
          type: 'permission',
          value: ['pos:read'],
          strategy: 'ssr',
        },
      ],
    },
    preloadData: ['pos-config', 'payment-methods'],
  },

  // Analytics - ISR with longer cache
  '/analytics': {
    path: '/analytics',
    title: 'Analytics Dashboard',
    description: 'Business analytics and insights',
    ssrConfig: {
      enabled: true,
      cacheStrategy: 'isr',
      revalidate: 900, // 15 minutes
      tags: ['analytics'],
      conditions: [
        {
          type: 'auth',
          value: 'required',
          strategy: 'ssr',
        },
        {
          type: 'permission',
          value: ['analytics:read'],
          strategy: 'ssr',
        },
      ],
    },
    preloadData: ['analytics-summary'],
  },

  // Admin pages - SSR only
  '/security': {
    path: '/security',
    title: 'Security Management',
    description: 'Enterprise security management',
    ssrConfig: {
      enabled: true,
      cacheStrategy: 'ssr',
      conditions: [
        {
          type: 'auth',
          value: 'required',
          strategy: 'ssr',
        },
        {
          type: 'permission',
          value: ['security:admin'],
          strategy: 'ssr',
        },
      ],
    },
    preloadData: ['security-status', 'audit-logs'],
  },
};

/**
 * SSR optimizer class
 */
class SSROptimizer {
  /**
   * Get rendering strategy for a page
   */
  getRenderingStrategy(
    path: string,
    context: {
      isAuthenticated?: boolean;
      permissions?: string[];
      tenantTier?: string;
      userAgent?: string;
    } = {}
  ): 'static' | 'isr' | 'ssr' | 'csr' {
    const config = PAGE_CONFIGS[path];
    if (!config || !config.ssrConfig.enabled) {
      return 'csr';
    }

    // Check conditions
    if (config.ssrConfig.conditions) {
      for (const condition of config.ssrConfig.conditions) {
        const strategy = this.evaluateCondition(condition, context);
        if (strategy) {
          return strategy;
        }
      }
    }

    return config.ssrConfig.cacheStrategy;
  }

  /**
   * Generate metadata for a page
   */
  generateMetadata(path: string, _context?: Record<string, unknown>): Metadata {
    const config = PAGE_CONFIGS[path];
    if (!config) {
      return {
        title: 'Next.js GraphQL Foundation',
        description: 'Enterprise business management platform',
      };
    }

    return {
      title: config.title,
      description: config.description,
      robots: {
        index: path === '/' || path === '/login',
        follow: true,
      },
      openGraph: {
        title: config.title,
        description: config.description,
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: config.title,
        description: config.description,
      },
    };
  }

  /**
   * Get preload data requirements for a page
   */
  getPreloadRequirements(path: string): string[] {
    const config = PAGE_CONFIGS[path];
    return config?.preloadData || [];
  }

  /**
   * Get ISR configuration for a page
   */
  getISRConfig(path: string): { revalidate?: number; tags?: string[] } {
    const config = PAGE_CONFIGS[path];
    if (!config || config.ssrConfig.cacheStrategy !== 'isr') {
      return {};
    }

    const result: { revalidate?: number; tags?: string[] } = {};
    
    if (config.ssrConfig.revalidate !== undefined) {
      result.revalidate = config.ssrConfig.revalidate;
    }
    
    if (config.ssrConfig.tags !== undefined) {
      result.tags = config.ssrConfig.tags;
    }
    
    return result;
  }

  /**
   * Evaluate SSR condition
   */
  private evaluateCondition(
    condition: SSRCondition,
    context: Record<string, unknown>
  ): 'static' | 'isr' | 'ssr' | 'csr' | null {
    switch (condition.type) {
      case 'auth':
        if (condition.value === 'required' && !context.isAuthenticated) {
          return 'csr'; // Redirect to login
        }
        break;

      case 'permission':
        const requiredPermissions = Array.isArray(condition.value) 
          ? condition.value 
          : [condition.value];
        const permissions = _context?.permissions;
        const hasPermission = Array.isArray(permissions) && requiredPermissions.some(perm =>
          (permissions as string[]).includes(perm as string)
        );
        if (!hasPermission) {
          return 'csr'; // Access denied
        }
        break;

      case 'device':
        // Mobile devices might prefer CSR for better interactivity
        const userAgent = _context?.userAgent;
        if (condition.value === 'mobile' && typeof userAgent === 'string' && this.isMobileDevice(userAgent)) {
          return condition.strategy;
        }
        break;

      case 'tenant':
        // Different strategies based on tenant tier
        if (_context?.tenantTier === condition.value) {
          return condition.strategy;
        }
        break;
    }

    return null;
  }

  /**
   * Check if user agent indicates mobile device
   */
  private isMobileDevice(userAgent?: string): boolean {
    if (!userAgent) return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  }

  /**
   * Generate static paths for static generation
   */
  getStaticPaths(): string[] {
    return Object.entries(PAGE_CONFIGS)
      .filter(([, config]) => config.ssrConfig.cacheStrategy === 'static')
      .map(([path]) => path);
  }

  /**
   * Get performance metrics for SSR optimization
   */
  getPerformanceMetrics() {
    return {
      staticPages: this.getStaticPaths().length,
      isrPages: Object.values(PAGE_CONFIGS).filter(
        config => config.ssrConfig.cacheStrategy === 'isr'
      ).length,
      ssrPages: Object.values(PAGE_CONFIGS).filter(
        config => config.ssrConfig.cacheStrategy === 'ssr'
      ).length,
      csrPages: Object.values(PAGE_CONFIGS).filter(
        config => config.ssrConfig.cacheStrategy === 'csr'
      ).length,
    };
  }
}

// Export singleton instance
export const ssrOptimizer = new SSROptimizer();

/**
 * Hook for SSR optimization in components
 */
export function useSSROptimization(path: string) {
  const strategy = ssrOptimizer.getRenderingStrategy(path);
  const preloadRequirements = ssrOptimizer.getPreloadRequirements(path);
  const isrConfig = ssrOptimizer.getISRConfig(path);

  return {
    strategy,
    preloadRequirements,
    isrConfig,
    shouldPreload: preloadRequirements.length > 0,
    isStatic: strategy === 'static',
    isISR: strategy === 'isr',
    isSSR: strategy === 'ssr',
    isCSR: strategy === 'csr',
  };
}