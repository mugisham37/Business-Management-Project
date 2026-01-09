import { Injectable, Inject } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { 
  inventoryLevels,
  inventoryReservations,
  products,
  productVariants
} from '../../database/schema';
import { eq, and, lt, lte, gte, desc, asc, sql, count, isNull, or } from 'drizzle-orm';
import { CreateInventoryLevelDto, UpdateInventoryLevelDto, InventoryQueryDto } from '../dto/inventory.dto';

export interface InventoryLevelWithProduct {
  id: string;
  tenantId: string;
  productId: string;
  variantId?: string;
  locationId: string;
  currentLevel: number;
  availableLevel: number;
  reservedLevel: number;
  minStockLevel: number;
  maxStockLevel?: number;
  reorderPoint: number;
  reorderQuantity: number;
  valuationMethod: string;
  averageCost: number;
  totalValue: number;
  binLocation?: string;
  zone?: string;
  lastMovementAt?: Date;
  lastCountAt?: Date;
  lowStockAlertSent: boolean;
  lastAlertSentAt?: Date;
  attributes?: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version: number;
  product?: any;
  variant?: any;
}

@Injectable()
export class InventoryRepository {
  constructor(
    @Inject('DRIZZLE_SERVICE') private readonly drizzle: DrizzleService,
  ) {}

  async create(tenantId: string, data: CreateInventoryLevelDto, userId: string): Promise<InventoryLevelWithProduct> {
    const db = this.drizzle.getDb();
    
    const [inventoryLevel] = await db
      .insert(inventoryLevels)
      .values({
        tenantId,
        productId: data.productId,
        variantId: data.variantId,
        locationId: data.locationId,
        currentLevel: data.currentLevel?.toString() || '0',
        availableLevel: data.currentLevel?.toString() || '0',
        reservedLevel: '0',
        minStockLevel: data.minStockLevel?.toString() || '0',
        maxStockLevel: data.maxStockLevel?.toString(),
        reorderPoint: data.reorderPoint?.toString() || '0',
        reorderQuantity: data.reorderQuantity?.toString() || '0',
        valuationMethod: data.valuationMethod || 'fifo',
        averageCost: data.averageCost?.toString() || '0',
        totalValue: '0',
        binLocation: data.binLocation,
        zone: data.zone,
        attributes: data.attributes || {},
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return this.findById(tenantId, inventoryLevel.id);
  }

  async findById(tenantId: string, id: string): Promise<InventoryLevelWithProduct | null> {
    const db = this.drizzle.getDb();
    
    const result = await db
      .select({
        inventory: inventoryLevels,
        product: products,
        variant: productVariants,
      })
      .from(inventoryLevels)
      .leftJoin(products, eq(inventoryLevels.productId, products.id))
      .leftJoin(productVariants, eq(inventoryLevels.variantId, productVariants.id))
      .where(and(
        eq(inventoryLevels.tenantId, tenantId),
        eq(inventoryLevels.id, id),
        eq(inventoryLevels.isActive, true)
      ))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const { inventory, product, variant } = result[0];
    
    return {
      ...inventory,
      currentLevel: parseFloat(inventory.currentLevel),
      availableLevel: parseFloat(inventory.availableLevel),
      reservedLevel: parseFloat(inventory.reservedLevel),
      minStockLevel: parseFloat(inventory.minStockLevel),
      maxStockLevel: inventory.maxStockLevel ? parseFloat(inventory.maxStockLevel) : undefined,
      reorderPoint: parseFloat(inventory.reorderPoint),
      reorderQuantity: parseFloat(inventory.reorderQuantity),
      averageCost: parseFloat(inventory.averageCost),
      totalValue: parseFloat(inventory.totalValue),
      product,
      variant,
    };
  }

  async findByProductAndLocation(
    tenantId: string,
    productId: string,
    variantId: string | null,
    locationId: string,
  ): Promise<InventoryLevelWithProduct | null> {
    const db = this.drizzle.getDb();
    
    const conditions = [
      eq(inventoryLevels.tenantId, tenantId),
      eq(inventoryLevels.productId, productId),
      eq(inventoryLevels.locationId, locationId),
      eq(inventoryLevels.isActive, true),
    ];

    if (variantId) {
      conditions.push(eq(inventoryLevels.variantId, variantId));
    } else {
      conditions.push(isNull(inventoryLevels.variantId));
    }

    const result = await db
      .select({
        inventory: inventoryLevels,
        product: products,
        variant: productVariants,
      })
      .from(inventoryLevels)
      .leftJoin(products, eq(inventoryLevels.productId, products.id))
      .leftJoin(productVariants, eq(inventoryLevels.variantId, productVariants.id))
      .where(and(...conditions))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const { inventory, product, variant } = result[0];
    
    return {
      ...inventory,
      currentLevel: parseFloat(inventory.currentLevel),
      availableLevel: parseFloat(inventory.availableLevel),
      reservedLevel: parseFloat(inventory.reservedLevel),
      minStockLevel: parseFloat(inventory.minStockLevel),
      maxStockLevel: inventory.maxStockLevel ? parseFloat(inventory.maxStockLevel) : undefined,
      reorderPoint: parseFloat(inventory.reorderPoint),
      reorderQuantity: parseFloat(inventory.reorderQuantity),
      averageCost: parseFloat(inventory.averageCost),
      totalValue: parseFloat(inventory.totalValue),
      product,
      variant,
    };
  }

  async findMany(tenantId: string, query: InventoryQueryDto): Promise<{
    inventoryLevels: InventoryLevelWithProduct[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const db = this.drizzle.getDb();
    
    // Build where conditions
    const conditions = [
      eq(inventoryLevels.tenantId, tenantId),
      eq(inventoryLevels.isActive, true),
    ];

    if (query.productId) {
      conditions.push(eq(inventoryLevels.productId, query.productId));
    }

    if (query.locationId) {
      conditions.push(eq(inventoryLevels.locationId, query.locationId));
    }

    if (query.lowStock) {
      conditions.push(lte(inventoryLevels.currentLevel, inventoryLevels.reorderPoint));
    }

    if (query.outOfStock) {
      conditions.push(eq(inventoryLevels.currentLevel, '0'));
    }

    if (query.zone) {
      conditions.push(eq(inventoryLevels.zone, query.zone));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(inventoryLevels)
      .where(whereClause);

    // Build order by clause
    let orderBy;
    const sortField = query.sortBy || 'currentLevel';
    const sortDirection = query.sortOrder || 'desc';

    switch (sortField) {
      case 'currentLevel':
        orderBy = sortDirection === 'asc' ? 
          sql`${inventoryLevels.currentLevel}::numeric ASC` : 
          sql`${inventoryLevels.currentLevel}::numeric DESC`;
        break;
      case 'reorderPoint':
        orderBy = sortDirection === 'asc' ? 
          sql`${inventoryLevels.reorderPoint}::numeric ASC` : 
          sql`${inventoryLevels.reorderPoint}::numeric DESC`;
        break;
      case 'lastMovementAt':
        orderBy = sortDirection === 'asc' ? asc(inventoryLevels.lastMovementAt) : desc(inventoryLevels.lastMovementAt);
        break;
      default:
        orderBy = sortDirection === 'asc' ? asc(inventoryLevels.createdAt) : desc(inventoryLevels.createdAt);
        break;
    }

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    // Get inventory levels with product info
    const result = await db
      .select({
        inventory: inventoryLevels,
        product: products,
        variant: productVariants,
      })
      .from(inventoryLevels)
      .leftJoin(products, eq(inventoryLevels.productId, products.id))
      .leftJoin(productVariants, eq(inventoryLevels.variantId, productVariants.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const inventoryLevelsWithProducts = result.map(({ inventory, product, variant }) => ({
      ...inventory,
      currentLevel: parseFloat(inventory.currentLevel),
      availableLevel: parseFloat(inventory.availableLevel),
      reservedLevel: parseFloat(inventory.reservedLevel),
      minStockLevel: parseFloat(inventory.minStockLevel),
      maxStockLevel: inventory.maxStockLevel ? parseFloat(inventory.maxStockLevel) : undefined,
      reorderPoint: parseFloat(inventory.reorderPoint),
      reorderQuantity: parseFloat(inventory.reorderQuantity),
      averageCost: parseFloat(inventory.averageCost),
      totalValue: parseFloat(inventory.totalValue),
      product,
      variant,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return {
      inventoryLevels: inventoryLevelsWithProducts,
      total: totalCount,
      page,
      limit,
      totalPages,
    };
  }

  async updateLevel(
    tenantId: string,
    productId: string,
    variantId: string | null,
    locationId: string,
    newLevel: number,
    userId: string,
  ): Promise<InventoryLevelWithProduct> {
    const db = this.drizzle.getDb();
    
    const conditions = [
      eq(inventoryLevels.tenantId, tenantId),
      eq(inventoryLevels.productId, productId),
      eq(inventoryLevels.locationId, locationId),
      eq(inventoryLevels.isActive, true),
    ];

    if (variantId) {
      conditions.push(eq(inventoryLevels.variantId, variantId));
    } else {
      conditions.push(isNull(inventoryLevels.variantId));
    }

    const [updated] = await db
      .update(inventoryLevels)
      .set({
        currentLevel: newLevel.toString(),
        availableLevel: sql`${newLevel.toString()}::numeric - ${inventoryLevels.reservedLevel}::numeric`,
        lastMovementAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
        version: sql`${inventoryLevels.version} + 1`,
      })
      .where(and(...conditions))
      .returning();

    return this.findById(tenantId, updated.id);
  }

  async updateReservedLevel(
    tenantId: string,
    productId: string,
    variantId: string | null,
    locationId: string,
    reservedLevel: number,
  ): Promise<void> {
    const db = this.drizzle.getDb();
    
    const conditions = [
      eq(inventoryLevels.tenantId, tenantId),
      eq(inventoryLevels.productId, productId),
      eq(inventoryLevels.locationId, locationId),
      eq(inventoryLevels.isActive, true),
    ];

    if (variantId) {
      conditions.push(eq(inventoryLevels.variantId, variantId));
    } else {
      conditions.push(isNull(inventoryLevels.variantId));
    }

    await db
      .update(inventoryLevels)
      .set({
        reservedLevel: reservedLevel.toString(),
        availableLevel: sql`${inventoryLevels.currentLevel}::numeric - ${reservedLevel.toString()}::numeric`,
        updatedAt: new Date(),
        version: sql`${inventoryLevels.version} + 1`,
      })
      .where(and(...conditions));
  }

  async performTransfer(
    tenantId: string,
    productId: string,
    variantId: string | null,
    fromLocationId: string,
    toLocationId: string,
    quantity: number,
    userId: string,
    notes?: string,
  ): Promise<void> {
    const db = this.drizzle.getDb();
    
    await db.transaction(async (tx) => {
      // Decrease source location
      const sourceConditions = [
        eq(inventoryLevels.tenantId, tenantId),
        eq(inventoryLevels.productId, productId),
        eq(inventoryLevels.locationId, fromLocationId),
        eq(inventoryLevels.isActive, true),
      ];

      if (variantId) {
        sourceConditions.push(eq(inventoryLevels.variantId, variantId));
      } else {
        sourceConditions.push(isNull(inventoryLevels.variantId));
      }

      await tx
        .update(inventoryLevels)
        .set({
          currentLevel: sql`${inventoryLevels.currentLevel}::numeric - ${quantity}`,
          availableLevel: sql`${inventoryLevels.availableLevel}::numeric - ${quantity}`,
          lastMovementAt: new Date(),
          updatedBy: userId,
          updatedAt: new Date(),
          version: sql`${inventoryLevels.version} + 1`,
        })
        .where(and(...sourceConditions));

      // Increase destination location
      const destConditions = [
        eq(inventoryLevels.tenantId, tenantId),
        eq(inventoryLevels.productId, productId),
        eq(inventoryLevels.locationId, toLocationId),
        eq(inventoryLevels.isActive, true),
      ];

      if (variantId) {
        destConditions.push(eq(inventoryLevels.variantId, variantId));
      } else {
        destConditions.push(isNull(inventoryLevels.variantId));
      }

      await tx
        .update(inventoryLevels)
        .set({
          currentLevel: sql`${inventoryLevels.currentLevel}::numeric + ${quantity}`,
          availableLevel: sql`${inventoryLevels.availableLevel}::numeric + ${quantity}`,
          lastMovementAt: new Date(),
          updatedBy: userId,
          updatedAt: new Date(),
          version: sql`${inventoryLevels.version} + 1`,
        })
        .where(and(...destConditions));
    });
  }

  async findLowStockProducts(tenantId: string, locationId?: string): Promise<InventoryLevelWithProduct[]> {
    const db = this.drizzle.getDb();
    
    const conditions = [
      eq(inventoryLevels.tenantId, tenantId),
      eq(inventoryLevels.isActive, true),
      sql`${inventoryLevels.currentLevel}::numeric <= ${inventoryLevels.reorderPoint}::numeric`,
      sql`${inventoryLevels.currentLevel}::numeric > 0`, // Exclude out of stock
    ];

    if (locationId) {
      conditions.push(eq(inventoryLevels.locationId, locationId));
    }

    const result = await db
      .select({
        inventory: inventoryLevels,
        product: products,
        variant: productVariants,
      })
      .from(inventoryLevels)
      .leftJoin(products, eq(inventoryLevels.productId, products.id))
      .leftJoin(productVariants, eq(inventoryLevels.variantId, productVariants.id))
      .where(and(...conditions))
      .orderBy(sql`${inventoryLevels.currentLevel}::numeric ASC`);

    return result.map(({ inventory, product, variant }) => ({
      ...inventory,
      currentLevel: parseFloat(inventory.currentLevel),
      availableLevel: parseFloat(inventory.availableLevel),
      reservedLevel: parseFloat(inventory.reservedLevel),
      minStockLevel: parseFloat(inventory.minStockLevel),
      maxStockLevel: inventory.maxStockLevel ? parseFloat(inventory.maxStockLevel) : undefined,
      reorderPoint: parseFloat(inventory.reorderPoint),
      reorderQuantity: parseFloat(inventory.reorderQuantity),
      averageCost: parseFloat(inventory.averageCost),
      totalValue: parseFloat(inventory.totalValue),
      product,
      variant,
    }));
  }

  async createReservation(
    tenantId: string,
    productId: string,
    variantId: string | null,
    locationId: string,
    quantity: number,
    reservedFor: string,
    referenceId: string,
    userId: string,
  ): Promise<any> {
    const db = this.drizzle.getDb();
    
    const [reservation] = await db
      .insert(inventoryReservations)
      .values({
        tenantId,
        productId,
        variantId,
        locationId,
        quantity: quantity.toString(),
        reservedFor,
        referenceId,
        status: 'active',
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return reservation;
  }

  async findReservation(tenantId: string, reservationId: string): Promise<any> {
    const db = this.drizzle.getDb();
    
    const [reservation] = await db
      .select()
      .from(inventoryReservations)
      .where(and(
        eq(inventoryReservations.tenantId, tenantId),
        eq(inventoryReservations.id, reservationId),
        eq(inventoryReservations.isActive, true)
      ));

    return reservation;
  }

  async updateReservationStatus(
    tenantId: string,
    reservationId: string,
    status: string,
    userId: string,
  ): Promise<void> {
    const db = this.drizzle.getDb();
    
    await db
      .update(inventoryReservations)
      .set({
        status,
        updatedBy: userId,
        updatedAt: new Date(),
        version: sql`${inventoryReservations.version} + 1`,
      })
      .where(and(
        eq(inventoryReservations.tenantId, tenantId),
        eq(inventoryReservations.id, reservationId),
        eq(inventoryReservations.isActive, true)
      ));
  }
}