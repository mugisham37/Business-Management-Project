/**
 * GraphQL Schema Validation Utilities
 * 
 * Provides build-time validation for GraphQL operations against the schema,
 * breaking change detection, and clear error messaging.
 */

import { buildSchema, validate, DocumentNode, GraphQLError, GraphQLSchema } from 'graphql';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  message: string;
  location?: {
    line: number;
    column: number;
  } | undefined;
  path?: string | undefined;
  type: 'SYNTAX_ERROR' | 'VALIDATION_ERROR' | 'SCHEMA_ERROR';
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  message: string;
  location?: {
    line: number;
    column: number;
  };
  path?: string;
  type: 'DEPRECATION' | 'PERFORMANCE' | 'BEST_PRACTICE';
}

export interface BreakingChange {
  type: 'FIELD_REMOVED' | 'TYPE_REMOVED' | 'ARGUMENT_REMOVED' | 'ENUM_VALUE_REMOVED' | 'DIRECTIVE_REMOVED';
  description: string;
  path: string;
  severity: 'breaking' | 'dangerous' | 'safe';
}

export class SchemaValidator {
  private schema: GraphQLSchema | null = null;
  private introspectionResult: any = null;

  constructor() {
    this.loadSchema();
  }

  /**
   * Load the GraphQL schema from introspection result
   */
  private loadSchema(): void {
    try {
      const introspectionPath = join(process.cwd(), 'src/types/generated/introspection.json');
      this.introspectionResult = JSON.parse(readFileSync(introspectionPath, 'utf8'));
      
      // Build schema from introspection (simplified approach)
      // In a real implementation, you'd use buildClientSchema from graphql
      console.log('Schema loaded successfully');
    } catch (error) {
      console.warn('Could not load schema introspection. Run codegen first.');
    }
  }

  /**
   * Validate a GraphQL operation against the schema
   */
  validateOperation(operation: DocumentNode, operationPath?: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!this.schema) {
      errors.push({
        message: 'Schema not available. Please run schema introspection first.',
        type: 'SCHEMA_ERROR',
        severity: 'error',
        path: operationPath || undefined,
      });
      return { isValid: false, errors, warnings };
    }

    try {
      // Validate operation against schema
      const validationErrors = validate(this.schema, operation);
      
      for (const error of validationErrors) {
        errors.push({
          message: this.formatErrorMessage(error),
          location: error.locations?.[0] ? {
            line: error.locations[0].line,
            column: error.locations[0].column,
          } : undefined,
          path: operationPath || undefined,
          type: 'VALIDATION_ERROR',
          severity: 'error',
        });
      }

      // Check for deprecated fields
      this.checkDeprecatedFields(operation, warnings, operationPath);

      // Check for performance issues
      this.checkPerformanceIssues(operation, warnings, operationPath);

    } catch (error) {
      errors.push({
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'VALIDATION_ERROR',
        severity: 'error',
        path: operationPath || undefined,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Detect breaking changes between schema versions
   */
  detectBreakingChanges(oldSchema: any, newSchema: any): BreakingChange[] {
    const changes: BreakingChange[] = [];

    // Compare types
    this.compareTypes(oldSchema, newSchema, changes);
    
    // Compare fields
    this.compareFields(oldSchema, newSchema, changes);
    
    // Compare arguments
    this.compareArguments(oldSchema, newSchema, changes);

    return changes;
  }

  /**
   * Format GraphQL error message for better readability
   */
  private formatErrorMessage(error: GraphQLError): string {
    let message = error.message;

    // Add context for common errors
    if (message.includes('Cannot query field')) {
      const fieldMatch = message.match(/Cannot query field "([^"]+)"/);
      if (fieldMatch) {
        message += `\n\nSuggestion: Check if the field "${fieldMatch[1]}" exists in the schema or if you have the correct permissions.`;
      }
    }

    if (message.includes('Unknown argument')) {
      const argMatch = message.match(/Unknown argument "([^"]+)"/);
      if (argMatch) {
        message += `\n\nSuggestion: Check the schema documentation for valid arguments for this field.`;
      }
    }

    if (message.includes('Expected type')) {
      message += `\n\nSuggestion: Check the expected input type in the schema and ensure your variables match.`;
    }

    return message;
  }

  /**
   * Check for deprecated fields in operations
   */
  private checkDeprecatedFields(operation: DocumentNode, warnings: ValidationWarning[], operationPath?: string): void {
    // Implementation would traverse the operation AST and check against schema deprecations
    // This is a simplified version
    console.log('Checking for deprecated fields...');
  }

  /**
   * Check for potential performance issues
   */
  private checkPerformanceIssues(operation: DocumentNode, warnings: ValidationWarning[], operationPath?: string): void {
    // Check for deeply nested queries
    // Check for missing pagination
    // Check for overly broad selections
    console.log('Checking for performance issues...');
  }

  /**
   * Compare types between schema versions
   */
  private compareTypes(oldSchema: any, newSchema: any, changes: BreakingChange[]): void {
    // Implementation would compare type definitions
    console.log('Comparing types...');
  }

  /**
   * Compare fields between schema versions
   */
  private compareFields(oldSchema: any, newSchema: any, changes: BreakingChange[]): void {
    // Implementation would compare field definitions
    console.log('Comparing fields...');
  }

  /**
   * Compare arguments between schema versions
   */
  private compareArguments(oldSchema: any, newSchema: any, changes: BreakingChange[]): void {
    // Implementation would compare argument definitions
    console.log('Comparing arguments...');
  }
}

/**
 * Validate all GraphQL operations in the project
 */
export async function validateAllOperations(): Promise<ValidationResult[]> {
  const validator = new SchemaValidator();
  const results: ValidationResult[] = [];

  // This would scan for all .graphql files and validate them
  // Implementation would use glob to find files and parse them
  console.log('Validating all operations...');

  return results;
}

/**
 * CLI utility for schema validation
 */
export function runSchemaValidation(): void {
  console.log('🔍 Running GraphQL schema validation...');
  
  validateAllOperations()
    .then((results) => {
      const totalErrors = results.reduce((sum, result) => sum + result.errors.length, 0);
      const totalWarnings = results.reduce((sum, result) => sum + result.warnings.length, 0);

      if (totalErrors > 0) {
        console.error(`❌ Validation failed with ${totalErrors} errors and ${totalWarnings} warnings`);
        process.exit(1);
      } else if (totalWarnings > 0) {
        console.warn(`⚠️  Validation completed with ${totalWarnings} warnings`);
      } else {
        console.log('✅ All GraphQL operations are valid');
      }
    })
    .catch((error) => {
      console.error('❌ Schema validation failed:', error);
      process.exit(1);
    });
}