import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { 
  salesTerritories, 
  territoryCustomerAssignments,
  customers,
  users,
  b2bOrders
} from '../../database/schema';
import { eq, and, or, gte, lte, desc, asc, sql, isNull, ilike, not, inArray, sum } from 'drizzle-orm';
import { CreateTerritoryDto, UpdateTerritoryDto, TerritoryQueryDto, AssignCustomerToTerritoryDto, BulkAssignCustomersDto, TerritoryType } from '../dto/territory.dto';

export interface Territory {
  id: string;
  tenantId: string;
  territoryCode: string;
  name: string;
  description?: string;
  territoryType: TerritoryType;
  isActive: boolean;
  geographicBounds: Record<string, any>;
  industryCriteria: string[];
  accountSizeCriteria: Record<string, any>;
  productLineCriteria: string[];
  customCriteria: Record<string, any>;
  primarySalesRepId?: string;
  secondarySalesRepIds: string[];
  managerId?: string;
  annualRevenueTarget?: number | null;
  quarterlyRevenueTarget?: number | null;
  customerAcquisitionTarget?: number;
  commissionStructure: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TerritoryCustomerAssignment {
  id: string;
  tenantId: string;
  territoryId: string;
  customerId: string;
  assignedDate: Date;
  assignedBy?: string;
  isActive: boolean;
  assignmentReason?: string;
  metadata: Record<string, any>;
}

export interface TerritoryPerformance {
  territoryId: string;
  territoryName: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  metrics: {
    totalRevenue: number;
    orderCount: number;
    customerCount: number;
    averageOrderValue: number;
    newCustomers: number;
    revenueTarget: number;
    targetAchievement: number;
  };
  salesRep: {
    id: string;
    name: string;
    totalCommission: number;
  };
}

@Injectable()
export class TerritoryService {
  private readonly logger = new Logger(TerritoryService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createTerritory(tenantId: string, data: CreateTerritoryDto, userId: string): Promise<Territory> {
    try {
      // Validate territory data
      await this.validateTerritoryData(tenantId, data);

      // Check for duplicate territory code
      const existingTerritory = await this.drizzle.getDb()
        .select()
        .from(salesTerritories)
        .where(and(
          eq(salesTerritories.tenantId, tenantId),
          eq(salesTerritories.territoryCode, data.territoryCode),
          isNull(salesTerritories.deletedAt)
        ))
        .limit(1);

      if (existingTerritory.length > 0) {
        throw new ConflictException(`Territory code ${data.territoryCode} already exists`);
      }

      // Create territory record
      const [territoryRecord] = await this.drizzle.getDb()
        .insert(salesTerritories)
        .values({
          tenantId,
          territoryCode: data.territoryCode,
          name: data.name,
          description: data.description,
          territoryType: data.territoryType,
          isActive: true,
          geographicBounds: data.geographicBounds || {},
          industryCriteria: data.industryCriteria || [],
          accountSizeCriteria: data.accountSizeCriteria || {},
          productLineCriteria: data.productLineCriteria || [],
          customCriteria: data.customCriteria || {},
          primarySalesRepId: data.primarySalesRepId,
          secondarySalesRepIds: data.secondarySalesRepIds || [],
          managerId: data.managerId,
          annualRevenueTarget: data.annualRevenueTarget?.toString(),
          quarterlyRevenueTarget: data.quarterlyRevenueTarget?.toString(),
          customerAcquisitionTarget: data.customerAcquisitionTarget,
          commissionStructure: data.commissionStructure || {},
          metadata: data.metadata || {},
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      if (!territoryRecord) {
        throw new Error('Failed to create territory');
      }

      // Clear caches
      await this.invalidateTerritoryCaches(tenantId);

      // Emit event
      this.eventEmitter.emit('territory.created', {
        tenantId,
        territoryId: territoryRecord.id,
        territoryCode: data.territoryCode,
        territoryType: data.territoryType,
        primarySalesRepId: data.primarySalesRepId,
        userId,
      });

      this.logger.log(`Created territory ${territoryRecord.territoryCode} for tenant ${tenantId}`);
      return this.mapToTerritory(territoryRecord);
    } catch (error) {
      this.logger.error(`Failed to create territory for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findTerritoryById(tenantId: string, territoryId: string): Promise<Territory> {
    try {
      const cacheKey = `territory:${tenantId}:${territoryId}`;
      
      // Try cache first
      let territory = await this.cacheService.get<Territory>(cacheKey);
      
      if (!territory) {
        const [territoryRecord] = await this.drizzle.getDb()
          .select()
          .from(salesTerritories)
          .where(and(
            eq(salesTerritories.tenantId, tenantId),
            eq(salesTerritories.id, territoryId),
            isNull(salesTerritories.deletedAt)
          ));

        if (!territoryRecord) {
          throw new NotFoundException(`Territory ${territoryId} not found`);
        }

        territory = this.mapToTerritory(territoryRecord);

        // Cache for 10 minutes
        await this.cacheService.set(cacheKey, territory, { ttl: 600 });
      }

      return territory;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to find territory ${territoryId} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findTerritories(tenantId: string, query: TerritoryQueryDto): Promise<{ territories: Territory[]; total: number }> {
    try {
      const cacheKey = `territories:${tenantId}:${JSON.stringify(query)}`;
      
      // Try cache first for common queries
      let result = await this.cacheService.get<{ territories: Territory[]; total: number }>(cacheKey);
      
      if (!result) {
        const conditions = [
          eq(salesTerritories.tenantId, tenantId),
          isNull(salesTerritories.deletedAt)
        ];

        // Add search conditions
        if (query.search) {
          conditions.push(
            or(
              ilike(salesTerritories.territoryCode, `%${query.search}%`),
              ilike(salesTerritories.name, `%${query.search}%`)
            )!
          );
        }

        // Add filter conditions
        if (query.territoryType) {
          conditions.push(eq(salesTerritories.territoryType, query.territoryType));
        }

        if (query.isActive !== undefined) {
          conditions.push(eq(salesTerritories.isActive, query.isActive));
        }

        if (query.primarySalesRepId) {
          conditions.push(eq(salesTerritories.primarySalesRepId, query.primarySalesRepId));
        }

        if (query.managerId) {
          conditions.push(eq(salesTerritories.managerId, query.managerId));
        }

        if (query.minAnnualRevenueTarget !== undefined) {
          conditions.push(gte(salesTerritories.annualRevenueTarget, query.minAnnualRevenueTarget.toString()));
        }

        if (query.maxAnnualRevenueTarget !== undefined) {
          conditions.push(lte(salesTerritories.annualRevenueTarget, query.maxAnnualRevenueTarget.toString()));
        }

        const whereClause = and(...conditions);

        // Get total count
        const [countResult] = await this.drizzle.getDb()
          .select({ count: sql<number>`count(*)` })
          .from(salesTerritories)
          .where(whereClause);

        const total = countResult?.count || 0;

        // Get paginated results
        const offset = ((query.page || 1) - 1) * (query.limit || 20);
        let sortByField: any = salesTerritories.territoryCode;
        if (query.sortBy && query.sortBy in salesTerritories) {
          const field = salesTerritories[query.sortBy as keyof typeof salesTerritories];
          if (field && typeof field !== 'function') {
            sortByField = field;
          }
        }
        const orderBy = query.sortOrder === 'asc' 
          ? asc(sortByField)
          : desc(sortByField);

        const territoriesList = await this.drizzle.getDb()
          .select()
          .from(salesTerritories)
          .where(whereClause)
          .orderBy(orderBy)
          .limit(query.limit || 20)
          .offset(offset);

        result = {
          territories: territoriesList.map(record => this.mapToTerritory(record)),
          total: total,
        };

        // Cache for 5 minutes
        await this.cacheService.set(cacheKey, result, { ttl: 300 });
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to find territories for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async updateTerritory(tenantId: string, territoryId: string, data: UpdateTerritoryDto, userId: string): Promise<Territory> {
    try {
      // Check if territory exists
      const existingTerritory = await this.findTerritoryById(tenantId, territoryId);

      // Validate update data
      if (data.primarySalesRepId !== undefined || data.secondarySalesRepIds !== undefined || data.managerId !== undefined) {
        await this.validateTerritoryUsers(tenantId, {
          primarySalesRepId: data.primarySalesRepId,
          secondarySalesRepIds: data.secondarySalesRepIds,
          managerId: data.managerId,
        });
      }

      // Update territory record
      const updateData: any = { ...data, updatedBy: userId };
      
      // Convert decimal fields to strings
      if (data.annualRevenueTarget !== undefined) {
        updateData.annualRevenueTarget = data.annualRevenueTarget.toString();
      }
      if (data.quarterlyRevenueTarget !== undefined) {
        updateData.quarterlyRevenueTarget = data.quarterlyRevenueTarget.toString();
      }

      const [updatedTerritory] = await this.drizzle.getDb()
        .update(salesTerritories)
        .set(updateData)
        .where(and(
          eq(salesTerritories.tenantId, tenantId),
          eq(salesTerritories.id, territoryId),
          isNull(salesTerritories.deletedAt)
        ))
        .returning();

      if (!updatedTerritory) {
        throw new Error(`Territory ${territoryId} not found for update`);
      }

      // Clear caches
      await this.invalidateTerritoryCaches(tenantId, territoryId);

      // Emit event
      this.eventEmitter.emit('territory.updated', {
        tenantId,
        territoryId,
        previousData: existingTerritory,
        newData: updatedTerritory,
        userId,
      });

      return this.findTerritoryById(tenantId, territoryId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to update territory ${territoryId} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async assignCustomerToTerritory(tenantId: string, territoryId: string, data: AssignCustomerToTerritoryDto, userId: string): Promise<TerritoryCustomerAssignment> {
    try {
      // Validate territory and customer exist
      await this.findTerritoryById(tenantId, territoryId);
      
      const [customer] = await this.drizzle.getDb()
        .select()
        .from(customers)
        .where(and(
          eq(customers.tenantId, tenantId),
          eq(customers.id, data.customerId),
          isNull(customers.deletedAt)
        ));

      if (!customer) {
        throw new NotFoundException(`Customer ${data.customerId} not found`);
      }

      // Check if customer is already assigned to this territory
      const existingAssignment = await this.drizzle.getDb()
        .select()
        .from(territoryCustomerAssignments)
        .where(and(
          eq(territoryCustomerAssignments.tenantId, tenantId),
          eq(territoryCustomerAssignments.territoryId, territoryId),
          eq(territoryCustomerAssignments.customerId, data.customerId),
          eq(territoryCustomerAssignments.isActive, true),
          isNull(territoryCustomerAssignments.deletedAt)
        ))
        .limit(1);

      if (existingAssignment.length > 0) {
        throw new ConflictException(`Customer ${data.customerId} is already assigned to this territory`);
      }

      // Deactivate any existing assignments for this customer
      await this.drizzle.getDb()
        .update(territoryCustomerAssignments)
        .set({
          isActive: false,
          updatedBy: userId,
        })
        .where(and(
          eq(territoryCustomerAssignments.tenantId, tenantId),
          eq(territoryCustomerAssignments.customerId, data.customerId),
          eq(territoryCustomerAssignments.isActive, true)
        ));

      // Create new assignment
      const [assignmentRecord] = await this.drizzle.getDb()
        .insert(territoryCustomerAssignments)
        .values({
          tenantId,
          territoryId,
          customerId: data.customerId,
          assignedDate: new Date(),
          assignedBy: userId,
          isActive: true,
          assignmentReason: data.assignmentReason || 'manual',
          metadata: {},
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      // Clear caches
      await this.invalidateTerritoryCaches(tenantId, territoryId);

      // Emit event
      this.eventEmitter.emit('territory.customer-assigned', {
        tenantId,
        territoryId,
        customerId: data.customerId,
        assignmentReason: data.assignmentReason,
        assignedBy: userId,
      });

      this.logger.log(`Assigned customer ${data.customerId} to territory ${territoryId}`);
      return this.mapToTerritoryCustomerAssignment(assignmentRecord);
    } catch (error) {
      this.logger.error(`Failed to assign customer to territory:`, error);
      throw error;
    }
  }

  async bulkAssignCustomers(tenantId: string, territoryId: string, data: BulkAssignCustomersDto, userId: string): Promise<TerritoryCustomerAssignment[]> {
    try {
      // Validate territory exists
      await this.findTerritoryById(tenantId, territoryId);

      // Validate all customers exist
      const existingCustomers = await this.drizzle.getDb()
        .select({ id: customers.id })
        .from(customers)
        .where(and(
          eq(customers.tenantId, tenantId),
          inArray(customers.id, data.customerIds),
          isNull(customers.deletedAt)
        ));

      const existingCustomerIds = existingCustomers.map(c => c.id);
      const missingCustomers = data.customerIds.filter(id => !existingCustomerIds.includes(id));
      
      if (missingCustomers.length > 0) {
        throw new BadRequestException(`Customers not found: ${missingCustomers.join(', ')}`);
      }

      // Deactivate existing assignments for these customers
      await this.drizzle.getDb()
        .update(territoryCustomerAssignments)
        .set({
          isActive: false,
          updatedBy: userId,
        })
        .where(and(
          eq(territoryCustomerAssignments.tenantId, tenantId),
          inArray(territoryCustomerAssignments.customerId, data.customerIds),
          eq(territoryCustomerAssignments.isActive, true)
        ));

      // Create new assignments
      const assignmentData = data.customerIds.map(customerId => ({
        tenantId,
        territoryId,
        customerId,
        assignedDate: new Date(),
        assignedBy: userId,
        isActive: true,
        assignmentReason: data.assignmentReason || 'bulk_assignment',
        metadata: {},
        createdBy: userId,
        updatedBy: userId,
      }));

      const assignments = await this.drizzle.getDb()
        .insert(territoryCustomerAssignments)
        .values(assignmentData)
        .returning();

      // Clear caches
      await this.invalidateTerritoryCaches(tenantId, territoryId);

      // Emit event
      this.eventEmitter.emit('territory.customers-bulk-assigned', {
        tenantId,
        territoryId,
        customerIds: data.customerIds,
        assignmentReason: data.assignmentReason,
        assignedBy: userId,
      });

      this.logger.log(`Bulk assigned ${data.customerIds.length} customers to territory ${territoryId}`);
      return assignments.map(record => this.mapToTerritoryCustomerAssignment(record));
    } catch (error) {
      this.logger.error(`Failed to bulk assign customers to territory:`, error);
      throw error;
    }
  }

  async getTerritoryCustomers(tenantId: string, territoryId: string): Promise<any[]> {
    try {
      const territoryCustomers = await this.drizzle.getDb()
        .select({
          assignment: territoryCustomerAssignments,
          customer: customers,
        })
        .from(territoryCustomerAssignments)
        .innerJoin(customers, eq(territoryCustomerAssignments.customerId, customers.id))
        .where(and(
          eq(territoryCustomerAssignments.tenantId, tenantId),
          eq(territoryCustomerAssignments.territoryId, territoryId),
          eq(territoryCustomerAssignments.isActive, true),
          isNull(territoryCustomerAssignments.deletedAt),
          isNull(customers.deletedAt)
        ))
        .orderBy(asc(customers.companyName));

      return territoryCustomers.map(row => ({
        assignment: this.mapToTerritoryCustomerAssignment(row.assignment),
        customer: row.customer,
      }));
    } catch (error) {
      this.logger.error(`Failed to get territory customers for ${territoryId}:`, error);
      throw error;
    }
  }

  async getTerritoryPerformance(tenantId: string, territoryId: string, startDate: Date, endDate: Date): Promise<TerritoryPerformance> {
    try {
      const territory = await this.findTerritoryById(tenantId, territoryId);

      // Get territory customers
      const territoryCustomers = await this.getTerritoryCustomers(tenantId, territoryId);
      const customerIds = territoryCustomers.map(tc => tc.customer.id);

      if (customerIds.length === 0) {
        return {
          territoryId,
          territoryName: territory.name,
          period: { startDate, endDate },
          metrics: {
            totalRevenue: 0,
            orderCount: 0,
            customerCount: 0,
            averageOrderValue: 0,
            newCustomers: 0,
            revenueTarget: territory.annualRevenueTarget || 0,
            targetAchievement: 0,
          },
          salesRep: {
            id: territory.primarySalesRepId || '',
            name: '',
            totalCommission: 0,
          },
        };
      }

      // Get performance metrics from orders
      const [performanceMetrics] = await this.drizzle.getDb()
        .select({
          totalRevenue: sum(b2bOrders.totalAmount),
          orderCount: sql<number>`count(*)`,
        })
        .from(b2bOrders)
        .where(and(
          eq(b2bOrders.tenantId, tenantId),
          inArray(b2bOrders.customerId, customerIds),
          gte(b2bOrders.orderDate, startDate),
          lte(b2bOrders.orderDate, endDate),
          not(eq(b2bOrders.status, 'cancelled')),
          isNull(b2bOrders.deletedAt)
        ));

      const totalRevenue = parseFloat(performanceMetrics?.totalRevenue || '0');
      const orderCount = performanceMetrics?.orderCount || 0;
      const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

      // Get new customers in period
      const [newCustomersResult] = await this.drizzle.getDb()
        .select({
          newCustomers: sql<number>`count(*)`,
        })
        .from(territoryCustomerAssignments)
        .where(and(
          eq(territoryCustomerAssignments.tenantId, tenantId),
          eq(territoryCustomerAssignments.territoryId, territoryId),
          gte(territoryCustomerAssignments.assignedDate, startDate),
          lte(territoryCustomerAssignments.assignedDate, endDate),
          eq(territoryCustomerAssignments.isActive, true),
          isNull(territoryCustomerAssignments.deletedAt)
        ));

      const newCustomers = newCustomersResult?.newCustomers || 0;

      // Calculate target achievement
      const annualTarget = territory.annualRevenueTarget || 0;
      const targetAchievement = annualTarget > 0 ? (totalRevenue / annualTarget) * 100 : 0;

      // Get sales rep info
      let salesRepInfo = { id: '', name: '', totalCommission: 0 };
      if (territory.primarySalesRepId) {
        const [salesRep] = await this.drizzle.getDb()
          .select()
          .from(users)
          .where(and(
            eq(users.tenantId, tenantId),
            eq(users.id, territory.primarySalesRepId),
            isNull(users.deletedAt)
          ));

        if (salesRep) {
          salesRepInfo = {
            id: salesRep.id,
            name: `${salesRep.firstName} ${salesRep.lastName}`,
            totalCommission: 0, // Would calculate based on commission structure
          };
        }
      }

      return {
        territoryId,
        territoryName: territory.name,
        period: { startDate, endDate },
        metrics: {
          totalRevenue,
          orderCount,
          customerCount: territoryCustomers.length,
          averageOrderValue,
          newCustomers,
          revenueTarget: annualTarget,
          targetAchievement,
        },
        salesRep: salesRepInfo,
      };
    } catch (error) {
      this.logger.error(`Failed to get territory performance for ${territoryId}:`, error);
      throw error;
    }
  }

  private async validateTerritoryData(tenantId: string, data: CreateTerritoryDto): Promise<void> {
    await this.validateTerritoryUsers(tenantId, {
      primarySalesRepId: data.primarySalesRepId,
      secondarySalesRepIds: data.secondarySalesRepIds,
      managerId: data.managerId,
    });
  }

  private async validateTerritoryUsers(tenantId: string, userData: {
    primarySalesRepId?: string | undefined;
    secondarySalesRepIds?: string[] | undefined;
    managerId?: string | undefined;
  }): Promise<void> {
    const userIds = [
      userData.primarySalesRepId,
      userData.managerId,
      ...(userData.secondarySalesRepIds || [])
    ].filter((id): id is string => Boolean(id));

    if (userIds.length > 0) {
      const existingUsers = await this.drizzle.getDb()
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.tenantId, tenantId),
          inArray(users.id, userIds),
          isNull(users.deletedAt)
        ));

      const existingUserIds = existingUsers.map(u => u.id);
      const missingUsers = userIds.filter(id => !existingUserIds.includes(id));
      
      if (missingUsers.length > 0) {
        throw new NotFoundException(`Users not found: ${missingUsers.join(', ')}`);
      }
    }
  }

  private mapToTerritory(territoryRecord: any): Territory {
    return {
      id: territoryRecord.id,
      tenantId: territoryRecord.tenantId,
      territoryCode: territoryRecord.territoryCode,
      name: territoryRecord.name,
      description: territoryRecord.description,
      territoryType: territoryRecord.territoryType,
      isActive: territoryRecord.isActive,
      geographicBounds: territoryRecord.geographicBounds || {},
      industryCriteria: territoryRecord.industryCriteria || [],
      accountSizeCriteria: territoryRecord.accountSizeCriteria || {},
      productLineCriteria: territoryRecord.productLineCriteria || [],
      customCriteria: territoryRecord.customCriteria || {},
      primarySalesRepId: territoryRecord.primarySalesRepId,
      secondarySalesRepIds: territoryRecord.secondarySalesRepIds || [],
      managerId: territoryRecord.managerId,
      annualRevenueTarget: territoryRecord.annualRevenueTarget ? parseFloat(territoryRecord.annualRevenueTarget) : null,
      quarterlyRevenueTarget: territoryRecord.quarterlyRevenueTarget ? parseFloat(territoryRecord.quarterlyRevenueTarget) : null,
      customerAcquisitionTarget: territoryRecord.customerAcquisitionTarget,
      commissionStructure: territoryRecord.commissionStructure || {},
      metadata: territoryRecord.metadata || {},
      createdAt: territoryRecord.createdAt,
      updatedAt: territoryRecord.updatedAt,
    };
  }

  private mapToTerritoryCustomerAssignment(assignmentRecord: any): TerritoryCustomerAssignment {
    return {
      id: assignmentRecord.id,
      tenantId: assignmentRecord.tenantId,
      territoryId: assignmentRecord.territoryId,
      customerId: assignmentRecord.customerId,
      assignedDate: assignmentRecord.assignedDate,
      assignedBy: assignmentRecord.assignedBy,
      isActive: assignmentRecord.isActive,
      assignmentReason: assignmentRecord.assignmentReason,
      metadata: assignmentRecord.metadata || {},
    };
  }

  private async invalidateTerritoryCaches(tenantId: string, territoryId?: string): Promise<void> {
    try {
      await this.cacheService.invalidatePattern(`territories:${tenantId}:*`);
      
      if (territoryId) {
        await this.cacheService.invalidatePattern(`territory:${tenantId}:${territoryId}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to invalidate territory caches for tenant ${tenantId}:`, error);
    }
  }
}