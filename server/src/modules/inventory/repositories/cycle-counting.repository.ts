import { Injectable, Inject } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { 
  stockCountSessions,
  stockCountItems,
  products,
  productVariants
} from '../../database/schema';
import { eq, and, gte, lte, desc, asc, sql, count, ne } from 'drizzle-orm';
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
  description: string | null;
  locationId: string;
  categoryIds: string[];
  productIds: string[];
  status: string | null;
  scheduledDate?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  assignedTo: string[];
  totalItemsCounted: number | null;
  totalVariances: number | null;
  totalAdjustmentValue: number;
  notes?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
  version: number;
}

export interface StockCountItemWithProduct {
  id: string;
  tenantId: string;
  sessionId: string;
  productId: string;
  variantId: string | null;
  expectedQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
  batchNumber?: string | null;
  binLocation?: string | null;
  countedBy?: string | null;
  countedAt?: Date | null;
  status: string | null;
  notes?: string | null;
  adjustmentId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
  version: number;
  product?: any;
  variant?: any;
  sessionNumber?: string | null;
  sessionLocationId?: string | null;
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

    if (!session) {
      throw new Error('Failed to create stock count session');
    }

    const result = await this.findSessionById(tenantId, session.id);
    if (!result) {
      throw new Error('Failed to create stock count session');
    }
    return result;
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
      categoryIds: Array.isArray(session.categoryIds) ? session.categoryIds : [],
      productIds: Array.isArray(session.productIds) ? session.productIds : [],
      assignedTo: Array.isArray(session.assignedTo) ? session.assignedTo : [],
      totalItemsCounted: session.totalItemsCounted ?? 0,
      totalVariances: session.totalVariances ?? 0,
      totalAdjustmentValue: parseFloat(session.totalAdjustmentValue || '0'),
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
      categoryIds: Array.isArray(session.categoryIds) ? session.categoryIds : [],
      productIds: Array.isArray(session.productIds) ? session.productIds : [],
      assignedTo: Array.isArray(session.assignedTo) ? session.assignedTo : [],
      totalItemsCounted: session.totalItemsCounted ?? 0,
      totalVariances: session.totalVariances ?? 0,
      totalAdjustmentValue: parseFloat(session.totalAdjustmentValue || '0'),
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
    const [countResult] = await db
      .select({ count: count() })
      .from(stockCountSessions)
      .where(whereClause);

    const totalCount = countResult?.count || 0;

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
      categoryIds: Array.isArray(session.categoryIds) ? session.categoryIds as string[] : [],
      productIds: Array.isArray(session.productIds) ? session.productIds as string[] : [],
      assignedTo: Array.isArray(session.assignedTo) ? session.assignedTo as string[] : [],
      totalItemsCounted: session.totalItemsCounted ?? 0,
      totalVariances: session.totalVariances ?? 0,
      totalAdjustmentValue: parseFloat(session.totalAdjustmentValue || '0'),
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

    if (!updated) {
      throw new Error('Session not found or could not be updated');
    }

    const result = await this.findSessionById(tenantId, updated.id);
    if (!result) {
      throw new Error('Failed to retrieve updated session');
    }
    return result;
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

    if (!item) {
      throw new Error('Failed to create count item');
    }

    const result = await this.findCountItemById(tenantId, item.id);
    if (!result) {
      throw new Error('Failed to create count item');
    }
    return result;
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

    const row = result[0];
    if (!row?.item) {
      return null;
    }

    const { item, product, variant, session } = row;
    
    return {
      ...item,
      expectedQuantity: parseFloat(item.expectedQuantity || '0'),
      countedQuantity: item.countedQuantity ? parseFloat(item.countedQuantity) : null,
      variance: item.variance ? parseFloat(item.variance) : null,
      status: item.status || 'pending',
      product,
      variant,
      sessionNumber: session?.sessionNumber || null,
      sessionLocationId: session?.locationId || null,
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
    const [countResult] = await db
      .select({ count: count() })
      .from(stockCountItems)
      .where(whereClause);

    const totalCount = countResult?.count || 0;

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
      expectedQuantity: parseFloat(item.expectedQuantity || '0'),
      countedQuantity: item.countedQuantity ? parseFloat(item.countedQuantity) : null,
      variance: item.variance ? parseFloat(item.variance) : null,
      status: item.status || 'pending',
      product,
      variant,
      sessionNumber: session?.sessionNumber || null,
      sessionLocationId: session?.locationId || null,
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

    if (!updated) {
      throw new Error('Count item not found or could not be updated');
    }

    const result = await this.findCountItemById(tenantId, updated.id);
    if (!result) {
      throw new Error('Failed to retrieve updated count item');
    }
    return result;
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
      expectedQuantity: parseFloat(item.expectedQuantity || '0'),
      countedQuantity: item.countedQuantity ? parseFloat(item.countedQuantity) : null,
      variance: item.variance ? parseFloat(item.variance) : null,
      status: item.status || 'pending',
      product,
      variant,
      sessionNumber: session?.sessionNumber || null,
      sessionLocationId: session?.locationId || null,
    }));
  }
}