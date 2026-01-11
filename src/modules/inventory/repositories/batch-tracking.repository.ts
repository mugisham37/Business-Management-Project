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
  variantId: string;
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

  private mapBatchWithProduct(batch: any, product: any, variant: any): BatchWithProduct {
    return {
      ...batch,
      variantId: batch.variantId || '',
      originalQuantity: parseFloat(batch.originalQuantity),
      currentQuantity: parseFloat(batch.currentQuantity),
      reservedQuantity: parseFloat(batch.reservedQuantity),
      unitCost: parseFloat(batch.unitCost),
      totalCost: parseFloat(batch.totalCost),
      product,
      variant,
    };
  }

  async create(tenantId: string, data: CreateBatchDto, userId: string): Promise<BatchWithProduct> {
    const db = this.drizzle.getDb();
    
    const totalCost = data.originalQuantity * data.unitCost;

    const [batch] = await db
      .insert(inventoryBatches)
      .values({
        tenantId,
        productId: data.productId,
        variantId: data.variantId || '',
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

    if (!batch) {
      throw new Error('Failed to create batch');
    }

    const result = await this.findById(tenantId, batch.id);
    if (!result) {
      throw new Error('Failed to create batch');
    }
    return result;
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

    if (result.length === 0 || !result[0]) {
      return null;
    }

    const { batch, product, variant } = result[0];
    
    if (!batch) {
      return null;
    }
    
    return this.mapBatchWithProduct(batch, product, variant);
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

    if (result.length === 0 || !result[0]) {
      return null;
    }

    const { batch, product, variant } = result[0];
    
    if (!batch) {
      return null;
    }
    
    return this.mapBatchWithProduct(batch, product, variant);
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

    return result.map(({ batch, product, variant }) => 
      this.mapBatchWithProduct(batch, product, variant)
    );
  }

  async findMany(tenantId: string, query: BatchQueryDto): Promise<{
    batches: BatchWithProduct[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const db = this.drizzle.getDb();
    
    const conditions = [eq(inventoryBatches.tenantId, tenantId)];

    if (query.productId) {
      conditions.push(eq(inventoryBatches.productId, query.productId));
    }

    if (query.locationId) {
      conditions.push(eq(inventoryBatches.locationId, query.locationId));
    }

    if (query.status) {
      conditions.push(eq(inventoryBatches.status, query.status));
    }

    if (query.qualityStatus) {
      conditions.push(eq(inventoryBatches.qualityStatus, query.qualityStatus));
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(inventoryBatches)
      .where(whereClause);
    
    const totalCount = countResult[0]?.count || 0;

    // Calculate pagination
    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(totalCount / limit);

    // Get paginated results
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
      .orderBy(desc(inventoryBatches.createdAt))
      .limit(limit)
      .offset(offset);

    const batchesWithProducts = result.map(({ batch, product, variant }) => 
      this.mapBatchWithProduct(batch, product, variant)
    );

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
        currentQuantity: sql`${inventoryBatches.currentQuantity} - ${quantity}`,
        reservedQuantity: sql`${inventoryBatches.reservedQuantity} - ${quantity}`,
        updatedBy: userId,
      })
      .where(and(
        eq(inventoryBatches.tenantId, tenantId),
        eq(inventoryBatches.id, batchId)
      ))
      .returning();

    if (!updated) {
      throw new Error('Batch not found');
    }

    const result = await this.findById(tenantId, updated.id);
    if (!result) {
      throw new Error('Failed to update batch');
    }
    return result;
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
      })
      .where(and(
        eq(inventoryBatches.tenantId, tenantId),
        eq(inventoryBatches.id, batchId)
      ))
      .returning();

    if (!updated) {
      throw new Error('Batch not found');
    }

    const result = await this.findById(tenantId, updated.id);
    if (!result) {
      throw new Error('Failed to update batch status');
    }
    return result;
  }

  async updateQualityStatus(
    tenantId: string,
    batchId: string,
    qualityStatus: string,
    qualityNotes?: string,
    userId?: string,
  ): Promise<BatchWithProduct> {
    const db = this.drizzle.getDb();

    const [updated] = await db
      .update(inventoryBatches)
      .set({
        qualityStatus,
        qualityNotes,
        updatedBy: userId,
      })
      .where(and(
        eq(inventoryBatches.tenantId, tenantId),
        eq(inventoryBatches.id, batchId)
      ))
      .returning();

    if (!updated) {
      throw new Error('Batch not found');
    }

    const result = await this.findById(tenantId, updated.id);
    if (!result) {
      throw new Error('Failed to update batch quality status');
    }
    return result;
  }

  async findExpiringBatches(
    tenantId: string,
    expiryDate: Date,
    locationId?: string,
  ): Promise<BatchWithProduct[]> {
    const db = this.drizzle.getDb();
    
    const conditions = [
      eq(inventoryBatches.tenantId, tenantId),
      eq(inventoryBatches.isActive, true),
      lte(inventoryBatches.expiryDate, expiryDate),
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

    return result.map(({ batch, product, variant }) => 
      this.mapBatchWithProduct(batch, product, variant)
    );
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
        lt(inventoryBatches.expiryDate, new Date()),
      ))
      .orderBy(asc(inventoryBatches.expiryDate));

    return result.map(({ batch, product, variant }) => 
      this.mapBatchWithProduct(batch, product, variant)
    );
  }

  async findFIFOBatches(
    tenantId: string,
    productId: string,
    variantId: string | null,
    locationId: string,
  ): Promise<BatchWithProduct[]> {
    const db = this.drizzle.getDb();
    
    const conditions = [
      eq(inventoryBatches.tenantId, tenantId),
      eq(inventoryBatches.productId, productId),
      eq(inventoryBatches.locationId, locationId),
      eq(inventoryBatches.isActive, true),
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

    return result.map(({ batch, product, variant }) => 
      this.mapBatchWithProduct(batch, product, variant)
    );
  }

  async findLIFOBatches(
    tenantId: string,
    productId: string,
    variantId: string | null,
    locationId: string,
  ): Promise<BatchWithProduct[]> {
    const db = this.drizzle.getDb();
    
    const conditions = [
      eq(inventoryBatches.tenantId, tenantId),
      eq(inventoryBatches.productId, productId),
      eq(inventoryBatches.locationId, locationId),
      eq(inventoryBatches.isActive, true),
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

    return result.map(({ batch, product, variant }) => 
      this.mapBatchWithProduct(batch, product, variant)
    );
  }

  async findFEFOBatches(
    tenantId: string,
    productId: string,
    variantId: string | null,
    locationId: string,
  ): Promise<BatchWithProduct[]> {
    const db = this.drizzle.getDb();
    
    const conditions = [
      eq(inventoryBatches.tenantId, tenantId),
      eq(inventoryBatches.productId, productId),
      eq(inventoryBatches.locationId, locationId),
      eq(inventoryBatches.isActive, true),
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

    return result.map(({ batch, product, variant }) => 
      this.mapBatchWithProduct(batch, product, variant)
    );
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