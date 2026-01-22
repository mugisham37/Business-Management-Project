/**
 * Permission Engine
 * Handles permission-based rendering and validation
 * Requirements: 3.5, 3.6
 */

import React from 'react';
import { User } from '@/types/core';

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface PermissionCheck {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface PermissionContext {
  user: User | null;
  permissions: string[];
  tenantId?: string;
  businessTier?: string;
}

/**
 * Permission Engine
 * Central system for permission validation and UI rendering control
 */
export class PermissionEngine {
  private context: PermissionContext;
  private permissionCache: Map<string, boolean> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(context: PermissionContext) {
    this.context = context;
  }

  /**
   * Update permission context
   */
  updateContext(context: Partial<PermissionContext>): void {
    this.context = { ...this.context, ...context };
    this.clearCache(); // Clear cache when context changes
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(permission: string | PermissionCheck): boolean {
    if (!this.context.user) {
      return false;
    }

    const cacheKey = this.getCacheKey(permission);
    const cached = this.permissionCache.get(cacheKey);
    
    if (cached !== undefined) {
      return cached;
    }

    const result = this.evaluatePermission(permission);
    this.permissionCache.set(cacheKey, result);
    
    // Auto-clear cache entry after timeout
    setTimeout(() => {
      this.permissionCache.delete(cacheKey);
    }, this.cacheTimeout);

    return result;
  }

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(permissions: (string | PermissionCheck)[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  /**
   * Check if user has all of the specified permissions
   */
  hasAllPermissions(permissions: (string | PermissionCheck)[]): boolean {
    return permissions.every(permission => this.hasPermission(permission));
  }

  /**
   * Check permission with resource and action
   */
  can(action: string, resource: string, conditions?: Record<string, any>): boolean {
    return this.hasPermission({ resource, action, conditions });
  }

  /**
   * Check if user cannot perform action (inverse of can)
   */
  cannot(action: string, resource: string, conditions?: Record<string, any>): boolean {
    return !this.can(action, resource, conditions);
  }

  /**
   * Get all permissions for current user
   */
  getUserPermissions(): string[] {
    return [...this.context.permissions];
  }

  /**
   * Get permissions filtered by resource
   */
  getResourcePermissions(resource: string): string[] {
    return this.context.permissions.filter(permission => 
      permission.includes(resource) || permission.includes('*')
    );
  }

  /**
   * Evaluate a single permission
   */
  private evaluatePermission(permission: string | PermissionCheck): boolean {
    if (typeof permission === 'string') {
      return this.evaluateStringPermission(permission);
    }

    return this.evaluateObjectPermission(permission);
  }

  /**
   * Evaluate string-based permission
   */
  private evaluateStringPermission(permission: string): boolean {
    // Direct permission match
    if (this.context.permissions.includes(permission)) {
      return true;
    }

    // Wildcard permission match
    if (this.context.permissions.includes('*')) {
      return true;
    }

    // Resource-level wildcard (e.g., "users.*" matches "users.read")
    const parts = permission.split('.');
    if (parts.length > 1) {
      const resourceWildcard = `${parts[0]}.*`;
      if (this.context.permissions.includes(resourceWildcard)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluate object-based permission with conditions
   */
  private evaluateObjectPermission(permission: PermissionCheck): boolean {
    const { resource, action, conditions } = permission;
    const permissionString = `${resource}.${action}`;

    // Check basic permission first
    if (!this.evaluateStringPermission(permissionString)) {
      return false;
    }

    // If no conditions, permission is granted
    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }

    // Evaluate conditions
    return this.evaluateConditions(conditions);
  }

  /**
   * Evaluate permission conditions
   */
  private evaluateConditions(conditions: Record<string, any>): boolean {
    // Tenant-based conditions
    if (conditions.tenantId && this.context.tenantId) {
      if (conditions.tenantId !== this.context.tenantId) {
        return false;
      }
    }

    // Business tier conditions
    if (conditions.businessTier && this.context.businessTier) {
      const requiredTier = conditions.businessTier;
      const userTier = this.context.businessTier;
      
      if (!this.isTierSufficient(userTier, requiredTier)) {
        return false;
      }
    }

    // User-based conditions
    if (conditions.userId && this.context.user) {
      if (conditions.userId !== this.context.user.id) {
        return false;
      }
    }

    // Custom condition evaluation can be added here
    
    return true;
  }

  /**
   * Check if user's business tier is sufficient for required tier
   */
  private isTierSufficient(userTier: string, requiredTier: string): boolean {
    const tierHierarchy = ['MICRO', 'SMALL', 'MEDIUM', 'ENTERPRISE'];
    const userIndex = tierHierarchy.indexOf(userTier);
    const requiredIndex = tierHierarchy.indexOf(requiredTier);
    
    return userIndex >= requiredIndex;
  }

  /**
   * Generate cache key for permission
   */
  private getCacheKey(permission: string | PermissionCheck): string {
    if (typeof permission === 'string') {
      return `${this.context.user?.id || 'anonymous'}:${permission}`;
    }

    const { resource, action, conditions } = permission;
    const conditionsStr = conditions ? JSON.stringify(conditions) : '';
    return `${this.context.user?.id || 'anonymous'}:${resource}.${action}:${conditionsStr}`;
  }

  /**
   * Clear permission cache
   */
  private clearCache(): void {
    this.permissionCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    // This would track hit/miss rates in a real implementation
    return {
      size: this.permissionCache.size,
      hitRate: 0, // Placeholder
    };
  }
}

/**
 * React Hook for permission checking
 */
export function usePermissions(context: PermissionContext) {
  const [engine] = React.useState(() => new PermissionEngine(context));

  React.useEffect(() => {
    engine.updateContext(context);
  }, [engine, context]);

  return {
    hasPermission: engine.hasPermission.bind(engine),
    hasAnyPermission: engine.hasAnyPermission.bind(engine),
    hasAllPermissions: engine.hasAllPermissions.bind(engine),
    can: engine.can.bind(engine),
    cannot: engine.cannot.bind(engine),
    getUserPermissions: engine.getUserPermissions.bind(engine),
    getResourcePermissions: engine.getResourcePermissions.bind(engine),
  };
}

/**
 * Higher-Order Component for permission-based rendering
 */
export interface WithPermissionsProps {
  permissions?: (string | PermissionCheck)[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  onUnauthorized?: () => void;
}

export function withPermissions<P extends object>(
  Component: React.ComponentType<P>,
  permissionProps: WithPermissionsProps
) {
  return function PermissionWrappedComponent(props: P & { permissionContext: PermissionContext }) {
    const { permissionContext, ...componentProps } = props;
    const { permissions = [], requireAll = false, fallback = null, onUnauthorized } = permissionProps;
    
    const engine = new PermissionEngine(permissionContext);
    
    const hasAccess = requireAll 
      ? engine.hasAllPermissions(permissions)
      : engine.hasAnyPermission(permissions);

    if (!hasAccess) {
      onUnauthorized?.();
      return fallback as React.ReactElement;
    }

    return <Component {...(componentProps as P)} />;
  };
}

/**
 * Permission Guard Component
 */
export interface PermissionGuardProps extends WithPermissionsProps {
  children: React.ReactNode;
  permissionContext: PermissionContext;
}

export function PermissionGuard({
  children,
  permissions = [],
  requireAll = false,
  fallback = null,
  onUnauthorized,
  permissionContext,
}: PermissionGuardProps) {
  const engine = new PermissionEngine(permissionContext);
  
  const hasAccess = requireAll 
    ? engine.hasAllPermissions(permissions)
    : engine.hasAnyPermission(permissions);

  if (!hasAccess) {
    onUnauthorized?.();
    return fallback as React.ReactElement;
  }

  return <>{children}</>;
}

/**
 * Permission-based conditional rendering hook
 */
export function usePermissionGuard(
  permissions: (string | PermissionCheck)[],
  context: PermissionContext,
  requireAll = false
): boolean {
  const engine = React.useMemo(() => new PermissionEngine(context), [context]);
  
  return React.useMemo(() => {
    return requireAll 
      ? engine.hasAllPermissions(permissions)
      : engine.hasAnyPermission(permissions);
  }, [engine, permissions, requireAll]);
}

// Default permission engine instance
let defaultPermissionEngine: PermissionEngine | null = null;

export function createPermissionEngine(context: PermissionContext): PermissionEngine {
  return new PermissionEngine(context);
}

export function getDefaultPermissionEngine(): PermissionEngine | null {
  return defaultPermissionEngine;
}

export function setDefaultPermissionEngine(engine: PermissionEngine): void {
  defaultPermissionEngine = engine;
}