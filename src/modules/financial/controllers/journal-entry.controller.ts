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
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { JournalEntryService } from '../services/journal-entry.service';
import {
  CreateJournalEntryDto,
  UpdateJournalEntryDto,
  JournalEntryResponseDto,
  JournalEntryQueryDto,
  PostJournalEntryDto,
  ReverseJournalEntryDto,
  JournalEntryStatus,
} from '../dto/journal-entry.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/financial/journal-entries')
@UseGuards(AuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('financial-management')
@ApiTags('Financial')
export class JournalEntryController {
  constructor(private readonly journalEntryService: JournalEntryService) {}

  @Post()
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Create a new journal entry' })
  @ApiResponse({ status: 201, description: 'Journal entry created successfully', type: JournalEntryResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async createJournalEntry(
    @Body() dto: CreateJournalEntryDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JournalEntryResponseDto> {
    return await this.journalEntryService.createJournalEntry(tenantId, dto, user.id);
  }

  @Get()
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get all journal entries' })
  @ApiQuery({ name: 'status', enum: JournalEntryStatus, required: false })
  @ApiQuery({ name: 'accountId', type: String, required: false })
  @ApiQuery({ name: 'sourceType', type: String, required: false })
  @ApiQuery({ name: 'dateFrom', type: String, required: false })
  @ApiQuery({ name: 'dateTo', type: String, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'Journal entries retrieved successfully', type: [JournalEntryResponseDto] })
  async getAllJournalEntries(
    @CurrentTenant() tenantId: string,
    @Query() query: JournalEntryQueryDto,
  ): Promise<JournalEntryResponseDto[]> {
    return await this.journalEntryService.findAllJournalEntries(tenantId, query);
  }

  @Get('by-account/:accountId')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get journal entries by account' })
  @ApiParam({ name: 'accountId', description: 'Account ID' })
  @ApiQuery({ name: 'dateFrom', type: String, required: false })
  @ApiQuery({ name: 'dateTo', type: String, required: false })
  @ApiQuery({ name: 'status', enum: JournalEntryStatus, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'Journal entries retrieved successfully', type: [JournalEntryResponseDto] })
  async getJournalEntriesByAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @CurrentTenant() tenantId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: JournalEntryStatus,
    @Query('limit') limit?: number,
  ): Promise<JournalEntryResponseDto[]> {
    const options = {
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      status,
      limit,
    };
    return await this.journalEntryService.findJournalEntriesByAccount(tenantId, accountId, options);
  }

  @Get(':id')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get journal entry by ID' })
  @ApiParam({ name: 'id', description: 'Journal entry ID' })
  @ApiResponse({ status: 200, description: 'Journal entry retrieved successfully', type: JournalEntryResponseDto })
  @ApiResponse({ status: 404, description: 'Journal entry not found' })
  async getJournalEntryById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<JournalEntryResponseDto> {
    return await this.journalEntryService.findJournalEntryById(tenantId, id);
  }

  @Get(':id/ledger/:accountId')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get account ledger' })
  @ApiParam({ name: 'id', description: 'Journal entry ID (not used, for consistency)' })
  @ApiParam({ name: 'accountId', description: 'Account ID' })
  @ApiQuery({ name: 'dateFrom', type: String, required: false })
  @ApiQuery({ name: 'dateTo', type: String, required: false })
  @ApiQuery({ name: 'includeUnposted', type: Boolean, required: false })
  @ApiResponse({ status: 200, description: 'Account ledger retrieved successfully' })
  async getAccountLedger(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @CurrentTenant() tenantId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('includeUnposted') includeUnposted?: boolean,
  ) {
    const options = {
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      includeUnposted,
    };
    return await this.journalEntryService.getAccountLedger(tenantId, accountId, options);
  }

  @Put(':id')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Update journal entry' })
  @ApiParam({ name: 'id', description: 'Journal entry ID' })
  @ApiResponse({ status: 200, description: 'Journal entry updated successfully', type: JournalEntryResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data or entry cannot be updated' })
  @ApiResponse({ status: 404, description: 'Journal entry not found' })
  async updateJournalEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJournalEntryDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JournalEntryResponseDto> {
    return await this.journalEntryService.updateJournalEntry(tenantId, id, dto, user.id);
  }

  @Post(':id/post')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Post journal entry' })
  @ApiParam({ name: 'id', description: 'Journal entry ID' })
  @ApiBody({ type: PostJournalEntryDto, required: false })
  @ApiResponse({ status: 200, description: 'Journal entry posted successfully', type: JournalEntryResponseDto })
  @ApiResponse({ status: 400, description: 'Entry cannot be posted' })
  @ApiResponse({ status: 404, description: 'Journal entry not found' })
  async postJournalEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PostJournalEntryDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JournalEntryResponseDto> {
    const postingDate = dto.postingDate ? new Date(dto.postingDate) : undefined;
    return await this.journalEntryService.postJournalEntry(tenantId, id, user.id, postingDate);
  }

  @Post(':id/reverse')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Reverse journal entry' })
  @ApiParam({ name: 'id', description: 'Journal entry ID' })
  @ApiBody({ type: ReverseJournalEntryDto })
  @ApiResponse({ status: 201, description: 'Journal entry reversed successfully', type: JournalEntryResponseDto })
  @ApiResponse({ status: 400, description: 'Entry cannot be reversed' })
  @ApiResponse({ status: 404, description: 'Journal entry not found' })
  async reverseJournalEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseJournalEntryDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JournalEntryResponseDto> {
    const reversalDate = dto.reversalDate ? new Date(dto.reversalDate) : undefined;
    return await this.journalEntryService.reverseJournalEntry(tenantId, id, user.id, dto.reversalReason, reversalDate);
  }

  @Delete(':id')
  @RequirePermission('financial:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete journal entry' })
  @ApiParam({ name: 'id', description: 'Journal entry ID' })
  @ApiResponse({ status: 204, description: 'Journal entry deleted successfully' })
  @ApiResponse({ status: 400, description: 'Entry cannot be deleted' })
  @ApiResponse({ status: 404, description: 'Journal entry not found' })
  async deleteJournalEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.journalEntryService.deleteJournalEntry(tenantId, id, user.id);
  }
}