import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
  ApiConsumes,
  ApiProduces,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiResponseDto, PaginatedResponseDto } from '../dto/base.dto';

/**
 * Decorator for standard CRUD operations
 */
export function ApiStandardResponse<T>(
  dataType?: Type<T>,
  description: string = 'Successful operation',
) {
  const decorators = [
    ApiResponse({
      status: 200,
      description,
      schema: dataType
        ? {
            allOf: [
              { $ref: getSchemaPath(ApiResponseDto) },
              {
                properties: {
                  data: { $ref: getSchemaPath(dataType) },
                },
              },
            ],
          }
        : { $ref: getSchemaPath(ApiResponseDto) },
    }),
  ];

  return applyDecorators(...decorators);
}

/**
 * Decorator for paginated responses
 */
export function ApiPaginatedResponse<T>(
  dataType: Type<T>,
  description: string = 'Paginated results retrieved successfully',
) {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(dataType) },
              },
            },
          },
        ],
      },
    }),
  );
}

/**
 * Decorator for create operations
 */
export function ApiCreateOperation(
  summary: string,
  description?: string,
) {
  const operationOptions: { summary: string; description?: string } = { summary };
  if (description !== undefined) {
    operationOptions.description = description;
  }
  
  return applyDecorators(
    ApiOperation(operationOptions),
    ApiResponse({ status: 201, description: 'Resource created successfully' }),
    ApiResponse({ status: 400, description: 'Bad Request - Invalid input data' }),
    ApiResponse({ status: 409, description: 'Conflict - Resource already exists' }),
  );
}

/**
 * Decorator for read operations
 */
export function ApiReadOperation(
  summary: string,
  description?: string,
) {
  const operationOptions: { summary: string; description?: string } = { summary };
  if (description !== undefined) {
    operationOptions.description = description;
  }
  
  return applyDecorators(
    ApiOperation(operationOptions),
    ApiResponse({ status: 200, description: 'Resource retrieved successfully' }),
    ApiResponse({ status: 404, description: 'Not Found - Resource does not exist' }),
  );
}

/**
 * Decorator for update operations
 */
export function ApiUpdateOperation(
  summary: string,
  description?: string,
) {
  const operationOptions: { summary: string; description?: string } = { summary };
  if (description !== undefined) {
    operationOptions.description = description;
  }
  
  return applyDecorators(
    ApiOperation(operationOptions),
    ApiResponse({ status: 200, description: 'Resource updated successfully' }),
    ApiResponse({ status: 400, description: 'Bad Request - Invalid input data' }),
    ApiResponse({ status: 404, description: 'Not Found - Resource does not exist' }),
    ApiResponse({ status: 409, description: 'Conflict - Update conflict occurred' }),
  );
}

/**
 * Decorator for delete operations
 */
export function ApiDeleteOperation(
  summary: string,
  description?: string,
) {
  const operationOptions: { summary: string; description?: string } = { summary };
  if (description !== undefined) {
    operationOptions.description = description;
  }
  
  return applyDecorators(
    ApiOperation(operationOptions),
    ApiResponse({ status: 200, description: 'Resource deleted successfully' }),
    ApiResponse({ status: 404, description: 'Not Found - Resource does not exist' }),
    ApiResponse({ status: 409, description: 'Conflict - Cannot delete resource' }),
  );
}

/**
 * Decorator for list operations with pagination
 */
export function ApiListOperation(
  summary: string,
  description?: string,
) {
  const operationOptions: { summary: string; description?: string } = { summary };
  if (description !== undefined) {
    operationOptions.description = description;
  }
  
  return applyDecorators(
    ApiOperation(operationOptions),
    ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' }),
    ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' }),
    ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Field to sort by' }),
    ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Sort direction' }),
    ApiQuery({ name: 'search', required: false, type: String, description: 'Search query' }),
    ApiResponse({ status: 200, description: 'Resources retrieved successfully' }),
  );
}

/**
 * Decorator for file upload operations
 */
export function ApiFileUpload(
  summary: string,
  description?: string,
  fieldName: string = 'file',
) {
  const operationOptions: { summary: string; description?: string } = { summary };
  if (description !== undefined) {
    operationOptions.description = description;
  }
  
  return applyDecorators(
    ApiOperation(operationOptions),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          [fieldName]: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    }),
    ApiResponse({ status: 201, description: 'File uploaded successfully' }),
    ApiResponse({ status: 400, description: 'Bad Request - Invalid file' }),
    ApiResponse({ status: 413, description: 'Payload Too Large - File size exceeds limit' }),
  );
}

/**
 * Decorator for bulk operations
 */
export function ApiBulkOperation(
  summary: string,
  description?: string,
) {
  const operationOptions: { summary: string; description?: string } = { summary };
  if (description !== undefined) {
    operationOptions.description = description;
  }
  
  return applyDecorators(
    ApiOperation(operationOptions),
    ApiResponse({ status: 200, description: 'Bulk operation completed successfully' }),
    ApiResponse({ status: 207, description: 'Multi-Status - Partial success' }),
    ApiResponse({ status: 400, description: 'Bad Request - Invalid bulk data' }),
  );
}

/**
 * Decorator for search operations
 */
export function ApiSearchOperation(
  summary: string,
  description?: string,
) {
  const operationOptions: { summary: string; description?: string } = { summary };
  if (description !== undefined) {
    operationOptions.description = description;
  }
  
  return applyDecorators(
    ApiOperation(operationOptions),
    ApiQuery({ name: 'q', required: true, type: String, description: 'Search query' }),
    ApiQuery({ name: 'fields', required: false, type: [String], description: 'Fields to search in' }),
    ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' }),
    ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' }),
    ApiResponse({ status: 200, description: 'Search results retrieved successfully' }),
  );
}

/**
 * Decorator for export operations
 */
export function ApiExportOperation(
  summary: string,
  description?: string,
  formats: string[] = ['csv', 'xlsx', 'pdf'],
) {
  const operationOptions: { summary: string; description?: string } = { summary };
  if (description !== undefined) {
    operationOptions.description = description;
  }
  
  return applyDecorators(
    ApiOperation(operationOptions),
    ApiQuery({ name: 'format', required: false, enum: formats, description: 'Export format' }),
    ApiProduces('application/octet-stream'),
    ApiResponse({ status: 200, description: 'Data exported successfully' }),
    ApiResponse({ status: 400, description: 'Bad Request - Invalid export parameters' }),
  );
}

/**
 * Decorator for health check operations
 */
export function ApiHealthCheck(
  summary: string = 'Health check',
  description?: string,
) {
  const operationOptions: { summary: string; description?: string } = { summary };
  if (description !== undefined) {
    operationOptions.description = description;
  }
  
  return applyDecorators(
    ApiOperation(operationOptions),
    ApiResponse({
      status: 200,
      description: 'Service is healthy',
      schema: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          timestamp: { type: 'string', example: '2024-01-01T12:00:00.000Z' },
          uptime: { type: 'number', example: 3600 },
          version: { type: 'string', example: '1.0.0' },
        },
      },
    }),
    ApiResponse({ status: 503, description: 'Service is unhealthy' }),
  );
}