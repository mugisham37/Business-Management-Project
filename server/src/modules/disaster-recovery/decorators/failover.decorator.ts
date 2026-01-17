import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Decorator to extract failover configuration from context
 */
export const CurrentFailoverConfig = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    return request.failoverConfig;
  },
);

/**
 * Decorator to validate failover service access
 */
export const ValidateFailoverAccess = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const args = ctx.getArgs();
    
    // Add service name to request for middleware processing
    if (args.serviceName || args.input?.serviceName) {
      request.failoverServiceName = args.serviceName || args.input.serviceName;
    }
    
    if (args.configId) {
      request.failoverConfigId = args.configId;
    }
    
    return {
      serviceName: request.failoverServiceName,
      configId: request.failoverConfigId,
    };
  },
);

/**
 * Decorator to extract target region from context
 */
export const TargetRegion = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const args = ctx.getArgs();
    return args.targetRegion || args.input?.targetRegion;
  },
);

/**
 * Decorator to validate automatic failover permissions
 */
export const ValidateAutomaticFailover = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const args = ctx.getArgs();
    
    // Add automatic failover context
    request.automaticFailoverContext = {
      isAutomatic: args.isAutomatic || false,
      reason: args.reason || args.input?.reason,
      configId: args.configId,
    };
    
    return request.automaticFailoverContext;
  },
);