import { Injectable, Inject } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { 
  inventoryBatches,
  inventoryMovements,
  products,
  productVariants
} from '../../database/schema';
import { eq, and, lt, lte, gte, desc, asc, sql, count, isNull, or } from 'drizzle-orm';
import { CreateBatchDto, BatchQueryDto } from '../services/batch-tracking.service';

export interface BatchWithProduct {
  id: string;
  tenantId: string;
  productId: string;
  variantId?: string;
  locationId: string;
  batchNumber: string;
  lotNumber?: string;
  serialNumbers?: string[];
  originalQuantity: number;
  currentQuantity: number;
  reservedQuantity: number;
  unitCost: number;
  totalCost: number;
  receivedDate: Date;
  manufactureDate?: Date;
  expiryDate?: Date;
  supplierId?: string;
  supplierBatchNumber?: string;
  qualityStatus: string;
  qualityNotes?: string;
  status: string;
  binLocation?: string;
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
export class BatchTrackingRepository {
  constructor(
    @Inject('DRIZZLE_SERVICE') private readonly drizzle: DrizzleService,
  ) {}

  async create(tenantId: string, data: CreateBatchDto, userId: string): Promise<BatchWithProduct> {
    const db = this.drizzle.getDb();
    
    const totalCost = data.originalQuantity * data.unitCost;

    const [batch] = await db
      .insert(inventoryBatches)
      .values({
        tenantId,
        productId: data.productId,
        variantId: data.variantId,
        locationId: data.locationId,
        batchNumber: data.batchNumber,
        lotNumber: data.lotNumber,
        serialNumbers: data.serialNumbers || [],
        originalQuantity: data.originalQuantity.toString(),
        currentQuantity: data.originalQuantity.toString(),
        reservedQuantity: '0',
        unitCost: data.unitCost.toString(),
        totalCost: totalCost.toString(),
        receivedDate: data.receivedDate,
        manufactureDate: data.manufactureDate,
        expiryDate: data.expiryDate,
        supplierId: data.supplierId,
        supplierBatchNumber: data.supplierBatchNumber,
        qualityStatus: data.qualityStatus || 'approved',
        qualityNotes: data.qualityNotes,
        status: 'active',
        binLocation: data.binLocation,
        attributes: data.attributes || {},
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return this.findById(tenantId, batch.id);
  }

  async findById(tenantId: string, id: string): Promise<BatchWithProduct | null> {
    const db = this.drizzle.getDb();
    
    const result = await db
      .select({
        batch: inventoryBatches,
        product: products,
        variant: productVariants,
      })
      .from(inventoryBatches)
      .leftJoin(products, eq(inventoryBatches.productId, products.id))
      .leftJoin(productVariants, eq(inventoryBatches.variantId, productVariants.id))
      .where(and(
        eq(inventoryBatches.tenantId, tenantId),
        eq(inventoryBatches.id, id),
        eq(inventoryBatches.isActive, true)
      ))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const { batch, product, variant } = result[0];
    
    return {
      ...batch,
      originalQuantity: parseFloat(batch.originalQuantity),
      currentQuantity: parseFloat(batch.currentQuantity),
      reservedQuantity: parseFloat(batch.reservedQuantity),
      unitCost: parseFloat(batch.unitCost),
      totalCost: parseFloat(batch.totalCost),
      product,
      variant,
    };
  }

  async findByBatchNumber(tenantId: string, batchNumber: string, locationId: string): Promise<BatchWithProduct | null> {
    const db = this.drizzle.getDb();
    
    const result = await db
      .select({
        batch: inventoryBatches,
        product: products,
        variant: productVariants,
      })
      .from(inventoryBatches)
      .leftJoin(products, eq(inventoryBatches.productId, products.id))
      .leftJoin(productVariants, eq(inventoryBatches.variantId, productVariants.id))
      .where(and(
        eq(inventoryBatches.tenantId, tenantId),
        eq(inventoryBatches.batchNumber, batchNumber),
        eq(inventoryBatches.locationId, locationId),
        eq(inventoryBatches.isActive, true)
      ))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const { batch, product, variant } = result[0];
    
    return {
      ...batch,
      originalQuantity: parseFloat(batch.originalQuantity),
      currentQuantity: parseFloat(batch.currentQuantity),
      reservedQuantity: parseFloat(batch.reservedQuantity),
      unitCost: parseFloat(batch.unitCost),
      totalCost: parseFloat(batch.totalCost),
      product,
      variant,
    };
  }

  async findByBatchNumberAllLocations(tenantId: string, batchNumber: string): Promise<BatchWithProduct[]> {
    const db = this.drizzle.getDb();
    
    const result = await db
      .select({
        batch: inventoryBatches,
        product: products,
        variant: productVariants,
      })
      .from(inventoryBatches)
      .leftJoin(products, eq(inventoryBatches.productId, products.id))
      .leftJoin(productVariants, eq(inventoryBatches.variantId, productVariants.id))
      .where(and(
        eq(inventoryBatches.tenantId, tenantId),
        eq(inventoryBatches.batchNumber, batchNumber),
        eq(inventoryBatches.isActive, true)
      ));

    return result.map(({ batch, product, variant }) => ({
      ...batch,
      originalQuantity: parseFloat(batch.originalQuantity),
      currentQuantity: parseFloat(batch.currentQuantity),
      reservedQuantity: parseFloat(batch.reservedQuantity),
      unitCost: parseFloat(batch.unitCost),
      totalCost: parseFloat(batch.totalCost),
      product,
      variant,
    }));
  }

  async findMany(tenantId: string, query: BatchQueryDto): Promise<{
    batches: BatchWithProduct[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const db = this.drizzle.getDb();
    
    // Build where conditions
    const conditions = [
      eq(inventoryBatches.tenantId, tenantId),
      eq(inventoryBatches.isActive, true),
    ];

    if (query.productId) {
      conditions.push(eq(inventoryBatches.productId, query.productId));
    }

    if (query.locationId) {
      conditions.push(eq(inventoryBatches.locationId, query.locationId));
    }

    if (query.batchNumber) {
      conditions.push(eq(inventoryBatches.batchNumber, query.batchNumber));
    }

    if (query.status) {
      conditions.push(eq(inventoryBatches.status, query.status));
    }

    if (query.qualityStatus) {
      conditions.push(eq(inventoryBatches.qualityStatus, query.qualityStatus));
    }

    if (query.expiringBefore) {
      conditions.push(lte(inventoryBatches.expiryDate, query.expiringBefore));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(inventoryBatches)
      .where(whereClause);

    // Build order by clause
    let orderBy;
    const sortField = query.sortBy || 'expiryDate';
    const sortDirection = query.sortOrder || 'asc';

    switch (sortField) {
      case 'batchNumber':
        orderBy = sortDirection === 'asc' ? asc(inventoryBatches.batchNumber) : desc(inventoryBatches.batchNumber);
        break;
      case 'expiryDate':
        orderBy = sortDirection === 'asc' ? asc(inventoryBatches.expiryDate) : desc(inventoryBatches.expiryDate);
        break;
      case 'receivedDate':
        orderBy = sortDirection === 'asc' ? asc(inventoryBatches.receivedDate) : desc(inventoryBatches.receivedDate);
        break;
      case 'currentQuantity':
        orderBy = sortDirection === 'asc' ? 
          sql`${inventoryBatches.currentQuantity}::numeric ASC` : 
          sql`${inventoryBatches.currentQuantity}::numeric DESC`;
        break;
      default:
        orderBy = sortDirection === 'asc' ? asc(inventoryBatches.createdAt) : desc(inventoryBatches.createdAt);
        break;
    }

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    // Get batches with product info
    const result = await db
      .select({
        batch: inventoryBatches,
        product: products,
        variant: productVariants,
      })
      .from(inventoryBatches)
      .leftJoin(products, eq(inventoryBatches.productId, products.id))
      .leftJoin(productVariants, eq(inventoryBatches.variantId, productVariants.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const batchesWithProducts = result.map(({ batch, product, variant }) => ({
      ...batch,
      originalQuantity: parseFloat(batch.originalQuantity),
      currentQuantity: parseFloat(batch.currentQuantity),
      reservedQuantity: parseFloat(batch.reservedQuantity),
      unitCost: parseFloat(batch.unitCost),
      totalCost: parseFloat(batch.totalCost),
      product,
      variant,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return {
      batches: batchesWithProducts,
      total: totalCount,
      page,
      limit,
      totalPages,
    };
  }

  async consumeQuantity(
    tenantId: string,
    batchId: string,
    quantity: number,
    reason: string,
    userId: string,
  ): Promise<BatchWithProduct> {
    const db = this.drizzle.getDb();
    
    const [updated] = await db
      .update(inventoryBatches)
      .set({
        currentQuantity: sql`${inventoryBatches.currentQuantity}::numeric - ${quantity}`,
        status: sql`CASE WHEN (${inventoryBatches.currentQuantity}::numeric - ${quantity}) <= 0 THEN 'consumed' ELSE ${inventoryBatches.status} END`,
        updatedBy: userId,
        updatedAt: new Date(),
        version: sql`${inventoryBatches.version} + 1`,
      })
      .where(and(
        eq(inventoryBatches.tenantId, tenantId),
        eq(inventoryBatches.id, batchId),
        eq(inventoryBatches.isActive, true)
      ))
      .returning();

    return this.findById(tenantId, updated.id);
  }

  async updateStatus(
    tenantId: string,
    batchId: string,
    status: string,
    userId: string,
  ): Promise<BatchWithProduct> {
    const db = this.drizzle.getDb();
    
    const [updated] = await db
      .update(inventoryBatches)
      .set({
        status,
        updatedBy: userId,
        updatedAt: new Date(),
        version: sql`${inventoryBatches.version} + 1`,
      })
      .where(and(
        eq(inventoryBatches.tenantId, tenantId),
        eq(inventoryBatches.id, batchId),
        eq(inventoryBatches.isActive, true)
      ))
      .returning();

    return this.findById(tenantId, updated.id);
  }

  async updateQualityStatus(
    tenantId: string,
    batchId: string,
    qualityStatus: string,
    qualityNotes: string,
    userId: string,
  ): Promise<BatchWithProduct> {
    const db = this.drizzle.getDb();
    
    const [updated] = await db
      .update(inventoryBatches)
      .set({
        qualityStatus,
        qualityNotes,
        updatedBy: userId,
        updatedAt: new Date(),
        version: sql`${inventoryBatches.version} + 1`,
      })
      .where(and(
        eq(inventoryBatches.tenantId, tenantId),
        eq(inventoryBatches.id, batchId),
        eq(inventoryBatches.isActive, true)
      ))
      .returning();

    return this.findById(tenantId, updated.id);
  }

  async findExpiringBatches(tenantId: string, expiryDate: Date, locationId?: string): Promise<BatchWithProduct[]> {
    const db = this.drizzle.getDb();
    
    const conditions = [
      eq(inventoryBatches.tenantId, tenantId),
      eq(inventoryBatches.isActive, true),
      eq(inventoryBatches.status, 'active'),
      lte(inventoryBatches.expiryDate, expiryDate),
      sql`${inventoryBatches.currentQuantity}::numeric > 0`,
    ];

    if (locationId) {
      conditions.push(eq(inventoryBatches.locationId, locationId));
    }

    const result = await db
      .select({
        batch: inventoryBatches,
        product: products,
        variant: productVariants,
      })
      .from(inventoryBatches)
      .leftJoin(products, eq(inventoryBatches.productId, products.id))
      .leftJoin(productVariants, eq(inventoryBatches.variantId, productVariants.id))
      .where(and(...conditions))
      .orderBy(asc(inventoryBatches.expiryDate));

    return result.map(({ batch, product, variant }) => ({
      ...batch,
      originalQuantity: parseFloat(batch.originalQuantity),
      currentQuantity: parseFloat(batch.currentQuantity),
      reservedQuantity: parseFloat(batch.reservedQuantity),
      unitCost: parseFloat(batch.unitCost),
      totalCost: parseFloat(batch.totalCost),
      product,
      variant,
    }));
  }

  async findExpiredBatches(tenantId: string): Promise<BatchWithProduct[]> {
    const db = this.drizzle.getDb();
    
    const result = await db
      .select({
        batch: inventoryBatches,
        product: products,
        variant: productVariants,
      })
      .from(inventoryBatches)
      .leftJoin(products, eq(inventoryBatches.productId, products.id))
      .leftJoin(productVariants, eq(inventoryBatches.variantId, productVariants.id))
      .where(and(
        eq(inventoryBatches.tenantId, tenantId),
        eq(inventoryBatches.isActive, true),
        eq(inventoryBatches.status, 'active'),
        lt(inventoryBatches.expiryDate, new Date()),
        sql`${inventoryBatches.currentQuantity}::numeric > 0`
      ));

    return result.map(({ batch, product, variant }) => ({
      ...batch,
      originalQuantity: parseFloat(batch.originalQuantity),
      currentQuantity: parseFloat(batch.currentQuantity),
      reservedQuantity: parseFloat(batch.reservedQuantity),
      unitCost: parseFloat(batch.unitCost),
      totalCost: parseFloat(batch.totalCost),
      product,
      variant,
    }));
  }

  async findFIFOBatches(tenantId: string, productId: string, variantId: string | null, locationId: string): Promise<BatchWithProduct[]> {
    const db = this.drizzle.getDb();
    
    const conditions = [
      eq(inventoryBatches.tenantId, tenantId),
      eq(inventoryBatches.productId, productId),
      eq(inventoryBatches.locationId, locationId),
      eq(inventoryBatches.isActive, true),
      eq(inventoryBatches.status, 'active'),
      sql`${inventoryBatches.currentQuantity}::numeric > 0`,
    ];

    if (variantId) {
      conditions.push(eq(inventoryBatches.variantId, variantId));
    } else {
      conditions.push(isNull(inventoryBatches.variantId));
    }

    const result = await db
      .select({
        batch: inventoryBatches,
        product: products,
        variant: productVariants,
      })
      .from(inventoryBatches)
      .leftJoin(products, eq(inventoryBatches.productId, products.id))
      .leftJoin(productVariants, eq(inventoryBatches.variantId, productVariants.id))
      .where(and(...conditions))
      .orderBy(asc(inventoryBatches.receivedDate));

    return result.map(({ batch, product, variant }) => ({
      ...batch,
      originalQuantity: parseFloat(batch.originalQuantity),
      currentQuantity: parseFloat(batch.currentQuantity),
      reservedQuantity: parseFloat(batch.reservedQuantity),
      unitCost: parseFloat(batch.unitCost),
      totalCost: parseFloat(batch.totalCost),
      product,
      variant,
    }));
  }

  async findLIFOBatches(tenantId: string, productId: string, variantId: string | null, locationId: string): Promise<BatchWithProduct[]> {
    const db = this.drizzle.getDb();
    
    const conditions = [
      eq(inventoryBatches.tenantId, tenantId),
      eq(inventoryBatches.productId, productId),
      eq(inventoryBatches.locationId, locationId),
      eq(inventoryBatches.isActive, true),
      eq(inventoryBatches.status, 'active'),
      sql`${inventoryBatches.currentQuantity}::numeric > 0`,
    ];

    if (variantId) {
      conditions.push(eq(inventoryBatches.variantId, variantId));
    } else {
      conditions.push(isNull(inventoryBatches.variantId));
    }

    const result = await db
      .select({
        batch: inventoryBatches,
        product: products,
        variant: productVariants,
      })
      .from(inventoryBatches)
      .leftJoin(products, eq(inventoryBatches.productId, products.id))
      .leftJoin(productVariants, eq(inventoryBatches.variantId, productVariants.id))
      .where(and(...conditions))
      .orderBy(desc(inventoryBatches.receivedDate));

    return result.map(({ batch, product, variant }) => ({
      ...batch,
      originalQuantity: parseFloat(batch.originalQuantity),
      currentQuantity: parseFloat(batch.currentQuantity),
      reservedQuantity: parseFloat(batch.reservedQuantity),
      unitCost: parseFloat(batch.unitCost),
      totalCost: parseFloat(batch.totalCost),
      product,
      variant,
    }));
  }

  async findFEFOBatches(tenantId: string, productId: string, variantId: string | null, locationId: string): Promise<BatchWithProduct[]> {
    const db = this.drizzle.getDb();
    
    const conditions = [
      eq(inventoryBatches.tenantId, tenantId),
      eq(inventoryBatches.productId, productId),
      eq(inventoryBatches.locationId, locationId),
      eq(inventoryBatches.isActive, true),
      eq(inventoryBatches.status, 'active'),
      sql`${inventoryBatches.currentQuantity}::numeric > 0`,
    ];

    if (variantId) {
      conditions.push(eq(inventoryBatches.variantId, variantId));
    } else {
      conditions.push(isNull(inventoryBatches.variantId));
    }

    const result = await db
      .select({
        batch: inventoryBatches,
        product: products,
        variant: productVariants,
      })
      .from(inventoryBatches)
      .leftJoin(products, eq(inventoryBatches.productId, products.id))
      .leftJoin(productVariants, eq(inventoryBatches.variantId, productVariants.id))
      .where(and(...conditions))
      .orderBy(asc(inventoryBatches.expiryDate));

    return result.map(({ batch, product, variant }) => ({
      ...batch,
      originalQuantity: parseFloat(batch.originalQuantity),
      currentQuantity: parseFloat(batch.currentQuantity),
      reservedQuantity: parseFloat(batch.reservedQuantity),
      unitCost: parseFloat(batch.unitCost),
      totalCost: parseFloat(batch.totalCost),
      product,
      variant,
    }));
  }

  async getBatchHistory(tenantId: string, batchId: string): Promise<any[]> {
    const db = this.drizzle.getDb();
    
    const result = await db
      .select()
      .from(inventoryMovements)
      .where(and(
        eq(inventoryMovements.tenantId, tenantId),
        eq(inventoryMovements.batchNumber, batchId)
      ))
      .orderBy(desc(inventoryMovements.createdAt));

    return result;
  }
}