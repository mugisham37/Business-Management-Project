import {
  Controller,
  Get,
  Post,
  Put,
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
import { PerformanceService } from '../services/performance.service';
import {
  CreatePerformanceReviewDto,
  UpdatePerformanceReviewDto,
  CreateEmployeeGoalDto,
  UpdateEmployeeGoalDto,
  CreateTrainingRecordDto,
  UpdateTrainingRecordDto,
} from '../dto/employee.dto';
import {
  PerformanceReview,
  EmployeeGoal,
  TrainingRecord,
} from '../entities/employee.entity';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/feature.decorator';
import { RequirePermission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/performance')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('performance-management')
@ApiBearerAuth()
@ApiTags('Performance Management')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  // Performance Reviews
  @Post('reviews')
  @RequirePermission('performance:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create performance review' })
  @ApiResponse({ status: 201, description: 'Performance review created successfully', type: PerformanceReview })
  async createPerformanceReview(
    @Body() createReviewDto: CreatePerformanceReviewDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PerformanceReview> {
    return this.performanceService.createPerformanceReview(tenantId, createReviewDto, user.id);
  }

  @Put('reviews/:id')
  @RequirePermission('performance:update')
  @ApiOperation({ summary: 'Update performance review' })
  @ApiParam({ name: 'id', description: 'Performance review ID' })
  @ApiResponse({ status: 200, description: 'Performance review updated successfully', type: PerformanceReview })
  async updatePerformanceReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReviewDto: UpdatePerformanceReviewDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PerformanceReview> {
    return this.performanceService.updatePerformanceReview(tenantId, id, updateReviewDto, user.id);
  }

  @Put('reviews/:id/complete')
  @RequirePermission('performance:update')
  @ApiOperation({ summary: 'Complete performance review' })
  @ApiParam({ name: 'id', description: 'Performance review ID' })
  @ApiResponse({ status: 200, description: 'Performance review completed successfully', type: PerformanceReview })
  async completePerformanceReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PerformanceReview> {
    return this.performanceService.completePerformanceReview(tenantId, id, user.id);
  }

  @Put('reviews/:id/acknowledge')
  @RequirePermission('performance:acknowledge')
  @ApiOperation({ summary: 'Acknowledge performance review' })
  @ApiParam({ name: 'id', description: 'Performance review ID' })
  @ApiResponse({ status: 200, description: 'Performance review acknowledged successfully', type: PerformanceReview })
  async acknowledgePerformanceReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PerformanceReview> {
    return this.performanceService.acknowledgePerformanceReview(tenantId, id, user.id);
  }

  // Employee Goals
  @Post('goals')
  @RequirePermission('goals:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create employee goal' })
  @ApiResponse({ status: 201, description: 'Employee goal created successfully', type: EmployeeGoal })
  async createEmployeeGoal(
    @Body() createGoalDto: CreateEmployeeGoalDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeGoal> {
    return this.performanceService.createEmployeeGoal(tenantId, createGoalDto, user.id);
  }

  @Put('goals/:id')
  @RequirePermission('goals:update')
  @ApiOperation({ summary: 'Update employee goal' })
  @ApiParam({ name: 'id', description: 'Employee goal ID' })
  @ApiResponse({ status: 200, description: 'Employee goal updated successfully', type: EmployeeGoal })
  async updateEmployeeGoal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateGoalDto: UpdateEmployeeGoalDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeGoal> {
    return this.performanceService.updateEmployeeGoal(tenantId, id, updateGoalDto, user.id);
  }

  @Put('goals/:id/progress')
  @RequirePermission('goals:update')
  @ApiOperation({ summary: 'Update goal progress' })
  @ApiParam({ name: 'id', description: 'Employee goal ID' })
  @ApiResponse({ status: 200, description: 'Goal progress updated successfully', type: EmployeeGoal })
  async updateGoalProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { progress: number; notes?: string },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeGoal> {
    return this.performanceService.updateGoalProgress(tenantId, id, body.progress, user.id, body.notes);
  }

  @Put('goals/:id/complete')
  @RequirePermission('goals:update')
  @ApiOperation({ summary: 'Complete employee goal' })
  @ApiParam({ name: 'id', description: 'Employee goal ID' })
  @ApiResponse({ status: 200, description: 'Employee goal completed successfully', type: EmployeeGoal })
  async completeEmployeeGoal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeGoal> {
    return this.performanceService.completeEmployeeGoal(tenantId, id, user.id);
  }

  // Training Management
  @Post('training')
  @RequirePermission('training:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create training record' })
  @ApiResponse({ status: 201, description: 'Training record created successfully', type: TrainingRecord })
  async createTrainingRecord(
    @Body() createTrainingDto: CreateTrainingRecordDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TrainingRecord> {
    return this.performanceService.createTrainingRecord(tenantId, createTrainingDto, user.id);
  }

  @Put('training/:id')
  @RequirePermission('training:update')
  @ApiOperation({ summary: 'Update training record' })
  @ApiParam({ name: 'id', description: 'Training record ID' })
  @ApiResponse({ status: 200, description: 'Training record updated successfully', type: TrainingRecord })
  async updateTrainingRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTrainingDto: UpdateTrainingRecordDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TrainingRecord> {
    return this.performanceService.updateTrainingRecord(tenantId, id, updateTrainingDto, user.id);
  }

  @Put('training/:id/complete')
  @RequirePermission('training:update')
  @ApiOperation({ summary: 'Complete training' })
  @ApiParam({ name: 'id', description: 'Training record ID' })
  @ApiResponse({ status: 200, description: 'Training completed successfully', type: TrainingRecord })
  async completeTraining(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() completionData: { completionDate: string; score?: number; certificateNumber?: string },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TrainingRecord> {
    return this.performanceService.completeTraining(tenantId, id, completionData, user.id);
  }

  // Performance Analytics
  @Get('analytics/employee/:employeeId')
  @RequirePermission('performance:read')
  @ApiOperation({ summary: 'Get employee performance analytics' })
  @ApiParam({ name: 'employeeId', description: 'Employee ID' })
  @ApiQuery({ name: 'startDate', description: 'Start date for analytics period' })
  @ApiQuery({ name: 'endDate', description: 'End date for analytics period' })
  @ApiResponse({ status: 200, description: 'Employee performance analytics retrieved successfully' })
  async getEmployeePerformanceAnalytics(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.performanceService.getEmployeePerformanceAnalytics(
      tenantId,
      employeeId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('analytics/department/:department')
  @RequirePermission('performance:read')
  @ApiOperation({ summary: 'Get department performance analytics' })
  @ApiParam({ name: 'department', description: 'Department name' })
  @ApiQuery({ name: 'startDate', description: 'Start date for analytics period' })
  @ApiQuery({ name: 'endDate', description: 'End date for analytics period' })
  @ApiResponse({ status: 200, description: 'Department performance analytics retrieved successfully' })
  async getDepartmentPerformanceAnalytics(
    @Param('department') department: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.performanceService.getDepartmentPerformanceAnalytics(
      tenantId,
      department,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('recommendations/employee/:employeeId')
  @RequirePermission('performance:read')
  @ApiOperation({ summary: 'Get performance recommendations for employee' })
  @ApiParam({ name: 'employeeId', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Performance recommendations retrieved successfully' })
  async getPerformanceRecommendations(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.performanceService.getPerformanceRecommendations(tenantId, employeeId);
  }
}