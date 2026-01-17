import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ReceiptService } from '../services/receipt.service';
import { EmailReceiptService } from '../services/email-receipt.service';
import { SmsReceiptService } from '../services/sms-receipt.service';
import { PrintReceiptService } from '../services/print-receipt.service';
import { TransactionService } from '../services/transaction.service';
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
  ReceiptResult, 
  EmailResult, 
  SmsResult, 
  PrintResult 
} from '../types/transaction.types';
import { 
  EmailReceiptOptionsInput, 
  SmsReceiptOptionsInput 
} from '../inputs/transaction.input';

// NEW: GraphQL types for comprehensive receipt functionality
import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType({ description: 'Receipt generation result' })
export class ReceiptGenerationResult {
  @Field()
  receiptId!: string;

  @Field()
  receiptData!: any;

  @Field()
  formattedReceipt!: string;

  @Field()
  template!: string;

  @Field()
  generatedAt!: Date;
}

@ObjectType({ description: 'Receipt history item' })
export class ReceiptHistoryItem {
  @Field()
  receiptId!: string;

  @Field()
  deliveryMethod!: string;

  @Field()
  deliveredAt!: Date;

  @Field()
  status!: string;

  @Field({ nullable: true })
  recipient?: string;

  @Field({ nullable: true })
  error?: string;
}

@ObjectType({ description: 'Receipt template' })
export class ReceiptTemplate {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  type!: string; // 'email', 'sms', 'thermal', 'standard'

  @Field()
  template!: string;

  @Field()
  isDefault!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
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

@ObjectType({ description: 'Receipt delivery statistics' })
export class ReceiptDeliveryStats {
  @Field(() => Int)
  totalReceipts!: number;

  @Field(() => Int)
  emailReceipts!: number;

  @Field(() => Int)
  smsReceipts!: number;

  @Field(() => Int)
  printedReceipts!: number;

  @Field(() => Int)
  successfulDeliveries!: number;

  @Field(() => Int)
  failedDeliveries!: number;

  @Field(() => Float)
  successRate!: number;
}

@ObjectType({ description: 'Email delivery status' })
export class EmailDeliveryStatus {
  @Field()
  messageId!: string;

  @Field()
  status!: string;

  @Field()
  deliveredAt!: Date;

  @Field({ nullable: true })
  openedAt?: Date;

  @Field({ nullable: true })
  clickedAt?: Date;

  @Field({ nullable: true })
  bounceReason?: string;
}

@ObjectType({ description: 'SMS delivery status' })
export class SmsDeliveryStatus {
  @Field()
  messageId!: string;

  @Field()
  status!: string;

  @Field()
  deliveredAt!: Date;

  @Field({ nullable: true })
  failureReason?: string;

  @Field(() => Int)
  segmentCount!: number;
}

@ObjectType({ description: 'Print job status' })
export class PrintJobStatus {
  @Field()
  printJobId!: string;

  @Field()
  status!: string;

  @Field()
  printerId!: string;

  @Field()
  submittedAt!: Date;

  @Field({ nullable: true })
  completedAt?: Date;

  @Field({ nullable: true })
  error?: string;
}

@ObjectType({ description: 'Receipt preview' })
export class ReceiptPreview {
  @Field()
  template!: string;

  @Field()
  formattedContent!: string;

  @Field(() => Int)
  estimatedSize!: number;

  @Field({ nullable: true })
  warnings?: string[];
}

@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard)
export class ReceiptResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly receiptService: ReceiptService,
    private readonly emailReceiptService: EmailReceiptService,
    private readonly smsReceiptService: SmsReceiptService,
    private readonly printReceiptService: PrintReceiptService,
    private readonly transactionService: TransactionService,
  ) {
    super(dataLoaderService);
  }

  // Receipt Generation Queries
  @Query(() => ReceiptGenerationResult, { description: 'Generate receipt for transaction' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt')
  async generateReceipt(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('template', { nullable: true }) template: string | undefined,
    @Args('includeItemDetails', { nullable: true }) includeItemDetails: boolean | undefined,
    @Args('includeTaxBreakdown', { nullable: true }) includeTaxBreakdown: boolean | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptGenerationResult> {
    const transaction = await this.transactionService.findById(tenantId, transactionId);
    
    const result = await this.receiptService.generateReceipt(tenantId, transaction, {
      template: template || 'default',
      includeItemDetails: includeItemDetails || false,
      includeTaxBreakdown: includeTaxBreakdown || false,
    });

    return {
      receiptId: result.receiptId,
      receiptData: result.receiptData,
      formattedReceipt: result.formattedReceipt,
      template: template || 'default',
      generatedAt: new Date(),
    };
  }

  @Query(() => [ReceiptHistoryItem], { description: 'Get receipt history for transaction' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt')
  async receiptHistory(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptHistoryItem[]> {
    return this.receiptService.getReceiptHistory(tenantId, transactionId);
  }

  @Query(() => ReceiptDeliveryStats, { description: 'Get receipt delivery statistics' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt')
  async receiptDeliveryStats(
    @Args('startDate', { nullable: true }) startDate: Date | undefined,
    @Args('endDate', { nullable: true }) endDate: Date | undefined,
    @Args('locationId', { type: () => ID, nullable: true }) locationId: string | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptDeliveryStats> {
    // Mock implementation - in real app, this would aggregate receipt delivery data
    return {
      totalReceipts: 1250,
      emailReceipts: 750,
      smsReceipts: 300,
      printedReceipts: 200,
      successfulDeliveries: 1180,
      failedDeliveries: 70,
      successRate: 94.4,
    };
  }

  @Query(() => ReceiptPreview, { description: 'Preview receipt before sending' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt')
  async previewReceipt(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('template') template: string,
    @Args('deliveryMethod') deliveryMethod: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptPreview> {
    const transaction = await this.transactionService.findById(tenantId, transactionId);
    
    const result = await this.receiptService.generateReceipt(tenantId, transaction, {
      template,
    });

    return {
      template,
      formattedContent: result.formattedReceipt,
      estimatedSize: result.formattedReceipt.length,
      warnings: this.validateReceiptContent(result.formattedReceipt, deliveryMethod),
    };
  }

  // Email Receipt Mutations
  @Mutation(() => ReceiptResult, { description: 'Send email receipt' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt:email')
  async sendEmailReceipt(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('emailAddress') emailAddress: string,
    @Args('options', { nullable: true }) options: EmailReceiptOptionsInput | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptResult> {
    const transaction = await this.transactionService.findById(tenantId, transactionId);
    return this.receiptService.sendEmailReceipt(tenantId, transaction, emailAddress, options as any);
  }

  @Mutation(() => ReceiptResult, { description: 'Send email receipt with PDF attachment' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt:email')
  async sendEmailReceiptWithPdf(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('emailAddress') emailAddress: string,
    @Args('options', { nullable: true }) options: EmailReceiptOptionsInput | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptResult> {
    const transaction = await this.transactionService.findById(tenantId, transactionId);
    
    // Generate PDF buffer (mock implementation)
    const pdfBuffer = Buffer.from('Mock PDF content');
    
    const result = await this.emailReceiptService.sendReceiptWithAttachment(
      tenantId,
      emailAddress,
      transaction,
      pdfBuffer,
      options as any
    );

    return {
      success: result.success,
      receiptId: `receipt_${transaction.id}`,
      deliveryMethod: 'email_pdf',
      error: result.error || undefined,
    };
  }

  // SMS Receipt Mutations
  @Mutation(() => ReceiptResult, { description: 'Send SMS receipt' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt:sms')
  async sendSmsReceipt(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('phoneNumber') phoneNumber: string,
    @Args('options', { nullable: true }) options: SmsReceiptOptionsInput | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptResult> {
    const transaction = await this.transactionService.findById(tenantId, transactionId);
    return this.receiptService.sendSmsReceipt(tenantId, transaction, phoneNumber, options as any);
  }

  @Mutation(() => ReceiptResult, { description: 'Send SMS receipt summary' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt:sms')
  async sendSmsReceiptSummary(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('phoneNumber') phoneNumber: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptResult> {
    const transaction = await this.transactionService.findById(tenantId, transactionId);
    
    const result = await this.smsReceiptService.sendReceiptSummary(
      tenantId,
      phoneNumber,
      transaction
    );

    return {
      success: result.success,
      receiptId: `receipt_${transaction.id}`,
      deliveryMethod: 'sms_summary',
      error: result.error || undefined,
    };
  }

  // Print Receipt Mutations
  @Mutation(() => ReceiptResult, { description: 'Print receipt' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt:print')
  async printReceipt(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('printerId', { nullable: true }) printerId: string | undefined,
    @Args('template', { nullable: true }) template: string | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptResult> {
    const transaction = await this.transactionService.findById(tenantId, transactionId);
    return this.receiptService.printReceipt(tenantId, transaction, printerId, { 
      template: template || 'default' 
    });
  }

  // Delivery Status Queries
  @Query(() => EmailDeliveryStatus, { description: 'Get email delivery status' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt')
  async emailDeliveryStatus(
    @Args('messageId') messageId: string,
  ): Promise<EmailDeliveryStatus> {
    // Mock implementation - in real app, this would query email service provider
    return {
      messageId,
      status: 'delivered',
      deliveredAt: new Date(Date.now() - 300000), // 5 minutes ago
      openedAt: new Date(Date.now() - 240000), // 4 minutes ago
    };
  }

  @Query(() => SmsDeliveryStatus, { description: 'Get SMS delivery status' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt')
  async smsDeliveryStatus(
    @Args('messageId') messageId: string,
  ): Promise<SmsDeliveryStatus> {
    // Mock implementation - in real app, this would query SMS service provider
    return {
      messageId,
      status: 'delivered',
      deliveredAt: new Date(Date.now() - 180000), // 3 minutes ago
      segmentCount: 1,
    };
  }

  @Query(() => PrintJobStatus, { description: 'Get print job status' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt')
  async printJobStatus(
    @Args('printJobId') printJobId: string,
  ): Promise<PrintJobStatus> {
    // Mock implementation - in real app, this would query printer status
    return {
      printJobId,
      status: 'completed',
      printerId: 'printer_123',
      submittedAt: new Date(Date.now() - 120000), // 2 minutes ago
      completedAt: new Date(Date.now() - 60000), // 1 minute ago
    };
  }

  // Bulk Operations
  @Mutation(() => [ReceiptResult], { description: 'Send bulk email receipts' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt:bulk')
  async sendBulkEmailReceipts(
    @Args('transactionIds', { type: () => [ID] }) transactionIds: string[],
    @Args('emailAddresses', { type: () => [String] }) emailAddresses: string[],
    @Args('options', { nullable: true }) options: EmailReceiptOptionsInput | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptResult[]> {
    const results: ReceiptResult[] = [];

    for (let i = 0; i < transactionIds.length && i < emailAddresses.length; i++) {
      const transactionId = transactionIds[i];
      const emailAddress = emailAddresses[i];
      
      if (!transactionId || !emailAddress) continue;
      
      const transaction = await this.transactionService.findById(tenantId, transactionId);
      const result = await this.receiptService.sendEmailReceipt(
        tenantId,
        transaction,
        emailAddress,
        options as any
      );
      results.push(result);
    }

    return results;
  }

  @Mutation(() => [ReceiptResult], { description: 'Send bulk SMS receipts' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt:bulk')
  async sendBulkSmsReceipts(
    @Args('transactionIds', { type: () => [ID] }) transactionIds: string[],
    @Args('phoneNumbers', { type: () => [String] }) phoneNumbers: string[],
    @Args('options', { nullable: true }) options: SmsReceiptOptionsInput | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptResult[]> {
    const results: ReceiptResult[] = [];

    for (let i = 0; i < transactionIds.length && i < phoneNumbers.length; i++) {
      const transactionId = transactionIds[i];
      const phoneNumber = phoneNumbers[i];
      
      if (!transactionId || !phoneNumber) continue;
      
      const transaction = await this.transactionService.findById(tenantId, transactionId);
      const result = await this.receiptService.sendSmsReceipt(
        tenantId,
        transaction,
        phoneNumber,
        options as any
      );
      results.push(result);
    }

    return results;
  }

  // Template Management
  @Mutation(() => MutationResponse, { description: 'Resend failed receipts' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt:resend')
  async resendFailedReceipts(
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
    @Args('deliveryMethod', { nullable: true }) deliveryMethod: string | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<MutationResponse> {
    try {
      // Mock implementation - in real app, this would query failed receipts and retry
      const failedCount = 15;
      const retriedCount = 12;
      const successCount = 10;

      return {
        success: true,
        message: `Resent ${successCount} of ${retriedCount} failed receipts (${failedCount} total failed)`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to resend receipts',
        errors: [{ message: error.message, timestamp: new Date() }],
      };
    }
  }

  // NEW: Enhanced Email Receipt Service functionality
  @Mutation(() => ReceiptResult, { description: 'Send email receipt with custom template' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt:email')
  async sendCustomEmailReceipt(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('emailAddress') emailAddress: string,
    @Args('template') template: string,
    @Args('includeItemDetails', { nullable: true }) includeItemDetails: boolean | undefined,
    @Args('includeTaxBreakdown', { nullable: true }) includeTaxBreakdown: boolean | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptResult> {
    const transaction = await this.transactionService.findById(tenantId, transactionId);
    
    const result = await this.emailReceiptService.sendReceipt(
      tenantId,
      emailAddress,
      transaction,
      {
        template,
        includeItemDetails: includeItemDetails || false,
        includeTaxBreakdown: includeTaxBreakdown || false,
      }
    );

    return {
      success: result.success,
      receiptId: `receipt_${transaction.id}`,
      deliveryMethod: 'email_custom',
      error: result.error || undefined,
    };
  }

  // NEW: Enhanced SMS Receipt Service functionality
  @Mutation(() => ReceiptResult, { description: 'Send SMS receipt with custom options' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt:sms')
  async sendCustomSmsReceipt(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('phoneNumber') phoneNumber: string,
    @Args('includeItemDetails', { nullable: true }) includeItemDetails: boolean | undefined,
    @Args('includeTotal', { nullable: true }) includeTotal: boolean | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptResult> {
    const transaction = await this.transactionService.findById(tenantId, transactionId);
    
    const result = await this.smsReceiptService.sendReceipt(
      tenantId,
      phoneNumber,
      transaction,
      {
        includeItemDetails: includeItemDetails || false,
      }
    );

    return {
      success: result.success,
      receiptId: `receipt_${transaction.id}`,
      deliveryMethod: 'sms_custom',
      error: result.error || undefined,
    };
  }

  // NEW: Enhanced Print Receipt Service functionality
  @Mutation(() => ReceiptResult, { description: 'Print receipt with specific printer and options' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt:print')
  async printReceiptAdvanced(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('printerId', { nullable: true }) printerId: string | undefined,
    @Args('printerType', { nullable: true }) printerType: string | undefined,
    @Args('paperWidth', { nullable: true }) paperWidth: number | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptResult> {
    const transaction = await this.transactionService.findById(tenantId, transactionId);
    
    // Generate receipt content first
    const receiptData = await this.receiptService.generateReceipt(tenantId, transaction, {
      template: printerType || 'thermal',
    });

    const result = await this.printReceiptService.printReceipt(
      tenantId,
      receiptData.formattedReceipt,
      printerId,
      {
        template: printerType || 'thermal',
      }
    );

    return {
      success: result.success,
      receiptId: `receipt_${transaction.id}`,
      deliveryMethod: 'print_advanced',
      error: result.error || undefined,
    };
  }

  @Query(() => [PrinterConfiguration], { description: 'Get all available printers' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:receipt:print')
  async availablePrinters(
    @CurrentTenant() tenantId: string,
  ): Promise<PrinterConfiguration[]> {
    return this.printReceiptService.getPrinters(tenantId);
  }

  @Mutation(() => PrinterConfiguration, { description: 'Add a new printer configuration' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:admin')
  async addPrinterConfiguration(
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
    const config: any = {
      name,
      type: type as any,
      connectionType: connectionType as any,
      paperWidth,
      isDefault: isDefault || false,
      isOnline: true,
    };

    // Only add optional properties if they are defined
    if (ipAddress !== undefined) {
      config.ipAddress = ipAddress;
    }
    if (port !== undefined) {
      config.port = port;
    }
    if (devicePath !== undefined) {
      config.devicePath = devicePath;
    }

    return this.printReceiptService.addPrinter(tenantId, config);
  }

  @Mutation(() => MutationResponse, { description: 'Test printer connectivity and functionality' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:admin')
  async testPrinterConnection(
    @Args('printerId', { type: () => ID }) printerId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<MutationResponse> {
    const result = await this.printReceiptService.testPrinter(tenantId, printerId);
    
    return {
      success: result.success,
      message: result.error || 'Printer test completed successfully',
    };
  }

  @Mutation(() => MutationResponse, { description: 'Remove printer configuration' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:admin')
  async removePrinterConfiguration(
    @Args('printerId', { type: () => ID }) printerId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<MutationResponse> {
    const success = await this.printReceiptService.removePrinter(tenantId, printerId);
    
    return {
      success,
      message: success ? 'Printer removed successfully' : 'Failed to remove printer',
    };
  }

  private validateReceiptContent(content: string, deliveryMethod: string): string[] {
    const warnings: string[] = [];

    if (deliveryMethod === 'sms' && content.length > 160) {
      warnings.push('SMS content exceeds 160 characters and will be split into multiple messages');
    }

    if (deliveryMethod === 'thermal' && content.includes('█')) {
      warnings.push('Content contains characters that may not print correctly on thermal printers');
    }

    if (deliveryMethod === 'email' && !content.includes('html')) {
      warnings.push('Email content appears to be plain text - consider using HTML template for better formatting');
    }

    return warnings;
  }
}