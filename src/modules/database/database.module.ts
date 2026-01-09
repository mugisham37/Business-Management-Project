import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { DrizzleService } from './drizzle.service';
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
    DatabaseService,
    MigrationService,
    SeedService,
  ],
  exports: [DrizzleService, DatabaseService, MigrationService, SeedService],
})
export class DatabaseModule {}