import { Injectable, Logger } from '@nestjs/common';
import { ReceiptOptions } from './receipt.service';

export interface PrintReceiptResult {
  success: boolean;
  printJobId?: string;
  error?: string;
}

export interface PrinterConfiguration {
  id: string;
  name: string;
  type: 'thermal' | 'inkjet' | 'laser';
  connectionType: 'usb' | 'network' | 'bluetooth';
  ipAddress?: string;
  port?: number;
  devicePath?: string;
  paperWidth: number; // in characters
  isDefault: boolean;
  isOnline: boolean;
}

@Injectable()
export class PrintReceiptService {
  private readonly logger = new Logger(PrintReceiptService.name);
  private readonly printers = new Map<string, PrinterConfiguration>();

  constructor() {
    // Initialize with some default printer configurations
    this.initializeDefaultPrinters();
  }

  async printReceipt(
    tenantId: string,
    receiptContent: string,
    printerId?: string,
    options: ReceiptOptions = {},
  ): Promise<PrintReceiptResult> {
    try {
      this.logger.log(`Printing receipt for tenant ${tenantId}${printerId ? ` on printer ${printerId}` : ''}`);

      // Get printer configuration
      const printer = await this.getPrinterConfiguration(tenantId, printerId);
      
      if (!printer) {
        throw new Error(`Printer ${printerId || 'default'} not found or not configured`);
      }

      if (!printer.isOnline) {
        throw new Error(`Printer ${printer.name} is offline`);
      }

      // Format content for the specific printer type
      const formattedContent = this.formatContentForPrinter(receiptContent, printer, options);

      // Generate print job ID
      const printJobId = `print_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Send to printer based on connection type
      const result = await this.sendToPrinter(printer, formattedContent, printJobId);

      if (result.success) {
        this.logger.log(`Receipt printed successfully, job ID: ${printJobId}`);
        return {
          success: true,
          printJobId,
        };
      } else {
        this.logger.error(`Print job failed: ${result.error}`);
        return {
          success: false,
          error: result.error,
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Print receipt service error: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getPrinters(tenantId: string): Promise<PrinterConfiguration[]> {
    // In a real implementation, this would fetch tenant-specific printer configurations
    // from the database. For now, return the default printers.
    return Array.from(this.printers.values());
  }

  async addPrinter(
    tenantId: string,
    printerConfig: Omit<PrinterConfiguration, 'id'>,
  ): Promise<PrinterConfiguration> {
    const id = `printer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const printer: PrinterConfiguration = {
      ...printerConfig,
      id,
    };

    this.printers.set(id, printer);
    
    this.logger.log(`Added printer ${printer.name} (${id}) for tenant ${tenantId}`);
    
    return printer;
  }

  async updatePrinter(
    tenantId: string,
    printerId: string,
    updates: Partial<PrinterConfiguration>,
  ): Promise<PrinterConfiguration | null> {
    const printer = this.printers.get(printerId);
    
    if (!printer) {
      return null;
    }

    const updatedPrinter = { ...printer, ...updates, id: printerId };
    this.printers.set(printerId, updatedPrinter);
    
    this.logger.log(`Updated printer ${printerId} for tenant ${tenantId}`);
    
    return updatedPrinter;
  }

  async removePrinter(tenantId: string, printerId: string): Promise<boolean> {
    const deleted = this.printers.delete(printerId);
    
    if (deleted) {
      this.logger.log(`Removed printer ${printerId} for tenant ${tenantId}`);
    }
    
    return deleted;
  }

  async testPrinter(tenantId: string, printerId: string): Promise<PrintReceiptResult> {
    const testContent = this.generateTestReceipt();
    
    return this.printReceipt(tenantId, testContent, printerId, {
      template: 'thermal',
    });
  }

  private async getPrinterConfiguration(
    tenantId: string,
    printerId?: string,
  ): Promise<PrinterConfiguration | null> {
    if (printerId) {
      return this.printers.get(printerId) || null;
    }

    // Find default printer
    for (const printer of this.printers.values()) {
      if (printer.isDefault) {
        return printer;
      }
    }

    // Return first available printer if no default
    const firstPrinter = this.printers.values().next().value;
    return firstPrinter || null;
  }

  private formatContentForPrinter(
    content: string,
    printer: PrinterConfiguration,
    options: ReceiptOptions,
  ): string {
    switch (printer.type) {
      case 'thermal':
        return this.formatForThermalPrinter(content, printer.paperWidth);
      case 'inkjet':
      case 'laser':
        return this.formatForStandardPrinter(content, printer.paperWidth);
      default:
        return content;
    }
  }

  private formatForThermalPrinter(content: string, paperWidth: number): string {
    const lines = content.split('\n');
    const formattedLines: string[] = [];

    for (const line of lines) {
      if (line.length <= paperWidth) {
        formattedLines.push(line);
      } else {
        // Wrap long lines
        const wrappedLines = this.wrapText(line, paperWidth);
        formattedLines.push(...wrappedLines);
      }
    }

    // Add thermal printer specific commands
    let formatted = '\x1B\x40'; // Initialize printer
    formatted += '\x1B\x61\x01'; // Center alignment for header
    formatted += formattedLines.join('\n');
    formatted += '\n\n\n'; // Feed paper
    formatted += '\x1D\x56\x42\x00'; // Cut paper

    return formatted;
  }

  private formatForStandardPrinter(content: string, paperWidth: number): string {
    const lines = content.split('\n');
    const formattedLines: string[] = [];

    for (const line of lines) {
      if (line.length <= paperWidth) {
        formattedLines.push(line);
      } else {
        const wrappedLines = this.wrapText(line, paperWidth);
        formattedLines.push(...wrappedLines);
      }
    }

    return formattedLines.join('\n');
  }

  private wrapText(text: string, width: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + word).length <= width) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  private async sendToPrinter(
    printer: PrinterConfiguration,
    content: string,
    printJobId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      switch (printer.connectionType) {
        case 'network':
          return await this.sendToNetworkPrinter(printer, content, printJobId);
        case 'usb':
          return await this.sendToUsbPrinter(printer, content, printJobId);
        case 'bluetooth':
          return await this.sendToBluetoothPrinter(printer, content, printJobId);
        default:
          throw new Error(`Unsupported connection type: ${printer.connectionType}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private async sendToNetworkPrinter(
    printer: PrinterConfiguration,
    content: string,
    printJobId: string,
  ): Promise<{ success: boolean; error?: string }> {
    // In a real implementation, this would connect to the network printer
    // and send the print job. For now, simulate the operation.
    
    this.logger.log(`Sending print job ${printJobId} to network printer ${printer.ipAddress}:${printer.port}`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate success (in real implementation, this would depend on actual printer response)
    return { success: true };
  }

  private async sendToUsbPrinter(
    printer: PrinterConfiguration,
    content: string,
    printJobId: string,
  ): Promise<{ success: boolean; error?: string }> {
    // In a real implementation, this would use a USB printing library
    // to send data to the USB printer device.
    
    this.logger.log(`Sending print job ${printJobId} to USB printer ${printer.devicePath}`);
    
    // Simulate USB communication
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return { success: true };
  }

  private async sendToBluetoothPrinter(
    printer: PrinterConfiguration,
    content: string,
    printJobId: string,
  ): Promise<{ success: boolean; error?: string }> {
    // In a real implementation, this would use Bluetooth communication
    // to send data to the Bluetooth printer.
    
    this.logger.log(`Sending print job ${printJobId} to Bluetooth printer ${printer.name}`);
    
    // Simulate Bluetooth communication
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return { success: true };
  }

  private generateTestReceipt(): string {
    const now = new Date();
    
    return `
================================
         TEST RECEIPT
================================
Date: ${now.toLocaleDateString()}
Time: ${now.toLocaleTimeString()}
--------------------------------
This is a test print to verify
printer connectivity and
formatting.

If you can read this clearly,
your printer is working correctly.
--------------------------------
Test completed successfully!
================================
    `.trim();
  }

  private initializeDefaultPrinters(): void {
    // Add some default printer configurations
    const defaultThermal: PrinterConfiguration = {
      id: 'thermal_default',
      name: 'Default Thermal Printer',
      type: 'thermal',
      connectionType: 'usb',
      devicePath: '/dev/usb/lp0',
      paperWidth: 32,
      isDefault: true,
      isOnline: true,
    };

    const networkPrinter: PrinterConfiguration = {
      id: 'network_printer',
      name: 'Network Receipt Printer',
      type: 'thermal',
      connectionType: 'network',
      ipAddress: '192.168.1.100',
      port: 9100,
      paperWidth: 42,
      isDefault: false,
      isOnline: true,
    };

    this.printers.set(defaultThermal.id, defaultThermal);
    this.printers.set(networkPrinter.id, networkPrinter);

    this.logger.log('Initialized default printer configurations');
  }
}