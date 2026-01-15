import { pgTable, varchar, text, jsonb, decimal, boolean, uuid, index, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseSchema } from './base.schema';
import { tenants } from './tenant.schema';
import { users } from './user.schema';
import { locations } from './location.schema';

// Franchise types enum
export const franchiseTypeEnum = pgTable('franchise_types', {
  value: varchar('value', { length: 50 }).primaryKey(),
  label: varchar('label', { length: 100 }).notNull(),
});

// Franchise status enum
export const franchiseStatusEnum = pgTable('franchise_statuses', {
  value: varchar('value', { length: 50 }).primaryKey(),
  label: varchar('label', { length: 100 }).notNull(),
});

// Territory types enum (for franchise territories)
export const franchiseTerritoryTypeEnum = pgTable('franchise_territory_types', {
  value: varchar('value', { length: 50 }).primaryKey(),
  label: varchar('label', { length: 100 }).notNull(),
});

// Franchises table - represents franchise entities within a tenant
export const franchises = pgTable('franchises', {
  ...baseSchema,
  // Basic franchise information
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull(), // Unique identifier within tenant
  description: text('description'),
  
  // Franchise type and status
  type: varchar('type', { length: 50 }).notNull().default('franchise'), // franchise, dealer, distributor, agent
  status: varchar('status', { length: 50 }).notNull().default('active'), // active, inactive, suspended, terminated
  
  // Franchise owner/operator information
  ownerId: uuid('owner_id'), // User who owns/operates this franchise
  operatorId: uuid('operator_id'), // User who manages day-to-day operations
  
  // Business information
  businessName: varchar('business_name', { length: 255 }),
  businessRegistrationNumber: varchar('business_registration_number', { length: 100 }),
  taxId: varchar('tax_id', { length: 100 }),
  
  // Contact information
  contactInfo: jsonb('contact_info').default({}), // { phone, email, address, website }
  
  // Financial terms
  royaltyRate: decimal('royalty_rate', { precision: 5, scale: 4 }), // Percentage (e.g., 0.05 for 5%)
  marketingFeeRate: decimal('marketing_fee_rate', { precision: 5, scale: 4 }),
  initialFranchiseFee: decimal('initial_franchise_fee', { precision: 12, scale: 2 }),
  
  // Contract information
  contractStartDate: timestamp('contract_start_date', { withTimezone: true }),
  contractEndDate: timestamp('contract_end_date', { withTimezone: true }),
  contractTerms: jsonb('contract_terms').default({}),
  
  // Performance metrics
  performanceMetrics: jsonb('performance_metrics').default({}),
  
  // Settings and configuration
  settings: jsonb('settings').default({}),
  featureFlags: jsonb('feature_flags').default({}),
  
  // Territory assignment
  primaryTerritoryId: uuid('primary_territory_id'),
  
  // Parent franchise for multi-level structures
  parentFranchiseId: uuid('parent_franchise_id'),
}, (table) => ({
  tenantCodeIdx: index('idx_franchises_tenant_code').on(table.tenantId, table.code),
  tenantNameIdx: index('idx_franchises_tenant_name').on(table.tenantId, table.name),
  ownerIdx: index('idx_franchises_owner').on(table.ownerId),
  operatorIdx: index('idx_franchises_operator').on(table.operatorId),
  statusIdx: index('idx_franchises_status').on(table.tenantId, table.status),
  typeIdx: index('idx_franchises_type').on(table.tenantId, table.type),
  territoryIdx: index('idx_franchises_territory').on(table.primaryTerritoryId),
  parentIdx: index('idx_franchises_parent').on(table.parentFranchiseId),
}));

// Territories table - defines geographic or market territories
export const territories = pgTable('territories', {
  ...baseSchema,
  // Basic territory information
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  description: text('description'),
  
  // Territory type
  type: varchar('type', { length: 50 }).notNull().default('geographic'), // geographic, market, product, customer
  
  // Geographic boundaries (for geographic territories)
  boundaries: jsonb('boundaries').default({}), // GeoJSON or coordinate data
  
  // Market definition (for market territories)
  marketCriteria: jsonb('market_criteria').default({}), // Customer segments, product categories, etc.
  
  // Territory hierarchy
  parentTerritoryId: uuid('parent_territory_id'),
  
  // Assignment information
  assignedFranchiseId: uuid('assigned_franchise_id'),
  assignedUserId: uuid('assigned_user_id'), // Territory manager/representative
  
  // Territory metrics and performance
  metrics: jsonb('metrics').default({}),
  
  // Settings
  settings: jsonb('settings').default({}),
  
  // Status
  isActive: boolean('is_active').default(true),
}, (table) => ({
  tenantCodeIdx: index('idx_territories_tenant_code').on(table.tenantId, table.code),
  tenantNameIdx: index('idx_territories_tenant_name').on(table.tenantId, table.name),
  typeIdx: index('idx_territories_type').on(table.tenantId, table.type),
  franchiseIdx: index('idx_territories_franchise').on(table.assignedFranchiseId),
  userIdx: index('idx_territories_user').on(table.assignedUserId),
  parentIdx: index('idx_territories_parent').on(table.parentTerritoryId),
}));

// Franchise locations table - links franchises to their locations
export const franchiseLocations = pgTable('franchise_locations', {
  ...baseSchema,
  franchiseId: uuid('franchise_id').notNull(),
  locationId: uuid('location_id').notNull(),
  role: varchar('role', { length: 50 }).notNull().default('primary'), // primary, secondary, shared
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  expirationDate: timestamp('expiration_date', { withTimezone: true }),
  settings: jsonb('settings').default({}),
}, (table) => ({
  franchiseLocationIdx: index('idx_franchise_locations_franchise_location').on(table.franchiseId, table.locationId),
  locationFranchiseIdx: index('idx_franchise_locations_location_franchise').on(table.locationId, table.franchiseId),
  effectiveDateIdx: index('idx_franchise_locations_effective_date').on(table.effectiveDate),
}));

// Franchise permissions table - controls franchise-specific permissions
export const franchisePermissions = pgTable('franchise_permissions', {
  ...baseSchema,
  franchiseId: uuid('franchise_id').notNull(),
  userId: uuid('user_id').notNull(),
  permissions: jsonb('permissions').notNull().default([]),
  role: varchar('role', { length: 50 }).notNull().default('operator'), // owner, operator, manager, employee
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  expirationDate: timestamp('expiration_date', { withTimezone: true }),
}, (table) => ({
  franchiseUserIdx: index('idx_franchise_permissions_franchise_user').on(table.franchiseId, table.userId),
  userFranchiseIdx: index('idx_franchise_permissions_user_franchise').on(table.userId, table.franchiseId),
  effectiveDateIdx: index('idx_franchise_permissions_effective_date').on(table.effectiveDate),
}));

// Franchise performance metrics table
export const franchiseMetrics = pgTable('franchise_metrics', {
  ...baseSchema,
  franchiseId: uuid('franchise_id').notNull(),
  metricType: varchar('metric_type', { length: 100 }).notNull(), // sales, royalty, compliance, satisfaction
  metricName: varchar('metric_name', { length: 100 }).notNull(),
  value: decimal('value', { precision: 15, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 50 }),
  period: varchar('period', { length: 50 }).notNull(),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  franchiseMetricIdx: index('idx_franchise_metrics_franchise_metric').on(table.franchiseId, table.metricType, table.metricName),
  periodIdx: index('idx_franchise_metrics_period').on(table.periodStart, table.periodEnd),
  typeIdx: index('idx_franchise_metrics_type').on(table.metricType),
}));

// Territory assignments table - tracks territory assignment history
export const territoryAssignments = pgTable('territory_assignments', {
  ...baseSchema,
  territoryId: uuid('territory_id').notNull(),
  franchiseId: uuid('franchise_id'),
  userId: uuid('user_id'),
  assignmentType: varchar('assignment_type', { length: 50 }).notNull(), // franchise, representative, manager
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  expirationDate: timestamp('expiration_date', { withTimezone: true }),
  reason: text('reason'),
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  territoryAssignmentIdx: index('idx_territory_assignments_territory').on(table.territoryId),
  franchiseAssignmentIdx: index('idx_territory_assignments_franchise').on(table.franchiseId),
  userAssignmentIdx: index('idx_territory_assignments_user').on(table.userId),
  effectiveDateIdx: index('idx_territory_assignments_effective_date').on(table.effectiveDate),
}));

// Relations
export const franchisesRelations = relations(franchises, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [franchises.tenantId],
    references: [tenants.id],
  }),
  owner: one(users, {
    fields: [franchises.ownerId],
    references: [users.id],
    relationName: 'franchiseOwner',
  }),
  operator: one(users, {
    fields: [franchises.operatorId],
    references: [users.id],
    relationName: 'franchiseOperator',
  }),
  primaryTerritory: one(territories, {
    fields: [franchises.primaryTerritoryId],
    references: [territories.id],
  }),
  parentFranchise: one(franchises, {
    fields: [franchises.parentFranchiseId],
    references: [franchises.id],
  }),
  childFranchises: many(franchises),
  locations: many(franchiseLocations),
  permissions: many(franchisePermissions),
  metrics: many(franchiseMetrics),
}));

export const territoriesRelations = relations(territories, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [territories.tenantId],
    references: [tenants.id],
  }),
  assignedFranchise: one(franchises, {
    fields: [territories.assignedFranchiseId],
    references: [franchises.id],
  }),
  assignedUser: one(users, {
    fields: [territories.assignedUserId],
    references: [users.id],
  }),
  parentTerritory: one(territories, {
    fields: [territories.parentTerritoryId],
    references: [territories.id],
  }),
  childTerritories: many(territories),
  assignments: many(territoryAssignments),
}));

export const franchiseLocationsRelations = relations(franchiseLocations, ({ one }) => ({
  franchise: one(franchises, {
    fields: [franchiseLocations.franchiseId],
    references: [franchises.id],
  }),
  location: one(locations, {
    fields: [franchiseLocations.locationId],
    references: [locations.id],
  }),
}));

export const franchisePermissionsRelations = relations(franchisePermissions, ({ one }) => ({
  franchise: one(franchises, {
    fields: [franchisePermissions.franchiseId],
    references: [franchises.id],
  }),
  user: one(users, {
    fields: [franchisePermissions.userId],
    references: [users.id],
  }),
}));

export const franchiseMetricsRelations = relations(franchiseMetrics, ({ one }) => ({
  franchise: one(franchises, {
    fields: [franchiseMetrics.franchiseId],
    references: [franchises.id],
  }),
}));

export const territoryAssignmentsRelations = relations(territoryAssignments, ({ one }) => ({
  territory: one(territories, {
    fields: [territoryAssignments.territoryId],
    references: [territories.id],
  }),
  franchise: one(franchises, {
    fields: [territoryAssignments.franchiseId],
    references: [franchises.id],
  }),
  user: one(users, {
    fields: [territoryAssignments.userId],
    references: [users.id],
  }),
}));