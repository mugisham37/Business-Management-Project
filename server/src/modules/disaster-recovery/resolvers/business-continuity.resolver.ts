import { Resolver, Query, Mutation, Args, Context, Subscription } from '@nestjs/graphql';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';

import { BusinessContinuityService } from '../services/business-continuity.service';

@Resolver('BusinessContinuity')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BusinessContinuityResolver {
  private readonly logger = new Logger(BusinessContinuityResolver.name);

  constructor(
    private readonly businessContinuityService: BusinessContinuityService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  @Query(() => String)
  @RequirePermission('disaster_recovery:read')
  async serviceHealthStatus(
    @Args('serviceName', { nullable: true }) serviceName?: string,
    @Context() context?: any,
  ): Promise<string> {
    try {
      const status = this.businessContinuityService.getServiceHealthStatus(serviceName);
      return JSON.stringify(status);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get service health status: ${errorMessage}`);
      return JSON.stringify({ error: errorMessage });
    }
  }

  @Query(() => String)
  @RequirePermission('disaster_recovery:read')
  async businessContinuityMetrics(@Context() context: any): Promise<string> {
    try {
      const metrics = await this.businessContinuityService.getBusinessContinuityMetrics(context.req.tenantId);
      return JSON.stringify(metrics);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get business continuity metrics: ${errorMessage}`);
      return JSON.stringify({ error: errorMessage });
    }
  }

  @Mutation(() => Boolean)
  @RequirePermission('disaster_recovery:execute')
  async implementGracefulDegradation(
    @Args('serviceName') serviceName: string,
    @Args('degradationLevel') degradationLevel: number,
    @Args('reason') reason: string,
    @Context() context: any,
  ): Promise<boolean> {
    try {
      await this.businessContinuityService.implementGracefulDegradation(
        context.req.tenantId,
        serviceName,
        degradationLevel,
        reason
      );

      // Emit degradation event
      this.pubSub.publish('serviceDegraded', {
        serviceDegraded: {
          tenantId: context.req.tenantId,
          serviceName,
          degradationLevel,
          reason,
          timestamp: new Date(),
        },
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to implement graceful degradation: ${errorMessage}`);
      return false;
    }
  }

  @Mutation(() => Boolean)
  @RequirePermission('disaster_recovery:execute')
  async restoreServiceFromDegradation(
    @Args('serviceName') serviceName: string,
    @Context() context: any,
  ): Promise<boolean> {
    try {
      await this.businessContinuityService.restoreServiceFromDegradation(
        context.req.tenantId,
        serviceName
      );

      // Emit restoration event
      this.pubSub.publish('serviceRestored', {
        serviceRestored: {
          tenantId: context.req.tenantId,
          serviceName,
          timestamp: new Date(),
        },
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to restore service from degradation: ${errorMessage}`);
      return false;
    }
  }

  @Mutation(() => String)
  @RequirePermission('disaster_recovery:test')
  async testBusinessContinuity(
    @Args('testType') testType: string,
    @Context() context: any,
  ): Promise<string> {
    try {
      const result = await this.businessContinuityService.testBusinessContinuity(
        context.req.tenantId,
        testType as any
      );

      // Emit test completion event
      this.pubSub.publish('businessContinuityTestCompleted', {
        businessContinuityTestCompleted: {
          tenantId: context.req.tenantId,
          testId: result.testId,
          testType: result.testType,
          status: result.status,
          results: result.results,
        },
      });

      return JSON.stringify(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to test business continuity: ${errorMessage}`);
      return JSON.stringify({ error: errorMessage });
    }
  }

  // Real-time Subscriptions
  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.serviceDegraded.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('disaster_recovery:read')
  serviceDegraded(@Context() context: any) {
    return (this.pubSub as any).asyncIterator('serviceDegraded');
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.serviceRestored.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('disaster_recovery:read')
  serviceRestored(@Context() context: any) {
    return (this.pubSub as any).asyncIterator('serviceRestored');
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.businessContinuityTestCompleted.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('disaster_recovery:read')
  businessContinuityTestCompleted(@Context() context: any) {
    return (this.pubSub as any).asyncIterator('businessContinuityTestCompleted');
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.serviceHealthAlert.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('disaster_recovery:read')
  serviceHealthAlert(@Context() context: any) {
    return (this.pubSub as any).asyncIterator('serviceHealthAlert');
  }
}