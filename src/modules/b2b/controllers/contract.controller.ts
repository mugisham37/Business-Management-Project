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
  ParseUUIDPipe,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { ContractService } from '../services/contract.service';
import { 
  CreateContractDto, 
  UpdateContractDto, 
  ContractQueryDto,
  ApproveContractDto,
  SignContractDto,
  RenewContractDto
} from '../dto/contract.dto';

@ApiTags('B2B Contracts')
@ApiBearerAuth()
@Controller('b2b-contracts')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('b2b-operations')
export class ContractController {
  private readonly logger = new Logger(ContractController.name);

  constructor(
    private readonly contractService: ContractService,
  ) {}

  @Post()
  @RequirePermission('contract:create')
  @ApiOperation({ summary: 'Create a new B2B contract' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Contract created successfully',
  })
  async createContract(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body(ValidationPipe) createDto: CreateContractDto,
  ) {
    try {
      const contract = await this.contractService.createContract(
        tenantId,
        createDto,
        userId,
      );

      this.logger.log(`Created contract ${contract.contractNumber} for tenant ${tenantId}`);
      
      return {
        success: true,
        data: contract,
        message: 'Contract created successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to create contract for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  @Get(':id')
  @RequirePermission('contract:read')
  @ApiOperation({ summary: 'Get contract by ID' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contract retrieved successfully',
  })
  async getContract(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) contractId: string,
  ) {
    try {
      const contract = await this.contractService.findContractById(
        tenantId,
        contractId,
      );

      return {
        success: true,
        data: contract,
      };
    } catch (error) {
      this.logger.error(`Failed to get contract ${contractId}:`, error);
      throw error;
    }
  }

  @Get()
  @RequirePermission('contract:read')
  @ApiOperation({ summary: 'Get contracts with filtering and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contracts retrieved successfully',
  })
  async getContracts(
    @CurrentTenant() tenantId: string,
    @Query(ValidationPipe) query: ContractQueryDto,
  ) {
    try {
      const result = await this.contractService.findContracts(tenantId, query);

      return {
        success: true,
        data: result.contracts,
        pagination: {
          page: query.page || 1,
          limit: query.limit || 20,
          total: result.total,
          totalPages: Math.ceil(result.total / (query.limit || 20)),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get contracts for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  @Put(':id')
  @RequirePermission('contract:update')
  @ApiOperation({ summary: 'Update contract' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contract updated successfully',
  })
  async updateContract(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) contractId: string,
    @Body(ValidationPipe) updateDto: UpdateContractDto,
  ) {
    try {
      const contract = await this.contractService.updateContract(
        tenantId,
        contractId,
        updateDto,
        userId,
      );

      this.logger.log(`Updated contract ${contractId} for tenant ${tenantId}`);

      return {
        success: true,
        data: contract,
        message: 'Contract updated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to update contract ${contractId}:`, error);
      throw error;
    }
  }

  @Post(':id/approve')
  @RequirePermission('contract:approve')
  @ApiOperation({ summary: 'Approve contract' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contract approved successfully',
  })
  async approveContract(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) contractId: string,
    @Body(ValidationPipe) approveDto: ApproveContractDto,
  ) {
    try {
      const contract = await this.contractService.approveContract(
        tenantId,
        contractId,
        approveDto.approvalNotes,
        userId,
      );

      this.logger.log(`Approved contract ${contractId} by user ${userId}`);

      return {
        success: true,
        data: contract,
        message: 'Contract approved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to approve contract ${contractId}:`, error);
      throw error;
    }
  }

  @Post(':id/sign')
  @RequirePermission('contract:sign')
  @ApiOperation({ summary: 'Sign contract' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contract signed successfully',
  })
  async signContract(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) contractId: string,
    @Body(ValidationPipe) signDto: SignContractDto,
  ) {
    try {
      const customerSignedAt = signDto.customerSignedAt ? new Date(signDto.customerSignedAt) : undefined;
      
      const contract = await this.contractService.signContract(
        tenantId,
        contractId,
        customerSignedAt,
        userId,
      );

      this.logger.log(`Signed contract ${contractId} by user ${userId}`);

      return {
        success: true,
        data: contract,
        message: 'Contract signed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to sign contract ${contractId}:`, error);
      throw error;
    }
  }

  @Post(':id/renew')
  @RequirePermission('contract:renew')
  @ApiOperation({ summary: 'Renew contract' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contract renewed successfully',
  })
  async renewContract(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) contractId: string,
    @Body(ValidationPipe) renewDto: RenewContractDto,
  ) {
    try {
      const contract = await this.contractService.renewContract(
        tenantId,
        contractId,
        new Date(renewDto.newEndDate),
        renewDto.contractValue,
        renewDto.pricingTerms,
        userId,
      );

      this.logger.log(`Renewed contract ${contractId} by user ${userId}`);

      return {
        success: true,
        data: contract,
        message: 'Contract renewed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to renew contract ${contractId}:`, error);
      throw error;
    }
  }

  @Get('expiring/:days')
  @RequirePermission('contract:read')
  @ApiOperation({ summary: 'Get contracts expiring within specified days' })
  @ApiParam({ name: 'days', description: 'Number of days' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Expiring contracts retrieved successfully',
  })
  async getExpiringContracts(
    @CurrentTenant() tenantId: string,
    @Param('days') days: number,
  ) {
    try {
      const contracts = await this.contractService.getExpiringContracts(tenantId, days);

      return {
        success: true,
        data: contracts,
        message: `Found ${contracts.length} contracts expiring within ${days} days`,
      };
    } catch (error) {
      this.logger.error(`Failed to get expiring contracts for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  @Get('renewal-notices/pending')
  @RequirePermission('contract:read')
  @ApiOperation({ summary: 'Get contracts requiring renewal notice' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contracts requiring renewal notice retrieved successfully',
  })
  async getContractsRequiringRenewalNotice(
    @CurrentTenant() tenantId: string,
  ) {
    try {
      const contracts = await this.contractService.getContractsRequiringRenewalNotice(tenantId);

      return {
        success: true,
        data: contracts,
        message: `Found ${contracts.length} contracts requiring renewal notice`,
      };
    } catch (error) {
      this.logger.error(`Failed to get contracts requiring renewal notice for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  @Post(':id/renewal-notice-sent')
  @RequirePermission('contract:update')
  @ApiOperation({ summary: 'Mark renewal notification as sent' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Renewal notification marked as sent',
  })
  async markRenewalNotificationSent(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) contractId: string,
  ) {
    try {
      await this.contractService.markRenewalNotificationSent(tenantId, contractId);

      return {
        success: true,
        message: 'Renewal notification marked as sent',
      };
    } catch (error) {
      this.logger.error(`Failed to mark renewal notification sent for contract ${contractId}:`, error);
      throw error;
    }
  }
}