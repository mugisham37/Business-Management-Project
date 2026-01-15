import { Injectable, Inject } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { 
  inventoryMovements,
  products,
  productVariants
} from '../../database/schema';
import { eq, and, desc, asc, gte, lte, sql, count } from 'drizzle-orm';

export interface CreateInventoryMovementDto {
  productId: string;
  variantId?: string;
  locationId: string;
  movementType: 'sale' | 'purchase' | 'adjustment' | 'transfer_in' | 'transfer_out' | 'return' | 'damage' | 'theft' | 'expired' | 'recount' | 'production' | 'consumption';
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  previousLevel: number;
  newLevel: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  batchNumber?: string;
  lotNumber?: string;
  expiryDate?: Date;
  reason?: 'manual_count' | 'cycle_count' | 'damaged_goods' | 'expired_goods' | 'theft_loss' | 'supplier_error' | 'system_error' | 'return_to_vendor' | 'promotional_use' | 'internal_use' | 'other';
  notes?: string;
  requiresApproval?: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  fromBinLocation?: string;
  toBinLocation?: string;
  metadata?: any;
}

export interface InventoryMovementWithProduct {
  id: string;
  tenantId: string;
  productId: string;
  variantId?: string | null;
  locationId: string;
  movementType: string;
  quantity: number;
  unitCost: number | null;
  totalCost: number | null;
  previousLevel: number;
  newLevel: number;
  referenceType?: string | null;
  referenceId?: string | null;
  referenceNumber?: string | null;
  batchNumber?: string | null;
  lotNumber?: string | null;
  expiryDate?: Date | null;
  reason?: string | null;
  notes?: string | null;
  requiresApproval: boolean | null;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  fromBinLocation?: string | null;
  toBinLocation?: string | null;
  metadata?: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
  version: number;
  product?: any;
  variant?: any;
}

@Injectable()
export class InventoryMovementRepository {
  constructor(
    @Inject('DRIZZLE_SERVICE') private readonly drizzle: DrizzleService,
  ) {}

  async create(tenantId: string, data: CreateInventoryMovementDto, userId: string): Promise<InventoryMovementWithProduct> {
    const db = this.drizzle.getDb();
    
    const [movement] = await db
      .insert(inventoryMovements)
      .values({
        tenantId,
        productId: data.productId,
        variantId: data.variantId,
        locationId: data.locationId,
        movementType: data.movementType,
        quantity: data.quantity.toString(),
        unitCost: data.unitCost?.toString(),
        totalCost: data.totalCost?.toString(),
        previousLevel: data.previousLevel.toString(),
        newLevel: data.newLevel.toString(),
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        referenceNumber: data.referenceNumber,
        batchNumber: data.batchNumber,
        lotNumber: data.lotNumber,
        expiryDate: data.expiryDate,
        reason: data.reason,
        notes: data.notes,
        requiresApproval: data.requiresApproval || false,
        approvedBy: data.approvedBy,
        approvedAt: data.approvedAt,
        fromBinLocation: data.fromBinLocation,
        toBinLocation: data.toBinLocation,
        metadata: data.metadata || {},
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    if (!movement) {
      throw new Error('Failed to create inventory movement');
    }

    const result = await this.findById(tenantId, movement.id);
    if (!result) {
      throw new Error('Failed to create inventory movement');
    }
    return result;
  }

  async findById(tenantId: string, id: string): Promise<InventoryMovementWithProduct | null> {
    const db = this.drizzle.getDb();
    
    const result = await db
      .select({
        movement: inventoryMovements,
        product: products,
        variant: productVariants,
      })
      .from(inventoryMovements)
      .leftJoin(products, eq(inventoryMovements.productId, products.id))
      .leftJoin(productVariants, eq(inventoryMovements.variantId, productVariants.id))
      .where(and(
        eq(inventoryMovements.tenantId, tenantId),
        eq(inventoryMovements.id, id),
        eq(inventoryMovements.isActive, true)
      ))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    if (!row?.movement) {
      return null;
    }

    const { movement, product, variant } = row;
    
    return {
      ...movement,
      quantity: parseFloat(movement.quantity || '0'),
      unitCost: movement.unitCost ? parseFloat(movement.unitCost) : null,
      totalCost: movement.totalCost ? parseFloat(movement.totalCost) : null,
      previousLevel: parseFloat(movement.previousLevel || '0'),
      newLevel: parseFloat(movement.newLevel || '0'),
      product,
      variant,
    };
  }

  async findByProduct(tenantId: string, productId: string, locationId?: string): Promise<InventoryMovementWithProduct[]> {
    const db = this.drizzle.getDb();
    
    const conditions = [
      eq(inventoryMovements.tenantId, tenantId),
      eq(inventoryMovements.productId, productId),
      eq(inventoryMovements.isActive, true),
    ];

    if (locationId) {
      conditions.push(eq(inventoryMovements.locationId, locationId));
    }

    const result = await db
      .select({
        movement: inventoryMovements,
        product: products,
        variant: productVariants,
      })
      .from(inventoryMovements)
      .leftJoin(products, eq(inventoryMovements.productId, products.id))
      .leftJoin(productVariants, eq(inventoryMovements.variantId, productVariants.id))
      .where(and(...conditions))
      .orderBy(desc(inventoryMovements.createdAt))
      .limit(100); // Limit to last 100 movements

    return result.map(({ movement, product, variant }) => ({
      ...movement,
      quantity: parseFloat(movement.quantity || '0'),
      unitCost: movement.unitCost ? parseFloat(movement.unitCost) : null,
      totalCost: movement.totalCost ? parseFloat(movement.totalCost) : null,
      previousLevel: parseFloat(movement.previousLevel || '0'),
      newLevel: parseFloat(movement.newLevel || '0'),
      product,
      variant,
    }));
  }

  async findByLocation(tenantId: string, locationId: string, startDate?: Date, endDate?: Date): Promise<InventoryMovementWithProduct[]> {
    const db = this.drizzle.getDb();
    
    const conditions = [
      eq(inventoryMovements.tenantId, tenantId),
      eq(inventoryMovements.locationId, locationId),
      eq(inventoryMovements.isActive, true),
    ];

    if (startDate) {
      conditions.push(gte(inventoryMovements.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(inventoryMovements.createdAt, endDate));
    }

    const result = await db
      .select({
        movement: inventoryMovements,
        product: products,
        variant: productVariants,
      })
      .from(inventoryMovements)
      .leftJoin(products, eq(inventoryMovements.productId, products.id))
      .leftJoin(productVariants, eq(inventoryMovements.variantId, productVariants.id))
      .where(and(...conditions))
      .orderBy(desc(inventoryMovements.createdAt))
      .limit(500); // Limit to last 500 movements

    return result.map(({ movement, product, variant }) => ({
      ...movement,
      quantity: parseFloat(movement.quantity || '0'),
      unitCost: movement.unitCost ? parseFloat(movement.unitCost) : null,
      totalCost: movement.totalCost ? parseFloat(movement.totalCost) : null,
      previousLevel: parseFloat(movement.previousLevel || '0'),
      newLevel: parseFloat(movement.newLevel || '0'),
      product,
      variant,
    }));
  }

  async findByReference(tenantId: string, referenceType: string, referenceId: string): Promise<InventoryMovementWithProduct[]> {
    const db = this.drizzle.getDb();
    
    const result = await db
      .select({
        movement: inventoryMovements,
        product: products,
        variant: productVariants,
      })
      .from(inventoryMovements)
      .leftJoin(products, eq(inventoryMovements.productId, products.id))
      .leftJoin(productVariants, eq(inventoryMovements.variantId, productVariants.id))
      .where(and(
        eq(inventoryMovements.tenantId, tenantId),
        eq(inventoryMovements.referenceType, referenceType),
        eq(inventoryMovements.referenceId, referenceId),
        eq(inventoryMovements.isActive, true)
      ))
      .orderBy(desc(inventoryMovements.createdAt));

    return result.map(({ movement, product, variant }) => ({
      ...movement,
      quantity: parseFloat(movement.quantity || '0'),
      unitCost: movement.unitCost ? parseFloat(movement.unitCost) : null,
      totalCost: movement.totalCost ? parseFloat(movement.totalCost) : null,
      previousLevel: parseFloat(movement.previousLevel || '0'),
      newLevel: parseFloat(movement.newLevel || '0'),
      product,
      variant,
    }));
  }

  async findPendingApprovals(tenantId: string): Promise<InventoryMovementWithProduct[]> {
    const db = this.drizzle.getDb();
    
    const result = await db
      .select({
        movement: inventoryMovements,
        product: products,
        variant: productVariants,
      })
      .from(inventoryMovements)
      .leftJoin(products, eq(inventoryMovements.productId, products.id))
      .leftJoin(productVariants, eq(inventoryMovements.variantId, productVariants.id))
      .where(and(
        eq(inventoryMovements.tenantId, tenantId),
        eq(inventoryMovements.requiresApproval, true),
        sql`${inventoryMovements.approvedBy} IS NULL`,
        eq(inventoryMovements.isActive, true)
      ))
      .orderBy(asc(inventoryMovements.createdAt));

    return result.map(({ movement, product, variant }) => ({
      ...movement,
      quantity: parseFloat(movement.quantity || '0'),
      unitCost: movement.unitCost ? parseFloat(movement.unitCost) : null,
      totalCost: movement.totalCost ? parseFloat(movement.totalCost) : null,
      previousLevel: parseFloat(movement.previousLevel || '0'),
      newLevel: parseFloat(movement.newLevel || '0'),
      product,
      variant,
    }));
  }

  async approveMovement(tenantId: string, movementId: string, approvedBy: string): Promise<InventoryMovementWithProduct | null> {
    const db = this.drizzle.getDb();
    
    const [updated] = await db
      .update(inventoryMovements)
      .set({
        approvedBy,
        approvedAt: new Date(),
        updatedBy: approvedBy,
        updatedAt: new Date(),
        version: sql`${inventoryMovements.version} + 1`,
      })
      .where(and(
        eq(inventoryMovements.tenantId, tenantId),
        eq(inventoryMovements.id, movementId),
        eq(inventoryMovements.isActive, true)
      ))
      .returning();

    if (!updated) {
      return null;
    }

    return this.findById(tenantId, updated.id);
  }

  async getMovementSummary(tenantId: string, locationId: string, startDate: Date, endDate: Date): Promise<{
    totalIn: number;
    totalOut: number;
    netChange: number;
    movementCount: number;
  }> {
    const db = this.drizzle.getDb();
    
    const result = await db
      .select({
        totalIn: sql<number>`SUM(CASE WHEN ${inventoryMovements.quantity}::numeric > 0 THEN ${inventoryMovements.quantity}::numeric ELSE 0 END)`,
        totalOut: sql<number>`SUM(CASE WHEN ${inventoryMovements.quantity}::numeric < 0 THEN ABS(${inventoryMovements.quantity}::numeric) ELSE 0 END)`,
        netChange: sql<number>`SUM(${inventoryMovements.quantity}::numeric)`,
        movementCount: count(),
      })
      .from(inventoryMovements)
      .where(and(
        eq(inventoryMovements.tenantId, tenantId),
        eq(inventoryMovements.locationId, locationId),
        gte(inventoryMovements.createdAt, startDate),
        lte(inventoryMovements.createdAt, endDate),
        eq(inventoryMovements.isActive, true)
      ));

    return result[0] || {
      totalIn: 0,
      totalOut: 0,
      netChange: 0,
      movementCount: 0,
    };
  }

  async findMany(tenantId: string, query: {
    productId?: string;
    locationId?: string;
    movementType?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<InventoryMovementWithProduct[]> {
    const db = this.drizzle.getDb();
    
    // Build where conditions
    const conditions = [
      eq(inventoryMovements.tenantId, tenantId),
      eq(inventoryMovements.isActive, true),
    ];

    if (query.productId) {
      conditions.push(eq(inventoryMovements.productId, query.productId));
    }

    if (query.locationId) {
      conditions.push(eq(inventoryMovements.locationId, query.locationId));
    }

    if (query.movementType) {
      conditions.push(eq(inventoryMovements.movementType, query.movementType as any));
    }

    if (query.dateFrom) {
      conditions.push(gte(inventoryMovements.createdAt, query.dateFrom));
    }

    if (query.dateTo) {
      conditions.push(lte(inventoryMovements.createdAt, query.dateTo));
    }

    const whereClause = and(...conditions);

    // Build order by clause
    let orderBy;
    const sortField = query.sortBy || 'createdAt';
    const sortDirection = query.sortOrder || 'desc';

    switch (sortField) {
      case 'quantity':
        orderBy = sortDirection === 'asc' ? 
          sql`${inventoryMovements.quantity}::numeric ASC` : 
          sql`${inventoryMovements.quantity}::numeric DESC`;
        break;
      case 'movementType':
        orderBy = sortDirection === 'asc' ? asc(inventoryMovements.movementType) : desc(inventoryMovements.movementType);
        break;
      default:
        orderBy = sortDirection === 'asc' ? asc(inventoryMovements.createdAt) : desc(inventoryMovements.createdAt);
        break;
    }

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 100;
    const offset = (page - 1) * limit;

    // Get movements with product info
    const result = await db
      .select({
        movement: inventoryMovements,
        product: products,
        variant: productVariants,
      })
      .from(inventoryMovements)
      .leftJoin(products, eq(inventoryMovements.productId, products.id))
      .leftJoin(productVariants, eq(inventoryMovements.variantId, productVariants.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return result.map(({ movement, product, variant }) => ({
      ...movement,
      quantity: parseFloat(movement.quantity || '0'),
      unitCost: movement.unitCost ? parseFloat(movement.unitCost) : null,
      totalCost: movement.totalCost ? parseFloat(movement.totalCost) : null,
      previousLevel: parseFloat(movement.previousLevel || '0'),
      newLevel: parseFloat(movement.newLevel || '0'),
      product,
      variant,
    }));
  }
}