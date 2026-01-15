import { Injectable } from '@nestjs/common';
import { eq, and, or, like, asc, count, isNull } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import {
  franchises,
  territories,
  franchiseLocations,
  franchisePermissions,
} from '../../database/schema/franchise.schema';
import {
  Franchise,
  Territory,
  FranchiseLocation,
  FranchisePermission,
  FranchiseType,
  FranchiseStatus,
  TerritoryType,
} from '../entities/franchise.entity';
import {
  CreateFranchiseDto,
  UpdateFranchiseDto,
  FranchiseQueryDto,
  CreateTerritoryDto,
  UpdateTerritoryDto,
  TerritoryQueryDto,
} from '../dto/franchise.dto';

@Injectable()
export class FranchiseRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  // Franchise CRUD operations
  async createFranchise(tenantId: string, dto: CreateFranchiseDto, userId: string): Promise<Franchise> {
    const franchiseData = {
      tenantId,
      name: dto.name,
      code: dto.code,
      description: dto.description,
      type: dto.type,
      status: 'active' as const,
      ownerId: dto.ownerId,
      operatorId: dto.operatorId,
      businessName: dto.businessName,
      businessRegistrationNumber: dto.businessRegistrationNumber,
      taxId: dto.taxId,
      contactInfo: dto.contactInfo || {},
      royaltyRate: dto.royaltyRate?.toString(),
      marketingFeeRate: dto.marketingFeeRate?.toString(),
      initialFranchiseFee: dto.initialFranchiseFee?.toString(),
      contractStartDate: dto.contractStartDate ? new Date(dto.contractStartDate) : null,
      contractEndDate: dto.contractEndDate ? new Date(dto.contractEndDate) : null,
      contractTerms: dto.contractTerms || {},
      performanceMetrics: {},
      settings: dto.settings || {},
      featureFlags: {},
      primaryTerritoryId: dto.primaryTerritoryId,
      parentFranchiseId: dto.parentFranchiseId,
      createdBy: userId,
      updatedBy: userId,
    };

    const [franchise] = await this.drizzle.getDb()
      .insert(franchises)
      .values(franchiseData)
      .returning();

    return this.mapFranchiseFromDb(franchise);
  }

  async findFranchiseById(tenantId: string, id: string): Promise<Franchise | null> {
    const [franchise] = await this.drizzle.getDb()
      .select()
      .from(franchises)
      .where(and(eq(franchises.tenantId, tenantId), eq(franchises.id, id), isNull(franchises.deletedAt)));

    return franchise ? this.mapFranchiseFromDb(franchise) : null;
  }

  async findFranchiseByCode(tenantId: string, code: string): Promise<Franchise | null> {
    const [franchise] = await this.drizzle.getDb()
      .select()
      .from(franchises)
      .where(and(eq(franchises.tenantId, tenantId), eq(franchises.code, code), isNull(franchises.deletedAt)));

    return franchise ? this.mapFranchiseFromDb(franchise) : null;
  }

  async findFranchises(tenantId: string, query: FranchiseQueryDto): Promise<{ franchises: Franchise[]; total: number }> {
    const conditions = [eq(franchises.tenantId, tenantId), isNull(franchises.deletedAt)];

    if (query.type) {
      conditions.push(eq(franchises.type, query.type));
    }

    if (query.status) {
      conditions.push(eq(franchises.status, query.status));
    }

    if (query.search) {
      const searchCondition = or(
        like(franchises.name, `%${query.search}%`),
        like(franchises.code, `%${query.search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await this.drizzle.getDb()
      .select({ count: count() })
      .from(franchises)
      .where(whereClause);
    
    const totalCount = countResult[0]?.count || 0;

    // Get paginated results
    const results = await this.drizzle.getDb()
      .select()
      .from(franchises)
      .where(whereClause)
      .orderBy(asc(franchises.name))
      .limit(query.limit || 20)
      .offset(((query.page || 1) - 1) * (query.limit || 20));

    return {
      franchises: results.map(this.mapFranchiseFromDb),
      total: totalCount,
    };
  }

  async updateFranchise(tenantId: string, id: string, dto: UpdateFranchiseDto, userId: string): Promise<Franchise | null> {
    const updateData: any = {
      ...dto,
      updatedBy: userId,
      updatedAt: new Date(),
    };

    // Convert number fields to strings for database
    if (dto.royaltyRate !== undefined) {
      updateData.royaltyRate = dto.royaltyRate?.toString();
    }
    if (dto.marketingFeeRate !== undefined) {
      updateData.marketingFeeRate = dto.marketingFeeRate?.toString();
    }
    if (dto.initialFranchiseFee !== undefined) {
      updateData.initialFranchiseFee = dto.initialFranchiseFee?.toString();
    }

    const [franchise] = await this.drizzle.getDb()
      .update(franchises)
      .set(updateData)
      .where(and(eq(franchises.tenantId, tenantId), eq(franchises.id, id), isNull(franchises.deletedAt)))
      .returning();

    return franchise ? this.mapFranchiseFromDb(franchise) : null;
  }

  async deleteFranchise(tenantId: string, id: string, userId: string): Promise<boolean> {
    const [result] = await this.drizzle.getDb()
      .update(franchises)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(franchises.tenantId, tenantId), eq(franchises.id, id), isNull(franchises.deletedAt)))
      .returning({ id: franchises.id });

    return !!result;
  }

  // Territory CRUD operations
  async createTerritory(tenantId: string, dto: CreateTerritoryDto, userId: string): Promise<Territory> {
    const territoryData = {
      tenantId,
      name: dto.name,
      code: dto.code,
      description: dto.description,
      type: dto.type,
      boundaries: dto.boundaries || {},
      marketCriteria: dto.marketCriteria || {},
      parentTerritoryId: dto.parentTerritoryId,
      assignedFranchiseId: dto.assignedFranchiseId,
      assignedUserId: dto.assignedUserId,
      metrics: {},
      settings: dto.settings || {},
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    };

    const [territory] = await this.drizzle.getDb()
      .insert(territories)
      .values(territoryData)
      .returning();

    return this.mapTerritoryFromDb(territory);
  }

  async findTerritoryById(tenantId: string, id: string): Promise<Territory | null> {
    const [territory] = await this.drizzle.getDb()
      .select()
      .from(territories)
      .where(and(eq(territories.tenantId, tenantId), eq(territories.id, id), isNull(territories.deletedAt)));

    return territory ? this.mapTerritoryFromDb(territory) : null;
  }

  async findTerritoryByCode(tenantId: string, code: string): Promise<Territory | null> {
    const [territory] = await this.drizzle.getDb()
      .select()
      .from(territories)
      .where(and(eq(territories.tenantId, tenantId), eq(territories.code, code), isNull(territories.deletedAt)));

    return territory ? this.mapTerritoryFromDb(territory) : null;
  }

  async findTerritories(tenantId: string, query: TerritoryQueryDto): Promise<{ territories: Territory[]; total: number }> {
    const conditions = [eq(territories.tenantId, tenantId), isNull(territories.deletedAt)];

    if (query.type) {
      conditions.push(eq(territories.type, query.type));
    }

    if (query.search) {
      const searchCondition = or(
        like(territories.name, `%${query.search}%`),
        like(territories.code, `%${query.search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await this.drizzle.getDb()
      .select({ count: count() })
      .from(territories)
      .where(whereClause);
    
    const totalCount = countResult[0]?.count || 0;

    // Get paginated results
    const results = await this.drizzle.getDb()
      .select()
      .from(territories)
      .where(whereClause)
      .orderBy(asc(territories.name))
      .limit(query.limit || 20)
      .offset(((query.page || 1) - 1) * (query.limit || 20));

    return {
      territories: results.map(this.mapTerritoryFromDb),
      total: totalCount,
    };
  }

  async updateTerritory(tenantId: string, id: string, dto: UpdateTerritoryDto, userId: string): Promise<Territory | null> {
    const [territory] = await this.drizzle.getDb()
      .update(territories)
      .set({
        ...dto,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(territories.tenantId, tenantId), eq(territories.id, id), isNull(territories.deletedAt)))
      .returning();

    return territory ? this.mapTerritoryFromDb(territory) : null;
  }

  async deleteTerritory(tenantId: string, id: string, userId: string): Promise<boolean> {
    const [result] = await this.drizzle.getDb()
      .update(territories)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(territories.tenantId, tenantId), eq(territories.id, id), isNull(territories.deletedAt)))
      .returning({ id: territories.id });

    return !!result;
  }

  // Franchise Location operations
  async findFranchiseLocationsByFranchise(tenantId: string, franchiseId: string): Promise<FranchiseLocation[]> {
    const results = await this.drizzle.getDb()
      .select()
      .from(franchiseLocations)
      .where(and(
        eq(franchiseLocations.tenantId, tenantId),
        eq(franchiseLocations.franchiseId, franchiseId),
        isNull(franchiseLocations.deletedAt)
      ));

    return results.map(this.mapFranchiseLocationFromDb);
  }

  async findFranchiseLocationsByLocation(tenantId: string, locationId: string): Promise<FranchiseLocation[]> {
    const results = await this.drizzle.getDb()
      .select()
      .from(franchiseLocations)
      .where(and(
        eq(franchiseLocations.tenantId, tenantId),
        eq(franchiseLocations.locationId, locationId),
        isNull(franchiseLocations.deletedAt)
      ));

    return results.map(this.mapFranchiseLocationFromDb);
  }

  // Franchise Permission operations
  async findFranchisePermissionsByUser(tenantId: string, userId: string): Promise<FranchisePermission[]> {
    const results = await this.drizzle.getDb()
      .select()
      .from(franchisePermissions)
      .where(and(
        eq(franchisePermissions.tenantId, tenantId),
        eq(franchisePermissions.userId, userId),
        isNull(franchisePermissions.deletedAt)
      ));

    return results.map(this.mapFranchisePermissionFromDb);
  }

  async findFranchisePermissionsByFranchise(tenantId: string, franchiseId: string): Promise<FranchisePermission[]> {
    const results = await this.drizzle.getDb()
      .select()
      .from(franchisePermissions)
      .where(and(
        eq(franchisePermissions.tenantId, tenantId),
        eq(franchisePermissions.franchiseId, franchiseId),
        isNull(franchisePermissions.deletedAt)
      ));

    return results.map(this.mapFranchisePermissionFromDb);
  }

  // Helper methods to map database results to entities
  private mapFranchiseFromDb(dbFranchise: any): Franchise {
    return {
      id: dbFranchise.id,
      tenantId: dbFranchise.tenantId,
      name: dbFranchise.name,
      code: dbFranchise.code,
      description: dbFranchise.description,
      type: dbFranchise.type as FranchiseType,
      status: dbFranchise.status as FranchiseStatus,
      ownerId: dbFranchise.ownerId,
      operatorId: dbFranchise.operatorId,
      businessName: dbFranchise.businessName,
      businessRegistrationNumber: dbFranchise.businessRegistrationNumber,
      taxId: dbFranchise.taxId,
      contactInfo: dbFranchise.contactInfo || {},
      royaltyRate: dbFranchise.royaltyRate ? parseFloat(dbFranchise.royaltyRate) : 0,
      marketingFeeRate: dbFranchise.marketingFeeRate ? parseFloat(dbFranchise.marketingFeeRate) : 0,
      initialFranchiseFee: dbFranchise.initialFranchiseFee ? parseFloat(dbFranchise.initialFranchiseFee) : 0,
      contractStartDate: dbFranchise.contractStartDate,
      contractEndDate: dbFranchise.contractEndDate,
      contractTerms: dbFranchise.contractTerms || {},
      performanceMetrics: dbFranchise.performanceMetrics || {},
      settings: dbFranchise.settings || {},
      featureFlags: dbFranchise.featureFlags || {},
      primaryTerritoryId: dbFranchise.primaryTerritoryId,
      parentFranchiseId: dbFranchise.parentFranchiseId,
      createdAt: dbFranchise.createdAt,
      updatedAt: dbFranchise.updatedAt,
      createdBy: dbFranchise.createdBy,
      updatedBy: dbFranchise.updatedBy,
      deletedAt: dbFranchise.deletedAt,
      version: dbFranchise.version,
    };
  }

  private mapTerritoryFromDb(dbTerritory: any): Territory {
    return {
      id: dbTerritory.id,
      tenantId: dbTerritory.tenantId,
      name: dbTerritory.name,
      code: dbTerritory.code,
      description: dbTerritory.description,
      type: dbTerritory.type as TerritoryType,
      boundaries: dbTerritory.boundaries || {},
      marketCriteria: dbTerritory.marketCriteria || {},
      parentTerritoryId: dbTerritory.parentTerritoryId,
      assignedFranchiseId: dbTerritory.assignedFranchiseId,
      assignedUserId: dbTerritory.assignedUserId,
      metrics: dbTerritory.metrics || {},
      settings: dbTerritory.settings || {},
      isActive: dbTerritory.isActive,
      createdAt: dbTerritory.createdAt,
      updatedAt: dbTerritory.updatedAt,
      createdBy: dbTerritory.createdBy,
      updatedBy: dbTerritory.updatedBy,
      deletedAt: dbTerritory.deletedAt,
      version: dbTerritory.version,
    };
  }

  private mapFranchiseLocationFromDb(dbFranchiseLocation: any): FranchiseLocation {
    return {
      id: dbFranchiseLocation.id,
      tenantId: dbFranchiseLocation.tenantId,
      franchiseId: dbFranchiseLocation.franchiseId,
      locationId: dbFranchiseLocation.locationId,
      role: dbFranchiseLocation.role,
      effectiveDate: dbFranchiseLocation.effectiveDate,
      expirationDate: dbFranchiseLocation.expirationDate,
      settings: dbFranchiseLocation.settings || {},
      createdAt: dbFranchiseLocation.createdAt,
      updatedAt: dbFranchiseLocation.updatedAt,
      createdBy: dbFranchiseLocation.createdBy,
      updatedBy: dbFranchiseLocation.updatedBy,
      deletedAt: dbFranchiseLocation.deletedAt,
      version: dbFranchiseLocation.version,
    };
  }

  private mapFranchisePermissionFromDb(dbPermission: any): FranchisePermission {
    return {
      id: dbPermission.id,
      tenantId: dbPermission.tenantId,
      franchiseId: dbPermission.franchiseId,
      userId: dbPermission.userId,
      permissions: dbPermission.permissions || [],
      role: dbPermission.role,
      effectiveDate: dbPermission.effectiveDate,
      expirationDate: dbPermission.expirationDate,
      createdAt: dbPermission.createdAt,
      updatedAt: dbPermission.updatedAt,
      createdBy: dbPermission.createdBy,
      updatedBy: dbPermission.updatedBy,
      deletedAt: dbPermission.deletedAt,
      version: dbPermission.version,
    };
  }

  // Additional methods needed by FranchiseService
  async createFranchiseLocation(tenantId: string, dto: any, userId: string): Promise<FranchiseLocation> {
    const franchiseLocationData = {
      tenantId,
      franchiseId: dto.franchiseId,
      locationId: dto.locationId,
      role: dto.role || 'primary',
      effectiveDate: new Date(dto.effectiveDate),
      expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : null,
      settings: dto.settings || {},
      createdBy: userId,
      updatedBy: userId,
    };

    const [franchiseLocation] = await this.drizzle.getDb()
      .insert(franchiseLocations)
      .values(franchiseLocationData)
      .returning();

    return this.mapFranchiseLocationFromDb(franchiseLocation);
  }

  async createFranchisePermission(tenantId: string, dto: any, userId: string): Promise<FranchisePermission> {
    const permissionData = {
      tenantId,
      franchiseId: dto.franchiseId,
      userId: dto.userId,
      permissions: dto.permissions || [],
      role: dto.role || 'operator',
      effectiveDate: new Date(dto.effectiveDate),
      expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : null,
      createdBy: userId,
      updatedBy: userId,
    };

    const [permission] = await this.drizzle.getDb()
      .insert(franchisePermissions)
      .values(permissionData)
      .returning();

    return this.mapFranchisePermissionFromDb(permission);
  }

  async createTerritoryAssignment(tenantId: string, dto: any, userId: string): Promise<any> {
    // For now, we'll update the territory with the assignment
    // In a full implementation, you might have a separate territoryAssignments table
    const updateData: any = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    if (dto.franchiseId) {
      updateData.assignedFranchiseId = dto.franchiseId;
    }

    if (dto.userId) {
      updateData.assignedUserId = dto.userId;
    }

    const [territory] = await this.drizzle.getDb()
      .update(territories)
      .set(updateData)
      .where(and(
        eq(territories.tenantId, tenantId),
        eq(territories.id, dto.territoryId),
        isNull(territories.deletedAt)
      ))
      .returning();

    if (!territory) {
      throw new Error('Failed to create territory assignment');
    }

    return {
      id: `assignment_${territory.id}`,
      territoryId: dto.territoryId,
      franchiseId: dto.franchiseId,
      userId: dto.userId,
      assignmentType: dto.assignmentType,
      effectiveDate: new Date(dto.effectiveDate),
      expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : null,
      reason: dto.reason,
      metadata: dto.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    };
  }
}