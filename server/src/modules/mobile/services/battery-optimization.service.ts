import { Injectable, Logger } from '@nestjs/common';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

export interface BatteryStatus {
  level: number; // 0-100
  charging: boolean;
  chargingTime?: number; // minutes until fully charged
  dischargingTime?: number; // minutes until empty
  lowBattery: boolean; // < 20%
  criticalBattery: boolean; // < 10%
}

export interface BatteryOptimizationSettings {
  enableLowPowerMode: boolean;
  reducedSyncFrequency: boolean;
  limitBackgroundProcessing: boolean;
  compressData: boolean;
  reduceAnimations: boolean;
  dimScreen: boolean;
  disableNonEssentialFeatures: boolean;
  emergencyMode: boolean; // < 5% battery
}

export interface PowerConsumptionProfile {
  userId: string;
  tenantId: string;
  deviceId: string;
  averageBatteryDrain: number; // % per hour
  heavyUsagePatterns: string[];
  optimalSyncTimes: string[];
  recommendedSettings: BatteryOptimizationSettings;
  lastUpdated: Date;
}

export interface BatteryOptimizationResult {
  originalSettings: any;
  optimizedSettings: any;
  estimatedSavings: {
    batteryLife: number; // percentage increase
    dataUsage: number; // percentage decrease
    performance: number; // percentage impact
  };
  appliedOptimizations: string[];
}

@Injectable()
export class BatteryOptimizationService {
  private readonly logger = new Logger(BatteryOptimizationService.name);

  constructor(private readonly cacheService: IntelligentCacheService) {}

  /**
   * Optimize settings based on battery status
   */
  async optimizeForBattery(
    batteryStatus: BatteryStatus,
    currentSettings: any,
    userId: string,
    tenantId: string,
  ): Promise<BatteryOptimizationResult> {
    try {
      this.logger.debug(`Optimizing for battery level: ${batteryStatus.level}% for user ${userId}`);

      const optimizedSettings = { ...currentSettings };
      const appliedOptimizations: string[] = [];

      // Get user's power consumption profile
      const profile = await this.getPowerConsumptionProfile(userId, tenantId);

      if (batteryStatus.criticalBattery) {
        // Emergency mode - maximum power saving
        this.applyEmergencyOptimizations(optimizedSettings, appliedOptimizations);
      } else if (batteryStatus.lowBattery) {
        // Low battery mode - aggressive power saving
        this.applyLowBatteryOptimizations(optimizedSettings, appliedOptimizations, profile);
      } else if (batteryStatus.level < 50 && !batteryStatus.charging) {
        // Moderate battery saving
        this.applyModerateBatteryOptimizations(optimizedSettings, appliedOptimizations, profile);
      }

      // Calculate estimated savings
      const estimatedSavings = this.calculateEstimatedSavings(
        currentSettings,
        optimizedSettings,
        batteryStatus,
        profile,
      );

      // Cache optimized settings
      await this.cacheOptimizedSettings(userId, tenantId, optimizedSettings);

      this.logger.log(
        `Battery optimization completed for user ${userId}: ` +
        `${appliedOptimizations.length} optimizations applied, ` +
        `estimated ${estimatedSavings.batteryLife}% battery life increase`,
      );

      return {
        originalSettings: currentSettings,
        optimizedSettings,
        estimatedSavings,
        appliedOptimizations,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Battery optimization failed: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Create power consumption profile for user
   */
  async createPowerConsumptionProfile(
    userId: string,
    tenantId: string,
    deviceId: string,
    usageData: {
      batteryDrainRate: number;
      activeFeatures: string[];
      syncFrequency: number;
      screenTime: number;
    },
  ): Promise<PowerConsumptionProfile> {
    try {
      const profile: PowerConsumptionProfile = {
        userId,
        tenantId,
        deviceId,
        averageBatteryDrain: usageData.batteryDrainRate,
        heavyUsagePatterns: this.identifyHeavyUsagePatterns(usageData),
        optimalSyncTimes: this.calculateOptimalSyncTimes(usageData),
        recommendedSettings: this.generateRecommendedSettings(usageData),
        lastUpdated: new Date(),
      };

      await this.savePowerConsumptionProfile(profile);
      
      this.logger.log(`Created power consumption profile for user ${userId}`);
      return profile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create power consumption profile: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get intelligent sync schedule based on battery and usage patterns
   */
  async getIntelligentSyncSchedule(
    userId: string,
    tenantId: string,
    batteryStatus: BatteryStatus,
  ): Promise<{
    nextSyncTime: Date;
    syncInterval: number; // minutes
    priorityData: string[];
    deferredData: string[];
  }> {
    try {
      const profile = await this.getPowerConsumptionProfile(userId, tenantId);
      
      let syncInterval = 15; // Default 15 minutes
      let priorityData = ['transactions', 'inventory', 'customers'];
      let deferredData: string[] = [];

      if (batteryStatus.criticalBattery) {
        // Emergency mode - sync only critical data every hour
        syncInterval = 60;
        priorityData = ['transactions'];
        deferredData = ['inventory', 'customers', 'analytics', 'reports'];
      } else if (batteryStatus.lowBattery) {
        // Low battery - reduce sync frequency
        syncInterval = 30;
        deferredData = ['analytics', 'reports'];
      } else if (!batteryStatus.charging && batteryStatus.level < 50) {
        // Moderate battery saving
        syncInterval = 20;
        deferredData = ['reports'];
      }

      // Adjust based on user's optimal sync times
      const now = new Date();
      const currentHour = now.getHours();
      const isOptimalTime = profile?.optimalSyncTimes.includes(currentHour.toString());

      if (!isOptimalTime && batteryStatus.level < 30) {
        // Defer non-critical syncs if not optimal time and low battery
        syncInterval *= 2;
      }

      const nextSyncTime = new Date(now.getTime() + syncInterval * 60 * 1000);

      return {
        nextSyncTime,
        syncInterval,
        priorityData,
        deferredData,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get intelligent sync schedule: ${errorMessage}`, errorStack);
      
      // Return default schedule on error
      return {
        nextSyncTime: new Date(Date.now() + 15 * 60 * 1000),
        syncInterval: 15,
        priorityData: ['transactions'],
        deferredData: [],
      };
    }
  }

  /**
   * Minimize background processing based on battery status
   */
  async minimizeBackgroundProcessing(
    batteryStatus: BatteryStatus,
    activeProcesses: string[],
  ): Promise<{
    allowedProcesses: string[];
    deferredProcesses: string[];
    suspendedProcesses: string[];
  }> {
    const allowedProcesses: string[] = [];
    const deferredProcesses: string[] = [];
    const suspendedProcesses: string[] = [];

    // Essential processes that should always run
    const essentialProcesses = [
      'authentication',
      'security',
      'critical_notifications',
      'pos_transactions',
    ];

    // Non-essential processes that can be deferred or suspended
    const nonEssentialProcesses = [
      'analytics_processing',
      'report_generation',
      'data_export',
      'cache_warming',
      'log_processing',
    ];

    for (const process of activeProcesses) {
      if (essentialProcesses.includes(process)) {
        allowedProcesses.push(process);
      } else if (batteryStatus.criticalBattery) {
        suspendedProcesses.push(process);
      } else if (batteryStatus.lowBattery && nonEssentialProcesses.includes(process)) {
        deferredProcesses.push(process);
      } else {
        allowedProcesses.push(process);
      }
    }

    this.logger.debug(
      `Background processing optimization: ${allowedProcesses.length} allowed, ` +
      `${deferredProcesses.length} deferred, ${suspendedProcesses.length} suspended`,
    );

    return {
      allowedProcesses,
      deferredProcesses,
      suspendedProcesses,
    };
  }

  /**
   * Get battery optimization recommendations
   */
  async getBatteryOptimizationRecommendations(
    userId: string,
    tenantId: string,
    batteryStatus: BatteryStatus,
  ): Promise<{
    recommendations: Array<{
      type: 'setting' | 'behavior' | 'feature';
      title: string;
      description: string;
      impact: 'high' | 'medium' | 'low';
      estimatedSavings: number; // percentage
    }>;
    currentOptimizationLevel: number; // 0-100
  }> {
    try {
      const profile = await this.getPowerConsumptionProfile(userId, tenantId);
      const recommendations = [];

      // Analyze current settings and usage patterns
      if (profile && profile.averageBatteryDrain > 15) { // > 15% per hour is high
        recommendations.push({
          type: 'setting' as const,
          title: 'Reduce Sync Frequency',
          description: 'Sync data less frequently to save battery',
          impact: 'high' as const,
          estimatedSavings: 25,
        });
      }

      if (batteryStatus.level < 30) {
        recommendations.push({
          type: 'feature' as const,
          title: 'Enable Low Power Mode',
          description: 'Automatically optimize settings for battery saving',
          impact: 'high' as const,
          estimatedSavings: 30,
        });
      }

      if (profile?.heavyUsagePatterns.includes('real_time_updates')) {
        recommendations.push({
          type: 'behavior' as const,
          title: 'Limit Real-time Updates',
          description: 'Reduce frequency of live data updates',
          impact: 'medium' as const,
          estimatedSavings: 15,
        });
      }

      recommendations.push({
        type: 'setting' as const,
        title: 'Compress Data Transfers',
        description: 'Enable data compression to reduce network usage',
        impact: 'medium' as const,
        estimatedSavings: 10,
      });

      // Calculate current optimization level
      const currentOptimizationLevel = this.calculateOptimizationLevel(profile, batteryStatus);

      return {
        recommendations,
        currentOptimizationLevel,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get battery recommendations: ${errorMessage}`, errorStack);
      return {
        recommendations: [],
        currentOptimizationLevel: 0,
      };
    }
  }

  /**
   * Apply emergency optimizations (< 5% battery)
   */
  private applyEmergencyOptimizations(
    settings: any,
    appliedOptimizations: string[],
  ): void {
    // Disable all non-essential features
    settings.realTimeUpdates = false;
    settings.backgroundSync = false;
    settings.pushNotifications = false;
    settings.locationTracking = false;
    settings.cameraFeatures = false;
    settings.animations = false;
    settings.autoSave = false;
    
    // Minimal sync - only critical data
    settings.syncInterval = 3600; // 1 hour
    settings.syncOnlyTransactions = true;
    
    // Maximum compression
    settings.dataCompression = 'maximum';
    settings.imageQuality = 'lowest';
    
    appliedOptimizations.push(
      'emergency_mode',
      'disabled_non_essential_features',
      'minimal_sync',
      'maximum_compression',
    );
  }

  /**
   * Apply low battery optimizations (< 20% battery)
   */
  private applyLowBatteryOptimizations(
    settings: any,
    appliedOptimizations: string[],
    profile?: PowerConsumptionProfile,
  ): void {
    // Reduce sync frequency
    settings.syncInterval = Math.max(settings.syncInterval * 2, 1800); // At least 30 minutes
    
    // Disable heavy features
    settings.realTimeUpdates = false;
    settings.locationTracking = false;
    settings.animations = false;
    
    // Enable compression
    settings.dataCompression = 'high';
    settings.imageQuality = 'low';
    
    // Reduce background processing
    settings.backgroundProcessing = 'minimal';
    
    // Defer non-critical notifications
    settings.deferNonCriticalNotifications = true;
    
    appliedOptimizations.push(
      'low_battery_mode',
      'reduced_sync_frequency',
      'disabled_heavy_features',
      'high_compression',
      'minimal_background_processing',
    );
  }

  /**
   * Apply moderate battery optimizations (< 50% battery, not charging)
   */
  private applyModerateBatteryOptimizations(
    settings: any,
    appliedOptimizations: string[],
    profile?: PowerConsumptionProfile,
  ): void {
    // Slightly reduce sync frequency
    settings.syncInterval = Math.max(settings.syncInterval * 1.5, 1200); // At least 20 minutes
    
    // Enable moderate compression
    settings.dataCompression = 'medium';
    
    // Reduce animation frequency
    settings.animationFrequency = 'reduced';
    
    // Optimize based on usage patterns
    if (profile?.heavyUsagePatterns.includes('real_time_updates')) {
      settings.realTimeUpdateInterval = Math.max(settings.realTimeUpdateInterval * 2, 30);
    }
    
    appliedOptimizations.push(
      'moderate_battery_saving',
      'reduced_sync_frequency',
      'medium_compression',
      'reduced_animations',
    );
  }

  /**
   * Calculate estimated savings
   */
  private calculateEstimatedSavings(
    originalSettings: any,
    optimizedSettings: any,
    batteryStatus: BatteryStatus,
    profile?: PowerConsumptionProfile,
  ): { batteryLife: number; dataUsage: number; performance: number } {
    let batteryLife = 0;
    let dataUsage = 0;
    let performance = 0;

    // Calculate battery life improvement
    if (optimizedSettings.syncInterval > originalSettings.syncInterval) {
      const syncReduction = optimizedSettings.syncInterval / originalSettings.syncInterval;
      batteryLife += Math.min(syncReduction * 15, 40); // Up to 40% improvement
    }

    if (!optimizedSettings.realTimeUpdates && originalSettings.realTimeUpdates) {
      batteryLife += 20;
    }

    if (!optimizedSettings.locationTracking && originalSettings.locationTracking) {
      batteryLife += 15;
    }

    // Calculate data usage reduction
    if (optimizedSettings.dataCompression === 'maximum') {
      dataUsage += 60;
    } else if (optimizedSettings.dataCompression === 'high') {
      dataUsage += 40;
    } else if (optimizedSettings.dataCompression === 'medium') {
      dataUsage += 25;
    }

    // Calculate performance impact (negative)
    if (!optimizedSettings.realTimeUpdates) {
      performance -= 10;
    }

    if (optimizedSettings.syncInterval > originalSettings.syncInterval * 2) {
      performance -= 15;
    }

    return {
      batteryLife: Math.min(batteryLife, 70), // Cap at 70%
      dataUsage: Math.min(dataUsage, 80), // Cap at 80%
      performance: Math.max(performance, -30), // Cap at -30%
    };
  }

  /**
   * Get power consumption profile
   */
  private async getPowerConsumptionProfile(
    userId: string,
    tenantId: string,
  ): Promise<PowerConsumptionProfile | undefined> {
    const cacheKey = `power_profile:${tenantId}:${userId}`;
    const cached = await this.cacheService.get<PowerConsumptionProfile>(cacheKey);
    return cached || undefined;
  }

  /**
   * Save power consumption profile
   */
  private async savePowerConsumptionProfile(profile: PowerConsumptionProfile): Promise<void> {
    const cacheKey = `power_profile:${profile.tenantId}:${profile.userId}`;
    await this.cacheService.set(cacheKey, profile, { ttl: 86400 * 7 }); // 7 days
  }

  /**
   * Cache optimized settings
   */
  private async cacheOptimizedSettings(
    userId: string,
    tenantId: string,
    settings: any,
  ): Promise<void> {
    const cacheKey = `optimized_settings:${tenantId}:${userId}`;
    await this.cacheService.set(cacheKey, settings, { ttl: 3600 }); // 1 hour
  }

  /**
   * Identify heavy usage patterns
   */
  private identifyHeavyUsagePatterns(usageData: any): string[] {
    const patterns: string[] = [];

    if (usageData.syncFrequency < 10) { // < 10 minutes
      patterns.push('frequent_sync');
    }

    if (usageData.activeFeatures.includes('real_time_updates')) {
      patterns.push('real_time_updates');
    }

    if (usageData.activeFeatures.includes('location_tracking')) {
      patterns.push('location_tracking');
    }

    if (usageData.screenTime > 8) { // > 8 hours
      patterns.push('heavy_screen_usage');
    }

    return patterns;
  }

  /**
   * Calculate optimal sync times
   */
  private calculateOptimalSyncTimes(usageData: any): string[] {
    // Mock implementation - in production, analyze usage patterns
    return ['9', '13', '17', '21']; // 9 AM, 1 PM, 5 PM, 9 PM
  }

  /**
   * Generate recommended settings
   */
  private generateRecommendedSettings(usageData: any): BatteryOptimizationSettings {
    return {
      enableLowPowerMode: usageData.batteryDrainRate > 15,
      reducedSyncFrequency: usageData.syncFrequency < 15,
      limitBackgroundProcessing: usageData.batteryDrainRate > 10,
      compressData: true,
      reduceAnimations: usageData.batteryDrainRate > 12,
      dimScreen: false,
      disableNonEssentialFeatures: usageData.batteryDrainRate > 20,
      emergencyMode: false,
    };
  }

  /**
   * Calculate current optimization level
   */
  private calculateOptimizationLevel(
    profile?: PowerConsumptionProfile,
    batteryStatus?: BatteryStatus,
  ): number {
    let level = 0;

    if (profile?.recommendedSettings.enableLowPowerMode) level += 20;
    if (profile?.recommendedSettings.reducedSyncFrequency) level += 15;
    if (profile?.recommendedSettings.compressData) level += 10;
    if (profile?.recommendedSettings.limitBackgroundProcessing) level += 15;
    if (profile?.recommendedSettings.reduceAnimations) level += 10;

    if (batteryStatus?.lowBattery) level += 20;
    if (batteryStatus?.criticalBattery) level += 30;

    return Math.min(level, 100);
  }
}