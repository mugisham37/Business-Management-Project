import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../../database/drizzle.service';
import { LocationPromotion, PromotionType, PromotionStatus, PromotionTargetType } from '../entities/location-promotion.entity';
import { 
  CreateLocationPromotionDto, 
  UpdateLocationPromotionDto, 
  LocationPromotionQueryDto,
  ApplyPromotionDto,
  PromotionApplicationResultDto
} from '../dto/location-promotion.dto';
import { locationPromotions, promotionUsage } from '../../database/schema/location-features.schema';
import { eq, and, desc, asc, count, or, gte, lte, isNull, sql } from 'drizzle-orm';

@Injectable()
export class LocationPromotionService {
  private readonly logger = new Logger(LocationPromotionService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new promotion for a location
   */
  async createPromotion(
    tenantId: string,
    locationId: string,
    createDto: CreateLocationPromotionDto,
    userId: string,
  ): Promise<LocationPromotion> {
    try {
      // Validate promotion dates
      const startDate = new Date(createDto.startDate);
      const endDate = new Date(createDto.endDate);
      
      if (startDate >= endDate) {
        throw new BadRequestException('Start date must be before end date');
      }

      // Validate promotion code uniqueness if provided
      if (createDto.promotionCode) {
        await this.validatePromotionCodeUniqueness(tenantId, locationId, createDto.promotionCode);
      }

      const promotionData = {
        tenantId,
        locationId,
        name: createDto.name,
        description: createDto.description,
        promotionType: createDto.promotionType,
        targetType: createDto.targetType,
        targetProductIds: createDto.targetProductIds ? JSON.stringify(createDto.targetProductIds) : null,
        targetCategoryIds: createDto.targetCategoryIds ? JSON.stringify(createDto.targetCategoryIds) : null,
        targetCustomerSegments: createDto.targetCustomerSegments ? JSON.stringify(createDto.targetCustomerSegments) : null,
        startDate,
        endDate,
        discountPercentage: createDto.discountPercentage?.toString(),
        discountAmount: createDto.discountAmount?.toString(),
        minPurchaseAmount: createDto.minPurchaseAmount?.toString(),
        maxDiscountAmount: createDto.maxDiscountAmount?.toString(),
        maxUsesPerCustomer: createDto.maxUsesPerCustomer,
        maxTotalUses: createDto.maxTotalUses,
        currentUses: 0,
        priority: createDto.priority || 0,
        isCombinable: createDto.isCombinable ?? false,
        conditions: createDto.conditions ? JSON.stringify(createDto.conditions) : null,
        actions: createDto.actions ? JSON.stringify(createDto.actions) : null,
        promotionCode: createDto.promotionCode,
        isActive: createDto.isActive ?? true,
        status: 'draft' as const,
        createdBy: userId,
        updatedBy: userId,
      };

      const [newPromotion] = await this.drizzle.getDb()
        .insert(locationPromotions)
        .values(promotionData)
        .returning();

      const promotion = this.mapToEntity(newPromotion);

      // Emit event for sync
      this.eventEmitter.emit('location.promotion.created', {
        tenantId,
        locationId,
        promotionId: promotion.id,
        promotion,
        userId,
      });

      this.logger.log(`Created promotion: ${promotion.name} for location: ${locationId}`);
      return promotion;
    } catch (error: any) {
      this.logger.error(`Failed to create promotion: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update an existing promotion
   */
  async updatePromotion(
    tenantId: string,
    locationId: string,
    promotionId: string,
    updateDto: UpdateLocationPromotionDto,
    userId: string,
  ): Promise<LocationPromotion> {
    try {
      const existingPromotion = await this.findById(tenantId, locationId, promotionId);
      if (!existingPromotion) {
        throw new NotFoundException(`Promotion with ID ${promotionId} not found`);
      }

      // Validate promotion code uniqueness if being changed
      if (updateDto.promotionCode && updateDto.promotionCode !== existingPromotion.promotionCode) {
        await this.validatePromotionCodeUniqueness(tenantId, locationId, updateDto.promotionCode, promotionId);
      }

      const updateData: any = {
        updatedBy: userId,
        updatedAt: new Date(),
      };

      if (updateDto.name !== undefined) updateData.name = updateDto.name;
      if (updateDto.description !== undefined) updateData.description = updateDto.description;
      if (updateDto.promotionType !== undefined) updateData.promotionType = updateDto.promotionType;
      if (updateDto.targetType !== undefined) updateData.targetType = updateDto.targetType;
      if (updateDto.targetProductIds !== undefined) updateData.targetProductIds = updateDto.targetProductIds ? JSON.stringify(updateDto.targetProductIds) : null;
      if (updateDto.targetCategoryIds !== undefined) updateData.targetCategoryIds = updateDto.targetCategoryIds ? JSON.stringify(updateDto.targetCategoryIds) : null;
      if (updateDto.targetCustomerSegments !== undefined) updateData.targetCustomerSegments = updateDto.targetCustomerSegments ? JSON.stringify(updateDto.targetCustomerSegments) : null;
      if (updateDto.startDate !== undefined) updateData.startDate = new Date(updateDto.startDate);
      if (updateDto.endDate !== undefined) updateData.endDate = new Date(updateDto.endDate);
      if (updateDto.discountPercentage !== undefined) updateData.discountPercentage = updateDto.discountPercentage !== null ? updateDto.discountPercentage.toString() : null;
      if (updateDto.discountAmount !== undefined) updateData.discountAmount = updateDto.discountAmount !== null ? updateDto.discountAmount.toString() : null;
      if (updateDto.minPurchaseAmount !== undefined) updateData.minPurchaseAmount = updateDto.minPurchaseAmount !== null ? updateDto.minPurchaseAmount.toString() : null;
      if (updateDto.maxDiscountAmount !== undefined) updateData.maxDiscountAmount = updateDto.maxDiscountAmount?.toString();
      if (updateDto.maxUsesPerCustomer !== undefined) updateData.maxUsesPerCustomer = updateDto.maxUsesPerCustomer;
      if (updateDto.maxTotalUses !== undefined) updateData.maxTotalUses = updateDto.maxTotalUses;
      if (updateDto.priority !== undefined) updateData.priority = updateDto.priority;
      if (updateDto.isCombinable !== undefined) updateData.isCombinable = updateDto.isCombinable;
      if (updateDto.conditions !== undefined) updateData.conditions = updateDto.conditions ? JSON.stringify(updateDto.conditions) : null;
      if (updateDto.actions !== undefined) updateData.actions = updateDto.actions ? JSON.stringify(updateDto.actions) : null;
      if (updateDto.promotionCode !== undefined) updateData.promotionCode = updateDto.promotionCode;
      if (updateDto.isActive !== undefined) updateData.isActive = updateDto.isActive;
      if (updateDto.status !== undefined) updateData.status = updateDto.status;

      const [updatedPromotion] = await this.drizzle.getDb()
        .update(locationPromotions)
        .set(updateData)
        .where(and(
          eq(locationPromotions.id, promotionId),
          eq(locationPromotions.tenantId, tenantId),
          eq(locationPromotions.locationId, locationId)
        ))
        .returning();

      const promotion = this.mapToEntity(updatedPromotion);

      // Emit event for sync
      this.eventEmitter.emit('location.promotion.updated', {
        tenantId,
        locationId,
        promotionId,
        promotion,
        userId,
      });

      this.logger.log(`Updated promotion: ${promotionId} for location: ${locationId}`);
      return promotion;
    } catch (error: any) {
      this.logger.error(`Failed to update promotion: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a promotion
   */
  async deletePromotion(
    tenantId: string,
    locationId: string,
    promotionId: string,
    userId: string,
  ): Promise<void> {
    try {
      const existingPromotion = await this.findById(tenantId, locationId, promotionId);
      if (!existingPromotion) {
        throw new NotFoundException(`Promotion with ID ${promotionId} not found`);
      }

      await this.drizzle.getDb()
        .delete(locationPromotions)
        .where(and(
          eq(locationPromotions.id, promotionId),
          eq(locationPromotions.tenantId, tenantId),
          eq(locationPromotions.locationId, locationId)
        ));

      // Emit event for sync
      this.eventEmitter.emit('location.promotion.deleted', {
        tenantId,
        locationId,
        promotionId,
        userId,
      });

      this.logger.log(`Deleted promotion: ${promotionId} for location: ${locationId}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete promotion: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find promotion by ID
   */
  async findById(tenantId: string, locationId: string, promotionId: string): Promise<LocationPromotion | null> {
    try {
      const [promotion] = await this.drizzle.getDb()
        .select()
        .from(locationPromotions)
        .where(and(
          eq(locationPromotions.id, promotionId),
          eq(locationPromotions.tenantId, tenantId),
          eq(locationPromotions.locationId, locationId)
        ));

      return promotion ? this.mapToEntity(promotion) : null;
    } catch (error: any) {
      this.logger.error(`Failed to find promotion by ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find promotion by code
   */
  async findByCode(tenantId: string, locationId: string, promotionCode: string): Promise<LocationPromotion | null> {
    try {
      const [promotion] = await this.drizzle.getDb()
        .select()
        .from(locationPromotions)
        .where(and(
          eq(locationPromotions.promotionCode, promotionCode),
          eq(locationPromotions.tenantId, tenantId),
          eq(locationPromotions.locationId, locationId)
        ));

      return promotion ? this.mapToEntity(promotion) : null;
    } catch (error: any) {
      this.logger.error(`Failed to find promotion by code: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find promotions with filtering and pagination
   */
  async findPromotions(
    tenantId: string,
    locationId: string,
    query: LocationPromotionQueryDto,
  ): Promise<{ promotions: LocationPromotion[]; total: number }> {
    try {
      const conditions = [
        eq(locationPromotions.tenantId, tenantId),
        eq(locationPromotions.locationId, locationId),
      ];

      if (query.promotionType) {
        conditions.push(eq(locationPromotions.promotionType, query.promotionType));
      }

      if (query.status) {
        conditions.push(eq(locationPromotions.status, query.status));
      }

      if (query.activeOnly) {
        conditions.push(eq(locationPromotions.isActive, true));
        const now = new Date();
        conditions.push(lte(locationPromotions.startDate, now));
        conditions.push(gte(locationPromotions.endDate, now));
      }

      // Count total
      const countResult = await this.drizzle.getDb()
        .select({ count: count() })
        .from(locationPromotions)
        .where(and(...conditions));
      
      const total = countResult[0]?.count || 0;

      // Get paginated results
      const page = query.page || 1;
      const limit = query.limit || 20;
      const offset = (page - 1) * limit;

      const results = await this.drizzle.getDb()
        .select()
        .from(locationPromotions)
        .where(and(...conditions))
        .orderBy(desc(locationPromotions.priority), desc(locationPromotions.createdAt))
        .limit(limit)
        .offset(offset);

      const promotions = results.map(promotion => this.mapToEntity(promotion));

      return { promotions, total };
    } catch (error: any) {
      this.logger.error(`Failed to find promotions: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Apply promotion to cart items
   */
  async applyPromotion(
    tenantId: string,
    locationId: string,
    applyDto: ApplyPromotionDto,
  ): Promise<PromotionApplicationResultDto> {
    try {
      // Find promotion by ID or code
      let promotion: LocationPromotion | null = null;
      
      // Try to find by ID first, then by code
      if (applyDto.promotionIdOrCode.length === 36) { // UUID length
        promotion = await this.findById(tenantId, locationId, applyDto.promotionIdOrCode);
      }
      
      if (!promotion) {
        promotion = await this.findByCode(tenantId, locationId, applyDto.promotionIdOrCode);
      }

      if (!promotion) {
        return {
          applied: false,
          promotion: { id: '', name: '', type: PromotionType.PERCENTAGE_DISCOUNT },
          originalAmount: 0,
          finalAmount: 0,
          discountAmount: 0,
          discountPercentage: 0,
          details: [],
          errorMessage: 'Promotion not found',
          reason: 'invalid_code',
        };
      }

      // Check if promotion is valid
      const validationResult = this.validatePromotionApplication(promotion, applyDto);
      if (!validationResult.valid) {
        return {
          applied: false,
          promotion: {
            id: promotion.id,
            name: promotion.name,
            type: promotion.promotionType,
          },
          originalAmount: 0,
          finalAmount: 0,
          discountAmount: 0,
          discountPercentage: 0,
          details: [],
          errorMessage: validationResult.reason || 'Promotion validation failed',
          reason: validationResult.code || 'VALIDATION_FAILED',
        };
      }

      // Calculate original total
      const originalAmount = applyDto.cartItems.reduce((total, item) => 
        total + (item.unitPrice * item.quantity), 0
      );

      // Apply promotion to applicable items
      let totalDiscount = 0;
      const details: any[] = [];

      for (const item of applyDto.cartItems) {
        if (promotion.appliesToProduct(item.productId)) {
          const itemTotal = item.unitPrice * item.quantity;
          const discount = promotion.calculateDiscount(item.unitPrice, item.quantity, originalAmount);
          
          details.push({
            itemId: item.productId,
            originalPrice: item.unitPrice,
            discountedPrice: item.unitPrice - (discount / item.quantity),
            discountAmount: discount,
          });

          totalDiscount += discount;
        } else {
          details.push({
            itemId: item.productId,
            originalPrice: item.unitPrice,
            discountedPrice: item.unitPrice,
            discountAmount: 0,
          });
        }
      }

      const finalAmount = originalAmount - totalDiscount;
      const discountPercentage = originalAmount > 0 ? (totalDiscount / originalAmount) * 100 : 0;

      // Log promotion usage
      if (totalDiscount > 0) {
        await this.logPromotionUsage(
          tenantId,
          promotion.id,
          applyDto.customerId,
          applyDto.context?.orderId,
          totalDiscount,
          originalAmount,
          finalAmount,
          details,
          applyDto.context?.userId
        );

        // Update promotion usage count
        await this.incrementPromotionUsage(tenantId, locationId, promotion.id);
      }

      return {
        applied: totalDiscount > 0,
        promotion: {
          id: promotion.id,
          name: promotion.name,
          type: promotion.promotionType,
        },
        originalAmount,
        finalAmount,
        discountAmount: totalDiscount,
        discountPercentage,
        details,
      };
    } catch (error: any) {
      this.logger.error(`Failed to apply promotion: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get applicable promotions for a product or customer
   */
  async getApplicablePromotions(
    tenantId: string,
    locationId: string,
    productId?: string,
    customerId?: string,
  ): Promise<LocationPromotion[]> {
    try {
      const now = new Date();
      const conditions = [
        eq(locationPromotions.tenantId, tenantId),
        eq(locationPromotions.locationId, locationId),
        eq(locationPromotions.isActive, true),
        eq(locationPromotions.status, 'active'),
        lte(locationPromotions.startDate, now),
        gte(locationPromotions.endDate, now),
      ];

      const results = await this.drizzle.getDb()
        .select()
        .from(locationPromotions)
        .where(and(...conditions))
        .orderBy(desc(locationPromotions.priority));

      const promotions = results.map(promotion => this.mapToEntity(promotion));

      // Filter by product if specified
      if (productId) {
        return promotions.filter(promotion => promotion.appliesToProduct(productId));
      }

      return promotions;
    } catch (error: any) {
      this.logger.error(`Failed to get applicable promotions: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Validate promotion code uniqueness
   */
  private async validatePromotionCodeUniqueness(
    tenantId: string,
    locationId: string,
    promotionCode: string,
    excludePromotionId?: string
  ): Promise<void> {
    const conditions = [
      eq(locationPromotions.tenantId, tenantId),
      eq(locationPromotions.locationId, locationId),
      eq(locationPromotions.promotionCode, promotionCode),
    ];

    if (excludePromotionId) {
      conditions.push(sql`${locationPromotions.id} != ${excludePromotionId}`);
    }

    const [existingPromotion] = await this.drizzle.getDb()
      .select()
      .from(locationPromotions)
      .where(and(...conditions));

    if (existingPromotion) {
      throw new BadRequestException(`Promotion code '${promotionCode}' already exists`);
    }
  }

  /**
   * Validate promotion application
   */
  private validatePromotionApplication(
    promotion: LocationPromotion,
    applyDto: ApplyPromotionDto
  ): { valid: boolean; reason?: string; code?: string } {
    if (!promotion.isValidForDate()) {
      return { valid: false, reason: 'Promotion is not currently active', code: 'expired' };
    }

    if (promotion.hasReachedUsageLimit()) {
      return { valid: false, reason: 'Promotion has reached its usage limit', code: 'usage_limit_reached' };
    }

    // Check minimum purchase amount
    const totalAmount = applyDto.cartItems.reduce((total, item) => 
      total + (item.unitPrice * item.quantity), 0
    );

    if (promotion.minPurchaseAmount && totalAmount < promotion.minPurchaseAmount) {
      return { 
        valid: false, 
        reason: `Minimum purchase amount of $${promotion.minPurchaseAmount} required`, 
        code: 'min_purchase_not_met' 
      };
    }

    return { valid: true };
  }

  /**
   * Log promotion usage
   */
  private async logPromotionUsage(
    tenantId: string,
    promotionId: string,
    customerId?: string,
    orderId?: string,
    discountAmount?: number,
    originalAmount?: number,
    finalAmount?: number,
    details?: any[],
    userId?: string
  ): Promise<void> {
    try {
      await this.drizzle.getDb()
        .insert(promotionUsage)
        .values({
          tenantId,
          promotionId,
          customerId,
          orderId,
          discountAmount: discountAmount?.toString() || '0',
          originalAmount: originalAmount?.toString() || '0',
          finalAmount: finalAmount?.toString() || '0',
          usageDetails: JSON.stringify(details || []),
          createdBy: userId || 'system',
        });
    } catch (error: any) {
      this.logger.warn(`Failed to log promotion usage: ${error.message}`);
    }
  }

  /**
   * Increment promotion usage count
   */
  private async incrementPromotionUsage(
    tenantId: string,
    locationId: string,
    promotionId: string
  ): Promise<void> {
    try {
      await this.drizzle.getDb()
        .update(locationPromotions)
        .set({
          currentUses: sql`${locationPromotions.currentUses} + 1`,
          updatedAt: new Date(),
        })
        .where(and(
          eq(locationPromotions.id, promotionId),
          eq(locationPromotions.tenantId, tenantId),
          eq(locationPromotions.locationId, locationId)
        ));
    } catch (error: any) {
      this.logger.warn(`Failed to increment promotion usage: ${error.message}`);
    }
  }

  /**
   * Map database record to entity
   */
  private mapToEntity(record: any): LocationPromotion {
    const entityData: Partial<LocationPromotion> = {
      id: record.id,
      tenantId: record.tenantId,
      locationId: record.locationId,
      name: record.name,
      description: record.description,
      promotionType: record.promotionType as PromotionType,
      targetType: record.targetType as PromotionTargetType,
      targetProductIds: record.targetProductIds ? JSON.parse(record.targetProductIds) : undefined,
      targetCategoryIds: record.targetCategoryIds ? JSON.parse(record.targetCategoryIds) : undefined,
      targetCustomerSegments: record.targetCustomerSegments ? JSON.parse(record.targetCustomerSegments) : undefined,
      startDate: record.startDate,
      endDate: record.endDate,
      maxUsesPerCustomer: record.maxUsesPerCustomer,
      maxTotalUses: record.maxTotalUses,
      currentUses: record.currentUses,
      priority: record.priority,
      isCombinable: record.isCombinable,
      conditions: record.conditions ? JSON.parse(record.conditions) : undefined,
      actions: record.actions ? JSON.parse(record.actions) : undefined,
      promotionCode: record.promotionCode,
      isActive: record.isActive,
      status: record.status as PromotionStatus,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };

    // Only add numeric fields if they exist
    if (record.discountPercentage !== null && record.discountPercentage !== undefined) {
      entityData.discountPercentage = parseFloat(record.discountPercentage);
    }
    if (record.discountAmount !== null && record.discountAmount !== undefined) {
      entityData.discountAmount = parseFloat(record.discountAmount);
    }
    if (record.minPurchaseAmount !== null && record.minPurchaseAmount !== undefined) {
      entityData.minPurchaseAmount = parseFloat(record.minPurchaseAmount);
    }
    if (record.maxDiscountAmount !== null && record.maxDiscountAmount !== undefined) {
      entityData.maxDiscountAmount = parseFloat(record.maxDiscountAmount);
    }

    return new LocationPromotion(entityData);
  }
}