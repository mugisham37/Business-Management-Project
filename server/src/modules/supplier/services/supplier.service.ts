import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupplierRepository } from '../repositories/supplier.repository';
import { SupplierContactRepository } from '../repositories/supplier-contact.repository';
import { SupplierCommunicationRepository } from '../repositories/supplier-communication.repository';
import { SupplierEvaluationRepository } from '../repositories/supplier-evaluation.repository';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  SupplierQueryDto,
  CreateSupplierContactDto,
  UpdateSupplierContactDto,
  CreateSupplierCommunicationDto,
  CreateSupplierEvaluationDto,
} from '../dto/supplier.dto';
import { suppliers } from '../../database/schema/supplier.schema';

// Domain Events
export class SupplierCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly supplierId: string,
    public readonly supplierData: typeof suppliers.$inferSelect,
    public readonly userId: string,
  ) {}
}

export class SupplierUpdatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly supplierId: string,
    public readonly changes: Partial<UpdateSupplierDto>,
    public readonly userId: string,
  ) {}
}

export class SupplierEvaluatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly supplierId: string,
    public readonly evaluationId: string,
    public readonly overallScore: number,
    public readonly overallRating: string,
    public readonly evaluatorId: string,
  ) {}
}

export class SupplierCommunicationCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly supplierId: string,
    public readonly communicationId: string,
    public readonly type: string,
    public readonly direction: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class SupplierService {
  constructor(
    private readonly supplierRepository: SupplierRepository,
    private readonly contactRepository: SupplierContactRepository,
    private readonly communicationRepository: SupplierCommunicationRepository,
    private readonly evaluationRepository: SupplierEvaluationRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Supplier Management
  async createSupplier(
    tenantId: string,
    data: CreateSupplierDto,
    userId: string,
  ): Promise<typeof suppliers.$inferSelect> {
    // Check if supplier code already exists
    const existingSupplier = await this.supplierRepository.findByCode(tenantId, data.supplierCode);
    if (existingSupplier) {
      throw new ConflictException(`Supplier with code '${data.supplierCode}' already exists`);
    }

    const supplier = await this.supplierRepository.create(tenantId, data, userId);

    // Emit domain event
    this.eventEmitter.emit(
      'supplier.created',
      new SupplierCreatedEvent(tenantId, supplier.id, supplier, userId),
    );

    return supplier;
  }

  async getSupplier(
    tenantId: string,
    id: string,
    includeRelations = false,
  ): Promise<typeof suppliers.$inferSelect> {
    const result = await this.supplierRepository.findById(tenantId, id, includeRelations);
    if (!result) {
      throw new NotFoundException('Supplier not found');
    }

    return result.supplier;
  }

  async getSupplierWithRelations(tenantId: string, id: string) {
    const result = await this.supplierRepository.findById(tenantId, id, true);
    if (!result) {
      throw new NotFoundException('Supplier not found');
    }

    return result;
  }

  async getSuppliers(tenantId: string, query: SupplierQueryDto) {
    return await this.supplierRepository.findMany(tenantId, query);
  }

  async updateSupplier(
    tenantId: string,
    id: string,
    data: UpdateSupplierDto,
    userId: string,
  ): Promise<typeof suppliers.$inferSelect> {
    const supplier = await this.supplierRepository.update(tenantId, id, data, userId);
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    // Emit domain event
    this.eventEmitter.emit(
      'supplier.updated',
      new SupplierUpdatedEvent(tenantId, id, data, userId),
    );

    return supplier;
  }

  async deleteSupplier(tenantId: string, id: string, userId: string): Promise<void> {
    const deleted = await this.supplierRepository.delete(tenantId, id, userId);
    if (!deleted) {
      throw new NotFoundException('Supplier not found');
    }
  }

  async getSupplierByCode(
    tenantId: string,
    supplierCode: string,
  ): Promise<typeof suppliers.$inferSelect> {
    const supplier = await this.supplierRepository.findByCode(tenantId, supplierCode);
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async getPreferredSuppliers(tenantId: string): Promise<(typeof suppliers.$inferSelect)[]> {
    return await this.supplierRepository.findPreferredSuppliers(tenantId);
  }

  async getSuppliersByStatus(
    tenantId: string,
    status: string,
  ): Promise<(typeof suppliers.$inferSelect)[]> {
    return await this.supplierRepository.findByStatus(tenantId, status);
  }

  async searchSuppliers(
    tenantId: string,
    searchTerm: string,
    limit = 10,
  ): Promise<(typeof suppliers.$inferSelect)[]> {
    return await this.supplierRepository.searchSuppliers(tenantId, searchTerm, limit);
  }

  async getSupplierStats(tenantId: string) {
    return await this.supplierRepository.getSupplierStats(tenantId);
  }

  // Contact Management
  async createSupplierContact(
    tenantId: string,
    supplierId: string,
    data: CreateSupplierContactDto,
    userId: string,
  ) {
    // Verify supplier exists
    await this.getSupplier(tenantId, supplierId);

    return await this.contactRepository.create(tenantId, supplierId, data, userId);
  }

  async getSupplierContacts(tenantId: string, supplierId: string) {
    return await this.contactRepository.findBySupplier(tenantId, supplierId);
  }

  async getSupplierContact(tenantId: string, contactId: string) {
    const contact = await this.contactRepository.findById(tenantId, contactId);
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return contact;
  }

  async updateSupplierContact(
    tenantId: string,
    contactId: string,
    data: UpdateSupplierContactDto,
    userId: string,
  ) {
    const contact = await this.contactRepository.update(tenantId, contactId, data, userId);
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return contact;
  }

  async deleteSupplierContact(tenantId: string, contactId: string, userId: string): Promise<void> {
    const deleted = await this.contactRepository.delete(tenantId, contactId, userId);
    if (!deleted) {
      throw new NotFoundException('Contact not found');
    }
  }

  async setPrimaryContact(tenantId: string, contactId: string, userId: string) {
    const contact = await this.contactRepository.setPrimary(tenantId, contactId, userId);
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return contact;
  }

  async getPrimaryContact(tenantId: string, supplierId: string) {
    return await this.contactRepository.findPrimaryContact(tenantId, supplierId);
  }

  // Communication Management
  async createCommunication(
    tenantId: string,
    data: CreateSupplierCommunicationDto,
    userId: string,
  ) {
    // Verify supplier exists
    await this.getSupplier(tenantId, data.supplierId);

    // Verify contact exists if provided
    if (data.contactId) {
      await this.getSupplierContact(tenantId, data.contactId);
    }

    const communication = await this.communicationRepository.create(tenantId, data, userId);

    // Emit domain event
    this.eventEmitter.emit(
      'supplier.communication.created',
      new SupplierCommunicationCreatedEvent(
        tenantId,
        data.supplierId,
        communication.id,
        data.type,
        data.direction,
        userId,
      ),
    );

    return communication;
  }

  async getSupplierCommunications(
    tenantId: string,
    supplierId: string,
    limit = 50,
    offset = 0,
  ) {
    return await this.communicationRepository.findBySupplier(tenantId, supplierId, limit, offset);
  }

  async getCommunication(tenantId: string, communicationId: string) {
    const communication = await this.communicationRepository.findById(tenantId, communicationId);
    if (!communication) {
      throw new NotFoundException('Communication not found');
    }

    return communication;
  }

  async updateCommunication(
    tenantId: string,
    communicationId: string,
    data: Partial<CreateSupplierCommunicationDto>,
    userId: string,
  ) {
    const communication = await this.communicationRepository.update(
      tenantId,
      communicationId,
      data,
      userId,
    );
    if (!communication) {
      throw new NotFoundException('Communication not found');
    }

    return communication;
  }

  async deleteCommunication(tenantId: string, communicationId: string, userId: string): Promise<void> {
    const deleted = await this.communicationRepository.delete(tenantId, communicationId, userId);
    if (!deleted) {
      throw new NotFoundException('Communication not found');
    }
  }

  async getPendingFollowUps(tenantId: string, beforeDate?: Date) {
    return await this.communicationRepository.findPendingFollowUps(tenantId, beforeDate);
  }

  async markFollowUpComplete(tenantId: string, communicationId: string, userId: string) {
    const communication = await this.communicationRepository.markFollowUpComplete(
      tenantId,
      communicationId,
      userId,
    );
    if (!communication) {
      throw new NotFoundException('Communication not found');
    }

    return communication;
  }

  async getCommunicationStats(
    tenantId: string,
    supplierId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    return await this.communicationRepository.getCommunicationStats(
      tenantId,
      supplierId,
      startDate,
      endDate,
    );
  }

  // Evaluation Management
  async createEvaluation(
    tenantId: string,
    data: CreateSupplierEvaluationDto,
    evaluatorId: string,
  ) {
    // Verify supplier exists
    await this.getSupplier(tenantId, data.supplierId);

    // Validate evaluation period
    const startDate = new Date(data.evaluationPeriodStart);
    const endDate = new Date(data.evaluationPeriodEnd);
    if (startDate >= endDate) {
      throw new BadRequestException('Evaluation period start date must be before end date');
    }

    const evaluation = await this.evaluationRepository.create(tenantId, data, evaluatorId);

    // Emit domain event
    this.eventEmitter.emit(
      'supplier.evaluated',
      new SupplierEvaluatedEvent(
        tenantId,
        data.supplierId,
        evaluation.id,
        data.overallScore,
        data.overallRating,
        evaluatorId,
      ),
    );

    return evaluation;
  }

  async getSupplierEvaluations(
    tenantId: string,
    supplierId: string,
    limit = 20,
    offset = 0,
  ) {
    return await this.evaluationRepository.findBySupplier(tenantId, supplierId, limit, offset);
  }

  async getEvaluation(tenantId: string, evaluationId: string) {
    const evaluation = await this.evaluationRepository.findById(tenantId, evaluationId);
    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    return evaluation;
  }

  async updateEvaluation(
    tenantId: string,
    evaluationId: string,
    data: Partial<CreateSupplierEvaluationDto>,
    userId: string,
  ) {
    const evaluation = await this.evaluationRepository.update(tenantId, evaluationId, data, userId);
    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    return evaluation;
  }

  async approveEvaluation(tenantId: string, evaluationId: string, approverId: string) {
    const evaluation = await this.evaluationRepository.approve(tenantId, evaluationId, approverId);
    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    // Update supplier ratings based on approved evaluation
    await this.updateSupplierRatingsFromEvaluation(tenantId, evaluation);

    return evaluation;
  }

  async rejectEvaluation(tenantId: string, evaluationId: string, userId: string) {
    const evaluation = await this.evaluationRepository.reject(tenantId, evaluationId, userId);
    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    return evaluation;
  }

  async deleteEvaluation(tenantId: string, evaluationId: string, userId: string): Promise<void> {
    const deleted = await this.evaluationRepository.delete(tenantId, evaluationId, userId);
    if (!deleted) {
      throw new NotFoundException('Evaluation not found');
    }
  }

  async getLatestEvaluation(tenantId: string, supplierId: string) {
    return await this.evaluationRepository.findLatestEvaluation(tenantId, supplierId);
  }

  async getPendingEvaluations(tenantId: string) {
    return await this.evaluationRepository.findPendingApproval(tenantId);
  }

  async getEvaluationStats(
    tenantId: string,
    supplierId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    return await this.evaluationRepository.getEvaluationStats(
      tenantId,
      supplierId,
      startDate,
      endDate,
    );
  }

  async getSupplierTrends(tenantId: string, supplierId: string, months = 12) {
    return await this.evaluationRepository.getSupplierTrends(tenantId, supplierId, months);
  }

  // Private helper methods
  private async updateSupplierRatingsFromEvaluation(
    tenantId: string,
    evaluation: any,
  ): Promise<void> {
    const ratings = {
      overallRating: evaluation.overallRating,
      qualityRating: evaluation.qualityScore,
      deliveryRating: evaluation.deliveryScore,
      serviceRating: evaluation.serviceScore,
    };

    await this.supplierRepository.updateRatings(
      tenantId,
      evaluation.supplierId,
      ratings,
      evaluation.evaluatorId,
    );
  }

  // Performance tracking methods
  async calculateSupplierPerformanceScore(
    tenantId: string,
    supplierId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<{
    overallScore: number;
    qualityScore: number;
    deliveryScore: number;
    serviceScore: number;
    communicationScore: number;
  }> {
    // Get evaluations for the period
    const evaluations = await this.evaluationRepository.findByDateRange(
      tenantId,
      periodStart,
      periodEnd,
      supplierId,
    );

    if (evaluations.length === 0) {
      return {
        overallScore: 0,
        qualityScore: 0,
        deliveryScore: 0,
        serviceScore: 0,
        communicationScore: 0,
      };
    }

    // Calculate averages
    const totalEvaluations = evaluations.length;
    const scores = evaluations.reduce(
      (acc, evaluation) => {
        const overallScore = typeof evaluation.overallScore === 'number' ? evaluation.overallScore : parseFloat(evaluation.overallScore || '0');
        const qualityScore = typeof evaluation.qualityScore === 'number' ? evaluation.qualityScore : parseFloat(evaluation.qualityScore || '0');
        const deliveryScore = typeof evaluation.deliveryScore === 'number' ? evaluation.deliveryScore : parseFloat(evaluation.deliveryScore || '0');
        const serviceScore = typeof evaluation.serviceScore === 'number' ? evaluation.serviceScore : parseFloat(evaluation.serviceScore || '0');
        
        return {
          overall: acc.overall + overallScore,
          quality: acc.quality + qualityScore,
          delivery: acc.delivery + deliveryScore,
          service: acc.service + serviceScore,
        };
      },
      { overall: 0, quality: 0, delivery: 0, service: 0 },
    );

    // Get communication stats for the period
    const commStats = await this.communicationRepository.getCommunicationStats(
      tenantId,
      supplierId,
      periodStart,
      periodEnd,
    );

    // Calculate communication score based on response time and frequency
    const communicationScore = this.calculateCommunicationScore(commStats);

    return {
      overallScore: Math.round((scores.overall / totalEvaluations) * 100) / 100,
      qualityScore: Math.round((scores.quality / totalEvaluations) * 100) / 100,
      deliveryScore: Math.round((scores.delivery / totalEvaluations) * 100) / 100,
      serviceScore: Math.round((scores.service / totalEvaluations) * 100) / 100,
      communicationScore,
    };
  }

  private calculateCommunicationScore(commStats: any): number {
    // Simple communication score calculation
    // This can be enhanced based on business requirements
    const baseScore = 50;
    let score = baseScore;

    // Bonus for having communications
    if (commStats.totalCommunications > 0) {
      score += 20;
    }

    // Penalty for pending follow-ups
    if (commStats.pendingFollowUps > 0) {
      score -= commStats.pendingFollowUps * 5;
    }

    // Bonus for balanced communication (both inbound and outbound)
    const inboundRatio = commStats.byDirection.inbound / commStats.totalCommunications;
    if (inboundRatio >= 0.3 && inboundRatio <= 0.7) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }
}