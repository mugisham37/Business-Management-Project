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
  // Read replica configuration
  readReplicas: {
    enabled: boolean;
    urls: string[];
    maxConnections: number;
  };
  // Advanced connection pool settings
  connectionPool: {
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
    acquireTimeoutMillis: number;
    maxUses: number;
    allowExitOnIdle: boolean;
  };
  // Query optimization settings
  queryOptimization: {
    enablePreparedStatements: boolean;
    maxPreparedStatements: number;
    defaultTimeout: number;
    slowQueryThreshold: number;
  };
  // Partitioning configuration
  partitioning: {
    enabled: boolean;
    strategy: 'range' | 'hash' | 'list';
    partitionColumn: string;
  };
}

export const databaseConfig = registerAs('database', (): DatabaseConfig => ({
  url: process.env.DATABASE_URL!,
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USERNAME!,
  password: process.env.DATABASE_PASSWORD!,
  database: process.env.DATABASE_NAME!,
  ssl: process.env.DATABASE_SSL === 'true',
  poolMin: parseInt(process.env.DATABASE_POOL_MIN ?? '5', 10),
  poolMax: parseInt(process.env.DATABASE_POOL_MAX ?? '50', 10),
  
  // Read replica configuration
  readReplicas: {
    enabled: process.env.DATABASE_READ_REPLICAS_ENABLED === 'true',
    urls: process.env.DATABASE_READ_REPLICA_URLS?.split(',') ?? [],
    maxConnections: parseInt(process.env.DATABASE_READ_REPLICA_MAX_CONNECTIONS ?? '20', 10),
  },
  
  // Advanced connection pool settings
  connectionPool: {
    idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT ?? '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT ?? '5000', 10),
    acquireTimeoutMillis: parseInt(process.env.DATABASE_ACQUIRE_TIMEOUT ?? '60000', 10),
    maxUses: parseInt(process.env.DATABASE_MAX_USES ?? '7500', 10),
    allowExitOnIdle: process.env.DATABASE_ALLOW_EXIT_ON_IDLE === 'true',
  },
  
  // Query optimization settings
  queryOptimization: {
    enablePreparedStatements: process.env.DATABASE_ENABLE_PREPARED_STATEMENTS !== 'false',
    maxPreparedStatements: parseInt(process.env.DATABASE_MAX_PREPARED_STATEMENTS ?? '1000', 10),
    defaultTimeout: parseInt(process.env.DATABASE_DEFAULT_TIMEOUT ?? '30000', 10),
    slowQueryThreshold: parseInt(process.env.DATABASE_SLOW_QUERY_THRESHOLD ?? '1000', 10),
  },
  
  // Partitioning configuration
  partitioning: {
    enabled: process.env.DATABASE_PARTITIONING_ENABLED === 'true',
    strategy: (process.env.DATABASE_PARTITIONING_STRATEGY as 'range' | 'hash' | 'list') ?? 'range',
    partitionColumn: process.env.DATABASE_PARTITION_COLUMN ?? 'created_at',
  },
}));