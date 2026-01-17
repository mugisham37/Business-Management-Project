import { Injectable, Logger } from '@nestjs/common';
import { EmailReceiptService } from './email-receipt.service';
import { SmsReceiptService } from './sms-receipt.service';
import { PrintReceiptService } from './print-receipt.service';
import { TransactionWithItems } from '../entities/transaction.entity';

export interface ReceiptOptions {
  includeItemDetails?: boolean;
  includeTaxBreakdown?: boolean;
  includePaymentDetails?: boolean;
  template?: string;
  language?: string;
}

export interface ReceiptDeliveryResult {
  success: boolean;
  receiptId: string;
  deliveryMethod: string;
  deliveredAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);

  constructor(
    private readonly emailReceiptService: EmailReceiptService,
    private readonly smsReceiptService: SmsReceiptService,
    private readonly printReceiptService: PrintReceiptService,
  ) {}

  async generateReceipt(
    tenantId: string,
    transaction: TransactionWithItems,
    options: ReceiptOptions = {},
  ): Promise<{
    receiptId: string;
    receiptData: any;
    formattedReceipt: string;
  }> {
    const receiptId = `receipt_${transaction.id}_${Date.now()}`;
    
    this.logger.log(`Generating receipt ${receiptId} for transaction ${transaction.id}`);

    // Build receipt data
    const receiptData = {
      receiptId,
      transactionId: transaction.id,
      transactionNumber: transaction.transactionNumber,
      tenantId,
      locationId: transaction.locationId,
      timestamp: new Date(),
      
      // Transaction details
      subtotal: transaction.subtotal,
      taxAmount: transaction.taxAmount,
      discountAmount: transaction.discountAmount,
      tipAmount: transaction.tipAmount,
      total: transaction.total,
      paymentMethod: transaction.paymentMethod,
      
      // Items (if requested)
      items: options.includeItemDetails ? transaction.items.map(item => ({
        productName: item.productName,
        productSku: item.productSku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        discountAmount: item.discountAmount,
      })) : [],
      
      // Tax breakdown (if requested)
      taxBreakdown: options.includeTaxBreakdown ? this.calculateTaxBreakdown(transaction) : undefined,
      
      // Payment details (if requested)
      paymentDetails: options.includePaymentDetails ? transaction.payments.map(payment => ({
        method: payment.paymentMethod,
        amount: payment.amount,
        status: payment.status,
        processedAt: payment.processedAt,
      })) : undefined,
      
      // Metadata
      metadata: {
        template: options.template || 'default',
        language: options.language || 'en',
        generatedAt: new Date(),
      },
    };

    // Format receipt for display/printing
    const formattedReceipt = this.formatReceipt(receiptData, options);

    return {
      receiptId,
      receiptData,
      formattedReceipt,
    };
  }

  async sendEmailReceipt(
    tenantId: string,
    transaction: TransactionWithItems,
    emailAddress: string,
    options: ReceiptOptions = {},
  ): Promise<ReceiptDeliveryResult> {
    try {
      const { receiptId, receiptData } = await this.generateReceipt(tenantId, transaction, options);
      
      const result = await this.emailReceiptService.sendReceipt(
        tenantId,
        emailAddress,
        receiptData,
        options
      );

      return {
        success: result.success,
        receiptId,
        deliveryMethod: 'email',
        deliveredAt: result.success ? new Date() : undefined,
        error: result.error,
        metadata: {
          emailAddress,
          messageId: result.messageId,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to send email receipt: ${errorMessage}`);
      
      return {
        success: false,
        receiptId: '',
        deliveryMethod: 'email',
        error: errorMessage,
      };
    }
  }

  async sendSmsReceipt(
    tenantId: string,
    transaction: TransactionWithItems,
    phoneNumber: string,
    options: ReceiptOptions = {},
  ): Promise<ReceiptDeliveryResult> {
    try {
      const { receiptId, receiptData } = await this.generateReceipt(tenantId, transaction, options);
      
      const result = await this.smsReceiptService.sendReceipt(
        tenantId,
        phoneNumber,
        receiptData,
        options
      );

      return {
        success: result.success,
        receiptId,
        deliveryMethod: 'sms',
        deliveredAt: result.success ? new Date() : undefined,
        error: result.error,
        metadata: {
          phoneNumber,
          messageId: result.messageId,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to send SMS receipt: ${errorMessage}`);
      
      return {
        success: false,
        receiptId: '',
        deliveryMethod: 'sms',
        error: errorMessage,
      };
    }
  }

  async printReceipt(
    tenantId: string,
    transaction: TransactionWithItems,
    printerId?: string,
    options: ReceiptOptions = {},
  ): Promise<ReceiptDeliveryResult> {
    try {
      const { receiptId, formattedReceipt } = await this.generateReceipt(tenantId, transaction, options);
      
      const result = await this.printReceiptService.printReceipt(
        tenantId,
        formattedReceipt,
        printerId,
        options
      );

      return {
        success: result.success,
        receiptId,
        deliveryMethod: 'print',
        deliveredAt: result.success ? new Date() : undefined,
        error: result.error,
        metadata: {
          printerId,
          printJobId: result.printJobId,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to print receipt: ${errorMessage}`);
      
      return {
        success: false,
        receiptId: '',
        deliveryMethod: 'print',
        error: errorMessage,
      };
    }
  }

  async getReceiptHistory(
    tenantId: string,
    transactionId: string,
  ): Promise<Array<{
    receiptId: string;
    deliveryMethod: string;
    deliveredAt: Date;
    status: string;
    recipient?: string;
  }>> {
    // In a real implementation, this would query a receipt history table
    // For now, return empty array
    return [];
  }

  private calculateTaxBreakdown(transaction: TransactionWithItems): Array<{
    taxType: string;
    rate: number;
    amount: number;
  }> {
    // Simple tax breakdown - in real implementation, this would be more complex
    if (transaction.taxAmount > 0) {
      return [{
        taxType: 'Sales Tax',
        rate: transaction.taxAmount / transaction.subtotal,
        amount: transaction.taxAmount,
      }];
    }
    
    return [];
  }

  private formatReceipt(receiptData: any, options: ReceiptOptions): string {
    const template = options.template || 'default';
    
    switch (template) {
      case 'thermal':
        return this.formatThermalReceipt(receiptData);
      case 'email':
        return this.formatEmailReceipt(receiptData);
      case 'sms':
        return this.formatSmsReceipt(receiptData);
      default:
        return this.formatDefaultReceipt(receiptData);
    }
  }

  private formatDefaultReceipt(data: any): string {
    let receipt = '';
    
    receipt += '================================\n';
    receipt += '           RECEIPT\n';
    receipt += '================================\n';
    receipt += `Transaction: ${data.transactionNumber}\n`;
    receipt += `Date: ${data.timestamp.toLocaleString()}\n`;
    receipt += '--------------------------------\n';
    
    if (data.items && data.items.length > 0) {
      data.items.forEach((item: any) => {
        receipt += `${item.productName}\n`;
        receipt += `  ${item.quantity} x $${item.unitPrice.toFixed(2)} = $${item.lineTotal.toFixed(2)}\n`;
        if (item.discountAmount > 0) {
          receipt += `  Discount: -$${item.discountAmount.toFixed(2)}\n`;
        }
      });
      receipt += '--------------------------------\n';
    }
    
    receipt += `Subtotal: $${data.subtotal.toFixed(2)}\n`;
    
    if (data.discountAmount > 0) {
      receipt += `Discount: -$${data.discountAmount.toFixed(2)}\n`;
    }
    
    if (data.taxAmount > 0) {
      receipt += `Tax: $${data.taxAmount.toFixed(2)}\n`;
    }
    
    if (data.tipAmount > 0) {
      receipt += `Tip: $${data.tipAmount.toFixed(2)}\n`;
    }
    
    receipt += '--------------------------------\n';
    receipt += `TOTAL: $${data.total.toFixed(2)}\n`;
    receipt += `Payment: ${data.paymentMethod.toUpperCase()}\n`;
    receipt += '================================\n';
    receipt += 'Thank you for your business!\n';
    receipt += '================================\n';
    
    return receipt;
  }

  private formatThermalReceipt(data: any): string {
    // Thermal printer format (narrower, specific formatting)
    let receipt = '';
    
    receipt += '        RECEIPT\n';
    receipt += '========================\n';
    receipt += `#${data.transactionNumber}\n`;
    receipt += `${data.timestamp.toLocaleDateString()}\n`;
    receipt += `${data.timestamp.toLocaleTimeString()}\n`;
    receipt += '------------------------\n';
    
    if (data.items && data.items.length > 0) {
      data.items.forEach((item: any) => {
        const name = item.productName.length > 20 ? 
          item.productName.substring(0, 17) + '...' : 
          item.productName;
        receipt += `${name}\n`;
        receipt += `${item.quantity} x $${item.unitPrice.toFixed(2)}\n`;
        receipt += `        $${item.lineTotal.toFixed(2)}\n`;
      });
      receipt += '------------------------\n';
    }
    
    receipt += `Subtotal  $${data.subtotal.toFixed(2)}\n`;
    if (data.taxAmount > 0) {
      receipt += `Tax       $${data.taxAmount.toFixed(2)}\n`;
    }
    receipt += `TOTAL     $${data.total.toFixed(2)}\n`;
    receipt += '========================\n';
    receipt += 'Thank you!\n';
    
    return receipt;
  }

  private formatEmailReceipt(data: any): string {
    // HTML format for email
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="text-align: center; color: #333;">Receipt</h2>
        <div style="border: 1px solid #ddd; padding: 20px; margin: 20px 0;">
          <p><strong>Transaction:</strong> ${data.transactionNumber}</p>
          <p><strong>Date:</strong> ${data.timestamp.toLocaleString()}</p>
          
          ${data.items && data.items.length > 0 ? `
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="border-bottom: 1px solid #ddd;">
                  <th style="text-align: left; padding: 8px;">Item</th>
                  <th style="text-align: right; padding: 8px;">Qty</th>
                  <th style="text-align: right; padding: 8px;">Price</th>
                  <th style="text-align: right; padding: 8px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${data.items.map((item: any) => `
                  <tr>
                    <td style="padding: 8px;">${item.productName}</td>
                    <td style="text-align: right; padding: 8px;">${item.quantity}</td>
                    <td style="text-align: right; padding: 8px;">$${item.unitPrice.toFixed(2)}</td>
                    <td style="text-align: right; padding: 8px;">$${item.lineTotal.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
          
          <div style="border-top: 1px solid #ddd; padding-top: 10px; margin-top: 20px;">
            <p style="text-align: right;"><strong>Subtotal: $${data.subtotal.toFixed(2)}</strong></p>
            ${data.taxAmount > 0 ? `<p style="text-align: right;">Tax: $${data.taxAmount.toFixed(2)}</p>` : ''}
            ${data.discountAmount > 0 ? `<p style="text-align: right;">Discount: -$${data.discountAmount.toFixed(2)}</p>` : ''}
            ${data.tipAmount > 0 ? `<p style="text-align: right;">Tip: $${data.tipAmount.toFixed(2)}</p>` : ''}
            <p style="text-align: right; font-size: 18px;"><strong>TOTAL: $${data.total.toFixed(2)}</strong></p>
            <p style="text-align: right;">Payment Method: ${data.paymentMethod.toUpperCase()}</p>
          </div>
        </div>
        <p style="text-align: center; color: #666;">Thank you for your business!</p>
      </div>
    `;
  }

  private formatSmsReceipt(data: any): string {
    // Short format for SMS
    let receipt = `Receipt #${data.transactionNumber}\n`;
    receipt += `${data.timestamp.toLocaleDateString()} ${data.timestamp.toLocaleTimeString()}\n`;
    receipt += `Total: $${data.total.toFixed(2)} (${data.paymentMethod.toUpperCase()})\n`;
    
    if (data.items && data.items.length <= 3) {
      data.items.forEach((item: any) => {
        receipt += `${item.quantity}x ${item.productName} $${item.lineTotal.toFixed(2)}\n`;
      });
    } else if (data.items && data.items.length > 3) {
      receipt += `${data.items.length} items purchased\n`;
    }
    
    receipt += 'Thank you!';
    
    return receipt;
  }
}