import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../../modules/database/drizzle.service';
import {
  UniqueValidationService,
  ExistsValidationService,
  TenantValidationService,
  BusinessRuleValidationService,
} from '../validators/async-validators';
import { eq, and, ne, count } from 'drizzle-orm';
import { tenants, users, userSessions } from '../../../modules/database/schema';

/**
 * Comprehensive validation service implementing all async validation interfaces
 */
@Injectable()
export class ValidationService
  implements
    UniqueValidationService,
    ExistsValidationService,
    TenantValidationService,
    BusinessRuleValidationService
{
  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * Check if a field value is unique in the database
   */
  async isUnique(table: string, field: string, value: any, excludeId?: string): Promise<boolean> {
    try {
      const db = this.drizzle.getDb();
      const tableRef = this.getTableReference(table);
      if (!tableRef) {
        throw new Error(`Table ${table} not found`);
      }

      const fieldRef = tableRef[field];
      if (!fieldRef) {
        throw new Error(`Field ${field} not found in table ${table}`);
      }

      let whereCondition = eq(fieldRef, value);

      // Exclude current record if updating
      if (excludeId) {
        const idField = tableRef.id;
        if (idField) {
          whereCondition = and(whereCondition, ne(idField, excludeId)) || whereCondition;
        }
      }

      const result = await db
        .select({ count: count() })
        .from(tableRef)
        .where(whereCondition);

      return (result[0]?.count ?? 0) === 0;
    } catch (error) {
      console.error(`Unique validation error for ${table}.${field}:`, error);
      return false;
    }
  }

  /**
   * Check if a referenced entity exists
   */
  async exists(table: string, field: string, value: any): Promise<boolean> {
    try {
      const db = this.drizzle.getDb();
      const tableRef = this.getTableReference(table);
      if (!tableRef) {
        throw new Error(`Table ${table} not found`);
      }

      const fieldRef = tableRef[field];
      if (!fieldRef) {
        throw new Error(`Field ${field} not found in table ${table}`);
      }

      const result = await db
        .select({ count: count() })
        .from(tableRef)
        .where(eq(fieldRef, value));

      return (result[0]?.count ?? 0) > 0;
    } catch (error) {
      console.error(`Exists validation error for ${table}.${field}:`, error);
      return false;
    }
  }

  /**
   * Check if an entity belongs to the specified tenant
   */
  async belongsToTenant(table: string, field: string, value: any, tenantId: string): Promise<boolean> {
    try {
      const db = this.drizzle.getDb();
      const tableRef = this.getTableReference(table);
      if (!tableRef) {
        throw new Error(`Table ${table} not found`);
      }

      const fieldRef = tableRef[field];
      const tenantIdField = tableRef.tenantId;
      
      if (!fieldRef || !tenantIdField) {
        throw new Error(`Required fields not found in table ${table}`);
      }

      const result = await db
        .select({ count: count() })
        .from(tableRef)
        .where(and(eq(fieldRef, value), eq(tenantIdField, tenantId)));

      return (result[0]?.count ?? 0) > 0;
    } catch (error) {
      console.error(`Tenant validation error for ${table}.${field}:`, error);
      return false;
    }
  }

  /**
   * Validate custom business rules
   */
  async validateBusinessRule(ruleName: string, value: any, context: any): Promise<boolean> {
    try {
      switch (ruleName) {
        case 'unique-email-per-tenant':
          return this.validateUniqueEmailPerTenant(value, context);
        
        case 'valid-business-tier-upgrade':
          return this.validateBusinessTierUpgrade(value, context);
        
        case 'sufficient-inventory':
          return this.validateSufficientInventory(value, context);
        
        case 'valid-price-range':
          return this.validatePriceRange(value, context);
        
        case 'employee-limit-per-tier':
          return this.validateEmployeeLimitPerTier(value, context);
        
        case 'location-limit-per-tier':
          return this.validateLocationLimitPerTier(value, context);
        
        default:
          console.warn(`Unknown business rule: ${ruleName}`);
          return true;
      }
    } catch (error) {
      console.error(`Business rule validation error for ${ruleName}:`, error);
      return false;
    }
  }

  /**
   * Get table reference for dynamic queries
   */
  private getTableReference(tableName: string): any {
    const tableMap: Record<string, any> = {
      'tenants': tenants,
      'users': users,
      'user_sessions': userSessions,
      // Add more tables as they are created
    };
    
    return tableMap[tableName] || null;
  }

  /**
   * Business rule: Unique email per tenant
   */
  private async validateUniqueEmailPerTenant(email: string, context: { tenantId: string; excludeUserId?: string }): Promise<boolean> {
    try {
      const db = this.drizzle.getDb();
      let whereCondition = and(
        eq(users.email, email),
        eq(users.tenantId, context.tenantId)
      );

      // Exclude current user if updating
      if (context.excludeUserId) {
        whereCondition = and(
          eq(users.email, email),
          eq(users.tenantId, context.tenantId),
          ne(users.id, context.excludeUserId)
        );
      }

      const result = await db
        .select({ count: count() })
        .from(users)
        .where(whereCondition);

      return (result[0]?.count ?? 0) === 0;
    } catch (error) {
      console.error('Unique email per tenant validation error:', error);
      return false;
    }
  }

  /**
   * Business rule: Valid business tier upgrade path
   */
  private async validateBusinessTierUpgrade(newTier: string, context: { currentTier: string; tenantId: string }): Promise<boolean> {
    const tierOrder = ['micro', 'small', 'medium', 'enterprise'];
    const currentIndex = tierOrder.indexOf(context.currentTier);
    const newIndex = tierOrder.indexOf(newTier);
    
    // Can only upgrade to higher tiers or stay the same
    return newIndex >= currentIndex;
  }

  /**
   * Business rule: Sufficient inventory for transaction
   */
  private async validateSufficientInventory(quantity: number, context: { productId: string; locationId: string }): Promise<boolean> {
    try {
      // This would need to check against inventory tables when they exist
      // For now, just validate that quantity is positive
      return quantity > 0 && Number.isInteger(quantity);
    } catch (error) {
      console.error('Sufficient inventory validation error:', error);
      return false;
    }
  }

  /**
   * Business rule: Valid price range for product category
   */
  private async validatePriceRange(price: number, context: { category: string; minPrice?: number; maxPrice?: number }): Promise<boolean> {
    const { minPrice = 0, maxPrice = Number.MAX_SAFE_INTEGER } = context;
    return price >= minPrice && price <= maxPrice && price > 0;
  }

  /**
   * Business rule: Employee limit per business tier
   */
  private async validateEmployeeLimitPerTier(employeeCount: number, context: { businessTier: string }): Promise<boolean> {
    const limits = {
      micro: 5,
      small: 20,
      medium: 100,
      enterprise: Number.MAX_SAFE_INTEGER,
    };
    
    const limit = limits[context.businessTier as keyof typeof limits] || 0;
    return employeeCount <= limit;
  }

  /**
   * Business rule: Location limit per business tier
   */
  private async validateLocationLimitPerTier(locationCount: number, context: { businessTier: string }): Promise<boolean> {
    const limits = {
      micro: 1,
      small: 3,
      medium: 10,
      enterprise: Number.MAX_SAFE_INTEGER,
    };
    
    const limit = limits[context.businessTier as keyof typeof limits] || 0;
    return locationCount <= limit;
  }
}