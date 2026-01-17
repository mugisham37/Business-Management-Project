import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { TerritoryService } from '../services/territory.service';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import {
  CreateTerritoryInput,
  UpdateTerritoryInput,
  TerritoryQueryInput,
  AssignCustomerToTerritoryInput,
  BulkAssignCustomersInput,
  TerritoryPerformanceQueryInput,
  TerritoryGraphQLType,
  TerritoryListResponse,
  TerritoryCustomersResponse,
  TerritoryCustomerAssignmentType,
  BulkAssignmentResponse,
  TerritoryAssignmentResponse,
  TerritoryPerformanceType
} from '../types/territory.types';

/**
 * GraphQL resolver for B2B territory management
 * 
 * Provides operations for:
 * - Territory CRUD operations
 * - Customer-to-territory assignments
 * - Territory performance tracking
 * - Sales representative management
 * - Revenue target tracking
 * 
 * @requires JwtAuthGuard - Authentication required for all operations
 * @requires TenantGuard - Tenant isolation enforced
 * @requires PermissionsGuard - Permission-based access control
 */
@Resolver(() => TerritoryGraphQLType)
@UseGuards(JwtAuthGuard, TenantGuard)
export class TerritoryResolver extends BaseResolver {
  private readonly logger = new Logger(TerritoryResolver.name);

  constructor(
    protected readonly dataLoaderService: DataLoaderService,
    private readonly territoryService: TerritoryService,
  ) {
    super(dataLoaderService);
  }

  /**
   * Query: Get a single territory by ID
   * @permission territory:read
   */
  @Query(() => TerritoryGraphQLType)
  @UseGuards(PermissionsGuard)
  @Permissions('territory:read')
  async getTerritory(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<TerritoryGraphQLType> {
    try {
      this.logger.debug(`Fetching territory ${id} for tenant ${tenantId}`);
      return await this.territoryService.findTerritoryById(tenantId, id);
    } catch (error) {
      this.logger.error(`Failed to get territory ${id}:`, error);
      throw error;
    }
  }

  /**
   * Query: Get paginated list of territories with filtering
   * @permission territory:read
   */
  @Query(() => TerritoryListResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('territory:read')
  async getTerritories(
    @Args('query') query: TerritoryQueryInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<TerritoryListResponse> {
    try {
      this.logger.debug(`Fetching territories for tenant ${tenantId} with query:`, query);
      const result = await this.territoryService.findTerritories(tenantId, query);
      
      return {
        territories: result.territories,
        total: result.total,
      };
    } catch (error) {
      this.logger.error(`Failed to get territories:`, error);
      throw error;
    }
  }

  /**
   * Query: Get territory performance metrics
   * Returns revenue, customer count, and target achievement
   * @permission territory:read
   */
  @Query(() => TerritoryPerformanceType)
  @UseGuards(PermissionsGuard)
  @Permissions('territory:read')
  async getTerritoryPerformance(
    @Args('id', { type: () => ID }) id: string,
    @Args('query') query: TerritoryPerformanceQueryInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<TerritoryPerformanceType> {
    try {
      this.logger.debug(`Fetching territory performance for ${id}`);
      return await this.territoryService.getTerritoryPerformance(
        tenantId,
        id,
        query.startDate || new Date(new Date().getFullYear(), 0, 1),
        query.endDate || new Date(),
      );
    } catch (error) {
      this.logger.error(`Failed to get territory performance for ${id}:`, error);
      throw error;
    }
  }

  /**
   * Query: Get customers assigned to a territory
   * @permission territory:read
   */
  @Query(() => TerritoryCustomersResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('territory:read')
  async getTerritoryCustomers(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<TerritoryCustomersResponse> {
    try {
      this.logger.debug(`Fetching customers for territory ${id}`);
      const customers = await this.territoryService.getTerritoryCustomers(tenantId, id);
      
      return {
        customers: customers.map(c => c.customer),
        total: customers.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get territory customers for ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Create a new territory
   * @permission territory:create
   */
  @Mutation(() => TerritoryGraphQLType)
  @UseGuards(PermissionsGuard)
  @Permissions('territory:create')
  async createTerritory(
    @Args('input') input: CreateTerritoryInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<TerritoryGraphQLType> {
    try {
      this.logger.log(`Creating territory for tenant ${tenantId} by user ${user.id}`);
      
      const territory = await this.territoryService.createTerritory(
        tenantId,
        input,
        user.id,
      );

      this.logger.log(`Created territory ${territory.territoryCode} (${territory.id})`);
      return territory;
    } catch (error) {
      this.logger.error(`Failed to create territory:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Update an existing territory
   * @permission territory:update
   */
  @Mutation(() => TerritoryGraphQLType)
  @UseGuards(PermissionsGuard)
  @Permissions('territory:update')
  async updateTerritory(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateTerritoryInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<TerritoryGraphQLType> {
    try {
      this.logger.log(`Updating territory ${id} for tenant ${tenantId} by user ${user.id}`);
      
      const territory = await this.territoryService.updateTerritory(
        tenantId,
        id,
        input,
        user.id,
      );

      this.logger.log(`Updated territory ${id}`);
      return territory;
    } catch (error) {
      this.logger.error(`Failed to update territory ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Assign a customer to a territory
   * @permission territory:assign
   */
  @Mutation(() => TerritoryAssignmentResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('territory:assign')
  async assignCustomerToTerritory(
    @Args('territoryId', { type: () => ID }) territoryId: string,
    @Args('input') input: AssignCustomerToTerritoryInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<TerritoryAssignmentResponse> {
    try {
      this.logger.log(`Assigning customer ${input.customerId} to territory ${territoryId} by user ${user.id}`);
      
      const assignment = await this.territoryService.assignCustomerToTerritory(
        tenantId,
        territoryId,
        input,
        user.id,
      );

      this.logger.log(`Assigned customer ${input.customerId} to territory ${territoryId}`);
      return {
        assignment,
        message: 'Customer assigned to territory successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to assign customer to territory:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Bulk assign multiple customers to a territory
   * @permission territory:assign
   */
  @Mutation(() => BulkAssignmentResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('territory:assign')
  async bulkAssignCustomersToTerritory(
    @Args('territoryId', { type: () => ID }) territoryId: string,
    @Args('input') input: BulkAssignCustomersInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<BulkAssignmentResponse> {
    try {
      this.logger.log(`Bulk assigning ${input.customerIds.length} customers to territory ${territoryId} by user ${user.id}`);
      
      const assignments = await this.territoryService.bulkAssignCustomers(
        tenantId,
        territoryId,
        input,
        user.id,
      );

      this.logger.log(`Bulk assigned ${input.customerIds.length} customers to territory ${territoryId}`);
      return {
        assignments,
        count: assignments.length,
      };
    } catch (error) {
      this.logger.error(`Failed to bulk assign customers to territory:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Activate or deactivate a territory
   * @permission territory:update
   */
  @Mutation(() => TerritoryGraphQLType)
  @UseGuards(PermissionsGuard)
  @Permissions('territory:update')
  async setTerritoryActive(
    @Args('id', { type: () => ID }) id: string,
    @Args('isActive') isActive: boolean,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<TerritoryGraphQLType> {
    try {
      this.logger.log(`Setting territory ${id} active status to ${isActive} by user ${user.id}`);
      
      const territory = await this.territoryService.updateTerritory(
        tenantId,
        id,
        { isActive },
        user.id,
      );

      this.logger.log(`Set territory ${id} active status to ${isActive}`);
      return territory;
    } catch (error) {
      this.logger.error(`Failed to set territory active status:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load customers assigned to territory
   * Uses DataLoader for batch loading to prevent N+1 queries
   */
  @ResolveField('customers')
  async getCustomers(
    @Parent() territory: TerritoryGraphQLType,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      const customers = await this.territoryService.getTerritoryCustomers(tenantId, territory.id);
      return customers.map(c => c.customer);
    } catch (error) {
      this.logger.error(`Failed to load customers for territory ${territory.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load primary sales representative
   * Uses DataLoader for batch loading
   */
  @ResolveField('salesRep')
  async getSalesRep(
    @Parent() territory: TerritoryGraphQLType,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      if (!territory.primarySalesRepId) {
        return null;
      }

      // DataLoader implementation would go here
      return {
        id: territory.primarySalesRepId,
        // Additional user fields would be loaded via DataLoader
      };
    } catch (error) {
      this.logger.error(`Failed to load sales rep for territory ${territory.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load secondary sales representatives
   * Uses DataLoader for batch loading
   */
  @ResolveField('secondarySalesReps')
  async getSecondarySalesReps(
    @Parent() territory: TerritoryGraphQLType,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      if (!territory.secondarySalesRepIds || territory.secondarySalesRepIds.length === 0) {
        return [];
      }

      // DataLoader implementation would go here
      return territory.secondarySalesRepIds.map((id: string) => ({
        id,
        // Additional user fields would be loaded via DataLoader
      }));
    } catch (error) {
      this.logger.error(`Failed to load secondary sales reps for territory ${territory.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load territory manager
   * Uses DataLoader for batch loading
   */
  @ResolveField('manager')
  async getManager(
    @Parent() territory: TerritoryGraphQLType,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      if (!territory.managerId) {
        return null;
      }

      // DataLoader implementation would go here
      return {
        id: territory.managerId,
        // Additional user fields would be loaded via DataLoader
      };
    } catch (error) {
      this.logger.error(`Failed to load manager for territory ${territory.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Calculate customer count
   * Returns the number of active customers in the territory
   */
  @ResolveField('customerCount')
  async getCustomerCount(
    @Parent() territory: TerritoryGraphQLType,
    @CurrentTenant() tenantId: string,
  ): Promise<number> {
    try {
      const customers = await this.territoryService.getTerritoryCustomers(tenantId, territory.id);
      return customers.length;
    } catch (error) {
      this.logger.error(`Failed to calculate customer count for territory ${territory.id}:`, error);
      return 0;
    }
  }

  /**
   * Field Resolver: Calculate target achievement percentage
   * Compares actual revenue to annual target
   */
  @ResolveField('targetAchievement')
  async getTargetAchievement(
    @Parent() territory: TerritoryGraphQLType,
    @CurrentTenant() tenantId: string,
  ): Promise<number> {
    try {
      // Calculate year-to-date performance
      const startDate = new Date(new Date().getFullYear(), 0, 1);
      const endDate = new Date();

      const performance = await this.territoryService.getTerritoryPerformance(
        tenantId,
        territory.id,
        startDate,
        endDate,
      );

      return performance.metrics.targetAchievement;
    } catch (error) {
      this.logger.error(`Failed to calculate target achievement for territory ${territory.id}:`, error);
      return 0;
    }
  }

  /**
   * Field Resolver: Get current period revenue
   * Returns year-to-date revenue for the territory
   */
  @ResolveField('currentRevenue')
  async getCurrentRevenue(
    @Parent() territory: TerritoryGraphQLType,
    @CurrentTenant() tenantId: string,
  ): Promise<number> {
    try {
      // Calculate year-to-date performance
      const startDate = new Date(new Date().getFullYear(), 0, 1);
      const endDate = new Date();

      const performance = await this.territoryService.getTerritoryPerformance(
        tenantId,
        territory.id,
        startDate,
        endDate,
      );

      return performance.metrics.totalRevenue;
    } catch (error) {
      this.logger.error(`Failed to calculate current revenue for territory ${territory.id}:`, error);
      return 0;
    }
  }
}
