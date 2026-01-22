import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { DataWarehouseService } from '../services/data-warehouse.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { DataCube } from '../types/analytics.types';

@Resolver()
@UseGuards(JwtAuthGuard)
export class DataWarehouseResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly dataWarehouseService: DataWarehouseService,
    private readonly cacheService: IntelligentCacheService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => String, { name: 'queryWarehouse' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async queryWarehouse(
    @Args('query') query: string,
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      const result = await this.dataWarehouseService.executeAnalyticsQuery(tenantId, query);
      return JSON.stringify(result);
    } catch (error) {
      this.handleError(error, 'Failed to query warehouse');
      throw error;
    }
  }

  @Query(() => DataCube, { name: 'getDataCube' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getDataCube(
    @Args('cubeName') cubeName: string,
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<DataCube> {
    try {
      const cacheKey = `cube:${tenantId}:${cubeName}`;
      const cached = await this.cacheService.get(cacheKey);

      if (cached) {
        const cubeData = cached as any;
        return {
          id: cubeData.id || `cube_${cubeName}`,
          name: cubeData.name || cubeName,
          dimensions: cubeData.dimensions || [],
          measures: cubeData.measures || [],
          data: JSON.stringify(cubeData.data || {}),
        };
      }

      // Mock cube data
      const cubeData = {
        id: `cube_${cubeName}`,
        name: cubeName,
        dimensions: ['time', 'location', 'product'],
        measures: ['revenue', 'quantity', 'profit'],
        data: { values: [] },
      };

      await this.cacheService.set(cacheKey, cubeData, { ttl: 3600 });

      return {
        id: cubeData.id,
        name: cubeData.name,
        dimensions: cubeData.dimensions,
        measures: cubeData.measures,
        data: JSON.stringify(cubeData.data),
      };
    } catch (error) {
      this.handleError(error, 'Failed to get data cube');
      throw error;
    }
  }

  /**
   * Get warehouse statistics
   */
  @Query(() => String, { name: 'getWarehouseStatistics' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getWarehouseStatistics(
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      const statistics = await this.dataWarehouseService.getWarehouseStatistics(tenantId);
      return JSON.stringify(statistics);
    } catch (error) {
      this.handleError(error, 'Failed to get warehouse statistics');
      throw error;
    }
  }

  /**
   * Test warehouse connection
   */
  @Query(() => Boolean, { name: 'testWarehouseConnection' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:admin')
  async testWarehouseConnection(
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    try {
      const isConnected = await this.dataWarehouseService.testConnection(tenantId);
      return isConnected;
    } catch (error) {
      this.handleError(error, 'Failed to test warehouse connection');
      throw error;
    }
  }

  /**
   * Create tenant schema in warehouse
   */
  @Mutation(() => String, { name: 'createTenantSchema' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:admin')
  async createTenantSchema(
    @Args('schemaConfig', { type: () => String }) schemaConfig: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      await this.dataWarehouseService.createTenantSchema(tenantId);
      return 'Tenant schema created successfully';
    } catch (error) {
      this.handleError(error, 'Failed to create tenant schema');
      throw error;
    }
  }

  /**
   * Optimize warehouse performance
   */
  @Mutation(() => String, { name: 'optimizeWarehouse' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:admin')
  async optimizeWarehouse(
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
    @Args('optimizationConfig', { type: () => String, nullable: true }) optimizationConfig?: string,
  ): Promise<string> {
    try {
      await this.dataWarehouseService.optimizeWarehouse(tenantId);
      return 'Warehouse optimization completed successfully';
    } catch (error) {
      this.handleError(error, 'Failed to optimize warehouse');
      throw error;
    }
  }

  /**
   * Create partitions for better performance
   */
  @Mutation(() => String, { name: 'createPartitions' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:admin')
  async createPartitions(
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
    @Args('partitionConfig', { type: () => String }) partitionConfig: string,
  ): Promise<string> {
    try {
      const config = JSON.parse(partitionConfig);
      await this.dataWarehouseService.createPartitions(tenantId, 'default', config);
      return 'Partitions created successfully';
    } catch (error) {
      this.handleError(error, 'Failed to create partitions');
      throw error;
    }
  }

  /**
   * Get available data cubes
   */
  @Query(() => [DataCube], { name: 'getDataCubes' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getDataCubes(
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<DataCube[]> {
    try {
      // Mock available cubes
      const cubes = [
        {
          id: 'cube_sales',
          name: 'sales',
          dimensions: ['time', 'location', 'product'],
          measures: ['revenue', 'quantity'],
          data: { values: [] },
        },
      ];
      
      return cubes.map((cube: any) => ({
        id: cube.id || `cube_${cube.name}`,
        name: cube.name,
        dimensions: cube.dimensions || [],
        measures: cube.measures || [],
        data: JSON.stringify(cube.data || {}),
      }));
    } catch (error) {
      this.handleError(error, 'Failed to get data cubes');
      throw error;
    }
  }
}
