import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { 
  contracts, 
  customers,
  users
} from '../../database/schema';
import { eq, and, or, gte, lte, desc, asc, sql, isNull, ilike, inArray } from 'drizzle-orm';
import { 
  CreateContractInput, 
  UpdateContractInput, 
  ContractQueryInput, 
  ContractStatus 
} from '../types/contract.types';

export interface Contract {
  id: string;
  tenantId: string;
  contractNumber: string;
  customerId: string;
  status: ContractStatus;
  contractType: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  autoRenewal: boolean;
  renewalTermMonths?: number;
  renewalNoticeDays: number;
  contractValue?: number | null;
  minimumCommitment?: number | null;
  paymentTerms: string;
  pricingModel: string;
  pricingTerms: Record<string, any>;
  performanceMetrics: Record<string, any>;
  complianceRequirements: Record<string, any>;
  approvedBy?: string;
  approvedAt?: Date;
  signedBy?: string;
  signedAt?: Date;
  customerSignedAt?: Date;
  salesRepId?: string;
  accountManagerId?: string;
  termsAndConditions?: string;
  specialTerms?: string;
  renewalDate?: Date;
  renewalNotificationSent: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createContract(tenantId: string, data: CreateContractDto, userId: string): Promise<Contract> {
    try {
      // Validate contract data
      await this.validateContractData(tenantId, data);

      // Generate contract number
      const contractNumber = await this.generateContractNumber(tenantId);

      // Calculate renewal date if auto-renewal is enabled
      const renewalDate = data.autoRenewal && data.renewalTermMonths 
        ? this.calculateRenewalDate(new Date(data.endDate), data.renewalTermMonths)
        : null;

      // Create contract record
      const [contractRecord] = await this.drizzle.getDb()
        .insert(contracts)
        .values({
          tenantId,
          contractNumber,
          customerId: data.customerId,
          status: 'draft',
          contractType: data.contractType,
          title: data.title,
          description: data.description,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          autoRenewal: data.autoRenewal || false,
          renewalTermMonths: data.renewalTermMonths,
          renewalNoticeDays: data.renewalNoticeDays || 30,
          contractValue: data.contractValue?.toString(),
          minimumCommitment: data.minimumCommitment?.toString(),
          paymentTerms: data.paymentTerms,
          pricingModel: data.pricingModel,
          pricingTerms: data.pricingTerms || {},
          performanceMetrics: data.performanceMetrics || {},
          complianceRequirements: data.complianceRequirements || {},
          salesRepId: data.salesRepId,
          accountManagerId: data.accountManagerId,
          termsAndConditions: data.termsAndConditions,
          specialTerms: data.specialTerms,
          renewalDate,
          renewalNotificationSent: false,
          metadata: data.metadata || {},
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      if (!contractRecord) {
        throw new Error('Failed to create contract');
      }

      // Clear caches
      await this.invalidateContractCaches(tenantId);

      // Emit event
      this.eventEmitter.emit('contract.created', {
        tenantId,
        contractId: contractRecord.id,
        customerId: data.customerId,
        contractType: data.contractType,
        contractValue: data.contractValue,
        userId,
      });

      this.logger.log(`Created contract ${contractRecord.contractNumber} for tenant ${tenantId}`);
      return this.mapToContract(contractRecord);
    } catch (error) {
      this.logger.error(`Failed to create contract for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findContractById(tenantId: string, contractId: string): Promise<Contract> {
    try {
      const cacheKey = `contract:${tenantId}:${contractId}`;
      
      // Try cache first
      let contract = await this.cacheService.get<Contract>(cacheKey);
      
      if (!contract) {
        const [contractRecord] = await this.drizzle.getDb()
          .select()
          .from(contracts)
          .where(and(
            eq(contracts.tenantId, tenantId),
            eq(contracts.id, contractId),
            isNull(contracts.deletedAt)
          ));

        if (!contractRecord) {
          throw new NotFoundException(`Contract ${contractId} not found`);
        }

        contract = this.mapToContract(contractRecord);

        // Cache for 10 minutes
        await this.cacheService.set(cacheKey, contract, { ttl: 600 });
      }

      return contract;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to find contract ${contractId} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findContracts(tenantId: string, query: ContractQueryDto): Promise<{ contracts: Contract[]; total: number }> {
    try {
      const cacheKey = `contracts:${tenantId}:${JSON.stringify(query)}`;
      
      // Try cache first for common queries
      let result = await this.cacheService.get<{ contracts: Contract[]; total: number }>(cacheKey);
      
      if (!result) {
        const conditions = [
          eq(contracts.tenantId, tenantId),
          isNull(contracts.deletedAt)
        ];

        // Add search conditions
        if (query.search) {
          conditions.push(
            or(
              ilike(contracts.contractNumber, `%${query.search}%`),
              ilike(contracts.title, `%${query.search}%`)
            )!
          );
        }

        // Add filter conditions
        if (query.status) {
          conditions.push(eq(contracts.status, query.status));
        }

        if (query.contractType) {
          conditions.push(eq(contracts.contractType, query.contractType));
        }

        if (query.customerId) {
          conditions.push(eq(contracts.customerId, query.customerId));
        }

        if (query.salesRepId) {
          conditions.push(eq(contracts.salesRepId, query.salesRepId));
        }

        if (query.accountManagerId) {
          conditions.push(eq(contracts.accountManagerId, query.accountManagerId));
        }

        if (query.startDateFrom) {
          conditions.push(gte(contracts.startDate, new Date(query.startDateFrom)));
        }

        if (query.startDateTo) {
          conditions.push(lte(contracts.startDate, new Date(query.startDateTo)));
        }

        if (query.endDateFrom) {
          conditions.push(gte(contracts.endDate, new Date(query.endDateFrom)));
        }

        if (query.endDateTo) {
          conditions.push(lte(contracts.endDate, new Date(query.endDateTo)));
        }

        if (query.minContractValue !== undefined) {
          conditions.push(gte(contracts.contractValue, query.minContractValue.toString()));
        }

        if (query.maxContractValue !== undefined) {
          conditions.push(lte(contracts.contractValue, query.maxContractValue.toString()));
        }

        // Handle expiring contracts
        if (query.expiringWithinDays !== undefined) {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + query.expiringWithinDays);
          conditions.push(
            and(
              lte(contracts.endDate, expiryDate),
              gte(contracts.endDate, new Date()),
              eq(contracts.status, 'active')
            )!
          );
        }

        // Handle renewal notice requirement
        if (query.requiresRenewalNotice) {
          const noticeDate = new Date();
          conditions.push(
            and(
              eq(contracts.autoRenewal, true),
              eq(contracts.renewalNotificationSent, false),
              sql`${contracts.endDate} - INTERVAL '1 day' * ${contracts.renewalNoticeDays} <= ${noticeDate}`
            )!
          );
        }

        const whereClause = and(...conditions);

        // Get total count
        const [countResult] = await this.drizzle.getDb()
          .select({ count: sql<number>`count(*)` })
          .from(contracts)
          .where(whereClause);

        const total = countResult?.count || 0;

        // Get paginated results
        const offset = ((query.page || 1) - 1) * (query.limit || 20);
        let sortByField: any = contracts.contractNumber;
        if (query.sortBy && query.sortBy in contracts) {
          const field = contracts[query.sortBy as keyof typeof contracts];
          if (field && typeof field !== 'function') {
            sortByField = field;
          }
        }
        const orderBy = query.sortOrder === 'asc' 
          ? asc(sortByField)
          : desc(sortByField);

        const contractsList = await this.drizzle.getDb()
          .select()
          .from(contracts)
          .where(whereClause)
          .orderBy(orderBy)
          .limit(query.limit || 20)
          .offset(offset);

        result = {
          contracts: contractsList.map(record => this.mapToContract(record)),
          total: total,
        };

        // Cache for 5 minutes
        await this.cacheService.set(cacheKey, result, { ttl: 300 });
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to find contracts for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async updateContract(tenantId: string, contractId: string, data: UpdateContractDto, userId: string): Promise<Contract> {
    try {
      // Check if contract exists and can be updated
      const existingContract = await this.findContractById(tenantId, contractId);
      
      if (!this.canUpdateContract(existingContract.status)) {
        throw new BadRequestException(`Cannot update contract in ${existingContract.status} status`);
      }

      // Update contract record
      const updateData: any = { ...data, updatedBy: userId };
      
      // Convert date fields
      if (data.endDate) {
        updateData.endDate = new Date(data.endDate);
        
        // Recalculate renewal date if auto-renewal is enabled
        if (existingContract.autoRenewal && existingContract.renewalTermMonths) {
          updateData.renewalDate = this.calculateRenewalDate(
            new Date(data.endDate), 
            existingContract.renewalTermMonths
          );
        }
      }

      // Convert decimal fields to strings
      if (data.contractValue !== undefined) {
        updateData.contractValue = data.contractValue.toString();
      }
      if (data.minimumCommitment !== undefined) {
        updateData.minimumCommitment = data.minimumCommitment.toString();
      }

      const [updatedContract] = await this.drizzle.getDb()
        .update(contracts)
        .set(updateData)
        .where(and(
          eq(contracts.tenantId, tenantId),
          eq(contracts.id, contractId),
          isNull(contracts.deletedAt)
        ))
        .returning();

      if (!updatedContract) {
        throw new Error(`Contract ${contractId} not found for update`);
      }

      // Clear caches
      await this.invalidateContractCaches(tenantId, contractId);

      // Emit event
      this.eventEmitter.emit('contract.updated', {
        tenantId,
        contractId,
        previousStatus: existingContract.status,
        newStatus: updatedContract.status,
        userId,
      });

      return this.findContractById(tenantId, contractId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to update contract ${contractId} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async approveContract(tenantId: string, contractId: string, _approvalNotes: string, userId: string): Promise<Contract> {
    try {
      const existingContract = await this.findContractById(tenantId, contractId);
      
      if (existingContract.status !== 'pending_approval') {
        throw new BadRequestException('Contract is not pending approval');
      }

      const [updatedContract] = await this.drizzle.getDb()
        .update(contracts)
        .set({
          status: 'active',
          approvedBy: userId,
          approvedAt: new Date(),
          updatedBy: userId,
        })
        .where(and(
          eq(contracts.tenantId, tenantId),
          eq(contracts.id, contractId)
        ))
        .returning();

      // Clear caches
      await this.invalidateContractCaches(tenantId, contractId);

      // Emit event
      this.eventEmitter.emit('contract.approved', {
        tenantId,
        contractId,
        customerId: existingContract.customerId,
        contractValue: existingContract.contractValue,
        approvedBy: userId,
      });

      return this.findContractById(tenantId, contractId);
    } catch (error) {
      this.logger.error(`Failed to approve contract ${contractId}:`, error);
      throw error;
    }
  }

  async signContract(tenantId: string, contractId: string, customerSignedAt: Date | undefined, userId: string): Promise<Contract> {
    try {
      const existingContract = await this.findContractById(tenantId, contractId);
      
      if (existingContract.status !== 'active') {
        throw new BadRequestException('Contract must be active to sign');
      }

      const [updatedContract] = await this.drizzle.getDb()
        .update(contracts)
        .set({
          signedBy: userId,
          signedAt: new Date(),
          customerSignedAt: customerSignedAt || new Date(),
          updatedBy: userId,
        })
        .where(and(
          eq(contracts.tenantId, tenantId),
          eq(contracts.id, contractId)
        ))
        .returning();

      // Clear caches
      await this.invalidateContractCaches(tenantId, contractId);

      // Emit event
      this.eventEmitter.emit('contract.signed', {
        tenantId,
        contractId,
        customerId: existingContract.customerId,
        signedBy: userId,
      });

      return this.findContractById(tenantId, contractId);
    } catch (error) {
      this.logger.error(`Failed to sign contract ${contractId}:`, error);
      throw error;
    }
  }

  async renewContract(tenantId: string, contractId: string, newEndDate: Date, contractValue?: number, pricingTerms?: Record<string, any>, userId?: string): Promise<Contract> {
    try {
      const existingContract = await this.findContractById(tenantId, contractId);
      
      if (existingContract.status !== 'active') {
        throw new BadRequestException('Only active contracts can be renewed');
      }

      // Calculate new renewal date
      const renewalDate = existingContract.autoRenewal && existingContract.renewalTermMonths
        ? this.calculateRenewalDate(newEndDate, existingContract.renewalTermMonths)
        : null;

      const updateData: any = {
        endDate: newEndDate,
        renewalDate,
        renewalNotificationSent: false,
        updatedBy: userId,
      };

      if (contractValue !== undefined) {
        updateData.contractValue = contractValue.toString();
      }

      if (pricingTerms) {
        updateData.pricingTerms = pricingTerms;
      }

      const [updatedContract] = await this.drizzle.getDb()
        .update(contracts)
        .set(updateData)
        .where(and(
          eq(contracts.tenantId, tenantId),
          eq(contracts.id, contractId)
        ))
        .returning();

      // Clear caches
      await this.invalidateContractCaches(tenantId, contractId);

      // Emit event
      this.eventEmitter.emit('contract.renewed', {
        tenantId,
        contractId,
        customerId: existingContract.customerId,
        newEndDate,
        contractValue,
        renewedBy: userId,
      });

      return this.findContractById(tenantId, contractId);
    } catch (error) {
      this.logger.error(`Failed to renew contract ${contractId}:`, error);
      throw error;
    }
  }

  async getExpiringContracts(tenantId: string, days: number = 30): Promise<Contract[]> {
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);

      const expiringContracts = await this.drizzle.getDb()
        .select()
        .from(contracts)
        .where(and(
          eq(contracts.tenantId, tenantId),
          eq(contracts.status, 'active'),
          lte(contracts.endDate, expiryDate),
          gte(contracts.endDate, new Date()),
          isNull(contracts.deletedAt)
        ))
        .orderBy(asc(contracts.endDate));

      return expiringContracts.map(record => this.mapToContract(record));
    } catch (error) {
      this.logger.error(`Failed to get expiring contracts for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async getContractsRequiringRenewalNotice(tenantId: string): Promise<Contract[]> {
    try {
      const today = new Date();

      const contractsRequiringNotice = await this.drizzle.getDb()
        .select()
        .from(contracts)
        .where(and(
          eq(contracts.tenantId, tenantId),
          eq(contracts.status, 'active'),
          eq(contracts.autoRenewal, true),
          eq(contracts.renewalNotificationSent, false),
          sql`${contracts.endDate} - INTERVAL '1 day' * ${contracts.renewalNoticeDays} <= ${today}`,
          isNull(contracts.deletedAt)
        ))
        .orderBy(asc(contracts.endDate));

      return contractsRequiringNotice.map(record => this.mapToContract(record));
    } catch (error) {
      this.logger.error(`Failed to get contracts requiring renewal notice for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async markRenewalNotificationSent(tenantId: string, contractId: string): Promise<void> {
    try {
      await this.drizzle.getDb()
        .update(contracts)
        .set({
          renewalNotificationSent: true,
        })
        .where(and(
          eq(contracts.tenantId, tenantId),
          eq(contracts.id, contractId)
        ));

      // Clear caches
      await this.invalidateContractCaches(tenantId, contractId);
    } catch (error) {
      this.logger.error(`Failed to mark renewal notification sent for contract ${contractId}:`, error);
      throw error;
    }
  }

  private async validateContractData(tenantId: string, data: CreateContractDto): Promise<void> {
    // Validate customer exists
    const [customer] = await this.drizzle.getDb()
      .select()
      .from(customers)
      .where(and(
        eq(customers.tenantId, tenantId),
        eq(customers.id, data.customerId),
        isNull(customers.deletedAt)
      ));

    if (!customer) {
      throw new NotFoundException(`Customer ${data.customerId} not found`);
    }

    // Validate dates
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Validate sales rep and account manager if provided
    if (data.salesRepId) {
      const [salesRep] = await this.drizzle.getDb()
        .select()
        .from(users)
        .where(and(
          eq(users.tenantId, tenantId),
          eq(users.id, data.salesRepId),
          isNull(users.deletedAt)
        ));

      if (!salesRep) {
        throw new NotFoundException(`Sales representative ${data.salesRepId} not found`);
      }
    }

    if (data.accountManagerId) {
      const [accountManager] = await this.drizzle.getDb()
        .select()
        .from(users)
        .where(and(
          eq(users.tenantId, tenantId),
          eq(users.id, data.accountManagerId),
          isNull(users.deletedAt)
        ));

      if (!accountManager) {
        throw new NotFoundException(`Account manager ${data.accountManagerId} not found`);
      }
    }
  }

  private async generateContractNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CON-${year}-`;
    
    // Get the latest contract number for this year
    const [latestContract] = await this.drizzle.getDb()
      .select({ contractNumber: contracts.contractNumber })
      .from(contracts)
      .where(and(
        eq(contracts.tenantId, tenantId),
        ilike(contracts.contractNumber, `${prefix}%`)
      ))
      .orderBy(desc(contracts.contractNumber))
      .limit(1);

    let nextNumber = 1;
    if (latestContract) {
      const currentNumber = parseInt(latestContract.contractNumber.split('-').pop() || '0');
      nextNumber = currentNumber + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
  }

  private calculateRenewalDate(endDate: Date, renewalTermMonths: number): Date {
    const renewalDate = new Date(endDate);
    renewalDate.setMonth(renewalDate.getMonth() + renewalTermMonths);
    return renewalDate;
  }

  private canUpdateContract(status: string): boolean {
    const updatableStatuses = ['draft', 'pending_approval'];
    return updatableStatuses.includes(status);
  }

  private mapToContract(contractRecord: any): Contract {
    return {
      id: contractRecord.id,
      tenantId: contractRecord.tenantId,
      contractNumber: contractRecord.contractNumber,
      customerId: contractRecord.customerId,
      status: contractRecord.status,
      contractType: contractRecord.contractType,
      title: contractRecord.title,
      description: contractRecord.description,
      startDate: contractRecord.startDate,
      endDate: contractRecord.endDate,
      autoRenewal: contractRecord.autoRenewal,
      renewalTermMonths: contractRecord.renewalTermMonths,
      renewalNoticeDays: contractRecord.renewalNoticeDays,
      contractValue: contractRecord.contractValue ? parseFloat(contractRecord.contractValue) : null,
      minimumCommitment: contractRecord.minimumCommitment ? parseFloat(contractRecord.minimumCommitment) : null,
      paymentTerms: contractRecord.paymentTerms,
      pricingModel: contractRecord.pricingModel,
      pricingTerms: contractRecord.pricingTerms || {},
      performanceMetrics: contractRecord.performanceMetrics || {},
      complianceRequirements: contractRecord.complianceRequirements || {},
      approvedBy: contractRecord.approvedBy,
      approvedAt: contractRecord.approvedAt,
      signedBy: contractRecord.signedBy,
      signedAt: contractRecord.signedAt,
      customerSignedAt: contractRecord.customerSignedAt,
      salesRepId: contractRecord.salesRepId,
      accountManagerId: contractRecord.accountManagerId,
      termsAndConditions: contractRecord.termsAndConditions,
      specialTerms: contractRecord.specialTerms,
      renewalDate: contractRecord.renewalDate,
      renewalNotificationSent: contractRecord.renewalNotificationSent,
      metadata: contractRecord.metadata || {},
      createdAt: contractRecord.createdAt,
      updatedAt: contractRecord.updatedAt,
    };
  }

  private async invalidateContractCaches(tenantId: string, contractId?: string): Promise<void> {
    try {
      await this.cacheService.invalidatePattern(`contracts:${tenantId}:*`);
      
      if (contractId) {
        await this.cacheService.invalidatePattern(`contract:${tenantId}:${contractId}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to invalidate contract caches for tenant ${tenantId}:`, error);
    }
  }
}