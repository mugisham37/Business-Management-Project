import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Services
import { EncryptionService } from './services/encryption.service';
import { AuditService } from './services/audit.service';
import { SecurityMonitoringService } from './services/security-monitoring.service';
import { ThreatDetectionService } from './services/threat-detection.service';
import { ComplianceService } from './services/compliance.service';
import { DataDeletionService } from './services/data-deletion.service';
import { KeyManagementService } from './services/key-management.service';
import { EnterpriseAuthService } from './services/enterprise-auth.service';
import { PenetrationTestingService } from './services/penetration-testing.service';
import { SecurityOrchestratorService } from './services/security-orchestrator.service';

// Resolvers
import { SecurityResolver } from './resolvers/security.resolver';
import { AuditResolver } from './resolvers/audit.resolver';
import { ComplianceResolver } from './resolvers/compliance.resolver';
import { SecurityDashboardResolver } from './resolvers/security-dashboard.resolver';
import { ThreatManagementResolver } from './resolvers/advanced-security.resolver';
import { BehavioralAnalysisResolver } from './resolvers/advanced-security.resolver';
import { AuditAnalysisResolver } from './resolvers/advanced-security.resolver';
import { EncryptionManagementResolver } from './resolvers/advanced-security.resolver';
import { SecurityMonitoringResolver } from './resolvers/advanced-security.resolver';

// Guards
import { ThreatAnalysisGuard } from './guards/advanced-security.guard';
import { ComplianceGuard } from './guards/advanced-security.guard';
import { SecurityRateLimitGuard } from './guards/advanced-security.guard';
import { EncryptionGuard } from './guards/advanced-security.guard';
import { DataAccessGuard } from './guards/advanced-security.guard';

// External dependencies
import { DrizzleService } from '../database/drizzle.service';
import { CustomLoggerService } from '../logger/logger.service';
import { GraphQLCommonModule } from '../../common/graphql/graphql-common.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    ConfigModule,
    GraphQLCommonModule,
    QueueModule,
    EventEmitterModule.forRoot(),
  ],
  providers: [
    // Infrastructure Services
    DrizzleService,
    CustomLoggerService,

    // Core Security Services
    EncryptionService,
    AuditService,
    SecurityMonitoringService,
    ThreatDetectionService,
    ComplianceService,
    DataDeletionService,
    KeyManagementService,
    EnterpriseAuthService,
    PenetrationTestingService,

    // Central Orchestrator (coordinates all services)
    SecurityOrchestratorService,

    // GraphQL Resolvers - Base
    SecurityResolver,
    AuditResolver,
    ComplianceResolver,
    SecurityDashboardResolver,

    // GraphQL Resolvers - Advanced (100% service utilization)
    ThreatManagementResolver,
    BehavioralAnalysisResolver,
    AuditAnalysisResolver,
    EncryptionManagementResolver,
    SecurityMonitoringResolver,

    // Guards
    ThreatAnalysisGuard,
    ComplianceGuard,
    SecurityRateLimitGuard,
    EncryptionGuard,
    DataAccessGuard,
  ],
  exports: [
    // Services exported for use by other modules
    EncryptionService,
    AuditService,
    SecurityMonitoringService,
    ThreatDetectionService,
    ComplianceService,
    DataDeletionService,
    KeyManagementService,
    EnterpriseAuthService,
    PenetrationTestingService,
    SecurityOrchestratorService,

    // Guards exported for module-level use
    ThreatAnalysisGuard,
    ComplianceGuard,
    SecurityRateLimitGuard,
    EncryptionGuard,
    DataAccessGuard,
  ],
})
export class SecurityModule {}