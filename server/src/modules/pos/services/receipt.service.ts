import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailReceiptService } from './email-receipt.service';
import { SmsReceiptService } from './sms-receipt.service';
import { PrintReceiptService } from './print-receipt.service';
import { TransactionWithItems } from '../entities/transaction.entity';
import { createWithoutUndefined } from '../dto/transaction.dto';

export interface ReceiptOptions {
  format: 'email' | 'sms' | 'print';
  recipient?: string; // email address or phone number
  template?: string;
  includeItemDetails?: boolean;
  includeTaxBreakdown?: boolean;
}

export interface ReceiptResult {
  success: boolean;
  receiptId: string;
  deliveryMethod: string;
  error?: string;
}

@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailReceiptService,
    private readonly smsService: SmsReceiptService,
    private readonly printService: PrintReceiptService,
  ) {}

  async generateReceipt(
    transaction: TransactionWithItems,
    options: ReceiptOptions,
  ): Promise<ReceiptResult> {
    this.logger.log(`Generating ${options.format} receipt for transaction ${transaction.transactionNumber}`);

    try {
      const receiptContent = await this.buildReceiptContent(transaction, options);
      
      switch (options.format) {
        case 'email':
          const emailOptions: any = {
            to: options.recipient!,
            includeItemDetails: options.includeItemDetails || false,
            includeTaxBreakdown: options.includeTaxBreakdown || false,
          };
          if (options.template) {
            emailOptions.template = options.template;
          }
          
          const emailResult = await this.emailService.sendReceiptEmail(receiptContent, transaction, emailOptions);
          const emailReceiptResult: ReceiptResult = {
            success: emailResult.success,
            receiptId: `email_${Date.now()}`,
            deliveryMethod: 'email',
          };
          if (emailResult.error) {
            emailReceiptResult.error = emailResult.error;
          }
          return emailReceiptResult;
          
        case 'sms':
          const smsOptions: any = {
            to: options.recipient!,
            includeTotal: true,
            includeItems: options.includeItemDetails || false,
          };
          if (options.template) {
            smsOptions.template = options.template as 'minimal' | 'standard' | 'detailed';
          }
          
          const smsResult = await this.smsService.sendReceiptSms(receiptContent, transaction, smsOptions);
          const smsReceiptResult: ReceiptResult = {
            success: smsResult.success,
            receiptId: `sms_${Date.now()}`,
            deliveryMethod: 'sms',
          };
          if (smsResult.error) {
            smsReceiptResult.error = smsResult.error;
          }
          return smsReceiptResult;
          
        case 'print':
          const printResult = await this.printService.printReceipt(receiptContent, transaction, {
            template: options.template as any,
            includeBarcode: true,
            includeQrCode: false,
            cutPaper: true,
            openDrawer: false,
          });
          const printReceiptResult: ReceiptResult = {
            success: printResult.success,
            receiptId: `print_${Date.now()}`,
            deliveryMethod: 'print',
          };
          if (printResult.error) {
            printReceiptResult.error = printResult.error;
          }
          return printReceiptResult;
          
        default:
          throw new Error(`Unsupported receipt format: ${options.format}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Receipt generation failed: ${errorMessage}`);
      
      return {
        success: false,
        receiptId: '',
        deliveryMethod: options.format,
        error: errorMessage,
      };
    }
  }

  async generateMultipleReceipts(
    transaction: TransactionWithItems,
    optionsArray: ReceiptOptions[],
  ): Promise<ReceiptResult[]> {
    if (!optionsArray || optionsArray.length === 0) {
      return [];
    }

    const results: ReceiptResult[] = [];
    
    for (const options of optionsArray) {
      const result = await this.generateReceipt(transaction, options);
      results.push(result);
    }
    
    return results;
  }

  async getAvailablePrinters(): Promise<string[]> {
    const printers = await this.printService.getAvailablePrinters();
    return printers.map(printer => typeof printer === 'string' ? printer : printer.name || 'Unknown');
  }

  async openCashDrawer(printerName?: string): Promise<{ success: boolean; error?: string }> {
    return this.printService.openCashDrawer(printerName);
  }

  private async buildReceiptContent(
    transaction: TransactionWithItems,
    options: ReceiptOptions,
  ): Promise<string> {
    const template = options.template || 'standard';
    
    switch (template) {
      case 'minimal':
        return this.buildMinimalReceipt(transaction, options);
      case 'detailed':
        return this.buildDetailedReceipt(transaction, options);
      case 'email':
        return this.buildEmailReceipt(transaction, options);
      case 'sms':
        return this.buildSmsReceipt(transaction, options);
      default:
        return this.buildStandardReceipt(transaction, options);
    }
  }

  private buildStandardReceipt(
    transaction: TransactionWithItems,
    options: ReceiptOptions,
  ): string {
    const lines = [];
    
    // Header
    lines.push('RECEIPT');
    lines.push(`Transaction: ${transaction.transactionNumber}`);
    lines.push(`Date: ${transaction.createdAt.toLocaleDateString()}`);
    lines.push(`Time: ${transaction.createdAt.toLocaleTimeString()}`);
    lines.push('');
    
    // Items
    if (options.includeItemDetails && transaction.items) {
      lines.push('ITEMS:');
      for (const item of transaction.items) {
        lines.push(`${item.quantity}x ${item.productName} - $${item.lineTotal.toFixed(2)}`);
      }
      lines.push('');
    }
    
    // Totals
    if (transaction.subtotal !== transaction.total) {
      lines.push(`Subtotal: $${transaction.subtotal.toFixed(2)}`);
      
      if (transaction.taxAmount > 0) {
        lines.push(`Tax: $${transaction.taxAmount.toFixed(2)}`);
      }
      
      if (transaction.discountAmount > 0) {
        lines.push(`Discount: -$${transaction.discountAmount.toFixed(2)}`);
      }
      
      if (transaction.tipAmount > 0) {
        lines.push(`Tip: $${transaction.tipAmount.toFixed(2)}`);
      }
    }
    
    lines.push(`TOTAL: $${transaction.total.toFixed(2)}`);
    lines.push(`Payment: ${transaction.paymentMethod.toUpperCase()}`);
    lines.push('');
    lines.push('Thank you for your business!');
    
    return lines.join('\n');
  }

  private buildMinimalReceipt(
    transaction: TransactionWithItems,
    options: ReceiptOptions,
  ): string {
    const lines = [];
    lines.push(`Receipt #${transaction.transactionNumber}`);
    lines.push(`Total: $${transaction.total.toFixed(2)}`);
    lines.push(`Payment: ${transaction.paymentMethod}`);
    lines.push(`Date: ${transaction.createdAt.toLocaleDateString()}`);
    return lines.join('\n');
  }

  private buildDetailedReceipt(
    transaction: TransactionWithItems,
    options: ReceiptOptions,
  ): string {
    const lines = [];
    
    // Detailed header
    lines.push('DETAILED RECEIPT');
    lines.push(`Transaction ID: ${transaction.id}`);
    lines.push(`Transaction #: ${transaction.transactionNumber}`);
    lines.push(`Date: ${transaction.createdAt.toLocaleDateString()}`);
    lines.push(`Time: ${transaction.createdAt.toLocaleTimeString()}`);
    lines.push('');
    
    // All items with details
    if (transaction.items && transaction.items.length > 0) {
      lines.push('ITEMS:');
      for (const item of transaction.items) {
        lines.push(`${item.productName} (${item.productSku})`);
        lines.push(`  Qty: ${item.quantity} x $${item.unitPrice.toFixed(2)} = $${item.lineTotal.toFixed(2)}`);
        if (item.discountAmount > 0) {
          lines.push(`  Discount: -$${item.discountAmount.toFixed(2)}`);
        }
        if (item.taxAmount > 0) {
          lines.push(`  Tax: $${item.taxAmount.toFixed(2)}`);
        }
        lines.push('');
      }
    }
    
    // Detailed totals
    lines.push('TOTALS:');
    lines.push(`Subtotal: $${transaction.subtotal.toFixed(2)}`);
    lines.push(`Tax: $${transaction.taxAmount.toFixed(2)}`);
    lines.push(`Discount: -$${transaction.discountAmount.toFixed(2)}`);
    lines.push(`Tip: $${transaction.tipAmount.toFixed(2)}`);
    lines.push(`TOTAL: $${transaction.total.toFixed(2)}`);
    lines.push('');
    lines.push(`Payment Method: ${transaction.paymentMethod.toUpperCase()}`);
    lines.push(`Payment Status: ${transaction.paymentStatus}`);
    
    return lines.join('\n');
  }

  private buildEmailReceipt(
    transaction: TransactionWithItems,
    options: ReceiptOptions,
  ): string {
    // Email receipts are typically HTML formatted
    return this.buildStandardReceipt(transaction, options);
  }

  private buildSmsReceipt(
    transaction: TransactionWithItems,
    options: ReceiptOptions,
  ): string {
    // SMS receipts should be very concise
    return this.buildMinimalReceipt(transaction, options);
  }
}