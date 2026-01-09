import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, isNull } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { supplierContacts } from '../../database/schema/supplier.schema';
import { CreateSupplierContactDto, UpdateSupplierContactDto } from '../dto/supplier.dto';

@Injectable()
export class SupplierContactRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(
    tenantId: string,
    supplierId: string,
    data: CreateSupplierContactDto,
    userId: string,
  ): Promise<typeof supplierContacts.$inferSelect> {
    // If this is set as primary, unset other primary contacts for this supplier
    if (data.isPrimary) {
      await this.drizzle.db
        .update(supplierContacts)
        .set({ isPrimary: false, updatedBy: userId, updatedAt: new Date() })
        .where(
          and(
            eq(supplierContacts.tenantId, tenantId),
            eq(supplierContacts.supplierId, supplierId),
            eq(supplierContacts.isPrimary, true),
            isNull(supplierContacts.deletedAt),
          ),
        );
    }

    const [contact] = await this.drizzle.db
      .insert(supplierContacts)
      .values({
        tenantId,
        supplierId,
        ...data,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return contact;
  }

  async findById(
    tenantId: string,
    id: string,
  ): Promise<typeof supplierContacts.$inferSelect | null> {
    const [contact] = await this.drizzle.db
      .select()
      .from(supplierContacts)
      .where(
        and(
          eq(supplierContacts.tenantId, tenantId),
          eq(supplierContacts.id, id),
          isNull(supplierContacts.deletedAt),
        ),
      )
      .limit(1);

    return contact || null;
  }

  async findBySupplier(
    tenantId: string,
    supplierId: string,
  ): Promise<(typeof supplierContacts.$inferSelect)[]> {
    return await this.drizzle.db
      .select()
      .from(supplierContacts)
      .where(
        and(
          eq(supplierContacts.tenantId, tenantId),
          eq(supplierContacts.supplierId, supplierId),
          isNull(supplierContacts.deletedAt),
        ),
      )
      .orderBy(desc(supplierContacts.isPrimary), asc(supplierContacts.firstName));
  }

  async findPrimaryContact(
    tenantId: string,
    supplierId: string,
  ): Promise<typeof supplierContacts.$inferSelect | null> {
    const [contact] = await this.drizzle.db
      .select()
      .from(supplierContacts)
      .where(
        and(
          eq(supplierContacts.tenantId, tenantId),
          eq(supplierContacts.supplierId, supplierId),
          eq(supplierContacts.isPrimary, true),
          isNull(supplierContacts.deletedAt),
        ),
      )
      .limit(1);

    return contact || null;
  }

  async update(
    tenantId: string,
    id: string,
    data: UpdateSupplierContactDto,
    userId: string,
  ): Promise<typeof supplierContacts.$inferSelect | null> {
    // If this is being set as primary, unset other primary contacts for this supplier
    if (data.isPrimary) {
      const contact = await this.findById(tenantId, id);
      if (contact) {
        await this.drizzle.db
          .update(supplierContacts)
          .set({ isPrimary: false, updatedBy: userId, updatedAt: new Date() })
          .where(
            and(
              eq(supplierContacts.tenantId, tenantId),
              eq(supplierContacts.supplierId, contact.supplierId),
              eq(supplierContacts.isPrimary, true),
              isNull(supplierContacts.deletedAt),
            ),
          );
      }
    }

    const [contact] = await this.drizzle.db
      .update(supplierContacts)
      .set({
        ...data,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(supplierContacts.tenantId, tenantId),
          eq(supplierContacts.id, id),
          isNull(supplierContacts.deletedAt),
        ),
      )
      .returning();

    return contact || null;
  }

  async delete(tenantId: string, id: string, userId: string): Promise<boolean> {
    const [contact] = await this.drizzle.db
      .update(supplierContacts)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(supplierContacts.tenantId, tenantId),
          eq(supplierContacts.id, id),
          isNull(supplierContacts.deletedAt),
        ),
      )
      .returning();

    return !!contact;
  }

  async setPrimary(
    tenantId: string,
    id: string,
    userId: string,
  ): Promise<typeof supplierContacts.$inferSelect | null> {
    const contact = await this.findById(tenantId, id);
    if (!contact) {
      return null;
    }

    // Unset other primary contacts for this supplier
    await this.drizzle.db
      .update(supplierContacts)
      .set({ isPrimary: false, updatedBy: userId, updatedAt: new Date() })
      .where(
        and(
          eq(supplierContacts.tenantId, tenantId),
          eq(supplierContacts.supplierId, contact.supplierId),
          eq(supplierContacts.isPrimary, true),
          isNull(supplierContacts.deletedAt),
        ),
      );

    // Set this contact as primary
    const [updatedContact] = await this.drizzle.db
      .update(supplierContacts)
      .set({
        isPrimary: true,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(supplierContacts.tenantId, tenantId),
          eq(supplierContacts.id, id),
          isNull(supplierContacts.deletedAt),
        ),
      )
      .returning();

    return updatedContact || null;
  }

  async findByEmail(
    tenantId: string,
    email: string,
  ): Promise<(typeof supplierContacts.$inferSelect)[]> {
    return await this.drizzle.db
      .select()
      .from(supplierContacts)
      .where(
        and(
          eq(supplierContacts.tenantId, tenantId),
          eq(supplierContacts.email, email),
          isNull(supplierContacts.deletedAt),
        ),
      )
      .orderBy(asc(supplierContacts.firstName));
  }

  async countBySupplier(tenantId: string, supplierId: string): Promise<number> {
    const [result] = await this.drizzle.db
      .select({ count: eq(supplierContacts.id, supplierContacts.id) })
      .from(supplierContacts)
      .where(
        and(
          eq(supplierContacts.tenantId, tenantId),
          eq(supplierContacts.supplierId, supplierId),
          isNull(supplierContacts.deletedAt),
        ),
      );

    return result?.count || 0;
  }
}