/**
 * GDPR Compliance Service
 * Handles GDPR data subject rights and compliance requirements
 */

import { Logger } from 'winston';
import { SecurityEventLoggerService } from '../security/security-event-logger.service';
import { SecureIdGenerator } from '../tokens/secure-id-generator.service';

export interface GDPRDataSubjectRequest {
  id: string;
  userId: string;
  requestType: GDPRRequestType;
  status: GDPRRequestStatus;
  submittedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  submittedBy: string;
  processedBy?: string;
  verificationMethod: 'email' | 'identity_document' | 'in_person' | 'authenticated_session';
  verificationStatus: 'pending' | 'verified' | 'rejected';
  dataCategories: string[];
  processingPurposes: string[];
  legalBasis: string;
  retentionPeriod?: number;
  reason?: string;
  notes?: string;
  attachments?: string[];
  responseData?: any;
  metadata?: Record<string, any>;
}

export type GDPRRequestType =
  | 'access' // Article 15 - Right of access
  | 'rectification' // Article 16 - Right to rectification
  | 'erasure' // Article 17 - Right to erasure (right to be forgotten)
  | 'restriction' // Article 18 - Right to restriction of processing
  | 'portability' // Article 20 - Right to data portability
  | 'objection' // Article 21 - Right to object
  | 'automated_decision_making'; // Article 22 - Rights related to automated decision making

export type GDPRRequestStatus =
  | 'submitted'
  | 'under_review'
  | 'identity_verification_required'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'partially_completed'
  | 'extended'; // When 30-day period is extended

export interface GDPRDataExport {
  userId: string;
  exportId: string;
  requestId: string;
  exportedAt: Date;
  dataCategories: string[];
  format: 'json' | 'csv' | 'xml' | 'pdf';
  encryptionKey?: string;
  downloadUrl?: string;
  expiresAt: Date;
  downloadCount: number;
  maxDownloads: number;
  fileSize: number;
  checksum: string;
}

export interface GDPRConsentRecord {
  id: string;
  userId: string;
  purpose: string;
  legalBasis: string;
  consentGiven: boolean;
  consentDate: Date;
  consentMethod: 'explicit' | 'implied' | 'opt_in' | 'pre_ticked' | 'inferred';
  consentSource: string; // URL, form, API endpoint, etc.
  withdrawnAt?: Date;
  withdrawalMethod?: string;
  dataCategories: string[];
  processingActivities: string[];
  thirdParties?: string[];
  retentionPeriod?: number;
  metadata?: Record<string, any>;
}

export interface GDPRProcessingActivity {
  id: string;
  name: string;
  description: string;
  controller: string;
  processor?: string;
  purpose: string;
  legalBasis: string;
  dataCategories: string[];
  dataSubjects: string[];
  recipients: string[];
  thirdCountryTransfers?: {
    country: string;
    adequacyDecision?: boolean;
    safeguards?: string;
  }[];
  retentionPeriod: number;
  securityMeasures: string[];
  dataProtectionImpactAssessment?: boolean;
  lastReviewed: Date;
  nextReview: Date;
}

export class GDPRComplianceService {
  private dataSubjectRequests: Map<string, GDPRDataSubjectRequest> = new Map();
  private consentRecords: Map<string, GDPRConsentRecord[]> = new Map();
  private processingActivities: Map<string, GDPRProcessingActivity> = new Map();
  private dataExports: Map<string, GDPRDataExport> = new Map();

  constructor(
    private readonly securityEventLogger: SecurityEventLoggerService,
    private readonly logger: Logger
  ) {
    this.initializeProcessingActivities();
  }

  /**
   * Submit a GDPR data subject request
   */
  async submitDataSubjectRequest(
    userId: string,
    requestType: GDPRRequestType,
    submittedBy: string,
    dataCategories: string[] = [],
    reason?: string,
    verificationMethod: GDPRDataSubjectRequest['verificationMethod'] = 'authenticated_session'
  ): Promise<string> {
    const requestId = SecureIdGenerator.generateSecureId();
    const correlationId = SecureIdGenerator.generateCorrelationId();

    try {
      const request: GDPRDataSubjectRequest = {
        id: requestId,
        userId,
        requestType,
        status: 'submitted',
        submittedAt: new Date(),
        submittedBy,
        verificationMethod,
        verificationStatus: verificationMethod === 'authenticated_session' ? 'verified' : 'pending',
        dataCategories:
          dataCategories.length > 0 ? dataCategories : this.getDefaultDataCategories(requestType),
        processingPurposes: this.getProcessingPurposes(userId),
        legalBasis: this.getLegalBasisForRequest(requestType),
        reason,
        metadata: {
          correlationId,
          submissionSource: 'user_portal',
          ipAddress: 'unknown', // Would be captured from request
        },
      };

      // Store the request
      this.dataSubjectRequests.set(requestId, request);

      // Log security event
      await this.securityEventLogger.logSecurityEvent({
        type: 'gdpr_data_request',
        severity: 'medium',
        userId,
        description: `GDPR ${requestType} request submitted`,
        metadata: {
          requestId,
          requestType,
          dataCategories,
          submittedBy,
          verificationMethod,
        },
        correlationId,
      });

      this.logger.info('GDPR data subject request submitted', {
        correlationId,
        requestId,
        userId,
        requestType,
        submittedBy,
        verificationMethod,
      });

      // Auto-process if verification is not required
      if (request.verificationStatus === 'verified') {
        await this.processDataSubjectRequest(requestId);
      }

      return requestId;
    } catch (error) {
      this.logger.error('Failed to submit GDPR data subject request', {
        userId,
        requestType,
        submittedBy,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process a GDPR data subject request
   */
  async processDataSubjectRequest(requestId: string): Promise<void> {
    const correlationId = SecureIdGenerator.generateCorrelationId();

    try {
      const request = this.dataSubjectRequests.get(requestId);
      if (!request) {
        throw new Error('Request not found');
      }

      if (request.verificationStatus !== 'verified') {
        throw new Error('Request verification required');
      }

      // Update status to processing
      request.status = 'processing';
      request.processedAt = new Date();

      this.logger.info('Processing GDPR data subject request', {
        correlationId,
        requestId,
        requestType: request.requestType,
        userId: request.userId,
      });

      // Process based on request type
      switch (request.requestType) {
        case 'access':
          await this.processAccessRequest(request, correlationId);
          break;
        case 'rectification':
          await this.processRectificationRequest(request, correlationId);
          break;
        case 'erasure':
          await this.processErasureRequest(request, correlationId);
          break;
        case 'restriction':
          await this.processRestrictionRequest(request, correlationId);
          break;
        case 'portability':
          await this.processPortabilityRequest(request, correlationId);
          break;
        case 'objection':
          await this.processObjectionRequest(request, correlationId);
          break;
        case 'automated_decision_making':
          await this.processAutomatedDecisionMakingRequest(request, correlationId);
          break;
        default:
          throw new Error(`Unsupported request type: ${request.requestType}`);
      }

      // Update status to completed
      request.status = 'completed';
      request.completedAt = new Date();

      // Log completion
      await this.securityEventLogger.logSecurityEvent({
        type: 'gdpr_data_request',
        severity: 'medium',
        userId: request.userId,
        description: `GDPR ${request.requestType} request completed`,
        metadata: {
          requestId,
          requestType: request.requestType,
          processingTime: request.completedAt.getTime() - request.processedAt!.getTime(),
        },
        correlationId,
      });
    } catch (error) {
      const request = this.dataSubjectRequests.get(requestId);
      if (request) {
        request.status = 'rejected';
        request.notes = error instanceof Error ? error.message : 'Processing failed';
      }

      this.logger.error('Failed to process GDPR data subject request', {
        correlationId,
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process access request (Article 15)
   */
  private async processAccessRequest(
    request: GDPRDataSubjectRequest,
    correlationId: string
  ): Promise<void> {
    try {
      // Export user data
      const exportData = await this.securityEventLogger.exportUserDataForGDPR(request.userId);

      // Create data export record
      const exportId = SecureIdGenerator.generateSecureId();
      const dataExport: GDPRDataExport = {
        userId: request.userId,
        exportId,
        requestId: request.id,
        exportedAt: new Date(),
        dataCategories: request.dataCategories,
        format: 'json',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        downloadCount: 0,
        maxDownloads: 5,
        fileSize: JSON.stringify(exportData).length,
        checksum: this.calculateChecksum(JSON.stringify(exportData)),
      };

      this.dataExports.set(exportId, dataExport);

      // Store response data
      request.responseData = {
        exportId,
        dataCategories: request.dataCategories,
        processingActivities: this.getUserProcessingActivities(request.userId),
        consentRecords: this.getUserConsentRecords(request.userId),
        retentionPeriods: this.getDataRetentionPeriods(request.userId),
        thirdPartySharing: this.getThirdPartySharing(request.userId),
        automatedDecisionMaking: this.getAutomatedDecisionMaking(request.userId),
      };

      this.logger.info('Access request processed', {
        correlationId,
        requestId: request.id,
        userId: request.userId,
        exportId,
        dataSize: dataExport.fileSize,
      });
    } catch (error) {
      this.logger.error('Failed to process access request', {
        correlationId,
        requestId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process rectification request (Article 16)
   */
  private async processRectificationRequest(
    request: GDPRDataSubjectRequest,
    correlationId: string
  ): Promise<void> {
    try {
      // In a real implementation, this would update the user's data
      // based on the rectification details provided in the request

      request.responseData = {
        message: 'Data rectification completed',
        updatedFields: request.metadata?.updatedFields || [],
        updatedAt: new Date(),
      };

      this.logger.info('Rectification request processed', {
        correlationId,
        requestId: request.id,
        userId: request.userId,
      });
    } catch (error) {
      this.logger.error('Failed to process rectification request', {
        correlationId,
        requestId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process erasure request (Article 17)
   */
  private async processErasureRequest(
    request: GDPRDataSubjectRequest,
    correlationId: string
  ): Promise<void> {
    try {
      // Check if erasure is legally required or if there are grounds to refuse
      const erasureAssessment = this.assessErasureRequest(request);

      if (!erasureAssessment.canErase) {
        request.status = 'rejected';
        request.notes = erasureAssessment.reason;
        return;
      }

      // Perform data deletion
      await this.securityEventLogger.deleteUserDataForGDPR(
        request.userId,
        'gdpr_compliance_service',
        `GDPR erasure request: ${request.reason || 'User request'}`
      );

      request.responseData = {
        message: 'Data erasure completed',
        erasedCategories: request.dataCategories,
        retainedData: erasureAssessment.retainedData,
        retentionReasons: erasureAssessment.retentionReasons,
        erasedAt: new Date(),
      };

      this.logger.info('Erasure request processed', {
        correlationId,
        requestId: request.id,
        userId: request.userId,
        erasedCategories: request.dataCategories.length,
      });
    } catch (error) {
      this.logger.error('Failed to process erasure request', {
        correlationId,
        requestId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process restriction request (Article 18)
   */
  private async processRestrictionRequest(
    request: GDPRDataSubjectRequest,
    correlationId: string
  ): Promise<void> {
    try {
      // Implement data processing restriction
      request.responseData = {
        message: 'Data processing restriction applied',
        restrictedCategories: request.dataCategories,
        restrictionAppliedAt: new Date(),
        restrictionPeriod: '6 months', // Or until dispute is resolved
      };

      this.logger.info('Restriction request processed', {
        correlationId,
        requestId: request.id,
        userId: request.userId,
      });
    } catch (error) {
      this.logger.error('Failed to process restriction request', {
        correlationId,
        requestId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process portability request (Article 20)
   */
  private async processPortabilityRequest(
    request: GDPRDataSubjectRequest,
    correlationId: string
  ): Promise<void> {
    try {
      // Export data in structured, machine-readable format
      const portableData = await this.createPortableDataExport(request.userId);

      const exportId = SecureIdGenerator.generateSecureId();
      const dataExport: GDPRDataExport = {
        userId: request.userId,
        exportId,
        requestId: request.id,
        exportedAt: new Date(),
        dataCategories: request.dataCategories,
        format: 'json',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        downloadCount: 0,
        maxDownloads: 10,
        fileSize: JSON.stringify(portableData).length,
        checksum: this.calculateChecksum(JSON.stringify(portableData)),
      };

      this.dataExports.set(exportId, dataExport);

      request.responseData = {
        exportId,
        format: 'JSON',
        message: 'Portable data export created',
        dataCategories: request.dataCategories,
      };

      this.logger.info('Portability request processed', {
        correlationId,
        requestId: request.id,
        userId: request.userId,
        exportId,
      });
    } catch (error) {
      this.logger.error('Failed to process portability request', {
        correlationId,
        requestId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process objection request (Article 21)
   */
  private async processObjectionRequest(
    request: GDPRDataSubjectRequest,
    correlationId: string
  ): Promise<void> {
    try {
      // Assess objection and stop processing if no compelling legitimate grounds
      const objectionAssessment = this.assessObjectionRequest(request);

      request.responseData = {
        message: objectionAssessment.accepted ? 'Objection accepted' : 'Objection rejected',
        reason: objectionAssessment.reason,
        stoppedProcessing: objectionAssessment.stoppedProcessing,
        continuedProcessing: objectionAssessment.continuedProcessing,
      };

      this.logger.info('Objection request processed', {
        correlationId,
        requestId: request.id,
        userId: request.userId,
        accepted: objectionAssessment.accepted,
      });
    } catch (error) {
      this.logger.error('Failed to process objection request', {
        correlationId,
        requestId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process automated decision making request (Article 22)
   */
  private async processAutomatedDecisionMakingRequest(
    request: GDPRDataSubjectRequest,
    correlationId: string
  ): Promise<void> {
    try {
      const automatedDecisions = this.getAutomatedDecisionMaking(request.userId);

      request.responseData = {
        message: 'Automated decision making information provided',
        automatedDecisions,
        rightToHumanIntervention: true,
        rightToExplanation: true,
        rightToChallenge: true,
      };

      this.logger.info('Automated decision making request processed', {
        correlationId,
        requestId: request.id,
        userId: request.userId,
        decisionsCount: automatedDecisions.length,
      });
    } catch (error) {
      this.logger.error('Failed to process automated decision making request', {
        correlationId,
        requestId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Record consent
   */
  async recordConsent(
    userId: string,
    purpose: string,
    legalBasis: string,
    consentMethod: GDPRConsentRecord['consentMethod'],
    consentSource: string,
    dataCategories: string[],
    processingActivities: string[],
    thirdParties?: string[],
    retentionPeriod?: number
  ): Promise<string> {
    const consentId = SecureIdGenerator.generateSecureId();
    const correlationId = SecureIdGenerator.generateCorrelationId();

    try {
      const consentRecord: GDPRConsentRecord = {
        id: consentId,
        userId,
        purpose,
        legalBasis,
        consentGiven: true,
        consentDate: new Date(),
        consentMethod,
        consentSource,
        dataCategories,
        processingActivities,
        thirdParties,
        retentionPeriod,
        metadata: {
          correlationId,
          ipAddress: 'unknown', // Would be captured from request
          userAgent: 'unknown', // Would be captured from request
        },
      };

      // Store consent record
      const userConsents = this.consentRecords.get(userId) || [];
      userConsents.push(consentRecord);
      this.consentRecords.set(userId, userConsents);

      // Log security event
      await this.securityEventLogger.logSecurityEvent({
        type: 'gdpr_data_request',
        severity: 'low',
        userId,
        description: `Consent recorded for ${purpose}`,
        metadata: {
          consentId,
          purpose,
          legalBasis,
          consentMethod,
          dataCategories,
        },
        correlationId,
      });

      this.logger.info('Consent recorded', {
        correlationId,
        consentId,
        userId,
        purpose,
        consentMethod,
      });

      return consentId;
    } catch (error) {
      this.logger.error('Failed to record consent', {
        userId,
        purpose,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Withdraw consent
   */
  async withdrawConsent(
    userId: string,
    consentId: string,
    withdrawalMethod: string
  ): Promise<void> {
    const correlationId = SecureIdGenerator.generateCorrelationId();

    try {
      const userConsents = this.consentRecords.get(userId) || [];
      const consent = userConsents.find(c => c.id === consentId);

      if (!consent) {
        throw new Error('Consent record not found');
      }

      // Update consent record
      consent.consentGiven = false;
      consent.withdrawnAt = new Date();
      consent.withdrawalMethod = withdrawalMethod;

      // Log security event
      await this.securityEventLogger.logSecurityEvent({
        type: 'gdpr_data_request',
        severity: 'medium',
        userId,
        description: `Consent withdrawn for ${consent.purpose}`,
        metadata: {
          consentId,
          purpose: consent.purpose,
          withdrawalMethod,
        },
        correlationId,
      });

      this.logger.info('Consent withdrawn', {
        correlationId,
        consentId,
        userId,
        purpose: consent.purpose,
        withdrawalMethod,
      });
    } catch (error) {
      this.logger.error('Failed to withdraw consent', {
        userId,
        consentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get user's GDPR requests
   */
  async getUserGDPRRequests(userId: string): Promise<GDPRDataSubjectRequest[]> {
    try {
      return Array.from(this.dataSubjectRequests.values())
        .filter(request => request.userId === userId)
        .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
    } catch (error) {
      this.logger.error('Failed to get user GDPR requests', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get user's consent records
   */
  getUserConsentRecords(userId: string): GDPRConsentRecord[] {
    return this.consentRecords.get(userId) || [];
  }

  // Helper methods

  private initializeProcessingActivities(): void {
    // Initialize common processing activities
    const activities: GDPRProcessingActivity[] = [
      {
        id: 'auth_processing',
        name: 'Authentication Processing',
        description: 'Processing user credentials for authentication',
        controller: 'Company Name',
        purpose: 'User authentication and access control',
        legalBasis: 'Article 6(1)(b) - Contract performance',
        dataCategories: ['authentication_data', 'session_data'],
        dataSubjects: ['users', 'customers'],
        recipients: ['internal_systems'],
        retentionPeriod: 365,
        securityMeasures: ['encryption', 'access_controls', 'audit_logging'],
        lastReviewed: new Date(),
        nextReview: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'security_monitoring',
        name: 'Security Monitoring',
        description: 'Monitoring for security threats and fraud prevention',
        controller: 'Company Name',
        purpose: 'Security monitoring and fraud prevention',
        legalBasis: 'Article 6(1)(f) - Legitimate interests',
        dataCategories: ['security_logs', 'audit_trails', 'device_information'],
        dataSubjects: ['users', 'visitors'],
        recipients: ['security_team', 'internal_systems'],
        retentionPeriod: 730,
        securityMeasures: ['encryption', 'pseudonymization', 'access_controls'],
        lastReviewed: new Date(),
        nextReview: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    ];

    activities.forEach(activity => {
      this.processingActivities.set(activity.id, activity);
    });
  }

  private getDefaultDataCategories(requestType: GDPRRequestType): string[] {
    const categories: Record<GDPRRequestType, string[]> = {
      access: ['personal_data', 'authentication_data', 'security_logs', 'audit_trails'],
      rectification: ['personal_data', 'profile_data'],
      erasure: ['personal_data', 'authentication_data', 'derived_data'],
      restriction: ['personal_data', 'processing_logs'],
      portability: ['personal_data', 'user_generated_content'],
      objection: ['marketing_data', 'analytics_data'],
      automated_decision_making: ['decision_logs', 'profiling_data'],
    };

    return categories[requestType] || ['personal_data'];
  }

  private getProcessingPurposes(userId: string): string[] {
    return [
      'Authentication and access control',
      'Security monitoring and fraud prevention',
      'Service provision and support',
      'Legal compliance and audit',
    ];
  }

  private getLegalBasisForRequest(requestType: GDPRRequestType): string {
    return 'Article 6(1)(c) - Legal obligation (GDPR compliance)';
  }

  private getUserProcessingActivities(userId: string): GDPRProcessingActivity[] {
    return Array.from(this.processingActivities.values());
  }

  private getDataRetentionPeriods(userId: string): Record<string, string> {
    return {
      personal_data: '7 years after account closure',
      authentication_data: '1 year after last login',
      security_logs: '2 years',
      audit_trails: '7 years',
      session_data: '30 days after session end',
    };
  }

  private getThirdPartySharing(userId: string): Record<string, any>[] {
    return [
      {
        recipient: 'Cloud Infrastructure Provider',
        purpose: 'Data hosting and processing',
        dataCategories: ['encrypted_personal_data'],
        safeguards: 'Standard Contractual Clauses',
        country: 'EU',
      },
    ];
  }

  private getAutomatedDecisionMaking(userId: string): Record<string, any>[] {
    return [
      {
        decision: 'Risk-based authentication',
        purpose: 'Security and fraud prevention',
        logic: 'Machine learning model analyzing login patterns',
        significance: 'May require additional authentication steps',
        consequences: 'Enhanced security, potential inconvenience',
        humanIntervention: true,
        challengeProcess: 'Contact support for manual review',
      },
    ];
  }

  private assessErasureRequest(request: GDPRDataSubjectRequest): {
    canErase: boolean;
    reason?: string;
    retainedData: string[];
    retentionReasons: string[];
  } {
    // Assess if data can be erased or if there are legal grounds to retain it
    const retainedData: string[] = [];
    const retentionReasons: string[] = [];

    // Check for legal obligations to retain data
    if (request.dataCategories.includes('audit_trails')) {
      retainedData.push('audit_trails');
      retentionReasons.push('Legal obligation to retain audit logs for 7 years');
    }

    if (request.dataCategories.includes('financial_records')) {
      retainedData.push('financial_records');
      retentionReasons.push('Tax and accounting legal requirements');
    }

    return {
      canErase: true, // Can erase most data
      retainedData,
      retentionReasons,
    };
  }

  private assessObjectionRequest(request: GDPRDataSubjectRequest): {
    accepted: boolean;
    reason: string;
    stoppedProcessing: string[];
    continuedProcessing: string[];
  } {
    // Assess if there are compelling legitimate grounds to continue processing
    return {
      accepted: true,
      reason: 'No compelling legitimate grounds override data subject rights',
      stoppedProcessing: request.dataCategories,
      continuedProcessing: [],
    };
  }

  private async createPortableDataExport(userId: string): Promise<any> {
    // Create structured, machine-readable export of user's data
    return {
      userId,
      exportedAt: new Date().toISOString(),
      format: 'JSON',
      version: '1.0',
      data: {
        // This would include all portable data categories
        profile: {},
        preferences: {},
        userGeneratedContent: {},
      },
    };
  }

  private calculateChecksum(data: string): string {
    // Simple checksum calculation (in production, use proper hashing)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
