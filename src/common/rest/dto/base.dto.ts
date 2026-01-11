import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsPositive, Max, IsString, IsDateString, IsArray, IsEnum } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * Base pagination DTO for REST endpoints
 */
export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Max(100)
  limit?: number = 10;
}

/**
 * Base sorting DTO for REST endpoints
 */
export class SortDto {
  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
    example: 'DESC',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

/**
 * Base search DTO for REST endpoints
 */
export class SearchDto {
  @ApiPropertyOptional({
    description: 'Search query string',
    example: 'search term',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Fields to search in',
    type: [String],
    example: ['name', 'description'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  searchFields?: string[];
}

/**
 * Base date range filter DTO
 */
export class DateRangeDto {
  @ApiPropertyOptional({
    description: 'Start date (ISO 8601 format)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601 format)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * Combined query DTO with pagination, sorting, search, and date filtering
 */
export class BaseQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
    example: 'DESC',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({
    description: 'Search query string',
    example: 'search term',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Fields to search in',
    type: [String],
    example: ['name', 'description'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  searchFields?: string[];

  @ApiPropertyOptional({
    description: 'Start date for filtering (ISO 8601 format)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering (ISO 8601 format)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Additional filters as key-value pairs',
    type: 'object',
    additionalProperties: true,
    example: { status: 'active', category: 'electronics' },
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    }
    return value || {};
  })
  filters?: Record<string, any>;
}

/**
 * Standard API response DTO
 */
export class ApiResponseDto<T = any> {
  @ApiProperty({
    description: 'Whether the operation was successful',
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed successfully',
  })
  message!: string;

  @ApiPropertyOptional({
    description: 'Response data',
  })
  data?: T;

  @ApiPropertyOptional({
    description: 'List of errors (if any)',
    type: [String],
  })
  errors?: string[];

  @ApiPropertyOptional({
    description: 'Error code (if any)',
    example: 'VALIDATION_ERROR',
  })
  code?: string;

  @ApiProperty({
    description: 'Response timestamp',
    example: '2024-01-01T12:00:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({
    description: 'API version',
    example: '1',
  })
  version!: string;
}

/**
 * Paginated API response DTO
 */
export class PaginatedResponseDto<T = any> extends ApiResponseDto<T[]> {
  @ApiProperty({
    description: 'Pagination information',
    type: 'object',
    properties: {
      total: { type: 'number', description: 'Total number of items' },
      page: { type: 'number', description: 'Current page number' },
      limit: { type: 'number', description: 'Items per page' },
      totalPages: { type: 'number', description: 'Total number of pages' },
      hasNextPage: { type: 'boolean', description: 'Whether there is a next page' },
      hasPreviousPage: { type: 'boolean', description: 'Whether there is a previous page' },
    },
  })
  pagination!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * ID parameter DTO for REST endpoints
 */
export class IdParamDto {
  @ApiProperty({
    description: 'Resource ID',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  id!: string;
}