import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
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
import { RequireFeature } from '../../tenant/decorators/feature.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';

import { BackupService, CreateBackupOptions, RestoreOptions } from '../services/backup.service';
import { BackupSchedulerService } from '../services/backup-scheduler.service';
import { PointInTimeRecoveryService } from '../services/point-in-time-recovery.service';
import { BackupVerificationService } from '../services/backup-verification.service';

import {
  BackupEntity,
  BackupStatistics,
  BackupType,
  BackupStatus,
  BackupStorageLocation,
} from '../entities/backup.entity';

import { CreateBackupDto, RestoreBackupDto, CreateScheduledBackupDto } from '../dto/backup.dto';

@Controller('api/v1/backup')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('backup-recovery')
@ApiTags('Backup & Recovery')
@ApiBearerAuth()
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly schedulerService: BackupSchedulerService,
    private readonly recoveryService: PointInTimeRecoveryService,
    private readonly verificationService: BackupVerificationService,
  ) {}

  /**
   * Create a new backup
   */
  @Post()
  @RequirePermission('backup:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new backup' })
  @ApiResponse({ status: 201, type: BackupEntity })
  async createBackup(
    @Body(ValidationPipe) dto: CreateBackupDto,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<BackupEntity> {
    const options: CreateBackupOptions = {
      tenantId,
      type: dto.type,
      storageLocation: dto.storageLocation ?? BackupStorageLocation.S3,
      ...(dto.retentionDays !== undefined && { retentionDays: dto.retentionDays }),
      ...(dto.includeData !== undefined && { includeData: dto.includeData }),
      ...(dto.excludeData !== undefined && { excludeData: dto.excludeData }),
      ...(dto.compressionEnabled !== undefined && { compressionEnabled: dto.compressionEnabled }),
      ...(dto.encryptionEnabled !== undefined && { encryptionEnabled: dto.encryptionEnabled }),
      ...(dto.geographicReplication !== undefined && { geographicReplication: dto.geographicReplication }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      userId: user.id,
    };

    return this.backupService.createBackup(options);
  }

  /**
   * Get backup by ID
   */
  @Get(':id')
  @RequirePermission('backup:read')
  @ApiOperation({ summary: 'Get backup by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, type: BackupEntity })
  async getBackup(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<BackupEntity> {
    return this.backupService.getBackup(id, tenantId);
  }

  /**
   * List backups with filtering
   */
  @Get()
  @RequirePermission('backup:read')
  @ApiOperation({ summary: 'List backups with filtering' })
  @ApiQuery({ name: 'type', enum: BackupType, required: false })
  @ApiQuery({ name: 'status', enum: BackupStatus, required: false })
  @ApiQuery({ name: 'storageLocation', enum: BackupStorageLocation, required: false })
  @ApiQuery({ name: 'startDate', type: 'string', required: false })
  @ApiQuery({ name: 'endDate', type: 'string', required: false })
  @ApiQuery({ name: 'isVerified', type: 'boolean', required: false })
  @ApiQuery({ name: 'limit', type: 'number', required: false })
  @ApiQuery({ name: 'offset', type: 'number', required: false })
  @ApiResponse({ status: 200, type: [BackupEntity] })
  async listBackups(
    @CurrentTenant() tenantId: string,
    @Query('type') type?: BackupType,
    @Query('status') status?: BackupStatus,
    @Query('storageLocation') storageLocation?: BackupStorageLocation,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('isVerified') isVerified?: boolean,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ): Promise<{ backups: BackupEntity[]; total: number }> {
    const filter: any = {
      tenantId,
      ...(type !== undefined && { type }),
      ...(status !== undefined && { status }),
      ...(storageLocation !== undefined && { storageLocation }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(isVerified !== undefined && { isVerified }),
    };

    return this.backupService.listBackups(filter, limit, offset);
  }

  /**
   * Delete backup
   */
  @Delete(':id')
  @RequirePermission('backup:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete backup' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 204 })
  async deleteBackup(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<void> {
    await this.backupService.deleteBackup(id, tenantId, user.id);
  }

  /**
   * Restore from backup
   */
  @Post(':id/restore')
  @RequirePermission('backup:restore')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Restore from backup' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 202, description: 'Restore job queued' })
  async restoreFromBackup(
    @Param('id', ParseUUIDPipe) backupId: string,
    @Body(ValidationPipe) dto: RestoreBackupDto,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<{ restoreJobId: string }> {
    const options: RestoreOptions = {
      backupId,
      targetTenantId: dto.targetTenantId ?? tenantId,
      ...(dto.pointInTime !== undefined && { pointInTime: dto.pointInTime }),
      ...(dto.includeData !== undefined && { includeData: dto.includeData }),
      ...(dto.excludeData !== undefined && { excludeData: dto.excludeData }),
      ...(dto.dryRun !== undefined && { dryRun: dto.dryRun }),
      userId: user.id,
    };

    const restoreJobId = await this.backupService.restoreFromBackup(options);
    return { restoreJobId };
  }

  /**
   * Verify backup integrity
   */
  @Post(':id/verify')
  @RequirePermission('backup:verify')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Verify backup integrity' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 202, description: 'Verification job queued' })
  async verifyBackup(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string }> {
    await this.backupService.verifyBackup(id, tenantId);
    return { message: 'Backup verification queued' };
  }

  /**
   * Get backup statistics
   */
  @Get('statistics')
  @RequirePermission('backup:read')
  @ApiOperation({ summary: 'Get backup statistics' })
  @ApiResponse({ status: 200, type: BackupStatistics })
  async getBackupStatistics(
    @CurrentTenant() tenantId: string,
  ): Promise<BackupStatistics> {
    return this.backupService.getBackupStatistics(tenantId);
  }

  /**
   * Create scheduled backup job
   */
  @Post('schedule')
  @RequirePermission('backup:schedule')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create scheduled backup job' })
  @ApiResponse({ status: 201, description: 'Scheduled backup job created' })
  async createScheduledBackup(
    @Body(ValidationPipe) dto: CreateScheduledBackupDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{ jobId: string }> {
    const config = {
      tenantId,
      type: dto.type,
      schedule: dto.schedule,
      retentionDays: dto.retentionDays,
      storageLocation: dto.storageLocation ?? BackupStorageLocation.S3,
      isEnabled: dto.isEnabled ?? true,
      configuration: {
        compressionEnabled: dto.compressionEnabled ?? true,
        encryptionEnabled: dto.encryptionEnabled ?? true,
        geographicReplication: dto.geographicReplication ?? false,
        ...(dto.includeData !== undefined && { includeData: dto.includeData }),
        ...(dto.excludeData !== undefined && { excludeData: dto.excludeData }),
      },
    };

    const jobId = await this.schedulerService.createScheduledJob(config);
    return { jobId };
  }

  /**
   * Get scheduled backup jobs
   */
  @Get('schedule')
  @RequirePermission('backup:read')
  @ApiOperation({ summary: 'Get scheduled backup jobs' })
  @ApiResponse({ status: 200, description: 'List of scheduled backup jobs' })
  async getScheduledJobs(
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    return this.schedulerService.getScheduledJobs(tenantId);
  }

  /**
   * Delete scheduled backup job
   */
  @Delete('schedule/:jobId')
  @RequirePermission('backup:schedule')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete scheduled backup job' })
  @ApiParam({ name: 'jobId', type: 'string' })
  @ApiResponse({ status: 204 })
  async deleteScheduledJob(
    @Param('jobId') jobId: string,
  ): Promise<void> {
    await this.schedulerService.deleteScheduledJob(jobId);
  }

  /**
   * Get available recovery points
   */
  @Get('recovery/points')
  @RequirePermission('backup:read')
  @ApiOperation({ summary: 'Get available recovery points' })
  @ApiQuery({ name: 'startDate', type: 'string', required: false })
  @ApiQuery({ name: 'endDate', type: 'string', required: false })
  @ApiResponse({ status: 200, description: 'List of available recovery points' })
  async getRecoveryPoints(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<Date[]> {
    return this.recoveryService.getAvailableRecoveryPoints(
      tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Create point-in-time recovery plan
   */
  @Post('recovery/plan')
  @RequirePermission('backup:restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create point-in-time recovery plan' })
  @ApiResponse({ status: 200, description: 'Recovery plan created' })
  async createRecoveryPlan(
    @Body() dto: { targetDateTime: string; includeData?: string[]; excludeData?: string[] },
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const options: any = {
      tenantId,
      targetDateTime: new Date(dto.targetDateTime),
      userId: user.id,
      ...(dto.includeData && { includeData: dto.includeData }),
      ...(dto.excludeData && { excludeData: dto.excludeData }),
    };

    return this.recoveryService.createRecoveryPlan(options);
  }

  /**
   * Execute point-in-time recovery
   */
  @Post('recovery/execute')
  @RequirePermission('backup:restore')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Execute point-in-time recovery' })
  @ApiResponse({ status: 202, description: 'Recovery started' })
  async executeRecovery(
    @Body() dto: {
      targetDateTime: string;
      includeData?: string[];
      excludeData?: string[];
      dryRun?: boolean;
    },
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const options: any = {
      tenantId,
      targetDateTime: new Date(dto.targetDateTime),
      userId: user.id,
      ...(dto.includeData && { includeData: dto.includeData }),
      ...(dto.excludeData && { excludeData: dto.excludeData }),
      ...(dto.dryRun !== undefined && { dryRun: dto.dryRun }),
    };

    return this.recoveryService.executeRecovery(options);
  }

  /**
   * Estimate recovery time
   */
  @Post('recovery/estimate')
  @RequirePermission('backup:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Estimate recovery time' })
  @ApiResponse({ status: 200, description: 'Recovery time estimate' })
  async estimateRecoveryTime(
    @Body() dto: { targetDateTime: string },
    @CurrentTenant() tenantId: string,
  ): Promise<{
    estimatedMinutes: number;
    dataLossMinutes: number;
    requiredBackups: number;
  }> {
    return this.recoveryService.estimateRecoveryTime(
      tenantId,
      new Date(dto.targetDateTime),
    );
  }
}