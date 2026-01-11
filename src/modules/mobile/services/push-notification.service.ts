import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
  icon?: string;
  image?: string;
  clickAction?: string;
  priority?: 'high' | 'normal';
  timeToLive?: number;
}

export interface DeviceToken {
  id: string;
  userId: string;
  tenantId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId: string;
  appVersion: string;
  isActive: boolean;
  lastUsed: Date;
  createdAt: Date;
}

export interface PushNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveredTokens: number;
  failedTokens: number;
  invalidTokens: string[];
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  /**
   * Send push notification to specific users
   */
  async sendToUsers(
    tenantId: string,
    userIds: string[],
    payload: PushNotificationPayload,
  ): Promise<PushNotificationResult> {
    try {
      this.logger.log(`Sending push notification to ${userIds.length} users in tenant ${tenantId}`);

      // Get device tokens for users
      const deviceTokens = await this.getDeviceTokensForUsers(tenantId, userIds);
      
      if (deviceTokens.length === 0) {
        this.logger.warn(`No device tokens found for users: ${userIds.join(', ')}`);
        return {
          success: false,
          error: 'No device tokens found',
          deliveredTokens: 0,
          failedTokens: 0,
          invalidTokens: [],
        };
      }

      // Group tokens by platform for optimized delivery
      const tokensByPlatform = this.groupTokensByPlatform(deviceTokens);

      let totalDelivered = 0;
      let totalFailed = 0;
      const invalidTokens: string[] = [];

      // Send to each platform
      for (const [platform, tokens] of Object.entries(tokensByPlatform)) {
        const result = await this.sendToPlatform(
          platform as 'ios' | 'android' | 'web',
          tokens,
          payload,
        );

        totalDelivered += result.deliveredTokens;
        totalFailed += result.failedTokens;
        invalidTokens.push(...result.invalidTokens);
      }

      // Clean up invalid tokens
      if (invalidTokens.length > 0) {
        await this.removeInvalidTokens(invalidTokens);
      }

      const success = totalDelivered > 0;
      
      this.logger.log(
        `Push notification completed: ${totalDelivered} delivered, ${totalFailed} failed, ` +
        `${invalidTokens.length} invalid tokens`,
      );

      return {
        success,
        deliveredTokens: totalDelivered,
        failedTokens: totalFailed,
        invalidTokens,
      };
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        deliveredTokens: 0,
        failedTokens: 0,
        invalidTokens: [],
      };
    }
  }

  /**
   * Send push notification to all users in tenant
   */
  async sendToTenant(
    tenantId: string,
    payload: PushNotificationPayload,
    excludeUserIds: string[] = [],
  ): Promise<PushNotificationResult> {
    try {
      // Get all device tokens for tenant (excluding specified users)
      const deviceTokens = await this.getDeviceTokensForTenant(tenantId, excludeUserIds);
      
      if (deviceTokens.length === 0) {
        return {
          success: false,
          error: 'No device tokens found for tenant',
          deliveredTokens: 0,
          failedTokens: 0,
          invalidTokens: [],
        };
      }

      // Extract user IDs from device tokens
      const userIds = [...new Set(deviceTokens.map(token => token.userId))];
      
      return this.sendToUsers(tenantId, userIds, payload);
    } catch (error) {
      this.logger.error(`Failed to send tenant-wide push notification: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        deliveredTokens: 0,
        failedTokens: 0,
        invalidTokens: [],
      };
    }
  }

  /**
   * Register device token for push notifications
   */
  async registerDeviceToken(
    tenantId: string,
    userId: string,
    token: string,
    platform: 'ios' | 'android' | 'web',
    deviceId: string,
    appVersion: string,
  ): Promise<DeviceToken> {
    try {
      // Check if token already exists
      const existingToken = await this.getDeviceToken(token);
      
      if (existingToken) {
        // Update existing token
        existingToken.lastUsed = new Date();
        existingToken.isActive = true;
        existingToken.appVersion = appVersion;
        
        await this.updateDeviceToken(existingToken);
        this.logger.debug(`Updated existing device token for user ${userId}`);
        return existingToken;
      }

      // Create new device token
      const deviceToken: DeviceToken = {
        id: `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        tenantId,
        token,
        platform,
        deviceId,
        appVersion,
        isActive: true,
        lastUsed: new Date(),
        createdAt: new Date(),
      };

      await this.saveDeviceToken(deviceToken);
      
      this.logger.log(`Registered new device token for user ${userId} on ${platform}`);
      return deviceToken;
    } catch (error) {
      this.logger.error(`Failed to register device token: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Unregister device token
   */
  async unregisterDeviceToken(token: string): Promise<void> {
    try {
      const deviceToken = await this.getDeviceToken(token);
      
      if (deviceToken) {
        deviceToken.isActive = false;
        await this.updateDeviceToken(deviceToken);
        this.logger.log(`Unregistered device token: ${token.substring(0, 20)}...`);
      }
    } catch (error) {
      this.logger.error(`Failed to unregister device token: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get device tokens for specific users
   */
  private async getDeviceTokensForUsers(
    tenantId: string,
    userIds: string[],
  ): Promise<DeviceToken[]> {
    const tokens: DeviceToken[] = [];
    
    for (const userId of userIds) {
      const userTokens = await this.getUserDeviceTokens(tenantId, userId);
      tokens.push(...userTokens);
    }
    
    return tokens.filter(token => token.isActive);
  }

  /**
   * Get device tokens for entire tenant
   */
  private async getDeviceTokensForTenant(
    tenantId: string,
    excludeUserIds: string[] = [],
  ): Promise<DeviceToken[]> {
    // In a real implementation, this would query the database
    // For now, we'll simulate with cache
    const cacheKey = `device_tokens:tenant:${tenantId}`;
    const cachedTokens = await this.cacheService.get<DeviceToken[]>(cacheKey);
    
    if (cachedTokens) {
      return cachedTokens.filter(
        token => token.isActive && !excludeUserIds.includes(token.userId),
      );
    }
    
    // Mock implementation - in production, query database
    return [];
  }

  /**
   * Get device tokens for a specific user
   */
  private async getUserDeviceTokens(tenantId: string, userId: string): Promise<DeviceToken[]> {
    const cacheKey = `device_tokens:user:${tenantId}:${userId}`;
    const tokens = await this.cacheService.get<DeviceToken[]>(cacheKey);
    return tokens || [];
  }

  /**
   * Get device token by token string
   */
  private async getDeviceToken(token: string): Promise<DeviceToken | null> {
    const cacheKey = `device_token:${token}`;
    return this.cacheService.get<DeviceToken>(cacheKey);
  }

  /**
   * Save device token
   */
  private async saveDeviceToken(deviceToken: DeviceToken): Promise<void> {
    // Save to cache (in production, save to database)
    const tokenCacheKey = `device_token:${deviceToken.token}`;
    const userCacheKey = `device_tokens:user:${deviceToken.tenantId}:${deviceToken.userId}`;
    
    await this.cacheService.set(tokenCacheKey, deviceToken, 86400 * 30); // 30 days
    
    // Update user's token list
    const userTokens = await this.getUserDeviceTokens(deviceToken.tenantId, deviceToken.userId);
    userTokens.push(deviceToken);
    await this.cacheService.set(userCacheKey, userTokens, 86400 * 30);
  }

  /**
   * Update device token
   */
  private async updateDeviceToken(deviceToken: DeviceToken): Promise<void> {
    const cacheKey = `device_token:${deviceToken.token}`;
    await this.cacheService.set(cacheKey, deviceToken, 86400 * 30);
  }

  /**
   * Group tokens by platform
   */
  private groupTokensByPlatform(tokens: DeviceToken[]): Record<string, DeviceToken[]> {
    return tokens.reduce((groups, token) => {
      if (!groups[token.platform]) {
        groups[token.platform] = [];
      }
      groups[token.platform].push(token);
      return groups;
    }, {} as Record<string, DeviceToken[]>);
  }

  /**
   * Send push notification to specific platform
   */
  private async sendToPlatform(
    platform: 'ios' | 'android' | 'web',
    tokens: DeviceToken[],
    payload: PushNotificationPayload,
  ): Promise<PushNotificationResult> {
    try {
      this.logger.debug(`Sending to ${platform}: ${tokens.length} tokens`);

      // Platform-specific payload optimization
      const optimizedPayload = this.optimizePayloadForPlatform(payload, platform);

      // Simulate platform-specific delivery
      switch (platform) {
        case 'ios':
          return this.sendToAPNS(tokens, optimizedPayload);
        case 'android':
          return this.sendToFCM(tokens, optimizedPayload);
        case 'web':
          return this.sendToWebPush(tokens, optimizedPayload);
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send to ${platform}: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        deliveredTokens: 0,
        failedTokens: tokens.length,
        invalidTokens: [],
      };
    }
  }

  /**
   * Send to Apple Push Notification Service (APNS)
   */
  private async sendToAPNS(
    tokens: DeviceToken[],
    payload: PushNotificationPayload,
  ): Promise<PushNotificationResult> {
    // Mock APNS implementation
    await this.delay(100 + Math.random() * 200);

    const delivered = Math.floor(tokens.length * 0.95); // 95% success rate
    const failed = tokens.length - delivered;
    const invalidTokens = tokens.slice(-Math.floor(tokens.length * 0.02)).map(t => t.token); // 2% invalid

    this.logger.debug(`APNS delivery: ${delivered} delivered, ${failed} failed`);

    return {
      success: delivered > 0,
      messageId: `apns_${Date.now()}`,
      deliveredTokens: delivered,
      failedTokens: failed,
      invalidTokens,
    };
  }

  /**
   * Send to Firebase Cloud Messaging (FCM)
   */
  private async sendToFCM(
    tokens: DeviceToken[],
    payload: PushNotificationPayload,
  ): Promise<PushNotificationResult> {
    // Mock FCM implementation
    await this.delay(80 + Math.random() * 150);

    const delivered = Math.floor(tokens.length * 0.97); // 97% success rate
    const failed = tokens.length - delivered;
    const invalidTokens = tokens.slice(-Math.floor(tokens.length * 0.01)).map(t => t.token); // 1% invalid

    this.logger.debug(`FCM delivery: ${delivered} delivered, ${failed} failed`);

    return {
      success: delivered > 0,
      messageId: `fcm_${Date.now()}`,
      deliveredTokens: delivered,
      failedTokens: failed,
      invalidTokens,
    };
  }

  /**
   * Send to Web Push
   */
  private async sendToWebPush(
    tokens: DeviceToken[],
    payload: PushNotificationPayload,
  ): Promise<PushNotificationResult> {
    // Mock Web Push implementation
    await this.delay(120 + Math.random() * 180);

    const delivered = Math.floor(tokens.length * 0.92); // 92% success rate
    const failed = tokens.length - delivered;
    const invalidTokens = tokens.slice(-Math.floor(tokens.length * 0.03)).map(t => t.token); // 3% invalid

    this.logger.debug(`Web Push delivery: ${delivered} delivered, ${failed} failed`);

    return {
      success: delivered > 0,
      messageId: `webpush_${Date.now()}`,
      deliveredTokens: delivered,
      failedTokens: failed,
      invalidTokens,
    };
  }

  /**
   * Optimize payload for specific platform
   */
  private optimizePayloadForPlatform(
    payload: PushNotificationPayload,
    platform: 'ios' | 'android' | 'web',
  ): PushNotificationPayload {
    const optimized = { ...payload };

    switch (platform) {
      case 'ios':
        // iOS-specific optimizations
        if (!optimized.sound) {
          optimized.sound = 'default';
        }
        // iOS has stricter payload size limits
        if (optimized.body.length > 178) {
          optimized.body = optimized.body.substring(0, 175) + '...';
        }
        break;

      case 'android':
        // Android-specific optimizations
        if (!optimized.icon) {
          optimized.icon = 'ic_notification';
        }
        optimized.priority = optimized.priority || 'high';
        break;

      case 'web':
        // Web-specific optimizations
        if (!optimized.icon) {
          optimized.icon = '/icons/notification-icon.png';
        }
        optimized.timeToLive = optimized.timeToLive || 86400; // 24 hours
        break;
    }

    return optimized;
  }

  /**
   * Remove invalid tokens from storage
   */
  private async removeInvalidTokens(tokens: string[]): Promise<void> {
    for (const token of tokens) {
      try {
        await this.unregisterDeviceToken(token);
      } catch (error) {
        this.logger.warn(`Failed to remove invalid token: ${error.message}`);
      }
    }
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}