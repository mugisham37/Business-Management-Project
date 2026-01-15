import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PurchaseOrderService } from './purchase-order.service';
import { SupplierService } from './supplier.service';
import { PurchaseOrderStatus } from '../dto/purchase-order.dto';

// EDI Document Types
export enum EDIDocumentType {
  PURCHASE_ORDER = '850', // Purchase Order
  PURCHASE_ORDER_ACKNOWLEDGMENT = '855', // Purchase Order Acknowledgment
  ADVANCE_SHIP_NOTICE = '856', // Advance Ship Notice
  INVOICE = '810', // Invoice
  FUNCTIONAL_ACKNOWLEDGMENT = '997', // Functional Acknowledgment
  INVENTORY_INQUIRY = '846', // Inventory Inquiry Response
  PRICE_CATALOG = '832', // Price/Sales Catalog
}

export enum EDITransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  ACKNOWLEDGED = 'acknowledged',
}

export interface EDIDocument {
  id: string;
  tenantId: string;
  supplierId: string;
  documentType: EDIDocumentType;
  direction: 'inbound' | 'outbound';
  status: EDITransactionStatus;
  rawContent: string;
  parsedContent: any;
  relatedEntityId?: string; // PO ID, Invoice ID, etc.
  errorMessage?: string;
  processedAt?: Date;
  acknowledgedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EDIConfiguration {
  supplierId: string;
  isEnabled: boolean;
  connectionType: 'as2' | 'sftp' | 'api' | 'van'; // Value Added Network
  connectionSettings: {
    endpoint?: string;
    username?: string;
    password?: string;
    certificatePath?: string;
    privateKeyPath?: string;
    partnerAs2Id?: string;
    ownAs2Id?: string;
    sftpHost?: string;
    sftpPort?: number;
    sftpPath?: string;
    apiKey?: string;
    vanProvider?: string;
    vanId?: string;
  };
  documentMappings: {
    [key in EDIDocumentType]?: {
      enabled: boolean;
      autoProcess: boolean;
      template?: string;
      mappingRules?: any;
    };
  };
  tradingPartnerInfo: {
    gsId: string; // Group Sender ID
    grId: string; // Group Receiver ID
    isId: string; // Interchange Sender ID
    irId: string; // Interchange Receiver ID
  };
}

export interface PurchaseOrderEDI {
  poNumber: string;
  orderDate: Date;
  requestedDeliveryDate?: Date;
  supplier: {
    id: string;
    name: string;
    address: any;
  };
  buyer: {
    name: string;
    address: any;
  };
  items: Array<{
    lineNumber: number;
    productId?: string;
    sku?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    uom: string; // Unit of Measure
    requestedDeliveryDate?: Date;
  }>;
  totals: {
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
  };
  terms: {
    payment?: string;
    delivery?: string;
    shipping?: string;
  };
}

export interface SupplierPortalConfiguration {
  supplierId: string;
  isEnabled: boolean;
  portalUrl: string;
  apiEndpoints: {
    orders: string;
    acknowledgments: string;
    shipments: string;
    invoices: string;
    inventory: string;
  };
  authentication: {
    type: 'api_key' | 'oauth2' | 'basic_auth';
    credentials: any;
  };
  syncSettings: {
    autoSync: boolean;
    syncInterval: number; // minutes
    lastSyncAt?: Date;
  };
  webhookSettings: {
    enabled: boolean;
    webhookUrl?: string;
    secretKey?: string;
    events: string[];
  };
}

// Domain Events
export class EDIDocumentReceivedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly documentId: string,
    public readonly documentType: EDIDocumentType,
    public readonly supplierId: string,
  ) {}
}

export class EDIDocumentProcessedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly documentId: string,
    public readonly documentType: EDIDocumentType,
    public readonly supplierId: string,
    public readonly relatedEntityId?: string,
  ) {}
}

export class EDIDocumentFailedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly documentId: string,
    public readonly documentType: EDIDocumentType,
    public readonly supplierId: string,
    public readonly errorMessage: string,
  ) {}
}

@Injectable()
export class EDIIntegrationService {
  private readonly logger = new Logger(EDIIntegrationService.name);

  constructor(
    private readonly purchaseOrderService: PurchaseOrderService,
    private readonly supplierService: SupplierService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Process inbound EDI document
   */
  async processInboundDocument(
    tenantId: string,
    supplierId: string,
    documentType: EDIDocumentType,
    rawContent: string,
  ): Promise<EDIDocument> {
    this.logger.log(`Processing inbound EDI document: ${documentType} from supplier: ${supplierId}`);

    // Create EDI document record
    const document: EDIDocument = {
      id: this.generateDocumentId(),
      tenantId,
      supplierId,
      documentType,
      direction: 'inbound',
      status: EDITransactionStatus.PROCESSING,
      rawContent,
      parsedContent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      // Parse the EDI document
      const parsedContent = await this.parseEDIDocument(documentType, rawContent);
      document.parsedContent = parsedContent;

      // Process based on document type
      switch (documentType) {
        case EDIDocumentType.PURCHASE_ORDER_ACKNOWLEDGMENT:
          await this.processPurchaseOrderAcknowledgment(tenantId, document);
          break;
        case EDIDocumentType.ADVANCE_SHIP_NOTICE:
          await this.processAdvanceShipNotice(tenantId, document);
          break;
        case EDIDocumentType.INVOICE:
          await this.processEDIInvoice(tenantId, document);
          break;
        case EDIDocumentType.FUNCTIONAL_ACKNOWLEDGMENT:
          await this.processFunctionalAcknowledgment(tenantId, document);
          break;
        default:
          throw new BadRequestException(`Unsupported inbound document type: ${documentType}`);
      }

      document.status = EDITransactionStatus.PROCESSED;
      document.processedAt = new Date();

      // Emit success event
      this.eventEmitter.emit(
        'edi.document.processed',
        new EDIDocumentProcessedEvent(
          tenantId,
          document.id,
          documentType,
          supplierId,
          document.relatedEntityId,
        ),
      );

      this.logger.log(`Successfully processed EDI document: ${document.id}`);
      return document;

    } catch (error) {
      document.status = EDITransactionStatus.FAILED;
      document.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      document.updatedAt = new Date();

      // Emit failure event
      this.eventEmitter.emit(
        'edi.document.failed',
        new EDIDocumentFailedEvent(tenantId, document.id, documentType, supplierId, error instanceof Error ? error.message : 'Unknown error'),
      );

      this.logger.error(`Failed to process EDI document: ${document.id}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  /**
   * Generate outbound EDI document
   */
  async generateOutboundDocument(
    tenantId: string,
    supplierId: string,
    documentType: EDIDocumentType,
    entityId: string,
  ): Promise<EDIDocument> {
    this.logger.log(`Generating outbound EDI document: ${documentType} for supplier: ${supplierId}`);

    const document: EDIDocument = {
      id: this.generateDocumentId(),
      tenantId,
      supplierId,
      documentType,
      direction: 'outbound',
      status: EDITransactionStatus.PROCESSING,
      rawContent: '',
      parsedContent: null,
      relatedEntityId: entityId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      // Get entity data and generate EDI content
      switch (documentType) {
        case EDIDocumentType.PURCHASE_ORDER:
          await this.generatePurchaseOrderEDI(tenantId, document, entityId);
          break;
        case EDIDocumentType.FUNCTIONAL_ACKNOWLEDGMENT:
          await this.generateFunctionalAcknowledgment(tenantId, document, entityId);
          break;
        default:
          throw new BadRequestException(`Unsupported outbound document type: ${documentType}`);
      }

      document.status = EDITransactionStatus.PROCESSED;
      document.processedAt = new Date();

      // Send the document to supplier
      await this.sendEDIDocument(tenantId, supplierId, document);

      this.logger.log(`Successfully generated and sent EDI document: ${document.id}`);
      return document;

    } catch (error) {
      document.status = EDITransactionStatus.FAILED;
      document.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      document.updatedAt = new Date();

      this.logger.error(`Failed to generate EDI document: ${document.id}`, error instanceof Error ? error.stack : error);
      throw error;
    }
  }

  /**
   * Configure EDI settings for a supplier
   */
  async configureSupplierEDI(
    tenantId: string,
    supplierId: string,
    configuration: EDIConfiguration,
  ): Promise<void> {
    // Validate supplier exists
    await this.supplierService.getSupplier(tenantId, supplierId);

    // Validate configuration
    this.validateEDIConfiguration(configuration);

    // Store configuration (in a real implementation, this would be stored in database)
    // For now, we'll just log it
    this.logger.log(`EDI configuration updated for supplier: ${supplierId}`);
  }

  /**
   * Configure supplier portal integration
   */
  async configureSupplierPortal(
    tenantId: string,
    supplierId: string,
    configuration: SupplierPortalConfiguration,
  ): Promise<void> {
    // Validate supplier exists
    await this.supplierService.getSupplier(tenantId, supplierId);

    // Validate portal configuration
    this.validatePortalConfiguration(configuration);

    // Store configuration
    this.logger.log(`Supplier portal configuration updated for supplier: ${supplierId}`);
  }

  /**
   * Sync data with supplier portal
   */
  async syncWithSupplierPortal(
    tenantId: string,
    supplierId: string,
  ): Promise<{
    ordersSync: { success: number; failed: number };
    shipmentsSync: { success: number; failed: number };
    invoicesSync: { success: number; failed: number };
  }> {
    this.logger.log(`Starting supplier portal sync for supplier: ${supplierId}`);

    // In a real implementation, this would:
    // 1. Get portal configuration
    // 2. Authenticate with supplier portal
    // 3. Sync various data types
    // 4. Handle errors and retries

    // Mock sync results
    const syncResults = {
      ordersSync: { success: 5, failed: 0 },
      shipmentsSync: { success: 3, failed: 1 },
      invoicesSync: { success: 2, failed: 0 },
    };

    this.logger.log(`Completed supplier portal sync for supplier: ${supplierId}`, syncResults);
    return syncResults;
  }

  /**
   * Handle webhook from supplier portal
   */
  async handleSupplierPortalWebhook(
    tenantId: string,
    supplierId: string,
    eventType: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(`Received supplier portal webhook: ${eventType} from supplier: ${supplierId}`);

    try {
      switch (eventType) {
        case 'order_acknowledged':
          await this.handleOrderAcknowledgment(tenantId, payload);
          break;
        case 'shipment_created':
          await this.handleShipmentNotification(tenantId, payload);
          break;
        case 'invoice_submitted':
          await this.handleInvoiceSubmission(tenantId, payload);
          break;
        case 'inventory_updated':
          await this.handleInventoryUpdate(tenantId, payload);
          break;
        default:
          this.logger.warn(`Unknown webhook event type: ${eventType}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process webhook: ${eventType}`, error instanceof Error ? error.stack : error);
      throw error;
    }
  }

  // Private helper methods

  private generateDocumentId(): string {
    return `EDI-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private async parseEDIDocument(documentType: EDIDocumentType, rawContent: string): Promise<any> {
    // In a real implementation, this would use an EDI parsing library
    // For now, we'll return a mock parsed structure
    return {
      documentType,
      segments: this.parseEDISegments(rawContent),
      parsedAt: new Date(),
    };
  }

  private parseEDISegments(rawContent: string): any[] {
    // Simple EDI segment parsing (in reality, this would be much more complex)
    const segments = rawContent.split('~').filter(segment => segment.trim());
    return segments.map(segment => {
      const elements = segment.split('*');
      return {
        tag: elements[0],
        elements: elements.slice(1),
      };
    });
  }

  private async processPurchaseOrderAcknowledgment(
    tenantId: string,
    document: EDIDocument,
  ): Promise<void> {
    // Extract PO number from parsed content
    const poNumber = this.extractPONumber(document.parsedContent);
    
    if (poNumber) {
      // Find and update the purchase order
      const purchaseOrder = await this.purchaseOrderService.getPurchaseOrderByPoNumber(tenantId, poNumber);
      
      if (purchaseOrder) {
        await this.purchaseOrderService.updatePurchaseOrder(
          tenantId,
          purchaseOrder.id,
          { status: PurchaseOrderStatus.ACKNOWLEDGED },
          'system',
        );
        
        document.relatedEntityId = purchaseOrder.id;
      }
    }
  }

  private async processAdvanceShipNotice(
    tenantId: string,
    document: EDIDocument,
  ): Promise<void> {
    // Extract shipment information and create receipt
    const shipmentInfo = this.extractShipmentInfo(document.parsedContent);
    
    if (shipmentInfo && shipmentInfo.poNumber) {
      const purchaseOrder = await this.purchaseOrderService.getPurchaseOrderByPoNumber(
        tenantId,
        shipmentInfo.poNumber,
      );
      
      if (purchaseOrder) {
        // Create receipt based on ASN
        const receiptData = this.convertASNToReceipt(shipmentInfo);
        await this.purchaseOrderService.createReceipt(tenantId, receiptData, 'system');
        
        document.relatedEntityId = purchaseOrder.id;
      }
    }
  }

  private async processEDIInvoice(
    tenantId: string,
    document: EDIDocument,
  ): Promise<void> {
    // Extract invoice information and create invoice
    const invoiceInfo = this.extractInvoiceInfo(document.parsedContent);
    
    if (invoiceInfo && invoiceInfo.poNumber) {
      const purchaseOrder = await this.purchaseOrderService.getPurchaseOrderByPoNumber(
        tenantId,
        invoiceInfo.poNumber,
      );
      
      if (purchaseOrder) {
        // Create invoice based on EDI
        const invoiceData = this.convertEDIToInvoice(invoiceInfo);
        await this.purchaseOrderService.createInvoice(tenantId, invoiceData, 'system');
        
        document.relatedEntityId = purchaseOrder.id;
      }
    }
  }

  private async processFunctionalAcknowledgment(
    tenantId: string,
    document: EDIDocument,
  ): Promise<void> {
    // Process 997 functional acknowledgment
    const ackInfo = this.extractAcknowledgmentInfo(document.parsedContent);
    
    if (ackInfo) {
      // Update the status of the original document
      this.logger.log(`Received functional acknowledgment for document: ${ackInfo.originalDocumentId}`);
    }
  }

  private async generatePurchaseOrderEDI(
    tenantId: string,
    document: EDIDocument,
    purchaseOrderId: string,
  ): Promise<void> {
    // Get purchase order data
    const poData = await this.purchaseOrderService.getPurchaseOrderWithRelations(tenantId, purchaseOrderId);
    
    // Convert to EDI format
    const ediContent = this.convertPOToEDI(poData);
    
    document.parsedContent = ediContent;
    document.rawContent = this.generateEDIString(ediContent);
  }

  private async generateFunctionalAcknowledgment(
    tenantId: string,
    document: EDIDocument,
    originalDocumentId: string,
  ): Promise<void> {
    // Generate 997 functional acknowledgment
    const ackContent = {
      documentType: EDIDocumentType.FUNCTIONAL_ACKNOWLEDGMENT,
      originalDocumentId,
      status: 'accepted',
      generatedAt: new Date(),
    };
    
    document.parsedContent = ackContent;
    document.rawContent = this.generateEDIString(ackContent);
  }

  private async sendEDIDocument(
    tenantId: string,
    supplierId: string,
    document: EDIDocument,
  ): Promise<void> {
    // In a real implementation, this would:
    // 1. Get supplier EDI configuration
    // 2. Send via appropriate method (AS2, SFTP, API, etc.)
    // 3. Handle delivery confirmations
    
    this.logger.log(`Sending EDI document ${document.id} to supplier ${supplierId}`);
    
    // Mock successful send
    document.status = EDITransactionStatus.ACKNOWLEDGED;
    document.acknowledgedAt = new Date();
  }

  private validateEDIConfiguration(configuration: EDIConfiguration): void {
    if (!configuration.supplierId) {
      throw new BadRequestException('Supplier ID is required');
    }
    
    if (!configuration.tradingPartnerInfo.gsId) {
      throw new BadRequestException('Group Sender ID is required');
    }
    
    // Add more validation as needed
  }

  private validatePortalConfiguration(configuration: SupplierPortalConfiguration): void {
    if (!configuration.supplierId) {
      throw new BadRequestException('Supplier ID is required');
    }
    
    if (!configuration.portalUrl) {
      throw new BadRequestException('Portal URL is required');
    }
    
    // Add more validation as needed
  }

  // Helper methods for data extraction and conversion
  private extractPONumber(parsedContent: any): string | null {
    // Extract PO number from parsed EDI content
    return parsedContent?.segments?.find((s: any) => s.tag === 'BEG')?.elements?.[2] || null;
  }

  private extractShipmentInfo(parsedContent: any): any {
    // Extract shipment information from ASN
    return {
      poNumber: this.extractPONumber(parsedContent),
      trackingNumber: parsedContent?.segments?.find((s: any) => s.tag === 'REF')?.elements?.[1],
      shipDate: parsedContent?.segments?.find((s: any) => s.tag === 'DTM')?.elements?.[1],
      items: [], // Would extract item details
    };
  }

  private extractInvoiceInfo(parsedContent: any): any {
    // Extract invoice information from EDI invoice
    return {
      poNumber: this.extractPONumber(parsedContent),
      invoiceNumber: parsedContent?.segments?.find((s: any) => s.tag === 'BIG')?.elements?.[1],
      invoiceDate: parsedContent?.segments?.find((s: any) => s.tag === 'BIG')?.elements?.[2],
      amount: parsedContent?.segments?.find((s: any) => s.tag === 'TDS')?.elements?.[1],
      items: [], // Would extract item details
    };
  }

  private extractAcknowledgmentInfo(parsedContent: any): any {
    // Extract acknowledgment information
    return {
      originalDocumentId: parsedContent?.segments?.find((s: any) => s.tag === 'AK1')?.elements?.[1],
      status: parsedContent?.segments?.find((s: any) => s.tag === 'AK9')?.elements?.[1],
    };
  }

  private convertASNToReceipt(shipmentInfo: any): any {
    // Convert ASN data to receipt format
    return {
      purchaseOrderId: '', // Would be resolved from PO number
      receiptDate: shipmentInfo.shipDate,
      trackingNumber: shipmentInfo.trackingNumber,
      items: shipmentInfo.items.map((item: any) => ({
        purchaseOrderItemId: item.poItemId,
        quantityReceived: item.quantity,
        quantityAccepted: item.quantity,
      })),
    };
  }

  private convertEDIToInvoice(invoiceInfo: any): any {
    // Convert EDI invoice to invoice format
    return {
      purchaseOrderId: '', // Would be resolved from PO number
      invoiceNumber: invoiceInfo.invoiceNumber,
      invoiceDate: invoiceInfo.invoiceDate,
      invoiceAmount: parseFloat(invoiceInfo.amount),
      items: invoiceInfo.items.map((item: any) => ({
        purchaseOrderItemId: item.poItemId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    };
  }

  private convertPOToEDI(poData: any): PurchaseOrderEDI {
    // Convert purchase order to EDI format
    return {
      poNumber: poData.purchaseOrder.poNumber,
      orderDate: poData.purchaseOrder.orderDate,
      requestedDeliveryDate: poData.purchaseOrder.requestedDeliveryDate,
      supplier: {
        id: poData.purchaseOrder.supplierId,
        name: 'Supplier Name', // Would be fetched
        address: poData.purchaseOrder.deliveryAddress,
      },
      buyer: {
        name: 'Buyer Name',
        address: poData.purchaseOrder.billingAddress,
      },
      items: poData.items?.map((item: any, index: number) => ({
        lineNumber: index + 1,
        productId: item.productId,
        sku: item.sku,
        description: item.itemDescription,
        quantity: parseFloat(item.quantityOrdered),
        unitPrice: parseFloat(item.unitPrice),
        uom: 'EA', // Each
        requestedDeliveryDate: item.requestedDeliveryDate,
      })) || [],
      totals: {
        subtotal: parseFloat(poData.purchaseOrder.subtotal),
        tax: parseFloat(poData.purchaseOrder.taxAmount),
        shipping: parseFloat(poData.purchaseOrder.shippingAmount),
        total: parseFloat(poData.purchaseOrder.totalAmount),
      },
      terms: {
        payment: poData.purchaseOrder.paymentTerms,
        delivery: poData.purchaseOrder.deliveryTerms,
        shipping: poData.purchaseOrder.shippingMethod,
      },
    };
  }

  private generateEDIString(_content: any): string {
    // Generate EDI X12 format string
    // This is a simplified version - real EDI generation is much more complex
    return `ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *${new Date().toISOString().slice(0, 6)}*${new Date().toTimeString().slice(0, 4)}*U*00401*000000001*0*P*>~`;
  }

  // Webhook handlers
  private async handleOrderAcknowledgment(tenantId: string, payload: any): Promise<void> {
    const poNumber = payload.orderNumber;
    if (poNumber) {
      const purchaseOrder = await this.purchaseOrderService.getPurchaseOrderByPoNumber(tenantId, poNumber);
      if (purchaseOrder) {
        await this.purchaseOrderService.updatePurchaseOrder(
          tenantId,
          purchaseOrder.id,
          { status: PurchaseOrderStatus.ACKNOWLEDGED },
          'system',
        );
      }
    }
  }

  private async handleShipmentNotification(_tenantId: string, payload: any): Promise<void> {
    // Handle shipment notification from supplier portal
    this.logger.log('Processing shipment notification', payload);
  }

  private async handleInvoiceSubmission(_tenantId: string, payload: any): Promise<void> {
    // Handle invoice submission from supplier portal
    this.logger.log('Processing invoice submission', payload);
  }

  private async handleInventoryUpdate(_tenantId: string, payload: any): Promise<void> {
    // Handle inventory update from supplier portal
    this.logger.log('Processing inventory update', payload);
  }
}