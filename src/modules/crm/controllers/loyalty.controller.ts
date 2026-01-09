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
  UseInterceptors,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LoyaltyService } from '../services/loyalty.service';
import { 
  CreateLoyaltyTransactionDto, 
  CreateRewardDto, 
  UpdateRewardDto, 
  CreateCampaignDto,
  LoyaltyQueryDto,
  RewardQueryDto 
} from '../dto/loyalty.dto';
import { LoyaltyTransaction } from '../entities/customer.entity';
import { AuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { CacheInterceptor } from '../../common/interceptors/cache.interceptor';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/loyalty')
@UseGuards(AuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('loyalty-program')
@UseInterceptors(LoggingInterceptor)
@ApiTags('Loyalty Program')
@ApiBearerAuth()
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  // Points Management
  @Post('points/award')
  @RequirePermission('loyalty:manage-points')
  @ApiOperation({ summary: 'Award loyalty points to a customer' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Points awarded successfully',
    type: LoyaltyTransaction 
  })
  async awardPoints(
    @Body() data: {
      customerId: string;
      points: number;
      reason: string;
      relatedTransactionId?: string;
      campaignId?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<LoyaltyTransaction> {
    return this.loyaltyService.awardPoints(
      tenantId,
      data.customerId,
      data.points,
      data.reason,
      data.relatedTransactionId,
      data.campaignId,
      user.id,
    );
  }

  @Post('points/redeem')
  @RequirePermission('loyalty:manage-points')
  @ApiOperation({ summary: 'Redeem loyalty points from a customer' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Points redeemed successfully',
    type: LoyaltyTransaction 
  })
  async redeemPoints(
    @Body() data: {
      customerId: string;
      points: number;
      reason: string;
      relatedTransactionId?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<LoyaltyTransaction> {
    return this.loyaltyService.redeemPoints(
      tenantId,
      data.customerId,
      data.points,
      data.reason,
      data.relatedTransactionId,
      user.id,
    );
  }

  @Post('points/adjust')
  @RequirePermission('loyalty:manage-points')
  @ApiOperation({ summary: 'Adjust loyalty points for a customer' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Points adjusted successfully',
    type: LoyaltyTransaction 
  })
  async adjustPoints(
    @Body() data: {
      customerId: string;
      pointsChange: number;
      reason: string;
    },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<LoyaltyTransaction> {
    return this.loyaltyService.adjustPoints(
      tenantId,
      data.customerId,
      data.pointsChange,
      data.reason,
      user.id,
    );
  }

  @Get('points/balance/:customerId')
  @RequirePermission('loyalty:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get customer loyalty points balance' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Points balance retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalPoints: { type: 'number' },
        availablePoints: { type: 'number' },
        expiredPoints: { type: 'number' },
        expiringPoints: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              points: { type: 'number' },
              expiresAt: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    }
  })
  async getPointsBalance(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.loyaltyService.getCustomerPointsBalance(tenantId, customerId);
  }

  @Get('transactions')
  @RequirePermission('loyalty:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get loyalty transactions with filtering and pagination' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Loyalty transactions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        transactions: {
          type: 'array',
          items: { $ref: '#/components/schemas/LoyaltyTransaction' }
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' }
      }
    }
  })
  async getTransactions(
    @Query() query: LoyaltyQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.loyaltyService.getLoyaltyTransactions(tenantId, query);
    
    return {
      ...result,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(result.total / query.limit),
    };
  }

  @Post('points/calculate')
  @RequirePermission('loyalty:read')
  @ApiOperation({ summary: 'Calculate points for a purchase' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Points calculation completed',
    schema: {
      type: 'object',
      properties: {
        basePoints: { type: 'number' },
        bonusPoints: { type: 'number' },
        totalPoints: { type: 'number' },
        applicableCampaigns: { type: 'array' }
      }
    }
  })
  async calculatePoints(
    @Body() data: {
      customerId: string;
      purchaseAmount: number;
      productIds?: string[];
      categoryIds?: string[];
    },
    @CurrentTenant() tenantId: string,
  ) {
    return this.loyaltyService.calculatePointsForPurchase(
      tenantId,
      data.customerId,
      data.purchaseAmount,
      data.productIds,
      data.categoryIds,
    );
  }

  // Rewards Management
  @Post('rewards')
  @RequirePermission('loyalty:manage-rewards')
  @ApiOperation({ summary: 'Create a new loyalty reward' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Reward created successfully' 
  })
  async createReward(
    @Body() createRewardDto: CreateRewardDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.loyaltyService.createReward(tenantId, createRewardDto, user.id);
  }

  @Get('rewards')
  @RequirePermission('loyalty:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get loyalty rewards with filtering and pagination' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Rewards retrieved successfully' 
  })
  async getRewards(
    @Query() query: RewardQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.loyaltyService.getRewards(tenantId, query);
    
    return {
      ...result,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(result.total / query.limit),
    };
  }

  @Get('rewards/:id')
  @RequirePermission('loyalty:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get reward by ID' })
  @ApiParam({ name: 'id', description: 'Reward ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Reward retrieved successfully' 
  })
  async getRewardById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.loyaltyService.getRewardById(tenantId, id);
  }

  @Put('rewards/:id')
  @RequirePermission('loyalty:manage-rewards')
  @ApiOperation({ summary: 'Update loyalty reward' })
  @ApiParam({ name: 'id', description: 'Reward ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Reward updated successfully' 
  })
  async updateReward(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRewardDto: UpdateRewardDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.loyaltyService.updateReward(tenantId, id, updateRewardDto, user.id);
  }

  @Delete('rewards/:id')
  @RequirePermission('loyalty:manage-rewards')
  @ApiOperation({ summary: 'Delete loyalty reward' })
  @ApiParam({ name: 'id', description: 'Reward ID' })
  @ApiResponse({ 
    status: HttpStatus.NO_CONTENT, 
    description: 'Reward deleted successfully' 
  })
  async deleteReward(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<void> {
    return this.loyaltyService.deleteReward(tenantId, id, user.id);
  }

  // Campaigns Management
  @Post('campaigns')
  @RequirePermission('loyalty:manage-campaigns')
  @ApiOperation({ summary: 'Create a new loyalty campaign' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Campaign created successfully' 
  })
  async createCampaign(
    @Body() createCampaignDto: CreateCampaignDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.loyaltyService.createCampaign(tenantId, createCampaignDto, user.id);
  }

  @Get('campaigns/active')
  @RequirePermission('loyalty:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get active loyalty campaigns' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Active campaigns retrieved successfully' 
  })
  async getActiveCampaigns(
    @CurrentTenant() tenantId: string,
  ) {
    return this.loyaltyService.getActiveCampaigns(tenantId);
  }
}