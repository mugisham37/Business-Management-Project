import { Injectable, Logger } from '@nestjs/common';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { QueueService } from '../../queue/queue.service';

export interface SyncSchedule {
  id: string;
  userId: string;
  tenantId: string;
  deviceId: string;
  dataType: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  scheduledTime: Date;
  estimatedDuration: number; // seconds
  estimatedDataUsage: number; // bytes
  conditions: SyncCondition[];
  retryPolicy: RetryPolicy;
  isActive: boolean;
  createdAt: Date;
}

export interface SyncCondition {
  type: 'battery_level' | 'connection_type' | 'data_limit' | 'time_window' | 'user_activity';
  operator: 'gt' | 'lt' | 'eq' | 'in' | 'not_in';
  value: any;
  required: boolean;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  baseDelay: number; // seconds
  maxDelay: number; // seconds
}

export interface SyncContext {
  batteryLevel?: number;
  connectionType: 'wifi' | 'cellular' | 'offline';
  dataUsageToday: number;
  dataLimit?: number;
  userActive: boolean;
  deviceCharging: boolean;
  timeOfDay: number; // 0-23
  dayOfWeek: number; // 0-6
}

export interface SyncRecommendation {
  action: 'sync_now' | 'schedule_later' | 'defer' | 'cancel';
  reason: string;
  suggestedTime?: Date;
  estimatedSavings?: {
    battery: number;
    data: number;
  };
  alternatives?: Array<{
    action: string;
    time: Date;
    conditions: string[];
  }>;
}

@Injectable()
export class IntelligentSyncSchedulerService {
  private readonly logger = new Logger(IntelligentSyncSchedulerService.name);
  private readonly syncSchedules = new Map<string, SyncSchedule[]>();

  constructor(
    private readonly cacheService: IntelligentCacheService,
    private readonly queueService: QueueService,
  ) {
    // Initialize periodic sync evaluation
    this.initializePeriodicEvaluation();
  }

  /**
   * Schedule intelligent sync based on context and conditions
   */
  async scheduleIntelligentSync(
    userId: string,
    tenantId: string,
    deviceId: string,
    dataType: string,
    priority: 'critical' | 'high' | 'medium' | 'low',
    conditions: SyncCondition[] = [],
    estimatedDataUsage: number = 1024 * 1024, // 1MB default
  ): Promise<SyncSchedule> {
    try {
      this.logger.debug(
        `Scheduling intelligent sync for ${dataType} (${priority}) for user ${userId}`,
      );

      // Get current context
      const context = await this.getCurrentSyncContext(userId, tenantId, deviceId);

      // Determine optimal sync time
      const optimalTime = await this.calculateOptimalSyncTime(
        context,
        priority,
        conditions,
        estimatedDataUsage,
      );

      // Create sync schedule
      const schedule: SyncSchedule = {
        id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        tenantId,
        deviceId,
        dataType,
        priority,
        scheduledTime: optimalTime,
        estimatedDuration: this.estimateSyncDuration(dataType, estimatedDataUsage),
        estimatedDataUsage,
        conditions: [
          ...conditions,
          ...this.getDefaultConditions(priority, context),
        ],
        retryPolicy: this.getRetryPolicy(priority),
        isActive: true,
        createdAt: new Date(),
      };

      // Save schedule
      await this.saveSyncSchedule(schedule);

      // Queue for execution if time is now or very soon
      if (optimalTime.getTime() - Date.now() < 60000) { // Within 1 minute
        await this.queueSyncExecution(schedule);
      }

      this.logger.log(
        `Scheduled ${dataType} sync for ${optimalTime.toISOString()} ` +
        `(${priority} priority, ${this.formatBytes(estimatedDataUsage)})`,
      );

      return schedule;
    } catch (error) {
      this.logger.error(`Failed to schedule intelligent sync: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get sync recommendation for immediate execution
   */
  async getSyncRecommendation(
    userId: string,
    tenantId: string,
    deviceId: string,
    dataType: string,
    priority: 'critical' | 'high' | 'medium' | 'low',
  ): Promise<SyncRecommendation> {
    try {
      const context = await this.getCurrentSyncContext(userId, tenantId, deviceId);
      
      // Evaluate current conditions
      const shouldSyncNow = await this.evaluateSyncConditions(context, priority);
      
      if (shouldSyncNow.canSync) {
        return {
          action: 'sync_now',
          reason: shouldSyncNow.reason,
          estimatedSavings: {
            battery: 0,
            data: 0,
          },
        };
      }

      // Find optimal time to sync
      const optimalTime = await this.calculateOptimalSyncTime(
        context,
        priority,
        [],
        1024 * 1024, // 1MB default
      );

      const now = new Date();
      const delay = optimalTime.getTime() - now.getTime();

      if (delay > 24 * 60 * 60 * 1000) { // More than 24 hours
        return {
          action: 'defer',
          reason: 'Conditions not favorable for sync in next 24 hours',
          suggestedTime: optimalTime,
        };
      }

      // Calculate potential savings by waiting
      const estimatedSavings = this.calculateWaitingSavings(context, delay);

      return {
        action: 'schedule_later',
        reason: shouldSyncNow.reason,
        suggestedTime: optimalTime,
        estimatedSavings,
        alternatives: await this.getAlternativeSyncTimes(context, priority),
      };
    } catch (error) {
      this.logger.error(`Failed to get sync recommendation: ${error.message}`, error.stack);
      
      // Return safe default
      return {
        action: 'defer',
        reason: 'Error evaluating sync conditions',
      };
    }
  }

  /**
   * Execute scheduled sync
   */
  async executeSyncSchedule(scheduleId: string): Promise<{
    success: boolean;
    executedAt: Date;
    duration: number;
    dataUsed: number;
    error?: string;
  }> {
    try {
      const schedule = await this.getSyncSchedule(scheduleId);
      
      if (!schedule) {
        throw new Error(`Sync schedule not found: ${scheduleId}`);
      }

      if (!schedule.isActive) {
        throw new Error(`Sync schedule is inactive: ${scheduleId}`);
      }

      this.logger.log(`Executing sync schedule: ${schedule.dataType} for user ${schedule.userId}`);

      const startTime = Date.now();
      
      // Get current context to verify conditions
      const context = await this.getCurrentSyncContext(
        schedule.userId,
        schedule.tenantId,
        schedule.deviceId,
      );

      // Check if conditions are still met
      const conditionsMet = await this.checkSyncConditions(schedule.conditions, context);
      
      if (!conditionsMet.allMet) {
        // Reschedule if conditions not met
        const newTime = await this.calculateOptimalSyncTime(
          context,
          schedule.priority,
          schedule.conditions,
          schedule.estimatedDataUsage,
        );
        
        schedule.scheduledTime = newTime;
        await this.saveSyncSchedule(schedule);
        
        return {
          success: false,
          executedAt: new Date(),
          duration: 0,
          dataUsed: 0,
          error: `Conditions not met: ${conditionsMet.failedConditions.join(', ')}`,
        };
      }

      // Execute the actual sync
      const syncResult = await this.performSync(schedule);
      
      const duration = Date.now() - startTime;

      // Mark schedule as completed
      schedule.isActive = false;
      await this.saveSyncSchedule(schedule);

      this.logger.log(
        `Sync completed: ${schedule.dataType} in ${duration}ms, ` +
        `${this.formatBytes(syncResult.dataUsed)} transferred`,
      );

      return {
        success: syncResult.success,
        executedAt: new Date(startTime),
        duration,
        dataUsed: syncResult.dataUsed,
        error: syncResult.error,
      };
    } catch (error) {
      this.logger.error(`Sync execution failed: ${error.message}`, error.stack);
      return {
        success: false,
        executedAt: new Date(),
        duration: 0,
        dataUsed: 0,
        error: error.message,
      };
    }
  }

  /**
   * Get active sync schedules for user
   */
  async getActiveSyncSchedules(
    userId: string,
    tenantId: string,
  ): Promise<SyncSchedule[]> {
    const cacheKey = `sync_schedules:${tenantId}:${userId}`;
    const schedules = await this.cacheService.get<SyncSchedule[]>(cacheKey) || [];
    
    return schedules.filter(schedule => 
      schedule.isActive && schedule.scheduledTime > new Date()
    );
  }

  /**
   * Cancel sync schedule
   */
  async cancelSyncSchedule(scheduleId: string): Promise<boolean> {
    try {
      const schedule = await this.getSyncSchedule(scheduleId);
      
      if (schedule) {
        schedule.isActive = false;
        await this.saveSyncSchedule(schedule);
        
        this.logger.log(`Cancelled sync schedule: ${scheduleId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Failed to cancel sync schedule: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Get current sync context
   */
  private async getCurrentSyncContext(
    userId: string,
    tenantId: string,
    deviceId: string,
  ): Promise<SyncContext> {
    // In production, this would gather real device/network information
    const now = new Date();
    
    return {
      batteryLevel: 75, // Mock battery level
      connectionType: 'wifi', // Mock connection type
      dataUsageToday: 50 * 1024 * 1024, // Mock 50MB used today
      dataLimit: 1024 * 1024 * 1024, // Mock 1GB daily limit
      userActive: now.getHours() >= 8 && now.getHours() <= 22, // Active 8 AM - 10 PM
      deviceCharging: Math.random() > 0.7, // 30% chance of charging
      timeOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
    };
  }

  /**
   * Calculate optimal sync time
   */
  private async calculateOptimalSyncTime(
    context: SyncContext,
    priority: 'critical' | 'high' | 'medium' | 'low',
    conditions: SyncCondition[],
    estimatedDataUsage: number,
  ): Promise<Date> {
    const now = new Date();
    
    // Critical priority syncs immediately if possible
    if (priority === 'critical') {
      return now;
    }

    // Find optimal time based on conditions and context
    let optimalTime = new Date(now.getTime() + 15 * 60 * 1000); // Default: 15 minutes from now

    // Prefer WiFi for large syncs
    if (estimatedDataUsage > 10 * 1024 * 1024 && context.connectionType !== 'wifi') { // > 10MB
      optimalTime = this.findNextWifiWindow(now);
    }

    // Prefer charging time for battery-intensive syncs
    if (!context.deviceCharging && estimatedDataUsage > 5 * 1024 * 1024) { // > 5MB
      optimalTime = this.findNextChargingWindow(now);
    }

    // Avoid peak usage hours for non-critical syncs
    if (priority === 'low' && context.timeOfDay >= 9 && context.timeOfDay <= 17) {
      optimalTime = this.findOffPeakTime(now);
    }

    // Apply custom conditions
    for (const condition of conditions) {
      optimalTime = this.applyConditionToTime(optimalTime, condition, context);
    }

    return optimalTime;
  }

  /**
   * Evaluate sync conditions
   */
  private async evaluateSyncConditions(
    context: SyncContext,
    priority: 'critical' | 'high' | 'medium' | 'low',
  ): Promise<{ canSync: boolean; reason: string }> {
    // Critical syncs always proceed
    if (priority === 'critical') {
      return { canSync: true, reason: 'Critical priority sync' };
    }

    // Check battery level
    if (context.batteryLevel && context.batteryLevel < 20 && !context.deviceCharging) {
      return { canSync: false, reason: 'Low battery level and not charging' };
    }

    // Check connection type for large syncs
    if (context.connectionType === 'offline') {
      return { canSync: false, reason: 'Device is offline' };
    }

    // Check data limits
    if (context.dataLimit && context.dataUsageToday > context.dataLimit * 0.9) {
      return { canSync: false, reason: 'Approaching daily data limit' };
    }

    // Prefer WiFi for non-high priority syncs
    if (priority === 'low' && context.connectionType === 'cellular') {
      return { canSync: false, reason: 'Waiting for WiFi connection for low priority sync' };
    }

    return { canSync: true, reason: 'All conditions favorable for sync' };
  }

  /**
   * Check sync conditions
   */
  private async checkSyncConditions(
    conditions: SyncCondition[],
    context: SyncContext,
  ): Promise<{ allMet: boolean; failedConditions: string[] }> {
    const failedConditions: string[] = [];

    for (const condition of conditions) {
      const met = this.evaluateCondition(condition, context);
      
      if (!met && condition.required) {
        failedConditions.push(`${condition.type} ${condition.operator} ${condition.value}`);
      }
    }

    return {
      allMet: failedConditions.length === 0,
      failedConditions,
    };
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(condition: SyncCondition, context: SyncContext): boolean {
    let contextValue: any;

    switch (condition.type) {
      case 'battery_level':
        contextValue = context.batteryLevel;
        break;
      case 'connection_type':
        contextValue = context.connectionType;
        break;
      case 'data_limit':
        contextValue = context.dataUsageToday;
        break;
      case 'time_window':
        contextValue = context.timeOfDay;
        break;
      case 'user_activity':
        contextValue = context.userActive;
        break;
      default:
        return true;
    }

    switch (condition.operator) {
      case 'gt':
        return contextValue > condition.value;
      case 'lt':
        return contextValue < condition.value;
      case 'eq':
        return contextValue === condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(contextValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(contextValue);
      default:
        return true;
    }
  }

  /**
   * Get default conditions based on priority
   */
  private getDefaultConditions(
    priority: 'critical' | 'high' | 'medium' | 'low',
    context: SyncContext,
  ): SyncCondition[] {
    const conditions: SyncCondition[] = [];

    if (priority !== 'critical') {
      // Require minimum battery level
      conditions.push({
        type: 'battery_level',
        operator: 'gt',
        value: priority === 'high' ? 10 : 20,
        required: true,
      });

      // Avoid offline
      conditions.push({
        type: 'connection_type',
        operator: 'not_in',
        value: ['offline'],
        required: true,
      });
    }

    if (priority === 'low') {
      // Low priority syncs prefer WiFi
      conditions.push({
        type: 'connection_type',
        operator: 'eq',
        value: 'wifi',
        required: false,
      });
    }

    return conditions;
  }

  /**
   * Get retry policy based on priority
   */
  private getRetryPolicy(priority: 'critical' | 'high' | 'medium' | 'low'): RetryPolicy {
    switch (priority) {
      case 'critical':
        return {
          maxRetries: 5,
          backoffStrategy: 'exponential',
          baseDelay: 30,
          maxDelay: 300,
        };
      case 'high':
        return {
          maxRetries: 3,
          backoffStrategy: 'exponential',
          baseDelay: 60,
          maxDelay: 600,
        };
      case 'medium':
        return {
          maxRetries: 2,
          backoffStrategy: 'linear',
          baseDelay: 300,
          maxDelay: 1800,
        };
      case 'low':
        return {
          maxRetries: 1,
          backoffStrategy: 'fixed',
          baseDelay: 3600,
          maxDelay: 3600,
        };
    }
  }

  /**
   * Estimate sync duration
   */
  private estimateSyncDuration(dataType: string, dataSize: number): number {
    // Base duration estimates (seconds)
    const baseDurations = {
      transactions: 30,
      customers: 45,
      products: 60,
      inventory: 90,
      reports: 120,
      analytics: 180,
    };

    const baseDuration = baseDurations[dataType] || 60;
    const sizeMultiplier = Math.max(dataSize / (1024 * 1024), 1); // Per MB
    
    return Math.round(baseDuration * sizeMultiplier);
  }

  /**
   * Find next WiFi window (mock implementation)
   */
  private findNextWifiWindow(from: Date): Date {
    // Mock: assume WiFi available in 2 hours
    return new Date(from.getTime() + 2 * 60 * 60 * 1000);
  }

  /**
   * Find next charging window (mock implementation)
   */
  private findNextChargingWindow(from: Date): Date {
    // Mock: assume charging tonight at 10 PM
    const tonight = new Date(from);
    tonight.setHours(22, 0, 0, 0);
    
    if (tonight <= from) {
      tonight.setDate(tonight.getDate() + 1);
    }
    
    return tonight;
  }

  /**
   * Find off-peak time (mock implementation)
   */
  private findOffPeakTime(from: Date): Date {
    // Mock: schedule for 6 AM next day
    const tomorrow = new Date(from);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(6, 0, 0, 0);
    
    return tomorrow;
  }

  /**
   * Apply condition to time
   */
  private applyConditionToTime(
    time: Date,
    condition: SyncCondition,
    context: SyncContext,
  ): Date {
    // Mock implementation - in production, this would intelligently adjust time
    return time;
  }

  /**
   * Calculate waiting savings
   */
  private calculateWaitingSavings(context: SyncContext, delay: number): {
    battery: number;
    data: number;
  } {
    let batterySavings = 0;
    let dataSavings = 0;

    // If waiting for WiFi, save on data costs
    if (context.connectionType === 'cellular') {
      dataSavings = 50; // 50% data cost savings on WiFi
    }

    // If waiting for charging, save battery
    if (!context.deviceCharging) {
      batterySavings = 30; // 30% battery savings when charging
    }

    return { battery: batterySavings, data: dataSavings };
  }

  /**
   * Get alternative sync times
   */
  private async getAlternativeSyncTimes(
    context: SyncContext,
    priority: 'critical' | 'high' | 'medium' | 'low',
  ): Promise<Array<{ action: string; time: Date; conditions: string[] }>> {
    const alternatives = [];
    const now = new Date();

    // WiFi alternative
    if (context.connectionType !== 'wifi') {
      alternatives.push({
        action: 'sync_on_wifi',
        time: this.findNextWifiWindow(now),
        conditions: ['WiFi connection available'],
      });
    }

    // Charging alternative
    if (!context.deviceCharging) {
      alternatives.push({
        action: 'sync_while_charging',
        time: this.findNextChargingWindow(now),
        conditions: ['Device charging'],
      });
    }

    // Off-peak alternative
    if (priority === 'low') {
      alternatives.push({
        action: 'sync_off_peak',
        time: this.findOffPeakTime(now),
        conditions: ['Off-peak hours'],
      });
    }

    return alternatives;
  }

  /**
   * Perform actual sync (mock implementation)
   */
  private async performSync(schedule: SyncSchedule): Promise<{
    success: boolean;
    dataUsed: number;
    error?: string;
  }> {
    // Mock sync execution
    await this.delay(schedule.estimatedDuration * 1000);

    // 95% success rate
    const success = Math.random() > 0.05;
    
    return {
      success,
      dataUsed: success ? schedule.estimatedDataUsage : 0,
      error: success ? undefined : 'Mock sync failure',
    };
  }

  /**
   * Save sync schedule
   */
  private async saveSyncSchedule(schedule: SyncSchedule): Promise<void> {
    const cacheKey = `sync_schedules:${schedule.tenantId}:${schedule.userId}`;
    const schedules = await this.cacheService.get<SyncSchedule[]>(cacheKey) || [];
    
    const existingIndex = schedules.findIndex(s => s.id === schedule.id);
    if (existingIndex >= 0) {
      schedules[existingIndex] = schedule;
    } else {
      schedules.push(schedule);
    }

    await this.cacheService.set(cacheKey, schedules, 86400 * 7); // 7 days
  }

  /**
   * Get sync schedule
   */
  private async getSyncSchedule(scheduleId: string): Promise<SyncSchedule | null> {
    // In production, this would query the database
    // For now, search through cached schedules
    const cacheKeys = await this.cacheService.get<string[]>('all_sync_schedule_keys') || [];
    
    for (const key of cacheKeys) {
      const schedules = await this.cacheService.get<SyncSchedule[]>(key) || [];
      const schedule = schedules.find(s => s.id === scheduleId);
      if (schedule) {
        return schedule;
      }
    }

    return null;
  }

  /**
   * Queue sync for execution
   */
  private async queueSyncExecution(schedule: SyncSchedule): Promise<void> {
    const delay = Math.max(schedule.scheduledTime.getTime() - Date.now(), 0);
    
    await this.queueService.add('execute-sync', {
      scheduleId: schedule.id,
    }, {
      delay,
      attempts: schedule.retryPolicy.maxRetries,
    });
  }

  /**
   * Initialize periodic sync evaluation
   */
  private initializePeriodicEvaluation(): void {
    // Run every 5 minutes to check for due syncs
    setInterval(async () => {
      try {
        await this.evaluateDueSyncs();
      } catch (error) {
        this.logger.error(`Periodic sync evaluation failed: ${error.message}`, error.stack);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Evaluate due syncs
   */
  private async evaluateDueSyncs(): Promise<void> {
    // In production, this would query all active schedules
    // For now, this is a placeholder
    this.logger.debug('Evaluating due syncs...');
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

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}