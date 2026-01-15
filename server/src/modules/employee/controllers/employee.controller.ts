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
import { EmployeeService } from '../services/employee.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  CreateEmployeeScheduleDto,
  UpdateEmployeeScheduleDto,
  ClockInDto,
  ClockOutDto,
  CreatePerformanceReviewDto,
  UpdatePerformanceReviewDto,
  CreateTrainingRecordDto,
  UpdateTrainingRecordDto,
  CreateEmployeeGoalDto,
  UpdateEmployeeGoalDto,
  EmployeeQueryDto,
  TimeEntryQueryDto,
} from '../dto/employee.dto';
import {
  Employee,
  EmployeeSchedule,
  TimeEntry,
  PerformanceReview,
  TrainingRecord,
  EmployeeGoal,
} from '../entities/employee.entity';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/feature.decorator';
import { RequirePermission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/employees')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('employee-management')
@ApiBearerAuth()
@ApiTags('Employee Management')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  // Employee CRUD operations
  @Post()
  @RequirePermission('employees:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new employee' })
  @ApiResponse({ status: 201, description: 'Employee created successfully', type: Employee })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Employee number already exists' })
  async createEmployee(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Employee> {
    return this.employeeService.createEmployee(tenantId, createEmployeeDto, user.id);
  }

  @Get()
  @RequirePermission('employees:read')
  @ApiOperation({ summary: 'Get all employees with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Employees retrieved successfully' })
  async findEmployees(
    @Query() query: EmployeeQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{ employees: Employee[]; total: number; page: number; limit: number }> {
    return this.employeeService.findEmployees(tenantId, query);
  }

  @Get(':id')
  @RequirePermission('employees:read')
  @ApiOperation({ summary: 'Get employee by ID' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Employee retrieved successfully', type: Employee })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findEmployeeById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Employee> {
    return this.employeeService.findEmployeeById(tenantId, id);
  }

  @Get('number/:employeeNumber')
  @RequirePermission('employees:read')
  @ApiOperation({ summary: 'Get employee by employee number' })
  @ApiParam({ name: 'employeeNumber', description: 'Employee number' })
  @ApiResponse({ status: 200, description: 'Employee retrieved successfully', type: Employee })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findEmployeeByNumber(
    @Param('employeeNumber') employeeNumber: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Employee> {
    return this.employeeService.findEmployeeByNumber(tenantId, employeeNumber);
  }

  @Put(':id')
  @RequirePermission('employees:update')
  @ApiOperation({ summary: 'Update employee' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Employee updated successfully', type: Employee })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({ status: 409, description: 'Employee number already exists' })
  async updateEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Employee> {
    return this.employeeService.updateEmployee(tenantId, id, updateEmployeeDto, user.id);
  }

  @Delete(':id')
  @RequirePermission('employees:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete employee' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({ status: 204, description: 'Employee deleted successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async deleteEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.employeeService.deleteEmployee(tenantId, id, user.id);
  }

  // Employee analytics
  @Get(':id/analytics')
  @RequirePermission('employees:read')
  @ApiOperation({ summary: 'Get employee analytics' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiQuery({ name: 'startDate', description: 'Start date for analytics period' })
  @ApiQuery({ name: 'endDate', description: 'End date for analytics period' })
  @ApiResponse({ status: 200, description: 'Employee analytics retrieved successfully' })
  async getEmployeeAnalytics(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.employeeService.getEmployeeAnalytics(
      tenantId,
      id,
      new Date(startDate),
      new Date(endDate),
    );
  }
}

@Controller('api/v1/employee-schedules')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('employee-scheduling')
@ApiBearerAuth()
@ApiTags('Employee Scheduling')
export class EmployeeScheduleController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @RequirePermission('schedules:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create employee schedule' })
  @ApiResponse({ status: 201, description: 'Schedule created successfully', type: EmployeeSchedule })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Schedule conflict' })
  async createSchedule(
    @Body() createScheduleDto: CreateEmployeeScheduleDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeSchedule> {
    return this.employeeService.createSchedule(tenantId, createScheduleDto, user.id);
  }

  @Get('employee/:employeeId')
  @RequirePermission('schedules:read')
  @ApiOperation({ summary: 'Get schedules for employee' })
  @ApiParam({ name: 'employeeId', description: 'Employee ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date filter' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date filter' })
  @ApiResponse({ status: 200, description: 'Schedules retrieved successfully' })
  async findSchedulesByEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentTenant() tenantId?: string,
  ): Promise<EmployeeSchedule[]> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    
    return this.employeeService.findSchedulesByEmployee(
      tenantId,
      employeeId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Put(':id')
  @RequirePermission('schedules:update')
  @ApiOperation({ summary: 'Update employee schedule' })
  @ApiParam({ name: 'id', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Schedule updated successfully', type: EmployeeSchedule })
  async updateSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateScheduleDto: UpdateEmployeeScheduleDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeSchedule> {
    return this.employeeService.updateSchedule(tenantId, id, updateScheduleDto, user.id);
  }
}

@Controller('api/v1/time-tracking')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('time-tracking')
@ApiBearerAuth()
@ApiTags('Time Tracking')
export class TimeTrackingController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post('clock-in')
  @RequirePermission('time:clock-in')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clock in employee' })
  @ApiResponse({ status: 201, description: 'Employee clocked in successfully', type: TimeEntry })
  @ApiResponse({ status: 409, description: 'Employee already clocked in' })
  async clockIn(
    @Body() clockInDto: ClockInDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TimeEntry> {
    return this.employeeService.clockIn(tenantId, clockInDto, user.id);
  }

  @Post('clock-out')
  @RequirePermission('time:clock-out')
  @ApiOperation({ summary: 'Clock out employee' })
  @ApiResponse({ status: 200, description: 'Employee clocked out successfully', type: TimeEntry })
  @ApiResponse({ status: 404, description: 'Active time entry not found' })
  async clockOut(
    @Body() clockOutDto: ClockOutDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TimeEntry> {
    return this.employeeService.clockOut(tenantId, clockOutDto, user.id);
  }

  @Get('entries')
  @RequirePermission('time:read')
  @ApiOperation({ summary: 'Get time entries with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Time entries retrieved successfully' })
  async findTimeEntries(
    @Query() query: TimeEntryQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{ timeEntries: TimeEntry[]; total: number; page: number; limit: number }> {
    return this.employeeService.findTimeEntries(tenantId, query);
  }

  @Put('entries/:id/approve')
  @RequirePermission('time:approve')
  @ApiOperation({ summary: 'Approve time entry' })
  @ApiParam({ name: 'id', description: 'Time entry ID' })
  @ApiResponse({ status: 200, description: 'Time entry approved successfully', type: TimeEntry })
  async approveTimeEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TimeEntry> {
    return this.employeeService.approveTimeEntry(tenantId, id, user.id);
  }
}

@Controller('api/v1/performance-reviews')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('performance-management')
@ApiBearerAuth()
@ApiTags('Performance Management')
export class PerformanceReviewController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @RequirePermission('performance:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create performance review' })
  @ApiResponse({ status: 201, description: 'Performance review created successfully', type: PerformanceReview })
  async createPerformanceReview(
    @Body() createReviewDto: CreatePerformanceReviewDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PerformanceReview> {
    return this.employeeService.createPerformanceReview(tenantId, createReviewDto, user.id);
  }

  @Get('employee/:employeeId')
  @RequirePermission('performance:read')
  @ApiOperation({ summary: 'Get performance reviews for employee' })
  @ApiParam({ name: 'employeeId', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Performance reviews retrieved successfully' })
  async findPerformanceReviewsByEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<PerformanceReview[]> {
    return this.employeeService.findPerformanceReviewsByEmployee(tenantId, employeeId);
  }
}

@Controller('api/v1/training-records')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('training-management')
@ApiBearerAuth()
@ApiTags('Training Management')
export class TrainingRecordController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @RequirePermission('training:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create training record' })
  @ApiResponse({ status: 201, description: 'Training record created successfully', type: TrainingRecord })
  async createTrainingRecord(
    @Body() createTrainingDto: CreateTrainingRecordDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TrainingRecord> {
    return this.employeeService.createTrainingRecord(tenantId, createTrainingDto, user.id);
  }

  @Get('employee/:employeeId')
  @RequirePermission('training:read')
  @ApiOperation({ summary: 'Get training records for employee' })
  @ApiParam({ name: 'employeeId', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Training records retrieved successfully' })
  async findTrainingRecordsByEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<TrainingRecord[]> {
    return this.employeeService.findTrainingRecordsByEmployee(tenantId, employeeId);
  }
}

@Controller('api/v1/employee-goals')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('goal-management')
@ApiBearerAuth()
@ApiTags('Goal Management')
export class EmployeeGoalController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @RequirePermission('goals:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create employee goal' })
  @ApiResponse({ status: 201, description: 'Employee goal created successfully', type: EmployeeGoal })
  async createEmployeeGoal(
    @Body() createGoalDto: CreateEmployeeGoalDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeGoal> {
    return this.employeeService.createEmployeeGoal(tenantId, createGoalDto, user.id);
  }

  @Get('employee/:employeeId')
  @RequirePermission('goals:read')
  @ApiOperation({ summary: 'Get goals for employee' })
  @ApiParam({ name: 'employeeId', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Employee goals retrieved successfully' })
  async findGoalsByEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<EmployeeGoal[]> {
    return this.employeeService.findGoalsByEmployee(tenantId, employeeId);
  }
}