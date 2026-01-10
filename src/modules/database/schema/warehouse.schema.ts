import { pgTable, varchar, text, jsonb, decimal, boolean, uuid, index, unique, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseSchema } from './base.schema';
import { locations } from './location.schema';
import { products } from './product.schema';
import { users } from './user.schema';

// Warehouse zone type enumeration
export const warehouseZoneTypeEnum = pgEnum('warehouse_zone_type', [
  'receiving',
  'storage',
  'picking',
  'packing',
  'shipping',
  'returns',
  'quarantine',
  'staging',
  'cross_dock',
  'office',
  'maintenance',
]);

// Bin location status enumeration
export const binLocationStatusEnum = pgEnum('bin_location_status', [
  'available',
  'occupied',
  'reserved',
  'damaged',
  'maintenance',
  'blocked',
]);

// Pick list status enumeration
export const pickListStatusEnum = pgEnum('pick_list_status', [
  'pending',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
]);

// Wave status enumeration
export const waveStatusEnum = pgEnum('wave_status', [
  'planned',
  'released',
  'in_progress',
  'completed',
  'cancelled',
]);

// Warehouses table - extends locations with warehouse-specific data
export const warehouses = pgTable('warehouses', {
  ...baseSchema,
  
  // Reference to location
  locationId: uuid('location_id').notNull().unique(),
  
  // Warehouse identification
  warehouseCode: varchar('warehouse_code', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  
  // Physical characteristics
  totalSquareFootage: decimal('total_square_footage', { precision: 12, scale: 2 }),
  storageSquareFootage: decimal('storage_square_footage', { precision: 12, scale: 2 }),
  ceilingHeight: decimal('ceiling_height', { precision: 8, scale: 2 }),
  
  // Capacity information
  totalBinLocations: integer('total_bin_locations').default(0),
  occupiedBinLocations: integer('occupied_bin_locations').default(0),
  maxCapacityUnits: decimal('max_capacity_units', { precision: 15, scale: 3 }),
  currentCapacityUnits: decimal('current_capacity_units', { precision: 15, scale: 3 }).default('0'),
  
  // Layout configuration
  layoutType: varchar('layout_type', { length: 50 }).default('grid'), // grid, flow, hybrid
  aisleConfiguration: jsonb('aisle_configuration').default({}), // { aisles: [{ id: 'A', width: 10, length: 100 }] }
  
  // Operational settings
  operatingHours: jsonb('operating_hours').default({}),
  timezone: varchar('timezone', { length: 100 }).notNull().default('UTC'),
  
  // Temperature and environment controls
  temperatureControlled: boolean('temperature_controlled').default(false),
  temperatureRange: jsonb('temperature_range').default({}), // { min: -18, max: 25, unit: 'celsius' }
  humidityControlled: boolean('humidity_controlled').default(false),
  humidityRange: jsonb('humidity_range').default({}),
  
  // Security and access
  securityLevel: varchar('security_level', { length: 50 }).default('standard'), // basic, standard, high, maximum
  accessControlRequired: boolean('access_control_required').default(false),
  
  // Automation and technology
  wmsIntegration: boolean('wms_integration').default(false),
  barcodeSystem: boolean('barcode_system').default(true),
  rfidEnabled: boolean('rfid_enabled').default(false),
  automatedSorting: boolean('automated_sorting').default(false),
  
  // Performance metrics
  pickingAccuracy: decimal('picking_accuracy', { precision: 5, scale: 2 }).default('0'), // percentage
  averagePickTime: decimal('average_pick_time', { precision: 8, scale: 2 }).default('0'), // minutes
  throughputPerHour: decimal('throughput_per_hour', { precision: 10, scale: 2 }).default('0'),
  
  // Manager and staff
  warehouseManagerId: uuid('warehouse_manager_id'),
  
  // Status and configuration
  status: varchar('status', { length: 50 }).default('active'), // active, inactive, maintenance, closed
  configuration: jsonb('configuration').default({}),
  
  // Integration settings
  integrationSettings: jsonb('integration_settings').default({}),
}, (table) => ({
  // Unique constraints
  tenantWarehouseCodeIdx: unique('warehouses_tenant_warehouse_code_unique').on(
    table.tenantId,
    table.warehouseCode
  ),
  
  // Performance indexes
  tenantIdIdx: index('warehouses_tenant_id_idx').on(table.tenantId),
  locationIdIdx: index('warehouses_location_id_idx').on(table.locationId),
  statusIdx: index('warehouses_status_idx').on(table.status),
  warehouseManagerIdx: index('warehouses_manager_idx').on(table.warehouseManagerId),
}));

// Warehouse zones table - logical areas within warehouses
export const warehouseZones = pgTable('warehouse_zones', {
  ...baseSchema,
  
  // Warehouse reference
  warehouseId: uuid('warehouse_id').notNull(),
  
  // Zone identification
  zoneCode: varchar('zone_code', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  
  // Zone type and characteristics
  zoneType: warehouseZoneTypeEnum('zone_type').notNull(),
  priority: integer('priority').default(1), // 1 = highest priority
  
  // Physical boundaries
  coordinates: jsonb('coordinates').default({}), // { x1, y1, x2, y2 } or polygon points
  squareFootage: decimal('square_footage', { precision: 10, scale: 2 }),
  
  // Capacity
  maxBinLocations: integer('max_bin_locations'),
  currentBinLocations: integer('current_bin_locations').default(0),
  
  // Environmental controls
  temperatureControlled: boolean('temperature_controlled').default(false),
  temperatureRange: jsonb('temperature_range').default({}),
  humidityControlled: boolean('humidity_controlled').default(false),
  
  // Access and security
  accessLevel: varchar('access_level', { length: 50 }).default('standard'),
  requiresAuthorization: boolean('requires_authorization').default(false),
  
  // Operational settings
  allowMixedProducts: boolean('allow_mixed_products').default(true),
  allowMixedBatches: boolean('allow_mixed_batches').default(false),
  fifoEnforced: boolean('fifo_enforced').default(false),
  
  // Status
  status: varchar('status', { length: 50 }).default('active'),
  
  // Configuration
  configuration: jsonb('configuration').default({}),
}, (table) => ({
  // Unique constraints
  warehouseZoneCodeIdx: unique('warehouse_zones_warehouse_zone_code_unique').on(
    table.warehouseId,
    table.zoneCode
  ),
  
  // Performance indexes
  tenantIdIdx: index('warehouse_zones_tenant_id_idx').on(table.tenantId),
  warehouseIdIdx: index('warehouse_zones_warehouse_id_idx').on(table.warehouseId),
  zoneTypeIdx: index('warehouse_zones_zone_type_idx').on(table.zoneType),
  statusIdx: index('warehouse_zones_status_idx').on(table.status),
}));

// Bin locations table - specific storage locations within zones
export const binLocations = pgTable('bin_locations', {
  ...baseSchema,
  
  // Zone reference
  zoneId: uuid('zone_id').notNull(),
  warehouseId: uuid('warehouse_id').notNull(), // Denormalized for performance
  
  // Location identification
  binCode: varchar('bin_code', { length: 50 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  
  // Physical location
  aisle: varchar('aisle', { length: 10 }),
  bay: varchar('bay', { length: 10 }),
  level: varchar('level', { length: 10 }),
  position: varchar('position', { length: 10 }),
  
  // Coordinates within warehouse
  xCoordinate: decimal('x_coordinate', { precision: 10, scale: 3 }),
  yCoordinate: decimal('y_coordinate', { precision: 10, scale: 3 }),
  zCoordinate: decimal('z_coordinate', { precision: 10, scale: 3 }),
  
  // Physical characteristics
  length: decimal('length', { precision: 8, scale: 2 }),
  width: decimal('width', { precision: 8, scale: 2 }),
  height: decimal('height', { precision: 8, scale: 2 }),
  volume: decimal('volume', { precision: 12, scale: 3 }),
  maxWeight: decimal('max_weight', { precision: 10, scale: 2 }),
  
  // Current status and occupancy
  status: binLocationStatusEnum('status').default('available'),
  occupancyPercentage: decimal('occupancy_percentage', { precision: 5, scale: 2 }).default('0'),
  currentWeight: decimal('current_weight', { precision: 10, scale: 2 }).default('0'),
  
  // Product restrictions
  allowedProductTypes: jsonb('allowed_product_types').default([]), // Empty array = all allowed
  restrictedProductTypes: jsonb('restricted_product_types').default([]),
  
  // Environmental requirements
  temperatureControlled: boolean('temperature_controlled').default(false),
  temperatureRange: jsonb('temperature_range').default({}),
  hazmatApproved: boolean('hazmat_approved').default(false),
  
  // Access and picking
  pickingSequence: integer('picking_sequence'), // Order for optimized picking routes
  accessEquipment: jsonb('access_equipment').default([]), // ['forklift', 'ladder', 'reach_truck']
  
  // Current assignment
  assignedProductId: uuid('assigned_product_id'),
  assignedVariantId: uuid('assigned_variant_id'),
  dedicatedProduct: boolean('dedicated_product').default(false), // If true, only assigned product allowed
  
  // Last activity
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
  lastPickAt: timestamp('last_pick_at', { withTimezone: true }),
  lastReplenishAt: timestamp('last_replenish_at', { withTimezone: true }),
  
  // Configuration and notes
  configuration: jsonb('configuration').default({}),
  notes: text('notes'),
}, (table) => ({
  // Unique constraints
  warehouseBinCodeIdx: unique('bin_locations_warehouse_bin_code_unique').on(
    table.warehouseId,
    table.binCode
  ),
  
  // Performance indexes
  tenantIdIdx: index('bin_locations_tenant_id_idx').on(table.tenantId),
  warehouseIdIdx: index('bin_locations_warehouse_id_idx').on(table.warehouseId),
  zoneIdIdx: index('bin_locations_zone_id_idx').on(table.zoneId),
  statusIdx: index('bin_locations_status_idx').on(table.status),
  assignedProductIdx: index('bin_locations_assigned_product_idx').on(table.assignedProductId),
  pickingSequenceIdx: index('bin_locations_picking_sequence_idx').on(table.pickingSequence),
  coordinatesIdx: index('bin_locations_coordinates_idx').on(table.xCoordinate, table.yCoordinate),
}));

// Picking waves table - groups of orders for efficient picking
export const pickingWaves = pgTable('picking_waves', {
  ...baseSchema,
  
  // Wave identification
  waveNumber: varchar('wave_number', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  
  // Warehouse and zone
  warehouseId: uuid('warehouse_id').notNull(),
  zoneIds: jsonb('zone_ids').default([]), // Zones included in this wave
  
  // Wave configuration
  waveType: varchar('wave_type', { length: 50 }).default('standard'), // standard, priority, batch, zone
  priority: integer('priority').default(1),
  
  // Timing
  plannedStartTime: timestamp('planned_start_time', { withTimezone: true }),
  plannedEndTime: timestamp('planned_end_time', { withTimezone: true }),
  actualStartTime: timestamp('actual_start_time', { withTimezone: true }),
  actualEndTime: timestamp('actual_end_time', { withTimezone: true }),
  
  // Status and progress
  status: waveStatusEnum('status').default('planned'),
  totalOrders: integer('total_orders').default(0),
  completedOrders: integer('completed_orders').default(0),
  totalLines: integer('total_lines').default(0),
  completedLines: integer('completed_lines').default(0),
  
  // Assignments
  assignedPickers: jsonb('assigned_pickers').default([]), // Array of user IDs
  
  // Performance metrics
  estimatedPickTime: decimal('estimated_pick_time', { precision: 8, scale: 2 }),
  actualPickTime: decimal('actual_pick_time', { precision: 8, scale: 2 }),
  pickingAccuracy: decimal('picking_accuracy', { precision: 5, scale: 2 }),
  
  // Configuration
  configuration: jsonb('configuration').default({}),
  notes: text('notes'),
}, (table) => ({
  // Unique constraints
  tenantWaveNumberIdx: unique('picking_waves_tenant_wave_number_unique').on(
    table.tenantId,
    table.waveNumber
  ),
  
  // Performance indexes
  tenantIdIdx: index('picking_waves_tenant_id_idx').on(table.tenantId),
  warehouseIdIdx: index('picking_waves_warehouse_id_idx').on(table.warehouseId),
  statusIdx: index('picking_waves_status_idx').on(table.status),
  plannedStartTimeIdx: index('picking_waves_planned_start_time_idx').on(table.plannedStartTime),
}));

// Pick lists table - individual picking assignments
export const pickLists = pgTable('pick_lists', {
  ...baseSchema,
  
  // Pick list identification
  pickListNumber: varchar('pick_list_number', { length: 50 }).notNull(),
  waveId: uuid('wave_id'),
  
  // Assignment
  warehouseId: uuid('warehouse_id').notNull(),
  assignedPickerId: uuid('assigned_picker_id'),
  
  // Orders and references
  orderIds: jsonb('order_ids').default([]), // Array of order IDs in this pick list
  
  // Routing and optimization
  pickingRoute: jsonb('picking_route').default([]), // Optimized sequence of bin locations
  estimatedDistance: decimal('estimated_distance', { precision: 10, scale: 2 }),
  estimatedTime: decimal('estimated_time', { precision: 8, scale: 2 }),
  
  // Status and timing
  status: pickListStatusEnum('status').default('pending'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  
  // Progress tracking
  totalItems: integer('total_items').default(0),
  pickedItems: integer('picked_items').default(0),
  totalQuantity: decimal('total_quantity', { precision: 12, scale: 3 }).default('0'),
  pickedQuantity: decimal('picked_quantity', { precision: 12, scale: 3 }).default('0'),
  
  // Performance metrics
  actualDistance: decimal('actual_distance', { precision: 10, scale: 2 }),
  actualTime: decimal('actual_time', { precision: 8, scale: 2 }),
  pickingAccuracy: decimal('picking_accuracy', { precision: 5, scale: 2 }),
  
  // Equipment and tools
  equipmentUsed: jsonb('equipment_used').default([]),
  
  // Notes and issues
  notes: text('notes'),
  issues: jsonb('issues').default([]),
}, (table) => ({
  // Unique constraints
  tenantPickListNumberIdx: unique('pick_lists_tenant_pick_list_number_unique').on(
    table.tenantId,
    table.pickListNumber
  ),
  
  // Performance indexes
  tenantIdIdx: index('pick_lists_tenant_id_idx').on(table.tenantId),
  warehouseIdIdx: index('pick_lists_warehouse_id_idx').on(table.warehouseId),
  waveIdIdx: index('pick_lists_wave_id_idx').on(table.waveId),
  assignedPickerIdx: index('pick_lists_assigned_picker_idx').on(table.assignedPickerId),
  statusIdx: index('pick_lists_status_idx').on(table.status),
  assignedAtIdx: index('pick_lists_assigned_at_idx').on(table.assignedAt),
}));

// Pick list items table - individual items to be picked
export const pickListItems = pgTable('pick_list_items', {
  ...baseSchema,
  
  // Pick list reference
  pickListId: uuid('pick_list_id').notNull(),
  
  // Product information
  productId: uuid('product_id').notNull(),
  variantId: uuid('variant_id'),
  
  // Location information
  binLocationId: uuid('bin_location_id').notNull(),
  
  // Quantity information
  requestedQuantity: decimal('requested_quantity', { precision: 12, scale: 3 }).notNull(),
  pickedQuantity: decimal('picked_quantity', { precision: 12, scale: 3 }).default('0'),
  
  // Batch/lot information
  batchNumber: varchar('batch_number', { length: 100 }),
  lotNumber: varchar('lot_number', { length: 100 }),
  expiryDate: timestamp('expiry_date', { withTimezone: true }),
  
  // Picking sequence and routing
  pickingSequence: integer('picking_sequence').notNull(),
  
  // Status and timing
  status: varchar('status', { length: 50 }).default('pending'), // pending, picked, short_picked, skipped
  pickedAt: timestamp('picked_at', { withTimezone: true }),
  
  // Quality and accuracy
  qualityCheck: boolean('quality_check').default(false),
  qualityNotes: text('quality_notes'),
  
  // Issues and exceptions
  shortPickReason: varchar('short_pick_reason', { length: 255 }),
  issues: jsonb('issues').default([]),
  
  // Reference information
  orderLineId: uuid('order_line_id'), // Reference to original order line
  
  // Notes
  notes: text('notes'),
}, (table) => ({
  // Performance indexes
  tenantIdIdx: index('pick_list_items_tenant_id_idx').on(table.tenantId),
  pickListIdIdx: index('pick_list_items_pick_list_id_idx').on(table.pickListId),
  productIdIdx: index('pick_list_items_product_id_idx').on(table.productId),
  binLocationIdIdx: index('pick_list_items_bin_location_id_idx').on(table.binLocationId),
  pickingSequenceIdx: index('pick_list_items_picking_sequence_idx').on(table.pickingSequence),
  statusIdx: index('pick_list_items_status_idx').on(table.status),
  batchNumberIdx: index('pick_list_items_batch_number_idx').on(table.batchNumber),
}));

// Relations
export const warehousesRelations = relations(warehouses, ({ one, many }) => ({
  location: one(locations, {
    fields: [warehouses.locationId],
    references: [locations.id],
  }),
  warehouseManager: one(users, {
    fields: [warehouses.warehouseManagerId],
    references: [users.id],
  }),
  zones: many(warehouseZones),
  binLocations: many(binLocations),
  pickingWaves: many(pickingWaves),
  pickLists: many(pickLists),
}));

export const warehouseZonesRelations = relations(warehouseZones, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [warehouseZones.warehouseId],
    references: [warehouses.id],
  }),
  binLocations: many(binLocations),
}));

export const binLocationsRelations = relations(binLocations, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [binLocations.warehouseId],
    references: [warehouses.id],
  }),
  zone: one(warehouseZones, {
    fields: [binLocations.zoneId],
    references: [warehouseZones.id],
  }),
  assignedProduct: one(products, {
    fields: [binLocations.assignedProductId],
    references: [products.id],
  }),
  pickListItems: many(pickListItems),
}));

export const pickingWavesRelations = relations(pickingWaves, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [pickingWaves.warehouseId],
    references: [warehouses.id],
  }),
  pickLists: many(pickLists),
}));

export const pickListsRelations = relations(pickLists, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [pickLists.warehouseId],
    references: [warehouses.id],
  }),
  wave: one(pickingWaves, {
    fields: [pickLists.waveId],
    references: [pickingWaves.id],
  }),
  assignedPicker: one(users, {
    fields: [pickLists.assignedPickerId],
    references: [users.id],
  }),
  items: many(pickListItems),
}));

export const pickListItemsRelations = relations(pickListItems, ({ one }) => ({
  pickList: one(pickLists, {
    fields: [pickListItems.pickListId],
    references: [pickLists.id],
  }),
  product: one(products, {
    fields: [pickListItems.productId],
    references: [products.id],
  }),
  binLocation: one(binLocations, {
    fields: [pickListItems.binLocationId],
    references: [binLocations.id],
  }),
}));