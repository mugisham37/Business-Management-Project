import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  poolMin: number;
  poolMax: number;
}

export const databaseConfig = registerAs('database', (): DatabaseConfig => ({
  url: process.env.DATABASE_URL!,
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USERNAME!,
  password: process.env.DATABASE_PASSWORD!,
  database: process.env.DATABASE_NAME!,
  ssl: process.env.DATABASE_SSL === 'true',
  poolMin: parseInt(process.env.DATABASE_POOL_MIN ?? '2', 10),
  poolMax: parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10),
}));