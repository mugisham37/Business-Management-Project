import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { eq, and, desc, asc, count, sql, isNull } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { 
  pickLists, 
  pickListItems
} from '../../database/schema/warehouse.schema';
import { 
  CreatePickListDto, 
  UpdatePickListDto, 
  PickListQueryDto,
  CreatePickListItemDto,
  UpdatePickListItemDto,
  PickListStatus 
} from '../dto/picking.dto';

@Injectable()
export class PickListRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(tenantId: string, data: CreatePickListDto, userId: string): Promise<any> {
    // Check if pick list number already exists for tenant
    const existing = await this.drizzle.getDb()
      .select()
      .from(pickLists)
      .where(
        and(
          eq(pickLists.tenantId, tenantId),
          eq(pickLists.pickListNumber, data.pickListNumber),
          isNull(pickLists.deletedAt)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Pick list number already exists');
    }

    const [pickList] = await this.drizzle.getDb()
      .insert(pickLists)
      .values({
        tenantId,
        pickListNumber: data.pickListNumber,
        waveId: data.waveId,
        warehouseId: data.warehouseId,
        assignedPickerId: data.assignedPickerId,
        orderIds: data.orderIds,
        pickingRoute: [],
        estimatedDistance: '0',
        estimatedTime: '0',
        status: 'pending',
        totalItems: 0,
        pickedItems: 0,
        totalQuantity: '0',
        pickedQuantity: '0',
        equipmentUsed: data.equipmentUsed || [],
        notes: data.notes,
        issues: [],
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    // Create pick list items if provided
    if (data.items && data.items.length > 0 && pickList) {
      await this.createItems(tenantId, pickList.id, data.items, userId);
    }

    return pickList;
  }

  async createItems(tenantId: string, pickListId: string, items: CreatePickListItemDto[], userId: string): Promise<any[]> {
    const itemsToCreate = items.map(item => ({
      tenantId,
      pickListId,
      productId: item.productId,
      variantId: item.variantId,
      binLocationId: item.binLocationId,
      requestedQuantity: item.requestedQuantity.toString(),
      pickedQuantity: '0',
      batchNumber: item.batchNumber,
      lotNumber: item.lotNumber,
      expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
      pickingSequence: item.pickingSequence,
      status: 'pending',
      qualityCheck: false,
      orderLineId: item.orderLineId,
      notes: item.notes,
      issues: [],
      createdBy: userId,
      updatedBy: userId,
    }));

    const createdItems = await this.drizzle.getDb()
      .insert(pickListItems)
      .values(itemsToCreate)
      .returning();

    // Update pick list totals
    await this.updatePickListTotals(tenantId, pickListId, userId);

    return createdItems;
  }

  async findById(tenantId: string, id: string): Promise<any> {
    const [pickList] = await this.drizzle.getDb()
      .select()
      .from(pickLists)
      .where(
        and(
          eq(pickLists.tenantId, tenantId),
          eq(pickLists.id, id),
          isNull(pickLists.deletedAt)
        )
      )
      .limit(1);

    if (!pickList) {
      throw new NotFoundException('Pick list not found');
    }

    return pickList;
  }

  async findByNumber(tenantId: string, pickListNumber: string): Promise<any> {
    const [pickList] = await this.drizzle.getDb()
      .select()
      .from(pickLists)
      .where(
        and(
          eq(pickLists.tenantId, tenantId),
          eq(pickLists.pickListNumber, pickListNumber),
          isNull(pickLists.deletedAt)
        )
      )
      .limit(1);

    if (!pickList) {
      throw new NotFoundException('Pick list not found');
    }

    return pickList;
  }

  async findMany(tenantId: string, query: PickListQueryDto): Promise<{
    pickLists: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      warehouseId, 
      waveId, 
      status, 
      assignedPickerId, 
      sortBy = 'assignedAt', 
      sortOrder = 'asc' 
    } = query;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [
      eq(pickLists.tenantId, tenantId),
      isNull(pickLists.deletedAt)
    ];

    if (search) {
      conditions.push(
        sql`${pickLists.pickListNumber} ILIKE ${`%${search}%`}`
      );
    }

    if (warehouseId) {
      conditions.push(eq(pickLists.warehouseId, warehouseId));
    }

    if (waveId) {
      conditions.push(eq(pickLists.waveId, waveId));
    }

    if (status) {
      conditions.push(eq(pickLists.status, status));
    }

    if (assignedPickerId) {
      conditions.push(eq(pickLists.assignedPickerId, assignedPickerId));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await this.drizzle.getDb()
      .select({ count: count() })
      .from(pickLists)
      .where(whereClause);

    const totalCount = countResult?.count || 0;

    // Get pick lists with sorting - use a safe column mapping
    const columnMap: Record<string, any> = {
      assignedAt: pickLists.assignedAt,
      pickListNumber: pickLists.pickListNumber,
      status: pickLists.status,
      createdAt: pickLists.createdAt,
      startedAt: pickLists.startedAt,
      completedAt: pickLists.completedAt,
    };

    const sortColumn = columnMap[sortBy] || pickLists.assignedAt;
    const orderBy = sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn);
    
    const pickListsResult = await this.drizzle.getDb()
      .select()
      .from(pickLists)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return {
      pickLists: pickListsResult,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async findByWave(tenantId: string, waveId: string): Promise<any[]> {
    return await this.drizzle.getDb()
      .select()
      .from(pickLists)
      .where(
        and(
          eq(pickLists.tenantId, tenantId),
          eq(pickLists.waveId, waveId),
          isNull(pickLists.deletedAt)
        )
      )
      .orderBy(asc(pickLists.assignedAt));
  }

  async findByPicker(tenantId: string, pickerId: string, status?: PickListStatus): Promise<any[]> {
    const conditions = [
      eq(pickLists.tenantId, tenantId),
      eq(pickLists.assignedPickerId, pickerId),
      isNull(pickLists.deletedAt)
    ];

    if (status) {
      conditions.push(eq(pickLists.status, status));
    }

    return await this.drizzle.getDb()
      .select()
      .from(pickLists)
      .where(and(...conditions))
      .orderBy(desc(pickLists.assignedAt));
  }

  async findByWarehouse(tenantId: string, warehouseId: string, status?: PickListStatus): Promise<any[]> {
    const conditions = [
      eq(pickLists.tenantId, tenantId),
      eq(pickLists.warehouseId, warehouseId),
      isNull(pickLists.deletedAt)
    ];

    if (status) {
      conditions.push(eq(pickLists.status, status));
    }

    return await this.drizzle.getDb()
      .select()
      .from(pickLists)
      .where(and(...conditions))
      .orderBy(desc(pickLists.assignedAt));
  }

  async findItems(tenantId: string, pickListId: string): Promise<any[]> {
    return await this.drizzle.getDb()
      .select()
      .from(pickListItems)
      .where(
        and(
          eq(pickListItems.tenantId, tenantId),
          eq(pickListItems.pickListId, pickListId),
          isNull(pickListItems.deletedAt)
        )
      )
      .orderBy(asc(pickListItems.pickingSequence));
  }

  async findItemById(tenantId: string, itemId: string): Promise<any> {
    const [item] = await this.drizzle.getDb()
      .select()
      .from(pickListItems)
      .where(
        and(
          eq(pickListItems.tenantId, tenantId),
          eq(pickListItems.id, itemId),
          isNull(pickListItems.deletedAt)
        )
      )
      .limit(1);

    if (!item) {
      throw new NotFoundException('Pick list item not found');
    }

    return item;
  }

  async update(tenantId: string, id: string, data: UpdatePickListDto, userId: string): Promise<any> {
    const pickList = await this.findById(tenantId, id);

    const updateData: any = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    // Only update provided fields
    if (data.assignedPickerId !== undefined) updateData.assignedPickerId = data.assignedPickerId;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.actualDistance !== undefined) updateData.actualDistance = data.actualDistance.toString();
    if (data.actualTime !== undefined) updateData.actualTime = data.actualTime.toString();
    if (data.pickingAccuracy !== undefined) updateData.pickingAccuracy = data.pickingAccuracy.toString();
    if (data.equipmentUsed !== undefined) updateData.equipmentUsed = data.equipmentUsed;
    if (data.issues !== undefined) updateData.issues = data.issues;
    if (data.notes !== undefined) updateData.notes = data.notes;

    // Set timing fields based on status
    if (data.status === PickListStatus.IN_PROGRESS && !pickList.startedAt) {
      updateData.startedAt = new Date();
    } else if (data.status === PickListStatus.COMPLETED && !pickList.completedAt) {
      updateData.completedAt = new Date();
    }

    const [updatedPickList] = await this.drizzle.getDb()
      .update(pickLists)
      .set(updateData)
      .where(
        and(
          eq(pickLists.tenantId, tenantId),
          eq(pickLists.id, id),
          isNull(pickLists.deletedAt)
        )
      )
      .returning();

    return updatedPickList;
  }

  async updateItem(tenantId: string, itemId: string, data: UpdatePickListItemDto, userId: string): Promise<any> {
    const item = await this.findItemById(tenantId, itemId);

    const updateData: any = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    // Only update provided fields
    if (data.pickedQuantity !== undefined) updateData.pickedQuantity = data.pickedQuantity.toString();
    if (data.status !== undefined) updateData.status = data.status;
    if (data.qualityCheck !== undefined) updateData.qualityCheck = data.qualityCheck;
    if (data.qualityNotes !== undefined) updateData.qualityNotes = data.qualityNotes;
    if (data.shortPickReason !== undefined) updateData.shortPickReason = data.shortPickReason;
    if (data.issues !== undefined) updateData.issues = data.issues;
    if (data.notes !== undefined) updateData.notes = data.notes;

    // Set picked timestamp if item is being picked
    if (data.status === 'picked' && !item.pickedAt) {
      updateData.pickedAt = new Date();
    }

    const [updatedItem] = await this.drizzle.getDb()
      .update(pickListItems)
      .set(updateData)
      .where(
        and(
          eq(pickListItems.tenantId, tenantId),
          eq(pickListItems.id, itemId),
          isNull(pickListItems.deletedAt)
        )
      )
      .returning();

    // Update pick list totals
    await this.updatePickListTotals(tenantId, item.pickListId, userId);

    return updatedItem;
  }

  async updateStatus(tenantId: string, id: string, status: PickListStatus, userId: string): Promise<any> {
    return await this.update(tenantId, id, { status }, userId);
  }

  async assignPicker(tenantId: string, id: string, pickerId: string, userId: string): Promise<any> {
    const updateData: any = {
      assignedPickerId: pickerId,
      assignedAt: new Date(),
      status: 'assigned',
      updatedBy: userId,
      updatedAt: new Date(),
    };

    const [updatedPickList] = await this.drizzle.getDb()
      .update(pickLists)
      .set(updateData)
      .where(
        and(
          eq(pickLists.tenantId, tenantId),
          eq(pickLists.id, id),
          isNull(pickLists.deletedAt)
        )
      )
      .returning();

    return updatedPickList;
  }

  async updatePickingRoute(tenantId: string, id: string, route: any[], estimatedDistance: number, estimatedTime: number, userId: string): Promise<any> {
    const [updatedPickList] = await this.drizzle.getDb()
      .update(pickLists)
      .set({
        pickingRoute: route,
        estimatedDistance: estimatedDistance.toString(),
        estimatedTime: estimatedTime.toString(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pickLists.tenantId, tenantId),
          eq(pickLists.id, id),
          isNull(pickLists.deletedAt)
        )
      )
      .returning();

    return updatedPickList;
  }

  async updatePickListTotals(tenantId: string, pickListId: string, userId: string): Promise<void> {
    // Get totals from pick list items
    const [totals] = await this.drizzle.getDb()
      .select({
        totalItems: count(),
        pickedItems: sql<number>`COUNT(CASE WHEN ${pickListItems.status} = 'picked' THEN 1 END)`,
        totalQuantity: sql<number>`SUM(CAST(${pickListItems.requestedQuantity} AS DECIMAL))`,
        pickedQuantity: sql<number>`SUM(CAST(${pickListItems.pickedQuantity} AS DECIMAL))`,
      })
      .from(pickListItems)
      .where(
        and(
          eq(pickListItems.tenantId, tenantId),
          eq(pickListItems.pickListId, pickListId),
          isNull(pickListItems.deletedAt)
        )
      );

    await this.drizzle.getDb()
      .update(pickLists)
      .set({
        totalItems: totals?.totalItems || 0,
        pickedItems: totals?.pickedItems || 0,
        totalQuantity: (totals?.totalQuantity || 0).toString(),
        pickedQuantity: (totals?.pickedQuantity || 0).toString(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pickLists.tenantId, tenantId),
          eq(pickLists.id, pickListId),
          isNull(pickLists.deletedAt)
        )
      );
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    const pickList = await this.findById(tenantId, id);

    // Check if pick list can be deleted (only pending or assigned)
    if (!['pending', 'assigned'].includes(pickList.status)) {
      throw new ConflictException('Cannot delete pick list that is in progress or completed');
    }

    // Soft delete pick list items first
    await this.drizzle.getDb()
      .update(pickListItems)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        and(
          eq(pickListItems.tenantId, tenantId),
          eq(pickListItems.pickListId, id),
          isNull(pickListItems.deletedAt)
        )
      );

    // Soft delete pick list
    await this.drizzle.getDb()
      .update(pickLists)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        and(
          eq(pickLists.tenantId, tenantId),
          eq(pickLists.id, id),
          isNull(pickLists.deletedAt)
        )
      );
  }

  async getPickListStatistics(tenantId: string, warehouseId?: string, pickerId?: string, dateFrom?: Date, dateTo?: Date): Promise<any> {
    const conditions = [
      eq(pickLists.tenantId, tenantId),
      isNull(pickLists.deletedAt)
    ];

    if (warehouseId) {
      conditions.push(eq(pickLists.warehouseId, warehouseId));
    }

    if (pickerId) {
      conditions.push(eq(pickLists.assignedPickerId, pickerId));
    }

    if (dateFrom) {
      conditions.push(sql`${pickLists.assignedAt} >= ${dateFrom}`);
    }

    if (dateTo) {
      conditions.push(sql`${pickLists.assignedAt} <= ${dateTo}`);
    }

    // Get overall statistics
    const [overallStats] = await this.drizzle.getDb()
      .select({
        totalPickLists: count(),
        completedPickLists: sql<number>`COUNT(CASE WHEN ${pickLists.status} = 'completed' THEN 1 END)`,
        totalItems: sql<number>`SUM(${pickLists.totalItems})`,
        totalPickedItems: sql<number>`SUM(${pickLists.pickedItems})`,
        avgPickTime: sql<number>`AVG(CAST(${pickLists.actualTime} AS DECIMAL))`,
        avgAccuracy: sql<number>`AVG(CAST(${pickLists.pickingAccuracy} AS DECIMAL))`,
        avgDistance: sql<number>`AVG(CAST(${pickLists.actualDistance} AS DECIMAL))`,
      })
      .from(pickLists)
      .where(and(...conditions));

    // Get statistics by status
    const statusStats = await this.drizzle.getDb()
      .select({
        status: pickLists.status,
        count: count(),
        avgPickTime: sql<number>`AVG(CAST(${pickLists.actualTime} AS DECIMAL))`,
      })
      .from(pickLists)
      .where(and(...conditions))
      .groupBy(pickLists.status);

    return {
      overall: overallStats,
      byStatus: statusStats.reduce((acc, stat) => {
        if (stat.status) {
          acc[stat.status] = {
            count: stat.count,
            avgPickTime: Math.round((stat.avgPickTime || 0) * 100) / 100,
          };
        }
        return acc;
      }, {} as Record<string, any>),
    };
  }

  async generatePickListNumber(tenantId: string, warehouseId: string): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get the count of pick lists created today for this warehouse
    const [countResult] = await this.drizzle.getDb()
      .select({ count: count() })
      .from(pickLists)
      .where(
        and(
          eq(pickLists.tenantId, tenantId),
          eq(pickLists.warehouseId, warehouseId),
          sql`DATE(${pickLists.createdAt}) = CURRENT_DATE`,
          isNull(pickLists.deletedAt)
        )
      );

    const todayCount = countResult?.count || 0;
    const sequence = (todayCount + 1).toString().padStart(4, '0');
    return `PL${today}${sequence}`;
  }
}