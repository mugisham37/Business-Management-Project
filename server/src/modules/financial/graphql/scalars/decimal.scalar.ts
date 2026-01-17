import { Scalar, CustomScalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';
import { GraphQLError } from 'graphql';

@Scalar('Decimal', () => String)
export class DecimalScalar implements CustomScalar<string, string> {
  description = 'Decimal custom scalar type for monetary values';

  parseValue(value: unknown): string {
    if (typeof value === 'string') {
      return this.validateDecimal(value);
    }
    if (typeof value === 'number') {
      return this.validateDecimal(value.toFixed(2));
    }
    throw new GraphQLError(`Value is not a valid decimal: ${value}`);
  }

  serialize(value: unknown): string {
    if (typeof value === 'string') {
      return this.validateDecimal(value);
    }
    if (typeof value === 'number') {
      return this.validateDecimal(value.toFixed(2));
    }
    throw new GraphQLError(`Value is not a valid decimal: ${value}`);
  }

  parseLiteral(ast: ValueNode): string {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT || ast.kind === Kind.FLOAT) {
      return this.validateDecimal(ast.value);
    }
    throw new GraphQLError(`Can only validate strings, integers, and floats as decimals but got a: ${ast.kind}`);
  }

  private validateDecimal(value: string): string {
    const decimalRegex = /^-?\d+(\.\d{1,2})?$/;
    if (!decimalRegex.test(value)) {
      throw new GraphQLError(`Value is not a valid decimal with up to 2 decimal places: ${value}`);
    }
    
    // Ensure exactly 2 decimal places
    const num = parseFloat(value);
    return num.toFixed(2);
  }
}