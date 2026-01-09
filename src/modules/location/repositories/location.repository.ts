import { Injectable, Logger } from '@nestjs/common';
import { eq, and, or, like, desc, asc, sql, inArray, isNull } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { 
  locations, 
  locationPermissions, 
  locationHierarchy, 
  locationMetrics 
} from '../../database/schema/location.schema';
import { CreateLocationDto, UpdateLocationDto, LocationQueryDto } from '../dto/location.dto';
import { Location, LocationPermission, LocationMetric, LocationHierarchy } from '../entities/location.entity';

@Injectable()
export class LocationRepository {
  private readonly logger = new Logger(LocationRepository.name);

  constructor(private readonly drizzle: DrizzleService) {}

  async create(tenantId: string, data: CreateLocationDto, userId: string): Promise<Location> {
    try {
      const locationData = {
        tenantId,
        name: data.name,
        code: data.code,
        description: data.description,
        type: data.type,
        status: data.status || 'active',
        address: data.address,
        phone: data.phone,
        email: data.email,
        website: data.website,
        parentLocationId: data.parentLocationId,
        timezone: data.timezone || 'UTC',
        currency: data.currency || 'USD',
        operatingHours: data.operatingHours || {},
        managerId: data.managerId,
        latitude: data.latitude ? data.latitude.toString() : null,
        longitude: data.longitude ? data.longitude.toString() : null,
        squareFootage: data.squareFootage ? data.squareFootage.toString() : null,
        settings: data.settings || {},
        taxSettings: data.taxSettings || {},
        inventorySettings: data.inventorySettings || {},
        posSettings: data.posSettings || {},
        capacity: data.capacity || {},
        featureFlags: {},
        metrics: {},
        createdBy: userId,
        updatedBy: userId,
      };

      const [location] = await this.drizzle.db
        .insert(locations)
        .values(locationData)
        .returning();

      // If this location has a parent, update the hierarchy table
      if (data.parentLocationId) {
        await this.updateHierarchy(location.id, data.parentLocationId, tenantId);
      }

      return this.mapToEntity(location);
    } catch (error) {
      this.logger.error(`Failed to create location: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findById(tenantId: string, id: string): Promise<Location | null> {
    try {
      const [location] = await this.drizzle.db
        .select()
        .from(locations)
        .where(and(
          eq(locations.tenantId, tenantId),
          eq(locations.id, id),
          eq(locations.isActive, true)
        ));

      return location ? this.mapToEntity(location) : null;
    } catch (error) {
      this.logger.error(`Failed to find location by ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findByCode(tenantId: string, code: string): Promise<Location | null> {
    try {
      const [location] = await this.drizzle.db
        .select()
        .from(locations)
        .where(and(
          eq(locations.tenantId, tenantId),
          eq(locations.code, code),
          eq(locations.isActive, true)
        ));

      return location ? this.mapToEntity(location) : null;
    } catch (error) {
      this.logger.error(`Failed to find location by code: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(tenantId: string, query: LocationQueryDto): Promise<{ locations: Location[]; total: number }> {
    try {
      const conditions = [
        eq(locations.tenantId, tenantId),
        eq(locations.isActive, true)
      ];

      // Add search conditions
      if (query.search) {
        conditions.push(
          or(
            like(locations.name, `%${query.search}%`),
            like(locations.code, `%${query.search}%`),
            like(locations.description, `%${query.search}%`)
          )
        );
      }

      if (query.type) {
        conditions.push(eq(locations.type, query.type));
      }

      if (query.status) {
        conditions.push(eq(locations.status, query.status));
      }

      if (query.managerId) {
        conditions.push(eq(locations.managerId, query.managerId));
      }

      if (query.parentLocationId) {
        conditions.push(eq(locations.parentLocationId, query.parentLocationId));
      }

      // Build the base query
      const baseQuery = this.drizzle.db
        .select()
        .from(locations)
        .where(and(...conditions));

      // Get total count
      const [{ count }] = await this.drizzle.db
        .select({ count: sql<number>`count(*)` })
        .from(locations)
        .where(and(...conditions));

      // Apply sorting
      const sortField = query.sortBy || 'name';
      const sortOrder = query.sortOrder || 'asc';
      
      let orderBy;
      switch (sortField) {
        case 'name':
          orderBy = sortOrder === 'desc' ? desc(locations.name) : asc(locations.name);
          break;
        case 'code':
          orderBy = sortOrder === 'desc' ? desc(locations.code) : asc(locations.code);
          break;
        case 'type':
          orderBy = sortOrder === 'desc' ? desc(locations.type) : asc(locations.type);
          break;
        case 'status':
          orderBy = sortOrder === 'desc' ? desc(locations.status) : asc(locations.status);
          break;
        case 'createdAt':
          orderBy = sortOrder === 'desc' ? desc(locations.createdAt) : asc(locations.createdAt);
          break;
        default:
          orderBy = asc(locations.name);
      }

      // Apply pagination and sorting
      const offset = ((query.page || 1) - 1) * (query.limit || 20);
      const results = await baseQuery
        .orderBy(orderBy)
        .limit(query.limit || 20)
        .offset(offset);

      return {
        locations: results.map(location => this.mapToEntity(location)),
        total: count
      };
    } catch (error) {
      this.logger.error(`Failed to find locations: ${error.message}`, error.stack);
      throw error;
    }
  }

  async update(tenantId: string, id: string, data: UpdateLocationDto, userId: string): Promise<Location> {
    try {
      const updateData: any = {
        updatedBy: userId,
        updatedAt: new Date(),
      };

      // Only include fields that are provided
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.address !== undefined) updateData.address = data.address;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.website !== undefined) updateData.website = data.website;
      if (data.parentLocationId !== undefined) updateData.parentLocationId = data.parentLocationId;
      if (data.timezone !== undefined) updateData.timezone = data.timezone;
      if (data.currency !== undefined) updateData.currency = data.currency;
      if (data.operatingHours !== undefined) updateData.operatingHours = data.operatingHours;
      if (data.managerId !== undefined) updateData.managerId = data.managerId;
      if (data.latitude !== undefined) updateData.latitude = data.latitude?.toString();
      if (data.longitude !== undefined) updateData.longitude = data.longitude?.toString();
      if (data.squareFootage !== undefined) updateData.squareFootage = data.squareFootage?.toString();
      if (data.settings !== undefined) updateData.settings = data.settings;
      if (data.taxSettings !== undefined) updateData.taxSettings = data.taxSettings;
      if (data.inventorySettings !== undefined) updateData.inventorySettings = data.inventorySettings;
      if (data.posSettings !== undefined) updateData.posSettings = data.posSettings;
      if (data.capacity !== undefined) updateData.capacity = data.capacity;
      if (data.featureFlags !== undefined) updateData.featureFlags = data.featureFlags;

      const [location] = await this.drizzle.db
        .update(locations)
        .set(updateData)
        .where(and(
          eq(locations.tenantId, tenantId),
          eq(locations.id, id),
          eq(locations.isActive, true)
        ))
        .returning();

      if (!location) {
        throw new Error('Location not found or not accessible');
      }

      // Update hierarchy if parent changed
      if (data.parentLocationId !== undefined) {
        await this.updateHierarchy(id, data.parentLocationId, tenantId);
      }

      return this.mapToEntity(location);
    } catch (error) {
      this.logger.error(`Failed to update location: ${error.message}`, error.stack);
      throw error;
    }
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    try {
      await this.drizzle.db
        .update(locations)
        .set({
          isActive: false,
          deletedAt: new Date(),
          updatedBy: userId,
        })
        .where(and(
          eq(locations.tenantId, tenantId),
          eq(locations.id, id),
          eq(locations.isActive, true)
        ));

      // Clean up hierarchy entries
      await this.drizzle.db
        .update(locationHierarchy)
        .set({ isActive: false })
        .where(and(
          eq(locationHierarchy.tenantId, tenantId),
          or(
            eq(locationHierarchy.ancestorId, id),
            eq(locationHierarchy.descendantId, id)
          )
        ));
    } catch (error) {
      this.logger.error(`Failed to delete location: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findChildren(tenantId: string, parentId: string): Promise<Location[]> {
    try {
      const results = await this.drizzle.db
        .select()
        .from(locations)
        .where(and(
          eq(locations.tenantId, tenantId),
          eq(locations.parentLocationId, parentId),
          eq(locations.isActive, true)
        ))
        .orderBy(asc(locations.name));

      return results.map(location => this.mapToEntity(location));
    } catch (error) {
      this.logger.error(`Failed to find child locations: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findHierarchy(tenantId: string, locationId: string): Promise<LocationHierarchy[]> {
    try {
      const results = await this.drizzle.db
        .select()
        .from(locationHierarchy)
        .where(and(
          eq(locationHierarchy.tenantId, tenantId),
          eq(locationHierarchy.ancestorId, locationId),
          eq(locationHierarchy.isActive, true)
        ))
        .orderBy(asc(locationHierarchy.depth));

      return results.map(hierarchy => ({
        id: hierarchy.id,
        tenantId: hierarchy.tenantId,
        ancestorId: hierarchy.ancestorId,
        descendantId: hierarchy.descendantId,
        depth: Number(hierarchy.depth),
        createdAt: hierarchy.createdAt,
        updatedAt: hierarchy.updatedAt,
        isActive: hierarchy.isActive,
      }));
    } catch (error) {
      this.logger.error(`Failed to find location hierarchy: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async updateHierarchy(locationId: string, parentLocationId: string | null, tenantId: string): Promise<void> {
    try {
      // Remove existing hierarchy entries for this location
      await this.drizzle.db
        .update(locationHierarchy)
        .set({ isActive: false })
        .where(and(
          eq(locationHierarchy.tenantId, tenantId),
          eq(locationHierarchy.descendantId, locationId)
        ));

      if (parentLocationId) {
        // Add self-reference
        await this.drizzle.db
          .insert(locationHierarchy)
          .values({
            tenantId,
            ancestorId: locationId,
            descendantId: locationId,
            depth: '0',
          });

        // Add parent relationships
        const parentHierarchy = await this.drizzle.db
          .select()
          .from(locationHierarchy)
          .where(and(
            eq(locationHierarchy.tenantId, tenantId),
            eq(locationHierarchy.descendantId, parentLocationId),
            eq(locationHierarchy.isActive, true)
          ));

        for (const parent of parentHierarchy) {
          await this.drizzle.db
            .insert(locationHierarchy)
            .values({
              tenantId,
              ancestorId: parent.ancestorId,
              descendantId: locationId,
              depth: (Number(parent.depth) + 1).toString(),
            });
        }
      } else {
        // Just add self-reference for root location
        await this.drizzle.db
          .insert(locationHierarchy)
          .values({
            tenantId,
            ancestorId: locationId,
            descendantId: locationId,
            depth: '0',
          });
      }
    } catch (error) {
      this.logger.error(`Failed to update location hierarchy: ${error.message}`, error.stack);
      throw error;
    }
  }

  private mapToEntity(location: any): Location {
    return {
      id: location.id,
      tenantId: location.tenantId,
      name: location.name,
      code: location.code,
      description: location.description,
      type: location.type,
      status: location.status,
      address: location.address,
      phone: location.phone,
      email: location.email,
      website: location.website,
      parentLocationId: location.parentLocationId,
      timezone: location.timezone,
      currency: location.currency,
      operatingHours: location.operatingHours,
      managerId: location.managerId,
      latitude: location.latitude ? Number(location.latitude) : undefined,
      longitude: location.longitude ? Number(location.longitude) : undefined,
      squareFootage: location.squareFootage ? Number(location.squareFootage) : undefined,
      settings: location.settings,
      metrics: location.metrics,
      taxSettings: location.taxSettings,
      inventorySettings: location.inventorySettings,
      posSettings: location.posSettings,
      featureFlags: location.featureFlags,
      capacity: location.capacity,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
      createdBy: location.createdBy,
      updatedBy: location.updatedBy,
      deletedAt: location.deletedAt,
      version: location.version,
      isActive: location.isActive,
    };
  }
}