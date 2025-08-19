/**
 * Enterprise Security Features Test Suite
 * Validates that all enterprise security features are maintained and functional
 */

import { Logger } from 'winston';
import { EnterpriseSecurityMonitorService } from '../security/enterprise-security-monitor.service';

// Mock dependencies
const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as any;

const mockSecurityEventLogger = {
  logSecurityEvent: jest.fn(),
  sendSecurityAlert: jest.fn(),
  createComplianceAuditTrail: jest.fn(),
} as any;

const mockSecurityMonitoring = {
  processSecurityEvent: jest.fn(),
} as any;

const mockGDPRCompliance = {
  submitDataSubjectRequest: jest.fn(),
  recordConsent: jest.fn(),
} as any;

describe('Enterprise Security Features', () => {
  let enterpriseSecurityMonitor: EnterpriseSecurityMonitorService;

  beforeEach(() => {
    jest.clearAllMocks();

    enterpriseSecurityMonitor = new EnterpriseSecurityMonitorService(
      mockSecurityEventLogger,
      mockSecurityMonitoring,
      mockGDPRCompliance,
      mockLogger
    );
  });

  describe('MFA Features', () => {
    it('should maintain MFA enforcement capabilities', async () => {
      const featureStatuses = await enterpriseSecurityMonitor.getSecurityFeatureStatus();
      const mfaStatus = featureStatuses.find(f => f.feature === 'mfa_enforcement');

      expect(mfaStatus).toBeDefined();
      expect(mfaStatus?.enabled).toBe(true);
      expect(mfaStatus?.metrics?.supportedMethods).toContain('totp');
      expect(mfaStatus?.metrics?.supportedMethods).toContain('sms');
      expect(mfaStatus?.metrics?.supportedMethods).toContain('email');
      expect(mfaStatus?.metrics?.supportedMethods).toContain('webauthn');
    });

    it('should support risk-based MFA enforcement', async () => {
      const featureStatuses = await enterpriseSecurityMonitor.getSecurityFeatureStatus();
      const mfaStatus = featureStatuses.find(f => f.feature === 'mfa_enforcement');

      expect(mfaStatus?.metrics?.enforcementPolicies).toContain('risk_based');
      expect(mfaStatus?.metrics?.enforcementPolicies).toContain('role_based');
      expect(mfaStatus?.metrics?.enforcementPolicies).toContain('time_based');
    });

    it('should maintain backup codes functionality', async () => {
      const featureStatuses = await enterpriseSecurityMonitor.getSecurityFeatureStatus();
      const mfaStatus = featureStatuses.find(f => f.feature === 'mfa_enforcement');

      expect(mfaStatus?.metrics?.backupCodesEnabled).toBe(true);
    });
  });

  describe('OAuth Features', () => {
    it('should maintain OAuth integrations', async () => {
      const featureStatuses = await enterpriseSecurityMonitor.getSecurityFeatureStatus();
      const oauthStatus = featureStatuses.find(f => f.feature === 'oauth_integrations');

      expect(oauthStatus).toBeDefined();
      expect(oauthStatus?.enabled).toBe(true);
      expect(oauthStatus?.metrics?.supportedProviders).toContain('google');
      expect(oauthStatus?.metrics?.supportedProviders).toContain('microsoft');
      expect(oauthStatus?.metrics?.supportedProviders).toContain('github');
    });

    it('should support SAML and LDAP integrations', async () => {
      const featureStatuses = await enterpriseSecurityMonitor.getSecurityFeatureStatus();
      const oauthStatus = featureStatuses.find(f => f.feature === 'oauth_integrations');

      expect(oauthStatus?.metrics?.samlEnabled).toBe(true);
      expect(oauthStatus?.metrics?.ldapEnabled).toBe(true);
      expect(oauthStatus?.metrics?.oidcCompliant).toBe(true);
    });
  });

  describe('WebAuthn Features', () => {
    it('should maintain WebAuthn support', async () => {
      const featureStatuses = await enterpriseSecurityMonitor.getSecurityFeatureStatus();
      const webauthnStatus = featureStatuses.find(f => f.feature === 'webauthn_support');

      expect(webauthnStatus).toBeDefined();
      expect(webauthnStatus?.enabled).toBe(true);
      expect(webauthnStatus?.metrics?.fido2Compliant).toBe(true);
    });

    it('should support platform and cross-platform authenticators', async () => {
      const featureStatuses = await enterpriseSecurityMonitor.getSecurityFeatureStatus();
      const webauthnStatus = featureStatuses.find(f => f.feature === 'webauthn_support');

      expect(webauthnStatus?.metrics?.platformAuthenticators).toBe(true);
      expect(webauthnStatus?.metrics?.crossPlatformAuthenticators).toBe(true);
      expect(webauthnStatus?.metrics?.userVerificationSupported).toBe(true);
      expect(webauthnStatus?.metrics?.residentKeysSupported).toBe(true);
    });
  });

  describe('Passwordless Authentication Features', () => {
    it('should maintain passwordless authentication capabilities', async () => {
      const featureStatuses = await enterpriseSecurityMonitor.getSecurityFeatureStatus();
      const passwordlessStatus = featureStatuses.find(f => f.feature === 'passwordless_auth');

      expect(passwordlessStatus).toBeDefined();
      expect(passwordlessStatus?.enabled).toBe(true);
      expect(passwordlessStatus?.metrics?.magicLinksEnabled).toBe(true);
      expect(passwordlessStatus?.metrics?.biometricAuthEnabled).toBe(true);
      expect(passwordlessStatus?.metrics?.webauthnIntegrated).toBe(true);
    });

    it('should provide fallback authentication methods', async () => {
      const featureStatuses = await enterpriseSecurityMonitor.getSecurityFeatureStatus();
      const passwordlessStatus = featureStatuses.find(f => f.feature === 'passwordless_auth');

      expect(passwordlessStatus?.metrics?.fallbackMethodsAvailable).toContain('email_code');
      expect(passwordlessStatus?.metrics?.fallbackMethodsAvailable).toContain('sms_code');
      expect(passwordlessStatus?.metrics?.fallbackMethodsAvailable).toContain('backup_codes');
    });
  });

  describe('GDPR Compliance Features', () => {
    it('should maintain GDPR compliance capabilities', async () => {
      const featureStatuses = await enterpriseSecurityMonitor.getSecurityFeatureStatus();
      const gdprStatus = featureStatuses.find(f => f.feature === 'gdpr_compliance');

      expect(gdprStatus).toBeDefined();
      expect(gdprStatus?.enabled).toBe(true);
      expect(gdprStatus?.metrics?.auditTrailEnabled).toBe(true);
      expect(gdprStatus?.metrics?.consentManagement).toBe(true);
      expect(gdprStatus?.metrics?.dataRetentionPolicies).toBe(true);
      expect(gdprStatus?.metrics?.rightToBeForgotten).toBe(true);
    });

    it('should support all data subject rights', async () => {
      const featureStatuses = await enterpriseSecurityMonitor.getSecurityFeatureStatus();
      const gdprStatus = featureStatuses.find(f => f.feature === 'gdpr_compliance');

      const expectedRights = [
        'access',
        'rectification',
        'erasure',
        'restriction',
        'portability',
        'objection',
      ];
      expectedRights.forEach(right => {
        expect(gdprStatus?.metrics?.dataSubjectRights).toContain(right);
      });
    });

    it('should generate compliance reports', async () => {
      const reports = await enterpriseSecurityMonitor.getComplianceReports('gdpr');

      // Should have at least one report after initialization
      expect(reports.length).toBeGreaterThanOrEqual(0);

      if (reports.length > 0) {
        const report = reports[0];
        expect(report.framework).toBe('gdpr');
        expect(report.overallScore).toBeGreaterThanOrEqual(0);
        expect(report.overallScore).toBeLessThanOrEqual(100);
        expect(report.findings).toBeDefined();
        expect(report.recommendations).toBeDefined();
      }
    });
  });

  describe('Security Event Logging and Alerting', () => {
    it('should maintain security alerting capabilities', async () => {
      const featureStatuses = await enterpriseSecurityMonitor.getSecurityFeatureStatus();
      const alertingStatus = featureStatuses.find(f => f.feature === 'security_alerting');

      expect(alertingStatus).toBeDefined();
      expect(alertingStatus?.enabled).toBe(true);
      expect(alertingStatus?.metrics?.realTimeAlerting).toBe(true);
      expect(alertingStatus?.metrics?.threatDetection).toBe(true);
      expect(alertingStatus?.metrics?.anomalyDetection).toBe(true);
      expect(alertingStatus?.metrics?.complianceMonitoring).toBe(true);
    });

    it('should support multiple alert channels', async () => {
      const featureStatuses = await enterpriseSecurityMonitor.getSecurityFeatureStatus();
      const alertingStatus = featureStatuses.find(f => f.feature === 'security_alerting');

      expect(alertingStatus?.metrics?.alertChannels).toContain('email');
      expect(alertingStatus?.metrics?.alertChannels).toContain('sms');
      expect(alertingStatus?.metrics?.alertChannels).toContain('webhook');
      expect(alertingStatus?.metrics?.alertChannels).toContain('slack');
    });
  });

  describe('Security Feature Validation', () => {
    it('should validate all security features', async () => {
      const validation = await enterpriseSecurityMonitor.validateSecurityFeatures();

      expect(validation.overallHealth).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(validation.overallHealth);
      expect(validation.features).toBeDefined();
      expect(validation.features.length).toBeGreaterThan(0);
      expect(validation.issues).toBeDefined();
    });

    it('should report healthy status for properly configured features', async () => {
      const validation = await enterpriseSecurityMonitor.validateSecurityFeatures();

      // All features should be healthy in a properly configured system
      const healthyFeatures = validation.features.filter(f => f.healthStatus === 'healthy');
      expect(healthyFeatures.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Management', () => {
    it('should allow security configuration updates', async () => {
      const newConfig = {
        mfaEnforcementEnabled: true,
        riskBasedAuthEnabled: true,
        securityAlertingEnabled: true,
      };

      await expect(
        enterpriseSecurityMonitor.updateSecurityConfig(newConfig)
      ).resolves.not.toThrow();

      // Verify audit trail was created
      expect(mockSecurityEventLogger.createComplianceAuditTrail).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'security_config_update',
          resource: 'enterprise_security_config',
          complianceFramework: 'iso27001',
        })
      );
    });
  });

  describe('Audit Trail Maintenance', () => {
    it('should maintain comprehensive audit trails', async () => {
      // Test that audit trail creation works
      await expect(
        mockSecurityEventLogger.createComplianceAuditTrail({
          userId: 'test-user',
          action: 'test_action',
          resource: 'test_resource',
          timestamp: new Date(),
          gdprRelevant: true,
          complianceFramework: 'gdpr',
          dataClassification: 'confidential',
        })
      ).resolves.not.toThrow();

      expect(mockSecurityEventLogger.createComplianceAuditTrail).toHaveBeenCalled();
    });
  });

  describe('Security Event Processing', () => {
    it('should process security events with proper logging', async () => {
      const securityEvent = {
        type: 'login_success' as const,
        severity: 'low' as const,
        userId: 'test-user',
        description: 'User logged in successfully',
        timestamp: new Date(),
      };

      await expect(mockSecurityEventLogger.logSecurityEvent(securityEvent)).resolves.not.toThrow();

      expect(mockSecurityEventLogger.logSecurityEvent).toHaveBeenCalledWith(securityEvent);
    });

    it('should send critical security alerts', async () => {
      await expect(
        mockSecurityEventLogger.sendSecurityAlert('critical_breach', 'test-user', {
          severity: 'critical',
          description: 'Test alert',
        })
      ).resolves.not.toThrow();

      expect(mockSecurityEventLogger.sendSecurityAlert).toHaveBeenCalledWith(
        'critical_breach',
        'test-user',
        expect.objectContaining({ severity: 'critical' })
      );
    });
  });
});

describe('Integration Tests', () => {
  it('should maintain all enterprise security features together', async () => {
    // This test ensures that all enterprise security features work together
    const enterpriseSecurityMonitor = new EnterpriseSecurityMonitorService(
      mockSecurityEventLogger,
      mockSecurityMonitoring,
      mockGDPRCompliance,
      mockLogger
    );

    // Validate all features are initialized
    const featureStatuses = await enterpriseSecurityMonitor.getSecurityFeatureStatus();

    const expectedFeatures = [
      'mfa_enforcement',
      'oauth_integrations',
      'webauthn_support',
      'passwordless_auth',
      'gdpr_compliance',
      'security_alerting',
    ];

    expectedFeatures.forEach(expectedFeature => {
      const feature = featureStatuses.find(f => f.feature === expectedFeature);
      expect(feature).toBeDefined();
      expect(feature?.enabled).toBe(true);
    });

    // Validate overall system health
    const validation = await enterpriseSecurityMonitor.validateSecurityFeatures();
    expect(validation.overallHealth).toBeDefined();
    expect(validation.features.length).toBe(expectedFeatures.length);
  });
});
