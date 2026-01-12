import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { eq, and, desc, asc, count, sql, isNull, inArray, gte, lte } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { pickingWaves } from '../../database/schema/warehouse.schema';
import { 
  CreatePickingWaveDto, 
  UpdatePickingWaveDto, 
  PickingWaveQueryDto,
  WaveStatus 
} from '../dto/picking.dto';

@Injectable()
export class PickingWaveRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(tenantId: string, data: CreatePickingWaveDto, userId: string): Promise<any> {
    // Check if wave number already exists for tenant
    const existing = await this.drizzle.getDb()
      .select()
      .from(pickingWaves)
      .where(
        and(
          eq(pickingWaves.tenantId, tenantId),
          eq(pickingWaves.waveNumber, data.waveNumber),
          isNull(pickingWaves.deletedAt)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Wave number already exists');
    }

    const [wave] = await this.drizzle.getDb()
      .insert(pickingWaves)
      .values({
        tenantId,
        waveNumber: data.waveNumber,
        name: data.name,
        description: data.description,
        warehouseId: data.warehouseId,
        zoneIds: data.zoneIds || [],
        waveType: data.waveType || 'standard',
        priority: data.priority || 1,
        plannedStartTime: data.plannedStartTime ? new Date(data.plannedStartTime) : null,
        plannedEndTime: data.plannedEndTime ? new Date(data.plannedEndTime) : null,
        status: 'planned',
        totalOrders: 0,
        completedOrders: 0,
        totalLines: 0,
        completedLines: 0,
        assignedPickers: data.assignedPickers || [],
        configuration: data.configuration || {},
        notes: data.notes,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return wave;
  }

  async findById(tenantId: string, id: string): Promise<any> {
    const [wave] = await this.drizzle.getDb()
      .select()
      .from(pickingWaves)
      .where(
        and(
          eq(pickingWaves.tenantId, tenantId),
          eq(pickingWaves.id, id),
          isNull(pickingWaves.deletedAt)
        )
      )
      .limit(1);

    if (!wave) {
      throw new NotFoundException('Picking wave not found');
    }

    return wave;
  }

  async findByNumber(tenantId: string, waveNumber: string): Promise<any> {
    const [wave] = await this.drizzle.getDb()
      .select()
      .from(pickingWaves)
      .where(
        and(
          eq(pickingWaves.tenantId, tenantId),
          eq(pickingWaves.waveNumber, waveNumber),
          isNull(pickingWaves.deletedAt)
        )
      )
      .limit(1);

    if (!wave) {
      throw new NotFoundException('Picking wave not found');
    }

    return wave;
  }

  async findMany(tenantId: string, query: PickingWaveQueryDto): Promise<{
    waves: any[];
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
      status, 
      waveType, 
      assignedPickerId, 
      sortBy = 'plannedStartTime', 
      sortOrder = 'asc' 
    } = query;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [
      eq(pickingWaves.tenantId, tenantId),
      isNull(pickingWaves.deletedAt)
    ];

    if (search) {
      conditions.push(
        sql`(${pickingWaves.waveNumber} ILIKE ${`%${search}%`} OR ${pickingWaves.name} ILIKE ${`%${search}%`})`
      );
    }

    if (warehouseId) {
      conditions.push(eq(pickingWaves.warehouseId, warehouseId));
    }

    if (status) {
      conditions.push(eq(pickingWaves.status, status));
    }

    if (waveType) {
      conditions.push(eq(pickingWaves.waveType, waveType));
    }

    if (assignedPickerId) {
      conditions.push(
        sql`${assignedPickerId} = ANY(${pickingWaves.assignedPickers})`
      );
    }

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await this.drizzle.getDb()
      .select({ count: count() })
      .from(pickingWaves)
      .where(whereClause);

    const totalCount = countResult?.count || 0;

    // Get waves with sorting - use a safe column mapping
    const columnMap: Record<string, any> = {
      plannedStartTime: pickingWaves.plannedStartTime,
      waveNumber: pickingWaves.waveNumber,
      name: pickingWaves.name,
      status: pickingWaves.status,
      priority: pickingWaves.priority,
      createdAt: pickingWaves.createdAt,
    };

    const sortColumn = columnMap[sortBy] || pickingWaves.plannedStartTime;
    const orderBy = sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn);
    
    const waves = await this.drizzle.getDb()
      .select()
      .from(pickingWaves)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return {
      waves,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async findByWarehouse(tenantId: string, warehouseId: string): Promise<any[]> {
    return await this.drizzle.getDb()
      .select()
      .from(pickingWaves)
      .where(
        and(
          eq(pickingWaves.tenantId, tenantId),
          eq(pickingWaves.warehouseId, warehouseId),
          isNull(pickingWaves.deletedAt)
        )
      )
      .orderBy(desc(pickingWaves.plannedStartTime));
  }

  async findByStatus(tenantId: string, status: WaveStatus, warehouseId?: string): Promise<any[]> {
    const conditions = [
      eq(pickingWaves.tenantId, tenantId),
      eq(pickingWaves.status, status),
      isNull(pickingWaves.deletedAt)
    ];

    if (warehouseId) {
      conditions.push(eq(pickingWaves.warehouseId, warehouseId));
    }

    return await this.drizzle.getDb()
      .select()
      .from(pickingWaves)
      .where(and(...conditions))
      .orderBy(asc(pickingWaves.priority), asc(pickingWaves.plannedStartTime));
  }

  async findByPicker(tenantId: string, pickerId: string): Promise<any[]> {
    return await this.drizzle.getDb()
      .select()
      .from(pickingWaves)
      .where(
        and(
          eq(pickingWaves.tenantId, tenantId),
          sql`${pickerId} = ANY(${pickingWaves.assignedPickers})`,
          isNull(pickingWaves.deletedAt)
        )
      )
      .orderBy(desc(pickingWaves.plannedStartTime));
  }

  async findActiveWaves(tenantId: string, warehouseId?: string): Promise<any[]> {
    const conditions = [
      eq(pickingWaves.tenantId, tenantId),
      inArray(pickingWaves.status, ['released', 'in_progress']),
      isNull(pickingWaves.deletedAt)
    ];

    if (warehouseId) {
      conditions.push(eq(pickingWaves.warehouseId, warehouseId));
    }

    return await this.drizzle.getDb()
      .select()
      .from(pickingWaves)
      .where(and(...conditions))
      .orderBy(asc(pickingWaves.priority), asc(pickingWaves.plannedStartTime));
  }

  async update(tenantId: string, id: string, data: UpdatePickingWaveDto, userId: string): Promise<any> {
    await this.findById(tenantId, id);

    const updateData: any = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    // Only update provided fields
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.zoneIds !== undefined) updateData.zoneIds = data.zoneIds;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.plannedStartTime !== undefined) {
      updateData.plannedStartTime = data.plannedStartTime ? new Date(data.plannedStartTime) : null;
    }
    if (data.plannedEndTime !== undefined) {
      updateData.plannedEndTime = data.plannedEndTime ? new Date(data.plannedEndTime) : null;
    }
    if (data.assignedPickers !== undefined) updateData.assignedPickers = data.assignedPickers;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.configuration !== undefined) updateData.configuration = data.configuration;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const [updatedWave] = await this.drizzle.getDb()
      .update(pickingWaves)
      .set(updateData)
      .where(
        and(
          eq(pickingWaves.tenantId, tenantId),
          eq(pickingWaves.id, id),
          isNull(pickingWaves.deletedAt)
        )
      )
      .returning();

    return updatedWave;
  }

  async updateStatus(tenantId: string, id: string, status: WaveStatus, userId: string): Promise<any> {
    const updateData: any = {
      status,
      updatedBy: userId,
      updatedAt: new Date(),
    };

    // Set timing fields based on status
    if (status === WaveStatus.IN_PROGRESS) {
      updateData.actualStartTime = new Date();
    } else if (status === WaveStatus.COMPLETED || status === WaveStatus.CANCELLED) {
      updateData.actualEndTime = new Date();
    }

    const [updatedWave] = await this.drizzle.getDb()
      .update(pickingWaves)
      .set(updateData)
      .where(
        and(
          eq(pickingWaves.tenantId, tenantId),
          eq(pickingWaves.id, id),
          isNull(pickingWaves.deletedAt)
        )
      )
      .returning();

    return updatedWave;
  }

  async updateProgress(
    tenantId: string, 
    id: string, 
    totalOrders: number, 
    completedOrders: number,
    totalLines: number,
    completedLines: number,
    userId: string
  ): Promise<any> {
    const [updatedWave] = await this.drizzle.getDb()
      .update(pickingWaves)
      .set({
        totalOrders,
        completedOrders,
        totalLines,
        completedLines,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pickingWaves.tenantId, tenantId),
          eq(pickingWaves.id, id),
          isNull(pickingWaves.deletedAt)
        )
      )
      .returning();

    return updatedWave;
  }

  async updatePerformanceMetrics(
    tenantId: string,
    id: string,
    estimatedPickTime: number,
    actualPickTime: number,
    pickingAccuracy: number,
    userId: string
  ): Promise<any> {
    const [updatedWave] = await this.drizzle.getDb()
      .update(pickingWaves)
      .set({
        estimatedPickTime: estimatedPickTime.toString(),
        actualPickTime: actualPickTime.toString(),
        pickingAccuracy: pickingAccuracy.toString(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pickingWaves.tenantId, tenantId),
          eq(pickingWaves.id, id),
          isNull(pickingWaves.deletedAt)
        )
      )
      .returning();

    return updatedWave;
  }

  async assignPickers(tenantId: string, id: string, pickerIds: string[], userId: string): Promise<any> {
    const [updatedWave] = await this.drizzle.getDb()
      .update(pickingWaves)
      .set({
        assignedPickers: pickerIds,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pickingWaves.tenantId, tenantId),
          eq(pickingWaves.id, id),
          isNull(pickingWaves.deletedAt)
        )
      )
      .returning();

    return updatedWave;
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    const wave = await this.findById(tenantId, id);

    // Check if wave can be deleted (only planned waves)
    if (wave.status !== 'planned') {
      throw new ConflictException('Cannot delete wave that is not in planned status');
    }

    await this.drizzle.getDb()
      .update(pickingWaves)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        and(
          eq(pickingWaves.tenantId, tenantId),
          eq(pickingWaves.id, id),
          isNull(pickingWaves.deletedAt)
        )
      );
  }

  async getWaveStatistics(tenantId: string, warehouseId?: string, dateFrom?: Date, dateTo?: Date): Promise<any> {
    const conditions = [
      eq(pickingWaves.tenantId, tenantId),
      isNull(pickingWaves.deletedAt)
    ];

    if (warehouseId) {
      conditions.push(eq(pickingWaves.warehouseId, warehouseId));
    }

    if (dateFrom) {
      conditions.push(gte(pickingWaves.plannedStartTime, dateFrom));
    }

    if (dateTo) {
      conditions.push(lte(pickingWaves.plannedStartTime, dateTo));
    }

    // Get overall statistics
    const [overallStats] = await this.drizzle.getDb()
      .select({
        totalWaves: count(),
        totalOrders: sql<number>`SUM(${pickingWaves.totalOrders})`,
        totalLines: sql<number>`SUM(${pickingWaves.totalLines})`,
        completedWaves: sql<number>`COUNT(CASE WHEN ${pickingWaves.status} = 'completed' THEN 1 END)`,
        avgPickTime: sql<number>`AVG(CAST(${pickingWaves.actualPickTime} AS DECIMAL))`,
        avgAccuracy: sql<number>`AVG(CAST(${pickingWaves.pickingAccuracy} AS DECIMAL))`,
      })
      .from(pickingWaves)
      .where(and(...conditions));

    // Get statistics by status
    const statusStats = await this.drizzle.getDb()
      .select({
        status: pickingWaves.status,
        count: count(),
        avgPickTime: sql<number>`AVG(CAST(${pickingWaves.actualPickTime} AS DECIMAL))`,
      })
      .from(pickingWaves)
      .where(and(...conditions))
      .groupBy(pickingWaves.status);

    // Get statistics by wave type
    const typeStats = await this.drizzle.getDb()
      .select({
        waveType: pickingWaves.waveType,
        count: count(),
        avgPickTime: sql<number>`AVG(CAST(${pickingWaves.actualPickTime} AS DECIMAL))`,
      })
      .from(pickingWaves)
      .where(and(...conditions))
      .groupBy(pickingWaves.waveType);

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
      byType: typeStats.reduce((acc, stat) => {
        if (stat.waveType) {
          acc[stat.waveType] = {
            count: stat.count,
            avgPickTime: Math.round((stat.avgPickTime || 0) * 100) / 100,
          };
        }
        return acc;
      }, {} as Record<string, any>),
    };
  }

  async findOverdueWaves(tenantId: string, warehouseId?: string): Promise<any[]> {
    const conditions = [
      eq(pickingWaves.tenantId, tenantId),
      inArray(pickingWaves.status, ['planned', 'released', 'in_progress']),
      sql`${pickingWaves.plannedEndTime} < NOW()`,
      isNull(pickingWaves.deletedAt)
    ];

    if (warehouseId) {
      conditions.push(eq(pickingWaves.warehouseId, warehouseId));
    }

    return await this.drizzle.getDb()
      .select()
      .from(pickingWaves)
      .where(and(...conditions))
      .orderBy(asc(pickingWaves.plannedEndTime));
  }

  async generateWaveNumber(tenantId: string, warehouseId: string): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get the count of waves created today for this warehouse
    const [countResult] = await this.drizzle.getDb()
      .select({ count: count() })
      .from(pickingWaves)
      .where(
        and(
          eq(pickingWaves.tenantId, tenantId),
          eq(pickingWaves.warehouseId, warehouseId),
          sql`DATE(${pickingWaves.createdAt}) = CURRENT_DATE`,
          isNull(pickingWaves.deletedAt)
        )
      );

    const todayCount = countResult?.count || 0;
    const sequence = (todayCount + 1).toString().padStart(3, '0');
    return `W${today}${sequence}`;
  }
}