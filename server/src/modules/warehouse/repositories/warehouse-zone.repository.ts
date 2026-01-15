import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { eq, and, desc, asc, count, sql, isNull } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { warehouseZones, binLocations } from '../../database/schema/warehouse.schema';
import { CreateWarehouseZoneDto, UpdateWarehouseZoneDto } from '../dto/warehouse.dto';

@Injectable()
export class WarehouseZoneRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(tenantId: string, data: CreateWarehouseZoneDto, userId: string): Promise<any> {
    // Check if zone code already exists in warehouse
    const existing = await this.drizzle.getDb()
      .select()
      .from(warehouseZones)
      .where(
        and(
          eq(warehouseZones.tenantId, tenantId),
          eq(warehouseZones.warehouseId, data.warehouseId),
          eq(warehouseZones.zoneCode, data.zoneCode),
          isNull(warehouseZones.deletedAt)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Zone code already exists in this warehouse');
    }

    const [zone] = await this.drizzle.getDb()
      .insert(warehouseZones)
      .values({
        tenantId,
        warehouseId: data.warehouseId,
        zoneCode: data.zoneCode,
        name: data.name,
        description: data.description,
        zoneType: data.zoneType,
        priority: data.priority || 1,
        coordinates: data.coordinates || {},
        squareFootage: data.squareFootage?.toString(),
        maxBinLocations: data.maxBinLocations,
        currentBinLocations: 0,
        temperatureControlled: data.temperatureControlled || false,
        temperatureRange: data.temperatureRange || {},
        humidityControlled: data.humidityControlled || false,
        accessLevel: data.accessLevel || 'standard',
        requiresAuthorization: data.requiresAuthorization || false,
        allowMixedProducts: data.allowMixedProducts !== false, // Default true
        allowMixedBatches: data.allowMixedBatches || false,
        fifoEnforced: data.fifoEnforced || false,
        status: 'active',
        configuration: data.configuration || {},
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return zone;
  }

  async findById(tenantId: string, id: string): Promise<any> {
    const [zone] = await this.drizzle.getDb()
      .select()
      .from(warehouseZones)
      .where(
        and(
          eq(warehouseZones.tenantId, tenantId),
          eq(warehouseZones.id, id),
          isNull(warehouseZones.deletedAt)
        )
      )
      .limit(1);

    if (!zone) {
      throw new NotFoundException('Warehouse zone not found');
    }

    return zone;
  }

  async findByWarehouse(tenantId: string, warehouseId: string): Promise<any[]> {
    return await this.drizzle.getDb()
      .select()
      .from(warehouseZones)
      .where(
        and(
          eq(warehouseZones.tenantId, tenantId),
          eq(warehouseZones.warehouseId, warehouseId),
          isNull(warehouseZones.deletedAt)
        )
      )
      .orderBy(asc(warehouseZones.priority), asc(warehouseZones.name));
  }

  async findByType(tenantId: string, warehouseId: string, zoneType: string): Promise<any[]> {
    return await this.drizzle.getDb()
      .select()
      .from(warehouseZones)
      .where(
        and(
          eq(warehouseZones.tenantId, tenantId),
          eq(warehouseZones.warehouseId, warehouseId),
          eq(warehouseZones.zoneType, zoneType as any),
          eq(warehouseZones.status, 'active'),
          isNull(warehouseZones.deletedAt)
        )
      )
      .orderBy(asc(warehouseZones.priority), asc(warehouseZones.name));
  }

  async findByCode(tenantId: string, warehouseId: string, zoneCode: string): Promise<any> {
    const [zone] = await this.drizzle.getDb()
      .select()
      .from(warehouseZones)
      .where(
        and(
          eq(warehouseZones.tenantId, tenantId),
          eq(warehouseZones.warehouseId, warehouseId),
          eq(warehouseZones.zoneCode, zoneCode),
          isNull(warehouseZones.deletedAt)
        )
      )
      .limit(1);

    if (!zone) {
      throw new NotFoundException('Warehouse zone not found');
    }

    return zone;
  }

  async update(tenantId: string, id: string, data: UpdateWarehouseZoneDto, userId: string): Promise<any> {
    await this.findById(tenantId, id);

    const updateData: any = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    // Only update provided fields with proper type handling
    Object.keys(data).forEach(key => {
      const value = (data as any)[key];
      if (value !== undefined) {
        if (key === 'squareFootage') {
          updateData[key] = value?.toString();
        } else {
          updateData[key] = value;
        }
      }
    });

    const [updatedZone] = await this.drizzle.getDb()
      .update(warehouseZones)
      .set(updateData)
      .where(
        and(
          eq(warehouseZones.tenantId, tenantId),
          eq(warehouseZones.id, id),
          isNull(warehouseZones.deletedAt)
        )
      )
      .returning();

    return updatedZone;
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    await this.findById(tenantId, id);

    // Check if zone has bin locations
    const [binCountResult] = await this.drizzle.getDb()
      .select({ count: count() })
      .from(binLocations)
      .where(
        and(
          eq(binLocations.tenantId, tenantId),
          eq(binLocations.zoneId, id),
          isNull(binLocations.deletedAt)
        )
      );

    const binCount = binCountResult?.count || 0;
    if (binCount > 0) {
      throw new ConflictException('Cannot delete zone with existing bin locations');
    }

    await this.drizzle.getDb()
      .update(warehouseZones)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        and(
          eq(warehouseZones.tenantId, tenantId),
          eq(warehouseZones.id, id),
          isNull(warehouseZones.deletedAt)
        )
      );
  }

  async updateBinLocationCount(tenantId: string, zoneId: string, userId: string): Promise<void> {
    // Get current bin location count for the zone
    const [binCountResult] = await this.drizzle.getDb()
      .select({ count: count() })
      .from(binLocations)
      .where(
        and(
          eq(binLocations.tenantId, tenantId),
          eq(binLocations.zoneId, zoneId),
          isNull(binLocations.deletedAt)
        )
      );

    const binCount = binCountResult?.count || 0;

    await this.drizzle.getDb()
      .update(warehouseZones)
      .set({
        currentBinLocations: binCount,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(warehouseZones.tenantId, tenantId),
          eq(warehouseZones.id, zoneId),
          isNull(warehouseZones.deletedAt)
        )
      );
  }

  async getZoneCapacity(tenantId: string, zoneId: string): Promise<{
    maxBinLocations: number;
    currentBinLocations: number;
    availableBinLocations: number;
    utilizationPercentage: number;
  }> {
    const zone = await this.findById(tenantId, zoneId);

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
          eq(binLocations.zoneId, zoneId),
          isNull(binLocations.deletedAt)
        )
      );

    const maxBinLocations = zone.maxBinLocations || 0;
    const currentBinLocations = binStats?.totalBins || 0;
    const availableBinLocations = Math.max(0, maxBinLocations - currentBinLocations);
    const utilizationPercentage = maxBinLocations > 0 ? (currentBinLocations / maxBinLocations) * 100 : 0;

    return {
      maxBinLocations,
      currentBinLocations,
      availableBinLocations,
      utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
    };
  }

  async findAvailableZones(tenantId: string, warehouseId: string, zoneType?: string): Promise<any[]> {
    const conditions = [
      eq(warehouseZones.tenantId, tenantId),
      eq(warehouseZones.warehouseId, warehouseId),
      eq(warehouseZones.status, 'active'),
      isNull(warehouseZones.deletedAt)
    ];

    if (zoneType) {
      conditions.push(eq(warehouseZones.zoneType, zoneType as any));
    }

    return await this.drizzle.getDb()
      .select()
      .from(warehouseZones)
      .where(and(...conditions))
      .orderBy(asc(warehouseZones.priority), asc(warehouseZones.name));
  }

  async getZoneMetrics(tenantId: string, zoneId: string): Promise<any> {
    const zone = await this.findById(tenantId, zoneId);
    
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
          eq(binLocations.zoneId, zoneId),
          isNull(binLocations.deletedAt)
        )
      )
      .groupBy(binLocations.status);

    const capacity = await this.getZoneCapacity(tenantId, zoneId);

    return {
      zone,
      binLocations: binStatusStats.reduce((acc, stat) => {
        if (stat.status) {
          acc[stat.status] = stat.count;
        }
        return acc;
      }, {} as Record<string, number>),
      capacity,
    };
  }

  async findZonesByCoordinates(
    tenantId: string, 
    warehouseId: string, 
    x: number, 
    y: number, 
    radius: number = 10
  ): Promise<any[]> {
    // This is a simplified implementation - in a real system you might use PostGIS for spatial queries
    return await this.drizzle.getDb()
      .select()
      .from(warehouseZones)
      .where(
        and(
          eq(warehouseZones.tenantId, tenantId),
          eq(warehouseZones.warehouseId, warehouseId),
          eq(warehouseZones.status, 'active'),
          isNull(warehouseZones.deletedAt)
        )
      )
      .orderBy(asc(warehouseZones.priority));
  }
}