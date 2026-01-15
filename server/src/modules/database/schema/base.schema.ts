import { uuid, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

// Base schema for all tenant-isolated tables
export const baseSchema = {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
};

// Base schema for system-wide tables (not tenant-isolated)
export const systemBaseSchema = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
};