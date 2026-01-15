import { Injectable, Logger } from '@nestjs/common';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

export interface DataUsageStats {
  totalUsage: number; // bytes
  uploadUsage: number; // bytes
  downloadUsage: number; // bytes
  compressionSavings: number; // bytes saved
  cacheHitRate: number; // percentage
  period: 'hour' | 'day' | 'week' | 'month';
  timestamp: Date;
}

export interface DataUsageLimit {
  userId: string;
  tenantId: string;
  dailyLimit: number; // bytes
  monthlyLimit: number; // bytes
  warningThreshold: number; // percentage (e.g., 80%)
  currentUsage: number; // bytes
  resetDate: Date;
  isActive: boolean;
}

export interface DataOptimizationSettings {
  enableCompression: boolean;
  compressionLevel: 'low' | 'medium' | 'high' | 'maximum';
  enableImageOptimization: boolean;
  imageQuality: 'low' | 'medium' | 'high';
  enableCaching: boolean;
  cacheStrategy: 'aggressive' | 'moderate' | 'conservative';
  enableOfflineMode: boolean;
  syncOnlyOnWifi: boolean;
  deferLargeDownloads: boolean;
  enableDataSaver: boolean;
}

export interface DataOptimizationResult {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  estimatedSavings: number; // bytes per day
  appliedOptimizations: string[];
  recommendations: string[];
}

@Injectable()
export class DataUsageOptimizationService {
  private readonly logger = new Logger(DataUsageOptimizationService.name);

  constructor(private readonly cacheService: IntelligentCacheService) {}

  /**
   * Optimize data usage based on connection type and limits
   */
  async optimizeDataUsage(
    connectionType: 'wifi' | 'cellular' | 'offline',
    dataLimit: DataUsageLimit | null,
    currentSettings: any,
    userId: string,
    tenantId: string,
  ): Promise<DataOptimizationResult> {
    try {
      this.logger.debug(
        `Optimizing data usage for ${connectionType} connection, user ${userId}`,
      );

      const optimizedSettings = { ...currentSettings };
      const appliedOptimizations: string[] = [];
      const recommendations: string[] = [];

      // Get current data usage stats
      const usageStats = await this.getDataUsageStats(userId, tenantId, 'day');

      // Apply optimizations based on connection type
      if (connectionType === 'cellular') {
        this.applyCellularOptimizations(optimizedSettings, appliedOptimizations);
      } else if (connectionType === 'offline') {
        this.applyOfflineOptimizations(optimizedSettings, appliedOptimizations);
      }

      // Apply optimizations based on data limit
      if (dataLimit && this.isApproachingLimit(dataLimit)) {
        this.applyDataLimitOptimizations(
          optimizedSettings,
          appliedOptimizations,
          dataLimit,
        );
      }

      // Generate recommendations
      recommendations.push(...this.generateDataOptimizationRecommendations(
        usageStats,
        connectionType,
        dataLimit,
      ));

      // Calculate estimated savings
      const originalSize = this.calculateDataSize(currentSettings);
      const optimizedSize = this.calculateDataSize(optimizedSettings);
      const compressionRatio = ((originalSize - optimizedSize) / originalSize) * 100;
      const estimatedSavings = this.calculateDailySavings(
        originalSize,
        optimizedSize,
        usageStats,
      );

      // Cache optimized settings
      await this.cacheOptimizedSettings(userId, tenantId, optimizedSettings);

      this.logger.log(
        `Data optimization completed for user ${userId}: ` +
        `${compressionRatio.toFixed(1)}% reduction, ` +
        `estimated ${this.formatBytes(estimatedSavings)} daily savings`,
      );

      return {
        originalSize,
        optimizedSize,
        compressionRatio,
        estimatedSavings,
        appliedOptimizations,
        recommendations,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Data usage optimization failed: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Track data usage for user
   */
  async trackDataUsage(
    userId: string,
    tenantId: string,
    operation: 'upload' | 'download',
    bytes: number,
    compressed: boolean = false,
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `data_usage:${tenantId}:${userId}:${today}`;
      
      let stats = await this.cacheService.get<DataUsageStats>(cacheKey);
      
      if (!stats) {
        stats = {
          totalUsage: 0,
          uploadUsage: 0,
          downloadUsage: 0,
          compressionSavings: 0,
          cacheHitRate: 0,
          period: 'day',
          timestamp: new Date(),
        };
      }

      // Update usage stats
      stats.totalUsage += bytes;
      if (operation === 'upload') {
        stats.uploadUsage += bytes;
      } else {
        stats.downloadUsage += bytes;
      }

      // Track compression savings
      if (compressed) {
        const estimatedUncompressedSize = bytes * 1.5; // Assume 33% compression
        stats.compressionSavings += (estimatedUncompressedSize - bytes);
      }

      await this.cacheService.set(cacheKey, stats, { ttl: 86400 }); // 24 hours

      // Check data limits
      const dataLimit = await this.getDataUsageLimit(userId, tenantId);
      if (dataLimit) {
        await this.checkDataLimitWarnings(userId, tenantId, dataLimit, stats);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to track data usage: ${errorMessage}`, errorStack);
    }
  }

  /**
   * Get data usage statistics
   */
  async getDataUsageStats(
    userId: string,
    tenantId: string,
    period: 'hour' | 'day' | 'week' | 'month',
  ): Promise<DataUsageStats> {
    try {
      const cacheKey = this.getDataUsageCacheKey(userId, tenantId, period);
      const stats = await this.cacheService.get<DataUsageStats>(cacheKey);
      
      if (stats) {
        return stats;
      }

      // Return default stats if none found
      return {
        totalUsage: 0,
        uploadUsage: 0,
        downloadUsage: 0,
        compressionSavings: 0,
        cacheHitRate: 0,
        period,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get data usage stats: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Set data usage limit for user
   */
  async setDataUsageLimit(
    userId: string,
    tenantId: string,
    dailyLimit: number,
    monthlyLimit: number,
    warningThreshold: number = 80,
  ): Promise<DataUsageLimit> {
    try {
      const dataLimit: DataUsageLimit = {
        userId,
        tenantId,
        dailyLimit,
        monthlyLimit,
        warningThreshold,
        currentUsage: 0,
        resetDate: this.getNextResetDate(),
        isActive: true,
      };

      await this.saveDataUsageLimit(dataLimit);
      
      this.logger.log(
        `Set data usage limit for user ${userId}: ` +
        `${this.formatBytes(dailyLimit)}/day, ${this.formatBytes(monthlyLimit)}/month`,
      );

      return dataLimit;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to set data usage limit: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get intelligent sync strategy based on data usage
   */
  async getIntelligentSyncStrategy(
    userId: string,
    tenantId: string,
    connectionType: 'wifi' | 'cellular' | 'offline',
  ): Promise<{
    syncNow: boolean;
    syncStrategy: 'full' | 'incremental' | 'critical_only' | 'defer';
    estimatedDataUsage: number;
    recommendations: string[];
  }> {
    try {
      const dataLimit = await this.getDataUsageLimit(userId, tenantId);
      const usageStats = await this.getDataUsageStats(userId, tenantId, 'day');
      
      let syncNow = true;
      let syncStrategy: 'full' | 'incremental' | 'critical_only' | 'defer' = 'full';
      let estimatedDataUsage = 1024 * 1024; // 1MB default
      const recommendations: string[] = [];

      if (connectionType === 'offline') {
        syncNow = false;
        syncStrategy = 'defer';
        estimatedDataUsage = 0;
        recommendations.push('Sync deferred until connection is available');
      } else if (connectionType === 'cellular') {
        // Be conservative on cellular
        syncStrategy = 'incremental';
        estimatedDataUsage = 512 * 1024; // 512KB
        
        if (dataLimit && this.isApproachingLimit(dataLimit)) {
          syncStrategy = 'critical_only';
          estimatedDataUsage = 128 * 1024; // 128KB
          recommendations.push('Syncing critical data only due to data limit');
        }
      } else if (connectionType === 'wifi') {
        // Full sync on WiFi
        syncStrategy = 'full';
        estimatedDataUsage = 2 * 1024 * 1024; // 2MB
        recommendations.push('Full sync recommended on WiFi');
      }

      // Check if we should defer sync due to data limits
      if (dataLimit && (usageStats.totalUsage + estimatedDataUsage) > dataLimit.dailyLimit) {
        syncNow = false;
        syncStrategy = 'defer';
        recommendations.push('Sync deferred to avoid exceeding daily data limit');
      }

      return {
        syncNow,
        syncStrategy,
        estimatedDataUsage,
        recommendations,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get intelligent sync strategy: ${errorMessage}`, errorStack);
      
      // Return conservative defaults on error
      return {
        syncNow: connectionType === 'wifi',
        syncStrategy: connectionType === 'wifi' ? 'full' : 'critical_only',
        estimatedDataUsage: 256 * 1024, // 256KB
        recommendations: ['Using conservative sync strategy due to error'],
      };
    }
  }

  /**
   * Create offline-first mobile experience
   */
  async createOfflineFirstExperience(
    userId: string,
    tenantId: string,
    essentialData: string[],
  ): Promise<{
    cachedData: string[];
    offlineCapabilities: string[];
    syncPriorities: Array<{ data: string; priority: number }>;
    estimatedOfflineTime: number; // hours
  }> {
    try {
      // Determine what data to cache for offline use
      const cachedData = [
        'user_profile',
        'recent_transactions',
        'product_catalog_subset',
        'customer_list_subset',
        ...essentialData,
      ];

      // Define offline capabilities
      const offlineCapabilities = [
        'create_transactions',
        'view_cached_data',
        'basic_calculations',
        'note_taking',
        'photo_capture',
        'queue_for_sync',
      ];

      // Set sync priorities (1 = highest, 10 = lowest)
      const syncPriorities = [
        { data: 'transactions', priority: 1 },
        { data: 'customer_updates', priority: 2 },
        { data: 'inventory_changes', priority: 3 },
        { data: 'user_preferences', priority: 4 },
        { data: 'analytics_data', priority: 8 },
        { data: 'reports', priority: 10 },
      ];

      // Estimate offline time based on cached data size
      const estimatedDataSize = cachedData.length * 100 * 1024; // 100KB per data type
      const estimatedOfflineTime = Math.min(estimatedDataSize / (50 * 1024), 72); // Max 72 hours

      // Cache the offline configuration
      const offlineConfig = {
        cachedData,
        offlineCapabilities,
        syncPriorities,
        estimatedOfflineTime,
        lastUpdated: new Date(),
      };

      const cacheKey = `offline_config:${tenantId}:${userId}`;
      await this.cacheService.set(cacheKey, offlineConfig, { ttl: 86400 }); // 24 hours

      this.logger.log(
        `Created offline-first experience for user ${userId}: ` +
        `${cachedData.length} data types cached, ${estimatedOfflineTime}h estimated offline time`,
      );

      return offlineConfig;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create offline-first experience: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Apply cellular connection optimizations
   */
  private applyCellularOptimizations(
    settings: any,
    appliedOptimizations: string[],
  ): void {
    // Enable maximum compression
    settings.dataCompression = 'maximum';
    settings.imageQuality = 'low';
    settings.enableImageOptimization = true;
    
    // Reduce sync frequency
    settings.syncInterval = Math.max(settings.syncInterval * 2, 1800); // At least 30 minutes
    settings.syncOnlyOnWifi = false; // Allow cellular sync but optimized
    
    // Enable aggressive caching
    settings.cacheStrategy = 'aggressive';
    settings.enableCaching = true;
    
    // Defer large downloads
    settings.deferLargeDownloads = true;
    settings.largeDownloadThreshold = 1024 * 1024; // 1MB
    
    // Enable data saver mode
    settings.enableDataSaver = true;
    
    appliedOptimizations.push(
      'cellular_optimization',
      'maximum_compression',
      'reduced_sync_frequency',
      'aggressive_caching',
      'deferred_large_downloads',
      'data_saver_mode',
    );
  }

  /**
   * Apply offline optimizations
   */
  private applyOfflineOptimizations(
    settings: any,
    appliedOptimizations: string[],
  ): void {
    // Disable all network operations
    settings.enableSync = false;
    settings.enableRealTimeUpdates = false;
    settings.enablePushNotifications = false;
    
    // Enable offline mode
    settings.enableOfflineMode = true;
    settings.offlineQueueEnabled = true;
    
    // Maximize local caching
    settings.cacheStrategy = 'aggressive';
    settings.offlineCacheDuration = 86400 * 7; // 7 days
    
    appliedOptimizations.push(
      'offline_mode',
      'disabled_network_operations',
      'enabled_offline_queue',
      'maximized_local_caching',
    );
  }

  /**
   * Apply data limit optimizations
   */
  private applyDataLimitOptimizations(
    settings: any,
    appliedOptimizations: string[],
    dataLimit: DataUsageLimit,
  ): void {
    const usagePercentage = (dataLimit.currentUsage / dataLimit.dailyLimit) * 100;
    
    if (usagePercentage > 90) {
      // Critical - minimal data usage
      settings.syncOnlyOnWifi = true;
      settings.dataCompression = 'maximum';
      settings.imageQuality = 'low';
      settings.deferAllNonCritical = true;
      
      appliedOptimizations.push('critical_data_limit', 'wifi_only_sync');
    } else if (usagePercentage > dataLimit.warningThreshold) {
      // Warning - conservative data usage
      settings.dataCompression = 'high';
      settings.syncInterval = Math.max(settings.syncInterval * 1.5, 1200);
      settings.deferLargeDownloads = true;
      
      appliedOptimizations.push('data_limit_warning', 'conservative_usage');
    }
  }

  /**
   * Generate data optimization recommendations
   */
  private generateDataOptimizationRecommendations(
    usageStats: DataUsageStats,
    connectionType: string,
    dataLimit: DataUsageLimit | null,
  ): string[] {
    const recommendations: string[] = [];

    if (usageStats.compressionSavings < usageStats.totalUsage * 0.2) {
      recommendations.push('Enable higher compression to save more data');
    }

    if (usageStats.cacheHitRate < 50) {
      recommendations.push('Improve caching strategy to reduce data usage');
    }

    if (connectionType === 'cellular' && usageStats.downloadUsage > usageStats.uploadUsage * 3) {
      recommendations.push('Consider syncing only critical data on cellular');
    }

    if (dataLimit && this.isApproachingLimit(dataLimit)) {
      recommendations.push('Approaching data limit - consider WiFi-only sync');
    }

    return recommendations;
  }

  /**
   * Check if approaching data limit
   */
  private isApproachingLimit(dataLimit: DataUsageLimit): boolean {
    const usagePercentage = (dataLimit.currentUsage / dataLimit.dailyLimit) * 100;
    return usagePercentage >= dataLimit.warningThreshold;
  }

  /**
   * Calculate data size for settings
   */
  private calculateDataSize(settings: any): number {
    // Mock calculation - in production, analyze actual data sizes
    let size = 1024 * 1024; // 1MB base
    
    if (settings.dataCompression === 'maximum') {
      size *= 0.3; // 70% reduction
    } else if (settings.dataCompression === 'high') {
      size *= 0.5; // 50% reduction
    } else if (settings.dataCompression === 'medium') {
      size *= 0.7; // 30% reduction
    }
    
    if (settings.imageQuality === 'low') {
      size *= 0.8; // 20% reduction for images
    }
    
    return Math.round(size);
  }

  /**
   * Calculate daily savings
   */
  private calculateDailySavings(
    originalSize: number,
    optimizedSize: number,
    usageStats: DataUsageStats,
  ): number {
    const savingsPerRequest = originalSize - optimizedSize;
    const estimatedDailyRequests = Math.max(usageStats.totalUsage / originalSize, 10);
    return savingsPerRequest * estimatedDailyRequests;
  }

  /**
   * Get data usage cache key
   */
  private getDataUsageCacheKey(
    userId: string,
    tenantId: string,
    period: string,
  ): string {
    const date = new Date();
    let dateKey = '';
    
    switch (period) {
      case 'hour':
        dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
        break;
      case 'day':
        dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        break;
      case 'week':
        const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
        dateKey = `${weekStart.getFullYear()}-W${Math.ceil(weekStart.getDate() / 7)}`;
        break;
      case 'month':
        dateKey = `${date.getFullYear()}-${date.getMonth()}`;
        break;
    }
    
    return `data_usage:${tenantId}:${userId}:${period}:${dateKey}`;
  }

  /**
   * Get data usage limit
   */
  private async getDataUsageLimit(
    userId: string,
    tenantId: string,
  ): Promise<DataUsageLimit | null> {
    const cacheKey = `data_limit:${tenantId}:${userId}`;
    return this.cacheService.get<DataUsageLimit>(cacheKey);
  }

  /**
   * Save data usage limit
   */
  private async saveDataUsageLimit(dataLimit: DataUsageLimit): Promise<void> {
    const cacheKey = `data_limit:${dataLimit.tenantId}:${dataLimit.userId}`;
    await this.cacheService.set(cacheKey, dataLimit, { ttl: 86400 * 30 }); // 30 days
  }

  /**
   * Cache optimized settings
   */
  private async cacheOptimizedSettings(
    userId: string,
    tenantId: string,
    settings: any,
  ): Promise<void> {
    const cacheKey = `data_optimized_settings:${tenantId}:${userId}`;
    await this.cacheService.set(cacheKey, settings, { ttl: 3600 }); // 1 hour
  }

  /**
   * Check data limit warnings
   */
  private async checkDataLimitWarnings(
    userId: string,
    tenantId: string,
    dataLimit: DataUsageLimit,
    stats: DataUsageStats,
  ): Promise<void> {
    const usagePercentage = (stats.totalUsage / dataLimit.dailyLimit) * 100;
    
    if (usagePercentage >= 100) {
      this.logger.warn(`User ${userId} exceeded daily data limit`);
      // In production, send notification or trigger data saving mode
    } else if (usagePercentage >= dataLimit.warningThreshold) {
      this.logger.warn(`User ${userId} approaching data limit: ${usagePercentage.toFixed(1)}%`);
      // In production, send warning notification
    }
  }

  /**
   * Get next reset date (monthly)
   */
  private getNextResetDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}