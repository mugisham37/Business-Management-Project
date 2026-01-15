import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailReceiptOptions {
  to: string;
  subject?: string;
  template?: string;
  attachPdf?: boolean;
  includeItemDetails?: boolean;
  includeTaxBreakdown?: boolean;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class EmailReceiptService {
  private readonly logger = new Logger(EmailReceiptService.name);
  private readonly fromEmail: string;
  private readonly smtpConfig: any;

  constructor(private readonly configService: ConfigService) {
    this.fromEmail = this.configService.get<string>('EMAIL_FROM') || 'noreply@business.com';
    this.smtpConfig = {
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT') || 587,
      secure: this.configService.get<boolean>('SMTP_SECURE') || false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    };
  }

  async sendReceiptEmail(
    receiptContent: string,
    transaction: any,
    options: EmailReceiptOptions,
  ): Promise<EmailResult> {
    this.logger.log(`Sending receipt email to ${options.to} for transaction ${transaction.transactionNumber}`);

    try {
      // Build email content
      const emailContent = await this.buildEmailContent(receiptContent, transaction, options);
      
      // In a real implementation, this would use a service like SendGrid, AWS SES, or Nodemailer
      const result = await this.simulateEmailSend(emailContent, options);
      
      return {
        success: true,
        messageId: result.messageId,
        metadata: {
          to: options.to,
          subject: emailContent.subject,
          sentAt: new Date().toISOString(),
          template: options.template || 'standard',
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to send receipt email: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async sendBulkReceiptEmails(
    receiptContent: string,
    transaction: any,
    recipients: EmailReceiptOptions[],
  ): Promise<EmailResult[]> {
    const results: EmailResult[] = [];
    
    // Send emails in parallel with rate limiting
    const batchSize = 5; // Send 5 emails at a time
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const batchPromises = batch.map(options => 
        this.sendReceiptEmail(receiptContent, transaction, options)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  private async buildEmailContent(
    receiptContent: string,
    transaction: any,
    options: EmailReceiptOptions,
  ): Promise<{
    subject: string;
    html: string;
    text: string;
    attachments?: any[];
  }> {
    const subject = options.subject || `Receipt for Transaction ${transaction.transactionNumber}`;
    
    // Build HTML email template
    const html = await this.buildHtmlTemplate(receiptContent, transaction, options);
    
    // Plain text version
    const text = this.buildTextTemplate(receiptContent, transaction);
    
    const emailContent: any = {
      subject,
      html,
      text,
    };

    // Add PDF attachment if requested
    if (options.attachPdf) {
      const pdfBuffer = await this.generateReceiptPdf(receiptContent, transaction);
      emailContent.attachments = [
        {
          filename: `receipt-${transaction.transactionNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ];
    }

    return emailContent;
  }

  private async buildHtmlTemplate(
    receiptContent: string,
    transaction: any,
    options: EmailReceiptOptions,
  ): Promise<string> {
    const template = options.template || 'standard';
    
    switch (template) {
      case 'minimal':
        return this.buildMinimalHtmlTemplate(receiptContent, transaction);
      case 'branded':
        return this.buildBrandedHtmlTemplate(receiptContent, transaction);
      default:
        return this.buildStandardHtmlTemplate(receiptContent, transaction);
    }
  }

  private buildStandardHtmlTemplate(receiptContent: string, transaction: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt - ${transaction.transactionNumber}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .receipt-content {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            white-space: pre-line;
            font-size: 14px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
            color: #6c757d;
            font-size: 12px;
        }
        .button {
            display: inline-block;
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Transaction Receipt</h1>
        <p>Thank you for your business!</p>
    </div>
    
    <div class="receipt-content">
${receiptContent}
    </div>
    
    <div class="footer">
        <p>This is an automated receipt. Please keep this for your records.</p>
        <p>If you have any questions about this transaction, please contact us.</p>
        <p><small>Transaction processed on ${new Date().toLocaleDateString()}</small></p>
    </div>
</body>
</html>`;
  }

  private buildMinimalHtmlTemplate(receiptContent: string, transaction: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Receipt</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .receipt { font-family: monospace; white-space: pre-line; }
    </style>
</head>
<body>
    <h2>Receipt</h2>
    <div class="receipt">${receiptContent}</div>
</body>
</html>`;
  }

  private buildBrandedHtmlTemplate(receiptContent: string, transaction: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt - ${transaction.transactionNumber}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 0;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            margin: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 30px 20px;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 300;
        }
        .content {
            padding: 30px;
        }
        .receipt-content {
            background-color: #f8f9fa;
            padding: 25px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            white-space: pre-line;
            font-size: 14px;
            border-left: 4px solid #667eea;
        }
        .footer {
            background-color: #f8f9fa;
            text-align: center;
            padding: 20px;
            color: #6c757d;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Receipt</h1>
            <p>Transaction ${transaction.transactionNumber}</p>
        </div>
        
        <div class="content">
            <div class="receipt-content">
${receiptContent}
            </div>
        </div>
        
        <div class="footer">
            <p><strong>Thank you for your business!</strong></p>
            <p>This receipt was generated automatically on ${new Date().toLocaleDateString()}</p>
        </div>
    </div>
</body>
</html>`;
  }

  private buildTextTemplate(receiptContent: string, transaction: any): string {
    return `
RECEIPT - Transaction ${transaction.transactionNumber}

${receiptContent}

---
Thank you for your business!
This is an automated receipt. Please keep this for your records.
Generated on ${new Date().toLocaleDateString()}
`;
  }

  private async generateReceiptPdf(receiptContent: string, transaction: any): Promise<Buffer> {
    // In a real implementation, this would use a PDF generation library like Puppeteer or PDFKit
    // For now, return a mock PDF buffer
    
    const mockPdfContent = `PDF Receipt for Transaction ${transaction.transactionNumber}\n\n${receiptContent}`;
    return Buffer.from(mockPdfContent, 'utf-8');
  }

  private async simulateEmailSend(emailContent: any, options: EmailReceiptOptions): Promise<{ messageId: string }> {
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // In a real implementation, this would use an actual email service
    const messageId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.log(`Simulated email sent to ${options.to} with message ID: ${messageId}`);
    
    return { messageId };
  }
}