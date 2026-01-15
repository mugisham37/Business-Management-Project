import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FranchiseRepository } from '../repositories/franchise.repository';
import { LocationService } from './location.service';
import {
  Franchise,
  Territory,
  FranchiseLocation,
  FranchisePermission,
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
export class FranchiseService {
  constructor(
    private readonly franchiseRepository: FranchiseRepository,
    private readonly locationService: LocationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Franchise Management
  async createFranchise(tenantId: string, dto: CreateFranchiseDto, userId: string): Promise<Franchise> {
    // Check if franchise code already exists
    const existingFranchise = await this.franchiseRepository.findFranchiseByCode(tenantId, dto.code);
    if (existingFranchise) {
      throw new ConflictException(`Franchise with code '${dto.code}' already exists`);
    }

    // Validate territory assignment if provided
    if (dto.primaryTerritoryId) {
      const territory = await this.franchiseRepository.findTerritoryById(tenantId, dto.primaryTerritoryId);
      if (!territory) {
        throw new NotFoundException(`Territory with ID '${dto.primaryTerritoryId}' not found`);
      }
    }

    // Validate parent franchise if provided
    if (dto.parentFranchiseId) {
      const parentFranchise = await this.franchiseRepository.findFranchiseById(tenantId, dto.parentFranchiseId);
      if (!parentFranchise) {
        throw new NotFoundException(`Parent franchise with ID '${dto.parentFranchiseId}' not found`);
      }
    }

    const franchise = await this.franchiseRepository.createFranchise(tenantId, dto, userId);

    // Emit franchise created event
    this.eventEmitter.emit('franchise.created', {
      tenantId,
      franchise,
      userId,
    });

    return franchise;
  }

  async getFranchiseById(tenantId: string, id: string): Promise<Franchise> {
    const franchise = await this.franchiseRepository.findFranchiseById(tenantId, id);
    if (!franchise) {
      throw new NotFoundException(`Franchise with ID '${id}' not found`);
    }
    return franchise;
  }

  async getFranchiseByCode(tenantId: string, code: string): Promise<Franchise> {
    const franchise = await this.franchiseRepository.findFranchiseByCode(tenantId, code);
    if (!franchise) {
      throw new NotFoundException(`Franchise with code '${code}' not found`);
    }
    return franchise;
  }

  async getFranchises(tenantId: string, query: FranchiseQueryDto): Promise<{ franchises: Franchise[]; total: number }> {
    return this.franchiseRepository.findFranchises(tenantId, query);
  }

  async updateFranchise(tenantId: string, id: string, dto: UpdateFranchiseDto, userId: string): Promise<Franchise> {
    const existingFranchise = await this.getFranchiseById(tenantId, id);

    // Check if code is being changed and if it conflicts
    if (dto.code && dto.code !== existingFranchise.code) {
      const conflictingFranchise = await this.franchiseRepository.findFranchiseByCode(tenantId, dto.code);
      if (conflictingFranchise) {
        throw new ConflictException(`Franchise with code '${dto.code}' already exists`);
      }
    }

    const updatedFranchise = await this.franchiseRepository.updateFranchise(tenantId, id, dto, userId);
    if (!updatedFranchise) {
      throw new NotFoundException(`Franchise with ID '${id}' not found`);
    }

    // Emit franchise updated event
    this.eventEmitter.emit('franchise.updated', {
      tenantId,
      franchise: updatedFranchise,
      previousFranchise: existingFranchise,
      userId,
    });

    return updatedFranchise;
  }

  async deleteFranchise(tenantId: string, id: string, userId: string): Promise<void> {
    const franchise = await this.getFranchiseById(tenantId, id);

    // Check if franchise has active locations
    const franchiseLocations = await this.franchiseRepository.findFranchiseLocationsByFranchise(tenantId, id);
    const activeLocations = franchiseLocations.filter(fl => 
      !fl.expirationDate || fl.expirationDate > new Date()
    );

    if (activeLocations.length > 0) {
      throw new BadRequestException('Cannot delete franchise with active locations. Remove locations first.');
    }

    const success = await this.franchiseRepository.deleteFranchise(tenantId, id, userId);
    if (!success) {
      throw new NotFoundException(`Franchise with ID '${id}' not found`);
    }

    // Emit franchise deleted event
    this.eventEmitter.emit('franchise.deleted', {
      tenantId,
      franchise,
      userId,
    });
  }

  // Territory Management
  async createTerritory(tenantId: string, dto: CreateTerritoryDto, userId: string): Promise<Territory> {
    // Check if territory code already exists
    const existingTerritory = await this.franchiseRepository.findTerritoryByCode(tenantId, dto.code);
    if (existingTerritory) {
      throw new ConflictException(`Territory with code '${dto.code}' already exists`);
    }

    // Validate parent territory if provided
    if (dto.parentTerritoryId) {
      const parentTerritory = await this.franchiseRepository.findTerritoryById(tenantId, dto.parentTerritoryId);
      if (!parentTerritory) {
        throw new NotFoundException(`Parent territory with ID '${dto.parentTerritoryId}' not found`);
      }
    }

    // Validate assigned franchise if provided
    if (dto.assignedFranchiseId) {
      const franchise = await this.franchiseRepository.findFranchiseById(tenantId, dto.assignedFranchiseId);
      if (!franchise) {
        throw new NotFoundException(`Franchise with ID '${dto.assignedFranchiseId}' not found`);
      }
    }

    const territory = await this.franchiseRepository.createTerritory(tenantId, dto, userId);

    // Emit territory created event
    this.eventEmitter.emit('territory.created', {
      tenantId,
      territory,
      userId,
    });

    return territory;
  }

  async getTerritoryById(tenantId: string, id: string): Promise<Territory> {
    const territory = await this.franchiseRepository.findTerritoryById(tenantId, id);
    if (!territory) {
      throw new NotFoundException(`Territory with ID '${id}' not found`);
    }
    return territory;
  }

  async getTerritories(tenantId: string, query: TerritoryQueryDto): Promise<{ territories: Territory[]; total: number }> {
    return this.franchiseRepository.findTerritories(tenantId, query);
  }

  async updateTerritory(tenantId: string, id: string, dto: UpdateTerritoryDto, userId: string): Promise<Territory> {
    const existingTerritory = await this.getTerritoryById(tenantId, id);

    // Check if code is being changed and if it conflicts
    if (dto.code && dto.code !== existingTerritory.code) {
      const conflictingTerritory = await this.franchiseRepository.findTerritoryByCode(tenantId, dto.code);
      if (conflictingTerritory) {
        throw new ConflictException(`Territory with code '${dto.code}' already exists`);
      }
    }

    const updatedTerritory = await this.franchiseRepository.updateTerritory(tenantId, id, dto, userId);
    if (!updatedTerritory) {
      throw new NotFoundException(`Territory with ID '${id}' not found`);
    }

    // Emit territory updated event
    this.eventEmitter.emit('territory.updated', {
      tenantId,
      territory: updatedTerritory,
      previousTerritory: existingTerritory,
      userId,
    });

    return updatedTerritory;
  }

  async deleteTerritory(tenantId: string, id: string, userId: string): Promise<void> {
    const territory = await this.getTerritoryById(tenantId, id);

    const success = await this.franchiseRepository.deleteTerritory(tenantId, id, userId);
    if (!success) {
      throw new NotFoundException(`Territory with ID '${id}' not found`);
    }

    // Emit territory deleted event
    this.eventEmitter.emit('territory.deleted', {
      tenantId,
      territory,
      userId,
    });
  }

  // Franchise Location Management
  async getFranchiseLocations(tenantId: string, franchiseId: string): Promise<FranchiseLocation[]> {
    await this.getFranchiseById(tenantId, franchiseId);
    return this.franchiseRepository.findFranchiseLocationsByFranchise(tenantId, franchiseId);
  }

  // Franchise Permission Management
  async getFranchisePermissions(tenantId: string, franchiseId: string): Promise<FranchisePermission[]> {
    await this.getFranchiseById(tenantId, franchiseId);
    return this.franchiseRepository.findFranchisePermissionsByFranchise(tenantId, franchiseId);
  }

  async getUserFranchisePermissions(tenantId: string, userId: string): Promise<FranchisePermission[]> {
    return this.franchiseRepository.findFranchisePermissionsByUser(tenantId, userId);
  }

  // Dealer Portal Methods
  async validateDealerPortalAccess(tenantId: string, franchiseId: string, userId: string): Promise<any> {
    // Validate franchise exists
    const franchise = await this.getFranchiseById(tenantId, franchiseId);
    
    // Get user permissions for this franchise
    const permissions = await this.franchiseRepository.findFranchisePermissionsByUser(tenantId, userId);
    const franchisePermission = permissions.find(p => p.franchiseId === franchiseId);
    
    if (!franchisePermission) {
      throw new ForbiddenException('User does not have access to this franchise');
    }

    // Check if permission is still valid
    const now = new Date();
    if (franchisePermission.expirationDate && franchisePermission.expirationDate < now) {
      throw new ForbiddenException('Franchise access has expired');
    }

    return {
      franchiseId,
      userId,
      accessLevel: franchisePermission.role || 'operator',
      allowedModules: franchisePermission.permissions || [],
      franchise: {
        id: franchise.id,
        name: franchise.name,
        type: franchise.type,
        status: franchise.status,
      },
    };
  }

  async getDealerDashboard(tenantId: string, franchiseId: string, userId: string): Promise<any> {
    // Validate access first
    const access = await this.validateDealerPortalAccess(tenantId, franchiseId, userId);
    
    const franchise = await this.getFranchiseById(tenantId, franchiseId);
    const locations = await this.getFranchiseLocations(tenantId, franchiseId);
    
    // Get performance data (mock for now - would integrate with actual analytics)
    const currentPeriod = await this.getFranchisePerformance(tenantId, franchiseId, 'current');
    const previousPeriod = await this.getFranchisePerformance(tenantId, franchiseId, 'previous');

    return {
      franchise: {
        id: franchise.id,
        name: franchise.name,
        type: franchise.type,
        status: franchise.status,
        territory: franchise.primaryTerritoryId || 'N/A',
      },
      performance: {
        currentPeriod,
        previousPeriod,
        trends: {
          salesGrowth: currentPeriod.salesMetrics.salesGrowth,
          revenueGrowth: ((currentPeriod.financialMetrics.revenue - previousPeriod.financialMetrics.revenue) / previousPeriod.financialMetrics.revenue) * 100,
        },
      },
      locations: locations.length,
      availableActions: access.allowedModules,
      notifications: [], // Would be populated from notification service
      quickLinks: [
        { name: 'Sales Report', url: `/dealer/sales/${franchiseId}` },
        { name: 'Inventory', url: `/dealer/inventory/${franchiseId}` },
        { name: 'Performance', url: `/dealer/performance/${franchiseId}` },
      ],
    };
  }

  async getFranchisePerformance(tenantId: string, franchiseId: string, period: string): Promise<any> {
    // Validate franchise exists
    await this.getFranchiseById(tenantId, franchiseId);
    
    // Mock performance data - in real implementation, this would query analytics/reporting services
    const mockPerformance = {
      franchiseId,
      period,
      salesMetrics: {
        totalSales: period === 'current' ? 125000 : 110000,
        salesGrowth: period === 'current' ? 13.6 : 8.2,
        averageTransactionValue: period === 'current' ? 45.50 : 42.30,
        transactionCount: period === 'current' ? 2747 : 2601,
      },
      financialMetrics: {
        revenue: period === 'current' ? 125000 : 110000,
        royaltyPaid: period === 'current' ? 6250 : 5500,
        marketingFeePaid: period === 'current' ? 2500 : 2200,
        profitMargin: period === 'current' ? 0.18 : 0.16,
      },
      operationalMetrics: {
        customerSatisfaction: period === 'current' ? 4.2 : 4.0,
        employeeCount: period === 'current' ? 12 : 11,
        inventoryTurnover: period === 'current' ? 8.5 : 7.8,
        complianceScore: period === 'current' ? 92 : 89,
      },
      territoryMetrics: {
        marketShare: period === 'current' ? 0.15 : 0.14,
        territoryPenetration: period === 'current' ? 0.68 : 0.65,
        competitorAnalysis: {},
      },
    };

    return mockPerformance;
  }

  async assignLocationToFranchise(tenantId: string, dto: any, userId: string): Promise<any> {
    // Validate franchise exists
    await this.getFranchiseById(tenantId, dto.franchiseId);
    
    // Validate location exists (would need to inject LocationService)
    // For now, assume location exists
    
    // Create franchise location assignment
    const franchiseLocation = await this.franchiseRepository.createFranchiseLocation(tenantId, {
      franchiseId: dto.franchiseId,
      locationId: dto.locationId,
      role: dto.role || 'primary',
      effectiveDate: dto.effectiveDate || new Date().toISOString(),
      expirationDate: dto.expirationDate,
      settings: dto.settings || {},
    }, userId);

    // Emit event
    this.eventEmitter.emit('franchise.location.assigned', {
      tenantId,
      franchiseLocation,
      userId,
    });

    return franchiseLocation;
  }

  async grantFranchisePermission(tenantId: string, dto: any, userId: string): Promise<any> {
    // Validate franchise exists
    await this.getFranchiseById(tenantId, dto.franchiseId);
    
    // Create franchise permission
    const permission = await this.franchiseRepository.createFranchisePermission(tenantId, {
      franchiseId: dto.franchiseId,
      userId: dto.userId,
      permissions: dto.permissions || [],
      role: dto.role || 'operator',
      effectiveDate: dto.effectiveDate || new Date().toISOString(),
      expirationDate: dto.expirationDate,
    }, userId);

    // Emit event
    this.eventEmitter.emit('franchise.permission.granted', {
      tenantId,
      permission,
      userId,
    });

    return permission;
  }

  async assignTerritoryToFranchise(tenantId: string, dto: any, userId: string): Promise<any> {
    // Validate franchise and territory exist
    await this.getFranchiseById(tenantId, dto.franchiseId);
    await this.getTerritoryById(tenantId, dto.territoryId);
    
    // Create territory assignment
    const assignment = await this.franchiseRepository.createTerritoryAssignment(tenantId, {
      territoryId: dto.territoryId,
      franchiseId: dto.franchiseId,
      userId: dto.userId,
      assignmentType: dto.assignmentType || 'franchise',
      effectiveDate: dto.effectiveDate || new Date().toISOString(),
      expirationDate: dto.expirationDate,
      reason: dto.reason,
      metadata: dto.metadata || {},
    }, userId);

    // Emit event
    this.eventEmitter.emit('territory.assigned', {
      tenantId,
      assignment,
      userId,
    });

    return assignment;
  }

  async createTerritoryAssignment(tenantId: string, dto: any, userId: string): Promise<any> {
    // Validate territory exists
    await this.getTerritoryById(tenantId, dto.territoryId);
    
    // Validate franchise exists if provided
    if (dto.franchiseId) {
      await this.getFranchiseById(tenantId, dto.franchiseId);
    }
    
    // Create territory assignment
    const assignment = await this.franchiseRepository.createTerritoryAssignment(tenantId, dto, userId);

    // Emit event
    this.eventEmitter.emit('territory.assignment.created', {
      tenantId,
      assignment,
      userId,
    });

    return assignment;
  }
}