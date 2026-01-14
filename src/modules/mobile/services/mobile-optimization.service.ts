import { Injectable, Logger } from '@nestjs/common';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

export interface MobileOptimizationOptions {
  deviceType: 'phone' | 'tablet' | 'desktop';
  connectionType: 'wifi' | 'cellular' | 'offline';
  batteryLevel?: number;
  dataUsageLimit?: number;
  compressionEnabled: boolean;
  progressiveLoading: boolean;
}

export interface OptimizedResponse<T> {
  data: T;
  metadata: {
    compressed: boolean;
    originalSize: number;
    compressedSize: number;
    loadingStrategy: 'full' | 'progressive' | 'cached';
    cacheHit: boolean;
    optimizationApplied: string[];
  };
}

@Injectable()
export class MobileOptimizationService {
  private readonly logger = new Logger(MobileOptimizationService.name);

  constructor(private readonly cacheService: IntelligentCacheService) {}

  /**
   * Optimize API response for mobile devices
   */
  async optimizeResponse<T>(
    data: T,
    options: MobileOptimizationOptions,
    cacheKey?: string,
  ): Promise<OptimizedResponse<T>> {
    const startTime = Date.now();
    const originalSize = this.calculateDataSize(data);
    let optimizedData = data;
    const optimizationsApplied: string[] = [];
    let compressed = false;
    let cacheHit = false;

    try {
      // Check cache first for mobile optimization
      if (cacheKey && options.connectionType !== 'offline') {
        const cachedData = await this.cacheService.get<T>(cacheKey);
        if (cachedData) {
          this.logger.debug(`Cache hit for mobile optimization: ${cacheKey}`);
          cacheHit = true;
          optimizedData = cachedData;
          optimizationsApplied.push('cache-hit');
        }
      }

      if (!cacheHit) {
        // Apply mobile-specific optimizations
        if (options.deviceType === 'phone') {
          optimizedData = this.optimizeForPhone(optimizedData);
          optimizationsApplied.push('phone-optimization');
        }

        if (options.connectionType === 'cellular') {
          optimizedData = this.optimizeForCellular(optimizedData);
          optimizationsApplied.push('cellular-optimization');
        }

        if (options.batteryLevel && options.batteryLevel < 20) {
          optimizedData = this.optimizeForLowBattery(optimizedData);
          optimizationsApplied.push('battery-optimization');
        }

        // Cache optimized data
        if (cacheKey) {
          await this.cacheService.set(cacheKey, optimizedData, { ttl: 300 }); // 5 minutes
          optimizationsApplied.push('cached');
        }
      }

      const compressedSize = this.calculateDataSize(optimizedData);
      compressed = compressedSize < originalSize;

      const processingTime = Date.now() - startTime;
      this.logger.debug(
        `Mobile optimization completed in ${processingTime}ms. ` +
        `Size: ${originalSize} -> ${compressedSize} bytes. ` +
        `Optimizations: ${optimizationsApplied.join(', ')}`,
      );

      return {
        data: optimizedData,
        metadata: {
          compressed,
          originalSize,
          compressedSize,
          loadingStrategy: cacheHit ? 'cached' : options.progressiveLoading ? 'progressive' : 'full',
          cacheHit,
          optimizationApplied: optimizationsApplied,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Mobile optimization failed: ${errorMessage}`, errorStack);
      
      // Return original data if optimization fails
      return {
        data,
        metadata: {
          compressed: false,
          originalSize,
          compressedSize: originalSize,
          loadingStrategy: 'full',
          cacheHit: false,
          optimizationApplied: ['optimization-failed'],
        },
      };
    }
  }

  /**
   * Optimize data specifically for phone devices
   */
  private optimizeForPhone<T>(data: T): T {
    if (Array.isArray(data)) {
      // Limit array size for phone screens
      return data.slice(0, 50) as T;
    }

    if (typeof data === 'object' && data !== null) {
      const optimized = { ...data } as Record<string, any>;
      
      // Remove heavy fields for phone optimization
      const fieldsToRemove = ['fullDescription', 'detailedMetadata', 'largeImages'];
      fieldsToRemove.forEach(field => {
        if (field in optimized) {
          delete optimized[field];
        }
      });

      return optimized as T;
    }

    return data;
  }

  /**
   * Optimize data for cellular connections
   */
  private optimizeForCellular<T>(data: T): T {
    if (Array.isArray(data)) {
      // Further reduce data for cellular
      return data.slice(0, 20) as T;
    }

    if (typeof data === 'object' && data !== null) {
      const optimized = { ...data } as Record<string, any>;
      
      // Remove non-essential fields for cellular
      const fieldsToRemove = ['images', 'attachments', 'richContent', 'analytics'];
      fieldsToRemove.forEach(field => {
        if (field in optimized) {
          delete optimized[field];
        }
      });

      return optimized as T;
    }

    return data;
  }

  /**
   * Optimize data for low battery scenarios
   */
  private optimizeForLowBattery<T>(data: T): T {
    if (Array.isArray(data)) {
      // Minimal data for battery conservation
      return data.slice(0, 10) as T;
    }

    if (typeof data === 'object' && data !== null) {
      const optimized = { ...data } as Record<string, any>;
      
      // Keep only essential fields
      const essentialFields = ['id', 'name', 'status', 'createdAt'];
      const keys = Object.keys(optimized);
      
      keys.forEach(key => {
        if (!essentialFields.includes(key)) {
          delete optimized[key];
        }
      });

      return optimized as T;
    }

    return data;
  }

  /**
   * Calculate approximate data size in bytes
   */
  private calculateDataSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      // Fallback calculation
      return JSON.stringify(data).length * 2; // Approximate UTF-16 encoding
    }
  }

  /**
   * Get mobile optimization recommendations
   */
  async getOptimizationRecommendations(
    tenantId: string,
    userId: string,
    deviceType: string,
  ): Promise<{
    recommendations: string[];
    estimatedSavings: {
      dataUsage: number;
      batteryUsage: number;
      loadTime: number;
    };
  }> {
    const recommendations: string[] = [];
    const estimatedSavings = {
      dataUsage: 0,
      batteryUsage: 0,
      loadTime: 0,
    };

    // Analyze usage patterns and provide recommendations
    if (deviceType === 'phone') {
      recommendations.push('Enable progressive loading for large lists');
      recommendations.push('Use image compression for product photos');
      recommendations.push('Cache frequently accessed data locally');
      
      estimatedSavings.dataUsage = 40; // 40% data savings
      estimatedSavings.batteryUsage = 25; // 25% battery savings
      estimatedSavings.loadTime = 60; // 60% faster load times
    }

    return {
      recommendations,
      estimatedSavings,
    };
  }
}