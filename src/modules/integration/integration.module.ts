import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

// Controllers
import { IntegrationController } from './controllers/integration.controller';
import { WebhookController } from './controllers/webhook.controller';
import { ConnectorController } from './controllers/connector.controller';
import { DeveloperPortalController } from './controllers/developer-portal.controller';

// Services
import { IntegrationService } from './services/integration.service';
import { WebhookService } from './services/webhook.service';
import { OAuth2Service } from './services/oauth2.service';
import { ApiKeyService } from './services/api-key.service';
import { ConnectorService } from './services/connector.service';
import { SyncService } from './services/sync.service';
import { IntegrationHealthService } from './services/integration-health.service';
import { DeveloperPortalService } from './services/developer-portal.service';
import { RateLimitService } from './services/rate-limit.service';

// Repositories
import { IntegrationRepository } from './repositories/integration.repository';
import { WebhookRepository } from './repositories/webhook.repository';
import { ApiKeyRepository } from './repositories/api-key.repository';
import { ConnectorRepository } from './repositories/connector.repository';
import { SyncLogRepository } from './repositories/sync-log.repository';

// Connectors
import { QuickBooksConnector } from './connectors/quickbooks.connector';
import { XeroConnector } from './connectors/xero.connector';
import { ShopifyConnector } from './connectors/shopify.connector';
import { StripeConnector } from './connectors/stripe.connector';

// Guards and Interceptors
import { IntegrationAuthGuard } from './guards/integration-auth.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { IntegrationLoggingInterceptor } from './interceptors/integration-logging.interceptor';

// External modules
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { QueueModule } from '../queue/queue.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret-key-change-in-production',
      signOptions: { expiresIn: '1h' },
    }),
    DatabaseModule,
    CacheModule,
    QueueModule,
    TenantModule,
    AuthModule,
  ],
  controllers: [
    IntegrationController,
    WebhookController,
    ConnectorController,
    DeveloperPortalController,
  ],
  providers: [
    // Core Services
    IntegrationService,
    WebhookService,
    OAuth2Service,
    ApiKeyService,
    ConnectorService,
    SyncService,
    IntegrationHealthService,
    DeveloperPortalService,
    RateLimitService,

    // Repositories
    IntegrationRepository,
    WebhookRepository,
    ApiKeyRepository,
    ConnectorRepository,
    SyncLogRepository,

    // Connectors
    QuickBooksConnector,
    XeroConnector,
    ShopifyConnector,
    StripeConnector,

    // Guards and Interceptors
    IntegrationAuthGuard,
    RateLimitGuard,
    IntegrationLoggingInterceptor,
  ],
  exports: [
    IntegrationService,
    WebhookService,
    OAuth2Service,
    ApiKeyService,
    ConnectorService,
    SyncService,
    IntegrationHealthService,
    DeveloperPortalService,
    RateLimitService,
  ],
})
export class IntegrationModule {}