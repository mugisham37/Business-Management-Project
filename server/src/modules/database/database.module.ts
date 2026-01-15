import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { DrizzleService, DRIZZLE_TOKEN } from './drizzle.service';
import { OptimizedDatabaseService } from './optimized-database.service';
import { MigrationService } from './migration.service';
import { SeedService } from './seed.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DrizzleService,
      useFactory: async (configService: ConfigService) => {
        const service = new DrizzleService(configService);
        await service.initialize();
        return service;
      },
      inject: [ConfigService],
    },
    {
      provide: DRIZZLE_TOKEN,
      useFactory: (drizzleService: DrizzleService) => drizzleService.getDb(),
      inject: [DrizzleService],
    },
    DatabaseService,
    OptimizedDatabaseService,
    MigrationService,
    SeedService,
  ],
  exports: [
    DrizzleService, 
    DatabaseService, 
    OptimizedDatabaseService,
    MigrationService, 
    SeedService, 
    DRIZZLE_TOKEN
  ],
})
export class DatabaseModule {}