/**
 * Security Hook
 * React hook for security management and monitoring
 * Requirements: 12.1, 12.2, 12.4, 12.5
 */

import { useState, useCallback } from 'react';
import { useAuditLogger } from '@/lib/security/audit-logger';

export interface SecurityStatus {
  overall: 'secure' | 'warning' | 'critical';
  xssProtection: boolean;
  csrfProtection: boolean;
  headersConfigured: boolean;
  lastUpdated: Date;
}

export interface SecurityIncident {
  id: string;
  type: 'xss_attempt' | 'csrf_violation' | 'unauthorized_access' | 'brute_force';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  description: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SecurityMetrics {
  failedLogins: number;
  blockedRequests: number;
  xssAttempts: number;
  csrfViolations: number;
  lastUpdated: Date;
}

export function useSecurity() {
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);
  const [recentIncidents, setRecentIncidents] = useState<SecurityIncident[]>([]);
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { logSecurityEvent } = useAuditLogger();

  /**
   * Refresh security status
   */
  const refreshSecurityStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // In a real implementation, this would fetch from an API
      // For now, we'll simulate the data
      const status: SecurityStatus = {
        overall: 'secure',
        xssProtection: true,
        csrfProtection: true,
        headersConfigured: true,
        lastUpdated: new Date()
      };

      const incidents: SecurityIncident[] = [
        // Simulated incidents - in real implementation, fetch from audit logs
      ];

      const metrics: SecurityMetrics = {
        failedLogins: 12,
        blockedRequests: 45,
        xssAttempts: 3,
        csrfViolations: 1,
        lastUpdated: new Date()
      };

      setSecurityStatus(status);
      setRecentIncidents(incidents);
      setSecurityMetrics(metrics);

      // Log security status check
      await logSecurityEvent(
        'security_status_check',
        'success',
        { status: status.overall }
      );

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh security status';
      setError(errorMessage);
      
      await logSecurityEvent(
        'security_status_check',
        'failure',
        { error: errorMessage },
        'medium'
      );
    } finally {
      setIsLoading(false);
    }
  }, [logSecurityEvent]);

  /**
   * Report security incident
   */
  const reportIncident = useCallback(async (
    type: SecurityIncident['type'],
    severity: SecurityIncident['severity'],
    description: string,
    metadata: Record<string, unknown> = {}
  ) => {
    try {
      const incident: SecurityIncident = {
        id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        severity,
        timestamp: new Date(),
        description,
        ...metadata
      };

      setRecentIncidents(prev => [incident, ...prev.slice(0, 99)]); // Keep last 100

      // Log the incident
      await logSecurityEvent(
        `security_incident_${type}`,
        'failure',
        {
          incidentId: incident.id,
          severity,
          description,
          ...metadata
        },
        severity === 'critical' ? 'critical' : 'high'
      );

      return incident;
    } catch (err) {
      console.error('Failed to report security incident:', err);
      throw err;
    }
  }, [logSecurityEvent]);

  /**
   * Check for XSS attempts
   */
  const checkXSSAttempt = useCallback(async (input: string, source: string) => {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^>]*>/gi,
      /expression\s*\(/gi
    ];

    const hasXSS = xssPatterns.some(pattern => pattern.test(input));

    if (hasXSS) {
      await reportIncident(
        'xss_attempt',
        'high',
        `XSS attempt detected in ${source}`,
        { input: input.substring(0, 200), source }
      );
      return true;
    }

    return false;
  }, [reportIncident]);

  /**
   * Check for CSRF violations
   */
  const checkCSRFViolation = useCallback(async (
    request: Record<string, unknown>,
    expectedToken: string,
    receivedToken?: string
  ) => {
    if (!receivedToken || receivedToken !== expectedToken) {
      await reportIncident(
        'csrf_violation',
        'high',
        'CSRF token validation failed',
        {
          expectedToken: expectedToken.substring(0, 8) + '...',
          receivedToken: receivedToken?.substring(0, 8) + '...' || 'missing',
          method: request.method,
          url: request.url
        }
      );
      return true;
    }

    return false;
  }, [reportIncident]);

  /**
   * Monitor failed login attempts
   */
  const monitorFailedLogin = useCallback(async (
    userId: string,
    ipAddress: string,
    userAgent: string
  ) => {
    // Check for brute force attempts
    const recentFailures = recentIncidents.filter(incident => 
      incident.type === 'brute_force' &&
      incident.ipAddress === ipAddress &&
      incident.timestamp.getTime() > Date.now() - 15 * 60 * 1000 // Last 15 minutes
    );

    if (recentFailures.length >= 5) {
      await reportIncident(
        'brute_force',
        'critical',
        'Brute force attack detected',
        { userId, ipAddress, userAgent, attemptCount: recentFailures.length + 1 }
      );
      return true;
    }

    return false;
  }, [recentIncidents, reportIncident]);

  /**
   * Get security recommendations
   */
  const getSecurityRecommendations = useCallback(() => {
    const recommendations: string[] = [];

    if (!securityStatus) {
      return recommendations;
    }

    if (!securityStatus.xssProtection) {
      recommendations.push('Enable XSS protection headers');
    }

    if (!securityStatus.csrfProtection) {
      recommendations.push('Implement CSRF token validation');
    }

    if (!securityStatus.headersConfigured) {
      recommendations.push('Configure security headers (CSP, HSTS, etc.)');
    }

    if (recentIncidents.length > 10) {
      recommendations.push('Review and address recent security incidents');
    }

    const criticalIncidents = recentIncidents.filter(i => i.severity === 'critical');
    if (criticalIncidents.length > 0) {
      recommendations.push('Immediately address critical security incidents');
    }

    return recommendations;
  }, [securityStatus, recentIncidents]);

  return {
    // State
    securityStatus,
    recentIncidents,
    securityMetrics,
    isLoading,
    error,

    // Actions
    refreshSecurityStatus,
    reportIncident,
    checkXSSAttempt,
    checkCSRFViolation,
    monitorFailedLogin,
    getSecurityRecommendations
  };
}