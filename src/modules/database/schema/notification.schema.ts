import { pgTable, uuid, varchar, text, jsonb, timestamp, boolean, integer, index } from 'drizzle-orm/pg-core';
import { baseSchema } from './base.schema';
import { users } from './user.schema';

// Notification types enum
export const notificationTypeEnum = pgTable('notification_types', {
  value: varchar('value', { length: 50 }).primaryKey(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
});

// Notification channels enum
export const notificationChannelEnum = pgTable('notification_channels', {
  value: varchar('value', { length: 20 }).primaryKey(),
  label: varchar('label', { length: 50 }).notNull(),
  isActive: boolean('is_active').default(true),
});

// Notification templates
export const notificationTemplates = pgTable('notification_templates', {
  ...baseSchema,
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  channel: varchar('channel', { length: 20 }).notNull(),
  subject: varchar('subject', { length: 200 }),
  bodyTemplate: text('body_template').notNull(),
  htmlTemplate: text('html_template'),
  variables: jsonb('variables').default([]), // Array of variable names used in template
  isActive: boolean('is_active').default(true),
  isSystem: boolean('is_system').default(false), // System templates cannot be deleted
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  tenantTypeChannelIdx: index('idx_notification_templates_tenant_type_channel')
    .on(table.tenantId, table.type, table.channel),
  nameIdx: index('idx_notification_templates_name').on(table.name),
}));

// User notification preferences
export const notificationPreferences = pgTable('notification_preferences', {
  ...baseSchema,
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  notificationType: varchar('notification_type', { length: 50 }).notNull(),
  channel: varchar('channel', { length: 20 }).notNull(),
  isEnabled: boolean('is_enabled').default(true),
  frequency: varchar('frequency', { length: 20 }).default('immediate'), // immediate, hourly, daily, weekly
  quietHoursStart: varchar('quiet_hours_start', { length: 5 }), // HH:MM format
  quietHoursEnd: varchar('quiet_hours_end', { length: 5 }), // HH:MM format
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  settings: jsonb('settings').default({}), // Channel-specific settings
}, (table) => ({
  userTypeChannelIdx: index('idx_notification_preferences_user_type_channel')
    .on(table.userId, table.notificationType, table.channel),
  tenantUserIdx: index('idx_notification_preferences_tenant_user')
    .on(table.tenantId, table.userId),
}));

// Notification history/log
export const notifications = pgTable('notifications', {
  ...baseSchema,
  recipientId: uuid('recipient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  channel: varchar('channel', { length: 20 }).notNull(),
  templateId: uuid('template_id').references(() => notificationTemplates.id),
  
  // Content
  subject: varchar('subject', { length: 200 }),
  message: text('message').notNull(),
  htmlContent: text('html_content'),
  
  // Delivery information
  status: varchar('status', { length: 20 }).default('pending'), // pending, sent, delivered, failed, read
  priority: varchar('priority', { length: 10 }).default('medium'), // low, medium, high, urgent
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
  
  // Metadata and tracking
  externalId: varchar('external_id', { length: 100 }), // ID from external service (SMS, email provider)
  deliveryAttempts: integer('delivery_attempts').default(0),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  failureReason: text('failure_reason'),
  metadata: jsonb('metadata').default({}),
  
  // Grouping and threading
  groupId: uuid('group_id'), // For grouping related notifications
  threadId: uuid('thread_id'), // For conversation threading
  
  // Actions and interactions
  actions: jsonb('actions').default([]), // Available actions (buttons, links)
  interactions: jsonb('interactions').default([]), // User interactions with notification
}, (table) => ({
  recipientStatusIdx: index('idx_notifications_recipient_status')
    .on(table.recipientId, table.status),
  tenantTypeIdx: index('idx_notifications_tenant_type')
    .on(table.tenantId, table.type),
  scheduledIdx: index('idx_notifications_scheduled')
    .on(table.scheduledAt),
  statusCreatedIdx: index('idx_notifications_status_created')
    .on(table.status, table.createdAt),
  groupIdx: index('idx_notifications_group').on(table.groupId),
  threadIdx: index('idx_notifications_thread').on(table.threadId),
}));

// Notification delivery tracking for external services
export const notificationDeliveryLog = pgTable('notification_delivery_log', {
  ...baseSchema,
  notificationId: uuid('notification_id').notNull().references(() => notifications.id, { onDelete: 'cascade' }),
  channel: varchar('channel', { length: 20 }).notNull(),
  provider: varchar('provider', { length: 50 }), // twilio, sendgrid, fcm, etc.
  externalId: varchar('external_id', { length: 100 }),
  status: varchar('status', { length: 20 }).notNull(),
  statusCode: varchar('status_code', { length: 10 }),
  statusMessage: text('status_message'),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  cost: integer('cost'), // Cost in cents/smallest currency unit
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  notificationIdx: index('idx_notification_delivery_log_notification')
    .on(table.notificationId),
  statusIdx: index('idx_notification_delivery_log_status')
    .on(table.status, table.createdAt),
  providerIdx: index('idx_notification_delivery_log_provider')
    .on(table.provider, table.createdAt),
}));

// Notification subscription management (for topics, events, etc.)
export const notificationSubscriptions = pgTable('notification_subscriptions', {
  ...baseSchema,
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subscriptionType: varchar('subscription_type', { length: 50 }).notNull(), // topic, event, entity
  subscriptionKey: varchar('subscription_key', { length: 200 }).notNull(), // topic name, event type, entity ID
  channels: jsonb('channels').default([]), // Array of enabled channels for this subscription
  filters: jsonb('filters').default({}), // Filters for when to send notifications
  isActive: boolean('is_active').default(true),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (table) => ({
  userTypeKeyIdx: index('idx_notification_subscriptions_user_type_key')
    .on(table.userId, table.subscriptionType, table.subscriptionKey),
  tenantTypeIdx: index('idx_notification_subscriptions_tenant_type')
    .on(table.tenantId, table.subscriptionType),
  activeIdx: index('idx_notification_subscriptions_active')
    .on(table.isActive, table.expiresAt),
}));

// Device tokens for push notifications
export const deviceTokens = pgTable('device_tokens', {
  ...baseSchema,
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 500 }).notNull(),
  platform: varchar('platform', { length: 20 }).notNull(), // ios, android, web
  deviceId: varchar('device_id', { length: 100 }),
  appVersion: varchar('app_version', { length: 20 }),
  isActive: boolean('is_active').default(true),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (table) => ({
  userPlatformIdx: index('idx_device_tokens_user_platform')
    .on(table.userId, table.platform),
  tokenIdx: index('idx_device_tokens_token').on(table.token),
  activeIdx: index('idx_device_tokens_active')
    .on(table.isActive, table.expiresAt),
}));