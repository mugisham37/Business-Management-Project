import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LogContext {
  tenantId?: string;
  userId?: string;
  requestId?: string;
  operation?: string;
  duration?: number;
  [key: string]: unknown;
}

@Injectable({ scope: Scope.TRANSIENT })
export class CustomLoggerService implements LoggerService {
  private context?: string;
  private readonly logLevel: string;

  constructor(private readonly configService: ConfigService) {
    this.logLevel = this.configService.get<string>('LOG_LEVEL', 'info');
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(message: string, context?: LogContext): void {
    this.printMessage('info', message, context);
  }

  error(message: string, trace?: string, context?: LogContext): void {
    this.printMessage('error', message, { ...context, trace });
  }

  warn(message: string, context?: LogContext): void {
    this.printMessage('warn', message, context);
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      this.printMessage('debug', message, context);
    }
  }

  verbose(message: string, context?: LogContext): void {
    if (this.shouldLog('verbose')) {
      this.printMessage('verbose', message, context);
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug', 'verbose'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private printMessage(level: string, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const logContext = this.context ? `[${this.context}]` : '';
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      context: this.context,
      message,
      ...context,
    };

    // In production, you might want to use a proper logging library like Winston
    // For now, we'll use console with structured logging
    if (level === 'error') {
      console.error(JSON.stringify(logEntry, null, 2));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(logEntry, null, 2));
    } else {
      console.log(JSON.stringify(logEntry, null, 2));
    }
  }

  // Audit logging for security and compliance
  audit(event: string, details: Record<string, unknown>, context?: LogContext): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      level: 'AUDIT',
      event,
      details,
      ...context,
    };
    
    console.log(JSON.stringify(auditEntry, null, 2));
  }

  // Performance logging
  performance(operation: string, duration: number, context?: LogContext): void {
    this.log(`Performance: ${operation} completed in ${duration}ms`, {
      ...context,
      operation,
      duration,
      type: 'performance',
    });
  }

  // Security logging
  security(event: string, details: Record<string, unknown>, context?: LogContext): void {
    const securityEntry = {
      timestamp: new Date().toISOString(),
      level: 'SECURITY',
      event,
      details,
      ...context,
    };
    
    console.warn(JSON.stringify(securityEntry, null, 2));
  }
}