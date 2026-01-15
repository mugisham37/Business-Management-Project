import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsOptional, IsPositive, Max, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Standard pagination arguments for GraphQL queries
 */
@ArgsType()
export class PaginationArgs {
  @Field(() => Int, { nullable: true, description: 'Number of items to return from the beginning' })
  @ApiPropertyOptional({ description: 'Number of items to return from the beginning', minimum: 1, maximum: 100 })
  @IsOptional()
  @IsPositive()
  @Max(100)
  first?: number;

  @Field({ nullable: true, description: 'Cursor to start returning items after' })
  @ApiPropertyOptional({ description: 'Cursor to start returning items after' })
  @IsOptional()
  @IsString()
  after?: string;

  @Field(() => Int, { nullable: true, description: 'Number of items to return from the end' })
  @ApiPropertyOptional({ description: 'Number of items to return from the end', minimum: 1, maximum: 100 })
  @IsOptional()
  @IsPositive()
  @Max(100)
  last?: number;

  @Field({ nullable: true, description: 'Cursor to start returning items before' })
  @ApiPropertyOptional({ description: 'Cursor to start returning items before' })
  @IsOptional()
  @IsString()
  before?: string;
}

/**
 * Offset-based pagination arguments (alternative to cursor-based)
 */
@ArgsType()
export class OffsetPaginationArgs {
  @Field(() => Int, { nullable: true, defaultValue: 0, description: 'Number of items to skip' })
  @ApiPropertyOptional({ description: 'Number of items to skip', minimum: 0, default: 0 })
  @IsOptional()
  @IsPositive()
  offset?: number = 0;

  @Field(() => Int, { nullable: true, defaultValue: 10, description: 'Number of items to return' })
  @ApiPropertyOptional({ description: 'Number of items to return', minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @IsPositive()
  @Max(100)
  limit?: number = 10;
}

/**
 * Sorting arguments for GraphQL queries
 */
@ArgsType()
export class SortArgs {
  @Field({ nullable: true, description: 'Field to sort by' })
  @ApiPropertyOptional({ description: 'Field to sort by' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @Field({ nullable: true, defaultValue: 'ASC', description: 'Sort direction (ASC or DESC)' })
  @ApiPropertyOptional({ description: 'Sort direction', enum: ['ASC', 'DESC'], default: 'ASC' })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'ASC';
}

/**
 * Combined pagination and sorting arguments
 */
@ArgsType()
export class PaginatedSortArgs extends PaginationArgs {
  @Field({ nullable: true, description: 'Field to sort by' })
  @ApiPropertyOptional({ description: 'Field to sort by' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @Field({ nullable: true, defaultValue: 'ASC', description: 'Sort direction (ASC or DESC)' })
  @ApiPropertyOptional({ description: 'Sort direction', enum: ['ASC', 'DESC'], default: 'ASC' })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'ASC';
}

/**
 * Search arguments for GraphQL queries
 */
@ArgsType()
export class SearchArgs {
  @Field({ nullable: true, description: 'Search query string' })
  @ApiPropertyOptional({ description: 'Search query string' })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => [String], { nullable: true, description: 'Fields to search in' })
  @ApiPropertyOptional({ description: 'Fields to search in', type: [String] })
  @IsOptional()
  searchFields?: string[];
}

/**
 * Date range filter arguments
 */
@ArgsType()
export class DateRangeArgs {
  @Field({ nullable: true, description: 'Start date for filtering' })
  @ApiPropertyOptional({ description: 'Start date for filtering' })
  @IsOptional()
  startDate?: Date;

  @Field({ nullable: true, description: 'End date for filtering' })
  @ApiPropertyOptional({ description: 'End date for filtering' })
  @IsOptional()
  endDate?: Date;
}

/**
 * Complete query arguments with pagination, sorting, search, and date filtering
 */
@ArgsType()
export class CompleteQueryArgs extends PaginatedSortArgs {
  @Field({ nullable: true, description: 'Search query string' })
  @ApiPropertyOptional({ description: 'Search query string' })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => [String], { nullable: true, description: 'Fields to search in' })
  @ApiPropertyOptional({ description: 'Fields to search in', type: [String] })
  @IsOptional()
  searchFields?: string[];

  @Field({ nullable: true, description: 'Start date for filtering' })
  @ApiPropertyOptional({ description: 'Start date for filtering' })
  @IsOptional()
  startDate?: Date;

  @Field({ nullable: true, description: 'End date for filtering' })
  @ApiPropertyOptional({ description: 'End date for filtering' })
  @IsOptional()
  endDate?: Date;

  @Field(() => [String], { nullable: true, description: 'Additional filters as key-value pairs' })
  @ApiPropertyOptional({ description: 'Additional filters', type: [String] })
  @IsOptional()
  filters?: string[];
}