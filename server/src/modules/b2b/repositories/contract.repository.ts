import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { contracts } from '../../database/schema';
import { eq, and, isNull } from 'drizzle-orm';

@Injectable()
export class ContractRepository {
  private readonly logger = new Logger(ContractRepository.name);

  constructor(private readonly drizzle: DrizzleService) {}

  async findById(tenantId: string, contractId: string) {
    try {
      const [contract] = await this.drizzle.getDb()
        .select()
        .from(contracts)
        .where(and(
          eq(contracts.tenantId, tenantId),
          eq(contracts.id, contractId),
          isNull(contracts.deletedAt)
        ));

      return contract;
    } catch (error) {
      this.logger.error(`Failed to find contract ${contractId}:`, error);
      throw error;
    }
  }

  async findByCustomerId(tenantId: string, customerId: string) {
    try {
      return await this.drizzle.getDb()
        .select()
        .from(contracts)
        .where(and(
          eq(contracts.tenantId, tenantId),
          eq(contracts.customerId, customerId),
          isNull(contracts.deletedAt)
        ));
    } catch (error) {
      this.logger.error(`Failed to find contracts for customer ${customerId}:`, error);
      throw error;
    }
  }

  async create(contractData: any) {
    try {
      const [contract] = await this.drizzle.getDb()
        .insert(contracts)
        .values(contractData)
        .returning();

      return contract;
    } catch (error) {
      this.logger.error(`Failed to create contract:`, error);
      throw error;
    }
  }

  async update(tenantId: string, contractId: string, updateData: any) {
    try {
      const [contract] = await this.drizzle.getDb()
        .update(contracts)
        .set(updateData)
        .where(and(
          eq(contracts.tenantId, tenantId),
          eq(contracts.id, contractId),
          isNull(contracts.deletedAt)
        ))
        .returning();

      return contract;
    } catch (error) {
      this.logger.error(`Failed to update contract ${contractId}:`, error);
      throw error;
    }
  }

  async delete(tenantId: string, contractId: string, userId: string) {
    try {
      const [contract] = await this.drizzle.getDb()
        .update(contracts)
        .set({
          deletedAt: new Date(),
          updatedBy: userId,
        })
        .where(and(
          eq(contracts.tenantId, tenantId),
          eq(contracts.id, contractId)
        ))
        .returning();

      return contract;
    } catch (error) {
      this.logger.error(`Failed to delete contract ${contractId}:`, error);
      throw error;
    }
  }
}