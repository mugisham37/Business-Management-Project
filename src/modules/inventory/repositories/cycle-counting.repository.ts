import { Injectable, Inject } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { 
  stockCountSessions,
  stockCountItems,
  products,
  productVariants,
  inventoryLevels
} from '../../database/schema';
import { eq, and, gte, lte, desc, asc, sql, count, isNull, or, ne } from 'drizzle-orm';
import { 
  CreateStockCountSessionDto, 
  StockCountSessionQueryDto,
  StockCountItemQueryDto
} from '../services/cycle-counting.service';

export interface StockCountSessionWithDetails {
  id: string;
  tenantId: string;
  sessionNumber: string;
  name: string;
  description?: string;
  locationId: string;
  categoryIds: string[];
  productIds: string[];
  status: string;
  scheduledDate?: Date;
  startedAt?: Date;
  completedAt?: Date;
  assignedTo: string[];
  totalItemsCounted: number;
  totalVariances: number;
  totalAdjustmentValue: number;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version: number;
}

export interface StockCountItemWithProduct {
  id: string;
  tenantId: string;
  sessionId: string;
  productId: string;
  variantId?: string;
  expectedQuantity: number;
  countedQuantity?: number;
  variance?: number;
  batchNumber?: string;
  binLocation?: string;
  countedBy?: string;
  countedAt?: Date;
  status: string;
  notes?: string;
  adjustmentId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version: number;
  product?: any;
  variant?: any;
  sessionNumber?: string;
  sessionLocationId?: string;
}

export interface CreateCountItemDto {
  sessionId: string;
  productId: string;
  variantId?: string;
  expectedQuantity: number;
  batchNumber?: string;
  binLocation?: string;
}

export interface UpdateCountItemDto {
  countedQuantity?: number;
  variance?: number;
  batchNumber?: string;
  binLocation?: string;
  countedBy?: string;
  countedAt?: Date;
  status?: string;
  notes?: string;
  adjustmentId?: string;
}

@Injectable()
export class CycleCountingRepository {
  constructor(
    @Inject('DRIZZLE_SERVICE') private readonly drizzle: DrizzleService,
  ) {}

  async createSession(tenantId: string, data: CreateStockCountSessionDto, userId: string): Promise<StockCountSessionWithDetails> {
    const db = this.drizzle.getDb();
    
    const [session] = await db
      .insert(stockCountSessions)
      .values({
        tenantId,
        sessionNumber: data.sessionNumber,
        name: data.name,
        description: data.description,
        locationId: data.locationId,
        categoryIds: data.categoryIds || [],
        productIds: data.productIds || [],
        status: 'planned',
        scheduledDate: data.scheduledDate,
        assignedTo: data.assignedTo || [],
        totalItemsCounted: 0,
        totalVariances: 0,
        totalAdjustmentValue: '0',
        notes: data.notes,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return this.findSessionById(tenantId, session.id);
  }

  async findSessionById(tenantId: string, sessionId: string): Promise<StockCountSessionWithDetails | null> {
    const db = this.drizzle.getDb();
    
    const [session] = await db
      .select()
      .from(stockCountSessions)
      .where(and(
        eq(stockCountSessions.tenantId, tenantId),
        eq(stockCountSessions.id, sessionId),
        eq(stockCountSessions.isActive, true)
      ))
      .limit(1);

    if (!session) {
      return null;
    }

    return {
      ...session,
      totalAdjustmentValue: parseFloat(session.totalAdjustmentValue),
    };
  }

  async findBySessionNumber(tenantId: string, sessionNumber: string): Promise<StockCountSessionWithDetails | null> {
    const db = this.drizzle.getDb();
    
    const [session] = await db
      .select()
      .from(stockCountSessions)
      .where(and(
        eq(stockCountSessions.tenantId, tenantId),
        eq(stockCountSessions.sessionNumber, sessionNumber),
        eq(stockCountSessions.isActive, true)
      ))
      .limit(1);

    if (!session) {
      return null;
    }

    return {
      ...session,
      totalAdjustmentValue: parseFloat(session.totalAdjustmentValue),
    };
  }

  async findSessions(tenantId: string, query: StockCountSessionQueryDto): Promise<{
    sessions: StockCountSessionWithDetails[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const db = this.drizzle.getDb();
    
    // Build where conditions
    const conditions = [
      eq(stockCountSessions.tenantId, tenantId),
      eq(stockCountSessions.isActive, true),
    ];

    if (query.locationId) {
      conditions.push(eq(stockCountSessions.locationId, query.locationId));
    }

    if (query.status) {
      conditions.push(eq(stockCountSessions.status, query.status));
    }

    if (query.scheduledDateFrom) {
      conditions.push(gte(stockCountSessions.scheduledDate, query.scheduledDateFrom));
    }

    if (query.scheduledDateTo) {
      conditions.push(lte(stockCountSessions.scheduledDate, query.scheduledDateTo));
    }

    if (query.assignedTo) {
      conditions.push(sql`${query.assignedTo} = ANY(${stockCountSessions.assignedTo})`);
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(stockCountSessions)
      .where(whereClause);

    // Build order by clause
    let orderBy;
    const sortField = query.sortBy || 'scheduledDate';
    const sortDirection = query.sortOrder || 'desc';

    switch (sortField) {
      case 'sessionNumber':
        orderBy = sortDirection === 'asc' ? asc(stockCountSessions.sessionNumber) : desc(stockCountSessions.sessionNumber);
        break;
      case 'name':
        orderBy = sortDirection === 'asc' ? asc(stockCountSessions.name) : desc(stockCountSessions.name);
        break;
      case 'status':
        orderBy = sortDirection === 'asc' ? asc(stockCountSessions.status) : desc(stockCountSessions.status);
        break;
      case 'scheduledDate':
        orderBy = sortDirection === 'asc' ? asc(stockCountSessions.scheduledDate) : desc(stockCountSessions.scheduledDate);
        break;
      default:
        orderBy = sortDirection === 'asc' ? asc(stockCountSessions.createdAt) : desc(stockCountSessions.createdAt);
        break;
    }

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    // Get sessions
    const result = await db
      .select()
      .from(stockCountSessions)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const sessionsWithDetails = result.map(session => ({
      ...session,
      totalAdjustmentValue: parseFloat(session.totalAdjustmentValue),
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return {
      sessions: sessionsWithDetails,
      total: totalCount,
      page,
      limit,
      totalPages,
    };
  }

  async updateSessionStatus(
    tenantId: string,
    sessionId: string,
    status: string,
    updates: Partial<{
      startedAt: Date;
      completedAt: Date;
      totalItemsCounted: number;
      totalVariances: number;
      totalAdjustmentValue: number;
    }>,
    userId: string,
  ): Promise<StockCountSessionWithDetails> {
    const db = this.drizzle.getDb();
    
    const updateData: any = {
      status,
      updatedBy: userId,
      updatedAt: new Date(),
      version: sql`${stockCountSessions.version} + 1`,
    };

    if (updates.startedAt) {
      updateData.startedAt = updates.startedAt;
    }

    if (updates.completedAt) {
      updateData.completedAt = updates.completedAt;
    }

    if (updates.totalItemsCounted !== undefined) {
      updateData.totalItemsCounted = updates.totalItemsCounted;
    }

    if (updates.totalVariances !== undefined) {
      updateData.totalVariances = updates.totalVariances;
    }

    if (updates.totalAdjustmentValue !== undefined) {
      updateData.totalAdjustmentValue = updates.totalAdjustmentValue.toString();
    }

    const [updated] = await db
      .update(stockCountSessions)
      .set(updateData)
      .where(and(
        eq(stockCountSessions.tenantId, tenantId),
        eq(stockCountSessions.id, sessionId),
        eq(stockCountSessions.isActive, true)
      ))
      .returning();

    return this.findSessionById(tenantId, updated.id);
  }

  async createCountItem(tenantId: string, data: CreateCountItemDto, userId: string): Promise<StockCountItemWithProduct> {
    const db = this.drizzle.getDb();
    
    const [item] = await db
      .insert(stockCountItems)
      .values({
        tenantId,
        sessionId: data.sessionId,
        productId: data.productId,
        variantId: data.variantId,
        expectedQuantity: data.expectedQuantity.toString(),
        batchNumber: data.batchNumber,
        binLocation: data.binLocation,
        status: 'pending',
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return this.findCountItemById(tenantId, item.id);
  }

  async findCountItemById(tenantId: string, itemId: string): Promise<StockCountItemWithProduct | null> {
    const db = this.drizzle.getDb();
    
    const result = await db
      .select({
        item: stockCountItems,
        product: products,
        variant: productVariants,
        session: stockCountSessions,
      })
      .from(stockCountItems)
      .leftJoin(products, eq(stockCountItems.productId, products.id))
      .leftJoin(productVariants, eq(stockCountItems.variantId, productVariants.id))
      .leftJoin(stockCountSessions, eq(stockCountItems.sessionId, stockCountSessions.id))
      .where(and(
        eq(stockCountItems.tenantId, tenantId),
        eq(stockCountItems.id, itemId),
        eq(stockCountItems.isActive, true)
      ))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const { item, product, variant, session } = result[0];
    
    return {
      ...item,
      expectedQuantity: parseFloat(item.expectedQuantity),
      countedQuantity: item.countedQuantity ? parseFloat(item.countedQuantity) : undefined,
      variance: item.variance ? parseFloat(item.variance) : undefined,
      product,
      variant,
      sessionNumber: session?.sessionNumber,
      sessionLocationId: session?.locationId,
    };
  }

  async findCountItems(tenantId: string, query: StockCountItemQueryDto): Promise<{
    items: StockCountItemWithProduct[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const db = this.drizzle.getDb();
    
    // Build where conditions
    const conditions = [
      eq(stockCountItems.tenantId, tenantId),
      eq(stockCountItems.sessionId, query.sessionId),
      eq(stockCountItems.isActive, true),
    ];

    if (query.status) {
      conditions.push(eq(stockCountItems.status, query.status));
    }

    if (query.productId) {
      conditions.push(eq(stockCountItems.productId, query.productId));
    }

    if (query.countedBy) {
      conditions.push(eq(stockCountItems.countedBy, query.countedBy));
    }

    if (query.hasVariance) {
      conditions.push(ne(stockCountItems.variance, '0'));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(stockCountItems)
      .where(whereClause);

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;

    // Get items with product info
    const result = await db
      .select({
        item: stockCountItems,
        product: products,
        variant: productVariants,
        session: stockCountSessions,
      })
      .from(stockCountItems)
      .leftJoin(products, eq(stockCountItems.productId, products.id))
      .leftJoin(productVariants, eq(stockCountItems.variantId, productVariants.id))
      .leftJoin(stockCountSessions, eq(stockCountItems.sessionId, stockCountSessions.id))
      .where(whereClause)
      .orderBy(asc(products.name))
      .limit(limit)
      .offset(offset);

    const itemsWithProducts = result.map(({ item, product, variant, session }) => ({
      ...item,
      expectedQuantity: parseFloat(item.expectedQuantity),
      countedQuantity: item.countedQuantity ? parseFloat(item.countedQuantity) : undefined,
      variance: item.variance ? parseFloat(item.variance) : undefined,
      product,
      variant,
      sessionNumber: session?.sessionNumber,
      sessionLocationId: session?.locationId,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return {
      items: itemsWithProducts,
      total: totalCount,
      page,
      limit,
      totalPages,
    };
  }

  async updateCountItem(
    tenantId: string,
    itemId: string,
    updates: UpdateCountItemDto,
    userId: string,
  ): Promise<StockCountItemWithProduct> {
    const db = this.drizzle.getDb();
    
    const updateData: any = {
      updatedBy: userId,
      updatedAt: new Date(),
      version: sql`${stockCountItems.version} + 1`,
    };

    if (updates.countedQuantity !== undefined) {
      updateData.countedQuantity = updates.countedQuantity.toString();
    }

    if (updates.variance !== undefined) {
      updateData.variance = updates.variance.toString();
    }

    if (updates.batchNumber !== undefined) {
      updateData.batchNumber = updates.batchNumber;
    }

    if (updates.binLocation !== undefined) {
      updateData.binLocation = updates.binLocation;
    }

    if (updates.countedBy !== undefined) {
      updateData.countedBy = updates.countedBy;
    }

    if (updates.countedAt !== undefined) {
      updateData.countedAt = updates.countedAt;
    }

    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }

    if (updates.adjustmentId !== undefined) {
      updateData.adjustmentId = updates.adjustmentId;
    }

    const [updated] = await db
      .update(stockCountItems)
      .set(updateData)
      .where(and(
        eq(stockCountItems.tenantId, tenantId),
        eq(stockCountItems.id, itemId),
        eq(stockCountItems.isActive, true)
      ))
      .returning();

    return this.findCountItemById(tenantId, updated.id);
  }

  async findVariances(tenantId: string, sessionId: string): Promise<StockCountItemWithProduct[]> {
    const db = this.drizzle.getDb();
    
    const result = await db
      .select({
        item: stockCountItems,
        product: products,
        variant: productVariants,
        session: stockCountSessions,
      })
      .from(stockCountItems)
      .leftJoin(products, eq(stockCountItems.productId, products.id))
      .leftJoin(productVariants, eq(stockCountItems.variantId, productVariants.id))
      .leftJoin(stockCountSessions, eq(stockCountItems.sessionId, stockCountSessions.id))
      .where(and(
        eq(stockCountItems.tenantId, tenantId),
        eq(stockCountItems.sessionId, sessionId),
        eq(stockCountItems.isActive, true),
        ne(stockCountItems.variance, '0')
      ))
      .orderBy(desc(sql`ABS(${stockCountItems.variance}::numeric)`));

    return result.map(({ item, product, variant, session }) => ({
      ...item,
      expectedQuantity: parseFloat(item.expectedQuantity),
      countedQuantity: item.countedQuantity ? parseFloat(item.countedQuantity) : undefined,
      variance: item.variance ? parseFloat(item.variance) : undefined,
      product,
      variant,
      sessionNumber: session?.sessionNumber,
      sessionLocationId: session?.locationId,
    }));
  }
}