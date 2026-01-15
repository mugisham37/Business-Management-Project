import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Injectable } from '@nestjs/common';

/**
 * Interface for unique field validation service
 */
export interface UniqueValidationService {
  isUnique(table: string, field: string, value: any, excludeId?: string): Promise<boolean>;
}

/**
 * Async validator for unique fields in database
 */
@ValidatorConstraint({ name: 'isUnique', async: true })
@Injectable()
export class IsUniqueConstraint implements ValidatorConstraintInterface {
  constructor(private readonly validationService: UniqueValidationService) {}

  async validate(value: any, args: ValidationArguments): Promise<boolean> {
    const [table, field, excludeId] = args.constraints;
    
    if (!value) return true; // Let other validators handle required validation
    
    return this.validationService.isUnique(table, field, value, excludeId);
  }

  defaultMessage(args: ValidationArguments): string {
    const [table, field] = args.constraints;
    return `${args.property} must be unique in ${table}.${field}`;
  }
}

/**
 * Unique field validation decorator
 */
export function IsUnique(
  table: string,
  field?: string,
  excludeId?: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    const decoratorOptions: {
      target: Function;
      propertyName: string;
      options?: ValidationOptions;
      constraints: (string | undefined)[];
      validator: typeof IsUniqueConstraint;
    } = {
      target: object.constructor,
      propertyName: propertyName,
      constraints: [table, field || propertyName, excludeId],
      validator: IsUniqueConstraint,
    };
    
    if (validationOptions !== undefined) {
      decoratorOptions.options = validationOptions;
    }
    
    registerDecorator(decoratorOptions);
  };
}

/**
 * Interface for existence validation service
 */
export interface ExistsValidationService {
  exists(table: string, field: string, value: any): Promise<boolean>;
}

/**
 * Async validator for checking if referenced entity exists
 */
@ValidatorConstraint({ name: 'exists', async: true })
@Injectable()
export class ExistsConstraint implements ValidatorConstraintInterface {
  constructor(private readonly validationService: ExistsValidationService) {}

  async validate(value: any, args: ValidationArguments): Promise<boolean> {
    const [table, field] = args.constraints;
    
    if (!value) return true; // Let other validators handle required validation
    
    return this.validationService.exists(table, field, value);
  }

  defaultMessage(args: ValidationArguments): string {
    const [table, field] = args.constraints;
    return `${args.property} must reference an existing record in ${table}.${field}`;
  }
}

/**
 * Entity exists validation decorator
 */
export function Exists(
  table: string,
  field?: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    const decoratorOptions: {
      target: Function;
      propertyName: string;
      options?: ValidationOptions;
      constraints: string[];
      validator: typeof ExistsConstraint;
    } = {
      target: object.constructor,
      propertyName: propertyName,
      constraints: [table, field || 'id'],
      validator: ExistsConstraint,
    };
    
    if (validationOptions !== undefined) {
      decoratorOptions.options = validationOptions;
    }
    
    registerDecorator(decoratorOptions);
  };
}

/**
 * Interface for tenant-specific validation service
 */
export interface TenantValidationService {
  belongsToTenant(table: string, field: string, value: any, tenantId: string): Promise<boolean>;
}

/**
 * Async validator for checking if entity belongs to current tenant
 */
@ValidatorConstraint({ name: 'belongsToTenant', async: true })
@Injectable()
export class BelongsToTenantConstraint implements ValidatorConstraintInterface {
  constructor(private readonly validationService: TenantValidationService) {}

  async validate(value: any, args: ValidationArguments): Promise<boolean> {
    const [table, field, tenantId] = args.constraints;
    
    if (!value || !tenantId) return true;
    
    return this.validationService.belongsToTenant(table, field, value, tenantId);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must belong to the current tenant`;
  }
}

/**
 * Tenant ownership validation decorator
 */
export function BelongsToTenant(
  table: string,
  field?: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    const decoratorOptions: {
      target: Function;
      propertyName: string;
      options?: ValidationOptions;
      constraints: string[];
      validator: typeof BelongsToTenantConstraint;
    } = {
      target: object.constructor,
      propertyName: propertyName,
      constraints: [table, field || 'id'],
      validator: BelongsToTenantConstraint,
    };
    
    if (validationOptions !== undefined) {
      decoratorOptions.options = validationOptions;
    }
    
    registerDecorator(decoratorOptions);
  };
}

/**
 * Interface for business rule validation service
 */
export interface BusinessRuleValidationService {
  validateBusinessRule(ruleName: string, value: any, context: any): Promise<boolean>;
}

/**
 * Async validator for custom business rules
 */
@ValidatorConstraint({ name: 'businessRule', async: true })
@Injectable()
export class BusinessRuleConstraint implements ValidatorConstraintInterface {
  constructor(private readonly validationService: BusinessRuleValidationService) {}

  async validate(value: any, args: ValidationArguments): Promise<boolean> {
    const [ruleName, context] = args.constraints;
    
    return this.validationService.validateBusinessRule(ruleName, value, context);
  }

  defaultMessage(args: ValidationArguments): string {
    const [ruleName] = args.constraints;
    return `${args.property} violates business rule: ${ruleName}`;
  }
}

/**
 * Business rule validation decorator
 */
export function ValidateBusinessRule(
  ruleName: string,
  context?: any,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    const decoratorOptions: {
      target: Function;
      propertyName: string;
      options?: ValidationOptions;
      constraints: any[];
      validator: typeof BusinessRuleConstraint;
    } = {
      target: object.constructor,
      propertyName: propertyName,
      constraints: [ruleName, context],
      validator: BusinessRuleConstraint,
    };
    
    if (validationOptions !== undefined) {
      decoratorOptions.options = validationOptions;
    }
    
    registerDecorator(decoratorOptions);
  };
}

/**
 * Async validator for file validation (size, type, etc.)
 */
@ValidatorConstraint({ name: 'fileValidation', async: true })
@Injectable()
export class FileValidationConstraint implements ValidatorConstraintInterface {
  async validate(file: any, args: ValidationArguments): Promise<boolean> {
    if (!file) return true; // Let other validators handle required validation
    
    const [options] = args.constraints;
    const { maxSize, allowedTypes, maxFiles } = options || {};
    
    // Handle single file
    if (!Array.isArray(file)) {
      return this.validateSingleFile(file, { maxSize, allowedTypes });
    }
    
    // Handle multiple files
    if (maxFiles && file.length > maxFiles) {
      return false;
    }
    
    return file.every((f: any) => this.validateSingleFile(f, { maxSize, allowedTypes }));
  }

  private validateSingleFile(file: any, options: { maxSize?: number; allowedTypes?: string[] }): boolean {
    const { maxSize, allowedTypes } = options;
    
    if (maxSize && file.size > maxSize) {
      return false;
    }
    
    if (allowedTypes && !allowedTypes.includes(file.mimetype)) {
      return false;
    }
    
    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} contains invalid file(s)`;
  }
}

/**
 * File validation decorator
 */
export function ValidateFile(
  options?: {
    maxSize?: number;
    allowedTypes?: string[];
    maxFiles?: number;
  },
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    const decoratorOptions: {
      target: Function;
      propertyName: string;
      options?: ValidationOptions;
      constraints: ({ maxSize?: number; allowedTypes?: string[]; maxFiles?: number; } | undefined)[];
      validator: typeof FileValidationConstraint;
    } = {
      target: object.constructor,
      propertyName: propertyName,
      constraints: [options],
      validator: FileValidationConstraint,
    };
    
    if (validationOptions !== undefined) {
      decoratorOptions.options = validationOptions;
    }
    
    registerDecorator(decoratorOptions);
  };
}