import { registerAs } from '@nestjs/config';

export interface RedisConfig {
  url: string;
  host: string;
  port: number;
  password?: string;
  db: number;
}

export const redisConfig = registerAs('redis', (): RedisConfig => {
  const config: RedisConfig = {
    url: process.env.REDIS_URL!,
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
  };
  
  const password = process.env.REDIS_PASSWORD;
  if (password) {
    config.password = password;
  }
  
  return config;
});