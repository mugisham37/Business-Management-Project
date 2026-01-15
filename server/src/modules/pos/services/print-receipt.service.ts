import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PrintReceiptOptions {
  printerName?: string;
  copies?: number;
  paperSize?: 'thermal_58mm' | 'thermal_80mm' | 'a4' | 'letter';
  template?: 'standard' | 'minimal' | 'detailed';
  includeBarcode?: boolean;
  includeQrCode?: boolean;
  cutPaper?: boolean;
  openDrawer?: boolean;
}

export interface PrintResult {
  success: boolean;
  jobId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface PrinterStatus {
  name: string;
  status: 'online' | 'offline' | 'error' | 'paper_low' | 'paper_out';
  paperLevel?: number;
  lastError?: string;
  capabilities: {
    thermal: boolean;
    color: boolean;
    barcode: boolean;
    qrCode: boolean;
    cashDrawer: boolean;
  };
}

@Injectable()
export class PrintReceiptService {
  private readonly logger = new Logger(PrintReceiptService.name);
  private readonly defaultPrinter: string;
  private readonly printerConfig: any;

  constructor(private readonly configService: ConfigService) {
    this.defaultPrinter = this.configService.get<string>('DEFAULT_PRINTER') || 'thermal_printer_1';
    this.printerConfig = {
      thermalWidth: this.configService.get<number>('THERMAL_PRINTER_WIDTH') || 48, // characters per line
      enableCashDrawer: this.configService.get<boolean>('ENABLE_CASH_DRAWER') || true,
      autoCut: this.configService.get<boolean>('AUTO_CUT_PAPER') || true,
    };
  }

  async printReceipt(
    receiptContent: string,
    transaction: any,
    options: PrintReceiptOptions = {},
  ): Promise<PrintResult> {
    const printerName = options.printerName || this.defaultPrinter;
    
    this.logger.log(`Printing receipt for transaction ${transaction.transactionNumber} on printer ${printerName}`);

    try {
      // Check printer status
      const printerStatus = await this.getPrinterStatus(printerName);
      if (printerStatus.status !== 'online') {
        throw new Error(`Printer ${printerName} is ${printerStatus.status}`);
      }

      // Format content for printer
      const formattedContent = await this.formatForPrinter(receiptContent, transaction, options);
      
      // Generate print commands
      const printCommands = await this.generatePrintCommands(formattedContent, options);
      
      // Send to printer
      const result = await this.sendToPrinter(printerName, printCommands, options);
      
      return {
        success: true,
        jobId: result.jobId,
        metadata: {
          printerName,
          copies: options.copies || 1,
          paperSize: options.paperSize || 'thermal_80mm',
          printedAt: new Date().toISOString(),
          contentLength: formattedContent.length,
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to print receipt: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async printMultipleCopies(
    receiptContent: string,
    transaction: any,
    copies: number,
    options: PrintReceiptOptions = {},
  ): Promise<PrintResult[]> {
    const results: PrintResult[] = [];
    
    for (let i = 0; i < copies; i++) {
      const copyOptions = {
        ...options,
        copies: 1, // Print one at a time for better control
      };
      
      const result = await this.printReceipt(receiptContent, transaction, copyOptions);
      results.push(result);
      
      // Small delay between copies
      if (i < copies - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return results;
  }

  async getAvailablePrinters(): Promise<PrinterStatus[]> {
    // In a real implementation, this would query the system for available printers
    const mockPrinters: PrinterStatus[] = [
      {
        name: 'thermal_printer_1',
        status: 'online',
        paperLevel: 85,
        capabilities: {
          thermal: true,
          color: false,
          barcode: true,
          qrCode: true,
          cashDrawer: true,
        },
      },
      {
        name: 'receipt_printer_main',
        status: 'online',
        paperLevel: 60,
        capabilities: {
          thermal: true,
          color: false,
          barcode: true,
          qrCode: false,
          cashDrawer: false,
        },
      },
      {
        name: 'office_printer',
        status: 'offline',
        capabilities: {
          thermal: false,
          color: true,
          barcode: false,
          qrCode: false,
          cashDrawer: false,
        },
      },
    ];
    
    return mockPrinters;
  }

  async getPrinterStatus(printerName: string): Promise<PrinterStatus> {
    const printers = await this.getAvailablePrinters();
    const printer = printers.find(p => p.name === printerName);
    
    if (!printer) {
      throw new Error(`Printer ${printerName} not found`);
    }
    
    return printer;
  }

  async openCashDrawer(printerName?: string): Promise<PrintResult> {
    const targetPrinter = printerName || this.defaultPrinter;
    
    this.logger.log(`Opening cash drawer via printer ${targetPrinter}`);

    try {
      const printerStatus = await this.getPrinterStatus(targetPrinter);
      
      if (!printerStatus.capabilities.cashDrawer) {
        throw new Error(`Printer ${targetPrinter} does not support cash drawer control`);
      }

      // Generate cash drawer open command
      const drawerCommand = this.generateCashDrawerCommand();
      
      // Send command to printer
      const result = await this.sendToPrinter(targetPrinter, [drawerCommand], {});
      
      return {
        success: true,
        jobId: result.jobId,
        metadata: {
          printerName: targetPrinter,
          action: 'open_cash_drawer',
          executedAt: new Date().toISOString(),
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to open cash drawer: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private async formatForPrinter(
    receiptContent: string,
    transaction: any,
    options: PrintReceiptOptions,
  ): Promise<string> {
    const paperSize = options.paperSize || 'thermal_80mm';
    const template = options.template || 'standard';
    
    switch (paperSize) {
      case 'thermal_58mm':
        return this.formatForThermal(receiptContent, 32, template); // 32 chars wide
      case 'thermal_80mm':
        return this.formatForThermal(receiptContent, 48, template); // 48 chars wide
      case 'a4':
      case 'letter':
        return this.formatForStandardPaper(receiptContent, template);
      default:
        return receiptContent;
    }
  }

  private formatForThermal(content: string, width: number, template: string): string {
    const lines = content.split('\n');
    const formattedLines: string[] = [];
    
    for (const line of lines) {
      if (line.length <= width) {
        formattedLines.push(line);
      } else {
        // Wrap long lines
        const words = line.split(' ');
        let currentLine = '';
        
        for (const word of words) {
          if ((currentLine + ' ' + word).length <= width) {
            currentLine = currentLine ? currentLine + ' ' + word : word;
          } else {
            if (currentLine) {
              formattedLines.push(currentLine);
              currentLine = word;
            } else {
              // Single word is too long, truncate
              formattedLines.push(word.substring(0, width));
            }
          }
        }
        
        if (currentLine) {
          formattedLines.push(currentLine);
        }
      }
    }
    
    return formattedLines.join('\n');
  }

  private formatForStandardPaper(content: string, template: string): string {
    // For standard paper, add margins and formatting
    const lines = content.split('\n');
    const formattedLines: string[] = [];
    
    // Add top margin
    formattedLines.push('');
    formattedLines.push('');
    
    // Add left margin to each line
    for (const line of lines) {
      formattedLines.push('    ' + line); // 4-space left margin
    }
    
    // Add bottom margin
    formattedLines.push('');
    formattedLines.push('');
    
    return formattedLines.join('\n');
  }

  private async generatePrintCommands(
    content: string,
    options: PrintReceiptOptions,
  ): Promise<string[]> {
    const commands: string[] = [];
    
    // Initialize printer
    commands.push('\x1B\x40'); // ESC @ - Initialize printer
    
    // Set font and formatting
    commands.push('\x1B\x21\x00'); // ESC ! - Normal font
    
    // Add content
    commands.push(content);
    
    // Add barcode if requested
    if (options.includeBarcode) {
      commands.push('\n');
      commands.push(this.generateBarcodeCommand('123456789')); // Example barcode
    }
    
    // Add QR code if requested
    if (options.includeQrCode) {
      commands.push('\n');
      commands.push(this.generateQrCodeCommand('https://receipt.example.com/123'));
    }
    
    // Cut paper if requested
    if (options.cutPaper !== false && this.printerConfig.autoCut) {
      commands.push('\x1D\x56\x00'); // GS V - Full cut
    }
    
    // Open cash drawer if requested
    if (options.openDrawer && this.printerConfig.enableCashDrawer) {
      commands.push(this.generateCashDrawerCommand());
    }
    
    return commands;
  }

  private generateBarcodeCommand(data: string): string {
    // ESC/POS barcode command (Code 128)
    return `\x1D\x6B\x49${String.fromCharCode(data.length)}${data}`;
  }

  private generateQrCodeCommand(data: string): string {
    // ESC/POS QR code command (simplified)
    return `\x1D\x28\x6B\x04\x00\x31\x41\x32\x00\x1D\x28\x6B${String.fromCharCode(data.length + 3)}\x00\x31\x50\x30${data}\x1D\x28\x6B\x03\x00\x31\x51\x30`;
  }

  private generateCashDrawerCommand(): string {
    // ESC/POS cash drawer command
    return '\x1B\x70\x00\x19\xFA'; // ESC p - Pulse drawer kick-out connector
  }

  private async sendToPrinter(
    printerName: string,
    commands: string[],
    options: PrintReceiptOptions,
  ): Promise<{ jobId: string }> {
    // Simulate printer communication delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // In a real implementation, this would:
    // 1. Connect to the printer (USB, network, or Bluetooth)
    // 2. Send the ESC/POS commands
    // 3. Handle printer responses and errors
    // 4. Return job status
    
    const jobId = `print_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.log(`Simulated print job ${jobId} sent to printer ${printerName}`);
    this.logger.debug(`Print commands: ${commands.length} commands, ${commands.join('').length} bytes`);
    
    return { jobId };
  }
}