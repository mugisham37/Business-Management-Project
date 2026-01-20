import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AccountsReceivablePayableService } from '../services/accounts-receivable-payable.service';
import { 
  CreateARAPInvoiceInput,
  UpdateARAPInvoiceInput,
  CreateARAPPaymentInput,
  ApplyPaymentToInvoiceInput,
  GenerateAgingReportInput
} from '../graphql/inputs';
import { 
  ARAPInvoice, 
  ARAPPayment, 
  AgingReport,
  AgingBucket
} from '../graphql/types';
import { InvoiceType, PaymentType, ReportType } from '../graphql/enums';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Resolver(() => ARAPInvoice)
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('financial-management')
export class ARAPResolver {
  constructor(private readonly arapService: AccountsReceivablePayableService) {}

  @Mutation(() => ARAPInvoice)
  @RequirePermission('financial:manage')
  async createInvoice(
    @Args('input') input: CreateARAPInvoiceInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ARAPInvoice> {
    // Transform input to match service interface
    const serviceInput: any = {
      invoiceType: input.invoiceType as 'receivable' | 'payable',
      customerId: input.customerId || undefined,
      supplierId: input.supplierId || undefined,
      invoiceDate: new Date(input.invoiceDate),
      dueDate: new Date(input.dueDate),
      description: input.description || undefined,
      notes: input.reference || undefined,
      paymentTerms: input.terms || undefined,
      lines: input.lines.map(line => ({
        description: line.description,
        quantity: parseFloat(line.quantity),
        unitPrice: parseFloat(line.unitPrice),
        glAccountId: line.accountId,
        notes: line.taxCode,
      })),
    };

    const result = await this.arapService.createInvoice(tenantId, serviceInput, user.id);
    return this.transformServiceToGraphQL(result);
  }

  @Query(() => ARAPInvoice, { nullable: true })
  @RequirePermission('financial:read')
  async invoice(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ARAPInvoice | null> {
    const result = await this.arapService.getInvoiceById(tenantId, id);
    return result ? this.transformServiceToGraphQL(result) : null;
  }

  @Query(() => [ARAPInvoice])
  @RequirePermission('financial:read')
  async invoices(
    @CurrentTenant() tenantId: string,
    @Args('invoiceType', { nullable: true }) invoiceType?: InvoiceType,
    @Args('customerId', { nullable: true }) customerId?: string,
    @Args('supplierId', { nullable: true }) supplierId?: string,
    @Args('status', { nullable: true }) status?: string,
    @Args('limit', { nullable: true }) limit?: number,
  ): Promise<ARAPInvoice[]> {
    const results = await this.arapService.getInvoices(
      tenantId,
      invoiceType as 'receivable' | 'payable' | undefined,
      status,
      customerId,
      supplierId
    );
    return results.map(result => this.transformServiceToGraphQL(result));
  }

  @Mutation(() => ARAPInvoice, { nullable: true })
  @RequirePermission('financial:manage')
  async updateInvoice(
    @Args('input') input: UpdateARAPInvoiceInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ARAPInvoice | null> {
    // Transform input to match service interface
    const serviceInput: any = {
      invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : undefined,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      description: input.description || undefined,
      notes: input.reference || undefined,
      paymentTerms: input.terms || undefined,
    };

    const result = await this.arapService.updateInvoice(tenantId, input.id, serviceInput, user.id);
    return result ? this.transformServiceToGraphQL(result) : null;
  }

  @Mutation(() => ARAPPayment)
  @RequirePermission('financial:manage')
  async createPayment(
    @Args('input') input: CreateARAPPaymentInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ARAPPayment> {
    // Transform input to match service interface
    const serviceInput: any = {
      paymentType: input.paymentType as 'received' | 'made',
      customerId: input.customerId || undefined,
      supplierId: input.supplierId || undefined,
      paymentDate: new Date(input.paymentDate),
      paymentAmount: parseFloat(input.paymentAmount),
      paymentMethod: input.paymentMethod as string,
      referenceNumber: input.reference || undefined,
      checkNumber: input.checkNumber || undefined,
      bankAccountId: input.bankAccount || undefined,
      notes: input.notes || undefined,
    };

    const result = await this.arapService.createPayment(tenantId, serviceInput, user.id);
    return this.transformServicePaymentToGraphQL(result);
  }

  @Query(() => ARAPPayment, { nullable: true })
  @RequirePermission('financial:read')
  async payment(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ARAPPayment | null> {
    const result = await this.arapService.getPaymentById(tenantId, id);
    return result ? this.transformServicePaymentToGraphQL(result) : null;
  }

  @Query(() => [ARAPPayment])
  @RequirePermission('financial:read')
  async payments(
    @CurrentTenant() tenantId: string,
    @Args('paymentType', { nullable: true }) paymentType?: PaymentType,
    @Args('customerId', { nullable: true }) customerId?: string,
    @Args('supplierId', { nullable: true }) supplierId?: string,
    @Args('limit', { nullable: true }) limit?: number,
  ): Promise<ARAPPayment[]> {
    const results = await this.arapService.getPayments(
      tenantId,
      paymentType as 'received' | 'made' | undefined,
      undefined, // status
      customerId,
      supplierId
    );
    return results.map(result => this.transformServicePaymentToGraphQL(result));
  }

  @Mutation(() => Boolean)
  @RequirePermission('financial:manage')
  async applyPaymentToInvoice(
    @Args('input') input: ApplyPaymentToInvoiceInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<boolean> {
    await this.arapService.applyPaymentToInvoice(
      tenantId, 
      input.paymentId, 
      input.invoiceId, 
      parseFloat(input.appliedAmount),
      0, // discountAmount - default to 0
      user.id
    );
    return true;
  }

  @Query(() => [AgingReport])
  @RequirePermission('financial:read')
  async generateAgingReport(
    @Args('input') input: GenerateAgingReportInput,
    @CurrentTenant() tenantId: string,
  ): Promise<AgingReport[]> {
    const results = await this.arapService.generateAgingReport(
      tenantId, 
      input.reportType as 'receivable' | 'payable', 
      new Date(input.asOfDate)
    );
    
    // Transform service results to GraphQL format
    return results.map(report => ({
      reportType: input.reportType,
      asOfDate: new Date(input.asOfDate),
      agingBuckets: report.buckets.map(bucket => ({
        bucketName: bucket.bucketName,
        daysFrom: bucket.minDays,
        daysTo: bucket.maxDays !== undefined ? bucket.maxDays : undefined,
        amount: bucket.amount.toFixed(2),
        invoiceCount: 0,
        invoices: [],
      } as AgingBucket)),
      totalAmount: report.totalBalance.toFixed(2),
      totalInvoices: 0,
      generatedAt: new Date(),
      tenantId,
    }));
  }

  @Mutation(() => Boolean)
  @RequirePermission('financial:manage')
  async sendPaymentReminder(
    @Args('invoiceId', { type: () => ID }) invoiceId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<boolean> {
    await this.arapService.sendPaymentReminder(tenantId, invoiceId, user.id);
    return true;
  }

  // Field Resolvers
  @ResolveField(() => String)
  async invoiceNumber(@Parent() invoice: ARAPInvoice): Promise<string> {
    return invoice.invoiceNumber || await this.arapService.generateInvoiceNumber(
      invoice.tenantId, 
      invoice.invoiceType as 'receivable' | 'payable'
    );
  }

  @ResolveField(() => String)
  async paymentNumber(@Parent() payment: ARAPPayment): Promise<string> {
    return payment.paymentNumber || await this.arapService.generatePaymentNumber(
      payment.tenantId, 
      payment.paymentType as 'received' | 'made'
    );
  }

  // Helper methods to transform service types to GraphQL types
  private transformServiceToGraphQL(serviceInvoice: any): ARAPInvoice {
    return {
      ...serviceInvoice,
      invoiceType: serviceInvoice.invoiceType as InvoiceType,
      status: serviceInvoice.status as any, // Will be mapped to ARAPStatus
      subtotal: serviceInvoice.subtotalAmount?.toFixed(2) || '0.00',
      taxAmount: serviceInvoice.taxAmount?.toFixed(2) || '0.00',
      totalAmount: serviceInvoice.totalAmount?.toFixed(2) || '0.00',
      paidAmount: serviceInvoice.paidAmount?.toFixed(2) || '0.00',
      balanceAmount: serviceInvoice.balanceAmount?.toFixed(2) || '0.00',
      lines: serviceInvoice.lines || [],
      payments: serviceInvoice.payments || [],
    } as ARAPInvoice;
  }

  private transformServicePaymentToGraphQL(servicePayment: any): ARAPPayment {
    return {
      ...servicePayment,
      paymentType: servicePayment.paymentType as PaymentType,
      paymentMethod: servicePayment.paymentMethod as any, // Will be mapped to PaymentMethod
      status: servicePayment.status as any, // Will be mapped to ARAPStatus
      paymentAmount: servicePayment.paymentAmount?.toFixed(2) || '0.00',
    } as ARAPPayment;
  }
}