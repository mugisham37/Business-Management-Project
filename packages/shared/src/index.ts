// Entities
export * from './entities';

// Value Objects
export * from './value-objects';

// Types (excluding conflicting exports)
export type {
  AuthStrategy,
  DatabaseProvider,
  DeepPartial,
  EventPayload,
  ID,
  JSONArray,
  JSONObject,
  JSONValue,
  Optional,
  RequiredFields,
  SortDirection,
  Timestamp,
  TokenType,
} from './types';

// Export type versions with different names to avoid conflicts
export type {
  ContentType as ContentTypeUnion,
  EventType as EventTypeUnion,
  HttpMethod as HttpMethodUnion,
} from './types';

// Utils (excluding conflicting guard functions)
export {
  calculatePercentile,
  createAuditActor,
  createAuditChanges,
  createAuditContext,
  createAuditEventData,
  createAuditLogContext,
  createAuditOutcome,
  createAuditResource,
  createAuthLogContext,
  createBusinessLogContext,
  createErrorContext,
  createErrorLogContext,
  createLogContext,
  createPerformanceLogContext,
  createSecurityEvent,
  createSecurityLogContext,
  formatDuration,
  generateId,
  generateSpanId,
  getResourceUsage,
  getResponseSize,
  isValidSecurityEventType,
  safeAssign,
  safeGet,
  safeGetProperty,
  safeGetWithDefault,
  toSecurityEventType,
  withDefinedProperties,
} from './utils';

// Export utils type guards with different names
export {
  isDefined as isDefinedUtil,
  isNumber as isNumberUtil,
  isString as isStringUtil,
} from './utils';

// Export all monitoring types
export type {
  Alert as BaseAlert,
  AuditActor as BaseAuditActor,
  AuditChanges as BaseAuditChanges,
  AuditContext as BaseAuditContext,
  AuditEvent as BaseAuditEvent,
  AuditLogContext as BaseAuditLogContext,
  AuditOutcome as BaseAuditOutcome,
  AuditResource as BaseAuditResource,
  AuthLogContext as BaseAuthLogContext,
  BusinessLogContext as BaseBusinessLogContext,
  ErrorLogContext as BaseErrorLogContext,
  LogContext as BaseLogContext,
  PerformanceAlert as BasePerformanceAlert,
  PerformanceLogContext as BasePerformanceLogContext,
  PerformanceMetric as BasePerformanceMetric,
  PerformanceStats as BasePerformanceStats,
  SecurityEvent as BaseSecurityEvent,
  SecurityLogContext as BaseSecurityLogContext,
  ServiceStatus as BaseServiceStatus,
} from './utils';

// Constants
export * from './constants';

// Validators
export * from './validators';

// Interfaces
export * from './interfaces';

// Enums (preferred source for ContentType, EventType, HttpMethod)
export * from './enums';

// Errors
export * from './errors';

// Guards (preferred source for isDefined, isNumber, isString)
export * from './guards';
