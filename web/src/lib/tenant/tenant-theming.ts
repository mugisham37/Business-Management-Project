/**
 * Tenant-Specific Theming System
 * Dynamic theming based on tenant branding and configuration
 * Requirements: 4.7
 */

import React from 'react';
import { BrandingConfig, Tenant } from '@/types/core';

export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    accent?: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
    };
    fontWeight: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  customCss?: string;
}

export interface ThemeVariables {
  [key: string]: string | number;
}

/**
 * Default theme configuration
 */
const DEFAULT_THEME: ThemeConfig = {
  colors: {
    primary: '#3b82f6',
    secondary: '#64748b',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#1e293b',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    error: '#ef4444',
    warning: '#f59e0b',
    success: '#10b981',
    info: '#3b82f6',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
};

/**
 * Tenant Theming Service
 * Manages dynamic theming based on tenant branding configuration
 */
export class TenantThemingService {
  private currentTheme: ThemeConfig = DEFAULT_THEME;
  private themeListeners: Set<(theme: ThemeConfig) => void> = new Set();
  private cssVariablesApplied = false;

  /**
   * Apply tenant-specific theme
   */
  applyTenantTheme(tenant: Tenant | null): void {
    if (!tenant || !tenant.branding) {
      this.applyTheme(DEFAULT_THEME);
      return;
    }

    const tenantTheme = this.createTenantTheme(tenant.branding);
    this.applyTheme(tenantTheme);
  }

  /**
   * Create theme configuration from tenant branding
   */
  createTenantTheme(branding: BrandingConfig): ThemeConfig {
    const theme: ThemeConfig = {
      ...DEFAULT_THEME,
      colors: {
        ...DEFAULT_THEME.colors,
        primary: branding.primaryColor || DEFAULT_THEME.colors.primary,
        secondary: branding.secondaryColor || DEFAULT_THEME.colors.secondary,
      },
      ...(branding.customCss && { customCss: branding.customCss }),
    };

    // Generate complementary colors based on primary color
    if (branding.primaryColor) {
      theme.colors = {
        ...theme.colors,
        ...this.generateComplementaryColors(branding.primaryColor),
      };
    }

    return theme;
  }

  /**
   * Apply theme configuration
   */
  applyTheme(theme: ThemeConfig): void {
    this.currentTheme = theme;
    
    // Apply CSS variables
    this.applyCssVariables();
    
    // Apply custom CSS if provided
    if (theme.customCss) {
      this.applyCustomCss(theme.customCss);
    }
    
    // Apply favicon if provided in branding
    this.applyFavicon();
    
    // Notify listeners
    this.notifyThemeChange(theme);
  }

  /**
   * Get current theme configuration
   */
  getCurrentTheme(): ThemeConfig {
    return { ...this.currentTheme };
  }

  /**
   * Subscribe to theme changes
   */
  onThemeChange(listener: (theme: ThemeConfig) => void): () => void {
    this.themeListeners.add(listener);
    // Immediately call with current theme
    listener(this.currentTheme);
    
    return () => this.themeListeners.delete(listener);
  }

  /**
   * Generate CSS variables object from theme
   */
  getThemeVariables(): ThemeVariables {
    const variables: ThemeVariables = {};
    
    // Color variables
    Object.entries(this.currentTheme.colors).forEach(([key, value]) => {
      variables[`--color-${key}`] = value;
    });
    
    // Typography variables
    variables['--font-family'] = this.currentTheme.typography.fontFamily;
    Object.entries(this.currentTheme.typography.fontSize).forEach(([key, value]) => {
      variables[`--font-size-${key}`] = value;
    });
    Object.entries(this.currentTheme.typography.fontWeight).forEach(([key, value]) => {
      variables[`--font-weight-${key}`] = value;
    });
    
    // Spacing variables
    Object.entries(this.currentTheme.spacing).forEach(([key, value]) => {
      variables[`--spacing-${key}`] = value;
    });
    
    // Border radius variables
    Object.entries(this.currentTheme.borderRadius).forEach(([key, value]) => {
      variables[`--border-radius-${key}`] = value;
    });
    
    // Shadow variables
    Object.entries(this.currentTheme.shadows).forEach(([key, value]) => {
      variables[`--shadow-${key}`] = value;
    });
    
    return variables;
  }

  /**
   * Reset to default theme
   */
  resetToDefault(): void {
    this.applyTheme(DEFAULT_THEME);
    this.removeCustomCss();
  }

  /**
   * Apply CSS variables to document root
   */
  private applyCssVariables(): void {
    if (typeof document === 'undefined') return;
    
    const root = document.documentElement;
    const variables = this.getThemeVariables();
    
    Object.entries(variables).forEach(([property, value]) => {
      root.style.setProperty(property, String(value));
    });
    
    this.cssVariablesApplied = true;
  }

  /**
   * Apply custom CSS styles
   */
  private applyCustomCss(customCss: string): void {
    if (typeof document === 'undefined') return;
    
    // Remove existing custom CSS
    this.removeCustomCss();
    
    // Create and append new style element
    const styleElement = document.createElement('style');
    styleElement.id = 'tenant-custom-css';
    styleElement.textContent = customCss;
    document.head.appendChild(styleElement);
  }

  /**
   * Remove custom CSS styles
   */
  private removeCustomCss(): void {
    if (typeof document === 'undefined') return;
    
    const existingStyle = document.getElementById('tenant-custom-css');
    if (existingStyle) {
      existingStyle.remove();
    }
  }

  /**
   * Apply tenant favicon
   */
  private applyFavicon(): void {
    if (typeof document === 'undefined') return;
    
    // This would be implemented based on tenant branding configuration
    // For now, we'll just log that it would be applied
    console.log('Favicon would be applied based on tenant branding');
  }

  /**
   * Generate complementary colors from primary color
   */
  private generateComplementaryColors(primaryColor: string): Partial<ThemeConfig['colors']> {
    // This is a simplified implementation
    // In a real application, you'd use a color manipulation library
    // to generate proper complementary colors, shades, and tints
    
    return {
      primary: primaryColor,
      // You could generate accent, hover states, etc. here
    };
  }

  /**
   * Notify all theme change listeners
   */
  private notifyThemeChange(theme: ThemeConfig): void {
    this.themeListeners.forEach(listener => {
      try {
        listener(theme);
      } catch (error) {
        console.error('Error in theme change listener:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.themeListeners.clear();
    this.removeCustomCss();
    
    if (this.cssVariablesApplied && typeof document !== 'undefined') {
      // Reset CSS variables to defaults
      const root = document.documentElement;
      const variables = this.getThemeVariables();
      
      Object.keys(variables).forEach(property => {
        root.style.removeProperty(property);
      });
    }
  }
}

/**
 * React hook for tenant theming
 */
export function useTenantTheming() {
  const [theme, setTheme] = React.useState<ThemeConfig>(DEFAULT_THEME);
  
  React.useEffect(() => {
    const unsubscribe = tenantThemingService.onThemeChange(setTheme);
    return unsubscribe;
  }, []);
  
  return {
    theme,
    applyTenantTheme: (tenant: Tenant | null) => tenantThemingService.applyTenantTheme(tenant),
    resetToDefault: () => tenantThemingService.resetToDefault(),
    getThemeVariables: () => tenantThemingService.getThemeVariables(),
  };
}

// Export singleton instance
export const tenantThemingService = new TenantThemingService();