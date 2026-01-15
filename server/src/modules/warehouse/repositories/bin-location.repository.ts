import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { eq, and, desc, asc, count, sql, isNull, inArray } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { binLocations, binLocationStatusEnum } from '../../database/schema/warehouse.schema';
import { 
  CreateBinLocationDto, 
  UpdateBinLocationDto, 
  BinLocationQueryDto,
  BulkCreateBinLocationsDto,
  BinLocationStatus 
} from '../dto/warehouse.dto';

@Injectable()
export class BinLocationRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(tenantId: string, data: CreateBinLocationDto, userId: string): Promise<any> {
    // Check if bin code already exists in warehouse
    const existing = await this.drizzle.getDb()
      .select()
      .from(binLocations)
      .where(
        and(
          eq(binLocations.tenantId, tenantId),
          eq(binLocations.warehouseId, data.warehouseId),
          eq(binLocations.binCode, data.binCode),
          isNull(binLocations.deletedAt)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Bin code already exists in this warehouse');
    }

    // Calculate volume if dimensions are provided
    let volume: number | undefined;
    if (data.length && data.width && data.height) {
      volume = data.length * data.width * data.height;
    }

    const [binLocation] = await this.drizzle.getDb()
      .insert(binLocations)
      .values({
        tenantId,
        zoneId: data.zoneId,
        warehouseId: data.warehouseId,
        binCode: data.binCode,
        displayName: data.displayName,
        aisle: data.aisle,
        bay: data.bay,
        level: data.level,
        position: data.position,
        xCoordinate: data.xCoordinate?.toString(),
        yCoordinate: data.yCoordinate?.toString(),
        zCoordinate: data.zCoordinate?.toString(),
        length: data.length?.toString(),
        width: data.width?.toString(),
        height: data.height?.toString(),
        volume: volume?.toString(),
        maxWeight: data.maxWeight?.toString(),
        status: BinLocationStatus.AVAILABLE,
        occupancyPercentage: '0',
        currentWeight: '0',
        allowedProductTypes: data.allowedProductTypes || [],
        restrictedProductTypes: data.restrictedProductTypes || [],
        temperatureControlled: data.temperatureControlled || false,
        temperatureRange: data.temperatureRange || {},
        hazmatApproved: data.hazmatApproved || false,
        pickingSequence: data.pickingSequence,
        accessEquipment: data.accessEquipment || [],
        assignedProductId: data.assignedProductId,
        assignedVariantId: data.assignedVariantId,
        dedicatedProduct: data.dedicatedProduct || false,
        configuration: data.configuration || {},
        notes: data.notes,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return binLocation;
  }

  async bulkCreate(tenantId: string, data: BulkCreateBinLocationsDto, userId: string): Promise<any[]> {
    const binLocationsToCreate = [];
    
    for (let aisle = 1; aisle <= data.aisleCount; aisle++) {
      const aisleCode = `${data.aislePrefix}${aisle.toString().padStart(2, '0')}`;
      
      for (let bay = 1; bay <= data.bayCount; bay++) {
        const bayCode = bay.toString().padStart(2, '0');
        
        for (let level = 1; level <= data.levelCount; level++) {
          const levelCode = level.toString().padStart(2, '0');
          
          const binCode = `${aisleCode}-${bayCode}-${levelCode}`;
          const displayName = `${aisleCode}-${bayCode}-${levelCode}`;
          
          // Calculate volume if dimensions are provided
          let volume: number | undefined;
          if (data.dimensions?.length && data.dimensions?.width && data.dimensions?.height) {
            volume = data.dimensions.length * data.dimensions.width * data.dimensions.height;
          }

          binLocationsToCreate.push({
            tenantId,
            zoneId: data.zoneId,
            warehouseId: data.warehouseId,
            binCode,
            displayName,
            aisle: aisleCode,
            bay: bayCode,
            level: levelCode,
            position: '01',
            length: data.dimensions?.length?.toString(),
            width: data.dimensions?.width?.toString(),
            height: data.dimensions?.height?.toString(),
            volume: volume?.toString(),
            maxWeight: data.dimensions?.maxWeight?.toString(),
            status: BinLocationStatus.AVAILABLE,
            occupancyPercentage: '0',
            currentWeight: '0',
            allowedProductTypes: [],
            restrictedProductTypes: [],
            temperatureControlled: false,
            temperatureRange: {},
            hazmatApproved: false,
            pickingSequence: (aisle - 1) * data.bayCount * data.levelCount + (bay - 1) * data.levelCount + level,
            accessEquipment: [],
            dedicatedProduct: false,
            configuration: data.defaultConfiguration || {},
            createdBy: userId,
            updatedBy: userId,
          });
        }
      }
    }

    // Insert in batches to avoid query size limits
    const batchSize = 100;
    const createdBinLocations = [];
    
    for (let i = 0; i < binLocationsToCreate.length; i += batchSize) {
      const batch = binLocationsToCreate.slice(i, i + batchSize);
      const batchResult = await this.drizzle.getDb()
        .insert(binLocations)
        .values(batch)
        .returning();
      
      createdBinLocations.push(...batchResult);
    }

    return createdBinLocations;
  }

  async findById(tenantId: string, id: string): Promise<any> {
    const [binLocation] = await this.drizzle.getDb()
      .select()
      .from(binLocations)
      .where(
        and(
          eq(binLocations.tenantId, tenantId),
          eq(binLocations.id, id),
          isNull(binLocations.deletedAt)
        )
      )
      .limit(1);

    if (!binLocation) {
      throw new NotFoundException('Bin location not found');
    }

    return binLocation;
  }

  async findByCode(tenantId: string, warehouseId: string, binCode: string): Promise<any> {
    const [binLocation] = await this.drizzle.getDb()
      .select()
      .from(binLocations)
      .where(
        and(
          eq(binLocations.tenantId, tenantId),
          eq(binLocations.warehouseId, warehouseId),
          eq(binLocations.binCode, binCode),
          isNull(binLocations.deletedAt)
        )
      )
      .limit(1);

    if (!binLocation) {
      throw new NotFoundException('Bin location not found');
    }

    return binLocation;
  }

  async findMany(tenantId: string, query: BinLocationQueryDto): Promise<{
    binLocations: any[];
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
      zoneId, 
      status, 
      aisle, 
      assignedProductId, 
      sortBy = 'binCode', 
      sortOrder = 'asc' 
    } = query;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [
      eq(binLocations.tenantId, tenantId),
      isNull(binLocations.deletedAt)
    ];

    if (search) {
      conditions.push(
        sql`(${binLocations.binCode} ILIKE ${`%${search}%`} OR ${binLocations.displayName} ILIKE ${`%${search}%`})`
      );
    }

    if (warehouseId) {
      conditions.push(eq(binLocations.warehouseId, warehouseId));
    }

    if (zoneId) {
      conditions.push(eq(binLocations.zoneId, zoneId));
    }

    if (status) {
      conditions.push(eq(binLocations.status, status));
    }

    if (aisle) {
      conditions.push(eq(binLocations.aisle, aisle));
    }

    if (assignedProductId) {
      conditions.push(eq(binLocations.assignedProductId, assignedProductId));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await this.drizzle.getDb()
      .select({ count: count() })
      .from(binLocations)
      .where(whereClause);

    const totalCount = countResult?.count || 0;

    // Get bin locations with sorting - use a safe column mapping
    const columnMap: Record<string, any> = {
      binCode: binLocations.binCode,
      displayName: binLocations.displayName,
      status: binLocations.status,
      aisle: binLocations.aisle,
      pickingSequence: binLocations.pickingSequence,
      createdAt: binLocations.createdAt,
      updatedAt: binLocations.updatedAt,
    };

    const sortColumn = columnMap[sortBy] || binLocations.binCode;
    const orderBy = sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn);
    
    const binLocationList = await this.drizzle.getDb()
      .select()
      .from(binLocations)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return {
      binLocations: binLocationList,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async findByZone(tenantId: string, zoneId: string): Promise<any[]> {
    return await this.drizzle.getDb()
      .select()
      .from(binLocations)
      .where(
        and(
          eq(binLocations.tenantId, tenantId),
          eq(binLocations.zoneId, zoneId),
          isNull(binLocations.deletedAt)
        )
      )
      .orderBy(asc(binLocations.pickingSequence), asc(binLocations.binCode));
  }

  async findByWarehouse(tenantId: string, warehouseId: string): Promise<any[]> {
    return await this.drizzle.getDb()
      .select()
      .from(binLocations)
      .where(
        and(
          eq(binLocations.tenantId, tenantId),
          eq(binLocations.warehouseId, warehouseId),
          isNull(binLocations.deletedAt)
        )
      )
      .orderBy(asc(binLocations.pickingSequence), asc(binLocations.binCode));
  }

  async findAvailable(tenantId: string, warehouseId: string, zoneId?: string): Promise<any[]> {
    const conditions = [
      eq(binLocations.tenantId, tenantId),
      eq(binLocations.warehouseId, warehouseId),
      eq(binLocations.status, BinLocationStatus.AVAILABLE),
      isNull(binLocations.deletedAt)
    ];

    if (zoneId) {
      conditions.push(eq(binLocations.zoneId, zoneId));
    }

    return await this.drizzle.getDb()
      .select()
      .from(binLocations)
      .where(and(...conditions))
      .orderBy(asc(binLocations.pickingSequence), asc(binLocations.binCode));
  }

  async findByProduct(tenantId: string, productId: string, variantId?: string): Promise<any[]> {
    const conditions = [
      eq(binLocations.tenantId, tenantId),
      eq(binLocations.assignedProductId, productId),
      isNull(binLocations.deletedAt)
    ];

    if (variantId) {
      conditions.push(eq(binLocations.assignedVariantId, variantId));
    }

    return await this.drizzle.getDb()
      .select()
      .from(binLocations)
      .where(and(...conditions))
      .orderBy(asc(binLocations.pickingSequence), asc(binLocations.binCode));
  }

  async update(tenantId: string, id: string, data: UpdateBinLocationDto, userId: string): Promise<any> {
    const binLocation = await this.findById(tenantId, id);

    const updateData: any = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    // Only update provided fields with proper type handling
    const numericFields = ['xCoordinate', 'yCoordinate', 'zCoordinate', 'length', 'width', 'height', 'maxWeight', 'currentWeight', 'occupancyPercentage'];
    
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

    // Recalculate volume if dimensions changed
    if (data.length !== undefined || data.width !== undefined || data.height !== undefined) {
      const length = data.length ?? parseFloat(binLocation.length || '0');
      const width = data.width ?? parseFloat(binLocation.width || '0');
      const height = data.height ?? parseFloat(binLocation.height || '0');
      
      if (length && width && height) {
        updateData.volume = (length * width * height).toString();
      }
    }

    const [updatedBinLocation] = await this.drizzle.getDb()
      .update(binLocations)
      .set(updateData)
      .where(
        and(
          eq(binLocations.tenantId, tenantId),
          eq(binLocations.id, id),
          isNull(binLocations.deletedAt)
        )
      )
      .returning();

    return updatedBinLocation;
  }

  async updateStatus(tenantId: string, id: string, status: BinLocationStatus, userId: string): Promise<any> {
    return await this.update(tenantId, id, { status }, userId);
  }

  async assignProduct(
    tenantId: string, 
    id: string, 
    productId: string, 
    variantId: string | null, 
    dedicated: boolean,
    userId: string
  ): Promise<any> {
    const updateData: UpdateBinLocationDto = {
      assignedProductId: productId,
      dedicatedProduct: dedicated,
      status: BinLocationStatus.OCCUPIED,
    };
    
    if (variantId) {
      updateData.assignedVariantId = variantId;
    }
    
    return await this.update(tenantId, id, updateData, userId);
  }

  async unassignProduct(tenantId: string, id: string, userId: string): Promise<any> {
    const updateData: UpdateBinLocationDto = {
      dedicatedProduct: false,
      status: BinLocationStatus.AVAILABLE,
      occupancyPercentage: 0,
      currentWeight: 0,
    };
    
    return await this.update(tenantId, id, updateData, userId);
  }

  async updateOccupancy(
    tenantId: string, 
    id: string, 
    occupancyPercentage: number, 
    currentWeight: number,
    userId: string
  ): Promise<any> {
    const status = occupancyPercentage > 0 ? BinLocationStatus.OCCUPIED : BinLocationStatus.AVAILABLE;
    
    return await this.update(tenantId, id, {
      occupancyPercentage,
      currentWeight,
      status,
    }, userId);
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    const binLocation = await this.findById(tenantId, id);

    // Check if bin location is occupied
    if (binLocation.status === BinLocationStatus.OCCUPIED) {
      throw new ConflictException('Cannot delete occupied bin location');
    }

    await this.drizzle.getDb()
      .update(binLocations)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        and(
          eq(binLocations.tenantId, tenantId),
          eq(binLocations.id, id),
          isNull(binLocations.deletedAt)
        )
      );
  }

  async findOptimalBinLocation(
    tenantId: string,
    warehouseId: string,
    productId: string,
    variantId: string | null,
    requiredVolume?: number,
    requiredWeight?: number,
    zoneType?: string
  ): Promise<any | null> {
    // This is a simplified implementation of bin location optimization
    // In a real system, this would consider factors like:
    // - Product velocity (fast-moving items closer to picking areas)
    // - Product compatibility
    // - Zone restrictions
    // - Picking route optimization
    
    const conditions = [
      eq(binLocations.tenantId, tenantId),
      eq(binLocations.warehouseId, warehouseId),
      eq(binLocations.status, BinLocationStatus.AVAILABLE),
      isNull(binLocations.deletedAt)
    ];

    // Add volume constraint if specified
    if (requiredVolume) {
      conditions.push(sql`CAST(${binLocations.volume} AS DECIMAL) >= ${requiredVolume}`);
    }

    // Add weight constraint if specified
    if (requiredWeight) {
      conditions.push(sql`CAST(${binLocations.maxWeight} AS DECIMAL) >= ${requiredWeight}`);
    }

    const [optimalBin] = await this.drizzle.getDb()
      .select()
      .from(binLocations)
      .where(and(...conditions))
      .orderBy(asc(binLocations.pickingSequence))
      .limit(1);

    return optimalBin || null;
  }

  async getPickingRoute(tenantId: string, warehouseId: string, binLocationIds: string[]): Promise<any[]> {
    if (binLocationIds.length === 0) {
      return [];
    }

    return await this.drizzle.getDb()
      .select()
      .from(binLocations)
      .where(
        and(
          eq(binLocations.tenantId, tenantId),
          eq(binLocations.warehouseId, warehouseId),
          inArray(binLocations.id, binLocationIds),
          isNull(binLocations.deletedAt)
        )
      )
      .orderBy(asc(binLocations.pickingSequence));
  }

  async getBinLocationMetrics(tenantId: string, warehouseId: string, zoneId?: string): Promise<any> {
    const conditions = [
      eq(binLocations.tenantId, tenantId),
      eq(binLocations.warehouseId, warehouseId),
      isNull(binLocations.deletedAt)
    ];

    if (zoneId) {
      conditions.push(eq(binLocations.zoneId, zoneId));
    }

    // Get bin location statistics by status
    const statusStats = await this.drizzle.getDb()
      .select({
        status: binLocations.status,
        count: count(),
        avgOccupancy: sql<number>`AVG(CAST(${binLocations.occupancyPercentage} AS DECIMAL))`,
      })
      .from(binLocations)
      .where(and(...conditions))
      .groupBy(binLocations.status);

    // Get overall statistics
    const [overallStats] = await this.drizzle.getDb()
      .select({
        totalBins: count(),
        totalVolume: sql<number>`SUM(CAST(${binLocations.volume} AS DECIMAL))`,
        totalWeight: sql<number>`SUM(CAST(${binLocations.maxWeight} AS DECIMAL))`,
        avgOccupancy: sql<number>`AVG(CAST(${binLocations.occupancyPercentage} AS DECIMAL))`,
      })
      .from(binLocations)
      .where(and(...conditions));

    return {
      overall: overallStats,
      byStatus: statusStats.reduce((acc, stat) => {
        if (stat.status) {
          acc[stat.status] = {
            count: stat.count,
            avgOccupancy: Math.round((stat.avgOccupancy || 0) * 100) / 100,
          };
        }
        return acc;
      }, {} as Record<string, any>),
    };
  }
}