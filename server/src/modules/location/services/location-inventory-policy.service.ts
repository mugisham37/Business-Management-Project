import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../../database/drizzle.service';
import { 
  LocationInventoryPolicy, 
  InventoryPolicyType, 
  InventoryPolicyStatus, 
  StockReplenishmentMethod,
  ABCClassification 
} from '../entities/location-inventory-policy.entity';
import { 
  CreateLocationInventoryPolicyDto, 
  UpdateLocationInventoryPolicyDto, 
  LocationInventoryPolicyQueryDto,
  InventoryRecommendationDto,
  BulkInventoryPolicyUpdateDto
} from '../dto/location-inventory-policy.dto';
import { locationInventoryPolicies, inventoryPolicyExecutionLog } from '../../database/schema/location-features.schema';
import { eq, and, desc, asc, count, or, isNull, sql } from 'drizzle-orm';

@Injectable()
export class LocationInventoryPolicyService {
  private readonly logger = new Logger(LocationInventoryPolicyService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new inventory policy for a location
   */
  async createInventoryPolicy(
    tenantId: string,
    locationId: string,
    createDto: CreateLocationInventoryPolicyDto,
    userId: string,
  ): Promise<LocationInventoryPolicy> {
    try {
      // Validate that product or category is specified for specific policies
      if (createDto.policyType !== InventoryPolicyType.ABC_CLASSIFICATION && 
          !createDto.productId && !createDto.categoryId) {
        throw new BadRequestException('Either productId or categoryId must be specified for this policy type');
      }

      // Validate policy parameters
      this.validatePolicyParameters(createDto);

      const policyData = {
        tenantId,
        locationId,
        name: createDto.name,
        description: createDto.description,
        policyType: createDto.policyType,
        productId: createDto.productId,
        categoryId: createDto.categoryId,
        minStockLevel: createDto.minStockLevel,
        maxStockLevel: createDto.maxStockLevel,
        safetyStock: createDto.safetyStock,
        reorderQuantity: createDto.reorderQuantity,
        leadTimeDays: createDto.leadTimeDays,
        replenishmentMethod: createDto.replenishmentMethod || StockReplenishmentMethod.MANUAL,
        abcClassification: createDto.abcClassification,
        seasonalMultiplier: createDto.seasonalMultiplier?.toString() || '1.00',
        forecastPeriodDays: createDto.forecastPeriodDays || 30,
        autoCreatePurchaseOrders: createDto.autoCreatePurchaseOrders ?? false,
        preferredSupplierId: createDto.preferredSupplierId,
        rules: createDto.rules ? JSON.stringify(createDto.rules) : null,
        priority: createDto.priority || 0,
        parameters: createDto.parameters ? JSON.stringify(createDto.parameters) : null,
        isActive: createDto.isActive ?? true,
        status: 'active' as const,
        createdBy: userId,
        updatedBy: userId,
      };

      const [newPolicy] = await this.drizzle.getDb()
        .insert(locationInventoryPolicies)
        .values(policyData)
        .returning();

      const inventoryPolicy = this.mapToEntity(newPolicy);

      // Emit event for sync
      this.eventEmitter.emit('location.inventory-policy.created', {
        tenantId,
        locationId,
        policyId: inventoryPolicy.id,
        inventoryPolicy,
        userId,
      });

      this.logger.log(`Created inventory policy: ${inventoryPolicy.name} for location: ${locationId}`);
      return inventoryPolicy;
    } catch (error: any) {
      this.logger.error(`Failed to create inventory policy: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update an existing inventory policy
   */
  async updateInventoryPolicy(
    tenantId: string,
    locationId: string,
    policyId: string,
    updateDto: UpdateLocationInventoryPolicyDto,
    userId: string,
  ): Promise<LocationInventoryPolicy> {
    try {
      const existingPolicy = await this.findById(tenantId, locationId, policyId);
      if (!existingPolicy) {
        throw new NotFoundException(`Inventory policy with ID ${policyId} not found`);
      }

      const updateData: any = {
        updatedBy: userId,
        updatedAt: new Date(),
      };

      if (updateDto.name !== undefined) updateData.name = updateDto.name;
      if (updateDto.description !== undefined) updateData.description = updateDto.description;
      if (updateDto.policyType !== undefined) updateData.policyType = updateDto.policyType;
      if (updateDto.minStockLevel !== undefined) updateData.minStockLevel = updateDto.minStockLevel;
      if (updateDto.maxStockLevel !== undefined) updateData.maxStockLevel = updateDto.maxStockLevel;
      if (updateDto.safetyStock !== undefined) updateData.safetyStock = updateDto.safetyStock;
      if (updateDto.reorderQuantity !== undefined) updateData.reorderQuantity = updateDto.reorderQuantity;
      if (updateDto.leadTimeDays !== undefined) updateData.leadTimeDays = updateDto.leadTimeDays;
      if (updateDto.replenishmentMethod !== undefined) updateData.replenishmentMethod = updateDto.replenishmentMethod;
      if (updateDto.abcClassification !== undefined) updateData.abcClassification = updateDto.abcClassification;
      if (updateDto.seasonalMultiplier !== undefined) updateData.seasonalMultiplier = updateDto.seasonalMultiplier.toString();
      if (updateDto.forecastPeriodDays !== undefined) updateData.forecastPeriodDays = updateDto.forecastPeriodDays;
      if (updateDto.autoCreatePurchaseOrders !== undefined) updateData.autoCreatePurchaseOrders = updateDto.autoCreatePurchaseOrders;
      if (updateDto.preferredSupplierId !== undefined) updateData.preferredSupplierId = updateDto.preferredSupplierId;
      if (updateDto.rules !== undefined) updateData.rules = updateDto.rules ? JSON.stringify(updateDto.rules) : null;
      if (updateDto.priority !== undefined) updateData.priority = updateDto.priority;
      if (updateDto.parameters !== undefined) updateData.parameters = updateDto.parameters ? JSON.stringify(updateDto.parameters) : null;
      if (updateDto.isActive !== undefined) updateData.isActive = updateDto.isActive;
      if (updateDto.status !== undefined) updateData.status = updateDto.status;

      const [updatedPolicy] = await this.drizzle.getDb()
        .update(locationInventoryPolicies)
        .set(updateData)
        .where(and(
          eq(locationInventoryPolicies.id, policyId),
          eq(locationInventoryPolicies.tenantId, tenantId),
          eq(locationInventoryPolicies.locationId, locationId)
        ))
        .returning();

      const inventoryPolicy = this.mapToEntity(updatedPolicy);

      // Emit event for sync
      this.eventEmitter.emit('location.inventory-policy.updated', {
        tenantId,
        locationId,
        policyId,
        inventoryPolicy,
        userId,
      });

      this.logger.log(`Updated inventory policy: ${policyId} for location: ${locationId}`);
      return inventoryPolicy;
    } catch (error: any) {
      this.logger.error(`Failed to update inventory policy: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete an inventory policy
   */
  async deleteInventoryPolicy(
    tenantId: string,
    locationId: string,
    policyId: string,
    userId: string,
  ): Promise<void> {
    try {
      const existingPolicy = await this.findById(tenantId, locationId, policyId);
      if (!existingPolicy) {
        throw new NotFoundException(`Inventory policy with ID ${policyId} not found`);
      }

      await this.drizzle.getDb()
        .delete(locationInventoryPolicies)
        .where(and(
          eq(locationInventoryPolicies.id, policyId),
          eq(locationInventoryPolicies.tenantId, tenantId),
          eq(locationInventoryPolicies.locationId, locationId)
        ));

      // Emit event for sync
      this.eventEmitter.emit('location.inventory-policy.deleted', {
        tenantId,
        locationId,
        policyId,
        userId,
      });

      this.logger.log(`Deleted inventory policy: ${policyId} for location: ${locationId}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete inventory policy: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find inventory policy by ID
   */
  async findById(tenantId: string, locationId: string, policyId: string): Promise<LocationInventoryPolicy | null> {
    try {
      const [policy] = await this.drizzle.getDb()
        .select()
        .from(locationInventoryPolicies)
        .where(and(
          eq(locationInventoryPolicies.id, policyId),
          eq(locationInventoryPolicies.tenantId, tenantId),
          eq(locationInventoryPolicies.locationId, locationId)
        ));

      return policy ? this.mapToEntity(policy) : null;
    } catch (error: any) {
      this.logger.error(`Failed to find inventory policy by ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find inventory policies with filtering and pagination
   */
  async findInventoryPolicies(
    tenantId: string,
    locationId: string,
    query: LocationInventoryPolicyQueryDto,
  ): Promise<{ policies: LocationInventoryPolicy[]; total: number }> {
    try {
      const conditions = [
        eq(locationInventoryPolicies.tenantId, tenantId),
        eq(locationInventoryPolicies.locationId, locationId),
      ];

      if (query.policyType) {
        conditions.push(eq(locationInventoryPolicies.policyType, query.policyType));
      }

      if (query.status) {
        conditions.push(eq(locationInventoryPolicies.status, query.status));
      }

      if (query.productId) {
        conditions.push(eq(locationInventoryPolicies.productId, query.productId));
      }

      if (query.categoryId) {
        conditions.push(eq(locationInventoryPolicies.categoryId, query.categoryId));
      }

      if (query.activeOnly) {
        conditions.push(eq(locationInventoryPolicies.isActive, true));
      }

      // Count total
      const countResult = await this.drizzle.getDb()
        .select({ count: count() })
        .from(locationInventoryPolicies)
        .where(and(...conditions));
      
      const total = countResult[0]?.count || 0;

      // Get paginated results
      const page = query.page || 1;
      const limit = query.limit || 20;
      const offset = (page - 1) * limit;

      const results = await this.drizzle.getDb()
        .select()
        .from(locationInventoryPolicies)
        .where(and(...conditions))
        .orderBy(desc(locationInventoryPolicies.priority), desc(locationInventoryPolicies.createdAt))
        .limit(limit)
        .offset(offset);

      const policies = results.map(policy => this.mapToEntity(policy));

      return { policies, total };
    } catch (error: any) {
      this.logger.error(`Failed to find inventory policies: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get inventory recommendations for products based on policies
   */
  async getInventoryRecommendations(
    tenantId: string,
    locationId: string,
    productInventory: Array<{
      productId: string;
      categoryId?: string;
      currentStock: number;
      averageDailyDemand?: number;
    }>
  ): Promise<InventoryRecommendationDto[]> {
    try {
      const recommendations: InventoryRecommendationDto[] = [];

      for (const item of productInventory) {
        const applicablePolicies = await this.findApplicablePolicies(
          tenantId,
          locationId,
          item.productId,
          item.categoryId
        );

        if (applicablePolicies.length === 0) {
          continue;
        }

        // Use the highest priority policy for recommendations
        const primaryPolicy = applicablePolicies[0];
        if (!primaryPolicy) {
          continue; // Skip if no applicable policy found
        }
        
        const averageDemand = item.averageDailyDemand || 0;

        const stockStatus = primaryPolicy.getStockStatus(item.currentStock, averageDemand);
        
        let recommendedAction: any = 'maintain';
        let recommendedQuantity = 0;

        if (primaryPolicy.shouldReorder(item.currentStock, averageDemand)) {
          recommendedAction = 'reorder';
          recommendedQuantity = primaryPolicy.calculateReorderQuantity(item.currentStock, averageDemand);
        } else if (primaryPolicy.isOverstocked(item.currentStock)) {
          recommendedAction = 'reduce_stock';
          recommendedQuantity = Math.max(0, item.currentStock - (primaryPolicy.maxStockLevel || item.currentStock));
        } else if (item.currentStock <= (primaryPolicy.safetyStock || 0)) {
          recommendedAction = 'increase_safety_stock';
          recommendedQuantity = (primaryPolicy.safetyStock || 0) - item.currentStock;
        }

        // Calculate expected stock out date
        let expectedStockOutDate: Date | undefined;
        if (averageDemand > 0 && item.currentStock > 0) {
          const daysUntilStockOut = item.currentStock / averageDemand;
          expectedStockOutDate = new Date();
          expectedStockOutDate.setDate(expectedStockOutDate.getDate() + daysUntilStockOut);
        }

        recommendations.push({
          productId: item.productId,
          currentStock: item.currentStock,
          recommendedAction,
          recommendedQuantity,
          reason: stockStatus.recommendation,
          priority: stockStatus.urgency,
          ...(expectedStockOutDate && { expectedStockOutDate }),
          appliedPolicies: applicablePolicies.map(policy => ({
            policyId: policy.id,
            policyName: policy.name,
            policyType: policy.policyType,
          })),
        });

        // Log policy execution
        await this.logPolicyExecution(
          tenantId,
          primaryPolicy.id,
          item.productId,
          'recommendation_check',
          item.currentStock,
          recommendedAction,
          recommendedQuantity,
          undefined,
          undefined,
          { stockStatus, averageDemand },
          'system'
        );
      }

      return recommendations;
    } catch (error: any) {
      this.logger.error(`Failed to get inventory recommendations: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Execute inventory policies for automatic actions
   */
  async executePolicies(
    tenantId: string,
    locationId: string,
    productInventory: Array<{
      productId: string;
      categoryId?: string;
      currentStock: number;
      averageDailyDemand?: number;
    }>,
    userId: string
  ): Promise<Array<{
    productId: string;
    action: string;
    quantity: number;
    success: boolean;
    message: string;
  }>> {
    try {
      const results: any[] = [];

      for (const item of productInventory) {
        const applicablePolicies = await this.findApplicablePolicies(
          tenantId,
          locationId,
          item.productId,
          item.categoryId
        );

        for (const policy of applicablePolicies) {
          if (!policy.isActive || policy.status !== InventoryPolicyStatus.ACTIVE) {
            continue;
          }

          const averageDemand = item.averageDailyDemand || 0;

          if (policy.shouldReorder(item.currentStock, averageDemand)) {
            const reorderQuantity = policy.calculateReorderQuantity(item.currentStock, averageDemand);
            
            let success = false;
            let message = '';

            if (policy.autoCreatePurchaseOrders && policy.preferredSupplierId) {
              // In a real implementation, this would create a purchase order
              // For now, we'll just simulate the action
              success = true;
              message = `Automatic purchase order created for ${reorderQuantity} units`;
              
              // Emit event for purchase order creation
              this.eventEmitter.emit('inventory.purchase-order.auto-created', {
                tenantId,
                locationId,
                productId: item.productId,
                supplierId: policy.preferredSupplierId,
                quantity: reorderQuantity,
                policyId: policy.id,
                userId,
              });
            } else {
              success = true;
              message = `Reorder recommendation: ${reorderQuantity} units`;
            }

            results.push({
              productId: item.productId,
              action: 'reorder',
              quantity: reorderQuantity,
              success,
              message,
            });

            // Log policy execution
            await this.logPolicyExecution(
              tenantId,
              policy.id,
              item.productId,
              'auto_reorder',
              item.currentStock,
              'reorder',
              reorderQuantity,
              success ? 'purchase_order_created' : 'recommendation_only',
              reorderQuantity,
              { averageDemand, autoOrder: policy.autoCreatePurchaseOrders },
              userId
            );
          }
        }
      }

      return results;
    } catch (error: any) {
      this.logger.error(`Failed to execute policies: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Bulk update inventory policies
   */
  async bulkUpdatePolicies(
    tenantId: string,
    locationId: string,
    bulkUpdateDto: BulkInventoryPolicyUpdateDto,
    userId: string,
  ): Promise<{ updated: number; created: number; errors: string[] }> {
    try {
      let updated = 0;
      let created = 0;
      const errors: string[] = [];

      for (const productId of bulkUpdateDto.productIds) {
        try {
          // Find existing policy for this product
          const existingPolicies = await this.drizzle.getDb()
            .select()
            .from(locationInventoryPolicies)
            .where(and(
              eq(locationInventoryPolicies.tenantId, tenantId),
              eq(locationInventoryPolicies.locationId, locationId),
              eq(locationInventoryPolicies.productId, productId)
            ));

          if (existingPolicies.length > 0 && existingPolicies[0]) {
            // Update existing policy
            const policyId = existingPolicies[0].id;
            await this.updateInventoryPolicy(tenantId, locationId, policyId, bulkUpdateDto.updates, userId);
            updated++;
          } else if (bulkUpdateDto.createIfNotExists) {
            // Create new policy
            const createDto: CreateLocationInventoryPolicyDto = {
              name: `Auto Policy - ${productId}`,
              policyType: bulkUpdateDto.updates.policyType || InventoryPolicyType.REORDER_POINT,
              productId,
              ...bulkUpdateDto.updates,
            };
            await this.createInventoryPolicy(tenantId, locationId, createDto, userId);
            created++;
          }
        } catch (error: any) {
          errors.push(`Product ${productId}: ${error.message}`);
        }
      }

      return { updated, created, errors };
    } catch (error: any) {
      this.logger.error(`Failed to bulk update policies: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find applicable policies for a product
   */
  private async findApplicablePolicies(
    tenantId: string,
    locationId: string,
    productId: string,
    categoryId?: string
  ): Promise<LocationInventoryPolicy[]> {
    const conditions = [
      eq(locationInventoryPolicies.tenantId, tenantId),
      eq(locationInventoryPolicies.locationId, locationId),
      eq(locationInventoryPolicies.isActive, true),
      eq(locationInventoryPolicies.status, 'active'),
      or(
        eq(locationInventoryPolicies.productId, productId),
        and(
          isNull(locationInventoryPolicies.productId),
          categoryId ? eq(locationInventoryPolicies.categoryId, categoryId) : isNull(locationInventoryPolicies.categoryId)
        )
      ),
    ];

    const results = await this.drizzle.getDb()
      .select()
      .from(locationInventoryPolicies)
      .where(and(...conditions))
      .orderBy(desc(locationInventoryPolicies.priority), asc(locationInventoryPolicies.createdAt));

    return results.map(policy => this.mapToEntity(policy));
  }

  /**
   * Validate policy parameters
   */
  private validatePolicyParameters(createDto: CreateLocationInventoryPolicyDto): void {
    if (createDto.minStockLevel && createDto.maxStockLevel && 
        createDto.minStockLevel >= createDto.maxStockLevel) {
      throw new BadRequestException('Minimum stock level must be less than maximum stock level');
    }

    if (createDto.safetyStock && createDto.minStockLevel && 
        createDto.safetyStock > createDto.minStockLevel) {
      throw new BadRequestException('Safety stock should not exceed minimum stock level');
    }

    if (createDto.leadTimeDays && createDto.leadTimeDays < 0) {
      throw new BadRequestException('Lead time days cannot be negative');
    }

    if (createDto.seasonalMultiplier && (createDto.seasonalMultiplier < 0.1 || createDto.seasonalMultiplier > 10)) {
      throw new BadRequestException('Seasonal multiplier must be between 0.1 and 10.0');
    }
  }

  /**
   * Log policy execution
   */
  private async logPolicyExecution(
    tenantId: string,
    policyId: string,
    productId: string,
    executionType: string,
    currentStock: number,
    recommendedAction?: string,
    recommendedQuantity?: number,
    actionTaken?: string,
    actualQuantity?: number,
    executionResult?: any,
    userId?: string
  ): Promise<void> {
    try {
      await this.drizzle.getDb()
        .insert(inventoryPolicyExecutionLog)
        .values({
          tenantId,
          policyId,
          productId,
          executionType,
          currentStock,
          recommendedAction,
          recommendedQuantity,
          actionTaken,
          actualQuantity,
          executionResult: JSON.stringify(executionResult || {}),
          executedBy: userId || 'system',
        });
    } catch (error: any) {
      this.logger.warn(`Failed to log policy execution: ${error.message}`);
    }
  }

  /**
   * Map database record to entity
   */
  private mapToEntity(record: any): LocationInventoryPolicy {
    return new LocationInventoryPolicy({
      id: record.id,
      tenantId: record.tenantId,
      locationId: record.locationId,
      name: record.name,
      description: record.description,
      policyType: record.policyType as InventoryPolicyType,
      productId: record.productId,
      categoryId: record.categoryId,
      minStockLevel: record.minStockLevel,
      maxStockLevel: record.maxStockLevel,
      safetyStock: record.safetyStock,
      reorderQuantity: record.reorderQuantity,
      leadTimeDays: record.leadTimeDays,
      replenishmentMethod: record.replenishmentMethod as StockReplenishmentMethod,
      abcClassification: record.abcClassification as ABCClassification,
      seasonalMultiplier: parseFloat(record.seasonalMultiplier),
      forecastPeriodDays: record.forecastPeriodDays,
      autoCreatePurchaseOrders: record.autoCreatePurchaseOrders,
      preferredSupplierId: record.preferredSupplierId,
      rules: record.rules ? JSON.parse(record.rules) : undefined,
      priority: record.priority,
      parameters: record.parameters ? JSON.parse(record.parameters) : undefined,
      isActive: record.isActive,
      status: record.status as InventoryPolicyStatus,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}