import { Resolver, Query, Mutation, Args, ResolveField, Parent, Subscription, ID } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { TransactionService } from '../services/transaction.service';
import { POSService } from '../services/pos.service';
import { PaymentService } from '../services/payment.service';
import { ReceiptService } from '../services/receipt.service';
import { TransactionValidationService } from '../services/transaction-validation.service';
import { PaymentReconciliationService } from '../services/payment-reconciliation.service';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { MutationResponse } from '../../../common/graphql/mutation-response.types';
import { 
  Transaction, 
  TransactionConnection, 
  TransactionItem, 
  PaymentRecord,
  PaymentResult,
  ReceiptResult,
  EmailResult,
  SmsResult,
  PrintResult,
  ReconciliationReport
} from '../types/transaction.types';
import { 
  CreateTransactionInput, 
  UpdateTransactionInput, 
  VoidTransactionInput, 
  RefundTransactionInput,
  TransactionQueryInput,
  PaymentRequestInput,
  EmailReceiptOptionsInput,
  SmsReceiptOptionsInput
} from '../inputs/transaction.input';
import { PaginationArgs } from '../../../common/graphql/pagination.args';

@Resolver(() => Transaction)
@UseGuards(JwtAuthGuard, TenantGuard)
export class TransactionResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly transactionService: TransactionService,
    private readonly posService: POSService,
    private readonly paymentService: PaymentService,
    private readonly receiptService: ReceiptService,
    private readonly reconciliationService: PaymentReconciliationService,
    private readonly validationService: TransactionValidationService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    super(dataLoaderService);
  }

  @Query(() => Transaction, { description: 'Get transaction by ID' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:read')
  async transaction(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Transaction> {
    const transaction = await this.transactionService.findById(tenantId, id);
    
    return {
      ...transaction,
      status: transaction.status as any,
      paymentMethod: transaction.paymentMethod as any,
      items: [],
      payments: [],
    };
  }

  @Query(() => TransactionConnection, { description: 'List transactions with filtering and pagination' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:read')
  async transactions(
    @Args() paginationArgs: PaginationArgs,
    @Args('query', { nullable: true }) query: TransactionQueryInput,
    @CurrentTenant() tenantId: string,
  ): Promise<TransactionConnection> {
    const { limit, cursor, isForward } = this.parsePaginationArgs(paginationArgs);
    
    const options: any = {
      limit: limit + 1, // Fetch one extra to determine hasNextPage
      offset: 0,
    };

    if (query?.locationId) options.locationId = query.locationId;
    if (query?.status) options.status = query.status;
    if (query?.startDate) options.startDate = query.startDate;
    if (query?.endDate) options.endDate = query.endDate;

    const { transactions, total } = await this.transactionService.findTransactionsByTenant(
      tenantId,
      options
    );

    const hasNextPage = transactions.length > limit;
    const items = hasNextPage ? transactions.slice(0, limit) : transactions;

    // Map to GraphQL type with items array
    const graphqlTransactions = items.map(t => ({
      ...t,
      status: t.status as any,
      paymentMethod: t.paymentMethod as any,
      items: [], // Items will be loaded via field resolver if requested
    }));

    return {
      edges: this.createEdges(graphqlTransactions, item => item.id),
      pageInfo: this.createPageInfo(
        hasNextPage,
        false,
        graphqlTransactions[0]?.id,
        graphqlTransactions[graphqlTransactions.length - 1]?.id,
      ),
      totalCount: total,
    };
  }

  @Query(() => [Transaction], { description: 'Get transaction summary for reporting' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:read')
  async transactionSummary(
    @Args('locationId', { type: () => ID, nullable: true }) locationId: string | undefined,
    @Args('startDate', { nullable: true }) startDate: Date | undefined,
    @Args('endDate', { nullable: true }) endDate: Date | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.transactionService.getTransactionSummary(
      tenantId,
      locationId,
      startDate,
      endDate
    );
  }

  @Mutation(() => Transaction, { description: 'Create a new transaction' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:create')
  async createTransaction(
    @Args('input') input: CreateTransactionInput,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<Transaction> {
    const transactionData: any = {
      customerId: input.customerId,
      locationId: input.locationId,
      items: input.items,
      paymentMethod: input.paymentMethod,
      taxAmount: input.taxAmount,
      discountAmount: input.discountAmount,
      tipAmount: input.tipAmount,
      notes: input.notes,
    };

    const result = await this.posService.processTransaction(
      tenantId,
      transactionData,
      user.id
    );

    // Emit subscription event
    await this.pubSub.publish('TRANSACTION_CREATED', {
      transactionCreated: {
        ...result,
        tenantId,
      },
    });

    return {
      ...result,
      status: result.status as any,
      paymentMethod: result.paymentMethod as any,
      version: 1,
      items: [],
      payments: [],
    };
  }

  @Mutation(() => Transaction, { description: 'Update a transaction' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:update')
  async updateTransaction(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateTransactionInput,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<Transaction> {
    const transaction = await this.transactionService.updateTransaction(
      tenantId,
      id,
      input as any,
      user.id
    );

    return {
      ...transaction,
      status: transaction.status as any,
      paymentMethod: transaction.paymentMethod as any,
      items: [],
    };
  }

  @Mutation(() => Transaction, { description: 'Void a transaction' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:void')
  async voidTransaction(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: VoidTransactionInput,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<Transaction> {
    const result = await this.posService.voidTransaction(
      tenantId,
      id,
      input.reason,
      input.notes,
      user.id
    );

    return {
      ...result,
      status: result.status as any,
      paymentMethod: result.paymentMethod as any,
      version: 1,
      items: [],
      payments: [],
    };
  }

  @Mutation(() => Transaction, { description: 'Refund a transaction' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:refund')
  async refundTransaction(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: RefundTransactionInput,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<Transaction> {
    const result = await this.posService.refundTransaction(
      tenantId,
      id,
      input.amount,
      input.reason,
      input.notes,
      user.id
    );

    return {
      ...result,
      status: result.status as any,
      paymentMethod: result.paymentMethod as any,
      version: 1,
      items: [],
      payments: [],
    };
  }

  // NEW: Payment processing mutations
  @Mutation(() => PaymentResult, { description: 'Process payment for transaction' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:payment')
  async processPayment(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('input') input: PaymentRequestInput,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<PaymentResult> {
    return this.paymentService.processPayment(
      tenantId,
      transactionId,
      input as any,
      user.id
    );
  }

  @Mutation(() => MutationResponse, { description: 'Validate payment method' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:payment')
  async validatePaymentMethod(
    @Args('paymentMethod') paymentMethod: string,
    @Args('amount') amount: number,
    @Args('metadata', { nullable: true }) metadata: any,
  ): Promise<MutationResponse> {
    const result = await this.paymentService.validatePaymentMethod(
      paymentMethod,
      amount,
      metadata
    );

    return {
      success: result.valid,
      message: result.error || 'Payment method is valid',
    };
  }

  // NEW: Receipt generation mutations
  @Mutation(() => ReceiptResult, { description: 'Send email receipt' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt')
  async sendEmailReceipt(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('emailAddress') emailAddress: string,
    @Args('options', { nullable: true }) options: EmailReceiptOptionsInput,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptResult> {
    const transaction = await this.transactionService.findById(tenantId, transactionId);
    return this.receiptService.sendEmailReceipt(
      tenantId,
      transaction,
      emailAddress,
      options as any
    );
  }

  @Mutation(() => ReceiptResult, { description: 'Send SMS receipt' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt')
  async sendSmsReceipt(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('phoneNumber') phoneNumber: string,
    @Args('options', { nullable: true }) options: SmsReceiptOptionsInput,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptResult> {
    const transaction = await this.transactionService.findById(tenantId, transactionId);
    return this.receiptService.sendSmsReceipt(
      tenantId,
      transaction,
      phoneNumber,
      options as any
    );
  }

  @Mutation(() => ReceiptResult, { description: 'Print receipt' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt')
  async printReceipt(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('printerId', { nullable: true }) printerId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptResult> {
    const transaction = await this.transactionService.findById(tenantId, transactionId);
    return this.receiptService.printReceipt(
      tenantId,
      transaction,
      printerId
    );
  }

  // NEW: Reconciliation queries
  @Query(() => ReconciliationReport, { description: 'Get reconciliation report' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:reconciliation')
  async reconciliationReport(
    @Args('reconciliationId', { type: () => ID }) reconciliationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ReconciliationReport | null> {
    const report = await this.reconciliationService.getReconciliationReport(tenantId, reconciliationId);
    if (!report) {
      return null;
    }
    // Ensure summary object is always present for GraphQL
    if (!report.summary) {
      report.summary = {
        expectedAmount: report.expectedAmount,
        actualAmount: report.actualAmount,
        variance: report.variance,
        variancePercentage: report.variancePercentage,
      };
    }
    return report as ReconciliationReport;
  }

  @Mutation(() => ReconciliationReport, { description: 'Perform payment reconciliation' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:reconciliation')
  async performReconciliation(
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
    @Args('options', { nullable: true }) options: any,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<ReconciliationReport> {
    const report = await this.reconciliationService.performReconciliation(
      tenantId,
      startDate,
      endDate,
      options,
      user.id
    );
    // Ensure summary object is always present for GraphQL
    if (!report.summary) {
      report.summary = {
        expectedAmount: report.expectedAmount,
        actualAmount: report.actualAmount,
        variance: report.variance,
        variancePercentage: report.variancePercentage,
      };
    }
    return report as ReconciliationReport;
  }

  @ResolveField(() => [TransactionItem], { description: 'Transaction line items' })
  async lineItems(
    @Parent() transaction: Transaction,
    @CurrentTenant() tenantId: string,
  ): Promise<TransactionItem[]> {
    // If items are already loaded, return them
    if (transaction.items && transaction.items.length > 0) {
      return transaction.items;
    }

    // Otherwise, load the full transaction with items
    const fullTransaction = await this.transactionService.findById(tenantId, transaction.id);
    return fullTransaction.items.map(item => ({
      id: item.id,
      productId: item.productId,
      productSku: item.productSku,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      discountAmount: item.discountAmount,
      taxAmount: item.taxAmount,
    }));
  }

  @ResolveField(() => [PaymentRecord], { description: 'Payment records for this transaction' })
  async payments(
    @Parent() transaction: Transaction,
    @CurrentTenant() tenantId: string,
  ): Promise<PaymentRecord[]> {
    const payments = await this.paymentService.getPaymentHistory(tenantId, transaction.id);
    // Map entity PaymentRecord to GraphQL type, ensuring paymentMethod is cast properly
    return payments.map(p => ({
      ...p,
      paymentMethod: p.paymentMethod as any,
    })) as PaymentRecord[];
  }

  @ResolveField(() => String, { nullable: true, description: 'Customer who made the transaction' })
  async customer(
    @Parent() transaction: Transaction,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    if (!transaction.customerId) return null;

    const loader = this.getDataLoader(
      'customer_by_id',
      async (ids: readonly string[]) => {
        // Mock batch loading
        return ids.map(id => ({ id, firstName: 'Jane', lastName: 'Smith' }));
      },
    );

    return loader.load(transaction.customerId);
  }

  @ResolveField(() => [String], { description: 'Receipt history for this transaction' })
  async receiptHistory(
    @Parent() transaction: Transaction,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    return this.receiptService.getReceiptHistory(tenantId, transaction.id);
  }

  @Subscription(() => Transaction, {
    description: 'Subscribe to transaction creation events',
    filter: (payload, variables, context) => {
      return payload.transactionCreated.tenantId === context.req.user.tenantId;
    },
  })
  transactionCreated(@CurrentTenant() tenantId: string) {
    return (this.pubSub as any).asyncIterator('TRANSACTION_CREATED');
  }

  @Subscription(() => Transaction, {
    description: 'Subscribe to transaction updates',
    filter: (payload, variables, context) => {
      return payload.transactionUpdated.tenantId === context.req.user.tenantId;
    },
  })
  transactionUpdated(@CurrentTenant() tenantId: string) {
    return (this.pubSub as any).asyncIterator('TRANSACTION_UPDATED');
  }

  @Subscription(() => PaymentResult, {
    description: 'Subscribe to payment processing events',
    filter: (payload, variables, context) => {
      return payload.paymentProcessed.tenantId === context.req.user.tenantId;
    },
  })
  paymentProcessed(@CurrentTenant() tenantId: string) {
    return (this.pubSub as any).asyncIterator('PAYMENT_PROCESSED');
  }

  // NEW: Transaction Validation Mutations
  @Mutation(() => MutationResponse, { description: 'Validate transaction data before processing' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:validate')
  async validateTransaction(
    @Args('input') input: CreateTransactionInput,
  ): Promise<MutationResponse> {
    try {
      this.validationService.validateTransaction(input);
      
      return {
        success: true,
        message: 'Transaction validation passed',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Transaction validation failed',
        errors: [{ message: error.message, timestamp: new Date() }],
      };
    }
  }

  @Mutation(() => MutationResponse, { description: 'Validate refund request' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:validate')
  async validateRefund(
    @Args('originalAmount') originalAmount: number,
    @Args('refundAmount') refundAmount: number,
    @Args('alreadyRefunded', { nullable: true }) alreadyRefunded: number | undefined,
  ): Promise<MutationResponse> {
    try {
      this.validationService.validateRefund(originalAmount, refundAmount, alreadyRefunded);
      
      return {
        success: true,
        message: 'Refund validation passed',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Refund validation failed',
        errors: [{ message: error.message, timestamp: new Date() }],
      };
    }
  }

  @Mutation(() => MutationResponse, { description: 'Validate void request' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:validate')
  async validateVoid(
    @Args('transactionStatus') transactionStatus: string,
  ): Promise<MutationResponse> {
    try {
      this.validationService.validateVoid(transactionStatus);
      
      return {
        success: true,
        message: 'Void validation passed',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Void validation failed',
        errors: [{ message: error.message, timestamp: new Date() }],
      };
    }
  }

  @Mutation(() => MutationResponse, { description: 'Validate payment amount' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:validate')
  async validatePaymentAmount(
    @Args('transactionTotal') transactionTotal: number,
    @Args('paymentAmount') paymentAmount: number,
  ): Promise<MutationResponse> {
    try {
      this.validationService.validatePaymentAmount(transactionTotal, paymentAmount);
      
      return {
        success: true,
        message: 'Payment amount validation passed',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Payment amount validation failed',
        errors: [{ message: error.message, timestamp: new Date() }],
      };
    }
  }

  @Mutation(() => MutationResponse, { description: 'Validate inventory availability' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:validate')
  async validateInventoryAvailability(
    @Args('items', { type: () => [String] }) items: any[],
    @Args('inventoryLevels') inventoryLevels: any,
  ): Promise<MutationResponse> {
    try {
      const inventoryMap = new Map<string, number>(Object.entries(inventoryLevels).map(([k, v]) => [k, Number(v)]));
      this.validationService.validateInventoryAvailability(items, inventoryMap);
      
      return {
        success: true,
        message: 'Inventory validation passed',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Inventory validation failed',
        errors: [{ message: error.message, timestamp: new Date() }],
      };
    }
  }

  @Mutation(() => MutationResponse, { description: 'Validate offline transaction' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:validate')
  async validateOfflineTransaction(
    @Args('input') input: CreateTransactionInput,
  ): Promise<MutationResponse> {
    try {
      this.validationService.validateOfflineTransaction(input);
      
      return {
        success: true,
        message: 'Offline transaction validation passed',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Offline transaction validation failed',
        errors: [{ message: error.message, timestamp: new Date() }],
      };
    }
  }
}
