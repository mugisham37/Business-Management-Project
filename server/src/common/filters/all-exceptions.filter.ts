import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CustomLoggerService } from '../../modules/logger/logger.service';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error?: string;
  requestId?: string;
  tenantId?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext('AllExceptionsFilter');
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string | string[];
    let error: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string | string[]) ?? exception.message;
        error = responseObj.error as string;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = exception.name;
      
      // Log the full error for debugging
      this.logger.error('Unhandled exception', exception.stack, {
        requestId: (request as any).requestId,
        tenantId: (request as any).user?.tenantId,
        userId: (request as any).user?.id,
        url: request.url,
        method: request.method,
        errorMessage: exception.message,
        errorName: exception.name,
      });
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'UnknownError';
      
      this.logger.error('Unknown exception', String(exception), {
        requestId: (request as any).requestId,
        tenantId: (request as any).user?.tenantId,
        userId: (request as any).user?.id,
        url: request.url,
        method: request.method,
      });
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      requestId: (request as any).requestId,
      tenantId: (request as any).user?.tenantId,
    };

    if (error) {
      errorResponse.error = error;
    }

    // Security logging for authentication/authorization errors
    if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
      this.logger.security('Access denied', {
        statusCode: status,
        url: request.url,
        method: request.method,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
      }, {
        requestId: (request as any).requestId,
        tenantId: (request as any).user?.tenantId,
        userId: (request as any).user?.id,
      });
    }

    response.status(status).json(errorResponse);
  }
}

//