// Module
export { BackupModule } from './backup.module';

// Services
export { BackupService } from './services/backup.service';
export { BackupSchedulerService } from './services/backup-scheduler.service';
export { BackupVerificationService } from './services/backup-verification.service';
export { BackupStorageService } from './services/backup-storage.service';
export { BackupEncryptionService } from './services/backup-encryption.service';
export { PointInTimeRecoveryService } from './services/point-in-time-recovery.service';

// Repositories
export { BackupRepository } from './repositories/backup.repository';
export { BackupJobRepository } from './repositories/backup-job.repository';

// Resolvers
export { BackupResolver } from './resolvers/backup.resolver';

// Processors
export { BackupProcessor } from './processors/backup.processor';
export { BackupVerificationProcessor } from './processors/backup-verification.processor';

// Event Handlers
export { BackupEventHandler } from './handlers/backup-event.handler';

// Guards
export { 
  BackupAccessGuard, 
  BackupConcurrencyGuard, 
  BackupQuotaGuard, 
  BackupTimingGuard 
} from './guards/backup-access.guard';

// Interceptors
export { 
  BackupLoggingInterceptor, 
  BackupMetricsInterceptor, 
  BackupCacheInterceptor 
} from './interceptors/backup-logging.interceptor';

// Middleware
export { 
  BackupContextMiddleware, 
  BackupRateLimitMiddleware, 
  BackupSecurityMiddleware, 
  BackupValidationMiddleware,
  BackupAuditMiddleware,
  BackupPerformanceMiddleware
} from './middleware/backup-context.middleware';

// Decorators
export { 
  BackupContext, 
  BackupOperation, 
  AuditBackupOperation, 
  RateLimitBackup, 
  ValidateBackupInput, 
  MonitorBackupPerformance 
} from './decorators/backup.decorators';

// Entities
export { 
  BackupEntity, 
  BackupJob, 
  BackupStatistics, 
  BackupType, 
  BackupStatus, 
  BackupStorageLocation 
} from './entities/backup.entity';

// Input Types
export { 
  CreateBackupInput,
  BackupFilterInput,
  CreateScheduledBackupInput,
  UpdateScheduledBackupInput,
  RestoreBackupInput,
  PointInTimeRecoveryInput,
  BackupVerificationInput,
  BackupPaginationInput,
  RecoveryEstimateInput,
  BackupStorageUsageInput,
  BackupIntegrityReportInput,
  BatchVerificationInput,
  EncryptionKeyRotationInput,
  BackupCleanupInput
} from './inputs/backup.input';

// Response Types
export { 
  BackupListResponse,
  BackupOperationResponse,
  RestoreOperationResponse,
  RecoveryPlan,
  RecoveryEstimate,
  BackupVerificationResult,
  ScheduledBackupJob,
  BackupJobListResponse,
  BackupStorageUsageResponse,
  BackupIntegrityReport,
  BatchVerificationResult,
  EncryptionKeyInfo,
  BackupCleanupResult,
  BackupAnalytics,
  BackupIntegrityCheck,
  BackupStorageUsage,
  BackupStatusCount
} from './types/backup.types';

// Type Interfaces
export type { CreateBackupOptions, RestoreOptions, BackupFilter } from './services/backup.service';
export type { ScheduledBackupConfig } from './services/backup-scheduler.service';
export type { PointInTimeRecoveryOptions, RecoveryPlan as RecoveryPlanInterface, RecoveryStep, RecoveryResult } from './services/point-in-time-recovery.service';
export type { VerificationResult } from './services/backup-verification.service';
export type { StorageConfig, UploadResult, DownloadResult } from './services/backup-storage.service';
export type { EncryptionKey, EncryptionResult, DecryptionResult } from './services/backup-encryption.service';

// Repository Interfaces
export type { CreateBackupData, UpdateBackupData } from './repositories/backup.repository';
export type { CreateBackupJobData, UpdateBackupJobData } from './repositories/backup-job.repository';

// Processor Interfaces
export type { BackupJobData, RestoreJobData } from './processors/backup.processor';
export type { VerificationJobData } from './processors/backup-verification.processor';