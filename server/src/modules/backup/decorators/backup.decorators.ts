import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Decorator to get backup context from GraphQL request
 */
export const BackupContext = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    
    return {
      tenantId: request.user?.tenantId,
      userId: request.user?.id,
      userRoles: request.user?.roles || [],
      requestId: request.headers['x-request-id'] || 'unknown',
      userAgent: request.headers['user-agent'] || 'unknown',
      ipAddress: request.ip || request.connection?.remoteAddress || 'unknown',
    };
  },
);

/**
 * Decorator to extract backup operation metadata
 */
export const BackupOperation = createParamDecorator(
  (operation: string, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const info = ctx.getInfo();
    
    return {
      operation: operation || info.fieldName,
      operationType: info.operation.operation,
      selectionSet: info.fieldNodes[0]?.selectionSet?.selections?.map(
        (selection: any) => selection.name?.value
      ) || [],
      requestedFields: info.fieldNodes[0]?.selectionSet?.selections?.length || 0,
      complexity: calculateQueryComplexity(info.fieldNodes[0]),
    };
  },
);

/**
 * Calculate basic query complexity
 */
function calculateQueryComplexity(fieldNode: any): number {
  if (!fieldNode?.selectionSet?.selections) {
    return 1;
  }
  
  let complexity = 1;
  for (const selection of fieldNode.selectionSet.selections) {
    if (selection.selectionSet) {
      complexity += calculateQueryComplexity(selection);
    } else {
      complexity += 1;
    }
  }
  
  return complexity;
}

/**
 * Decorator for backup audit logging
 */
export const AuditBackupOperation = () => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const operationName = `${target.constructor.name}.${propertyName}`;
      
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        
        // Log successful operation
        console.log(`[BACKUP_AUDIT] ${operationName} completed in ${duration}ms`);
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Log failed operation
        console.error(`[BACKUP_AUDIT] ${operationName} failed after ${duration}ms:`, error);
        
        throw error;
      }
    };
    
    return descriptor;
  };
};

/**
 * Decorator for backup rate limiting
 */
export const RateLimitBackup = (maxOperations: number, windowMs: number) => {
  const operationCounts = new Map<string, { count: number; resetTime: number }>();
  
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      // Extract tenant ID from arguments (assuming it's commonly the first or in context)
      const tenantId = args.find(arg => typeof arg === 'string' && arg.startsWith('tenant-')) || 'unknown';
      const key = `${tenantId}:${propertyName}`;
      const now = Date.now();
      
      const current = operationCounts.get(key);
      
      if (!current || now > current.resetTime) {
        // Reset or initialize counter
        operationCounts.set(key, { count: 1, resetTime: now + windowMs });
      } else if (current.count >= maxOperations) {
        // Rate limit exceeded
        throw new Error(`Rate limit exceeded for ${propertyName}. Max ${maxOperations} operations per ${windowMs}ms`);
      } else {
        // Increment counter
        current.count++;
      }
      
      return method.apply(this, args);
    };
    
    return descriptor;
  };
};

/**
 * Decorator for backup validation
 */
export const ValidateBackupInput = () => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      // Find input objects in arguments
      const inputs = args.filter(arg => 
        arg && typeof arg === 'object' && !Array.isArray(arg) && !(arg instanceof Date)
      );
      
      for (const input of inputs) {
        // Validate backup-specific constraints
        if (input.retentionDays && (input.retentionDays < 1 || input.retentionDays > 3650)) {
          throw new Error('Retention days must be between 1 and 3650');
        }
        
        if (input.priority && (input.priority < 1 || input.priority > 10)) {
          throw new Error('Priority must be between 1 and 10');
        }
        
        if (input.includeData && input.excludeData) {
          const overlap = input.includeData.filter((item: string) => 
            input.excludeData.includes(item)
          );
          if (overlap.length > 0) {
            throw new Error(`Cannot both include and exclude the same data: ${overlap.join(', ')}`);
          }
        }
      }
      
      return method.apply(this, args);
    };
    
    return descriptor;
  };
};

/**
 * Decorator for backup performance monitoring
 */
export const MonitorBackupPerformance = () => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const startMemory = process.memoryUsage();
      
      try {
        const result = await method.apply(this, args);
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        
        const metrics = {
          operation: `${target.constructor.name}.${propertyName}`,
          duration: endTime - startTime,
          memoryDelta: {
            rss: endMemory.rss - startMemory.rss,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          },
          timestamp: new Date().toISOString(),
        };
        
        // In a real implementation, you'd send this to a monitoring service
        console.log('[BACKUP_METRICS]', JSON.stringify(metrics));
        
        return result;
      } catch (error) {
        const endTime = Date.now();
        
        console.log('[BACKUP_METRICS_ERROR]', {
          operation: `${target.constructor.name}.${propertyName}`,
          duration: endTime - startTime,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
        
        throw error;
      }
    };
    
    return descriptor;
  };
};