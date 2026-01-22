import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LocationService } from './location.service';
import { LocationAuditService } from './location-audit.service';
import { CreateLocationDto, UpdateLocationDto, LocationStatus } from '../dto/location.dto';
import { Location } from '../entities/location.entity';

export interface BulkOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  id?: string;
}

export interface BulkCreateRequest {
  locations: CreateLocationDto[];
  validateOnly?: boolean;
  continueOnError?: boolean;
}

export interface BulkUpdateRequest {
  updates: Array<{
    locationId: string;
    data: UpdateLocationDto;
  }>;
  validateOnly?: boolean;
  continueOnError?: boolean;
}

export interface BulkStatusChangeRequest {
  locationIds: string[];
  newStatus: LocationStatus;
  reason?: string;
  validateOnly?: boolean;
  continueOnError?: boolean;
}

export interface BulkDeleteRequest {
  locationIds: string[];
  reason?: string;
  validateOnly?: boolean;
  continueOnError?: boolean;
}

export interface BulkOperationSummary {
  operationId: string;
  operationType: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELETE';
  tenantId: string;
  userId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  results: BulkOperationResult[];
  errors: string[];
  validationErrors: string[];
}

@Injectable()
export class LocationBulkService {
  private readonly logger = new Logger(LocationBulkService.name);
  
  // In-memory storage for operation tracking
  private operations: Map<string, BulkOperationSummary> = new Map();

  constructor(
    private readonly locationService: LocationService,
    private readonly auditService: LocationAuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Bulk create locations
   */
  async bulkCreateLocations(
    tenantId: string,
    request: BulkCreateRequest,
    userId: string,
  ): Promise<BulkOperationSummary> {
    const operationId = this.generateOperationId();
    
    const operation: BulkOperationSummary = {
      operationId,
      operationType: 'CREATE',
      tenantId,
      userId,
      startedAt: new Date(),
      status: 'PENDING',
      totalItems: request.locations.length,
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      results: [],
      errors: [],
      validationErrors: [],
    };

    this.operations.set(operationId, operation);

    try {
      // Validation phase
      operation.status = 'IN_PROGRESS';
      const validationErrors = await this.validateBulkCreate(tenantId, request.locations);
      operation.validationErrors = validationErrors;

      if (validationErrors.length > 0 && !request.continueOnError) {
        operation.status = 'FAILED';
        operation.completedAt = new Date();
        operation.errors.push('Validation failed. Use continueOnError=true to proceed with valid items.');
        return operation;
      }

      if (request.validateOnly) {
        operation.status = 'COMPLETED';
        operation.completedAt = new Date();
        return operation;
      }

      // Processing phase
      for (let i = 0; i < request.locations.length; i++) {
        const locationData = request.locations[i];
        
        // Skip if location data is undefined
        if (!locationData) {
          operation.results.push({
            success: false,
            error: 'Invalid location data',
            id: `item-${i}`,
          });
          operation.failedItems++;
          operation.processedItems++;
          continue;
        }
        
        try {
          // Skip invalid items if continueOnError is true
          const itemValidationErrors = await this.validateSingleLocation(tenantId, locationData);
          if (itemValidationErrors.length > 0 && request.continueOnError) {
            operation.results.push({
              success: false,
              error: `Validation failed: ${itemValidationErrors.join(', ')}`,
              id: locationData.code,
            });
            operation.failedItems++;
            operation.processedItems++;
            continue;
          }

          const location = await this.locationService.create(tenantId, locationData, userId);
          
          operation.results.push({
            success: true,
            data: location,
            id: location.id,
          });
          operation.successfulItems++;
        } catch (error: any) {
          const errorMessage = error.message || 'Unknown error';
          operation.results.push({
            success: false,
            error: errorMessage,
            id: locationData.code || `item-${i}`,
          });
          operation.failedItems++;
          operation.errors.push(`Location ${locationData.code || i}: ${errorMessage}`);

          if (!request.continueOnError) {
            operation.status = 'FAILED';
            operation.completedAt = new Date();
            return operation;
          }
        }
        
        operation.processedItems++;
      }

      // Complete operation
      operation.status = operation.failedItems > 0 ? 'PARTIAL' : 'COMPLETED';
      operation.completedAt = new Date();

      // Create audit entry
      await this.auditService.createAuditEntry(
        tenantId,
        'BULK_OPERATION',
        'CREATE',
        userId,
        [{ field: 'bulk_create', oldValue: null, newValue: `${operation.successfulItems} locations created` }],
        { source: 'API', reason: `Bulk create operation ${operationId}` },
      );

      // Emit event
      this.eventEmitter.emit('location.bulk.created', {
        tenantId,
        operationId,
        operation,
        userId,
      });

      this.logger.log(`Bulk create completed: ${operation.successfulItems}/${operation.totalItems} successful`);
      return operation;
    } catch (error: any) {
      operation.status = 'FAILED';
      operation.completedAt = new Date();
      operation.errors.push(error.message);
      this.logger.error(`Bulk create failed: ${error.message}`, error.stack);
      return operation;
    }
  }

  /**
   * Bulk update locations
   */
  async bulkUpdateLocations(
    tenantId: string,
    request: BulkUpdateRequest,
    userId: string,
  ): Promise<BulkOperationSummary> {
    const operationId = this.generateOperationId();
    
    const operation: BulkOperationSummary = {
      operationId,
      operationType: 'UPDATE',
      tenantId,
      userId,
      startedAt: new Date(),
      status: 'PENDING',
      totalItems: request.updates.length,
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      results: [],
      errors: [],
      validationErrors: [],
    };

    this.operations.set(operationId, operation);

    try {
      operation.status = 'IN_PROGRESS';

      // Validation phase
      const validationErrors = await this.validateBulkUpdate(tenantId, request.updates);
      operation.validationErrors = validationErrors;

      if (validationErrors.length > 0 && !request.continueOnError) {
        operation.status = 'FAILED';
        operation.completedAt = new Date();
        operation.errors.push('Validation failed. Use continueOnError=true to proceed with valid items.');
        return operation;
      }

      if (request.validateOnly) {
        operation.status = 'COMPLETED';
        operation.completedAt = new Date();
        return operation;
      }

      // Processing phase
      for (const update of request.updates) {
        try {
          const location = await this.locationService.update(tenantId, update.locationId, update.data, userId);
          
          operation.results.push({
            success: true,
            data: location,
            id: update.locationId,
          });
          operation.successfulItems++;
        } catch (error: any) {
          const errorMessage = error.message || 'Unknown error';
          operation.results.push({
            success: false,
            error: errorMessage,
            id: update.locationId,
          });
          operation.failedItems++;
          operation.errors.push(`Location ${update.locationId}: ${errorMessage}`);

          if (!request.continueOnError) {
            operation.status = 'FAILED';
            operation.completedAt = new Date();
            return operation;
          }
        }
        
        operation.processedItems++;
      }

      // Complete operation
      operation.status = operation.failedItems > 0 ? 'PARTIAL' : 'COMPLETED';
      operation.completedAt = new Date();

      // Create audit entry
      await this.auditService.createAuditEntry(
        tenantId,
        'BULK_OPERATION',
        'UPDATE',
        userId,
        [{ field: 'bulk_update', oldValue: null, newValue: `${operation.successfulItems} locations updated` }],
        { source: 'API', reason: `Bulk update operation ${operationId}` },
      );

      this.logger.log(`Bulk update completed: ${operation.successfulItems}/${operation.totalItems} successful`);
      return operation;
    } catch (error: any) {
      operation.status = 'FAILED';
      operation.completedAt = new Date();
      operation.errors.push(error.message);
      this.logger.error(`Bulk update failed: ${error.message}`, error.stack);
      return operation;
    }
  }

  /**
   * Bulk change location status
   */
  async bulkChangeStatus(
    tenantId: string,
    request: BulkStatusChangeRequest,
    userId: string,
  ): Promise<BulkOperationSummary> {
    const operationId = this.generateOperationId();
    
    const operation: BulkOperationSummary = {
      operationId,
      operationType: 'STATUS_CHANGE',
      tenantId,
      userId,
      startedAt: new Date(),
      status: 'PENDING',
      totalItems: request.locationIds.length,
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      results: [],
      errors: [],
      validationErrors: [],
    };

    this.operations.set(operationId, operation);

    try {
      operation.status = 'IN_PROGRESS';

      if (request.validateOnly) {
        // Validate that all locations exist
        for (const locationId of request.locationIds) {
          try {
            await this.locationService.findById(tenantId, locationId);
          } catch (error: any) {
            operation.validationErrors.push(`Location ${locationId}: ${error.message}`);
          }
        }
        
        operation.status = 'COMPLETED';
        operation.completedAt = new Date();
        return operation;
      }

      // Processing phase
      for (const locationId of request.locationIds) {
        try {
          const location = await this.locationService.update(
            tenantId, 
            locationId, 
            { status: request.newStatus }, 
            userId
          );
          
          // Emit status change event
          this.eventEmitter.emit('location.status.changed', {
            tenantId,
            locationId,
            oldStatus: location.status, // This would need to be tracked
            newStatus: request.newStatus,
            userId,
            reason: request.reason,
          });
          
          operation.results.push({
            success: true,
            data: location,
            id: locationId,
          });
          operation.successfulItems++;
        } catch (error: any) {
          const errorMessage = error.message || 'Unknown error';
          operation.results.push({
            success: false,
            error: errorMessage,
            id: locationId,
          });
          operation.failedItems++;
          operation.errors.push(`Location ${locationId}: ${errorMessage}`);

          if (!request.continueOnError) {
            operation.status = 'FAILED';
            operation.completedAt = new Date();
            return operation;
          }
        }
        
        operation.processedItems++;
      }

      // Complete operation
      operation.status = operation.failedItems > 0 ? 'PARTIAL' : 'COMPLETED';
      operation.completedAt = new Date();

      this.logger.log(`Bulk status change completed: ${operation.successfulItems}/${operation.totalItems} successful`);
      return operation;
    } catch (error: any) {
      operation.status = 'FAILED';
      operation.completedAt = new Date();
      operation.errors.push(error.message);
      this.logger.error(`Bulk status change failed: ${error.message}`, error.stack);
      return operation;
    }
  }

  /**
   * Bulk delete locations
   */
  async bulkDeleteLocations(
    tenantId: string,
    request: BulkDeleteRequest,
    userId: string,
  ): Promise<BulkOperationSummary> {
    const operationId = this.generateOperationId();
    
    const operation: BulkOperationSummary = {
      operationId,
      operationType: 'DELETE',
      tenantId,
      userId,
      startedAt: new Date(),
      status: 'PENDING',
      totalItems: request.locationIds.length,
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      results: [],
      errors: [],
      validationErrors: [],
    };

    this.operations.set(operationId, operation);

    try {
      operation.status = 'IN_PROGRESS';

      if (request.validateOnly) {
        // Validate that all locations exist and can be deleted
        for (const locationId of request.locationIds) {
          try {
            const location = await this.locationService.findById(tenantId, locationId);
            
            // Check if location has children
            const children = await this.locationService.findChildren(tenantId, locationId);
            if (children.length > 0) {
              operation.validationErrors.push(`Location ${locationId} has ${children.length} child locations`);
            }
          } catch (error: any) {
            operation.validationErrors.push(`Location ${locationId}: ${error.message}`);
          }
        }
        
        operation.status = 'COMPLETED';
        operation.completedAt = new Date();
        return operation;
      }

      // Processing phase
      for (const locationId of request.locationIds) {
        try {
          await this.locationService.delete(tenantId, locationId, userId);
          
          // Emit delete event
          this.eventEmitter.emit('location.deleted', {
            tenantId,
            locationId,
            userId,
            reason: request.reason,
          });
          
          operation.results.push({
            success: true,
            id: locationId,
          });
          operation.successfulItems++;
        } catch (error: any) {
          const errorMessage = error.message || 'Unknown error';
          operation.results.push({
            success: false,
            error: errorMessage,
            id: locationId,
          });
          operation.failedItems++;
          operation.errors.push(`Location ${locationId}: ${errorMessage}`);

          if (!request.continueOnError) {
            operation.status = 'FAILED';
            operation.completedAt = new Date();
            return operation;
          }
        }
        
        operation.processedItems++;
      }

      // Complete operation
      operation.status = operation.failedItems > 0 ? 'PARTIAL' : 'COMPLETED';
      operation.completedAt = new Date();

      this.logger.log(`Bulk delete completed: ${operation.successfulItems}/${operation.totalItems} successful`);
      return operation;
    } catch (error: any) {
      operation.status = 'FAILED';
      operation.completedAt = new Date();
      operation.errors.push(error.message);
      this.logger.error(`Bulk delete failed: ${error.message}`, error.stack);
      return operation;
    }
  }

  /**
   * Get bulk operation status
   */
  async getBulkOperationStatus(operationId: string): Promise<BulkOperationSummary | null> {
    return this.operations.get(operationId) || null;
  }

  /**
   * Get all bulk operations for a tenant
   */
  async getTenantBulkOperations(
    tenantId: string,
    limit: number = 50,
  ): Promise<BulkOperationSummary[]> {
    const operations = Array.from(this.operations.values())
      .filter(op => op.tenantId === tenantId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);

    return operations;
  }

  /**
   * Cancel a bulk operation (if still in progress)
   */
  async cancelBulkOperation(operationId: string): Promise<boolean> {
    const operation = this.operations.get(operationId);
    
    if (!operation) {
      return false;
    }

    if (operation.status === 'IN_PROGRESS' || operation.status === 'PENDING') {
      operation.status = 'FAILED';
      operation.completedAt = new Date();
      operation.errors.push('Operation cancelled by user');
      return true;
    }

    return false;
  }

  /**
   * Validate bulk create request
   */
  private async validateBulkCreate(tenantId: string, locations: CreateLocationDto[]): Promise<string[]> {
    const errors: string[] = [];

    if (locations.length === 0) {
      errors.push('No locations provided');
      return errors;
    }

    if (locations.length > 1000) {
      errors.push('Maximum 1000 locations allowed per bulk operation');
    }

    // Check for duplicate codes
    const codes = locations.map(loc => loc?.code).filter(Boolean) as string[];
    const duplicateCodes = codes.filter((code, index) => codes.indexOf(code) !== index);
    if (duplicateCodes.length > 0) {
      errors.push(`Duplicate location codes: ${duplicateCodes.join(', ')}`);
    }

    // Validate each location
    for (let i = 0; i < locations.length; i++) {
      const location = locations[i];
      if (!location) {
        errors.push(`Location ${i + 1}: Invalid location object`);
        continue;
      }
      
      const locationErrors = await this.validateSingleLocation(tenantId, location);
      locationErrors.forEach(error => {
        errors.push(`Location ${i + 1} (${location.code}): ${error}`);
      });
    }

    return errors;
  }

  /**
   * Validate bulk update request
   */
  private async validateBulkUpdate(
    tenantId: string, 
    updates: Array<{ locationId: string; data: UpdateLocationDto }>
  ): Promise<string[]> {
    const errors: string[] = [];

    if (updates.length === 0) {
      errors.push('No updates provided');
      return errors;
    }

    if (updates.length > 1000) {
      errors.push('Maximum 1000 locations allowed per bulk operation');
    }

    // Check for duplicate location IDs
    const locationIds = updates.map(update => update.locationId);
    const duplicateIds = locationIds.filter((id, index) => locationIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate location IDs: ${duplicateIds.join(', ')}`);
    }

    return errors;
  }

  /**
   * Validate a single location
   */
  private async validateSingleLocation(tenantId: string, location: CreateLocationDto): Promise<string[]> {
    const errors: string[] = [];

    // Basic validation would be handled by class-validator
    // Additional business logic validation here

    if (!location.name || location.name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (!location.code || location.code.trim().length === 0) {
      errors.push('Code is required');
    }

    // Check if code already exists (this would need to be implemented in LocationService)
    try {
      // const existingLocation = await this.locationService.findByCode(tenantId, location.code);
      // if (existingLocation) {
      //   errors.push(`Location code '${location.code}' already exists`);
      // }
    } catch (error) {
      // Location doesn't exist, which is good for creation
    }

    return errors;
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}