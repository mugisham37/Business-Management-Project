import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { SecurityMonitoringService } from '../services/security-monitoring.service';
import { ThreatDetectionService } from '../services/threat-detection.service';
import { 
  SecuritySettings, 
  SecurityEvent, 
  SecurityThreat 
} from '../types/security.types';
import { 
  UpdateSecuritySettingsInput, 
  SecurityEventFilterInput, 
  InvestigateEventInput 
} from '../inputs/security.input';

/**
 * GraphQL resolver for core security operations
 * Provides queries and mutations for security settings, events, and threat management
 */
@Resolver(() => SecurityEvent)
@UseGuards(JwtAuthGuard)
export class SecurityResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly securityMonitoringService: SecurityMonitoringService,
    private readonly threatDetectionService: ThreatDetectionService,
  ) {
    super(dataLoaderService);
  }

  /**
   * Get security settings for the current tenant
   */
  @Query(() => SecuritySettings, { name: 'securitySettings' })
  @UseGuards(PermissionsGuard)
  @Permissions('security:read')
  async getSecuritySettings(
    @CurrentTenant() tenantId: string,
  ): Promise<SecuritySettings> {
    try {
      // Get security settings from monitoring service
      const settings = await this.securityMonitoringService.getSecuritySettings(tenantId);
      
      return {
        id: `settings_${tenantId}`,
        tenantId,
        passwordMinLength: settings.passwordMinLength || 12,
        passwordRequireUppercase: settings.passwordRequireUppercase !== false,
        passwordRequireLowercase: settings.passwordRequireLowercase !== false,
        passwordRequireNumbers: settings.passwordRequireNumbers !== false,
        passwordRequireSpecialChars: settings.passwordRequireSpecialChars !== false,
        passwordExpiryDays: settings.passwordExpiryDays || 90,
        mfaRequired: settings.mfaRequired || false,
        sessionTimeoutMinutes: settings.sessionTimeoutMinutes || 30,
        maxLoginAttempts: settings.maxLoginAttempts || 5,
        lockoutDurationMinutes: settings.lockoutDurationMinutes || 30,
        ipWhitelistEnabled: settings.ipWhitelistEnabled || false,
        ipWhitelist: settings.ipWhitelist || [],
        auditLogRetentionDays: settings.auditLogRetentionDays || 2555,
        encryptSensitiveData: settings.encryptSensitiveData !== false,
        updatedAt: settings.updatedAt || new Date(),
        updatedBy: settings.updatedBy,
      };
    } catch (error) {
      this.handleError(error, 'Failed to fetch security settings');
      throw error;
    }
  }

  /**
   * Update security settings for the current tenant
   */
  @Mutation(() => SecuritySettings, { name: 'updateSecuritySettings' })
  @UseGuards(PermissionsGuard)
  @Permissions('security:admin')
  async updateSecuritySettings(
    @Args('input') input: UpdateSecuritySettingsInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<SecuritySettings> {
    try {
      // Update security settings
      const settings = await this.securityMonitoringService.updateSecuritySettings(
        tenantId,
        input,
        user.id,
      );

      return {
        id: `settings_${tenantId}`,
        tenantId,
        ...settings,
        updatedAt: new Date(),
        updatedBy: user.id,
      };
    } catch (error) {
      this.handleError(error, 'Failed to update security settings');
      throw error;
    }
  }

  /**
   * Get security events with optional filtering
   */
  @Query(() => [SecurityEvent], { name: 'securityEvents' })
  @UseGuards(PermissionsGuard)
  @Permissions('security:read')
  async getSecurityEvents(
    @Args('filter', { type: () => SecurityEventFilterInput, nullable: true }) filter: SecurityEventFilterInput,
    @CurrentTenant() tenantId: string,
  ): Promise<SecurityEvent[]> {
    try {
      // Build date range
      const startDate = filter?.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = filter?.endDate || new Date();

      // Get security events
      const events = await this.securityMonitoringService.getSecurityEvents(tenantId, {
        type: filter?.type,
        severity: filter?.severity,
        userId: filter?.userId,
        resource: filter?.resource,
        startDate,
        endDate,
        investigated: filter?.investigated,
        limit: filter?.limit || 100,
        offset: filter?.offset || 0,
      });

      return events.map(event => ({
        id: event.id,
        tenantId: event.tenantId,
        type: event.type,
        description: event.description,
        severity: event.severity,
        timestamp: event.timestamp,
        userId: event.userId,
        resource: event.resource,
        resourceId: event.resourceId,
        ipAddress: event.ipAddress,
        metadata: event.metadata,
        investigated: event.investigated || false,
        investigatedBy: event.investigatedBy,
        investigatedAt: event.investigatedAt,
        resolution: event.resolution,
      }));
    } catch (error) {
      this.handleError(error, 'Failed to fetch security events');
      throw error;
    }
  }

  /**
   * Investigate a security event
   */
  @Mutation(() => SecurityEvent, { name: 'investigateEvent' })
  @UseGuards(PermissionsGuard)
  @Permissions('security:investigate')
  async investigateEvent(
    @Args('input') input: InvestigateEventInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<SecurityEvent> {
    try {
      // Mark event as investigated
      const event = await this.securityMonitoringService.investigateEvent(
        tenantId,
        input.eventId,
        {
          investigatedBy: user.id,
          investigatedAt: new Date(),
          resolution: input.resolution,
          notes: input.notes,
        },
      );

      return {
        id: event.id,
        tenantId: event.tenantId,
        type: event.type,
        description: event.description,
        severity: event.severity,
        timestamp: event.timestamp,
        userId: event.userId,
        resource: event.resource,
        resourceId: event.resourceId,
        ipAddress: event.ipAddress,
        metadata: event.metadata,
        investigated: true,
        investigatedBy: user.id,
        investigatedAt: new Date(),
        ...(input.resolution ? { resolution: input.resolution } : {}),
      };
    } catch (error) {
      this.handleError(error, 'Failed to investigate event');
      throw error;
    }
  }

  /**
   * Field resolver to load user information via DataLoader
   */
  @ResolveField('user', () => Object, { nullable: true })
  async user(@Parent() event: SecurityEvent): Promise<any> {
    if (!event.userId) {
      return null;
    }

    const loader = this.dataLoaderService.getLoader(
      'user_by_id',
      async (userIds: readonly string[]) => {
        // This would typically call a user service
        // For now, return placeholder data
        return userIds.map(id => ({
          id,
          email: `user_${id}@example.com`,
          name: `User ${id}`,
        }));
      },
    );

    return loader.load(event.userId);
  }

  /**
   * Field resolver to load resource information via DataLoader
   */
  @ResolveField('resource', () => Object, { nullable: true })
  async resource(@Parent() event: SecurityEvent): Promise<any> {
    if (!event.resource || !event.resourceId) {
      return null;
    }

    const loader = this.dataLoaderService.getLoader(
      `${event.resource}_by_id`,
      async (resourceIds: readonly string[]) => {
        // This would typically call the appropriate service based on resource type
        // For now, return placeholder data
        return resourceIds.map(id => ({
          id,
          type: event.resource,
          name: `${event.resource}_${id}`,
        }));
      },
    );

    return loader.load(event.resourceId);
  }
}
