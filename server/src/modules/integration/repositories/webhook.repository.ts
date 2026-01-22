import { Injectable } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';

import { DrizzleService } from '../../database/drizzle.service';
import { webhooks, webhookDeliveries } from '../../database/schema/integration.schema';

import { Webhook, WebhookDelivery } from '../entities/webhook.entity';

@Injectable()
export class WebhookRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(data: Partial<Webhook>): Promise<Webhook> {
    const [webhook] = await this.drizzle.db!
      .insert(webhooks)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    return webhook as Webhook;
  }

  async findById(webhookId: string): Promise<Webhook | null> {
    const [webhook] = await this.drizzle.db!
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, webhookId))
      .limit(1);

    return webhook as Webhook || null;
  }

  async findByIntegration(integrationId: string): Promise<Webhook[]> {
    const results = await this.drizzle.db!
      .select()
      .from(webhooks)
      .where(eq(webhooks.integrationId, integrationId));

    return results as Webhook[];
  }

  async findMatchingWebhooks(
    tenantId: string,
    event: string,
    integrationId?: string,
  ): Promise<Webhook[]> {
    const db = this.drizzle.db!;
    
    const baseConditions = and(
      eq(webhooks.isActive, true),
      sql`${webhooks.events} @> ${JSON.stringify([event])}`
    );

    let results;
    if (integrationId) {
      results = await db
        .select()
        .from(webhooks)
        .where(and(baseConditions, eq(webhooks.integrationId, integrationId)));
    } else {
      results = await db
        .select()
        .from(webhooks)
        .where(baseConditions);
    }

    return results as Webhook[];
  }

  async update(webhookId: string, data: Partial<Webhook>): Promise<Webhook> {
    const [webhook] = await this.drizzle.db!
      .update(webhooks)
      .set({
        ...data,
        updatedAt: new Date(),
      } as any)
      .where(eq(webhooks.id, webhookId))
      .returning();

    return webhook as Webhook;
  }

  async softDelete(webhookId: string): Promise<void> {
    await this.drizzle.db!
      .update(webhooks)
      .set({
        deletedAt: new Date(),
        isActive: false,
      })
      .where(eq(webhooks.id, webhookId));
  }

  async logDelivery(data: Partial<WebhookDelivery>): Promise<WebhookDelivery> {
    const [delivery] = await this.drizzle.db!
      .insert(webhookDeliveries)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    return delivery as WebhookDelivery;
  }

  async getDeliveryHistory(
    webhookId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<WebhookDelivery[]> {
    const results = await this.drizzle.db!
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhookId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit)
      .offset(offset);

    return results as WebhookDelivery[];
  }

  async getFailedDeliveries(): Promise<WebhookDelivery[]> {
    const results = await this.drizzle.db!
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.success, false),
          sql`${webhookDeliveries.retryCount} < 3`,
          sql`${webhookDeliveries.nextRetryAt} <= NOW()`
        )
      );

    return results as WebhookDelivery[];
  }

  /**
   * Find webhooks by integration IDs (for dataloader)
   */
  async findByIntegrationIds(integrationIds: string[]): Promise<Webhook[]> {
    const results = await this.drizzle.db!
      .select()
      .from(webhooks)
      .where(
        sql`${webhooks.integrationId} = ANY(${integrationIds})`
      );

    return results as Webhook[];
  }

  /**
   * Find webhooks by event types (for dataloader)
   */
  async findByEventTypes(eventTypes: string[]): Promise<Webhook[]> {
    const results = await this.drizzle.db!
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.isActive, true),
          sql`${webhooks.events} && ${eventTypes}`
        )
      );

    return results as Webhook[];
  }
}