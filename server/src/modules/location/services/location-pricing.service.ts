import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../../database/drizzle.service';
import { LocationPricingRule, PricingRuleType, PricingRuleStatus } from '../entities/location-pricing-rule.entity';
import { 
  CreateLocationPricingRuleDto, 
  UpdateLocationPricingRuleDto, 
  LocationPricingQueryDto,
  CalculatePriceDto,
  PriceCalculationResultDto
} from '../dto/location-pricing.dto';
import { locationPricingRules, priceCalculationHistory } from '../../database/schema/location-features.schema';
import { eq, and, desc, asc, count, or, gte, lte, isNull } from 'drizzle-orm';

@Injectable()
export class LocationPricingService {
  private readonly logger = new Logger(LocationPricingService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new pricing rule for a location
   */
  async createPricingRule(
    tenantId: string,
    locationId: string,
    createDto: CreateLocationPricingRuleDto,
    userId: string,
  ): Promise<LocationPricingRule> {
    try {
      // Validate that product or category is specified
      if (!createDto.productId && !createDto.categoryId) {
        throw new BadRequestException('Either productId or categoryId must be specified');
      }

      // Check for conflicting rules
      await this.validateRuleConflicts(tenantId, locationId, createDto);

      const ruleData = {
        tenantId,
        locationId,
        name: createDto.name,
        description: createDto.description,
        ruleType: createDto.ruleType,
        productId: createDto.productId,
        categoryId: createDto.categoryId,
        value: createDto.value.toString(),
        minQuantity: createDto.minQuantity,
        maxQuantity: createDto.maxQuantity,
        startDate: createDto.startDate ? new Date(createDto.startDate) : null,
        endDate: createDto.endDate ? new Date(createDto.endDate) : null,
        priority: createDto.priority || 0,
        conditions: createDto.conditions ? JSON.stringify(createDto.conditions) : null,
        isActive: createDto.isActive ?? true,
        status: 'active' as const,
        createdBy: userId,
        updatedBy: userId,
      };

      const [newRule] = await this.drizzle.getDb()
        .insert(locationPricingRules)
        .values(ruleData)
        .returning();

      const pricingRule = this.mapToEntity(newRule);

      // Emit event for sync
      this.eventEmitter.emit('location.pricing-rule.created', {
        tenantId,
        locationId,
        pricingRuleId: pricingRule.id,
        pricingRule,
        userId,
      });

      this.logger.log(`Created pricing rule: ${pricingRule.name} for location: ${locationId}`);
      return pricingRule;
    } catch (error: any) {
      this.logger.error(`Failed to create pricing rule: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update an existing pricing rule
   */
  async updatePricingRule(
    tenantId: string,
    locationId: string,
    ruleId: string,
    updateDto: UpdateLocationPricingRuleDto,
    userId: string,
  ): Promise<LocationPricingRule> {
    try {
      const existingRule = await this.findById(tenantId, locationId, ruleId);
      if (!existingRule) {
        throw new NotFoundException(`Pricing rule with ID ${ruleId} not found`);
      }

      // Validate conflicts if product/category is being changed
      // Note: productId and categoryId are not updatable in UpdateLocationPricingRuleDto
      // They are only set during creation

      const updateData: any = {
        updatedBy: userId,
        updatedAt: new Date(),
      };

      if (updateDto.name !== undefined) updateData.name = updateDto.name;
      if (updateDto.description !== undefined) updateData.description = updateDto.description;
      if (updateDto.ruleType !== undefined) updateData.ruleType = updateDto.ruleType;
      if (updateDto.value !== undefined) updateData.value = updateDto.value.toString();
      if (updateDto.minQuantity !== undefined) updateData.minQuantity = updateDto.minQuantity;
      if (updateDto.maxQuantity !== undefined) updateData.maxQuantity = updateDto.maxQuantity;
      if (updateDto.startDate !== undefined) updateData.startDate = updateDto.startDate ? new Date(updateDto.startDate) : null;
      if (updateDto.endDate !== undefined) updateData.endDate = updateDto.endDate ? new Date(updateDto.endDate) : null;
      if (updateDto.priority !== undefined) updateData.priority = updateDto.priority;
      if (updateDto.conditions !== undefined) updateData.conditions = updateDto.conditions ? JSON.stringify(updateDto.conditions) : null;
      if (updateDto.isActive !== undefined) updateData.isActive = updateDto.isActive;
      if (updateDto.status !== undefined) updateData.status = updateDto.status;

      const [updatedRule] = await this.drizzle.getDb()
        .update(locationPricingRules)
        .set(updateData)
        .where(and(
          eq(locationPricingRules.id, ruleId),
          eq(locationPricingRules.tenantId, tenantId),
          eq(locationPricingRules.locationId, locationId)
        ))
        .returning();

      const pricingRule = this.mapToEntity(updatedRule);

      // Emit event for sync
      this.eventEmitter.emit('location.pricing-rule.updated', {
        tenantId,
        locationId,
        pricingRuleId: ruleId,
        pricingRule,
        userId,
      });

      this.logger.log(`Updated pricing rule: ${ruleId} for location: ${locationId}`);
      return pricingRule;
    } catch (error: any) {
      this.logger.error(`Failed to update pricing rule: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a pricing rule
   */
  async deletePricingRule(
    tenantId: string,
    locationId: string,
    ruleId: string,
    userId: string,
  ): Promise<void> {
    try {
      const existingRule = await this.findById(tenantId, locationId, ruleId);
      if (!existingRule) {
        throw new NotFoundException(`Pricing rule with ID ${ruleId} not found`);
      }

      await this.drizzle.getDb()
        .delete(locationPricingRules)
        .where(and(
          eq(locationPricingRules.id, ruleId),
          eq(locationPricingRules.tenantId, tenantId),
          eq(locationPricingRules.locationId, locationId)
        ));

      // Emit event for sync
      this.eventEmitter.emit('location.pricing-rule.deleted', {
        tenantId,
        locationId,
        pricingRuleId: ruleId,
        userId,
      });

      this.logger.log(`Deleted pricing rule: ${ruleId} for location: ${locationId}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete pricing rule: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find pricing rule by ID
   */
  async findById(tenantId: string, locationId: string, ruleId: string): Promise<LocationPricingRule | null> {
    try {
      const [rule] = await this.drizzle.getDb()
        .select()
        .from(locationPricingRules)
        .where(and(
          eq(locationPricingRules.id, ruleId),
          eq(locationPricingRules.tenantId, tenantId),
          eq(locationPricingRules.locationId, locationId)
        ));

      return rule ? this.mapToEntity(rule) : null;
    } catch (error: any) {
      this.logger.error(`Failed to find pricing rule by ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find pricing rules with filtering and pagination
   */
  async findPricingRules(
    tenantId: string,
    locationId: string,
    query: LocationPricingQueryDto,
  ): Promise<{ rules: LocationPricingRule[]; total: number }> {
    try {
      const conditions = [
        eq(locationPricingRules.tenantId, tenantId),
        eq(locationPricingRules.locationId, locationId),
      ];

      if (query.productId) {
        conditions.push(eq(locationPricingRules.productId, query.productId));
      }

      if (query.categoryId) {
        conditions.push(eq(locationPricingRules.categoryId, query.categoryId));
      }

      if (query.ruleType) {
        conditions.push(eq(locationPricingRules.ruleType, query.ruleType));
      }

      if (query.status) {
        conditions.push(eq(locationPricingRules.status, query.status));
      }

      if (query.activeOnly) {
        conditions.push(eq(locationPricingRules.isActive, true));
      }

      // Count total
      const countResult = await this.drizzle.getDb()
        .select({ count: count() })
        .from(locationPricingRules)
        .where(and(...conditions));
      
      const total = countResult[0]?.count || 0;

      // Get paginated results
      const page = query.page || 1;
      const limit = query.limit || 20;
      const offset = (page - 1) * limit;

      const results = await this.drizzle.getDb()
        .select()
        .from(locationPricingRules)
        .where(and(...conditions))
        .orderBy(desc(locationPricingRules.priority), desc(locationPricingRules.createdAt))
        .limit(limit)
        .offset(offset);

      const rules = results.map(rule => this.mapToEntity(rule));

      return { rules, total };
    } catch (error: any) {
      this.logger.error(`Failed to find pricing rules: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Calculate price for a product with applicable rules
   */
  async calculatePrice(
    tenantId: string,
    locationId: string,
    calculateDto: CalculatePriceDto,
    basePrice: number,
  ): Promise<PriceCalculationResultDto> {
    try {
      // Find applicable rules for the product
      const applicableRules = await this.findApplicableRules(
        tenantId,
        locationId,
        calculateDto.productId,
        calculateDto.quantity,
        calculateDto.context
      );

      let finalPrice = basePrice;
      let totalDiscountAmount = 0;
      const appliedRules: any[] = [];
      const breakdown: any[] = [];

      // Add initial step
      breakdown.push({
        step: 'base_price',
        description: 'Original base price',
        amount: basePrice,
        runningTotal: basePrice,
      });

      // Apply rules in priority order
      for (const rule of applicableRules) {
        const rulePrice = rule.calculatePrice(finalPrice, calculateDto.quantity);
        const discountAmount = finalPrice - rulePrice;

        if (discountAmount > 0) {
          appliedRules.push({
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.ruleType,
            value: rule.value,
            discountAmount,
          });

          breakdown.push({
            step: `rule_${rule.id}`,
            description: `Applied ${rule.name} (${rule.ruleType})`,
            amount: -discountAmount,
            runningTotal: rulePrice,
          });

          finalPrice = rulePrice;
          totalDiscountAmount += discountAmount;
        }
      }

      const discountPercentage = basePrice > 0 ? (totalDiscountAmount / basePrice) * 100 : 0;

      const result: PriceCalculationResultDto = {
        basePrice,
        finalPrice,
        discountAmount: totalDiscountAmount,
        discountPercentage,
        appliedRules,
        breakdown,
      };

      // Log the calculation for auditing
      await this.logPriceCalculation(
        tenantId,
        locationId,
        calculateDto,
        result,
        calculateDto.context?.userId
      );

      return result;
    } catch (error: any) {
      this.logger.error(`Failed to calculate price: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find applicable pricing rules for a product
   */
  private async findApplicableRules(
    tenantId: string,
    locationId: string,
    productId: string,
    quantity: number,
    context?: Record<string, any>
  ): Promise<LocationPricingRule[]> {
    const now = new Date();

    const conditions = [
      eq(locationPricingRules.tenantId, tenantId),
      eq(locationPricingRules.locationId, locationId),
      eq(locationPricingRules.isActive, true),
      eq(locationPricingRules.status, 'active'),
      or(
        eq(locationPricingRules.productId, productId),
        and(
          isNull(locationPricingRules.productId),
          // Would need category lookup here in real implementation
        )
      ),
    ];

    // Add date range filters
    conditions.push(
      or(
        isNull(locationPricingRules.startDate),
        lte(locationPricingRules.startDate, now)
      )
    );

    conditions.push(
      or(
        isNull(locationPricingRules.endDate),
        gte(locationPricingRules.endDate, now)
      )
    );

    const results = await this.drizzle.getDb()
      .select()
      .from(locationPricingRules)
      .where(and(...conditions))
      .orderBy(desc(locationPricingRules.priority), asc(locationPricingRules.createdAt));

    const rules = results.map(rule => this.mapToEntity(rule));

    // Filter by quantity and other conditions
    return rules.filter(rule => {
      if (!rule.isValidForQuantity(quantity)) {
        return false;
      }

      // Additional condition validation would go here
      return true;
    });
  }

  /**
   * Validate rule conflicts
   */
  private async validateRuleConflicts(
    tenantId: string,
    locationId: string,
    ruleData: any,
    excludeRuleId?: string
  ): Promise<void> {
    const conditions = [
      eq(locationPricingRules.tenantId, tenantId),
      eq(locationPricingRules.locationId, locationId),
      eq(locationPricingRules.isActive, true),
    ];

    if (ruleData.productId) {
      conditions.push(eq(locationPricingRules.productId, ruleData.productId));
    }

    if (ruleData.categoryId) {
      conditions.push(eq(locationPricingRules.categoryId, ruleData.categoryId));
    }

    if (excludeRuleId) {
      conditions.push(eq(locationPricingRules.id, excludeRuleId));
    }

    const conflictingRules = await this.drizzle.getDb()
      .select()
      .from(locationPricingRules)
      .where(and(...conditions));

    // Check for overlapping date ranges and similar conditions
    // This is a simplified check - real implementation would be more sophisticated
    if (conflictingRules.length > 0) {
      this.logger.warn(`Found ${conflictingRules.length} potentially conflicting rules`);
    }
  }

  /**
   * Log price calculation for auditing
   */
  private async logPriceCalculation(
    tenantId: string,
    locationId: string,
    calculateDto: CalculatePriceDto,
    result: PriceCalculationResultDto,
    userId?: string
  ): Promise<void> {
    try {
      await this.drizzle.getDb()
        .insert(priceCalculationHistory)
        .values({
          tenantId,
          locationId,
          productId: calculateDto.productId,
          customerId: calculateDto.customerId,
          quantity: calculateDto.quantity,
          basePrice: result.basePrice.toString(),
          finalPrice: result.finalPrice.toString(),
          discountAmount: result.discountAmount.toString(),
          appliedRules: JSON.stringify(result.appliedRules),
          calculationBreakdown: JSON.stringify(result.breakdown),
          calculatedBy: userId,
        });
    } catch (error: any) {
      this.logger.warn(`Failed to log price calculation: ${error.message}`);
    }
  }

  /**
   * Map database record to entity
   */
  private mapToEntity(record: any): LocationPricingRule {
    return new LocationPricingRule({
      id: record.id,
      tenantId: record.tenantId,
      locationId: record.locationId,
      name: record.name,
      description: record.description,
      ruleType: record.ruleType as PricingRuleType,
      productId: record.productId,
      categoryId: record.categoryId,
      value: parseFloat(record.value),
      minQuantity: record.minQuantity,
      maxQuantity: record.maxQuantity,
      startDate: record.startDate,
      endDate: record.endDate,
      priority: record.priority,
      conditions: record.conditions ? JSON.parse(record.conditions) : undefined,
      isActive: record.isActive,
      status: record.status as PricingRuleStatus,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}