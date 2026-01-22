import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { TenantInterceptor } from '../../tenant/interceptors/tenant.interceptor';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { BaseResolver } from '../../../common/graphql/base.resolver';

import { ConnectorService } from '../services/connector.service';
import { IntegrationService } from '../services/integration.service';

import { 
  ConnectorType, 
  ConnectorMetadataType, 
  ConnectorTestResult 
} from '../types/connector.graphql.types';
import { 
  InstallConnectorInput, 
  ConfigureConnectorInput, 
  UpdateConnectorInput 
} from '../inputs/connector.input';
import { IntegrationType } from '../types/integration.graphql.types';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Resolver(() => ConnectorType)
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
export class ConnectorResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly connectorService: ConnectorService,
    private readonly integrationService: IntegrationService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => ConnectorType, { name: 'connector', nullable: true })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:read')
  async getConnector(
    @Args('type') type: string,
    @Args('name') name: string,
  ): Promise<ConnectorType | null> {
    const { IntegrationType: IntegrationTypeEnum } = await import('../entities/integration.entity');
    const connector = await this.connectorService.getConnector(type as any, name);
    
    if (!connector) {
      return null;
    }

    const metadata = connector.getMetadata();
    return {
      id: metadata.name,
      name: metadata.name,
      displayName: metadata.displayName,
      description: metadata.description,
      type: metadata.type,
      version: metadata.version,
      capabilities: metadata.capabilities as any[],
      supportedEvents: metadata.supportedEvents,
      supportedOperations: metadata.supportedOperations,
      isActive: true,
      isOfficial: metadata.isOfficial || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
  }

  @Query(() => [ConnectorType], { name: 'connectors' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:read')
  async listConnectors(
    @Args('type', { nullable: true }) type?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
  ): Promise<ConnectorType[]> {
    const params: any = {};
    if (type !== undefined) params.type = type;
    if (isActive !== undefined) params.isActive = isActive;
    
    const connectors = await this.connectorService.listConnectors(params);

    return connectors.map(connector => ({
      id: connector.id,
      name: connector.name,
      displayName: connector.displayName,
      description: connector.description,
      type: connector.type,
      version: connector.version,
      capabilities: connector.capabilities as any[],
      supportedEvents: connector.supportedEvents,
      supportedOperations: connector.supportedOperations,
      isActive: connector.isActive,
      isOfficial: connector.isOfficial,
      createdAt: connector.createdAt,
      updatedAt: connector.updatedAt,
    })) as any[];
  }

  @Mutation(() => ConnectorType, { name: 'installConnector' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:create')
  async installConnector(
    @Args('input') input: InstallConnectorInput,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<ConnectorType> {
    // Create integration with the connector
    const integration = await this.integrationService.create(tenantId, {
      name: input.name,
      displayName: input.name,
      type: input.type as any,
      authType: 'api_key' as any,
      providerName: input.name,
      config: input.config,
      authConfig: input.authConfig || {},
    }, user.id);

    // Get connector metadata
    const { IntegrationType: IntegrationTypeEnum } = await import('../entities/integration.entity');
    const connector = await this.connectorService.getConnector(input.type as any, input.name);
    
    if (!connector) {
      throw new Error(`Connector not found: ${input.name}`);
    }

    const metadata = connector.getMetadata();
    return {
      id: integration.id,
      name: metadata.name,
      displayName: metadata.displayName,
      description: metadata.description,
      type: metadata.type,
      version: metadata.version,
      capabilities: metadata.capabilities as any[],
      supportedEvents: metadata.supportedEvents,
      supportedOperations: metadata.supportedOperations,
      isActive: true,
      isOfficial: metadata.isOfficial || false,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    } as any;
  }

  @Mutation(() => ConnectorType, { name: 'configureConnector' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:update')
  async configureConnector(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: ConfigureConnectorInput,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<ConnectorType> {
    // Update integration configuration
    const updateData: any = { config: input.config };
    if (input.authConfig !== undefined) {
      updateData.authConfig = input.authConfig;
    }
    
    const integration = await this.integrationService.update(tenantId, id, updateData, user.id);

    // Get connector metadata
    const { IntegrationType: IntegrationTypeEnum } = await import('../entities/integration.entity');
    const connector = await this.connectorService.getConnector(
      integration.type as any,
      integration.providerName!,
    );
    
    if (!connector) {
      throw new Error(`Connector not found: ${integration.providerName}`);
    }

    const metadata = connector.getMetadata();
    return {
      id: integration.id,
      name: metadata.name,
      displayName: metadata.displayName,
      description: metadata.description,
      type: metadata.type,
      version: metadata.version,
      capabilities: metadata.capabilities as any[],
      supportedEvents: metadata.supportedEvents,
      supportedOperations: metadata.supportedOperations,
      isActive: integration.status === 'active',
      isOfficial: metadata.isOfficial || false,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    } as any;
  }

  @Mutation(() => Boolean, { name: 'uninstallConnector' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:delete')
  async uninstallConnector(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.integrationService.delete(tenantId, id, user.id);
    return true;
  }

  @Query(() => ConnectorMetadataType, { name: 'connectorMetadata', nullable: true })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:read')
  async getConnectorMetadata(
    @Args('type') type: string,
    @Args('name') name: string,
  ): Promise<ConnectorMetadataType | null> {
    const { IntegrationType: IntegrationTypeEnum } = await import('../entities/integration.entity');
    const metadata = await this.connectorService.getConnectorMetadata(type as any, name);
    
    if (!metadata) {
      return null;
    }

    return {
      name: metadata.name,
      displayName: metadata.displayName,
      description: metadata.description,
      type: metadata.type,
      version: metadata.version,
      capabilities: metadata.capabilities as any[],
      supportedEvents: metadata.supportedEvents,
      supportedOperations: metadata.supportedOperations,
      documentationUrl: metadata.documentationUrl,
      isOfficial: metadata.isOfficial || false,
    } as any;
  }

  @Query(() => ConnectorTestResult, { name: 'testConnectorConnection' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:test')
  async testConnection(
    @Args('type') type: string,
    @Args('name') name: string,
    @Args('config', { type: () => Object }) config: Record<string, any>,
  ): Promise<ConnectorTestResult> {
    const { IntegrationType: IntegrationTypeEnum } = await import('../entities/integration.entity');
    const result = await this.connectorService.testConnection(type as any, name, config as any);
    
    return {
      success: result.success,
      error: result.error || '',
      details: JSON.stringify(result.details),
      timestamp: new Date(),
    };
  }

  @ResolveField(() => [IntegrationType])
  async integrations(
    @Parent() connector: ConnectorType,
    @CurrentTenant() tenantId: string,
  ): Promise<IntegrationType[]> {
    // Load integrations using this connector
    const integrations = await this.integrationService.findAll(tenantId, {
      providerName: connector.name,
    });

    return integrations as any[];
  }
}
