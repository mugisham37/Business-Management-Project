import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, and, or, like, desc, asc, count } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { tenants, auditLogs } from '../../database/schema';
import { BusinessMetricsService } from './business-metrics.service';
import { 
  CustomLoggerService,
  LogMethodCalls,
  LogPerformance,
  LogAudit,
  LogBusiness,
  LogSensitive,
  LogDatabaseOperation,
  LogLevel,
  LogCategory,
} from '../../logger';
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
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.setContext('TenantService');
  }

  /**
   * Create a new tenant with initial configuration
   */
  @LogMethodCalls({
    level: LogLevel.INFO,
    category: LogCategory.BUSINESS,
    includeArgs: true,
    includeResult: false,
    sensitiveFields: ['contactEmail', 'contactPhone'],
  })
  @LogPerformance(2000)
  @LogAudit('tenant_created')
  @LogBusiness('new_tenant_onboarding')
  @LogSensitive(['contactEmail', 'contactPhone'])
  async create(createTenantDto: CreateTenantDto, createdBy?: string): Promise<Tenant> {
    const startTime = Date.now();
    const { slug, name, contactEmail, contactPhone, settings, metrics } = createTenantDto;

    this.logger.business('tenant_creation_started', {
      tenantName: name,
      tenantSlug: slug,
      createdBy,
      hasMetrics: !!metrics,
      hasSettings: !!settings,
    });

    // Check if slug is already taken
    const existingTenant = await this.findBySlug(slug);
    if (existingTenant) {
      this.logger.warn('Tenant creation failed: slug already exists', {
        slug,
        existingTenantId: existingTenant.id,
        attemptedBy: createdBy,
      });
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

      const duration = Date.now() - startTime;

      this.logger.audit('tenant_created', {
        tenantId: newTenant.id,
        tenantName: name,
        tenantSlug: slug,
        businessTier,
        subscriptionStatus: SubscriptionStatus.TRIAL,
        createdBy,
        trialEndDate,
      });

      this.logger.business('tenant_created', {
        tenantId: newTenant.id,
        tenantName: name,
        businessTier,
        estimatedRevenue: defaultMetrics.monthlyRevenue,
        employeeCount: defaultMetrics.employeeCount,
        locationCount: defaultMetrics.locationCount,
        revenue: 0, // New tenant, no immediate revenue
        customerImpact: 'positive',
      });

      this.logger.performance('create_tenant', duration, {
        tenantId: newTenant.id,
        businessTier,
        hasCustomMetrics: !!metrics,
      });

      // Log audit event
      await this.logAuditEvent('create', newTenant.id, null, newTenant, createdBy);

      // Emit tenant created event
      this.eventEmitter.emit('tenant.created', {
        tenantId: newTenant.id,
        tenant: this.mapToEntity(newTenant),
        timestamp: new Date(),
      });

      return this.mapToEntity(newTenant);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to create tenant: ${errorMessage}`,
        errorStack,
        {
          tenantName: name,
          tenantSlug: slug,
          createdBy,
          duration,
          businessTier,
        },
      );

      this.logger.business('tenant_creation_failed', {
        tenantName: name,
        tenantSlug: slug,
        createdBy,
        error: errorMessage,
        duration,
      });

      throw new BadRequestException('Failed to create tenant');
    }
  }

  /**
   * Find tenant by ID
   */
  @LogDatabaseOperation({ table: 'tenants', operation: 'select' })
  @LogPerformance(500)
  async findById(id: string): Promise<Tenant | null> {
    const startTime = Date.now();
    
    try {
      const [tenant] = await this.drizzle.getDb()
        .select()
        .from(tenants)
        .where(and(eq(tenants.id, id), eq(tenants.isActive, true)));

      const duration = Date.now() - startTime;
      
      this.logger.database('select', 'tenants', duration, {
        tenantId: id,
        found: !!tenant,
        query: 'findById',
      });

      return tenant ? this.mapToEntity(tenant) : null;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to find tenant by ID: ${errorMessage}`,
        errorStack,
        { tenantId: id, duration },
      );
      return null;
    }
  }

  /**
   * Find tenant by slug
   */
  @LogDatabaseOperation({ table: 'tenants', operation: 'select' })
  @LogPerformance(500)
  async findBySlug(slug: string): Promise<Tenant | null> {
    const startTime = Date.now();
    
    try {
      const [tenant] = await this.drizzle.getDb()
        .select()
        .from(tenants)
        .where(and(eq(tenants.slug, slug), eq(tenants.isActive, true)));

      const duration = Date.now() - startTime;
      
      this.logger.database('select', 'tenants', duration, {
        tenantSlug: slug,
        found: !!tenant,
        query: 'findBySlug',
      });

      return tenant ? this.mapToEntity(tenant) : null;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to find tenant by slug: ${errorMessage}`,
        errorStack,
        { tenantSlug: slug, duration },
      );
      return null;
    }
  }

  /**
   * Find all tenants with filtering and pagination
   */
  @LogMethodCalls({
    level: LogLevel.INFO,
    category: LogCategory.DATABASE,
    includeArgs: true,
    includeResult: false,
  })
  @LogPerformance(1000)
  @LogDatabaseOperation({ table: 'tenants', operation: 'select' })
  async findAll(query: TenantQueryDto): Promise<{ tenants: Tenant[]; total: number }> {
    const startTime = Date.now();
    const { businessTier, subscriptionStatus, isActive, search, page = 1, limit = 20 } = query;
    const offset = (page - 1) * limit;

    this.logger.debug('Finding tenants with query', {
      businessTier,
      subscriptionStatus,
      isActive,
      search,
      page,
      limit,
    });

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

      const duration = Date.now() - startTime;

      this.logger.database('select', 'tenants', duration, {
        query: 'findAll',
        totalCount: total,
        resultCount: results.length,
        hasFilters: !!(businessTier || subscriptionStatus || search),
        page,
        limit,
      });

      this.logger.performance('find_all_tenants', duration, {
        totalCount: total,
        resultCount: results.length,
        page,
        limit,
        hasSearch: !!search,
      });

      return {
        tenants: results.map(tenant => this.mapToEntity(tenant)),
        total,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to find tenants: ${errorMessage}`,
        errorStack,
        { query, duration },
      );
      throw new BadRequestException('Failed to retrieve tenants');
    }
  }

  /**
   * Update tenant information
   */
  @LogMethodCalls({
    level: LogLevel.INFO,
    category: LogCategory.BUSINESS,
    includeArgs: true,
    includeResult: false,
    sensitiveFields: ['contactEmail', 'contactPhone'],
  })
  @LogPerformance(1500)
  @LogAudit('tenant_updated')
  @LogBusiness('tenant_profile_updated')
  @LogSensitive(['contactEmail', 'contactPhone'])
  async update(id: string, updateTenantDto: UpdateTenantDto, updatedBy?: string): Promise<Tenant> {
    const startTime = Date.now();
    
    const existingTenant = await this.findById(id);
    if (!existingTenant) {
      this.logger.warn('Tenant update failed: tenant not found', {
        tenantId: id,
        updatedBy,
      });
      throw new NotFoundException(`Tenant with ID '${id}' not found`);
    }

    // Check slug uniqueness if being updated
    if (updateTenantDto.slug && updateTenantDto.slug !== existingTenant.slug) {
      const slugExists = await this.findBySlug(updateTenantDto.slug);
      if (slugExists) {
        this.logger.warn('Tenant update failed: slug already exists', {
          tenantId: id,
          newSlug: updateTenantDto.slug,
          existingSlug: existingTenant.slug,
          updatedBy,
        });
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

      const duration = Date.now() - startTime;

      this.logger.audit('tenant_updated', {
        tenantId: id,
        updatedBy,
        changes: Object.keys(updateTenantDto),
        previousName: existingTenant.name,
        newName: updatedTenant.name,
        previousSlug: existingTenant.slug,
        newSlug: updatedTenant.slug,
      });

      this.logger.business('tenant_updated', {
        tenantId: id,
        tenantName: updatedTenant.name,
        updatedBy,
        changeCount: Object.keys(updateTenantDto).length,
        significantChange: !!(updateTenantDto.name || updateTenantDto.slug),
      });

      this.logger.performance('update_tenant', duration, {
        tenantId: id,
        changeCount: Object.keys(updateTenantDto).length,
      });

      // Log audit event
      await this.logAuditEvent('update', id, existingTenant, updatedTenant, updatedBy);

      // Emit tenant updated event
      const mappedTenant = this.mapToEntity(updatedTenant);
      this.eventEmitter.emit('tenant.updated', {
        tenantId: id,
        tenant: mappedTenant,
        previousData: existingTenant,
        timestamp: new Date(),
      });

      return mappedTenant;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to update tenant: ${errorMessage}`,
        errorStack,
        {
          tenantId: id,
          updatedBy,
          changes: updateTenantDto,
          duration,
        },
      );

      this.logger.business('tenant_update_failed', {
        tenantId: id,
        updatedBy,
        error: errorMessage,
        duration,
      });

      throw new BadRequestException('Failed to update tenant');
    }
  }

  /**
   * Update business metrics and recalculate tier
   */
  @LogMethodCalls({
    level: LogLevel.INFO,
    category: LogCategory.BUSINESS,
    includeArgs: true,
    includeResult: false,
  })
  @LogPerformance(1000)
  @LogAudit('tenant_metrics_updated')
  @LogBusiness('business_metrics_updated')
  async updateBusinessMetrics(
    id: string, 
    metricsDto: UpdateBusinessMetricsDto, 
    updatedBy?: string,
  ): Promise<Tenant> {
    const startTime = Date.now();
    
    const existingTenant = await this.findById(id);
    if (!existingTenant) {
      this.logger.warn('Business metrics update failed: tenant not found', {
        tenantId: id,
        updatedBy,
      });
      throw new NotFoundException(`Tenant with ID '${id}' not found`);
    }

    // Merge existing metrics with updates
    const updatedMetrics = {
      ...existingTenant.metrics,
      ...metricsDto,
    };

    // Recalculate business tier
    const newBusinessTier = this.businessMetricsService.calculateBusinessTier(updatedMetrics);
    const tierChanged = existingTenant.businessTier !== newBusinessTier;

    this.logger.business('business_metrics_calculation', {
      tenantId: id,
      previousTier: existingTenant.businessTier,
      newTier: newBusinessTier,
      tierChanged,
      previousRevenue: existingTenant.metrics.monthlyRevenue,
      newRevenue: updatedMetrics.monthlyRevenue,
      previousEmployees: existingTenant.metrics.employeeCount,
      newEmployees: updatedMetrics.employeeCount,
    });

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

      const duration = Date.now() - startTime;

      this.logger.audit('tenant_metrics_updated', {
        tenantId: id,
        updatedBy,
        previousMetrics: existingTenant.metrics,
        newMetrics: updatedMetrics,
        previousTier: existingTenant.businessTier,
        newTier: newBusinessTier,
        tierChanged,
      });

      this.logger.business('business_metrics_updated', {
        tenantId: id,
        tenantName: updatedTenant.name,
        updatedBy,
        previousTier: existingTenant.businessTier,
        newTier: newBusinessTier,
        tierChanged,
        revenueChange: updatedMetrics.monthlyRevenue - existingTenant.metrics.monthlyRevenue,
        employeeChange: updatedMetrics.employeeCount - existingTenant.metrics.employeeCount,
        revenue: updatedMetrics.monthlyRevenue,
        businessUnit: newBusinessTier,
      });

      this.logger.performance('update_business_metrics', duration, {
        tenantId: id,
        tierChanged,
        metricsCount: Object.keys(metricsDto).length,
      });

      // Log audit event
      await this.logAuditEvent('update', id, existingTenant, updatedTenant, updatedBy);

      // Emit metrics updated event
      const mappedTenant = this.mapToEntity(updatedTenant);
      this.eventEmitter.emit('tenant.metrics.updated', {
        tenantId: id,
        tenant: mappedTenant,
        previousMetrics: existingTenant.metrics,
        newMetrics: updatedMetrics,
        previousTier: existingTenant.businessTier,
        newTier: newBusinessTier,
        timestamp: new Date(),
      });

      // If tier changed, emit tier change event
      if (tierChanged) {
        this.logger.business('business_tier_changed', {
          tenantId: id,
          tenantName: updatedTenant.name,
          previousTier: existingTenant.businessTier,
          newTier: newBusinessTier,
          revenue: updatedMetrics.monthlyRevenue,
          customerImpact: 'positive',
        });

        this.eventEmitter.emit('tenant.tier.changed', {
          tenantId: id,
          previousTier: existingTenant.businessTier,
          newTier: newBusinessTier,
          metrics: updatedMetrics,
          timestamp: new Date(),
        });
      }

      return mappedTenant;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to update business metrics: ${errorMessage}`,
        errorStack,
        {
          tenantId: id,
          updatedBy,
          metricsDto,
          duration,
        },
      );

      this.logger.business('business_metrics_update_failed', {
        tenantId: id,
        updatedBy,
        error: errorMessage,
        duration,
      });

      throw new BadRequestException('Failed to update business metrics');
    }
  }

  /**
   * Soft delete a tenant
   */
  @LogMethodCalls({
    level: LogLevel.WARN,
    category: LogCategory.BUSINESS,
    includeArgs: true,
    includeResult: false,
  })
  @LogPerformance(1000)
  @LogAudit('tenant_deleted')
  @LogBusiness('tenant_churned')
  async delete(id: string, deletedBy?: string): Promise<void> {
    const startTime = Date.now();
    
    const existingTenant = await this.findById(id);
    if (!existingTenant) {
      this.logger.warn('Tenant deletion failed: tenant not found', {
        tenantId: id,
        deletedBy,
      });
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

      const duration = Date.now() - startTime;

      this.logger.audit('tenant_deleted', {
        tenantId: id,
        tenantName: existingTenant.name,
        tenantSlug: existingTenant.slug,
        deletedBy,
        businessTier: existingTenant.businessTier,
        subscriptionStatus: existingTenant.subscriptionStatus,
        monthlyRevenue: existingTenant.metrics.monthlyRevenue,
      });

      this.logger.business('tenant_churned', {
        tenantId: id,
        tenantName: existingTenant.name,
        deletedBy,
        businessTier: existingTenant.businessTier,
        lostRevenue: existingTenant.metrics.monthlyRevenue,
        employeeCount: existingTenant.metrics.employeeCount,
        customerImpact: 'negative',
        revenue: -existingTenant.metrics.monthlyRevenue, // Negative revenue impact
      });

      this.logger.performance('delete_tenant', duration, {
        tenantId: id,
        businessTier: existingTenant.businessTier,
      });

      // Log audit event
      await this.logAuditEvent('delete', id, existingTenant, null, deletedBy);

      // Emit tenant deleted event
      this.eventEmitter.emit('tenant.deleted', {
        tenantId: id,
        tenant: existingTenant,
        timestamp: new Date(),
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to delete tenant: ${errorMessage}`,
        errorStack,
        {
          tenantId: id,
          deletedBy,
          duration,
        },
      );

      this.logger.business('tenant_deletion_failed', {
        tenantId: id,
        deletedBy,
        error: errorMessage,
        duration,
      });

      throw new BadRequestException('Failed to delete tenant');
    }
  }

  /**
   * Get tenant context for request processing
   */
  @LogPerformance(200)
  async getTenantContext(tenantId: string): Promise<{
    tenant: Tenant;
    businessTier: BusinessTier;
    isActive: boolean;
  }> {
    const startTime = Date.now();
    
    const tenant = await this.findById(tenantId);
    if (!tenant) {
      this.logger.warn('Tenant context request failed: tenant not found', {
        tenantId,
      });
      throw new NotFoundException(`Tenant with ID '${tenantId}' not found`);
    }

    const duration = Date.now() - startTime;
    
    this.logger.debug('Tenant context retrieved', {
      tenantId,
      businessTier: tenant.businessTier,
      isActive: tenant.isActive,
      duration,
    });

    return {
      tenant,
      businessTier: tenant.businessTier,
      isActive: tenant.isActive,
    };
  }

  /**
   * Check if tenant exists and is active
   */
  @LogPerformance(200)
  async isValidTenant(tenantId: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const tenant = await this.findById(tenantId);
      const isValid = tenant !== null && tenant.isActive;
      
      const duration = Date.now() - startTime;
      
      this.logger.debug('Tenant validation check', {
        tenantId,
        isValid,
        duration,
      });

      return isValid;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      this.logger.error(
        `Tenant validation failed: ${errorMessage}`,
        errorStack,
        { tenantId, duration },
      );
      
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
  @LogDatabaseOperation({ table: 'audit_logs', operation: 'insert' })
  private async logAuditEvent(
    action: string,
    tenantId: string,
    oldValues: any,
    newValues: any,
    userId?: string,
  ): Promise<void> {
    const startTime = Date.now();
    
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

      const duration = Date.now() - startTime;
      
      this.logger.database('insert', 'audit_logs', duration, {
        action,
        tenantId,
        userId,
        resource: 'tenant',
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      this.logger.error(
        `Failed to log audit event: ${errorMessage}`,
        errorStack,
        {
          action,
          tenantId,
          userId,
          duration,
        },
      );
    }
  }
}