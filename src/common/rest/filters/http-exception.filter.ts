import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter for REST API error handling
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let errors: any[] = [];
    let code: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        errors = responseObj.errors || [];
        code = responseObj.code || this.getErrorCode(status);

        // Handle validation errors
        if (Array.isArray(responseObj.message)) {
          message = 'Validation failed';
          errors = responseObj.message;
          code = 'VALIDATION_ERROR';
        }
      } else {
        message = exceptionResponse as string;
        code = this.getErrorCode(status);
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      code = 'INTERNAL_ERROR';
      
      // Log unexpected errors
      this.logger.error(
        `Unexpected error: ${exception.message}`,
        exception.stack,
        `${request.method} ${request.url}`,
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Unknown error occurred';
      code = 'UNKNOWN_ERROR';
      
      this.logger.error(
        `Unknown error: ${JSON.stringify(exception)}`,
        undefined,
        `${request.method} ${request.url}`,
      );
    }

    // Get API version from URL
    const version = this.getApiVersion(request.url);

    // Create standardized error response
    const errorResponse = {
      success: false,
      message,
      errors: errors.length > 0 ? errors : undefined,
      code,
      timestamp: new Date().toISOString(),
      version,
      path: request.url,
      method: request.method,
    };

    // Log error for monitoring (exclude validation errors)
    if (status >= 500) {
      this.logger.error(
        `HTTP ${status} Error: ${message}`,
        JSON.stringify(errorResponse),
        `${request.method} ${request.url}`,
      );
    } else if (status >= 400 && code !== 'VALIDATION_ERROR') {
      this.logger.warn(
        `HTTP ${status} Error: ${message}`,
        `${request.method} ${request.url}`,
      );
    }

    response.status(status).json(errorResponse);
  }

  private getApiVersion(url: string): string {
    const versionMatch = url.match(/\/api\/v(\d+)\//);
    return versionMatch?.[1] ?? '1';
  }

  private getErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.METHOD_NOT_ALLOWED:
        return 'METHOD_NOT_ALLOWED';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_ERROR';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'INTERNAL_ERROR';
      case HttpStatus.BAD_GATEWAY:
        return 'BAD_GATEWAY';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      case HttpStatus.GATEWAY_TIMEOUT:
        return 'GATEWAY_TIMEOUT';
      default:
        return 'UNKNOWN_ERROR';
    }
  }
}