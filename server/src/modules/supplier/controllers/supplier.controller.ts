import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SupplierService } from '../services/supplier.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  SupplierQueryDto,
  SupplierResponseDto,
  CreateSupplierContactDto,
  UpdateSupplierContactDto,
  CreateSupplierCommunicationDto,
  CreateSupplierEvaluationDto,
} from '../dto/supplier.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/suppliers')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('supplier-management')
@ApiBearerAuth()
@ApiTags('Suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Post()
  @RequirePermission('suppliers:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new supplier' })
  @ApiResponse({ status: 201, description: 'Supplier created successfully', type: SupplierResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Supplier code already exists' })
  async createSupplier(
    @Body() createSupplierDto: CreateSupplierDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.supplierService.createSupplier(tenantId, createSupplierDto, user.id);
  }

  @Get()
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get suppliers with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Suppliers retrieved successfully' })
  async getSuppliers(
    @Query() query: SupplierQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.supplierService.getSuppliers(tenantId, query);
  }

  @Get('stats')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get supplier statistics' })
  @ApiResponse({ status: 200, description: 'Supplier statistics retrieved successfully' })
  async getSupplierStats(@CurrentTenant() tenantId: string) {
    return await this.supplierService.getSupplierStats(tenantId);
  }

  @Get('preferred')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get preferred suppliers' })
  @ApiResponse({ status: 200, description: 'Preferred suppliers retrieved successfully' })
  async getPreferredSuppliers(@CurrentTenant() tenantId: string) {
    return await this.supplierService.getPreferredSuppliers(tenantId);
  }

  @Get('search')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Search suppliers' })
  @ApiQuery({ name: 'q', description: 'Search term' })
  @ApiQuery({ name: 'limit', description: 'Limit results', required: false })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  async searchSuppliers(
    @CurrentTenant() tenantId: string,
    @Query('q') searchTerm: string,
    @Query('limit') limit?: number,
  ) {
    return await this.supplierService.searchSuppliers(tenantId, searchTerm, limit);
  }

  @Get(':id')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get supplier by ID' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiQuery({ name: 'include', description: 'Include relations', required: false })
  @ApiResponse({ status: 200, description: 'Supplier retrieved successfully', type: SupplierResponseDto })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  async getSupplier(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('include') include?: string,
  ) {
    const includeRelations = include === 'relations';
    
    if (includeRelations) {
      return await this.supplierService.getSupplierWithRelations(tenantId, id);
    }
    
    return await this.supplierService.getSupplier(tenantId, id);
  }

  @Put(':id')
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Update supplier' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiResponse({ status: 200, description: 'Supplier updated successfully', type: SupplierResponseDto })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  async updateSupplier(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.supplierService.updateSupplier(tenantId, id, updateSupplierDto, user.id);
  }

  @Delete(':id')
  @RequirePermission('suppliers:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete supplier' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiResponse({ status: 204, description: 'Supplier deleted successfully' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  async deleteSupplier(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.supplierService.deleteSupplier(tenantId, id, user.id);
  }

  // Supplier Contacts
  @Post(':id/contacts')
  @RequirePermission('suppliers:update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create supplier contact' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiResponse({ status: 201, description: 'Contact created successfully' })
  async createSupplierContact(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) supplierId: string,
    @Body() createContactDto: CreateSupplierContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.supplierService.createSupplierContact(
      tenantId,
      supplierId,
      createContactDto,
      user.id,
    );
  }

  @Get(':id/contacts')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get supplier contacts' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiResponse({ status: 200, description: 'Contacts retrieved successfully' })
  async getSupplierContacts(
    @Param('id', ParseUUIDPipe) supplierId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.supplierService.getSupplierContacts(tenantId, supplierId);
  }

  @Put('contacts/:contactId')
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Update supplier contact' })
  @ApiParam({ name: 'contactId', description: 'Contact ID' })
  @ApiResponse({ status: 200, description: 'Contact updated successfully' })
  async updateSupplierContact(
    @CurrentTenant() tenantId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() updateContactDto: UpdateSupplierContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.supplierService.updateSupplierContact(
      tenantId,
      contactId,
      updateContactDto,
      user.id,
    );
  }

  @Delete('contacts/:contactId')
  @RequirePermission('suppliers:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete supplier contact' })
  @ApiParam({ name: 'contactId', description: 'Contact ID' })
  @ApiResponse({ status: 204, description: 'Contact deleted successfully' })
  async deleteSupplierContact(
    @CurrentTenant() tenantId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.supplierService.deleteSupplierContact(tenantId, contactId, user.id);
  }

  @Put('contacts/:contactId/primary')
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Set contact as primary' })
  @ApiParam({ name: 'contactId', description: 'Contact ID' })
  @ApiResponse({ status: 200, description: 'Primary contact set successfully' })
  async setPrimaryContact(
    @CurrentTenant() tenantId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.supplierService.setPrimaryContact(tenantId, contactId, user.id);
  }

  // Communications
  @Post('communications')
  @RequirePermission('suppliers:update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create supplier communication' })
  @ApiResponse({ status: 201, description: 'Communication created successfully' })
  async createCommunication(
    @Body() createCommunicationDto: CreateSupplierCommunicationDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.supplierService.createCommunication(tenantId, createCommunicationDto, user.id);
  }

  @Get(':id/communications')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get supplier communications' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiQuery({ name: 'limit', description: 'Limit results', required: false })
  @ApiQuery({ name: 'offset', description: 'Offset results', required: false })
  @ApiResponse({ status: 200, description: 'Communications retrieved successfully' })
  async getSupplierCommunications(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) supplierId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return await this.supplierService.getSupplierCommunications(
      tenantId,
      supplierId,
      limit,
      offset,
    );
  }

  @Get('communications/pending-followups')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get pending follow-ups' })
  @ApiQuery({ name: 'before', description: 'Before date', required: false })
  @ApiResponse({ status: 200, description: 'Pending follow-ups retrieved successfully' })
  async getPendingFollowUps(
    @CurrentTenant() tenantId: string,
    @Query('before') before?: string,
  ) {
    const beforeDate = before ? new Date(before) : undefined;
    return await this.supplierService.getPendingFollowUps(tenantId, beforeDate);
  }

  @Put('communications/:communicationId/complete-followup')
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Mark follow-up as complete' })
  @ApiParam({ name: 'communicationId', description: 'Communication ID' })
  @ApiResponse({ status: 200, description: 'Follow-up marked as complete' })
  async markFollowUpComplete(
    @CurrentTenant() tenantId: string,
    @Param('communicationId', ParseUUIDPipe) communicationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.supplierService.markFollowUpComplete(tenantId, communicationId, user.id);
  }

  // Evaluations
  @Post('evaluations')
  @RequirePermission('suppliers:evaluate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create supplier evaluation' })
  @ApiResponse({ status: 201, description: 'Evaluation created successfully' })
  async createEvaluation(
    @Body() createEvaluationDto: CreateSupplierEvaluationDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.supplierService.createEvaluation(tenantId, createEvaluationDto, user.id);
  }

  @Get(':id/evaluations')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get supplier evaluations' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiQuery({ name: 'limit', description: 'Limit results', required: false })
  @ApiQuery({ name: 'offset', description: 'Offset results', required: false })
  @ApiResponse({ status: 200, description: 'Evaluations retrieved successfully' })
  async getSupplierEvaluations(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) supplierId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return await this.supplierService.getSupplierEvaluations(tenantId, supplierId, limit, offset);
  }

  @Get(':id/evaluations/latest')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get latest supplier evaluation' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiResponse({ status: 200, description: 'Latest evaluation retrieved successfully' })
  async getLatestEvaluation(
    @Param('id', ParseUUIDPipe) supplierId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.supplierService.getLatestEvaluation(tenantId, supplierId);
  }

  @Get('evaluations/pending')
  @RequirePermission('suppliers:approve')
  @ApiOperation({ summary: 'Get pending evaluations' })
  @ApiResponse({ status: 200, description: 'Pending evaluations retrieved successfully' })
  async getPendingEvaluations(@CurrentTenant() tenantId: string) {
    return await this.supplierService.getPendingEvaluations(tenantId);
  }

  @Put('evaluations/:evaluationId/approve')
  @RequirePermission('suppliers:approve')
  @ApiOperation({ summary: 'Approve supplier evaluation' })
  @ApiParam({ name: 'evaluationId', description: 'Evaluation ID' })
  @ApiResponse({ status: 200, description: 'Evaluation approved successfully' })
  async approveEvaluation(
    @CurrentTenant() tenantId: string,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.supplierService.approveEvaluation(tenantId, evaluationId, user.id);
  }

  @Put('evaluations/:evaluationId/reject')
  @RequirePermission('suppliers:approve')
  @ApiOperation({ summary: 'Reject supplier evaluation' })
  @ApiParam({ name: 'evaluationId', description: 'Evaluation ID' })
  @ApiResponse({ status: 200, description: 'Evaluation rejected successfully' })
  async rejectEvaluation(
    @CurrentTenant() tenantId: string,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.supplierService.rejectEvaluation(tenantId, evaluationId, user.id);
  }

  // Analytics and Reporting
  @Get(':id/performance')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get supplier performance metrics' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiQuery({ name: 'startDate', description: 'Start date', required: false })
  @ApiQuery({ name: 'endDate', description: 'End date', required: false })
  @ApiResponse({ status: 200, description: 'Performance metrics retrieved successfully' })
  async getSupplierPerformance(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) supplierId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return await this.supplierService.calculateSupplierPerformanceScore(
      tenantId,
      supplierId,
      start,
      end,
    );
  }

  @Get(':id/trends')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get supplier performance trends' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiQuery({ name: 'months', description: 'Number of months', required: false })
  @ApiResponse({ status: 200, description: 'Performance trends retrieved successfully' })
  async getSupplierTrends(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) supplierId: string,
    @Query('months') months?: number,
  ) {
    return await this.supplierService.getSupplierTrends(tenantId, supplierId, months);
  }

  @Get('analytics/evaluation-stats')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get evaluation statistics' })
  @ApiQuery({ name: 'supplierId', description: 'Supplier ID', required: false })
  @ApiQuery({ name: 'startDate', description: 'Start date', required: false })
  @ApiQuery({ name: 'endDate', description: 'End date', required: false })
  @ApiResponse({ status: 200, description: 'Evaluation statistics retrieved successfully' })
  async getEvaluationStats(
    @CurrentTenant() tenantId: string,
    @Query('supplierId') supplierId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return await this.supplierService.getEvaluationStats(tenantId, supplierId, start, end);
  }

  @Get('analytics/communication-stats')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get communication statistics' })
  @ApiQuery({ name: 'supplierId', description: 'Supplier ID', required: false })
  @ApiQuery({ name: 'startDate', description: 'Start date', required: false })
  @ApiQuery({ name: 'endDate', description: 'End date', required: false })
  @ApiResponse({ status: 200, description: 'Communication statistics retrieved successfully' })
  async getCommunicationStats(
    @CurrentTenant() tenantId: string,
    @Query('supplierId') supplierId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return await this.supplierService.getCommunicationStats(tenantId, supplierId, start, end);
  }
}