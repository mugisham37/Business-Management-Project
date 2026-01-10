import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { CurrentTenant, CurrentUser } from '../../auth/decorators/auth.decorators';
import { QuoteService } from '../services/quote.service';
import {
  CreateQuoteDto,
  UpdateQuoteDto,
  QuoteQueryDto,
} from '../dto/quote.dto';

@ApiTags('B2B Quotes')
@ApiBearerAuth()
@Controller('b2b/quotes')
@UseGuards(JwtAuthGuard, TenantGuard)
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new quote' })
  @ApiResponse({ status: 201, description: 'Quote created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createQuote(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() createQuoteDto: CreateQuoteDto,
  ) {
    return this.quoteService.createQuote(tenantId, createQuoteDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get quotes with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Quotes retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getQuotes(
    @CurrentTenant() tenantId: string,
    @Query() queryDto: QuoteQueryDto,
  ) {
    return this.quoteService.findQuotes(tenantId, queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get quote by ID' })
  @ApiResponse({ status: 200, description: 'Quote retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getQuote(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quoteService.findQuoteById(tenantId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update quote' })
  @ApiResponse({ status: 200, description: 'Quote updated successfully' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateQuote(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateQuoteDto: UpdateQuoteDto,
  ) {
    return this.quoteService.updateQuote(tenantId, id, updateQuoteDto, user.id);
  }

  @Post(':id/convert-to-order')
  @ApiOperation({ summary: 'Convert quote to order' })
  @ApiResponse({ status: 201, description: 'Quote converted to order successfully' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({ status: 400, description: 'Quote cannot be converted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async convertToOrder(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quoteService.convertQuoteToOrder(tenantId, id, user.id);
  }
}