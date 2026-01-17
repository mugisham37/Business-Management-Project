import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to log B2B operations for audit purposes
 * 
 * Logs all B2B-related operations including:
 * - Order creation, updates, approvals
 * - Quote generation and conversions
 * - Contract modifications
 * - Pricing changes
 * - Territory assignments
 */
@Injectable()
export class AuditLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditLoggingMiddleware.name);

  async use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const originalSend = res.send;

    // Override response send to capture response data
    res.send = function(data) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Log the operation if it's a B2B-related GraphQL operation
      if (req.body?.query && req.user?.tenantId) {
        const operation = extractGraphQLOperation(req.body.query);
        
        if (isB2BOperation(operation)) {
          const auditLog = {
            timestamp: new Date().toISOString(),
            tenantId: req.user.tenantId,
            userId: req.user.id,
            userEmail: req.user.email,
            operation,
            variables: req.body.variables,
            duration,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            success: res.statusCode < 400,
            statusCode: res.statusCode,
          };

          // Log based on operation type
          if (isCriticalOperation(operation)) {
            console.log('B2B_AUDIT_CRITICAL:', JSON.stringify(auditLog));
          } else {
            console.log('B2B_AUDIT:', JSON.stringify(auditLog));
          }
        }
      }

      return originalSend.call(this, data);
    };

    next();
  }
}

/**
 * Extract GraphQL operation name from query
 */
function extractGraphQLOperation(query: string): string {
  const match = query.match(/(?:query|mutation|subscription)\s+(\w+)/);
  return match ? match[1] : 'unknown';
}

/**
 * Check if operation is B2B-related
 */
function isB2BOperation(operation: string): boolean {
  const b2bOperations = [
    'createB2BOrder',
    'updateB2BOrder',
    'approveOrder',
    'rejectOrder',
    'shipOrder',
    'createQuote',
    'updateQuote',
    'convertQuoteToOrder',
    'createContract',
    'updateContract',
    'assignTerritory',
    'updatePricing',
    'createCustomerPortalUser',
  ];

  return b2bOperations.some(op => operation.toLowerCase().includes(op.toLowerCase()));
}

/**
 * Check if operation is critical and requires detailed logging
 */
function isCriticalOperation(operation: string): boolean {
  const criticalOperations = [
    'approveOrder',
    'rejectOrder',
    'createContract',
    'updateContract',
    'updatePricing',
    'assignTerritory',
  ];

  return criticalOperations.some(op => operation.toLowerCase().includes(op.toLowerCase()));
}