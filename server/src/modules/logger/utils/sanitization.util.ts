/**
 * Sanitization utility for removing sensitive data from logs
 */
export class SanitizationUtil {
  /**
   * Sanitize arguments by redacting sensitive fields
   */
  static sanitizeArgs(args: any[], sensitiveFields?: string[]): any[] {
    if (!sensitiveFields || sensitiveFields.length === 0) return args;
    
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        return SanitizationUtil.sanitizeObject(arg, sensitiveFields);
      }
      return arg;
    });
  }

  /**
   * Sanitize result/response by redacting sensitive fields
   */
  static sanitizeResult(result: any, sensitiveFields?: string[]): any {
    if (!sensitiveFields || sensitiveFields.length === 0 || typeof result !== 'object' || result === null) {
      return result;
    }
    
    return SanitizationUtil.sanitizeObject(result, sensitiveFields);
  }

  /**
   * Recursively sanitize object properties
   */
  private static sanitizeObject(obj: any, sensitiveFields: string[]): any {
    if (Array.isArray(obj)) {
      return obj.map(item => {
        if (typeof item === 'object' && item !== null) {
          return SanitizationUtil.sanitizeObject(item, sensitiveFields);
        }
        return item;
      });
    }

    const sanitized = { ...obj };
    sensitiveFields.forEach(field => {
      if (field in sanitized && sanitized[field] !== undefined && sanitized[field] !== null) {
        sanitized[field] = '[REDACTED]';
      }
    });
    return sanitized;
  }
}
