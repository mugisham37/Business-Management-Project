import { Resolver, Query, Mutation, Args, Context, Subscription } from '@nestjs/graphql';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';

import { DataManagementService } from '../services/data-management.service';
import { GenerateReportInput } from '../inputs/disaster-recovery.input';
import { DRReportResponse } from '../types/disaster-recovery.types';

@Resolver('DataManagement')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DataManagementResolver {
  private readonly logger = new Logger(DataManagementResolver.name);

  constructor(
    private readonly dataManagementService: DataManagementService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  @Mutation(() => String)
  @RequirePermission('disaster_recovery:execute')
  async performGranularRecovery(
    @Args('recoveryType') recoveryType: string,
    @Args('targetDate', { nullable: true }) targetDate?: Date,
    @Args('targetTables', { type: () => [String], nullable: true }) targetTables?: string[],
    @Args('targetRecords', { nullable: true }) targetRecords?: string,
    @Args('validateIntegrity', { defaultValue: true }) validateIntegrity?: boolean,
    @Context() context?: any,
  ): Promise<string> {
    try {
      const parsedTargetRecords = targetRecords ? JSON.parse(targetRecords) : undefined;
      
      const recoveryOptions: any = {
        tenantId: context.req.tenantId,
        recoveryType: recoveryType as any,
        validateIntegrity,
      };
      
      if (targetDate !== undefined) recoveryOptions.targetDate = targetDate;
      if (targetTables !== undefined) recoveryOptions.targetTables = targetTables;
      if (parsedTargetRecords !== undefined) recoveryOptions.targetRecords = parsedTargetRecords;
      
      const result = await this.dataManagementService.performGranularRecovery(recoveryOptions);

      // Emit recovery event
      this.pubSub.publish('dataRecoveryCompleted', {
        dataRecoveryCompleted: {
          tenantId: context.req.tenantId,
          recoveryId: result.recoveryId,
          recoveredRecords: result.recoveredRecords,
          status: result.status,
          affectedTables: result.affectedTables,
        },
      });

      return JSON.stringify(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to perform granular recovery: ${errorMessage}`);
      return JSON.stringify({ error: errorMessage });
    }
  }

  @Mutation(() => String)
  @RequirePermission('disaster_recovery:create')
  async createArchivalPolicy(
    @Args('name') name: string,
    @Args('description') description: string,
    @Args('dataTypes', { type: () => [String] }) dataTypes: string[],
    @Args('retentionPeriodDays') retentionPeriodDays: number,
    @Args('archiveAfterDays') archiveAfterDays: number,
    @Args('compressionEnabled', { defaultValue: true }) compressionEnabled?: boolean,
    @Args('encryptionEnabled', { defaultValue: true }) encryptionEnabled?: boolean,
    @Args('storageLocation', { defaultValue: 's3' }) storageLocation?: string,
    @Context() context?: any,
  ): Promise<string> {
    try {
      const policy = await this.dataManagementService.createArchivalPolicy({
        tenantId: context.req.tenantId,
        name,
        description,
        dataTypes,
        retentionPeriodDays,
        archiveAfterDays,
        compressionEnabled: compressionEnabled || true,
        encryptionEnabled: encryptionEnabled || true,
        storageLocation: storageLocation as any || 's3',
        isActive: true,
        nextExecutionAt: new Date(),
      });

      return JSON.stringify(policy);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create archival policy: ${errorMessage}`);
      return JSON.stringify({ error: errorMessage });
    }
  }

  @Mutation(() => String)
  @RequirePermission('disaster_recovery:execute')
  async executeDataArchival(
    @Args('policyId') policyId: string,
    @Context() context: any,
  ): Promise<string> {
    try {
      const result = await this.dataManagementService.executeDataArchival(policyId);

      // Emit archival completion event
      this.pubSub.publish('dataArchivalCompleted', {
        dataArchivalCompleted: {
          tenantId: context.req.tenantId,
          policyId,
          archivedRecords: result.archivedRecords,
          archiveSize: result.archiveSize,
          archiveLocation: result.archiveLocation,
        },
      });

      return JSON.stringify(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to execute data archival: ${errorMessage}`);
      return JSON.stringify({ error: errorMessage });
    }
  }

  @Mutation(() => String)
  @RequirePermission('disaster_recovery:create')
  async createRetentionPolicy(
    @Args('name') name: string,
    @Args('description') description: string,
    @Args('dataTypes', { type: () => [String] }) dataTypes: string[],
    @Args('retentionPeriodDays') retentionPeriodDays: number,
    @Args('complianceFramework') complianceFramework: string,
    @Args('autoDelete', { defaultValue: false }) autoDelete?: boolean,
    @Args('requiresApproval', { defaultValue: true }) requiresApproval?: boolean,
    @Args('notificationDays', { type: () => [Number], defaultValue: [30, 7, 1] }) notificationDays?: number[],
    @Context() context?: any,
  ): Promise<string> {
    try {
      const policy = await this.dataManagementService.createRetentionPolicy({
        tenantId: context.req.tenantId,
        name,
        description,
        dataTypes,
        retentionPeriodDays,
        complianceFramework: complianceFramework as any,
        autoDelete: autoDelete || false,
        requiresApproval: requiresApproval !== false,
        notificationDays: notificationDays || [30, 7, 1],
        isActive: true,
      });

      return JSON.stringify(policy);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create retention policy: ${errorMessage}`);
      return JSON.stringify({ error: errorMessage });
    }
  }

  @Mutation(() => String)
  @RequirePermission('disaster_recovery:execute')
  async enforceDataRetention(
    @Args('policyId') policyId: string,
    @Context() context: any,
  ): Promise<string> {
    try {
      const result = await this.dataManagementService.enforceDataRetention(policyId);

      // Emit retention enforcement event
      this.pubSub.publish('dataRetentionEnforced', {
        dataRetentionEnforced: {
          tenantId: context.req.tenantId,
          policyId,
          expiredRecords: result.expiredRecords,
          deletedRecords: result.deletedRecords,
          pendingApproval: result.pendingApproval,
        },
      });

      return JSON.stringify(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to enforce data retention: ${errorMessage}`);
      return JSON.stringify({ error: errorMessage });
    }
  }

  @Mutation(() => String)
  @RequirePermission('disaster_recovery:execute')
  async scheduleSecureDestruction(
    @Args('dataType') dataType: string,
    @Args('recordIds', { type: () => [String] }) recordIds: string[],
    @Args('destructionMethod') destructionMethod: string,
    @Args('complianceFramework') complianceFramework: string,
    @Args('scheduledAt') scheduledAt: Date,
    @Args('verificationRequired', { defaultValue: true }) verificationRequired?: boolean,
    @Context() context?: any,
  ): Promise<string> {
    try {
      const destructionOptions: any = {
        tenantId: context.req.tenantId,
        dataType,
        recordIds,
        destructionMethod: destructionMethod as any,
        complianceFramework,
        scheduledAt,
      };
      
      if (verificationRequired !== undefined) {
        destructionOptions.verificationRequired = verificationRequired;
      }
      
      const destruction = await this.dataManagementService.scheduleSecureDestruction(destructionOptions);

      return JSON.stringify(destruction);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to schedule secure destruction: ${errorMessage}`);
      return JSON.stringify({ error: errorMessage });
    }
  }

  @Mutation(() => String)
  @RequirePermission('disaster_recovery:execute')
  async executeSecureDestruction(
    @Args('destructionId') destructionId: string,
    @Context() context: any,
  ): Promise<string> {
    try {
      const result = await this.dataManagementService.executeSecureDestruction(destructionId);

      // Emit destruction completion event
      this.pubSub.publish('secureDestructionCompleted', {
        secureDestructionCompleted: {
          tenantId: context.req.tenantId,
          destructionId,
          destroyedRecords: result.destroyedRecords,
          status: result.status,
          verificationStatus: result.verificationStatus,
          certificateGenerated: !!result.certificatePath,
        },
      });

      return JSON.stringify(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to execute secure destruction: ${errorMessage}`);
      return JSON.stringify({ error: errorMessage });
    }
  }

  // Real-time Subscriptions
  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.dataRecoveryCompleted.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('disaster_recovery:read')
  dataRecoveryCompleted(@Context() context: any) {
    return (this.pubSub as any).asyncIterator('dataRecoveryCompleted');
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.dataArchivalCompleted.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('disaster_recovery:read')
  dataArchivalCompleted(@Context() context: any) {
    return (this.pubSub as any).asyncIterator('dataArchivalCompleted');
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.dataRetentionEnforced.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('disaster_recovery:read')
  dataRetentionEnforced(@Context() context: any) {
    return (this.pubSub as any).asyncIterator('dataRetentionEnforced');
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.secureDestructionCompleted.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('disaster_recovery:read')
  secureDestructionCompleted(@Context() context: any) {
    return (this.pubSub as any).asyncIterator('secureDestructionCompleted');
  }
}