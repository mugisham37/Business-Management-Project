import { Scalar, CustomScalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';

/**
 * Custom DateTime scalar for GraphQL
 */
@Scalar('DateTime', () => Date)
export class DateTimeScalar implements CustomScalar<string, Date> {
  description = 'Date custom scalar type';

  parseValue(value: unknown): Date {
    return new Date(value as string); // value from the client
  }

  serialize(value: unknown): string {
    return (value as Date).toISOString(); // value sent to the client
  }

  parseLiteral(ast: ValueNode): Date {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    throw new Error('DateTime scalar can only parse string values');
  }
}

/**
 * Custom JSON scalar for GraphQL
 */
@Scalar('JSON')
export class JSONScalar implements CustomScalar<any, any> {
  description = 'JSON custom scalar type';

  parseValue(value: unknown): any {
    return value; // value from the client
  }

  serialize(value: unknown): any {
    return value; // value sent to the client
  }

  parseLiteral(ast: ValueNode): any {
    if (ast.kind === Kind.STRING) {
      try {
        return JSON.parse(ast.value);
      } catch {
        throw new Error('Invalid JSON');
      }
    }
    return null;
  }
}

/**
 * Custom UUID scalar for GraphQL
 */
@Scalar('UUID', () => String)
export class UUIDScalar implements CustomScalar<string, string> {
  description = 'UUID custom scalar type';

  parseValue(value: unknown): string {
    const stringValue = value as string;
    if (!this.isValidUUID(stringValue)) {
      throw new Error('Invalid UUID format');
    }
    return stringValue;
  }

  serialize(value: unknown): string {
    const stringValue = value as string;
    if (!this.isValidUUID(stringValue)) {
      throw new Error('Invalid UUID format');
    }
    return stringValue;
  }

  parseLiteral(ast: ValueNode): string {
    if (ast.kind === Kind.STRING) {
      if (!this.isValidUUID(ast.value)) {
        throw new Error('Invalid UUID format');
      }
      return ast.value;
    }
    throw new Error('UUID scalar can only parse string values');
  }

  private isValidUUID(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }
}

/**
 * Custom Decimal scalar for GraphQL (for monetary values)
 */
@Scalar('Decimal', () => Number)
export class DecimalScalar implements CustomScalar<string, number> {
  description = 'Decimal custom scalar type for monetary values';

  parseValue(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }
    const parsed = parseFloat(value as string);
    if (isNaN(parsed)) {
      throw new Error('Invalid decimal format');
    }
    return parsed;
  }

  serialize(value: unknown): string {
    return (value as number).toFixed(2); // Always return 2 decimal places for monetary values
  }

  parseLiteral(ast: ValueNode): number {
    if (ast.kind === Kind.FLOAT || ast.kind === Kind.INT) {
      return parseFloat(ast.value);
    }
    if (ast.kind === Kind.STRING) {
      const parsed = parseFloat(ast.value);
      if (isNaN(parsed)) {
        throw new Error('Invalid decimal format');
      }
      return parsed;
    }
    throw new Error('Decimal scalar can only parse numeric values');
  }
}