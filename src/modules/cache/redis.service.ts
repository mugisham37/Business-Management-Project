import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CustomLoggerService } from '../logger/logger.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly customLogger: CustomLoggerService,
  ) {
    this.customLogger.setContext('RedisService');
  }

  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    try {
      const redisConfig = this.configService.get('redis');
      
      if (!redisConfig) {
        throw new Error('Redis configuration not found');
      }

      const connectionOptions = {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
      };

      // Main Redis client
      this.client = new Redis(connectionOptions);
      
      // Separate clients for pub/sub to avoid blocking
      this.subscriber = new Redis(connectionOptions);
      this.publisher = new Redis(connectionOptions);

      // Set up event listeners
      this.setupEventListeners();

      // Test connections
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect(),
      ]);

      await this.testConnection();

      this.logger.log('Redis connections established successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Redis connections', error);
      throw error;
    }
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  getSubscriber(): Redis {
    if (!this.subscriber) {
      throw new Error('Redis subscriber not initialized. Call initialize() first.');
    }
    return this.subscriber;
  }

  getPublisher(): Redis {
    if (!this.publisher) {
      throw new Error('Redis publisher not initialized. Call initialize() first.');
    }
    return this.publisher;
  }

  // Cache operations with tenant isolation
  async get<T>(key: string, tenantId?: string): Promise<T | null> {
    const client = this.getClient();
    const fullKey = this.buildKey(key, tenantId);
    
    try {
      const value = await client.get(fullKey);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.customLogger.error('Redis GET failed', error instanceof Error ? error.stack : undefined, {
        key: fullKey,
        tenantId,
      });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number, tenantId?: string): Promise<void> {
    const client = this.getClient();
    const fullKey = this.buildKey(key, tenantId);
    
    try {
      const serializedValue = JSON.stringify(value);
      
      if (ttl) {
        await client.setex(fullKey, ttl, serializedValue);
      } else {
        await client.set(fullKey, serializedValue);
      }
      
      this.customLogger.debug('Redis SET successful', {
        key: fullKey,
        ttl,
        tenantId,
      });
    } catch (error) {
      this.customLogger.error('Redis SET failed', error instanceof Error ? error.stack : undefined, {
        key: fullKey,
        ttl,
        tenantId,
      });
      throw error;
    }
  }

  async del(key: string, tenantId?: string): Promise<void> {
    const client = this.getClient();
    const fullKey = this.buildKey(key, tenantId);
    
    try {
      await client.del(fullKey);
      this.customLogger.debug('Redis DEL successful', {
        key: fullKey,
        tenantId,
      });
    } catch (error) {
      this.customLogger.error('Redis DEL failed', error instanceof Error ? error.stack : undefined, {
        key: fullKey,
        tenantId,
      });
      throw error;
    }
  }

  async exists(key: string, tenantId?: string): Promise<boolean> {
    const client = this.getClient();
    const fullKey = this.buildKey(key, tenantId);
    
    try {
      const result = await client.exists(fullKey);
      return result === 1;
    } catch (error) {
      this.customLogger.error('Redis EXISTS failed', error instanceof Error ? error.stack : undefined, {
        key: fullKey,
        tenantId,
      });
      return false;
    }
  }

  async keys(pattern: string, tenantId?: string): Promise<string[]> {
    const client = this.getClient();
    const fullPattern = this.buildKey(pattern, tenantId);
    
    try {
      return await client.keys(fullPattern);
    } catch (error) {
      this.customLogger.error('Redis KEYS failed', error instanceof Error ? error.stack : undefined, {
        pattern: fullPattern,
        tenantId,
      });
      return [];
    }
  }

  async invalidatePattern(pattern: string, tenantId?: string): Promise<void> {
    const keys = await this.keys(pattern, tenantId);
    
    if (keys.length > 0) {
      const client = this.getClient();
      await client.del(...keys);
      
      this.customLogger.debug('Redis pattern invalidation successful', {
        pattern,
        keysDeleted: keys.length,
        tenantId,
      });
    }
  }

  // Pub/Sub operations
  async publish(channel: string, message: any, tenantId?: string): Promise<void> {
    const publisher = this.getPublisher();
    const fullChannel = this.buildKey(channel, tenantId);
    
    try {
      const serializedMessage = JSON.stringify(message);
      await publisher.publish(fullChannel, serializedMessage);
      
      this.customLogger.debug('Redis PUBLISH successful', {
        channel: fullChannel,
        tenantId,
      });
    } catch (error) {
      this.customLogger.error('Redis PUBLISH failed', error instanceof Error ? error.stack : undefined, {
        channel: fullChannel,
        tenantId,
      });
      throw error;
    }
  }

  async subscribe(channel: string, callback: (message: any) => void, tenantId?: string): Promise<void> {
    const subscriber = this.getSubscriber();
    const fullChannel = this.buildKey(channel, tenantId);
    
    try {
      await subscriber.subscribe(fullChannel);
      
      subscriber.on('message', (receivedChannel, message) => {
        if (receivedChannel === fullChannel) {
          try {
            const parsedMessage = JSON.parse(message);
            callback(parsedMessage);
          } catch (error) {
            this.customLogger.error('Failed to parse Redis message', error instanceof Error ? error.stack : undefined, {
              channel: receivedChannel,
              tenantId,
            });
          }
        }
      });
      
      this.customLogger.debug('Redis SUBSCRIBE successful', {
        channel: fullChannel,
        tenantId,
      });
    } catch (error) {
      this.customLogger.error('Redis SUBSCRIBE failed', error instanceof Error ? error.stack : undefined, {
        channel: fullChannel,
        tenantId,
      });
      throw error;
    }
  }

  async unsubscribe(channel: string, tenantId?: string): Promise<void> {
    const subscriber = this.getSubscriber();
    const fullChannel = this.buildKey(channel, tenantId);
    
    try {
      await subscriber.unsubscribe(fullChannel);
      this.customLogger.debug('Redis UNSUBSCRIBE successful', {
        channel: fullChannel,
        tenantId,
      });
    } catch (error) {
      this.customLogger.error('Redis UNSUBSCRIBE failed', error instanceof Error ? error.stack : undefined, {
        channel: fullChannel,
        tenantId,
      });
      throw error;
    }
  }

  // Hash operations for complex data structures
  async hset(key: string, field: string, value: any, tenantId?: string): Promise<void> {
    const client = this.getClient();
    const fullKey = this.buildKey(key, tenantId);
    
    try {
      const serializedValue = JSON.stringify(value);
      await client.hset(fullKey, field, serializedValue);
    } catch (error) {
      this.customLogger.error('Redis HSET failed', error instanceof Error ? error.stack : undefined, {
        key: fullKey,
        field,
        tenantId,
      });
      throw error;
    }
  }

  async hget<T>(key: string, field: string, tenantId?: string): Promise<T | null> {
    const client = this.getClient();
    const fullKey = this.buildKey(key, tenantId);
    
    try {
      const value = await client.hget(fullKey, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.customLogger.error('Redis HGET failed', error instanceof Error ? error.stack : undefined, {
        key: fullKey,
        field,
        tenantId,
      });
      return null;
    }
  }

  async hgetall<T>(key: string, tenantId?: string): Promise<Record<string, T>> {
    const client = this.getClient();
    const fullKey = this.buildKey(key, tenantId);
    
    try {
      const hash = await client.hgetall(fullKey);
      const result: Record<string, T> = {};
      
      for (const [field, value] of Object.entries(hash)) {
        result[field] = JSON.parse(value);
      }
      
      return result;
    } catch (error) {
      this.customLogger.error('Redis HGETALL failed', error instanceof Error ? error.stack : undefined, {
        key: fullKey,
        tenantId,
      });
      return {};
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }

      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async getInfo(): Promise<{
    isHealthy: boolean;
    connections: {
      main: string;
      subscriber: string;
      publisher: string;
    };
    memory: any;
  }> {
    const isHealthy = await this.isHealthy();
    
    let memory = {};
    try {
      if (this.client) {
        const info = await this.client.info('memory');
        memory = this.parseRedisInfo(info);
      }
    } catch {
      // Ignore errors for info gathering
    }

    return {
      isHealthy,
      connections: {
        main: this.client?.status || 'disconnected',
        subscriber: this.subscriber?.status || 'disconnected',
        publisher: this.publisher?.status || 'disconnected',
      },
      memory,
    };
  }

  private buildKey(key: string, tenantId?: string): string {
    if (tenantId) {
      return `tenant:${tenantId}:${key}`;
    }
    return `global:${key}`;
  }

  private setupEventListeners(): void {
    if (this.client) {
      this.client.on('connect', () => {
        this.logger.log('Redis main client connected');
      });

      this.client.on('error', (error) => {
        this.logger.error('Redis main client error', error);
      });

      this.client.on('close', () => {
        this.logger.warn('Redis main client connection closed');
      });
    }

    if (this.subscriber) {
      this.subscriber.on('connect', () => {
        this.logger.log('Redis subscriber connected');
      });

      this.subscriber.on('error', (error) => {
        this.logger.error('Redis subscriber error', error);
      });
    }

    if (this.publisher) {
      this.publisher.on('connect', () => {
        this.logger.log('Redis publisher connected');
      });

      this.publisher.on('error', (error) => {
        this.logger.error('Redis publisher error', error);
      });
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const result = await this.client.ping();
    if (result !== 'PONG') {
      throw new Error('Redis connection test failed');
    }

    this.logger.log('Redis connection test successful');
  }

  private parseRedisInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = value;
        }
      }
    }
    
    return result;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis main client disconnected');
    }

    if (this.subscriber) {
      await this.subscriber.quit();
      this.logger.log('Redis subscriber disconnected');
    }

    if (this.publisher) {
      await this.publisher.quit();
      this.logger.log('Redis publisher disconnected');
    }
  }
}