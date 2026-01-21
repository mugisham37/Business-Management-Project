import { Injectable, Logger } from '@nestjs/common';
import { EmailNotificationService } from '../../communication/services/email-notification.service';
import { ReceiptOptions } from './receipt.service';

export interface EmailReceiptResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class EmailReceiptService {
  private readonly logger = new Logger(EmailReceiptService.name);

  constructor(
    private readonly emailNotificationService: EmailNotificationService,
  ) {}

  async sendReceipt(
    tenantId: string,
    emailAddress: string,
    receiptData: any,
    options: ReceiptOptions = {},
  ): Promise<EmailReceiptResult> {
    try {
      this.logger.log(`Sending email receipt to ${emailAddress} for transaction ${receiptData.transactionId}`);

      // Validate email address
      if (!this.isValidEmail(emailAddress)) {
        throw new Error('Invalid email address format');
      }

      // Prepare email content
      const subject = `Receipt #${receiptData.transactionNumber}`;
      const htmlContent = this.generateEmailContent(receiptData, options);
      const textContent = this.generateTextContent(receiptData, options);

      // Send email using the communication service
      const result = await this.emailNotificationService.sendEmail(
        tenantId,
        {
          to: emailAddress,
          subject,
          html: htmlContent,
          text: textContent,
        },
      );

      if (result.success) {
        this.logger.log(`Email receipt sent successfully to ${emailAddress}, messageId: ${result.messageId}`);
        return {
          success: true,
          messageId: result.messageId || '',
        };
      } else {
        this.logger.error(`Failed to send email receipt: ${result.error}`);
        return {
          success: false,
          error: result.error || 'Unknown error',
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Email receipt service error: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async sendReceiptWithAttachment(
    tenantId: string,
    emailAddress: string,
    receiptData: any,
    pdfBuffer: Buffer,
    options: ReceiptOptions = {},
  ): Promise<EmailReceiptResult> {
    try {
      this.logger.log(`Sending email receipt with PDF attachment to ${emailAddress}`);

      const subject = `Receipt #${receiptData.transactionNumber}`;
      const htmlContent = this.generateEmailContent(receiptData, options);
      const textContent = this.generateTextContent(receiptData, options);

      const result = await this.emailNotificationService.sendEmail(
        tenantId,
        {
          to: emailAddress,
          subject,
          html: htmlContent,
          text: textContent,
          attachments: [{
            filename: `receipt_${receiptData.transactionNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          }],
        },
      );

      return {
        success: result.success,
        messageId: result.messageId || '',
        ...(result.error && { error: result.error }),
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Email receipt with attachment error: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private generateEmailContent(receiptData: any, options: ReceiptOptions): string {
    const includeItems = options.includeItemDetails !== false; // Default to true
    const includeTaxBreakdown = options.includeTaxBreakdown === true;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt #${receiptData.transactionNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; }
          .header { text-align: center; padding: 20px; background: #f8f9fa; border-bottom: 2px solid #dee2e6; }
          .content { padding: 20px; }
          .transaction-info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .items-table th, .items-table td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
          .items-table th { background: #f8f9fa; font-weight: bold; }
          .items-table .qty, .items-table .price, .items-table .total { text-align: right; }
          .totals { margin-top: 20px; padding-top: 20px; border-top: 2px solid #dee2e6; }
          .totals .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
          .totals .total-row { font-size: 18px; font-weight: bold; padding-top: 10px; border-top: 1px solid #dee2e6; }
          .footer { text-align: center; padding: 20px; color: #6c757d; font-size: 14px; }
          .payment-info { background: #e3f2fd; padding: 15px; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Receipt</h1>
            <h2>#${receiptData.transactionNumber}</h2>
          </div>
          
          <div class="content">
            <div class="transaction-info">
              <div class="row">
                <strong>Date:</strong> ${receiptData.timestamp.toLocaleString()}
              </div>
              <div class="row">
                <strong>Transaction ID:</strong> ${receiptData.transactionId}
              </div>
              ${receiptData.locationId ? `
                <div class="row">
                  <strong>Location:</strong> ${receiptData.locationId}
                </div>
              ` : ''}
            </div>

            ${includeItems && receiptData.items && receiptData.items.length > 0 ? `
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>SKU</th>
                    <th class="qty">Qty</th>
                    <th class="price">Price</th>
                    <th class="total">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${receiptData.items.map((item: any) => `
                    <tr>
                      <td>${item.productName}</td>
                      <td>${item.productSku}</td>
                      <td class="qty">${item.quantity}</td>
                      <td class="price">$${item.unitPrice.toFixed(2)}</td>
                      <td class="total">$${item.lineTotal.toFixed(2)}</td>
                    </tr>
                    ${item.discountAmount > 0 ? `
                      <tr>
                        <td colspan="4" style="text-align: right; font-style: italic;">Item Discount:</td>
                        <td class="total" style="color: #dc3545;">-$${item.discountAmount.toFixed(2)}</td>
                      </tr>
                    ` : ''}
                  `).join('')}
                </tbody>
              </table>
            ` : ''}

            <div class="totals">
              <div class="row">
                <span>Subtotal:</span>
                <span>$${receiptData.subtotal.toFixed(2)}</span>
              </div>
              
              ${receiptData.discountAmount > 0 ? `
                <div class="row" style="color: #dc3545;">
                  <span>Discount:</span>
                  <span>-$${receiptData.discountAmount.toFixed(2)}</span>
                </div>
              ` : ''}
              
              ${receiptData.taxAmount > 0 ? `
                <div class="row">
                  <span>Tax:</span>
                  <span>$${receiptData.taxAmount.toFixed(2)}</span>
                </div>
              ` : ''}
              
              ${receiptData.tipAmount > 0 ? `
                <div class="row">
                  <span>Tip:</span>
                  <span>$${receiptData.tipAmount.toFixed(2)}</span>
                </div>
              ` : ''}
              
              <div class="row total-row">
                <span>TOTAL:</span>
                <span>$${receiptData.total.toFixed(2)}</span>
              </div>
            </div>

            ${includeTaxBreakdown && receiptData.taxBreakdown && receiptData.taxBreakdown.length > 0 ? `
              <div class="tax-breakdown" style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
                <h4>Tax Breakdown</h4>
                ${receiptData.taxBreakdown.map((tax: any) => `
                  <div class="row">
                    <span>${tax.taxType} (${(tax.rate * 100).toFixed(2)}%):</span>
                    <span>$${tax.amount.toFixed(2)}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <div class="payment-info">
              <div class="row">
                <strong>Payment Method:</strong> ${receiptData.paymentMethod.toUpperCase()}
              </div>
              ${receiptData.paymentDetails && receiptData.paymentDetails.length > 0 ? `
                ${receiptData.paymentDetails.map((payment: any) => `
                  <div class="row">
                    <span>${payment.method.toUpperCase()}:</span>
                    <span>$${payment.amount.toFixed(2)} (${payment.status})</span>
                  </div>
                `).join('')}
              ` : ''}
            </div>
          </div>
          
          <div class="footer">
            <p>Thank you for your business!</p>
            <p>This is an electronic receipt. Please save for your records.</p>
            <p style="font-size: 12px; color: #adb5bd;">
              Receipt generated on ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateTextContent(receiptData: any, options: ReceiptOptions): string {
    let content = '';
    
    content += '================================\n';
    content += '           RECEIPT\n';
    content += '================================\n';
    content += `Transaction: ${receiptData.transactionNumber}\n`;
    content += `Date: ${receiptData.timestamp.toLocaleString()}\n`;
    content += `Transaction ID: ${receiptData.transactionId}\n`;
    content += '--------------------------------\n';
    
    if (options.includeItemDetails !== false && receiptData.items && receiptData.items.length > 0) {
      receiptData.items.forEach((item: any) => {
        content += `${item.productName} (${item.productSku})\n`;
        content += `  ${item.quantity} x $${item.unitPrice.toFixed(2)} = $${item.lineTotal.toFixed(2)}\n`;
        if (item.discountAmount > 0) {
          content += `  Item Discount: -$${item.discountAmount.toFixed(2)}\n`;
        }
      });
      content += '--------------------------------\n';
    }
    
    content += `Subtotal: $${receiptData.subtotal.toFixed(2)}\n`;
    
    if (receiptData.discountAmount > 0) {
      content += `Discount: -$${receiptData.discountAmount.toFixed(2)}\n`;
    }
    
    if (receiptData.taxAmount > 0) {
      content += `Tax: $${receiptData.taxAmount.toFixed(2)}\n`;
    }
    
    if (receiptData.tipAmount > 0) {
      content += `Tip: $${receiptData.tipAmount.toFixed(2)}\n`;
    }
    
    content += '--------------------------------\n';
    content += `TOTAL: $${receiptData.total.toFixed(2)}\n`;
    content += `Payment: ${receiptData.paymentMethod.toUpperCase()}\n`;
    content += '================================\n';
    content += 'Thank you for your business!\n';
    content += '================================\n';
    
    return content;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}