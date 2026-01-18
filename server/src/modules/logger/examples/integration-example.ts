/**
 * Integration Examples for Logger Module
 * 
 * This file demonstrates how the logger module integrates with other modules
 * and provides comprehensive logging capabilities across the entire application.
 */

import { Injectable, UseInterceptors, UseGuards } from '@nestjs/common';
import { Resolver, Query, Mutation, Subscription, Args, Context, Info } from '@nestjs/graphql';
import { GraphQLResolveInfo } from 'graphql';

// Logger imports
import {
  CustomLoggerService,
  LogLevel,
  LogCategory,
  LogMethodCalls,
  LogGraphQLResolver,
  LogPerformance,
  LogAudit,
  LogSecurity,
  LogBusiness,
  LogSensitive,
  LogDatabaseOperation,
  LogCacheOperation,
  LogIntegration,
  LoggerInterceptor,
  GraphQLLoggingInterceptor,
  PerformanceLoggingInterceptor,
} from '../index';

// Other module imports (examples)
import { GraphQLJwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';

// Example 1: Service with comprehensive logging
@Injectable()
@UseInterceptors(LoggerInterceptor, PerformanceLoggingInterceptor)
export class UserManagementService {
  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext('UserManagementService');
  }

  @LogMethodCalls({
    level: LogLevel.INFO,
    category: LogCategory.BUSINESS,
    includeArgs: true,
    includeResult: false,
    sensitiveFields: ['password', 'ssn', 'creditCard'],
  })
  @LogPerformance(500)
  @LogAudit('user_created')
  @LogSecurity('user_registration')
  @LogBusiness('new_customer_acquisition')
  @LogSensitive(['password', 'personalData'])
  async createUser(userData: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Validate user data
      await this.validateUserData(userData);
      
      // Create user in database
      const user = await this.saveUserToDatabase(userData);
      
      // Send welcome email
      await this.sendWelcomeEmail(user);
      
      // Log business metrics
      this.logger.business('user_created', {
        userId: user.id,
        userType: user.type,
        registrationSource: userData.source,
        revenue: userData.subscriptionPlan?.price || 0,
      });
      
      // Log security event
      this.logger.security('new_user_registered', {
        userId: user.id,
        email: user.email,
        ipAddress: userData.ipAddress,
        userAgent: userData.userAgent,
      });
      
      return user;
    } catch (error) {
      this.logger.error(
        'Failed to create user',
        error.stack,
        {
          userData: this.sanitizeUserData(userData),
          duration: Date.now() - startTime,
        },
      );
      throw error;
    }
  }

  @LogDatabaseOperation({ table: 'users', operation: 'insert' })
  private async saveUserToDatabase(userData: any): Promise<any> {
    // Database operation - automatically logged
    return { id: 'user_123', ...userData };
  }

  @LogIntegration('email-service', { logRequest: true, logResponse: false })
  private async sendWelcomeEmail(user: any): Promise<void> {
    // Integration call - automatically logged
    console.log(`Sending welcome email to ${user.email}`);
  }

  private sanitizeUserData(userData: any): any {
    const { password, ssn, creditCard, ...safe } = userData;
    return safe;
  }

  private async validateUserData(userData: any): Promise<void> {
    if (!userData.email) {
      throw new Error('Email is required');
    }
  }
}

// Example 2: GraphQL Resolver with comprehensive logging
@Resolver('User')
@UseGuards(GraphQLJwtAuthGuard, TenantGuard)
@UseInterceptors(GraphQLLoggingInterceptor, LoggerInterceptor)
export class UserResolver {
  constructor(
    private readonly userService: UserManagementService,
    private readonly logger: CustomLoggerService,
  ) {
    this.logger.setContext('UserResolver');
  }

  @Query(() => String)
  @RequirePermission('users:read')
  @LogGraphQLResolver({
    complexityThreshold: 100,
    durationThreshold: 1000,
    logVariables: true,
    sensitiveFields: ['password'],
  })
  async getUsers(
    @Args('filters') filters: any,
    @CurrentUser() user: any,
    @Context() context: any,
    @Info() info: GraphQLResolveInfo,
  ): Promise<any[]> {
    // GraphQL operation automatically logged with:
    // - Operation name and type
    // - Query complexity
    // - Performance metrics
    // - User and tenant context
    
    this.logger.audit('users_accessed', {
      accessedBy: user.id,
      filters,
      requestedFields: this.getRequestedFields(info),
    });

    return this.userService.findUsers(filters);
  }

  @Mutation(() => String)
  @RequirePermission('users:write')
  @LogGraphQLResolver({ durationThreshold: 2000 })
  async createUser(
    @Args('input') input: any,
    @CurrentUser() user: any,
    @Context() context: any,
  ): Promise<any> {
    // Mutation automatically logged with audit trail
    
    this.logger.security('user_creation_attempt', {
      createdBy: user.id,
      targetEmail: input.email,
      ipAddress: context.req.ip,
    });

    const newUser = await this.userService.createUser({
      ...input,
      createdBy: user.id,
      ipAddress: context.req.ip,
      userAgent: context.req.headers['user-agent'],
    });

    this.logger.audit('user_created_via_graphql', {
      createdBy: user.id,
      newUserId: newUser.id,
      userEmail: newUser.email,
    });

    return newUser;
  }

  @Subscription(() => String)
  @RequirePermission('users:subscribe')
  async userUpdates(
    @Args('userId') userId: string,
    @Context() context: any,
  ): AsyncIterator<any> {
    // Subscription automatically logged
    
    this.logger.audit('user_subscription_started', {
      subscribedBy: context.req.user.id,
      targetUserId: userId,
    });

    // Return subscription iterator
    return this.createUserUpdateStream(userId);
  }

  private getRequestedFields(info: GraphQLResolveInfo): string[] {
    // Extract requested fields from GraphQL info
    return ['id', 'email', 'name']; // Simplified
  }

  private async* createUserUpdateStream(userId: string): AsyncIterator<any> {
    // Mock subscription implementation
    while (true) {
      yield { userId, update: 'mock update' };
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Example 3: Cache Service with logging
@Injectable()
export class CacheService {
  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext('CacheService');
  }

  @LogCacheOperation({ operation: 'get', logKeys: false })
  async get(key: string): Promise<any> {
    // Cache get operation - automatically logged with hit/miss
    return null; // Mock implementation
  }

  @LogCacheOperation({ operation: 'set', logKeys: false })
  async set(key: string, value: any, ttl?: number): Promise<void> {
    // Cache set operation - automatically logged
    console.log(`Setting cache key: ${key}`);
  }

  @LogCacheOperation({ operation: 'delete', logKeys: true })
  async delete(key: string): Promise<void> {
    // Cache delete operation - automatically logged with key
    console.log(`Deleting cache key: ${key}`);
  }
}

// Example 4: Database Repository with logging
@Injectable()
export class UserRepository {
  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext('UserRepository');
  }

  @LogDatabaseOperation({ table: 'users', operation: 'select', logQuery: true })
  async findById(id: string): Promise<any> {
    // Database select - automatically logged with performance metrics
    const startTime = Date.now();
    
    try {
      // Mock database query
      const user = { id, name: 'John Doe', email: 'john@example.com' };
      
      this.logger.database('select', 'users', Date.now() - startTime, {
        query: `SELECT * FROM users WHERE id = '${id}'`,
        resultCount: 1,
      });
      
      return user;
    } catch (error) {
      this.logger.error(
        'Database query failed',
        error.stack,
        {
          table: 'users',
          operation: 'select',
          query: `SELECT * FROM users WHERE id = '${id}'`,
          duration: Date.now() - startTime,
        },
      );
      throw error;
    }
  }

  @LogDatabaseOperation({ table: 'users', operation: 'insert' })
  async create(userData: any): Promise<any> {
    // Database insert - automatically logged
    return { id: 'new_user_id', ...userData };
  }

  @LogDatabaseOperation({ table: 'users', operation: 'update' })
  async update(id: string, updates: any): Promise<any> {
    // Database update - automatically logged with audit trail
    
    this.logger.audit('user_updated', {
      userId: id,
      updates: Object.keys(updates),
      previousValues: {}, // Would fetch from database
      newValues: updates,
    });
    
    return { id, ...updates };
  }
}

// Example 5: Integration Service with logging
@Injectable()
export class PaymentService {
  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext('PaymentService');
  }

  @LogIntegration('stripe', {
    logRequest: true,
    logResponse: true,
    sensitiveFields: ['cardNumber', 'cvv', 'apiKey'],
  })
  async processPayment(paymentData: any): Promise<any> {
    // External API call - automatically logged with request/response
    const startTime = Date.now();
    
    try {
      // Mock Stripe API call
      const result = {
        id: 'payment_123',
        status: 'succeeded',
        amount: paymentData.amount,
      };
      
      this.logger.business('payment_processed', {
        paymentId: result.id,
        amount: result.amount,
        currency: paymentData.currency,
        customerId: paymentData.customerId,
        revenue: result.amount,
      });
      
      this.logger.security('payment_transaction', {
        paymentId: result.id,
        amount: result.amount,
        customerId: paymentData.customerId,
        ipAddress: paymentData.ipAddress,
      });
      
      return result;
    } catch (error) {
      this.logger.error(
        'Payment processing failed',
        error.stack,
        {
          paymentData: this.sanitizePaymentData(paymentData),
          duration: Date.now() - startTime,
        },
      );
      
      this.logger.security('payment_failure', {
        customerId: paymentData.customerId,
        amount: paymentData.amount,
        error: error.message,
        ipAddress: paymentData.ipAddress,
      });
      
      throw error;
    }
  }

  private sanitizePaymentData(data: any): any {
    const { cardNumber, cvv, apiKey, ...safe } = data;
    return {
      ...safe,
      cardNumber: cardNumber ? `****${cardNumber.slice(-4)}` : undefined,
    };
  }
}

// Example 6: Background Job with logging
@Injectable()
export class ReportGenerationService {
  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext('ReportGenerationService');
  }

  @LogMethodCalls({ includeArgs: true, includeResult: false })
  @LogPerformance(30000) // 30 second threshold for reports
  @LogBusiness('report_generated')
  async generateMonthlyReport(tenantId: string, month: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.business('report_generation_started', {
        tenantId,
        reportType: 'monthly',
        month,
      });
      
      // Generate report data
      const reportData = await this.collectReportData(tenantId, month);
      
      // Process and format data
      const formattedReport = await this.formatReport(reportData);
      
      // Save report
      const reportId = await this.saveReport(formattedReport, tenantId);
      
      // Send notification
      await this.notifyReportCompletion(tenantId, reportId);
      
      const duration = Date.now() - startTime;
      
      this.logger.business('report_generated', {
        tenantId,
        reportId,
        reportType: 'monthly',
        month,
        duration,
        recordCount: reportData.length,
      });
      
      this.logger.performance('generate_monthly_report', duration, {
        tenantId,
        reportId,
        recordCount: reportData.length,
      });
      
    } catch (error) {
      this.logger.error(
        'Report generation failed',
        error.stack,
        {
          tenantId,
          month,
          duration: Date.now() - startTime,
        },
      );
      throw error;
    }
  }

  private async collectReportData(tenantId: string, month: string): Promise<any[]> {
    // Mock data collection
    return Array.from({ length: 1000 }, (_, i) => ({ id: i, data: 'mock' }));
  }

  private async formatReport(data: any[]): Promise<any> {
    // Mock report formatting
    return { summary: 'Report summary', data };
  }

  private async saveReport(report: any, tenantId: string): Promise<string> {
    // Mock report saving
    return `report_${Date.now()}`;
  }

  private async notifyReportCompletion(tenantId: string, reportId: string): Promise<void> {
    // Mock notification
    this.logger.audit('report_notification_sent', {
      tenantId,
      reportId,
      notificationType: 'email',
    });
  }
}

// Example 7: Error Handling with Comprehensive Logging
@Injectable()
export class ErrorHandlingService {
  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext('ErrorHandlingService');
  }

  async handleBusinessError(error: any, context: any): Promise<void> {
    // Comprehensive error logging with context
    
    this.logger.error(
      'Business operation failed',
      error.stack,
      {
        errorType: error.constructor.name,
        errorCode: error.code,
        errorMessage: error.message,
        context,
        severity: this.determineSeverity(error),
        affectedUsers: this.getAffectedUsers(error, context),
        businessImpact: this.assessBusinessImpact(error, context),
      },
    );
    
    // Log security implications if applicable
    if (this.isSecurityRelated(error)) {
      this.logger.security('security_error_detected', {
        errorType: error.constructor.name,
        context,
        potentialThreat: this.assessThreat(error),
      });
    }
    
    // Log business impact
    if (this.hasBusinessImpact(error)) {
      this.logger.business('business_operation_failed', {
        errorType: error.constructor.name,
        context,
        estimatedLoss: this.estimateRevenueLoss(error, context),
        affectedCustomers: this.getAffectedCustomers(error, context),
      });
    }
  }

  private determineSeverity(error: any): 'low' | 'medium' | 'high' | 'critical' {
    // Determine error severity based on type and impact
    return 'medium';
  }

  private getAffectedUsers(error: any, context: any): number {
    // Calculate number of affected users
    return 1;
  }

  private assessBusinessImpact(error: any, context: any): string {
    // Assess business impact of the error
    return 'minimal';
  }

  private isSecurityRelated(error: any): boolean {
    // Check if error has security implications
    return error.message.includes('unauthorized') || error.message.includes('forbidden');
  }

  private assessThreat(error: any): string {
    // Assess potential security threat
    return 'low';
  }

  private hasBusinessImpact(error: any): boolean {
    // Check if error affects business operations
    return error.message.includes('payment') || error.message.includes('order');
  }

  private estimateRevenueLoss(error: any, context: any): number {
    // Estimate potential revenue loss
    return 0;
  }

  private getAffectedCustomers(error: any, context: any): number {
    // Get number of affected customers
    return 0;
  }
}

/**
 * Usage in Application Module
 */
/*
@Module({
  imports: [
    LoggerModule, // Provides all logging capabilities
    // Other modules
  ],
  providers: [
    UserManagementService,
    UserResolver,
    CacheService,
    UserRepository,
    PaymentService,
    ReportGenerationService,
    ErrorHandlingService,
  ],
})
export class ApplicationModule {}
*/

/**
 * Global Interceptor Setup
 */
/*
@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggerInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: GraphQLLoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceLoggingInterceptor,
    },
  ],
})
export class AppModule {}
*/