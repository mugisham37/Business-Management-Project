import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsReceiptOptions {
  to: string;
  template?: 'minimal' | 'standard' | 'detailed';
  includeTotal?: boolean;
  includeItems?: boolean;
  customMessage?: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class SmsReceiptService {
  private readonly logger = new Logger(SmsReceiptService.name);
  private readonly smsConfig: any;
  private readonly maxSmsLength = 160; // Standard SMS length

  constructor(private readonly configService: ConfigService) {
    this.smsConfig = {
      apiKey: this.configService.get<string>('SMS_API_KEY'),
      apiSecret: this.configService.get<string>('SMS_API_SECRET'),
      fromNumber: this.configService.get<string>('SMS_FROM_NUMBER') || '+1234567890',
      provider: this.configService.get<string>('SMS_PROVIDER') || 'twilio', // twilio, aws-sns, etc.
    };
  }

  async sendReceiptSms(
    receiptContent: string,
    transaction: any,
    options: SmsReceiptOptions,
  ): Promise<SmsResult> {
    this.logger.log(`Sending receipt SMS to ${this.maskPhoneNumber(options.to)} for transaction ${transaction.transactionNumber}`);

    try {
      // Validate phone number
      if (!this.validatePhoneNumber(options.to)) {
        throw new Error('Invalid phone number format');
      }

      // Build SMS content
      const smsContent = await this.buildSmsContent(receiptContent, transaction, options);
      
      // Check SMS length and split if necessary
      const messages = this.splitLongMessage(smsContent);
      
      // Send SMS(es)
      const results = await this.sendSmsMessages(messages, options.to);
      
      return {
        success: true,
        messageId: results[0]?.messageId || 'unknown',
        metadata: {
          to: this.maskPhoneNumber(options.to),
          messageCount: messages.length,
          totalLength: smsContent.length,
          sentAt: new Date().toISOString(),
          template: options.template || 'standard',
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to send receipt SMS: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async sendBulkReceiptSms(
    receiptContent: string,
    transaction: any,
    recipients: SmsReceiptOptions[],
  ): Promise<SmsResult[]> {
    const results: SmsResult[] = [];
    
    // Send SMS messages in batches to respect rate limits
    const batchSize = 10; // Send 10 SMS at a time
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const batchPromises = batch.map(options => 
        this.sendReceiptSms(receiptContent, transaction, options)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return results;
  }

  private async buildSmsContent(
    receiptContent: string,
    transaction: any,
    options: SmsReceiptOptions,
  ): Promise<string> {
    const template = options.template || 'standard';
    
    switch (template) {
      case 'minimal':
        return this.buildMinimalSmsContent(transaction, options);
      case 'detailed':
        return this.buildDetailedSmsContent(receiptContent, transaction, options);
      default:
        return this.buildStandardSmsContent(transaction, options);
    }
  }

  private buildMinimalSmsContent(transaction: any, options: SmsReceiptOptions): string {
    const parts = [];
    
    if (options.customMessage) {
      parts.push(options.customMessage);
    } else {
      parts.push('Receipt');
    }
    
    parts.push(`#${transaction.transactionNumber}`);
    
    if (options.includeTotal !== false) {
      parts.push(`$${transaction.total.toFixed(2)}`);
    }
    
    parts.push(transaction.createdAt.toLocaleDateString());
    parts.push('Thank you!');
    
    return parts.join(' ');
  }

  private buildStandardSmsContent(transaction: any, options: SmsReceiptOptions): string {
    const lines = [];
    
    if (options.customMessage) {
      lines.push(options.customMessage);
    } else {
      lines.push('Receipt for your purchase');
    }
    
    lines.push(`Transaction: ${transaction.transactionNumber}`);
    lines.push(`Date: ${transaction.createdAt.toLocaleDateString()}`);
    
    if (options.includeTotal !== false) {
      lines.push(`Total: $${transaction.total.toFixed(2)}`);
    }
    
    if (options.includeItems && transaction.items && transaction.items.length > 0) {
      lines.push(`Items: ${transaction.itemCount}`);
      
      // Add top items if space allows
      const topItems = transaction.items.slice(0, 2);
      for (const item of topItems) {
        const itemLine = `${item.quantity}x ${item.productName}`;
        if (lines.join('\n').length + itemLine.length < 120) {
          lines.push(itemLine);
        }
      }
      
      if (transaction.items.length > 2) {
        lines.push(`+${transaction.items.length - 2} more`);
      }
    }
    
    lines.push('Thank you for your business!');
    
    return lines.join('\n');
  }

  private buildDetailedSmsContent(receiptContent: string, transaction: any, options: SmsReceiptOptions): string {
    // For detailed SMS, include more information but still keep it concise
    const lines = [];
    
    lines.push('RECEIPT');
    lines.push(`#${transaction.transactionNumber}`);
    lines.push(`${transaction.createdAt.toLocaleDateString()} ${transaction.createdAt.toLocaleTimeString()}`);
    lines.push('');
    
    if (transaction.items && transaction.items.length > 0) {
      for (const item of transaction.items.slice(0, 3)) { // Max 3 items
        lines.push(`${item.quantity}x ${item.productName} $${item.lineTotal.toFixed(2)}`);
      }
      
      if (transaction.items.length > 3) {
        lines.push(`... +${transaction.items.length - 3} more items`);
      }
      lines.push('');
    }
    
    if (transaction.subtotal !== transaction.total) {
      lines.push(`Subtotal: $${transaction.subtotal.toFixed(2)}`);
      
      if (transaction.taxAmount > 0) {
        lines.push(`Tax: $${transaction.taxAmount.toFixed(2)}`);
      }
      
      if (transaction.discountAmount > 0) {
        lines.push(`Discount: -$${transaction.discountAmount.toFixed(2)}`);
      }
    }
    
    lines.push(`TOTAL: $${transaction.total.toFixed(2)}`);
    lines.push(`Payment: ${transaction.paymentMethod.toUpperCase()}`);
    lines.push('');
    lines.push('Thank you!');
    
    return lines.join('\n');
  }

  private splitLongMessage(content: string): string[] {
    if (content.length <= this.maxSmsLength) {
      return [content];
    }
    
    const messages: string[] = [];
    const words = content.split(' ');
    let currentMessage = '';
    
    for (const word of words) {
      const testMessage = currentMessage ? `${currentMessage} ${word}` : word;
      
      if (testMessage.length <= this.maxSmsLength - 10) { // Leave space for part indicator
        currentMessage = testMessage;
      } else {
        if (currentMessage) {
          messages.push(currentMessage);
          currentMessage = word;
        } else {
          // Single word is too long, truncate it
          messages.push(word.substring(0, this.maxSmsLength - 10));
          currentMessage = word.substring(this.maxSmsLength - 10);
        }
      }
    }
    
    if (currentMessage) {
      messages.push(currentMessage);
    }
    
    // Add part indicators if multiple messages
    if (messages.length > 1) {
      return messages.map((msg, index) => `(${index + 1}/${messages.length}) ${msg}`);
    }
    
    return messages;
  }

  private async sendSmsMessages(messages: string[], phoneNumber: string): Promise<Array<{ messageId: string }>> {
    const results: Array<{ messageId: string }> = [];
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      // Skip if message is undefined (shouldn't happen but TypeScript safety)
      if (!message) continue;
      
      // Simulate SMS sending based on provider
      const result = await this.sendSingleSms(message, phoneNumber);
      results.push(result);
      
      // Add small delay between parts of multi-part messages
      if (i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  private async sendSingleSms(message: string, phoneNumber: string): Promise<{ messageId: string }> {
    // Simulate SMS sending delay
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));
    
    // In a real implementation, this would use an SMS service like Twilio, AWS SNS, etc.
    const messageId = `sms_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    this.logger.log(`Simulated SMS sent to ${this.maskPhoneNumber(phoneNumber)} with message ID: ${messageId}`);
    
    return { messageId };
  }

  private validatePhoneNumber(phoneNumber: string): boolean {
    // Basic international phone number validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) {
      return phoneNumber;
    }
    
    const visiblePart = phoneNumber.slice(-4);
    const maskedPart = '*'.repeat(phoneNumber.length - 4);
    return maskedPart + visiblePart;
  }
}