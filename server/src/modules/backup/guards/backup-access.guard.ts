import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';

/**
 * Guard to control access to backup operations based on backup ownership and permissions
 */
@Injectable()
export class BackupAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const args = ctx.getArgs();
    
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user has admin role (can access all backups)
    if (user.roles?.includes('admin') || user.roles?.includes('backup-admin')) {
      return true;
    }

    // For tenant-specific operations, ensure user belongs to the tenant
    const tenantId = user.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('User not associated with any tenant');
    }

    // Check backup ID access if provided
    const backupId = args.id || args.backupId || args.input?.backupId;
    if (backupId) {
      // In a real implementation, you'd check if the backup belongs to the user's tenant
      // For now, we'll assume the backup service handles this validation
    }

    // Check scheduled job access
    const jobId = args.jobId;
    if (jobId) {
      // In a real implementation, you'd check if the job belongs to the user's tenant
    }

    return true;
  }
}

/**
 * Guard to prevent concurrent backup operations
 */
@Injectable()
export class BackupConcurrencyGuard implements CanActivate {
  private static activeOperations = new Map<string, Set<string>>();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const info = ctx.getInfo();
    
    const user = request.user;
    const tenantId = user?.tenantId;
    const operation = info.fieldName;
    
    if (!tenantId) {
      return true; // Let other guards handle authentication
    }

    // Check for concurrent operations
    const tenantOperations = BackupConcurrencyGuard.activeOperations.get(tenantId) || new Set();
    
    // Prevent multiple backup creations simultaneously
    if (operation === 'createBackup' && tenantOperations.has('createBackup')) {
      throw new ForbiddenException('Another backup operation is already in progress for this tenant');
    }

    // Prevent multiple restore operations simultaneously
    if ((operation === 'restoreBackup' || operation === 'executeRecovery') && 
        (tenantOperations.has('restoreBackup') || tenantOperations.has('executeRecovery'))) {
      throw new ForbiddenException('Another restore operation is already in progress for this tenant');
    }

    // Add operation to active set
    tenantOperations.add(operation);
    BackupConcurrencyGuard.activeOperations.set(tenantId, tenantOperations);

    // Set up cleanup after operation completes
    const originalMethod = context.getHandler();
    const cleanup = () => {
      const ops = BackupConcurrencyGuard.activeOperations.get(tenantId);
      if (ops) {
        ops.delete(operation);
        if (ops.size === 0) {
          BackupConcurrencyGuard.activeOperations.delete(tenantId);
        }
      }
    };

    // Schedule cleanup (this is a simplified approach)
    setTimeout(cleanup, 300000); // 5 minutes max operation time

    return true;
  }
}

/**
 * Guard to enforce backup quotas and limits
 */
@Injectable()
export class BackupQuotaGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const args = ctx.getArgs();
    const info = ctx.getInfo();
    
    const user = request.user;
    const tenantId = user?.tenantId;
    const operation = info.fieldName;
    
    if (!tenantId) {
      return true; // Let other guards handle authentication
    }

    // Check backup creation limits
    if (operation === 'createBackup') {
      // In a real implementation, you'd check:
      // - Daily backup limit
      // - Storage quota
      // - Concurrent backup limit
      // - Backup frequency limits
      
      const input = args.input;
      if (input) {
        // Example: Prevent very large retention periods for non-admin users
        if (input.retentionDays > 365 && !user.roles?.includes('admin')) {
          throw new ForbiddenException('Retention period exceeds allowed limit for your user role');
        }
        
        // Example: Prevent geographic replication for basic users
        if (input.geographicReplication && !user.roles?.includes('premium')) {
          throw new ForbiddenException('Geographic replication requires premium subscription');
        }
      }
    }

    // Check scheduled backup limits
    if (operation === 'createScheduledBackup') {
      // In a real implementation, you'd check:
      // - Maximum number of scheduled jobs per tenant
      // - Minimum interval between scheduled backups
      // - Resource allocation limits
    }

    return true;
  }
}

/**
 * Guard to validate backup operation timing
 */
@Injectable()
export class BackupTimingGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const args = ctx.getArgs();
    const info = ctx.getInfo();
    
    const operation = info.fieldName;
    
    // Validate point-in-time recovery timing
    if (operation === 'executeRecovery' || operation === 'createRecoveryPlan') {
      const input = args.input;
      if (input?.targetDateTime) {
        const targetDate = new Date(input.targetDateTime);
        const now = new Date();
        
        // Prevent recovery to future dates
        if (targetDate > now) {
          throw new ForbiddenException('Cannot recover to a future point in time');
        }
        
        // Prevent recovery to very old dates (beyond retention policy)
        const maxAgeMs = 365 * 24 * 60 * 60 * 1000; // 1 year
        if (now.getTime() - targetDate.getTime() > maxAgeMs) {
          throw new ForbiddenException('Recovery point is beyond the maximum retention period');
        }
      }
    }

    // Validate scheduled backup timing
    if (operation === 'createScheduledBackup' || operation === 'updateScheduledBackup') {
      const input = args.input;
      if (input?.schedule) {
        // Basic cron validation (in a real implementation, use a proper cron parser)
        const cronParts = input.schedule.split(' ');
        if (cronParts.length !== 5) {
          throw new ForbiddenException('Invalid cron schedule format');
        }
        
        // Prevent too frequent backups (minimum 1 hour interval)
        if (input.schedule.includes('* * * * *')) {
          throw new ForbiddenException('Backup schedule too frequent. Minimum interval is 1 hour');
        }
      }
    }

    return true;
  }
}