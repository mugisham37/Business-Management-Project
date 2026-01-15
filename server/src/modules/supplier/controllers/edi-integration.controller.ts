import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsObject } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { CurrentTenant, CurrentUser } from '../../auth/decorators/auth.decorators';
import { 
  EDIIntegrationService, 
  EDIDocumentType, 
  EDIConfiguration, 
  SupplierPortalConfiguration 
} from '../services/edi-integration.service';

// DTOs for API requests
export class ProcessEDIDocumentDto {
  @ApiProperty({ enum: EDIDocumentType })
  @IsEnum(EDIDocumentType)
  documentType!: EDIDocumentType;

  @ApiProperty()
  @IsString()
  rawContent!: string;
}

export class GenerateEDIDocumentDto {
  @ApiProperty({ enum: EDIDocumentType })
  @IsEnum(EDIDocumentType)
  documentType!: EDIDocumentType;

  @ApiProperty()
  @IsString()
  entityId!: string; // PO ID, Invoice ID, etc.
}

export class SupplierPortalWebhookDto {
  @ApiProperty()
  @IsString()
  eventType!: string;

  @ApiProperty()
  @IsObject()
  payload!: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  signature?: string;
}

@Controller('api/v1/supplier/edi')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('edi-integration')
@ApiTags('EDI Integration')
export class EDIIntegrationController {
  constructor(
    private readonly ediIntegrationService: EDIIntegrationService,
  ) {}

  @Post(':supplierId/documents/inbound')
  @ApiOperation({ summary: 'Process inbound EDI document' })
  @ApiResponse({ status: 200, description: 'EDI document processed successfully' })
  @ApiParam({ name: 'supplierId', type: 'string', description: 'Supplier ID' })
  @ApiBody({ type: ProcessEDIDocumentDto })
  async processInboundDocument(
    @CurrentTenant() tenantId: string,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Body() dto: ProcessEDIDocumentDto,
  ) {
    return await this.ediIntegrationService.processInboundDocument(
      tenantId,
      supplierId,
      dto.documentType,
      dto.rawContent,
    );
  }

  @Post(':supplierId/documents/outbound')
  @ApiOperation({ summary: 'Generate and send outbound EDI document' })
  @ApiResponse({ status: 200, description: 'EDI document generated and sent successfully' })
  @ApiParam({ name: 'supplierId', type: 'string', description: 'Supplier ID' })
  @ApiBody({ type: GenerateEDIDocumentDto })
  async generateOutboundDocument(
    @CurrentTenant() tenantId: string,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Body() dto: GenerateEDIDocumentDto,
  ) {
    return await this.ediIntegrationService.generateOutboundDocument(
      tenantId,
      supplierId,
      dto.documentType,
      dto.entityId,
    );
  }

  @Put(':supplierId/configuration')
  @ApiOperation({ summary: 'Configure EDI settings for supplier' })
  @ApiResponse({ status: 200, description: 'EDI configuration updated successfully' })
  @ApiParam({ name: 'supplierId', type: 'string', description: 'Supplier ID' })
  @HttpCode(HttpStatus.OK)
  async configureSupplierEDI(
    @CurrentTenant() tenantId: string,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Body() configuration: EDIConfiguration,
  ) {
    await this.ediIntegrationService.configureSupplierEDI(
      tenantId,
      supplierId,
      configuration,
    );
    
    return { message: 'EDI configuration updated successfully' };
  }

  @Put(':supplierId/portal-configuration')
  @ApiOperation({ summary: 'Configure supplier portal integration' })
  @ApiResponse({ status: 200, description: 'Supplier portal configuration updated successfully' })
  @ApiParam({ name: 'supplierId', type: 'string', description: 'Supplier ID' })
  @HttpCode(HttpStatus.OK)
  async configureSupplierPortal(
    @CurrentTenant() tenantId: string,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Body() configuration: SupplierPortalConfiguration,
  ) {
    await this.ediIntegrationService.configureSupplierPortal(
      tenantId,
      supplierId,
      configuration,
    );
    
    return { message: 'Supplier portal configuration updated successfully' };
  }

  @Post(':supplierId/portal/sync')
  @ApiOperation({ summary: 'Sync data with supplier portal' })
  @ApiResponse({ status: 200, description: 'Supplier portal sync completed successfully' })
  @ApiParam({ name: 'supplierId', type: 'string', description: 'Supplier ID' })
  async syncWithSupplierPortal(
    @CurrentTenant() tenantId: string,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
  ) {
    const syncResults = await this.ediIntegrationService.syncWithSupplierPortal(
      tenantId,
      supplierId,
    );
    
    return {
      message: 'Supplier portal sync completed',
      results: syncResults,
    };
  }

  @Post(':supplierId/portal/webhook')
  @ApiOperation({ summary: 'Handle webhook from supplier portal' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiParam({ name: 'supplierId', type: 'string', description: 'Supplier ID' })
  @ApiBody({ type: SupplierPortalWebhookDto })
  @HttpCode(HttpStatus.OK)
  async handleSupplierPortalWebhook(
    @CurrentTenant() tenantId: string,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Body() dto: SupplierPortalWebhookDto,
  ) {
    await this.ediIntegrationService.handleSupplierPortalWebhook(
      tenantId,
      supplierId,
      dto.eventType,
      dto.payload,
    );
    
    return { message: 'Webhook processed successfully' };
  }

  @Get(':supplierId/documents')
  @ApiOperation({ summary: 'Get EDI documents for supplier' })
  @ApiResponse({ status: 200, description: 'EDI documents retrieved successfully' })
  @ApiParam({ name: 'supplierId', type: 'string', description: 'Supplier ID' })
  async getEDIDocuments(
    @CurrentTenant() tenantId: string,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Query('documentType') _documentType?: EDIDocumentType,
    @Query('direction') _direction?: 'inbound' | 'outbound',
    @Query('status') _status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    // In a real implementation, this would query the database for EDI documents
    // For now, return mock data
    return {
      documents: [
        {
          id: 'edi-doc-1',
          tenantId,
          supplierId,
          documentType: EDIDocumentType.PURCHASE_ORDER,
          direction: 'outbound',
          status: 'processed',
          createdAt: new Date(),
          processedAt: new Date(),
        },
        {
          id: 'edi-doc-2',
          tenantId,
          supplierId,
          documentType: EDIDocumentType.PURCHASE_ORDER_ACKNOWLEDGMENT,
          direction: 'inbound',
          status: 'processed',
          createdAt: new Date(),
          processedAt: new Date(),
        },
      ],
      total: 2,
      limit: limit || 20,
      offset: offset || 0,
    };
  }

  @Get(':supplierId/documents/:documentId')
  @ApiOperation({ summary: 'Get specific EDI document' })
  @ApiResponse({ status: 200, description: 'EDI document retrieved successfully' })
  @ApiParam({ name: 'supplierId', type: 'string', description: 'Supplier ID' })
  @ApiParam({ name: 'documentId', type: 'string', description: 'Document ID' })
  async getEDIDocument(
    @CurrentTenant() tenantId: string,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('documentId') documentId: string,
  ) {
    // In a real implementation, this would query the database for the specific document
    return {
      id: documentId,
      tenantId,
      supplierId,
      documentType: EDIDocumentType.PURCHASE_ORDER,
      direction: 'outbound',
      status: 'processed',
      rawContent: 'ISA*00*...',
      parsedContent: {
        poNumber: 'PO202401001',
        orderDate: new Date(),
        items: [],
      },
      createdAt: new Date(),
      processedAt: new Date(),
    };
  }

  @Get(':supplierId/configuration')
  @ApiOperation({ summary: 'Get EDI configuration for supplier' })
  @ApiResponse({ status: 200, description: 'EDI configuration retrieved successfully' })
  @ApiParam({ name: 'supplierId', type: 'string', description: 'Supplier ID' })
  async getSupplierEDIConfiguration(
    @CurrentTenant() _tenantId: string,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
  ) {
    // In a real implementation, this would query the database for the configuration
    return {
      supplierId,
      isEnabled: true,
      connectionType: 'as2',
      connectionSettings: {
        endpoint: 'https://supplier.example.com/edi',
        partnerAs2Id: 'SUPPLIER_AS2_ID',
        ownAs2Id: 'OUR_AS2_ID',
      },
      documentMappings: {
        [EDIDocumentType.PURCHASE_ORDER]: {
          enabled: true,
          autoProcess: true,
        },
        [EDIDocumentType.PURCHASE_ORDER_ACKNOWLEDGMENT]: {
          enabled: true,
          autoProcess: true,
        },
      },
      tradingPartnerInfo: {
        gsId: 'SUPPLIER_GS_ID',
        grId: 'OUR_GS_ID',
        isId: 'SUPPLIER_IS_ID',
        irId: 'OUR_IS_ID',
      },
    };
  }

  @Get(':supplierId/portal-configuration')
  @ApiOperation({ summary: 'Get supplier portal configuration' })
  @ApiResponse({ status: 200, description: 'Supplier portal configuration retrieved successfully' })
  @ApiParam({ name: 'supplierId', type: 'string', description: 'Supplier ID' })
  async getSupplierPortalConfiguration(
    @CurrentTenant() _tenantId: string,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
  ) {
    // In a real implementation, this would query the database for the configuration
    return {
      supplierId,
      isEnabled: true,
      portalUrl: 'https://supplier.example.com/portal',
      apiEndpoints: {
        orders: '/api/orders',
        acknowledgments: '/api/acknowledgments',
        shipments: '/api/shipments',
        invoices: '/api/invoices',
        inventory: '/api/inventory',
      },
      authentication: {
        type: 'api_key',
        credentials: {
          apiKey: '***masked***',
        },
      },
      syncSettings: {
        autoSync: true,
        syncInterval: 60,
        lastSyncAt: new Date(),
      },
      webhookSettings: {
        enabled: true,
        webhookUrl: 'https://our-system.com/webhooks/supplier-portal',
        events: ['order_acknowledged', 'shipment_created', 'invoice_submitted'],
      },
    };
  }

  @Get(':supplierId/sync-status')
  @ApiOperation({ summary: 'Get supplier portal sync status' })
  @ApiResponse({ status: 200, description: 'Sync status retrieved successfully' })
  @ApiParam({ name: 'supplierId', type: 'string', description: 'Supplier ID' })
  async getSupplierSyncStatus(
    @CurrentTenant() _tenantId: string,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
  ) {
    // In a real implementation, this would query the database for sync status
    return {
      supplierId,
      lastSyncAt: new Date(),
      nextSyncAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      syncStatus: 'completed',
      lastSyncResults: {
        ordersSync: { success: 5, failed: 0 },
        shipmentsSync: { success: 3, failed: 1 },
        invoicesSync: { success: 2, failed: 0 },
      },
      errors: [],
      isAutoSyncEnabled: true,
    };
  }

  @Post('purchase-orders/:purchaseOrderId/send-edi')
  @ApiOperation({ summary: 'Send purchase order via EDI' })
  @ApiResponse({ status: 200, description: 'Purchase order sent via EDI successfully' })
  @ApiParam({ name: 'purchaseOrderId', type: 'string', description: 'Purchase Order ID' })
  async sendPurchaseOrderEDI(
    @CurrentTenant() tenantId: string,
    @Param('purchaseOrderId', ParseUUIDPipe) purchaseOrderId: string,
    @CurrentUser() _user: any,
  ) {
    // Get the purchase order to find the supplier
    // In a real implementation, this would be done properly
    const supplierId = 'supplier-id'; // Would be extracted from PO
    
    const document = await this.ediIntegrationService.generateOutboundDocument(
      tenantId,
      supplierId,
      EDIDocumentType.PURCHASE_ORDER,
      purchaseOrderId,
    );
    
    return {
      message: 'Purchase order sent via EDI successfully',
      documentId: document.id,
      status: document.status,
    };
  }

  @Get('document-types')
  @ApiOperation({ summary: 'Get supported EDI document types' })
  @ApiResponse({ status: 200, description: 'Supported document types retrieved successfully' })
  async getSupportedDocumentTypes() {
    return {
      inbound: [
        {
          type: EDIDocumentType.PURCHASE_ORDER_ACKNOWLEDGMENT,
          name: 'Purchase Order Acknowledgment',
          description: 'Supplier acknowledgment of purchase order',
        },
        {
          type: EDIDocumentType.ADVANCE_SHIP_NOTICE,
          name: 'Advance Ship Notice',
          description: 'Notification of shipment from supplier',
        },
        {
          type: EDIDocumentType.INVOICE,
          name: 'Invoice',
          description: 'Supplier invoice for goods/services',
        },
        {
          type: EDIDocumentType.FUNCTIONAL_ACKNOWLEDGMENT,
          name: 'Functional Acknowledgment',
          description: 'Technical acknowledgment of EDI document receipt',
        },
      ],
      outbound: [
        {
          type: EDIDocumentType.PURCHASE_ORDER,
          name: 'Purchase Order',
          description: 'Purchase order sent to supplier',
        },
        {
          type: EDIDocumentType.FUNCTIONAL_ACKNOWLEDGMENT,
          name: 'Functional Acknowledgment',
          description: 'Technical acknowledgment of EDI document receipt',
        },
      ],
    };
  }

  @Get('connection-types')
  @ApiOperation({ summary: 'Get supported EDI connection types' })
  @ApiResponse({ status: 200, description: 'Supported connection types retrieved successfully' })
  async getSupportedConnectionTypes() {
    return {
      connectionTypes: [
        {
          type: 'as2',
          name: 'AS2 (Applicability Statement 2)',
          description: 'Secure, reliable EDI transmission over HTTP/HTTPS',
          features: ['Encryption', 'Digital Signatures', 'Message Disposition Notifications'],
        },
        {
          type: 'sftp',
          name: 'SFTP (Secure File Transfer Protocol)',
          description: 'Secure file transfer over SSH',
          features: ['File-based exchange', 'Secure authentication', 'Directory monitoring'],
        },
        {
          type: 'api',
          name: 'REST API',
          description: 'Modern API-based integration',
          features: ['Real-time processing', 'JSON format', 'Webhook support'],
        },
        {
          type: 'van',
          name: 'VAN (Value Added Network)',
          description: 'Third-party EDI network service',
          features: ['Managed service', 'Multiple protocols', 'Trading partner management'],
        },
      ],
    };
  }
}