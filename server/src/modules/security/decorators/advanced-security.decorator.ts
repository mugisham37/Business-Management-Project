import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { ThreatAnalysisGuard, ComplianceGuard, SecurityRateLimitGuard, EncryptionGuard, DataAccessGuard } from '../guards/advanced-security.guard';

/**
 * Decorator to require MFA for sensitive operations
 * Ensures users have completed multi-factor authentication
 */
export const RequiresMFA = (required: boolean = true) => {
  return SetMetadata('requiresMFA', required);
};

/**
 * Decorator to enforce security level for operations
 * Requires operations to meet minimum security requirements
 */
export const SecurityLevel = (level: 'low' | 'medium' | 'high' | 'critical') => {
  return SetMetadata('securityLevel', level);
};

/**
 * Decorator to apply rate limiting for security operations
 * Prevents abuse of security-sensitive endpoints
 */
export const RateLimitSecurity = (
  requestsPerMinute: number = 100,
  windowMs: number = 60000,
) => {
  return applyDecorators(
    SetMetadata('rateLimitSecurity', true),
    SetMetadata('rateLimitConfig', { requestsPerMinute, windowMs }),
    UseGuards(SecurityRateLimitGuard),
  );
};

/**
 * Decorator to force audit logging on operations
 * Ensures all operations are logged for compliance
 */
export const AuditRequired = (action: string, category: string = 'security') => {
  return SetMetadata('auditRequired', { action, category });
};

/**
 * Decorator to enforce encryption on data operations
 * Ensures sensitive data is encrypted
 */
export const EncryptionRequired = (enforceStrictly: boolean = true) => {
  return applyDecorators(
    SetMetadata('encryptionRequired', true),
    SetMetadata('strictEncryption', enforceStrictly),
    UseGuards(EncryptionGuard),
  );
};

/**
 * Decorator to automatically analyze for threats
 * Performs threat analysis and behavioral checks on requests
 */
export const ThreatAnalysis = (severity: 'low' | 'medium' | 'high' | 'critical' = 'high') => {
  return applyDecorators(
    SetMetadata('threatAnalysis', true),
    SetMetadata('threatSeverity', severity),
    UseGuards(ThreatAnalysisGuard),
  );
};

/**
 * Decorator to enforce compliance checks
 * Ensures operations comply with security frameworks
 */
export const ComplianceCheck = (frameworks?: string[]) => {
  return applyDecorators(
    SetMetadata('complianceCheck', true),
    SetMetadata('complianceFrameworks', frameworks),
    UseGuards(ComplianceGuard),
  );
};

/**
 * Decorator to enforce data classification level
 * Specifies the sensitivity level of data being accessed
 */
export const DataClassification = (
  level: 'public' | 'internal' | 'confidential' | 'restricted',
) => {
  return SetMetadata('dataClassification', level);
};

/**
 * Decorator to enforce data access control
 * Restricts access based on data sensitivity
 */
export const DataAccessControl = () => {
  return applyDecorators(
    SetMetadata('dataAccessControl', true),
    UseGuards(DataAccessGuard),
  );
};

/**
 * Decorator to require enhanced verification
 * Requires additional verification steps
 */
export const RequiresEnhancedVerification = (method: 'email' | 'sms' | 'totp' | 'all' = 'all') => {
  return SetMetadata('enhancedVerification', { enabled: true, method });
};

/**
 * Decorator to enforce security event logging
 * Logs security-related events for monitoring
 */
export const LogSecurityEvent = (eventType: string) => {
  return SetMetadata('logSecurityEvent', eventType);
};

/**
 * Decorator to flag high-risk operations
 * Marks operations as high-risk for additional monitoring
 */
export const HighRiskOperation = (risk: 'medium' | 'high' | 'critical' = 'high') => {
  return SetMetadata('highRiskOperation', true);
  SetMetadata('riskLevel', risk);
};

/**
 * Decorator to require security context
 * Ensures proper security context is available
 */
export const RequiresSecurityContext = () => {
  return SetMetadata('requiresSecurityContext', true);
};

/**
 * Decorator to enforce tenant isolation
 * Prevents cross-tenant access
 */
export const EnforceTenantIsolation = () => {
  return SetMetadata('enforceTenantIsolation', true);
};

/**
 * Decorator to enable request signing
 * Requires requests to be cryptographically signed
 */
export const RequireSignedRequest = (algorithm: string = 'HMAC-SHA256') => {
  return SetMetadata('requireSignedRequest', { enabled: true, algorithm });
};

/**
 * Decorator to enforce response encryption
 * Encrypts sensitive response data
 */
export const EncryptResponse = (sensitive: boolean = true) => {
  return SetMetadata('encryptResponse', sensitive);
};

/**
 * Decorator to require security event notification
 * Sends notifications on important security events
 */
export const NotifySecurityEvent = (channels: ('email' | 'sms' | 'webhook' | 'dashboard')[] = ['dashboard', 'email']) => {
  return SetMetadata('notifySecurityEvent', { enabled: true, channels });
};

/**
 * Decorator to enforce policy compliance
 * Ensures operations comply with security policies
 */
export const EnforcePolicyCompliance = (policies: string[]) => {
  return SetMetadata('enforcePolicyCompliance', policies);
};

/**
 * Decorator to enable anomaly detection
 * Detects and logs anomalous operations
 */
export const EnableAnomalyDetection = (sensitivity: 'low' | 'medium' | 'high' = 'medium') => {
  return SetMetadata('anomalyDetection', { enabled: true, sensitivity });
};

/**
 * Decorator to require operation approval
 * Requires approval before execution
 */
export const RequiresApproval = (approverRole?: string) => {
  return SetMetadata('requiresApproval', { enabled: true, approverRole });
};

/**
 * Decorator to enforce geo-fencing
 * Restricts operations to specific geographic regions
 */
export const GeoFence = (allowedRegions: string[]) => {
  return SetMetadata('geoFence', { enabled: true, allowedRegions });
};

/**
 * Decorator to enable operation audit trail
 * Creates detailed audit trail for operation
 */
export const DetailedAuditTrail = () => {
  return SetMetadata('detailedAuditTrail', true);
};

/**
 * Decorator to enforce immutability
 * Prevents modification after creation
 */
export const EnforceImmutability = () => {
  return SetMetadata('enforceImmutability', true);
};

/**
 * Decorator to enable change notification
 * Notifies on changes to sensitive data
 */
export const NotifyOnChange = (channels: string[] = ['email', 'dashboard']) => {
  return SetMetadata('notifyOnChange', { enabled: true, channels });
};

/**
 * Decorator to enforce minimum session age
 * Requires minimum time since session creation
 */
export const MinimumSessionAge = (ageSeconds: number) => {
  return SetMetadata('minimumSessionAge', ageSeconds);
};

/**
 * Decorator to enforce maximum data volume
 * Limits amount of data that can be accessed/transferred
 */
export const MaxDataVolume = (bytesLimit: number) => {
  return SetMetadata('maxDataVolume', bytesLimit);
};

/**
 * Decorator to require step-up authentication
 * Requires user to re-authenticate for sensitive operations
 */
export const StepUpAuthentication = () => {
  return SetMetadata('stepUpAuthentication', true);
};
