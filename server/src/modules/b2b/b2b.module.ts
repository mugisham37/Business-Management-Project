import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { PubSubModule } from '../../common/graphql/pubsub.module';

// Services
import { B2BOrderService } from './services/b2b-order.service';
import { QuoteService } from './services/quote.service';
import { ContractService } from './services/contract.service';
import { TerritoryService } from './services/territory.service';
import { CustomerPortalService } from './services/customer-portal.service';
import { B2BPricingService } from './services/b2b-pricing.service';
import { B2BWorkflowService } from './services/b2b-workflow.service';

// Repositories
import { B2BOrderRepository } from './repositories/b2b-order.repository';
import { QuoteRepository } from './repositories/quote.repository';
import { ContractRepository } from './repositories/contract.repository';
import { TerritoryRepository } from './repositories/territory.repository';

// Resolvers
import { B2BOrderResolver } from './resolvers/b2b-order.resolver';
import { QuoteResolver } from './resolvers/quote.resolver';
import { ContractResolver } from './resolvers/contract.resolver';
import { CustomerPortalResolver } from './resolvers/customer-portal.resolver';
import { TerritoryResolver } from './resolvers/territory.resolver';
import { PricingResolver } from './resolvers/pricing.resolver';
import { WorkflowResolver } from './resolvers/workflow.resolver';

// Subscriptions
import { B2BOrderSubscriptionResolver } from './subscriptions/b2b-order.subscription';
import { QuoteSubscriptionResolver } from './subscriptions/quote.subscription';
import { ContractSubscriptionResolver } from './subscriptions/contract.subscription';
import { PricingSubscriptionResolver } from './subscriptions/pricing.subscription';
import { WorkflowSubscriptionResolver } from './subscriptions/workflow.subscription';
import { TerritorySubscriptionResolver } from './subscriptions/territory.subscription';

// Event Handlers
import { B2BOrderEventHandler } from './handlers/b2b-order.handler';
import { QuoteEventHandler } from './handlers/quote.handler';
import { ContractEventHandler } from './handlers/contract.handler';
import { PricingEventHandler } from './handlers/pricing.handler';
import { WorkflowEventHandler } from './handlers/workflow.handler';
import { TerritoryEventHandler } from './handlers/territory.handler';

// DataLoaders
import { B2BOrderDataLoader } from './dataloaders/b2b-order.dataloader';

// Middleware
import { PricingContextMiddleware } from './middleware/pricing-context.middleware';
import { TerritoryContextMiddleware } from './middleware/territory-context.middleware';
import { ApprovalContextMiddleware } from './middleware/approval-context.middleware';
import { AuditLoggingMiddleware } from './middleware/audit-logging.middleware';

// Interceptors
import { PricingCalculationInterceptor } from './interceptors/pricing-calculation.interceptor';

// Guards
import { B2BCustomerGuard } from './guards/b2b-customer.guard';
import { TerritoryAccessGuard } from './guards/territory-access.guard';
import { ApprovalAuthorityGuard } from './guards/approval-authority.guard';
import { PricingAccessGuard } from './guards/pricing-access.guard';
import { ContractAccessGuard } from './guards/contract-access.guard';

/**
 * B2B Module - Comprehensive Business-to-Business Management System
 * 
 * This module provides a complete B2B solution with:
 * - Order Management with approval workflows
 * - Quote generation and conversion
 * - Contract lifecycle management
 * - Territory and sales management
 * - Dynamic pricing with customer tiers
 * - Customer self-service portal
 * - Real-time updates via GraphQL subscriptions
 * - Advanced caching and performance optimization
 * - Multi-tenant architecture with data isolation
 * 
 * Features:
 * - Full GraphQL API with queries, mutations, and subscriptions
 * - DataLoader integration for N+1 query prevention
 * - Automatic pricing calculations with customer-specific rules
 * - Multi-step approval workflows
 * - Real-time notifications and updates
 * - Comprehensive audit trails
 * - Territory-based sales management
 * - Customer portal with self-service capabilities
 * - Advanced analytics and reporting
 * - Integration with inventory, CRM, and financial modules
 */
@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    EventEmitterModule,
    PubSubModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [
    // Core Services - Business logic layer
    B2BOrderService,
    QuoteService,
    ContractService,
    TerritoryService,
    CustomerPortalService,
    B2BPricingService,
    B2BWorkflowService,
    
    // Data Access Layer
    B2BOrderRepository,
    QuoteRepository,
    ContractRepository,
    TerritoryRepository,
    
    // GraphQL Layer - Queries, Mutations, Field Resolvers
    B2BOrderResolver,
    QuoteResolver,
    ContractResolver,
    CustomerPortalResolver,
    TerritoryResolver,
    PricingResolver,
    WorkflowResolver,
    
    // Real-time Layer - Subscriptions
    B2BOrderSubscriptionResolver,
    QuoteSubscriptionResolver,
    ContractSubscriptionResolver,
    PricingSubscriptionResolver,
    WorkflowSubscriptionResolver,
    TerritorySubscriptionResolver,
    
    // Event Handling Layer
    B2BOrderEventHandler,
    QuoteEventHandler,
    ContractEventHandler,
    PricingEventHandler,
    WorkflowEventHandler,
    TerritoryEventHandler,
    
    // Performance Layer - DataLoaders
    B2BOrderDataLoader,
    
    // Security Layer - Guards
    B2BCustomerGuard,
    TerritoryAccessGuard,
    ApprovalAuthorityGuard,
    PricingAccessGuard,
    ContractAccessGuard,
    
    // Cross-cutting Concerns
    PricingCalculationInterceptor,
  ],
  exports: [
    // Export all services for use by other modules
    B2BOrderService,
    QuoteService,
    ContractService,
    TerritoryService,
    CustomerPortalService,
    B2BPricingService,
    B2BWorkflowService,
    
    // Export repositories for advanced use cases
    B2BOrderRepository,
    QuoteRepository,
    ContractRepository,
    TerritoryRepository,
    
    // Export DataLoaders for other modules
    B2BOrderDataLoader,
    
    // Export Event Handlers for integration
    B2BOrderEventHandler,
    QuoteEventHandler,
    ContractEventHandler,
    PricingEventHandler,
    WorkflowEventHandler,
    TerritoryEventHandler,
    
    // Export Guards for reuse
    B2BCustomerGuard,
    TerritoryAccessGuard,
    ApprovalAuthorityGuard,
    PricingAccessGuard,
    ContractAccessGuard,
  ],
})
export class B2BModule implements NestModule {
  /**
   * Configure middleware for the B2B module
   * 
   * Applies multiple middleware layers:
   * - Audit logging for compliance and security
   * - Pricing context for customer-specific pricing
   * - Territory context for sales territory management
   * - Approval context for workflow permissions
   */
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        AuditLoggingMiddleware,
        PricingContextMiddleware,
        TerritoryContextMiddleware,
        ApprovalContextMiddleware
      )
      .forRoutes('*'); // Apply to all routes in this module
  }
}