/**
 * Tenant Theme Provider
 * React component for providing tenant-specific theming
 * Requirements: 4.7
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  TenantThemingService, 
  ThemeConfig, 
  tenantThemingService 
} from './tenant-theming';
import { useTenantProvider } from './tenant-provider';
import { Tenant } from '@/types/core';

interface ThemeProviderProps {
  children: ReactNode;
  themingService?: TenantThemingService;
}

interface ThemeContextValue {
  theme: ThemeConfig;
  applyTenantTheme: (tenant: Tenant | null) => void;
  resetToDefault: () => void;
  getThemeVariables: () => Record<string, string | number>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Theme Provider Component
 * Automatically applies tenant-specific theming based on current tenant
 */
export function ThemeProvider({ children, themingService }: ThemeProviderProps) {
  const service = themingService || tenantThemingService;
  const [theme, setTheme] = useState<ThemeConfig>(service.getCurrentTheme());
  const { currentTenant } = useTenantProvider();

  // Subscribe to theme changes
  useEffect(() => {
    const unsubscribe = service.onThemeChange(setTheme);
    return unsubscribe;
  }, [service]);

  // Apply tenant theme when tenant changes
  useEffect(() => {
    service.applyTenantTheme(currentTenant);
  }, [currentTenant, service]);

  const contextValue: ThemeContextValue = {
    theme,
    applyTenantTheme: (tenant: Tenant | null) => service.applyTenantTheme(tenant),
    resetToDefault: () => service.resetToDefault(),
    getThemeVariables: () => service.getThemeVariables(),
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
}

/**
 * Higher-Order Component for theme context
 */
export function withTheme<P extends object>(
  Component: React.ComponentType<P & { theme: ThemeContextValue }>
) {
  return function ThemeWrapper(props: P) {
    const theme = useTheme();
    
    return <Component {...props} theme={theme} />;
  };
}

/**
 * Component for applying theme variables as CSS custom properties
 */
export function ThemeVariables() {
  const { getThemeVariables } = useTheme();
  
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    const variables = getThemeVariables();
    const root = document.documentElement;
    
    Object.entries(variables).forEach(([property, value]) => {
      root.style.setProperty(property, String(value));
    });
  }, [getThemeVariables]);
  
  return null;
}

/**
 * Component for conditional rendering based on theme features
 */
interface ThemeFeatureProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function ThemeFeature({ children }: ThemeFeatureProps) {
  return <>{children}</>;
}