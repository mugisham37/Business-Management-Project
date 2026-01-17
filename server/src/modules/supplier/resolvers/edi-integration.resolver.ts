import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { GraphQLJwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { EDIIntegrationService } from '../services/edi-integration.service';
import { Queue } from 'bull';
import { 
  EDIDocumentType,
  EDIStatusType,
  EDIJobResponseType,
  SendEDIDocumentInput,
  ReceiveEDIDocumentInput,
  RetryEDIDocumentInput,
} from '../types/edi-integration.types';

@Resolver()
@UseGuards(GraphQLJwtAuthGuard)
export class EDIIntegrationResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly ediIntegrationService: EDIIntegrationService,
    @Inject('BullQueue_edi') private readonly ediQueue: Queue,
  ) {
    super(dataLoaderService);
  }

  @Mutation(() => EDIJobResponseType, { name: 'sendEDIDocument' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:edi:send')
  async sendEDIDocument(
    @Args('input') input: SendEDIDocumentInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    // Enqueue EDI document generation and sending to Bull queue
    const job = await this.ediQueue.add('send-edi-document', {
      tenantId,
      supplierId: input.supplierId,
      documentType: input.documentType,
      entityId: input.entityId,
      userId: user.id,
    });

    return {
      jobId: job.id.toString(),
      documentId: `EDI-${Date.now()}`,
      message: 'EDI document generation enqueued',
    };
  }

  @Mutation(() => EDIDocumentType, { name: 'receiveEDIDocument' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:edi:receive')
  async receiveEDIDocument(
    @Args('input') input: ReceiveEDIDocumentInput,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.ediIntegrationService.processInboundDocument(
      tenantId,
      input.supplierId,
      input.documentType as any,
      input.rawContent,
    );
  }

  @Query(() => EDIStatusType, { name: 'getEDIStatus' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:edi:read')
  async getEDIStatus(
    @Args('documentId', { type: () => ID }) documentId: string,
  ): Promise<any> {
    // In a real implementation, this would query the EDI document status
    // For now, return a mock status
    return {
      documentId,
      status: 'processed',
      processedAt: new Date(),
    };
  }

  @Mutation(() => EDIJobResponseType, { name: 'retryEDIDocument' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:edi:retry')
  async retryEDIDocument(
    @Args('input') input: RetryEDIDocumentInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    // Enqueue retry to Bull queue
    const job = await this.ediQueue.add('retry-edi-document', {
      tenantId,
      documentId: input.documentId,
      userId: user.id,
    });

    return {
      jobId: job.id.toString(),
      documentId: input.documentId,
      message: 'EDI document retry enqueued',
    };
  }
}
