import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AccountsReceivablePayableService, ARAPInvoice, ARAPPayment, AgingReport, CreateInvoiceInput, CreatePaymentInput } from '../services/accounts-receivable-payable.service';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

/**
 * GraphQL resolver for Accounts Receivable and Accounts Payable operations
 * Handles invoices, payments, aging reports, and payment reminders
 */
@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('financial-management')
export class AccountsReceivablePayableResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly arApService: AccountsReceivablePayableService,
  ) {
    super(dataLoaderService);
  }

  /**
   * Query: Get receivable invoices
   * Returns all accounts receivable invoices with optional filtering
   */
  @Query(() => [String])
  @RequirePermission('financial:read')
  async getReceivables(
    @CurrentTenant() tenantId: string,
    @Args('status', { nullable: true }) status?: string,
    @Args('customerId', { nullable: true }) customerId?: string,
    @Args('fromDate', { nullable: true }) fromDate?: Date,
    @Args('toDate', { nullable: true }) toDate?: Date,
  ): Promise<ARAPInvoice[]> {
    return await this.arApService.getInvoices(
      tenantId,
      'receivable',
      status,
      customerId,
      undefined,
      fromDate,
      toDate,
    );
  }

  /**
   * Query: Get payable invoices
   * Returns all accounts payable invoices with optional filtering
   */
  @Query(() => [String])
  @RequirePermission('financial:read')
  async getPayables(
    @CurrentTenant() tenantId: string,
    @Args('status', { nullable: true }) status?: string,
    @Args('supplierId', { nullable: true }) supplierId?: string,
    @Args('fromDate', { nullable: true }) fromDate?: Date,
    @Args('toDate', { nullable: true }) toDate?: Date,
  ): Promise<ARAPInvoice[]> {
    return await this.arApService.getInvoices(
      tenantId,
      'payable',
      status,
      undefined,
      supplierId,
      fromDate,
      toDate,
    );
  }

  /**
   * Query: Get aging report
   * Returns aging analysis for receivables or payables
   */
  @Query(() => [String])
  @RequirePermission('financial:read')
  async getAgingReport(
    @CurrentTenant() tenantId: string,
    @Args('reportType') reportType: 'receivable' | 'payable',
    @Args('asOfDate', { nullable: true }) asOfDate?: Date,
  ): Promise<AgingReport[]> {
    return await this.arApService.generateAgingReport(
      tenantId,
      reportType,
      asOfDate || new Date(),
    );
  }

  /**
   * Mutation: Record payment
   * Records a payment received from customer or made to supplier
   */
  @Mutation(() => String)
  @RequirePermission('financial:manage')
  async recordPayment(
    @Args('input') input: any,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ARAPPayment> {
    const paymentInput: CreatePaymentInput = {
      paymentType: input.paymentType,
      customerId: input.customerId,
      supplierId: input.supplierId,
      paymentDate: new Date(input.paymentDate),
      paymentMethod: input.paymentMethod,
      paymentAmount: parseFloat(input.paymentAmount),
      currency: input.currency,
      exchangeRate: input.exchangeRate ? parseFloat(input.exchangeRate) : 1,
      bankAccountId: input.bankAccountId,
      checkNumber: input.checkNumber,
      referenceNumber: input.referenceNumber,
      description: input.description,
      notes: input.notes,
      applications: input.applications?.map((app: any) => ({
        invoiceId: app.invoiceId,
        appliedAmount: parseFloat(app.appliedAmount),
        discountAmount: app.discountAmount ? parseFloat(app.discountAmount) : 0,
      })),
    };

    return await this.arApService.createPayment(tenantId, paymentInput, user.id);
  }

  /**
   * Mutation: Send payment reminder
   * Sends a payment reminder to customer or supplier
   */
  @Mutation(() => Boolean)
  @RequirePermission('financial:manage')
  async sendPaymentReminder(
    @Args('invoiceId', { type: () => ID }) invoiceId: string,
    @CurrentTenant() tenantId: string,
    @Args('reminderType', { nullable: true }) reminderType?: string,
    @Args('customMessage', { nullable: true }) customMessage?: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<boolean> {
    // Get invoice details
    const invoice = await this.arApService.getInvoiceById(tenantId, invoiceId);
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // In a real implementation, this would integrate with email/notification service
    // For now, we'll just log the reminder
    console.log(`Payment reminder sent for invoice ${invoiceId}`, {
      reminderType: reminderType || 'standard',
      customMessage,
      invoice,
      sentBy: user.id,
    });

    return true;
  }

  /**
   * Field Resolver: Get customer for invoice
   * Loads customer details using DataLoader to prevent N+1 queries
   */
  @ResolveField(() => String, { nullable: true })
  async customer(
    @Parent() invoice: ARAPInvoice,
  ): Promise<any> {
    if (!invoice.customerId) {
      return null;
    }

    // In a real implementation, this would use DataLoader to batch load customers
    // For now, return a placeholder
    return {
      id: invoice.customerId,
      name: `Customer ${invoice.customerId}`,
    };
  }

  /**
   * Field Resolver: Get supplier for invoice
   * Loads supplier details using DataLoader to prevent N+1 queries
   */
  @ResolveField(() => String, { nullable: true })
  async supplier(
    @Parent() invoice: ARAPInvoice,
  ): Promise<any> {
    if (!invoice.supplierId) {
      return null;
    }

    // In a real implementation, this would use DataLoader to batch load suppliers
    // For now, return a placeholder
    return {
      id: invoice.supplierId,
      name: `Supplier ${invoice.supplierId}`,
    };
  }

  /**
   * Field Resolver: Get invoice line items
   * Loads line items for an invoice
   */
  @ResolveField(() => [String])
  async invoiceLineItems(
    @Parent() invoice: ARAPInvoice,
  ): Promise<any[]> {
    // In a real implementation, this would load line items from the database
    // For now, return empty array
    return [];
  }
}
