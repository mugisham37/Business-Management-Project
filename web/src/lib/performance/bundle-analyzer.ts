/**
 * Bundle Analyzer - Utilities for bundle analysis and optimization
 * Provides runtime bundle analysis and optimization recommendations
 */

export interface BundleStats {
  totalSize: number;
  gzippedSize: number;
  chunks: ChunkInfo[];
  modules: ModuleInfo[];
  duplicates: DuplicateModule[];
  recommendations: OptimizationRecommendation[];
}

export interface ChunkInfo {
  name: string;
  size: number;
  gzippedSize: number;
  modules: string[];
  isAsync: boolean;
  isEntry: boolean;
}

export interface ModuleInfo {
  name: string;
  size: number;
  chunks: string[];
  reasons: string[];
}

export interface DuplicateModule {
  name: string;
  chunks: string[];
  totalSize: number;
}

export interface OptimizationRecommendation {
  type: 'split' | 'merge' | 'lazy' | 'preload' | 'remove';
  target: string;
  description: string;
  estimatedSavings: number;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Bundle analyzer for runtime optimization insights
 */
class BundleAnalyzer {
  private stats: BundleStats | null = null;

  /**
   * Analyze current bundle (development mode only)
   */
  async analyzeBundles(): Promise<BundleStats> {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('Bundle analysis is only available in development mode');
    }

    // In a real implementation, this would integrate with webpack-bundle-analyzer
    // For now, we'll provide a mock implementation
    const mockStats: BundleStats = {
      totalSize: 2500000, // 2.5MB
      gzippedSize: 800000, // 800KB
      chunks: [
        {
          name: 'main',
          size: 500000,
          gzippedSize: 150000,
          modules: ['react', 'react-dom', 'next'],
          isAsync: false,
          isEntry: true,
        },
        {
          name: 'vendors',
          size: 800000,
          gzippedSize: 250000,
          modules: ['@apollo/client', 'graphql', 'zustand'],
          isAsync: false,
          isEntry: false,
        },
        {
          name: 'warehouse',
          size: 200000,
          gzippedSize: 60000,
          modules: ['warehouse-module'],
          isAsync: true,
          isEntry: false,
        },
      ],
      modules: [],
      duplicates: [],
      recommendations: [],
    };

    this.stats = mockStats;
    this.generateRecommendations();
    
    return this.stats;
  }

  /**
   * Get bundle optimization recommendations
   */
  getRecommendations(): OptimizationRecommendation[] {
    if (!this.stats) {
      return [];
    }

    return this.stats.recommendations;
  }

  /**
   * Check if bundle size is within acceptable limits
   */
  validateBundleSize(): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    if (!this.stats) {
      issues.push('Bundle stats not available');
      return { isValid: false, issues, warnings };
    }

    // Check total bundle size (should be < 3MB)
    if (this.stats.totalSize > 3000000) {
      issues.push(`Total bundle size (${this.formatSize(this.stats.totalSize)}) exceeds 3MB limit`);
    }

    // Check gzipped size (should be < 1MB)
    if (this.stats.gzippedSize > 1000000) {
      issues.push(`Gzipped bundle size (${this.formatSize(this.stats.gzippedSize)}) exceeds 1MB limit`);
    }

    // Check for large chunks
    const largeChunks = this.stats.chunks.filter(chunk => chunk.size > 500000);
    if (largeChunks.length > 0) {
      warnings.push(`Large chunks detected: ${largeChunks.map(c => c.name).join(', ')}`);
    }

    // Check for duplicate modules
    if (this.stats.duplicates.length > 0) {
      warnings.push(`Duplicate modules detected: ${this.stats.duplicates.length} duplicates`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(): void {
    if (!this.stats) return;

    const recommendations: OptimizationRecommendation[] = [];

    // Check for large vendor chunks
    const vendorChunk = this.stats.chunks.find(chunk => chunk.name === 'vendors');
    if (vendorChunk && vendorChunk.size > 1000000) {
      recommendations.push({
        type: 'split',
        target: 'vendors',
        description: 'Split large vendor chunk into smaller chunks',
        estimatedSavings: vendorChunk.size * 0.3,
        priority: 'high',
      });
    }

    // Check for modules that should be lazy loaded
    const syncChunks = this.stats.chunks.filter(chunk => !chunk.isAsync && !chunk.isEntry);
    syncChunks.forEach(chunk => {
      if (chunk.size > 200000) {
        recommendations.push({
          type: 'lazy',
          target: chunk.name,
          description: `Convert ${chunk.name} to lazy loading`,
          estimatedSavings: chunk.size,
          priority: 'medium',
        });
      }
    });

    // Check for preload opportunities
    const asyncChunks = this.stats.chunks.filter(chunk => chunk.isAsync);
    asyncChunks.forEach(chunk => {
      if (chunk.size < 100000) {
        recommendations.push({
          type: 'preload',
          target: chunk.name,
          description: `Preload small async chunk ${chunk.name}`,
          estimatedSavings: 0, // Performance gain, not size savings
          priority: 'low',
        });
      }
    });

    this.stats.recommendations = recommendations;
  }

  /**
   * Format byte size for display
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Export bundle analysis report
   */
  exportReport(): string {
    if (!this.stats) {
      return 'No bundle stats available';
    }

    const validation = this.validateBundleSize();
    
    let report = '# Bundle Analysis Report\n\n';
    
    report += `## Summary\n`;
    report += `- Total Size: ${this.formatSize(this.stats.totalSize)}\n`;
    report += `- Gzipped Size: ${this.formatSize(this.stats.gzippedSize)}\n`;
    report += `- Chunks: ${this.stats.chunks.length}\n`;
    report += `- Status: ${validation.isValid ? '✅ Valid' : '❌ Issues Found'}\n\n`;

    if (validation.issues.length > 0) {
      report += `## Issues\n`;
      validation.issues.forEach(issue => {
        report += `- ❌ ${issue}\n`;
      });
      report += '\n';
    }

    if (validation.warnings.length > 0) {
      report += `## Warnings\n`;
      validation.warnings.forEach(warning => {
        report += `- ⚠️ ${warning}\n`;
      });
      report += '\n';
    }

    if (this.stats.recommendations.length > 0) {
      report += `## Recommendations\n`;
      this.stats.recommendations.forEach(rec => {
        const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        report += `- ${priority} ${rec.description}\n`;
      });
    }

    return report;
  }
}

// Export singleton instance
export const bundleAnalyzer = new BundleAnalyzer();

// Development-only bundle analysis hook
export function useBundleAnalysis() {
  const [stats, setStats] = useState<BundleStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const analyze = useCallback(async () => {
    if (process.env.NODE_ENV !== 'development') {
      setError(new Error('Bundle analysis is only available in development mode'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await bundleAnalyzer.analyzeBundles();
      setStats(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    stats,
    loading,
    error,
    analyze,
    recommendations: stats?.recommendations || [],
    validation: stats ? bundleAnalyzer.validateBundleSize() : null,
  };
}

// Add missing imports
import { useState, useCallback } from 'react';