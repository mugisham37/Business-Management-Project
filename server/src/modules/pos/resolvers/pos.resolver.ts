import { Resolver, Query, Mutation, Args, ResolveField, Parent, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { POSService } from '../services/pos.service';
import { PrintReceiptService } from '../services/print-receipt.service';
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
  POSSession, 
  POSConfiguration 
} from '../types/pos.types';
import { 
  ReconciliationReport,
  PaymentMethodSummary 
} from '../types/transaction.types';
import { 
  OpenPOSSessionInput, 
  ClosePOSSessionInput 
} from '../inputs/pos.input';

// NEW: Additional GraphQL types for comprehensive POS functionality
import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType({ description: 'Daily sales summary' })
export class DailySalesSummary {
  @Field()
  date!: Date;

  @Field(() => Float)
  totalSales!: number;

  @Field(() => Int)
  totalTransactions!: number;

  @Field(() => Float)
  averageTransactionValue!: number;

  @Field(() => Float)
  cashSales!: number;

  @Field(() => Float)
  cardSales!: number;

  @Field(() => Int)
  voidedTransactions!: number;

  @Field(() => Float)
  refundedAmount!: number;

  @Field(() => [TopSellingItem])
  topSellingItems!: TopSellingItem[];
}

@ObjectType({ description: 'Top selling item' })
export class TopSellingItem {
  @Field(() => ID)
  productId!: string;

  @Field()
  productName!: string;

  @Field(() => Int)
  quantitySold!: number;

  @Field(() => Float)
  revenue!: number;
}

@ObjectType({ description: 'Printer configuration' })
export class PrinterConfiguration {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  type!: string;

  @Field()
  connectionType!: string;

  @Field({ nullable: true })
  ipAddress?: string;

  @Field(() => Int, { nullable: true })
  port?: number;

  @Field({ nullable: true })
  devicePath?: string;

  @Field(() => Int)
  paperWidth!: number;

  @Field()
  isDefault!: boolean;

  @Field()
  isOnline!: boolean;
}

@ObjectType({ description: 'Transaction history response' })
export class TransactionHistoryResponse {
  @Field(() => [String])
  transactions!: any[];

  @Field(() => Int)
  total!: number;

  @Field()
  summary!: any;
}

@Resolver(() => POSSession)
@UseGuards(JwtAuthGuard, TenantGuard)
export class POSResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly posService: POSService,
    private readonly printReceiptService: PrintReceiptService,
    private readonly reconciliationService: PaymentReconciliationService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => POSSession, { description: 'Get POS session by ID' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:read')
  async posSession(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<POSSession> {
    // Mock implementation - in real app, this would call a service method
    return {
      id,
      tenantId,
      sessionNumber: `POS-${Date.now()}`,
      employeeId: 'emp_123',
      locationId: 'loc_123',
      status: 'open' as any,
      openingCash: 100.00,
      expectedCash: 100.00,
      transactionCount: 0,
      totalSales: 0.00,
      openedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };
  }

  @Query(() => [POSSession], { description: 'Get active POS sessions' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:read')
  async activePOSSessions(
    @Args('locationId', { type: () => ID, nullable: true }) locationId: string | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<POSSession[]> {
    // Mock implementation - in real app, this would call a service method
    return [];
  }

  @Query(() => POSConfiguration, { description: 'Get POS configuration' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:read')
  async posConfiguration(
    @Args('locationId', { type: () => ID, nullable: true }) locationId: string | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<POSConfiguration> {
    // Mock implementation - in real app, this would call a service method
    const config: POSConfiguration = {
      id: 'config_123',
      tenantId,
      currency: 'USD',
      taxRate: 0.08,
      offlineMode: true,
      autoPrintReceipts: false,
      enabledPaymentMethods: ['cash', 'card', 'mobile_money'],
      requireCustomer: false,
      allowDiscounts: true,
      maxDiscountPercent: 20,
      enableTips: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    if (locationId) {
      config.locationId = locationId;
    }
    
    return config;
  }

  // NEW: Comprehensive POS functionality queries
  @Query(() => TransactionHistoryResponse, { description: 'Get transaction history with advanced filtering' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:read')
  async transactionHistory(
    @Args('limit', { nullable: true }) limit: number | undefined,
    @Args('offset', { nullable: true }) offset: number | undefined,
    @Args('locationId', { type: () => ID, nullable: true }) locationId: string | undefined,
    @Args('status', { nullable: true }) status: string | undefined,
    @Args('startDate', { nullable: true }) startDate: Date | undefined,
    @Args('endDate', { nullable: true }) endDate: Date | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<TransactionHistoryResponse> {
    return this.posService.getTransactionHistory(tenantId, {
      limit,
      offset,
      locationId,
      status,
      startDate,
      endDate,
    });
  }

  @Query(() => DailySalesSummary, { description: 'Get daily sales summary' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:read')
  async dailySalesSummary(
    @Args('locationId', { type: () => ID, nullable: true }) locationId: string | undefined,
    @Args('date', { nullable: true }) date: Date | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<DailySalesSummary> {
    return this.posService.getDailySummary(tenantId, locationId, date);
  }

  @Query(() => [PrinterConfiguration], { description: 'Get available printers' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:read')
  async printers(
    @CurrentTenant() tenantId: string,
  ): Promise<PrinterConfiguration[]> {
    return this.printReceiptService.getPrinters(tenantId);
  }

  @Query(() => [ReconciliationReport], { description: 'Get reconciliation history' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:reconciliation')
  async reconciliationHistory(
    @Args('limit', { nullable: true }) limit: number | undefined,
    @Args('offset', { nullable: true }) offset: number | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<ReconciliationReport[]> {
    const { reports } = await this.reconciliationService.getReconciliationHistory(
      tenantId,
      limit,
      offset
    );
    return reports;
  }

  @Query(() => String, { description: 'Get reconciliation summary statistics' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:reconciliation')
  async reconciliationSummary(
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.reconciliationService.getReconciliationSummary(
      tenantId,
      startDate,
      endDate
    );
  }

  @Mutation(() => POSSession, { description: 'Open a new POS session' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:create')
  async openPOSSession(
    @Args('input') input: OpenPOSSessionInput,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<POSSession> {
    // Mock implementation - in real app, this would call a service method
    const sessionNumber = `POS-${Date.now()}`;
    
    const session: POSSession = {
      id: `session_${Date.now()}`,
      tenantId,
      sessionNumber,
      employeeId: user.id,
      locationId: input.locationId,
      status: 'open' as any,
      openingCash: input.openingCash,
      expectedCash: input.openingCash,
      transactionCount: 0,
      totalSales: 0.00,
      openedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };
    
    if (input.notes) {
      session.notes = input.notes;
    }
    
    return session;
  }

  @Mutation(() => POSSession, { description: 'Close a POS session' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:update')
  async closePOSSession(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: ClosePOSSessionInput,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<POSSession> {
    // Mock implementation - in real app, this would call a service method
    const openingCash = 100.00;
    const expectedCash = 500.00;
    const cashVariance = input.closingCash - expectedCash;
    
    const session: POSSession = {
      id,
      tenantId,
      sessionNumber: `POS-${Date.now()}`,
      employeeId: user.id,
      locationId: 'loc_123',
      status: 'closed' as any,
      openingCash,
      closingCash: input.closingCash,
      expectedCash,
      cashVariance,
      transactionCount: 25,
      totalSales: 400.00,
      openedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
      closedAt: new Date(),
      createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      updatedAt: new Date(),
      version: 2,
    };
    
    if (input.notes) {
      session.notes = input.notes;
    }
    
    return session;
  }

  // NEW: Printer management mutations
  @Mutation(() => PrinterConfiguration, { description: 'Add a new printer' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:admin')
  async addPrinter(
    @Args('name') name: string,
    @Args('type') type: string,
    @Args('connectionType') connectionType: string,
    @Args('paperWidth') paperWidth: number,
    @Args('ipAddress', { nullable: true }) ipAddress: string | undefined,
    @Args('port', { nullable: true }) port: number | undefined,
    @Args('devicePath', { nullable: true }) devicePath: string | undefined,
    @Args('isDefault', { nullable: true }) isDefault: boolean | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<PrinterConfiguration> {
    return this.printReceiptService.addPrinter(tenantId, {
      name,
      type: type as any,
      connectionType: connectionType as any,
      paperWidth,
      ipAddress,
      port,
      devicePath,
      isDefault: isDefault || false,
      isOnline: true,
    });
  }

  @Mutation(() => MutationResponse, { description: 'Test printer connectivity' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:admin')
  async testPrinter(
    @Args('printerId', { type: () => ID }) printerId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<MutationResponse> {
    const result = await this.printReceiptService.testPrinter(tenantId, printerId);
    
    return {
      success: result.success,
      message: result.error || 'Printer test successful',
    };
  }

  @Mutation(() => MutationResponse, { description: 'Remove a printer' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:admin')
  async removePrinter(
    @Args('printerId', { type: () => ID }) printerId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<MutationResponse> {
    const success = await this.printReceiptService.removePrinter(tenantId, printerId);
    
    return {
      success,
      message: success ? 'Printer removed successfully' : 'Failed to remove printer',
    };
  }

  // NEW: Daily reconciliation mutation
  @Mutation(() => ReconciliationReport, { description: 'Perform daily reconciliation' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:reconciliation')
  async performDailyReconciliation(
    @Args('date') date: Date,
    @Args('options', { nullable: true }) options: any,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<ReconciliationReport> {
    return this.reconciliationService.performDailyReconciliation(
      tenantId,
      date,
      options,
      user.id
    );
  }

  @Mutation(() => ReconciliationReport, { description: 'Approve reconciliation report' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:reconciliation:approve')
  async approveReconciliation(
    @Args('reconciliationId', { type: () => ID }) reconciliationId: string,
    @Args('notes', { nullable: true }) notes: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<ReconciliationReport | null> {
    return this.reconciliationService.approveReconciliation(
      tenantId,
      reconciliationId,
      user.id,
      notes
    );
  }

  @ResolveField(() => String, { nullable: true, description: 'Employee who opened the session' })
  async employee(
    @Parent() session: POSSession,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    // Mock implementation - in real app, this would use DataLoader to load employee
    const loader = this.getDataLoader(
      'employee_by_id',
      async (ids: readonly string[]) => {
        // Mock batch loading
        return ids.map(id => ({ id, firstName: 'John', lastName: 'Doe' }));
      },
    );

    return loader.load(session.employeeId);
  }

  @ResolveField(() => [String], { description: 'Transactions in this session' })
  async transactions(
    @Parent() session: POSSession,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    // Use the POS service to get transactions for this session
    const { transactions } = await this.posService.getTransactionHistory(tenantId, {
      // Filter by session if we had session tracking
      limit: 100,
    });
    
    return transactions;
  }

  @ResolveField(() => DailySalesSummary, { description: 'Daily summary for the session date' })
  async dailySummary(
    @Parent() session: POSSession,
    @CurrentTenant() tenantId: string,
  ): Promise<DailySalesSummary> {
    const sessionDate = new Date(session.openedAt);
    return this.posService.getDailySummary(tenantId, session.locationId, sessionDate);
  }
}
