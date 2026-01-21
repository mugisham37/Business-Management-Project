import { Injectable, Logger } from '@nestjs/common';
import { SMSNotificationService } from '../../communication/services/sms-notification.service';
import { ReceiptOptions } from './receipt.service';

export interface SmsReceiptResult {
  success: boolean;
  messageId?: string | undefined;
  error?: string | undefined;
}

@Injectable()
export class SmsReceiptService {
  private readonly logger = new Logger(SmsReceiptService.name);
  private readonly MAX_SMS_LENGTH = 160; // Standard SMS length limit

  constructor(
    private readonly smsNotificationService: SMSNotificationService,
  ) {}

  async sendReceipt(
    tenantId: string,
    phoneNumber: string,
    receiptData: any,
    options: ReceiptOptions = {},
  ): Promise<SmsReceiptResult> {
    try {
      this.logger.log(`Sending SMS receipt to ${phoneNumber} for transaction ${receiptData.transactionId}`);

      // Validate phone number
      if (!this.isValidPhoneNumber(phoneNumber)) {
        throw new Error('Invalid phone number format');
      }

      // Generate SMS content
      const smsContent = this.generateSmsContent(receiptData, options);

      // Check if content exceeds SMS limit
      if (smsContent.length > this.MAX_SMS_LENGTH) {
        this.logger.warn(`SMS content exceeds ${this.MAX_SMS_LENGTH} characters, truncating`);
      }

      // Send SMS using the communication service
      const result = await this.smsNotificationService.sendSMS(
        tenantId,
        {
          to: phoneNumber,
          message: smsContent,
        }
      );

      if (result.success) {
        this.logger.log(`SMS receipt sent successfully to ${phoneNumber}, messageId: ${result.messageId}`);
        return {
          success: true,
          messageId: result.messageId || undefined,
        };
      } else {
        this.logger.error(`Failed to send SMS receipt: ${result.error}`);
        return {
          success: false,
          error: result.error || undefined,
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`SMS receipt service error: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async sendReceiptSummary(
    tenantId: string,
    phoneNumber: string,
    receiptData: any,
  ): Promise<SmsReceiptResult> {
    try {
      // Generate a very short summary for SMS
      const summaryContent = this.generateSummaryContent(receiptData);

      const result = await this.smsNotificationService.sendSMS(
        tenantId,
        {
          to: phoneNumber,
          message: summaryContent,
        }
      );

      return {
        success: result.success,
        messageId: result.messageId || undefined,
        error: result.error || undefined,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`SMS receipt summary error: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private generateSmsContent(receiptData: any, options: ReceiptOptions): string {
    const includeItems = options.includeItemDetails === true;
    const includeTotal = options.includeItemDetails !== false; // Default to true
    
    let content = '';
    
    // Header
    content += `Receipt #${receiptData.transactionNumber}\n`;
    content += `${receiptData.timestamp.toLocaleDateString()} ${receiptData.timestamp.toLocaleTimeString()}\n`;
    
    // Items (if requested and space allows)
    if (includeItems && receiptData.items && receiptData.items.length > 0) {
      const maxItems = 3; // Limit items to keep SMS short
      const itemsToShow = receiptData.items.slice(0, maxItems);
      
      itemsToShow.forEach((item: any) => {
        const itemLine = `${item.quantity}x ${this.truncateText(item.productName, 15)} $${item.lineTotal.toFixed(2)}\n`;
        
        // Check if adding this item would exceed SMS limit
        if ((content + itemLine).length < this.MAX_SMS_LENGTH - 50) { // Leave room for totals
          content += itemLine;
        }
      });
      
      if (receiptData.items.length > maxItems) {
        content += `+${receiptData.items.length - maxItems} more items\n`;
      }
    }
    
    // Totals
    if (includeTotal) {
      if (receiptData.discountAmount > 0) {
        content += `Discount: -$${receiptData.discountAmount.toFixed(2)}\n`;
      }
      
      if (receiptData.taxAmount > 0) {
        content += `Tax: $${receiptData.taxAmount.toFixed(2)}\n`;
      }
      
      content += `Total: $${receiptData.total.toFixed(2)}\n`;
      content += `Paid: ${receiptData.paymentMethod.toUpperCase()}\n`;
    }
    
    // Footer
    content += 'Thank you!';
    
    // Truncate if still too long
    if (content.length > this.MAX_SMS_LENGTH) {
      content = content.substring(0, this.MAX_SMS_LENGTH - 3) + '...';
    }
    
    return content;
  }

  private generateSummaryContent(receiptData: any): string {
    let content = '';
    
    content += `Receipt #${receiptData.transactionNumber}\n`;
    content += `${receiptData.timestamp.toLocaleDateString()}\n`;
    content += `Total: $${receiptData.total.toFixed(2)}\n`;
    content += `Payment: ${receiptData.paymentMethod.toUpperCase()}\n`;
    
    if (receiptData.items && receiptData.items.length > 0) {
      content += `Items: ${receiptData.items.length}\n`;
    }
    
    content += 'Thank you!';
    
    return content;
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    return text.substring(0, maxLength - 3) + '...';
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic phone number validation - accepts various formats
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    return phoneRegex.test(cleanNumber) && cleanNumber.length >= 10;
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d\+]/g, '');
    
    // Add + if not present and number doesn't start with country code
    if (!cleaned.startsWith('+') && cleaned.length === 10) {
      return '+1' + cleaned; // Assume US number
    }
    
    return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
  }
}