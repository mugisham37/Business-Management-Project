import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LocationRepository } from '../repositories/location.repository';
import { CreateLocationDto, UpdateLocationDto, LocationQueryDto } from '../dto/location.dto';
import { Location } from '../entities/location.entity';

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(tenantId: string, data: CreateLocationDto, userId: string): Promise<Location> {
    try {
      // Validate that the location code is unique within the tenant
      const existingLocation = await this.locationRepository.findByCode(tenantId, data.code);
      if (existingLocation) {
        throw new ConflictException(`Location with code '${data.code}' already exists`);
      }

      // Validate parent location if specified
      if (data.parentLocationId) {
        const parentLocation = await this.locationRepository.findById(tenantId, data.parentLocationId);
        if (!parentLocation) {
          throw new BadRequestException('Parent location not found');
        }
      }

      // Create the location
      const location = await this.locationRepository.create(tenantId, data, userId);

      // Emit location created event for metrics tracking
      this.eventEmitter.emit('location.created', {
        tenantId,
        locationId: location.id,
        location,
        userId,
      });

      this.logger.log(`Location created: ${location.id} for tenant: ${tenantId}`);
      return location;
    } catch (error: any) {
      this.logger.error(`Failed to create location: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findById(tenantId: string, id: string): Promise<Location> {
    try {
      const location = await this.locationRepository.findById(tenantId, id);
      if (!location) {
        throw new NotFoundException('Location not found');
      }
      return location;
    } catch (error: any) {
      this.logger.error(`Failed to find location by ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findByCode(tenantId: string, code: string): Promise<Location> {
    try {
      const location = await this.locationRepository.findByCode(tenantId, code);
      if (!location) {
        throw new NotFoundException('Location not found');
      }
      return location;
    } catch (error: any) {
      this.logger.error(`Failed to find location by code: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(tenantId: string, query: LocationQueryDto): Promise<{ locations: Location[]; total: number }> {
    try {
      return await this.locationRepository.findAll(tenantId, query);
    } catch (error: any) {
      this.logger.error(`Failed to find locations: ${error.message}`, error.stack);
      throw error;
    }
  }

  async update(tenantId: string, id: string, data: UpdateLocationDto, userId: string): Promise<Location> {
    try {
      // Check if location exists
      const existingLocation = await this.locationRepository.findById(tenantId, id);
      if (!existingLocation) {
        throw new NotFoundException('Location not found');
      }

      // Validate parent location if being changed
      if (data.parentLocationId !== undefined && data.parentLocationId !== null) {
        if (data.parentLocationId === id) {
          throw new BadRequestException('Location cannot be its own parent');
        }

        const parentLocation = await this.locationRepository.findById(tenantId, data.parentLocationId);
        if (!parentLocation) {
          throw new BadRequestException('Parent location not found');
        }

        // Check for circular references
        await this.validateNoCircularReference(tenantId, id, data.parentLocationId);
      }

      // Update the location
      const location = await this.locationRepository.update(tenantId, id, data, userId);

      // Emit location updated event
      this.eventEmitter.emit('location.updated', {
        tenantId,
        locationId: location.id,
        location,
        previousData: existingLocation,
        userId,
      });

      this.logger.log(`Location updated: ${location.id} for tenant: ${tenantId}`);
      return location;
    } catch (error: any) {
      this.logger.error(`Failed to update location: ${error.message}`, error.stack);
      throw error;
    }
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    try {
      // Check if location exists
      const location = await this.locationRepository.findById(tenantId, id);
      if (!location) {
        throw new NotFoundException('Location not found');
      }

      // Check if location has children
      const children = await this.locationRepository.findChildren(tenantId, id);
      if (children.length > 0) {
        throw new BadRequestException('Cannot delete location with child locations. Please reassign or delete child locations first.');
      }

      // Soft delete the location
      await this.locationRepository.delete(tenantId, id, userId);

      // Emit location deleted event for metrics tracking
      this.eventEmitter.emit('location.deleted', {
        tenantId,
        locationId: id,
        location,
        userId,
      });

      this.logger.log(`Location deleted: ${id} for tenant: ${tenantId}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete location: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findChildren(tenantId: string, parentId: string): Promise<Location[]> {
    try {
      // Verify parent location exists
      await this.findById(tenantId, parentId);
      
      return await this.locationRepository.findChildren(tenantId, parentId);
    } catch (error: any) {
      this.logger.error(`Failed to find child locations: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findHierarchy(tenantId: string, locationId: string): Promise<Location[]> {
    try {
      // Verify location exists
      await this.findById(tenantId, locationId);

      const hierarchy = await this.locationRepository.findHierarchy(tenantId, locationId);
      
      // Get all descendant locations
      const descendantIds = hierarchy
        .filter(h => h.depth > 0)
        .map(h => h.descendantId);

      if (descendantIds.length === 0) {
        return [];
      }

      // Fetch all descendant locations
      const descendants: Location[] = [];
      for (const descendantId of descendantIds) {
        try {
          const location = await this.locationRepository.findById(tenantId, descendantId);
          if (location) {
            descendants.push(location);
          }
        } catch (error) {
          // Skip if location not found (might be deleted)
          this.logger.warn(`Descendant location not found: ${descendantId}`);
        }
      }

      return descendants;
    } catch (error: any) {
      this.logger.error(`Failed to find location hierarchy: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getLocationTree(tenantId: string, rootLocationId?: string): Promise<Location[]> {
    try {
      const query: LocationQueryDto = {
        includeChildren: true,
        limit: 1000, // Large limit for tree structure
      };

      if (rootLocationId) {
        query.parentLocationId = rootLocationId;
      }

      const { locations } = await this.locationRepository.findAll(tenantId, query);
      
      // Build tree structure recursively
      return await this.buildLocationTree(tenantId, locations);
    } catch (error: any) {
      this.logger.error(`Failed to get location tree: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateLocationMetrics(tenantId: string, locationId: string, metrics: Record<string, any>): Promise<Location> {
    try {
      const location = await this.findById(tenantId, locationId);
      
      const updatedMetrics = {
        ...location.metrics,
        ...metrics,
        lastUpdated: new Date().toISOString(),
      };

      return await this.locationRepository.update(
        tenantId,
        locationId,
        { settings: { ...location.settings, metrics: updatedMetrics } },
        'system'
      );
    } catch (error: any) {
      this.logger.error(`Failed to update location metrics: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getLocationsByManager(tenantId: string, managerId: string): Promise<Location[]> {
    try {
      const query: LocationQueryDto = {
        managerId,
        limit: 1000,
      };

      const { locations } = await this.locationRepository.findAll(tenantId, query);
      return locations;
    } catch (error: any) {
      this.logger.error(`Failed to find locations by manager: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getLocationsByType(tenantId: string, type: string): Promise<Location[]> {
    try {
      const query: LocationQueryDto = {
        type: type as any,
        limit: 1000,
      };

      const { locations } = await this.locationRepository.findAll(tenantId, query);
      return locations;
    } catch (error: any) {
      this.logger.error(`Failed to find locations by type: ${error.message}`, error.stack);
      throw error;
    }
  }

  async validateLocationAccess(tenantId: string, locationId: string, userId: string): Promise<boolean> {
    try {
      // Check if location exists and belongs to tenant
      const location = await this.locationRepository.findById(tenantId, locationId);
      if (!location) {
        return false;
      }

      // For now, all users in a tenant can access all locations
      // This can be extended with location-specific permissions later
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to validate location access: ${error.message}`, error.stack);
      return false;
    }
  }

  private async validateNoCircularReference(tenantId: string, locationId: string, parentLocationId: string): Promise<void> {
    try {
      // Get all descendants of the current location
      const descendants = await this.findHierarchy(tenantId, locationId);
      
      // Check if the proposed parent is in the descendants
      const isCircular = descendants.some(descendant => descendant.id === parentLocationId);
      
      if (isCircular) {
        throw new BadRequestException('Circular reference detected: proposed parent is a descendant of this location');
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to validate circular reference: ${(error as any).message}`, (error as any).stack);
      throw new BadRequestException('Failed to validate location hierarchy');
    }
  }

  private async buildLocationTree(tenantId: string, locations: Location[]): Promise<Location[]> {
    const locationMap = new Map<string, Location>();
    const rootLocations: Location[] = [];

    // Create a map of all locations with childLocations initialized
    locations.forEach(location => {
      const locationWithChildren = { ...location };
      (locationWithChildren as any).childLocations = [];
      locationMap.set(location.id, locationWithChildren as any);
    });

    // Build the tree structure
    locations.forEach(location => {
      const locationWithChildren = locationMap.get(location.id)!;
      
      if (location.parentLocationId) {
        const parent = locationMap.get(location.parentLocationId);
        if (parent) {
          if (!parent.childLocations) {
            parent.childLocations = [];
          }
          parent.childLocations.push(locationWithChildren);
        }
      } else {
        rootLocations.push(locationWithChildren);
      }
    });

    return rootLocations;
  }

  /**
   * Alias method for create - used by resolvers
   */
  async createLocation(tenantId: string, data: CreateLocationDto, userId: string): Promise<Location> {
    return this.create(tenantId, data, userId);
  }

  /**
   * Alias method for update - used by resolvers
   */
  async updateLocation(tenantId: string, id: string, data: UpdateLocationDto, userId: string): Promise<Location> {
    return this.update(tenantId, id, data, userId);
  }

  /**
   * Alias method for delete - used by resolvers
   */
  async deleteLocation(tenantId: string, id: string, userId: string): Promise<void> {
    return this.delete(tenantId, id, userId);
  }

  /**
   * Find all locations for a tenant
   */
  async findByTenant(tenantId: string): Promise<Location[]> {
    try {
      const { locations } = await this.locationRepository.findAll(tenantId, {});
      return locations;
    } catch (error: any) {
      this.logger.error(`Failed to find locations for tenant: ${error.message}`, error.stack);
      throw error;
    }
  }
}