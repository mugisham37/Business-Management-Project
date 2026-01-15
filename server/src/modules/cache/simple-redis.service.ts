import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class SimpleRedisService {
  private readonly logger = new Logger(SimpleRedisService.name);
  private client!: RedisClientType;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {
    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    try {
      const redisUrl = this.configService.get('REDIS_URL') || 'redis://localhost:6379';
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries: number) => Math.min(retries * 50, 500),
        },
      });

      this.client.on('error', (err) => {
        this.logger.error('Redis Client Error', err.message);
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Redis Client Connected');
      });

      await this.client.connect();
    } catch (error) {
      this.logger.error('Failed to initialize Redis client', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected) {
        return null;
      }

      const value = await this.client.get(key);
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error('Redis GET error', error instanceof Error ? error.message : 'Unknown error', { key });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      if (!this.isConnected) {
        return;
      }

      const serialized = JSON.stringify(value);
      
      if (ttl) {
        await this.client.setEx(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      this.logger.error('Redis SET error', error instanceof Error ? error.message : 'Unknown error', { key });
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (!this.isConnected) {
        return;
      }

      await this.client.del(key);
    } catch (error) {
      this.logger.error('Redis DEL error', error instanceof Error ? error.message : 'Unknown error', { key });
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error('Redis EXISTS error', error instanceof Error ? error.message : 'Unknown error', { key });
      return false;
    }
  }

  async getClient(): Promise<RedisClientType | null> {
    return this.isConnected ? this.client : null;
  }

  async getInfo(): Promise<{ isHealthy: boolean; connections: number; memory: string }> {
    try {
      if (!this.isConnected) {
        return {
          isHealthy: false,
          connections: 0,
          memory: '0B',
        };
      }

      const info = await this.client.info();
      const lines = info.split('\r\n');
      
      let connections = 0;
      let memory = '0B';
      
      for (const line of lines) {
        if (line.startsWith('connected_clients:')) {
          const value = line.split(':')[1];
          if (value) {
            connections = parseInt(value.trim(), 10);
          }
        }
        if (line.startsWith('used_memory_human:')) {
          const value = line.split(':')[1];
          if (value) {
            memory = value.trim();
          }
        }
      }

      return {
        isHealthy: true,
        connections,
        memory,
      };
    } catch (error) {
      this.logger.error('Failed to get Redis info', error instanceof Error ? error.message : 'Unknown error');
      return {
        isHealthy: false,
        connections: 0,
        memory: '0B',
      };
    }
  }
}
