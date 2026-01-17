import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Decorator to extract service health context
 */
export const ServiceHealthContext = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const args = ctx.getArgs();
    
    request.serviceHealthContext = {
      serviceName: args.serviceName,
      healthThreshold: args.healthThreshold || 95,
      monitoringEnabled: args.monitoringEnabled !== false,
    };
    
    return request.serviceHealthContext;
  },
);

/**
 * Decorator to validate degradation permissions
 */
export const ValidateDegradationPermission = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const args = ctx.getArgs();
    
    // Add degradation context
    request.degradationContext = {
      serviceName: args.serviceName,
      degradationLevel: args.degradationLevel,
      reason: args.reason,
      isAutomatic: args.isAutomatic || false,
    };
    
    return request.degradationContext;
  },
);

/**
 * Decorator to extract test configuration
 */
export const TestConfiguration = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const args = ctx.getArgs();
    
    return {
      testType: args.testType,
      duration: args.duration || 300, // 5 minutes default
      includeFailover: args.includeFailover !== false,
      includeDegradation: args.includeDegradation !== false,
      includeRecovery: args.includeRecovery !== false,
    };
  },
);

/**
 * Decorator to validate business continuity test permissions
 */
export const ValidateTestPermission = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const args = ctx.getArgs();
    
    // Add test permission context
    request.testPermissionContext = {
      testType: args.testType,
      impactLevel: args.impactLevel || 'low',
      requiresApproval: args.requiresApproval !== false,
      scheduledTest: args.scheduledTest || false,
    };
    
    return request.testPermissionContext;
  },
);