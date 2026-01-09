import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DrizzleService } from './drizzle.service';
import { CustomLoggerService } from '../logger/logger.service';
import { tenants, users } from './schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly configService: ConfigService,
    private readonly customLogger: CustomLoggerService,
  ) {
    this.customLogger.setContext('SeedService');
  }

  async seedDatabase(): Promise<void> {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    
    if (nodeEnv === 'production') {
      this.logger.warn('Skipping database seeding in production environment');
      return;
    }

    try {
      this.logger.log('Starting database seeding...');
      
      await this.seedTenants();
      await this.seedUsers();
      
      this.logger.log('Database seeding completed successfully');
    } catch (error) {
      this.logger.error('Database seeding failed', error);
      throw error;
    }
  }

  private async seedTenants(): Promise<void> {
    const db = this.drizzleService.getDb();
    
    const existingTenants = await db.select().from(tenants).limit(1);
    
    if (existingTenants.length > 0) {
      this.logger.log('Tenants already exist, skipping tenant seeding');
      return;
    }

    const seedTenants = [
      {
        name: 'Demo Micro Business',
        slug: 'demo-micro',
        businessTier: 'micro' as const,
        subscriptionStatus: 'trial' as const,
        contactEmail: 'demo-micro@example.com',
        settings: {
          currency: 'USD',
          timezone: 'America/New_York',
          dateFormat: 'MM/DD/YYYY',
        },
        metrics: {
          employeeCount: 2,
          locationCount: 1,
          monthlyTransactionVolume: 150,
          monthlyRevenue: 5000,
        },
      },
      {
        name: 'Demo Small Business',
        slug: 'demo-small',
        businessTier: 'small' as const,
        subscriptionStatus: 'active' as const,
        contactEmail: 'demo-small@example.com',
        settings: {
          currency: 'USD',
          timezone: 'America/Los_Angeles',
          dateFormat: 'MM/DD/YYYY',
        },
        metrics: {
          employeeCount: 12,
          locationCount: 2,
          monthlyTransactionVolume: 800,
          monthlyRevenue: 25000,
        },
      },
      {
        name: 'Demo Medium Business',
        slug: 'demo-medium',
        businessTier: 'medium' as const,
        subscriptionStatus: 'active' as const,
        contactEmail: 'demo-medium@example.com',
        settings: {
          currency: 'USD',
          timezone: 'America/Chicago',
          dateFormat: 'MM/DD/YYYY',
        },
        metrics: {
          employeeCount: 45,
          locationCount: 5,
          monthlyTransactionVolume: 3500,
          monthlyRevenue: 150000,
        },
      },
    ];

    for (const tenant of seedTenants) {
      await db.insert(tenants).values(tenant);
      this.logger.log(`Created tenant: ${tenant.name}`);
    }

    this.customLogger.audit('seed_tenants', {
      tenantsCreated: seedTenants.length,
      tenantSlugs: seedTenants.map(t => t.slug),
    });
  }

  private async seedUsers(): Promise<void> {
    const db = this.drizzleService.getDb();
    
    // Get all tenants
    const allTenants = await db.select().from(tenants);
    
    for (const tenant of allTenants) {
      // Check if users already exist for this tenant
      const existingUsers = await db
        .select()
        .from(users)
        .where(eq(users.tenantId, tenant.id))
        .limit(1);
      
      if (existingUsers.length > 0) {
        this.logger.log(`Users already exist for tenant ${tenant.name}, skipping`);
        continue;
      }

      // Create admin user for each tenant
      const adminUser = {
        tenantId: tenant.id,
        email: `admin@${tenant.slug}.example.com`,
        passwordHash: await this.hashPassword('admin123'), // In real app, use proper hashing
        firstName: 'Admin',
        lastName: 'User',
        displayName: 'Administrator',
        role: 'tenant_admin' as const,
        emailVerified: true,
        permissions: [
          'users:create',
          'users:read',
          'users:update',
          'users:delete',
          'pos:create',
          'pos:read',
          'inventory:create',
          'inventory:read',
          'inventory:update',
          'customers:create',
          'customers:read',
          'customers:update',
          'reports:read',
        ],
        preferences: {
          theme: 'light',
          language: 'en',
          notifications: {
            email: true,
            push: true,
            sms: false,
          },
        },
      };

      await db.insert(users).values(adminUser);
      this.logger.log(`Created admin user for tenant: ${tenant.name}`);

      // Create a regular employee user
      const employeeUser = {
        tenantId: tenant.id,
        email: `employee@${tenant.slug}.example.com`,
        passwordHash: await this.hashPassword('employee123'),
        firstName: 'John',
        lastName: 'Employee',
        displayName: 'John Employee',
        role: 'employee' as const,
        emailVerified: true,
        employeeId: 'EMP001',
        department: 'Sales',
        position: 'Sales Associate',
        permissions: [
          'pos:create',
          'pos:read',
          'inventory:read',
          'customers:read',
          'customers:update',
        ],
        preferences: {
          theme: 'light',
          language: 'en',
          notifications: {
            email: true,
            push: true,
            sms: false,
          },
        },
      };

      await db.insert(users).values(employeeUser);
      this.logger.log(`Created employee user for tenant: ${tenant.name}`);
    }

    this.customLogger.audit('seed_users', {
      tenantsProcessed: allTenants.length,
      usersCreatedPerTenant: 2,
    });
  }

  private async hashPassword(password: string): Promise<string> {
    // In a real application, use bcrypt or similar
    // This is just for demo purposes
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  async clearDatabase(): Promise<void> {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    
    if (nodeEnv === 'production') {
      throw new Error('Cannot clear database in production environment');
    }

    const db = this.drizzleService.getDb();
    
    this.logger.warn('Clearing all database data...');
    
    // Clear in reverse dependency order
    await db.delete(users);
    await db.delete(tenants);
    
    this.logger.warn('Database cleared successfully');
    
    this.customLogger.audit('database_cleared', {
      environment: nodeEnv,
      timestamp: new Date().toISOString(),
    });
  }
}