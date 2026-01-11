import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe as NestValidationPipe,
} from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';

/**
 * Enhanced validation pipe with detailed error messages
 */
@Injectable()
export class ValidationPipe extends NestValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors: ValidationError[]) => {
        const formattedErrors = this.formatValidationErrors(errors);
        return new BadRequestException({
          message: 'Validation failed',
          errors: formattedErrors,
          code: 'VALIDATION_ERROR',
        });
      },
    });
  }

  private formatValidationErrors(errors: ValidationError[]): any[] {
    return errors.map((error) => ({
      field: error.property,
      value: error.value,
      constraints: error.constraints,
      children: error.children && error.children.length > 0 ? this.formatValidationErrors(error.children) : undefined,
    }));
  }
}

/**
 * Custom validation pipe for query parameters
 */
@Injectable()
export class QueryValidationPipe implements PipeTransform {
  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    if (!metadata.metatype || !this.toValidate(metadata.metatype)) {
      return value;
    }

    const object = plainToClass(metadata.metatype, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: false, // More lenient for query params
      transform: true,
    });

    if (errors.length > 0) {
      const formattedErrors = this.formatValidationErrors(errors);
      throw new BadRequestException({
        message: 'Invalid query parameters',
        errors: formattedErrors,
        code: 'QUERY_VALIDATION_ERROR',
      });
    }

    return object;
  }

  private toValidate(metatype: any): boolean {
    const types = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private formatValidationErrors(errors: ValidationError[]): any[] {
    return errors.map((error) => ({
      field: error.property,
      value: error.value,
      constraints: error.constraints,
      children: error.children && error.children.length > 0 ? this.formatValidationErrors(error.children) : undefined,
    }));
  }
}

/**
 * Custom validation pipe for file uploads
 */
@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(
    private readonly options: {
      maxSize?: number;
      allowedMimeTypes?: string[];
      required?: boolean;
    } = {},
  ) {}

  transform(file: any): any {
    if (!file && this.options.required) {
      throw new BadRequestException({
        message: 'File is required',
        code: 'FILE_REQUIRED',
      });
    }

    if (!file) {
      return file;
    }

    // Check file size
    if (this.options.maxSize && file.size > this.options.maxSize) {
      throw new BadRequestException({
        message: `File size exceeds maximum allowed size of ${this.options.maxSize} bytes`,
        code: 'FILE_TOO_LARGE',
      });
    }

    // Check MIME type
    if (this.options.allowedMimeTypes && !this.options.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException({
        message: `File type ${file.mimetype} is not allowed. Allowed types: ${this.options.allowedMimeTypes.join(', ')}`,
        code: 'INVALID_FILE_TYPE',
      });
    }

    return file;
  }
}