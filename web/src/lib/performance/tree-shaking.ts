/**
 * Tree Shaking Utilities - Dead code elimination and import optimization
 * Provides utilities for analyzing and optimizing imports and exports
 */

export interface ImportAnalysis {
  module: string;
  imports: string[];
  usage: Record<string, boolean>;
  unusedImports: string[];
  recommendations: string[];
}

export interface TreeShakingReport {
  totalModules: number;
  analyzedModules: number;
  unusedImports: number;
  potentialSavings: number;
  recommendations: string[];
  moduleAnalysis: ImportAnalysis[];
}

/**
 * Tree shaking analyzer for development insights
 */
class TreeShakingAnalyzer {
  private moduleUsage = new Map<string, Set<string>>();
  private importMap = new Map<string, string[]>();

  /**
   * Register module usage (called by webpack plugin or build tool)
   */
  registerModuleUsage(moduleName: string, usedExports: string[]): void {
    this.moduleUsage.set(moduleName, new Set(usedExports));
  }

  /**
   * Register imports (called by webpack plugin or build tool)
   */
  registerImports(moduleName: string, imports: string[]): void {
    this.importMap.set(moduleName, imports);
  }

  /**
   * Analyze tree shaking effectiveness
   */
  analyzeTreeShaking(): TreeShakingReport {
    const moduleAnalysis: ImportAnalysis[] = [];
    let totalUnusedImports = 0;
    const globalRecommendations: string[] = [];

    // Analyze each module
    for (const [moduleName, imports] of this.importMap) {
      const usedExports = this.moduleUsage.get(moduleName) || new Set();
      const usage: Record<string, boolean> = {};
      const unusedImports: string[] = [];

      imports.forEach(importName => {
        const isUsed = usedExports.has(importName);
        usage[importName] = isUsed;
        if (!isUsed) {
          unusedImports.push(importName);
          totalUnusedImports++;
        }
      });

      const recommendations = this.generateModuleRecommendations(
        moduleName, 
        imports, 
        unusedImports
      );

      moduleAnalysis.push({
        module: moduleName,
        imports,
        usage,
        unusedImports,
        recommendations,
      });
    }

    // Generate global recommendations
    if (totalUnusedImports > 10) {
      globalRecommendations.push(
        'High number of unused imports detected. Consider cleaning up imports.'
      );
    }

    // Check for common optimization opportunities
    this.checkCommonOptimizations(moduleAnalysis, globalRecommendations);

    return {
      totalModules: this.importMap.size,
      analyzedModules: this.moduleUsage.size,
      unusedImports: totalUnusedImports,
      potentialSavings: this.estimateSavings(moduleAnalysis),
      recommendations: globalRecommendations,
      moduleAnalysis,
    };
  }

  /**
   * Generate recommendations for a specific module
   */
  private generateModuleRecommendations(
    moduleName: string,
    imports: string[],
    unusedImports: string[]
  ): string[] {
    const recommendations: string[] = [];

    // Check for unused imports
    if (unusedImports.length > 0) {
      recommendations.push(
        `Remove unused imports: ${unusedImports.join(', ')}`
      );
    }

    // Check for barrel imports that could be optimized
    if (moduleName.includes('index') && imports.length > 5) {
      recommendations.push(
        'Consider importing directly from source files instead of barrel exports'
      );
    }

    // Check for large library imports
    const largeLibraries = ['lodash', 'moment', 'antd', 'material-ui'];
    if (largeLibraries.some(lib => moduleName.includes(lib))) {
      recommendations.push(
        'Consider using specific imports instead of importing entire library'
      );
    }

    return recommendations;
  }

  /**
   * Check for common optimization opportunities
   */
  private checkCommonOptimizations(
    moduleAnalysis: ImportAnalysis[],
    recommendations: string[]
  ): void {
    // Check for lodash usage
    const lodashModules = moduleAnalysis.filter(m => 
      m.module.includes('lodash')
    );
    if (lodashModules.length > 0) {
      recommendations.push(
        'Consider using lodash-es or individual lodash functions for better tree shaking'
      );
    }

    // Check for moment.js usage
    const momentModules = moduleAnalysis.filter(m => 
      m.module.includes('moment')
    );
    if (momentModules.length > 0) {
      recommendations.push(
        'Consider replacing moment.js with date-fns or dayjs for smaller bundle size'
      );
    }

    // Check for duplicate functionality
    const duplicateChecks = [
      { libs: ['axios', 'fetch'], message: 'Multiple HTTP clients detected' },
      { libs: ['lodash', 'ramda'], message: 'Multiple utility libraries detected' },
      { libs: ['react-router', 'next/router'], message: 'Multiple routing libraries detected' },
    ];

    duplicateChecks.forEach(({ libs, message }) => {
      const foundLibs = libs.filter(lib => 
        moduleAnalysis.some(m => m.module.includes(lib))
      );
      if (foundLibs.length > 1) {
        recommendations.push(`${message}: ${foundLibs.join(', ')}`);
      }
    });
  }

  /**
   * Estimate potential bundle size savings
   */
  private estimateSavings(moduleAnalysis: ImportAnalysis[]): number {
    // Rough estimation based on unused imports
    // In reality, this would require actual bundle analysis
    let estimatedSavings = 0;

    moduleAnalysis.forEach(analysis => {
      const unusedRatio = analysis.unusedImports.length / analysis.imports.length;
      
      // Estimate savings based on module type and unused ratio
      let moduleSize = 10000; // Default 10KB
      
      if (analysis.module.includes('lodash')) moduleSize = 50000;
      else if (analysis.module.includes('moment')) moduleSize = 60000;
      else if (analysis.module.includes('antd')) moduleSize = 100000;
      else if (analysis.module.includes('@apollo')) moduleSize = 80000;
      
      estimatedSavings += moduleSize * unusedRatio;
    });

    return estimatedSavings;
  }

  /**
   * Get optimization suggestions for webpack config
   */
  getWebpackOptimizations(): Record<string, unknown> {
    return {
      optimization: {
        usedExports: true,
        sideEffects: false,
        concatenateModules: true,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
          },
        },
      },
      resolve: {
        alias: {
          // Optimize common libraries
          'lodash': 'lodash-es',
        },
      },
    };
  }

  /**
   * Clear analysis data
   */
  clear(): void {
    this.moduleUsage.clear();
    this.importMap.clear();
  }
}

/**
 * Import optimizer for runtime analysis
 */
export class ImportOptimizer {
  /**
   * Analyze import statements in code (for development tools)
   */
  static analyzeImports(code: string): {
    imports: string[];
    suggestions: string[];
  } {
    const imports: string[] = [];
    const suggestions: string[] = [];

    // Simple regex-based analysis (in production, use AST parser)
    const importRegex = /import\s+(?:{([^}]+)}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(code)) !== null) {
      const [, namedImports, moduleNameMatch] = match;
      
      if (namedImports && moduleNameMatch) {
        const importNames = namedImports.split(',').map(s => s.trim());
        imports.push(...importNames);

        // Generate suggestions
        if (moduleNameMatch === 'lodash' && importNames.length > 0) {
          suggestions.push(
            `Consider importing lodash functions individually: import ${importNames[0]} from 'lodash/${importNames[0]}'`
          );
        }

        if (moduleNameMatch.includes('antd') && importNames.length > 3) {
          suggestions.push(
            'Consider using babel-plugin-import for antd to reduce bundle size'
          );
        }
      }
    }

    return { imports, suggestions };
  }

  /**
   * Generate optimized import statement
   */
  static optimizeImport(moduleName: string, imports: string[]): string {
    // Optimization rules for common libraries
    const optimizations: Record<string, (imports: string[]) => string> = {
      'lodash': (imports) => 
        imports.map(imp => `import ${imp} from 'lodash/${imp}';`).join('\n'),
      
      'date-fns': (imports) =>
        imports.map(imp => `import ${imp} from 'date-fns/${imp}';`).join('\n'),
      
      'rxjs': (imports) => {
        const operators = imports.filter(imp => 
          ['map', 'filter', 'tap', 'switchMap', 'mergeMap'].includes(imp)
        );
        const others = imports.filter(imp => !operators.includes(imp));
        
        let result = '';
        if (others.length > 0) {
          result += `import { ${others.join(', ')} } from 'rxjs';\n`;
        }
        if (operators.length > 0) {
          result += `import { ${operators.join(', ')} } from 'rxjs/operators';`;
        }
        return result;
      },
    };

    const optimizer = optimizations[moduleName];
    if (optimizer) {
      return optimizer(imports);
    }

    // Default: named imports
    return `import { ${imports.join(', ')} } from '${moduleName}';`;
  }
}

// Export singleton instance
export const treeShakingAnalyzer = new TreeShakingAnalyzer();

/**
 * Hook for tree shaking analysis in development
 */
export function useTreeShakingAnalysis() {
  const [report, setReport] = useState<TreeShakingReport | null>(null);
  const [loading, setLoading] = useState(false);

  const analyzeTreeShaking = useCallback(async () => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    setLoading(true);
    
    try {
      // In a real implementation, this would integrate with webpack stats
      // For now, we'll provide a mock analysis
      const mockReport: TreeShakingReport = {
        totalModules: 45,
        analyzedModules: 42,
        unusedImports: 12,
        potentialSavings: 150000, // 150KB
        recommendations: [
          'Remove unused imports from utility modules',
          'Consider using lodash-es for better tree shaking',
          'Replace moment.js with date-fns for smaller bundle size',
        ],
        moduleAnalysis: [
          {
            module: 'lodash',
            imports: ['map', 'filter', 'reduce', 'forEach', 'find'],
            usage: { map: true, filter: true, reduce: false, forEach: true, find: false },
            unusedImports: ['reduce', 'find'],
            recommendations: ['Remove unused imports: reduce, find'],
          },
        ],
      };

      setReport(mockReport);
    } catch (error) {
      console.error('Tree shaking analysis failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    report,
    loading,
    analyzeTreeShaking,
  };
}

// Add missing import
import { useState, useCallback } from 'react';