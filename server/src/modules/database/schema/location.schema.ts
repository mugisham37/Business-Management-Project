import { pgTable, varchar, text, jsonb, decimal, boolean, uuid, index, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseSchema } from './base.schema';
import { tenants } from './tenant.schema';
import { users } from './user.schema';

// Location types enum
export const locationTypeEnum = pgTable('location_types', {
  value: varchar('value', { length: 50 }).primaryKey(),
  label: varchar('label', { length: 100 }).notNull(),
});

// Location status enum
export const locationStatusEnum = pgTable('location_statuses', {
  value: varchar('value', { length: 50 }).primaryKey(),
  label: varchar('label', { length: 100 }).notNull(),
});

// Main locations table
export const locations = pgTable('locations', {
  ...baseSchema,
  // Basic information
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull(), // Unique identifier within tenant
  description: text('description'),
  
  // Location type and status
  type: varchar('type', { length: 50 }).notNull().default('store'), // store, warehouse, office, franchise
  status: varchar('status', { length: 50 }).notNull().default('active'), // active, inactive, closed, under_construction
  
  // Address information
  address: jsonb('address').notNull().default({}), // { street, city, state, country, postalCode, coordinates }
  
  // Contact information
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  website: varchar('website', { length: 255 }),
  
  // Hierarchy support
  parentLocationId: uuid('parent_location_id'), // For hierarchical organization
  
  // Business settings
  timezone: varchar('timezone', { length: 100 }).notNull().default('UTC'),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  
  // Operating hours
  operatingHours: jsonb('operating_hours').default({}), // { monday: { open: '09:00', close: '17:00' }, ... }
  
  // Location-specific settings
  settings: jsonb('settings').default({}), // Flexible settings object
  
  // Performance metrics
  metrics: jsonb('metrics').default({}), // Performance tracking data
  
  // Manager assignment
  managerId: uuid('manager_id'), // Employee who manages this location
  
  // Financial settings
  taxSettings: jsonb('tax_settings').default({}), // Location-specific tax configuration
  
  // Inventory settings
  inventorySettings: jsonb('inventory_settings').default({}), // Reorder points, policies, etc.
  
  // POS settings
  posSettings: jsonb('pos_settings').default({}), // POS-specific configuration
  
  // Feature flags for this location
  featureFlags: jsonb('feature_flags').default({}),
  
  // Coordinates for mapping
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),
  
  // Capacity and size information
  squareFootage: decimal('square_footage', { precision: 10, scale: 2 }),
  capacity: jsonb('capacity').default({}), // { customers: 100, employees: 20, etc. }
}, (table) => ({
  // Indexes for performance
  tenantCodeIdx: index('idx_locations_tenant_code').on(table.tenantId, table.code),
  tenantNameIdx: index('idx_locations_tenant_name').on(table.tenantId, table.name),
  parentLocationIdx: index('idx_locations_parent').on(table.parentLocationId),
  managerIdx: index('idx_locations_manager').on(table.managerId),
  statusIdx: index('idx_locations_status').on(table.tenantId, table.status),
  typeIdx: index('idx_locations_type').on(table.tenantId, table.type),
  coordinatesIdx: index('idx_locations_coordinates').on(table.latitude, table.longitude),
}));

// Location permissions table - controls which users can access which locations
export const locationPermissions = pgTable('location_permissions', {
  ...baseSchema,
  locationId: uuid('location_id').notNull(),
  userId: uuid('user_id').notNull(),
  permissions: jsonb('permissions').notNull().default([]), // Array of permission strings
  role: varchar('role', { length: 50 }).notNull().default('employee'), // manager, employee, viewer
}, (table) => ({
  locationUserIdx: index('idx_location_permissions_location_user').on(table.locationId, table.userId),
  userLocationIdx: index('idx_location_permissions_user_location').on(table.userId, table.locationId),
}));

// Location hierarchy table - for complex organizational structures
export const locationHierarchy = pgTable('location_hierarchy', {
  ...baseSchema,
  ancestorId: uuid('ancestor_id').notNull(),
  descendantId: uuid('descendant_id').notNull(),
  depth: decimal('depth', { precision: 3, scale: 0 }).notNull(), // 0 = self, 1 = direct child, etc.
}, (table) => ({
  ancestorDescendantIdx: index('idx_location_hierarchy_ancestor_descendant').on(table.ancestorId, table.descendantId),
  descendantAncestorIdx: index('idx_location_hierarchy_descendant_ancestor').on(table.descendantId, table.ancestorId),
  depthIdx: index('idx_location_hierarchy_depth').on(table.depth),
}));

// Location performance metrics table - for detailed analytics
export const locationMetrics = pgTable('location_metrics', {
  ...baseSchema,
  locationId: uuid('location_id').notNull(),
  metricType: varchar('metric_type', { length: 100 }).notNull(), // sales, traffic, efficiency, etc.
  metricName: varchar('metric_name', { length: 100 }).notNull(),
  value: decimal('value', { precision: 15, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 50 }), // currency, percentage, count, etc.
  period: varchar('period', { length: 50 }).notNull(), // daily, weekly, monthly, yearly
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  locationMetricIdx: index('idx_location_metrics_location_metric').on(table.locationId, table.metricType, table.metricName),
  periodIdx: index('idx_location_metrics_period').on(table.periodStart, table.periodEnd),
  typeIdx: index('idx_location_metrics_type').on(table.metricType),
}));

// Relations
export const locationsRelations = relations(locations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [locations.tenantId],
    references: [tenants.id],
  }),
  manager: one(users, {
    fields: [locations.managerId],
    references: [users.id],
  }),
  parentLocation: one(locations, {
    fields: [locations.parentLocationId],
    references: [locations.id],
  }),
  childLocations: many(locations),
  permissions: many(locationPermissions),
  metrics: many(locationMetrics),
  ancestors: many(locationHierarchy, { relationName: 'descendant' }),
  descendants: many(locationHierarchy, { relationName: 'ancestor' }),
}));

export const locationPermissionsRelations = relations(locationPermissions, ({ one }) => ({
  location: one(locations, {
    fields: [locationPermissions.locationId],
    references: [locations.id],
  }),
  user: one(users, {
    fields: [locationPermissions.userId],
    references: [users.id],
  }),
}));

export const locationHierarchyRelations = relations(locationHierarchy, ({ one }) => ({
  ancestor: one(locations, {
    fields: [locationHierarchy.ancestorId],
    references: [locations.id],
    relationName: 'ancestor',
  }),
  descendant: one(locations, {
    fields: [locationHierarchy.descendantId],
    references: [locations.id],
    relationName: 'descendant',
  }),
}));

export const locationMetricsRelations = relations(locationMetrics, ({ one }) => ({
  location: one(locations, {
    fields: [locationMetrics.locationId],
    references: [locations.id],
  }),
}));