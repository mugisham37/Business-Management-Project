import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { eq, and, desc, asc, count, sql, isNull } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { 
  warehouses, 
  warehouseZones, 
  binLocations
} from '../../database/schema/warehouse.schema';
import { 
  CreateWarehouseDto, 
  UpdateWarehouseDto, 
  WarehouseQueryDto,
  WarehouseCapacityDto,
  WarehouseStatus,
  LayoutType,
  SecurityLevel 
} from '../dto/warehouse.dto';

@Injectable()
export class WarehouseRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(tenantId: string, data: CreateWarehouseDto, userId: string): Promise<any> {
    // Check if warehouse code already exists for tenant
    const existing = await this.drizzle.getDb()
      .select()
      .from(warehouses)
      .where(
        and(
          eq(warehouses.tenantId, tenantId),
          eq(warehouses.warehouseCode, data.warehouseCode),
          isNull(warehouses.deletedAt)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Warehouse code already exists');
    }

    // Check if location is already assigned to another warehouse
    const locationExists = await this.drizzle.getDb()
      .select()
      .from(warehouses)
      .where(
        and(
          eq(warehouses.tenantId, tenantId),
          eq(warehouses.locationId, data.locationId),
          isNull(warehouses.deletedAt)
        )
      )
      .limit(1);

    if (locationExists.length > 0) {
      throw new ConflictException('Location is already assigned to another warehouse');
    }

    const [warehouse] = await this.drizzle.getDb()
      .insert(warehouses)
      .values({
        tenantId,
        locationId: data.locationId,
        warehouseCode: data.warehouseCode,
        name: data.name,
        description: data.description,
        totalSquareFootage: data.totalSquareFootage?.toString(),
        storageSquareFootage: data.storageSquareFootage?.toString(),
        ceilingHeight: data.ceilingHeight?.toString(),
        layoutType: data.layoutType || LayoutType.GRID,
        aisleConfiguration: data.aisleConfiguration || {},
        operatingHours: data.operatingHours || {},
        timezone: data.timezone || 'UTC',
        temperatureControlled: data.temperatureControlled || false,
        temperatureRange: data.temperatureRange || {},
        humidityControlled: data.humidityControlled || false,
        humidityRange: data.humidityRange || {},
        securityLevel: data.securityLevel || SecurityLevel.STANDARD,
        accessControlRequired: data.accessControlRequired || false,
        warehouseManagerId: data.warehouseManagerId,
        status: WarehouseStatus.ACTIVE,
        configuration: data.configuration || {},
        integrationSettings: data.integrationSettings || {},
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return warehouse;
  }

  async findById(tenantId: string, id: string): Promise<any> {
    const [warehouse] = await this.drizzle.getDb()
      .select()
      .from(warehouses)
      .where(
        and(
          eq(warehouses.tenantId, tenantId),
          eq(warehouses.id, id),
          isNull(warehouses.deletedAt)
        )
      )
      .limit(1);

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    return warehouse;
  }

  async findByCode(tenantId: string, warehouseCode: string): Promise<any> {
    const [warehouse] = await this.drizzle.getDb()
      .select()
      .from(warehouses)
      .where(
        and(
          eq(warehouses.tenantId, tenantId),
          eq(warehouses.warehouseCode, warehouseCode),
          isNull(warehouses.deletedAt)
        )
      )
      .limit(1);

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    return warehouse;
  }

  async findMany(tenantId: string, query: WarehouseQueryDto): Promise<{
    warehouses: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20, search, status, locationId, managerId, sortBy = 'name', sortOrder = 'asc' } = query;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [
      eq(warehouses.tenantId, tenantId),
      isNull(warehouses.deletedAt)
    ];

    if (search) {
      conditions.push(
        sql`(${warehouses.name} ILIKE ${`%${search}%`} OR ${warehouses.warehouseCode} ILIKE ${`%${search}%`})`
      );
    }

    if (status) {
      conditions.push(eq(warehouses.status, status));
    }

    if (locationId) {
      conditions.push(eq(warehouses.locationId, locationId));
    }

    if (managerId) {
      conditions.push(eq(warehouses.warehouseManagerId, managerId));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await this.drizzle.getDb()
      .select({ count: count() })
      .from(warehouses)
      .where(whereClause);

    const totalCount = countResult?.count || 0;

    // Get warehouses with sorting - use a safe column mapping
    const columnMap: Record<string, any> = {
      name: warehouses.name,
      warehouseCode: warehouses.warehouseCode,
      status: warehouses.status,
      createdAt: warehouses.createdAt,
      updatedAt: warehouses.updatedAt,
    };

    const sortColumn = columnMap[sortBy] || warehouses.name;
    const orderBy = sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn);
    
    const warehouseList = await this.drizzle.getDb()
      .select()
      .from(warehouses)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return {
      warehouses: warehouseList,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async update(tenantId: string, id: string, data: UpdateWarehouseDto, userId: string): Promise<any> {
    const warehouse = await this.findById(tenantId, id);

    // Check if warehouse code is being changed and if it conflicts
    if (data.name && data.name !== warehouse.name) {
      // Additional validation can be added here
    }

    const updateData: any = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    // Only update provided fields with proper type handling
    const numericFields = ['totalSquareFootage', 'storageSquareFootage', 'ceilingHeight'];
    
    Object.keys(data).forEach(key => {
      const value = (data as any)[key];
      if (value !== undefined) {
        if (numericFields.includes(key)) {
          updateData[key] = value?.toString();
        } else {
          updateData[key] = value;
        }
      }
    });

    const [updatedWarehouse] = await this.drizzle.getDb()
      .update(warehouses)
      .set(updateData)
      .where(
        and(
          eq(warehouses.tenantId, tenantId),
          eq(warehouses.id, id),
          isNull(warehouses.deletedAt)
        )
      )
      .returning();

    return updatedWarehouse;
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    await this.findById(tenantId, id);

    await this.drizzle.getDb()
      .update(warehouses)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        and(
          eq(warehouses.tenantId, tenantId),
          eq(warehouses.id, id),
          isNull(warehouses.deletedAt)
        )
      );
  }

  async getCapacity(tenantId: string, warehouseId: string): Promise<WarehouseCapacityDto> {
    const warehouse = await this.findById(tenantId, warehouseId);

    // Get bin location statistics
    const [binStats] = await this.drizzle.getDb()
      .select({
        totalBins: count(),
        occupiedBins: sql<number>`COUNT(CASE WHEN ${binLocations.status} = 'occupied' THEN 1 END)`,
        availableBins: sql<number>`COUNT(CASE WHEN ${binLocations.status} = 'available' THEN 1 END)`,
      })
      .from(binLocations)
      .where(
        and(
          eq(binLocations.tenantId, tenantId),
          eq(binLocations.warehouseId, warehouseId),
          isNull(binLocations.deletedAt)
        )
      );

    const totalCapacity = parseFloat(warehouse.maxCapacityUnits || '0');
    const usedCapacity = parseFloat(warehouse.currentCapacityUnits || '0');
    const availableCapacity = totalCapacity - usedCapacity;
    const utilizationPercentage = totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : 0;

    return {
      warehouseId,
      totalCapacity,
      usedCapacity,
      availableCapacity,
      utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
      totalBinLocations: binStats?.totalBins || 0,
      occupiedBinLocations: binStats?.occupiedBins || 0,
      availableBinLocations: binStats?.availableBins || 0,
    };
  }

  async updateCapacity(
    tenantId: string, 
    warehouseId: string, 
    capacityChange: number, 
    userId: string
  ): Promise<void> {
    const warehouse = await this.findById(tenantId, warehouseId);
    const currentCapacity = parseFloat(warehouse.currentCapacityUnits || '0');
    const newCapacity = currentCapacity + capacityChange;

    if (newCapacity < 0) {
      throw new ConflictException('Capacity cannot be negative');
    }

    const maxCapacity = parseFloat(warehouse.maxCapacityUnits || '0');
    if (maxCapacity > 0 && newCapacity > maxCapacity) {
      throw new ConflictException('Capacity exceeds maximum warehouse capacity');
    }

    await this.drizzle.getDb()
      .update(warehouses)
      .set({
        currentCapacityUnits: newCapacity.toString(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(warehouses.tenantId, tenantId),
          eq(warehouses.id, warehouseId),
          isNull(warehouses.deletedAt)
        )
      );
  }

  async updateBinLocationCounts(tenantId: string, warehouseId: string, userId: string): Promise<void> {
    // Get current bin location counts
    const [binStats] = await this.drizzle.getDb()
      .select({
        totalBins: count(),
        occupiedBins: sql<number>`COUNT(CASE WHEN ${binLocations.status} = 'occupied' THEN 1 END)`,
      })
      .from(binLocations)
      .where(
        and(
          eq(binLocations.tenantId, tenantId),
          eq(binLocations.warehouseId, warehouseId),
          isNull(binLocations.deletedAt)
        )
      );

    await this.drizzle.getDb()
      .update(warehouses)
      .set({
        totalBinLocations: binStats?.totalBins || 0,
        occupiedBinLocations: binStats?.occupiedBins || 0,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(warehouses.tenantId, tenantId),
          eq(warehouses.id, warehouseId),
          isNull(warehouses.deletedAt)
        )
      );
  }

  async findByLocationId(tenantId: string, locationId: string): Promise<any> {
    const [warehouse] = await this.drizzle.getDb()
      .select()
      .from(warehouses)
      .where(
        and(
          eq(warehouses.tenantId, tenantId),
          eq(warehouses.locationId, locationId),
          isNull(warehouses.deletedAt)
        )
      )
      .limit(1);

    return warehouse;
  }

  async findActiveWarehouses(tenantId: string): Promise<any[]> {
    return await this.drizzle.getDb()
      .select()
      .from(warehouses)
      .where(
        and(
          eq(warehouses.tenantId, tenantId),
          eq(warehouses.status, WarehouseStatus.ACTIVE),
          isNull(warehouses.deletedAt)
        )
      )
      .orderBy(asc(warehouses.name));
  }

  async getWarehouseMetrics(tenantId: string, warehouseId: string): Promise<any> {
    const warehouse = await this.findById(tenantId, warehouseId);
    
    // Get zone statistics
    const [zoneStats] = await this.drizzle.getDb()
      .select({
        totalZones: count(),
        activeZones: sql<number>`COUNT(CASE WHEN ${warehouseZones.status} = 'active' THEN 1 END)`,
      })
      .from(warehouseZones)
      .where(
        and(
          eq(warehouseZones.tenantId, tenantId),
          eq(warehouseZones.warehouseId, warehouseId),
          isNull(warehouseZones.deletedAt)
        )
      );

    // Get bin location statistics by status
    const binStatusStats = await this.drizzle.getDb()
      .select({
        status: binLocations.status,
        count: count(),
      })
      .from(binLocations)
      .where(
        and(
          eq(binLocations.tenantId, tenantId),
          eq(binLocations.warehouseId, warehouseId),
          isNull(binLocations.deletedAt)
        )
      )
      .groupBy(binLocations.status);

    return {
      warehouse,
      zones: {
        total: zoneStats?.totalZones || 0,
        active: zoneStats?.activeZones || 0,
      },
      binLocations: binStatusStats.reduce((acc, stat) => {
        if (stat.status) {
          acc[stat.status] = stat.count;
        }
        return acc;
      }, {} as Record<string, number>),
      capacity: await this.getCapacity(tenantId, warehouseId),
    };
  }
}