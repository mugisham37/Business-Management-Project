import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ValidationPipe } from './pipes/validation.pipe';

/**
 * Global REST common module providing shared REST API functionality
 */
@Global()
@Module({
  providers: [
    // Global response interceptor for standardized responses
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    // Global exception filter for error handling
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Global validation pipe
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
  exports: [
    ResponseInterceptor,
    HttpExceptionFilter,
    ValidationPipe,
  ],
})
export class RestCommonModule {}