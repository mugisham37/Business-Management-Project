import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EncryptionService } from './services/encryption.service';
import { AuditService } from './services/audit.service';
import { SecurityMonitoringService } from './services/security-monitoring.service';
import { ThreatDetectionService } from './services/threat-detection.service';
import { ComplianceService } from './services/compliance.service';
import { DataDeletionService } from './services/data-deletion.service';
import { KeyManagementService } from './services/key-management.service';
import { EnterpriseAuthService } from './services/enterprise-auth.service';
import { PenetrationTestingService } from './services/penetration-testing.service';
import { SecurityController } from './controllers/security.controller';
import { AuditController } from './controllers/audit.controller';
import { ComplianceController } from './controllers/compliance.controller';
import { SecurityDashboardController } from './controllers/security-dashboard.controller';
import { SecurityGuard } from './guards/security.guard';
import { ThreatDetectionGuard } from './guards/threat-detection.guard';
import { SecurityInterceptor } from './interceptors/security.interceptor';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { DrizzleService } from '../database/drizzle.service';
import { CustomLoggerService } from '../logger/logger.service';

@Module({
  imports: [ConfigModule],
  controllers: [
    SecurityController, 
    AuditController, 
    ComplianceController,
    SecurityDashboardController,
  ],
  providers: [
    DrizzleService,
    CustomLoggerService,
    EncryptionService,
    AuditService,
    SecurityMonitoringService,
    ThreatDetectionService,
    ComplianceService,
    DataDeletionService,
    KeyManagementService,
    EnterpriseAuthService,
    PenetrationTestingService,
    SecurityGuard,
    ThreatDetectionGuard,
    SecurityInterceptor,
    AuditInterceptor,
  ],
  exports: [
    EncryptionService,
    AuditService,
    SecurityMonitoringService,
    ThreatDetectionService,
    ComplianceService,
    DataDeletionService,
    KeyManagementService,
    EnterpriseAuthService,
    PenetrationTestingService,
    SecurityGuard,
    ThreatDetectionGuard,
    SecurityInterceptor,
    AuditInterceptor,
  ],
})
export class SecurityModule {}