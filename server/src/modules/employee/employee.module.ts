import { Module } from '@nestjs/common';
import { EmployeeService } from './services/employee.service';
import { PayrollService } from './services/payroll.service';
import { PerformanceService } from './services/performance.service';
import { ComplianceService } from './services/compliance.service';
import { EmployeeRepository } from './repositories/employee.repository';
import { PayrollRepository } from './repositories/payroll.repository';
import { ComplianceRepository } from './repositories/compliance.repository';
import {
  EmployeeController,
  EmployeeScheduleController,
  TimeTrackingController,
  PerformanceReviewController,
  TrainingRecordController,
  EmployeeGoalController,
} from './controllers/employee.controller';
import { PayrollController, PayrollReportsController } from './controllers/payroll.controller';
import { PerformanceController } from './controllers/performance.controller';
import { ComplianceController } from './controllers/compliance.controller';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    TenantModule,
  ],
  controllers: [
    EmployeeController,
    EmployeeScheduleController,
    TimeTrackingController,
    PerformanceReviewController,
    TrainingRecordController,
    EmployeeGoalController,
    PayrollController,
    PayrollReportsController,
    PerformanceController,
    ComplianceController,
  ],
  providers: [
    EmployeeService,
    PayrollService,
    PerformanceService,
    ComplianceService,
    EmployeeRepository,
    PayrollRepository,
    ComplianceRepository,
  ],
  exports: [
    EmployeeService,
    PayrollService,
    PerformanceService,
    ComplianceService,
    EmployeeRepository,
    PayrollRepository,
    ComplianceRepository,
  ],
})
export class EmployeeModule {}