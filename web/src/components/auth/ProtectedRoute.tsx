/**
 * Protected Route Component
 * Demonstrates permission-based rendering
 */

'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PermissionGuard, type PermissionCheck } from '@/lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permissions?: (string | PermissionCheck)[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  permissions = [],
  requireAll = false,
  fallback,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    if (typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
    return null;
  }

  // If no permissions required, just check authentication
  if (permissions.length === 0) {
    return <>{children}</>;
  }

  // Use permission guard for permission-based rendering
  const permissionContext = {
    user,
    permissions: user?.permissions || [],
    tenantId: undefined, // Will be set by tenant context
    businessTier: undefined, // Will be set by tenant context
  };

  const defaultFallback = (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">You don't have permission to access this page.</p>
      </div>
    </div>
  );

  return (
    <PermissionGuard
      permissions={permissions}
      requireAll={requireAll}
      fallback={fallback || defaultFallback}
      permissionContext={permissionContext}
    >
      {children}
    </PermissionGuard>
  );
}

/**
 * Higher-order component for protecting components
 */
export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  routeProps: Omit<ProtectedRouteProps, 'children'>
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute {...routeProps}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}

/**
 * Permission-based conditional rendering component
 */
interface ConditionalRenderProps {
  children: React.ReactNode;
  permission: string | string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
}

export function ConditionalRender({
  children,
  permission,
  requireAll = false,
  fallback = null,
}: ConditionalRenderProps) {
  const { user, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();

  if (!user) {
    return fallback as React.ReactElement;
  }

  let hasAccess = false;

  if (typeof permission === 'string') {
    hasAccess = hasPermission(permission);
  } else {
    hasAccess = requireAll 
      ? hasAllPermissions(permission)
      : hasAnyPermission(permission);
  }

  if (!hasAccess) {
    return fallback as React.ReactElement;
  }

  return <>{children}</>;
}