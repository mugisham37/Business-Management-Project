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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { EncryptionService } from '../services/encryption.service';
import { SecurityMonitoringService } from '../services/security-monitoring.service';
import { ThreatDetectionService } from '../services/threat-detection.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { SecurityInterceptor } from '../interceptors/security.interceptor';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

export interface EncryptFieldDto {
  data: string;
  fieldName: string;
}

export interface DecryptFieldDto {
  encryptedData: string;
  fieldName: string;
}

export interface RotateKeysDto {
  reason?: string;
}

export interface SecurityDashboardQuery {
  timeRange?: '1h' | '24h' | '7d' | '30d';
  includeResolved?: boolean;
}

@ApiTags('Security')
@ApiBearerAuth()
@Controller('api/v1/security')
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(SecurityInterceptor)
export class SecurityController {
  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly securityMonitoringService: SecurityMonitoringService,
    private readonly threatDetectionService: ThreatDetectionService,
  ) {}

  @Post('encrypt-field')
  @RequirePermission('security:encrypt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Encrypt sensitive field data' })
  @ApiResponse({ status: 200, description: 'Field encrypted successfully' })
  async encryptField(
    @Body() dto: EncryptFieldDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{ encryptedData: string }> {
    const encryptedData = await this.encryptionService.encryptField(
      dto.data,
      tenantId,
      dto.fieldName,
    );

    return { encryptedData };
  }

  @Post('decrypt-field')
  @RequirePermission('security:decrypt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decrypt sensitive field data' })
  @ApiResponse({ status: 200, description: 'Field decrypted successfully' })
  async decryptField(
    @Body() dto: DecryptFieldDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{ data: string }> {
    const data = await this.encryptionService.decryptField(
      dto.encryptedData,
      tenantId,
      dto.fieldName,
    );

    return { data };
  }

  @Post('rotate-keys')
  @RequirePermission('security:rotate-keys')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate encryption keys for tenant' })
  @ApiResponse({ status: 200, description: 'Keys rotated successfully' })
  async rotateKeys(
    @Body() dto: RotateKeysDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; rotatedAt: Date }> {
    await this.encryptionService.rotateKeys(tenantId);

    return {
      success: true,
      rotatedAt: new Date(),
    };
  }

  @Get('dashboard')
  @RequirePermission('security:read')
  @ApiOperation({ summary: 'Get security dashboard data' })
  @ApiResponse({ status: 200, description: 'Security dashboard data retrieved' })
  async getSecurityDashboard(
    @Query() query: SecurityDashboardQuery,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.securityMonitoringService.getSecurityDashboard(tenantId);
  }

  @Get('metrics')
  @RequirePermission('security:read')
  @ApiOperation({ summary: 'Get security metrics for tenant' })
  @ApiResponse({ status: 200, description: 'Security metrics retrieved' })
  async getSecurityMetrics(
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.securityMonitoringService.getSecurityMetrics(tenantId);
  }

  @Get('threats')
  @RequirePermission('security:read')
  @ApiOperation({ summary: 'Get active security threats' })
  @ApiResponse({ status: 200, description: 'Active threats retrieved' })
  async getActiveThreats(
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.securityMonitoringService.getActiveThreats(tenantId);
  }

  @Put('threats/:threatId/resolve')
  @RequirePermission('security:manage-threats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a security threat' })
  @ApiResponse({ status: 200, description: 'Threat resolved successfully' })
  async resolveThreat(
    @Param('threatId') threatId: string,
    @Body() body: { resolution: string },
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    await this.securityMonitoringService.resolveThreat(
      threatId,
      body.resolution,
      user.id,
    );

    return { success: true };
  }

  @Put('alerts/:alertId/acknowledge')
  @RequirePermission('security:manage-alerts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge a security alert' })
  @ApiResponse({ status: 200, description: 'Alert acknowledged successfully' })
  async acknowledgeAlert(
    @Param('alertId') alertId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    await this.securityMonitoringService.acknowledgeAlert(alertId, user.id);

    return { success: true };
  }

  @Get('compliance/status')
  @RequirePermission('security:compliance')
  @ApiOperation({ summary: 'Get compliance status' })
  @ApiResponse({ status: 200, description: 'Compliance status retrieved' })
  async getComplianceStatus(
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    // This will be implemented when we create the ComplianceService
    return {
      soc2: { status: 'compliant', lastAudit: new Date() },
      gdpr: { status: 'compliant', lastAudit: new Date() },
      pciDss: { status: 'pending', lastAudit: null },
    };
  }

  @Post('penetration-test')
  @RequirePermission('security:penetration-test')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Initiate penetration testing' })
  @ApiResponse({ status: 202, description: 'Penetration test initiated' })
  async initiatePenetrationTest(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ testId: string; status: string }> {
    // This would integrate with penetration testing tools
    const testId = `pentest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      testId,
      status: 'initiated',
    };
  }
}