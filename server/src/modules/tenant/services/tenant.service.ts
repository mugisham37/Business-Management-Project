import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { eq, and, or, like, desc, asc, count } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { tenants, auditLogs } from '../../database/schema';
import { BusinessMetricsService } from './business-metrics.service';
import { CustomLoggerService } from '../../logger/logger.service';
import { 
  CreateTenantDto, 
  UpdateTenantDto, 
  UpdateBusinessMetricsDto,
  TenantQueryDto,
} from '../dto/tenant.dto';
import { Tenant, BusinessTier, SubscriptionStatus } from '../entities/tenant.entity';

@Injectable()
export class TenantService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly businessMetricsService: BusinessMetricsService,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * Create a new tenant with initial configuration
   */
  async create(createTenantDto: CreateTenantDto, createdBy?: string): Promise<Tenant> {
    const { slug, name, contactEmail, contactPhone, settings, metrics } = createTenantDto;

    // Check if slug is already taken
    const existingTenant = await this.findBySlug(slug);
    if (existingTenant) {
      throw new ConflictException(`Tenant with slug '${slug}' already exists`);
    }

    // Set default metrics if not provided
    const defaultMetrics = {
      employeeCount: 0,
      locationCount: 1,
      monthlyTransactionVolume: 0,
      monthlyRevenue: 0,
      ...metrics,
    };

    // Calculate initial business tier
    const businessTier = this.businessMetricsService.calculateBusinessTier(defaultMetrics);

    // Set trial end date (30 days from now)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    try {
      const [newTenant] = await this.drizzle.getDb()
        .insert(tenants)
        .values({
          name,
          slug,
          businessTier,
          subscriptionStatus: SubscriptionStatus.TRIAL,
          contactEmail,
          contactPhone,
          settings: settings || {},
          metrics: defaultMetrics,
          trialEndDate,
          createdBy,
        })
        .returning();

      if (!newTenant) {
        throw new Error('Failed to create tenant: No data returned');
      }

      this.logger.log(`Created new tenant: ${name} (${slug})`);

      // Log audit event
      await this.logAuditEvent('create', newTenant.id, null, newTenant, createdBy);

      return this.mapToEntity(newTenant);
    } catch (error) {
      const errorMessage = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack;
      this.logger.error(`Failed to create tenant: ${errorMessage}`, errorStack);
      throw new BadRequestException('Failed to create tenant');
    }
  }

  /**
   * Find tenant by ID
   */
  async findById(id: string): Promise<Tenant | null> {
    try {
      const [tenant] = await this.drizzle.getDb()
        .select()
        .from(tenants)
        .where(and(eq(tenants.id, id), eq(tenants.isActive, true)));

      return tenant ? this.mapToEntity(tenant) : null;
    } catch (error) {
      const errorMessage = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack;
      this.logger.error(`Failed to find tenant by ID: ${errorMessage}`, errorStack);
      return null;
    }
  }

  /**
   * Find tenant by slug
   */
  async findBySlug(slug: string): Promise<Tenant | null> {
    try {
      const [tenant] = await this.drizzle.getDb()
        .select()
        .from(tenants)
        .where(and(eq(tenants.slug, slug), eq(tenants.isActive, true)));

      return tenant ? this.mapToEntity(tenant) : null;
    } catch (error) {
      const errorMessage = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack;
      this.logger.error(`Failed to find tenant by slug: ${errorMessage}`, errorStack);
      return null;
    }
  }

  /**
   * Find all tenants with filtering and pagination
   */
  async findAll(query: TenantQueryDto): Promise<{ tenants: Tenant[]; total: number }> {
    const { businessTier, subscriptionStatus, isActive, search, page = 1, limit = 20 } = query;
    const offset = (page - 1) * limit;

    try {
      // Build where conditions
      const conditions: any[] = [eq(tenants.isActive, isActive ?? true)];

      if (businessTier) {
        conditions.push(eq(tenants.businessTier, businessTier));
      }

      if (subscriptionStatus) {
        conditions.push(eq(tenants.subscriptionStatus, subscriptionStatus));
      }

      if (search) {
        conditions.push(
          or(
            like(tenants.name, `%${search}%`),
            like(tenants.slug, `%${search}%`),
          ) as any,
        );
      }

      // Get total count
      const countResult = await this.drizzle.getDb()
        .select({ count: count() })
        .from(tenants)
        .where(and(...conditions));

      const total = countResult?.[0]?.count ?? 0;

      // Get paginated results
      const results = await this.drizzle.getDb()
        .select()
        .from(tenants)
        .where(and(...conditions))
        .orderBy(desc(tenants.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        tenants: results.map(tenant => this.mapToEntity(tenant)),
        total,
      };
    } catch (error) {
      const errorMessage = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack;
      this.logger.error(`Failed to find tenants: ${errorMessage}`, errorStack);
      throw new BadRequestException('Failed to retrieve tenants');
    }
  }

  /**
   * Update tenant information
   */
  async update(id: string, updateTenantDto: UpdateTenantDto, updatedBy?: string): Promise<Tenant> {
    const existingTenant = await this.findById(id);
    if (!existingTenant) {
      throw new NotFoundException(`Tenant with ID '${id}' not found`);
    }

    // Check slug uniqueness if being updated
    if (updateTenantDto.slug && updateTenantDto.slug !== existingTenant.slug) {
      const slugExists = await this.findBySlug(updateTenantDto.slug);
      if (slugExists) {
        throw new ConflictException(`Tenant with slug '${updateTenantDto.slug}' already exists`);
      }
    }

    try {
      const [updatedTenant] = await this.drizzle.getDb()
        .update(tenants)
        .set({
          ...updateTenantDto,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, id))
        .returning();

      if (!updatedTenant) {
        throw new Error('Failed to update tenant: No data returned');
      }

      this.logger.log(`Updated tenant: ${updatedTenant.name} (${id})`);

      // Log audit event
      await this.logAuditEvent('update', id, existingTenant, updatedTenant, updatedBy);

      return this.mapToEntity(updatedTenant);
    } catch (error) {
      const errorMessage = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack;
      this.logger.error(`Failed to update tenant: ${errorMessage}`, errorStack);
      throw new BadRequestException('Failed to update tenant');
    }
  }

  /**
   * Update business metrics and recalculate tier
   */
  async updateBusinessMetrics(
    id: string, 
    metricsDto: UpdateBusinessMetricsDto, 
    updatedBy?: string,
  ): Promise<Tenant> {
    const existingTenant = await this.findById(id);
    if (!existingTenant) {
      throw new NotFoundException(`Tenant with ID '${id}' not found`);
    }

    // Merge existing metrics with updates
    const updatedMetrics = {
      ...existingTenant.metrics,
      ...metricsDto,
    };

    // Recalculate business tier
    const newBusinessTier = this.businessMetricsService.calculateBusinessTier(updatedMetrics);

    try {
      const [updatedTenant] = await this.drizzle.getDb()
        .update(tenants)
        .set({
          metrics: updatedMetrics,
          businessTier: newBusinessTier,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, id))
        .returning();

      if (!updatedTenant) {
        throw new Error('Failed to update business metrics: No data returned');
      }

      this.logger.log(
        `Updated business metrics for tenant: ${updatedTenant.name} (${id}). New tier: ${newBusinessTier}`
      );

      // Log audit event
      await this.logAuditEvent('update', id, existingTenant, updatedTenant, updatedBy);

      return this.mapToEntity(updatedTenant);
    } catch (error) {
      const errorMessage = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack;
      this.logger.error(`Failed to update business metrics: ${errorMessage}`, errorStack);
      throw new BadRequestException('Failed to update business metrics');
    }
  }

  /**
   * Soft delete a tenant
   */
  async delete(id: string, deletedBy?: string): Promise<void> {
    const existingTenant = await this.findById(id);
    if (!existingTenant) {
      throw new NotFoundException(`Tenant with ID '${id}' not found`);
    }

    try {
      await this.drizzle.getDb()
        .update(tenants)
        .set({
          isActive: false,
          deletedAt: new Date(),
          updatedBy: deletedBy,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, id));

      this.logger.log(`Soft deleted tenant: ${existingTenant.name} (${id})`);

      // Log audit event
      await this.logAuditEvent('delete', id, existingTenant, null, deletedBy);
    } catch (error) {
      const errorMessage = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack;
      this.logger.error(`Failed to delete tenant: ${errorMessage}`, errorStack);
      throw new BadRequestException('Failed to delete tenant');
    }
  }

  /**
   * Get tenant context for request processing
   */
  async getTenantContext(tenantId: string): Promise<{
    tenant: Tenant;
    businessTier: BusinessTier;
    isActive: boolean;
  }> {
    const tenant = await this.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID '${tenantId}' not found`);
    }

    return {
      tenant,
      businessTier: tenant.businessTier,
      isActive: tenant.isActive,
    };
  }

  /**
   * Check if tenant exists and is active
   */
  async isValidTenant(tenantId: string): Promise<boolean> {
    try {
      const tenant = await this.findById(tenantId);
      return tenant !== null && tenant.isActive;
    } catch {
      return false;
    }
  }

  /**
   * Map database record to entity
   */
  private mapToEntity(record: any): Tenant {
    return {
      id: record.id,
      name: record.name,
      slug: record.slug,
      businessTier: record.businessTier,
      subscriptionStatus: record.subscriptionStatus,
      settings: record.settings || {},
      metrics: record.metrics || {
        employeeCount: 0,
        locationCount: 1,
        monthlyTransactionVolume: 0,
        monthlyRevenue: 0,
      },
      contactEmail: record.contactEmail,
      contactPhone: record.contactPhone,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      subscriptionStartDate: record.subscriptionStartDate,
      subscriptionEndDate: record.subscriptionEndDate,
      trialEndDate: record.trialEndDate,
      isActive: record.isActive,
    };
  }

  /**
   * Log audit events for tenant operations
   */
  private async logAuditEvent(
    action: string,
    tenantId: string,
    oldValues: any,
    newValues: any,
    userId?: string,
  ): Promise<void> {
    try {
      await this.drizzle.getDb().insert(auditLogs).values({
        tenantId,
        userId,
        action: action as any,
        resource: 'tenant',
        resourceId: tenantId,
        oldValues,
        newValues,
        metadata: {
          service: 'TenantService',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      const errorMessage = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack;
      this.logger.error(`Failed to log audit event: ${errorMessage}`, errorStack);
    }
  }
}