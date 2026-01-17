import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Decorator to extract replication configuration from context
 */
export const CurrentReplicationConfig = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    return request.replicationConfig;
  },
);

/**
 * Decorator to validate replication access
 */
export const ValidateReplicationAccess = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const args = ctx.getArgs();
    
    // Add replication context to request
    request.replicationContext = {
      configId: args.configId,
      sourceRegion: args.sourceRegion || args.input?.sourceRegion,
      targetRegion: args.targetRegion || args.input?.targetRegion,
    };
    
    return request.replicationContext;
  },
);

/**
 * Decorator to extract RPO requirements from context
 */
export const RPORequirement = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const args = ctx.getArgs();
    return args.rpoMinutes || args.input?.rpoMinutes;
  },
);

/**
 * Decorator to validate replication lag thresholds
 */
export const ValidateReplicationLag = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const args = ctx.getArgs();
    
    // Add lag validation context
    request.lagValidationContext = {
      maxLagSeconds: args.maxLagSeconds || 300, // 5 minutes default
      alertThreshold: args.alertThreshold || 60, // 1 minute default
      configId: args.configId,
    };
    
    return request.lagValidationContext;
  },
);