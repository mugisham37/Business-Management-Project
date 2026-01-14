import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';

import { DrizzleService } from '../../database/drizzle.service';
import { apiKeys } from '../../database/schema/integration.schema';

import { ApiKey } from '../entities/api-key.entity';

@Injectable()
export class ApiKeyRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(data: Partial<ApiKey>): Promise<ApiKey> {
    const [apiKey] = await this.drizzle.db!
      .insert(apiKeys)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    return apiKey as ApiKey;
  }

  async findById(tenantId: string, apiKeyId: string): Promise<ApiKey | null> {
    const [apiKey] = await this.drizzle.db!
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.id, apiKeyId),
          eq(apiKeys.tenantId, tenantId)
        )
      )
      .limit(1);

    return apiKey as ApiKey || null;
  }

  async findByPrefix(keyPrefix: string): Promise<ApiKey | null> {
    const [apiKey] = await this.drizzle.db!
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyPrefix, keyPrefix))
      .limit(1);

    return apiKey as ApiKey || null;
  }

  async findByIntegration(integrationId: string): Promise<ApiKey[]> {
    const results = await this.drizzle.db!
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.integrationId, integrationId));

    return results as ApiKey[];
  }

  async update(apiKeyId: string, data: Partial<ApiKey>): Promise<ApiKey> {
    const [apiKey] = await this.drizzle.db!
      .update(apiKeys)
      .set({
        ...data,
        updatedAt: new Date(),
      } as any)
      .where(eq(apiKeys.id, apiKeyId))
      .returning();

    return apiKey as ApiKey;
  }
}
