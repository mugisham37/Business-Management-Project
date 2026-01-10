import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EncryptionService } from './services/encryption.service';
import { AuditService } from './services/audit.service';
import { SecurityMonitoringService } from './services/security-monitoring.service';
import { ThreatDetectionService } from './services/threat-detection.service';
import { ComplianceService } from './services/compliance.service';
import { SecurityController } from './controllers/security.controller';
import { AuditController } from './controllers/audit.controller';
import { ComplianceController } from './controllers/compliance.controller';
import { SecurityGuard } from './guards/security.guard';
import { ThreatDetectionGuard } from './guards/threat-detection.guard';
import { SecurityInterceptor } from './interceptors/security.interceptor';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { DrizzleService } from '../database/drizzle.service';
import { LoggerService } from '../logger/logger.service';

@Module({
  imports: [ConfigModule],
  controllers: [SecurityController, AuditController, ComplianceController],
  providers: [
    DrizzleService,
    LoggerService,
    EncryptionService,
    AuditService,
    SecurityMonitoringService,
    ThreatDetectionService,
    ComplianceService,
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
    SecurityGuard,
    ThreatDetectionGuard,
    SecurityInterceptor,
    AuditInterceptor,
  ],
})
export class SecurityModule {}