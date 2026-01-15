import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApiController } from './common/rest/controllers/api.controller';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { LoggerModule } from './modules/logger/logger.module';
import { CacheModule as CacheConfigModule } from './modules/cache/cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { CrmModule } from './modules/crm/crm.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { FinancialModule } from './modules/financial/financial.module';
import { SupplierModule } from './modules/supplier/supplier.module';
import { LocationModule } from './modules/location/location.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { GraphQLCommonModule } from './common/graphql/graphql-common.module';
import { RestCommonModule } from './common/rest/rest-common.module';
import { ValidationModule } from './common/validation/validation.module';
import { GraphQLConfigService } from './config/graphql.config';
import { configValidationSchema } from './config/config.validation';
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { appConfig } from './config/app.config';

@Module({
  imports: [
    // Configuration module with validation
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: configValidationSchema,
      load: [appConfig, databaseConfig, redisConfig],
      cache: true,
    }),

    // GraphQL module with enhanced configuration
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useClass: GraphQLConfigService,
    }),

    // Event emitter for domain events
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    // Task scheduling
    ScheduleModule.forRoot(),

    // Health checks
    TerminusModule,

    // Core modules
    DatabaseModule,
    CacheConfigModule,
    LoggerModule,
    HealthModule,
    AuthModule,
    TenantModule,
    RealtimeModule,
    CrmModule,
    EmployeeModule,
    FinancialModule,
    SupplierModule,
    LocationModule,
    IntegrationModule,
    ValidationModule,
    GraphQLCommonModule,
    RestCommonModule,
  ],
  controllers: [AppController, ApiController],
  providers: [
    AppService,
    GraphQLConfigService,
    // Global JWT authentication guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}