import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { salesTerritories, territoryCustomerAssignments } from '../../database/schema';
import { eq, and, isNull } from 'drizzle-orm';

@Injectable()
export class TerritoryRepository {
  private readonly logger = new Logger(TerritoryRepository.name);

  constructor(private readonly drizzle: DrizzleService) {}

  async findById(tenantId: string, territoryId: string) {
    try {
      const [territory] = await this.drizzle.getDb()
        .select()
        .from(salesTerritories)
        .where(and(
          eq(salesTerritories.tenantId, tenantId),
          eq(salesTerritories.id, territoryId),
          isNull(salesTerritories.deletedAt)
        ));

      return territory;
    } catch (error) {
      this.logger.error(`Failed to find territory ${territoryId}:`, error);
      throw error;
    }
  }

  async findByCode(tenantId: string, territoryCode: string) {
    try {
      const [territory] = await this.drizzle.getDb()
        .select()
        .from(salesTerritories)
        .where(and(
          eq(salesTerritories.tenantId, tenantId),
          eq(salesTerritories.territoryCode, territoryCode),
          isNull(salesTerritories.deletedAt)
        ));

      return territory;
    } catch (error) {
      this.logger.error(`Failed to find territory by code ${territoryCode}:`, error);
      throw error;
    }
  }

  async findBySalesRep(tenantId: string, salesRepId: string) {
    try {
      return await this.drizzle.getDb()
        .select()
        .from(salesTerritories)
        .where(and(
          eq(salesTerritories.tenantId, tenantId),
          eq(salesTerritories.primarySalesRepId, salesRepId),
          isNull(salesTerritories.deletedAt)
        ));
    } catch (error) {
      this.logger.error(`Failed to find territories for sales rep ${salesRepId}:`, error);
      throw error;
    }
  }

  async create(territoryData: any) {
    try {
      const [territory] = await this.drizzle.getDb()
        .insert(salesTerritories)
        .values(territoryData)
        .returning();

      return territory;
    } catch (error) {
      this.logger.error(`Failed to create territory:`, error);
      throw error;
    }
  }

  async update(tenantId: string, territoryId: string, updateData: any) {
    try {
      const [territory] = await this.drizzle.getDb()
        .update(salesTerritories)
        .set(updateData)
        .where(and(
          eq(salesTerritories.tenantId, tenantId),
          eq(salesTerritories.id, territoryId),
          isNull(salesTerritories.deletedAt)
        ))
        .returning();

      return territory;
    } catch (error) {
      this.logger.error(`Failed to update territory ${territoryId}:`, error);
      throw error;
    }
  }

  async delete(tenantId: string, territoryId: string, userId: string) {
    try {
      const [territory] = await this.drizzle.getDb()
        .update(salesTerritories)
        .set({
          deletedAt: new Date(),
          updatedBy: userId,
        })
        .where(and(
          eq(salesTerritories.tenantId, tenantId),
          eq(salesTerritories.id, territoryId)
        ))
        .returning();

      return territory;
    } catch (error) {
      this.logger.error(`Failed to delete territory ${territoryId}:`, error);
      throw error;
    }
  }

  // Customer assignment methods
  async assignCustomer(assignmentData: any) {
    try {
      const [assignment] = await this.drizzle.getDb()
        .insert(territoryCustomerAssignments)
        .values(assignmentData)
        .returning();

      return assignment;
    } catch (error) {
      this.logger.error(`Failed to assign customer to territory:`, error);
      throw error;
    }
  }

  async findCustomerAssignment(tenantId: string, territoryId: string, customerId: string) {
    try {
      const [assignment] = await this.drizzle.getDb()
        .select()
        .from(territoryCustomerAssignments)
        .where(and(
          eq(territoryCustomerAssignments.tenantId, tenantId),
          eq(territoryCustomerAssignments.territoryId, territoryId),
          eq(territoryCustomerAssignments.customerId, customerId),
          eq(territoryCustomerAssignments.isActive, true),
          isNull(territoryCustomerAssignments.deletedAt)
        ));

      return assignment;
    } catch (error) {
      this.logger.error(`Failed to find customer assignment:`, error);
      throw error;
    }
  }

  async deactivateCustomerAssignments(tenantId: string, customerId: string, userId: string) {
    try {
      await this.drizzle.getDb()
        .update(territoryCustomerAssignments)
        .set({
          isActive: false,
          updatedBy: userId,
        })
        .where(and(
          eq(territoryCustomerAssignments.tenantId, tenantId),
          eq(territoryCustomerAssignments.customerId, customerId),
          eq(territoryCustomerAssignments.isActive, true)
        ));
    } catch (error) {
      this.logger.error(`Failed to deactivate customer assignments:`, error);
      throw error;
    }
  }
}