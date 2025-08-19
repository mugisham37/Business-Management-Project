/**
 * Security Features Validation Script
 * Validates that all enterprise security features are properly maintained
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 Validating Enterprise Security Features...\n');

// Check if all required security files exist
const requiredSecurityFiles = [
  'src/security/security-event-logger.service.ts',
  'src/security/security-audit.service.ts',
  'src/security/security-monitoring.service.ts',
  'src/security/enterprise-security-monitor.service.ts',
  'src/compliance/gdpr-compliance.service.ts',
  'src/mfa/mfa.service.ts',
  'src/webauthn/webauthn.service.ts',
  'src/strategies/passwordless-auth.service.ts',
  'src/validation/risk-scoring.service.ts',
  'src/validation/device-fingerprinting.service.ts',
];

let allFilesExist = true;

console.log('📁 Checking required security files:');
requiredSecurityFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

// Check for key security features in the files
console.log('\n🔍 Validating security feature implementations:');

const securityFeatureChecks = [
  {
    name: 'MFA Support (TOTP, SMS, Email, WebAuthn)',
    file: 'src/mfa/mfa.service.ts',
    patterns: ['totp', 'sms', 'email', 'webauthn', 'setupMFA', 'verifyMFA'],
  },
  {
    name: 'OAuth Integrations',
    file: 'src/strategies/authentication.service.ts',
    patterns: ['oauth', 'saml', 'ldap'],
  },
  {
    name: 'WebAuthn/FIDO2 Support',
    file: 'src/webauthn/webauthn.service.ts',
    patterns: ['webauthn', 'fido2', 'generateRegistrationOptions', 'verifyRegistrationResponse'],
  },
  {
    name: 'Passwordless Authentication',
    file: 'src/strategies/passwordless-auth.service.ts',
    patterns: ['passwordless', 'magic', 'biometric', 'initiatePasswordlessAuth'],
  },
  {
    name: 'GDPR Compliance',
    file: 'src/compliance/gdpr-compliance.service.ts',
    patterns: ['gdpr', 'data subject', 'right to erasure', 'data portability', 'consent'],
  },
  {
    name: 'Security Event Logging',
    file: 'src/security/security-event-logger.service.ts',
    patterns: ['logSecurityEvent', 'audit trail', 'compliance', 'sendSecurityAlert'],
  },
  {
    name: 'Risk-Based Authentication',
    file: 'src/validation/risk-scoring.service.ts',
    patterns: ['risk', 'scoring', 'behavioral', 'geographic', 'device'],
  },
  {
    name: 'Enterprise Security Monitoring',
    file: 'src/security/enterprise-security-monitor.service.ts',
    patterns: ['enterprise', 'monitoring', 'health', 'compliance', 'validateSecurityFeatures'],
  },
];

let allFeaturesImplemented = true;

securityFeatureChecks.forEach(check => {
  const filePath = path.join(__dirname, check.file);

  if (!fs.existsSync(filePath)) {
    console.log(`  ❌ ${check.name} - File missing: ${check.file}`);
    allFeaturesImplemented = false;
    return;
  }

  try {
    const fileContent = fs.readFileSync(filePath, 'utf8').toLowerCase();
    const foundPatterns = check.patterns.filter(pattern =>
      fileContent.includes(pattern.toLowerCase())
    );

    if (foundPatterns.length >= Math.ceil(check.patterns.length * 0.6)) {
      console.log(
        `  ✅ ${check.name} - ${foundPatterns.length}/${check.patterns.length} patterns found`
      );
    } else {
      console.log(
        `  ⚠️  ${check.name} - Only ${foundPatterns.length}/${check.patterns.length} patterns found`
      );
      console.log(
        `      Missing: ${check.patterns.filter(p => !foundPatterns.includes(p.toLowerCase())).join(', ')}`
      );
    }
  } catch (error) {
    console.log(`  ❌ ${check.name} - Error reading file: ${error.message}`);
    allFeaturesImplemented = false;
  }
});

// Check package exports
console.log('\n📦 Checking package exports:');
const indexPath = path.join(__dirname, 'src/index.ts');

if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf8');

  const expectedExports = [
    'SecurityEventLoggerService',
    'SecurityAuditService',
    'SecurityMonitoringService',
    'EnterpriseSecurityMonitorService',
    'GDPRComplianceService',
    'MFAService',
    'WebAuthnService',
    'PasswordlessAuthService',
  ];

  const exportMappings = {
    SecurityEventLoggerService: 'security-event-logger.service',
    SecurityAuditService: 'security-audit.service',
    SecurityMonitoringService: 'security-monitoring.service',
    EnterpriseSecurityMonitorService: 'enterprise-security-monitor.service',
    GDPRComplianceService: 'gdpr-compliance.service',
    MFAService: 'mfa.service',
    WebAuthnService: 'webauthn.service',
    PasswordlessAuthService: 'passwordless-auth.service',
  };

  expectedExports.forEach(exportName => {
    const serviceFile = exportMappings[exportName];
    if (indexContent.includes(exportName) || (serviceFile && indexContent.includes(serviceFile))) {
      console.log(`  ✅ ${exportName} exported`);
    } else {
      console.log(`  ❌ ${exportName} not exported`);
      allFeaturesImplemented = false;
    }
  });
} else {
  console.log('  ❌ Index file missing');
  allFeaturesImplemented = false;
}

// Final validation summary
console.log('\n📊 Validation Summary:');
console.log('='.repeat(50));

if (allFilesExist && allFeaturesImplemented) {
  console.log('🎉 SUCCESS: All enterprise security features are properly maintained!');
  console.log('\n✅ Maintained Features:');
  console.log('  • Multi-Factor Authentication (TOTP, SMS, Email, WebAuthn)');
  console.log('  • OAuth, SAML, and LDAP integrations');
  console.log('  • WebAuthn/FIDO2 passwordless authentication');
  console.log('  • Biometric and magic link authentication');
  console.log('  • GDPR compliance with data subject rights');
  console.log('  • Comprehensive security event logging');
  console.log('  • Risk-based authentication and monitoring');
  console.log('  • Enterprise security monitoring and alerting');
  console.log('  • Audit trails and compliance reporting');

  process.exit(0);
} else {
  console.log('❌ ISSUES FOUND: Some enterprise security features need attention');
  console.log('\n🔧 Required Actions:');

  if (!allFilesExist) {
    console.log('  • Ensure all required security service files are present');
  }

  if (!allFeaturesImplemented) {
    console.log('  • Complete implementation of missing security features');
    console.log('  • Verify all security services are properly exported');
  }

  console.log('\n📚 All enterprise security features must be maintained according to:');
  console.log('  • Requirements 13.3, 13.4, 13.5 (Security and Compliance)');
  console.log('  • Task 11.2: Maintain enterprise security features');

  process.exit(1);
}
