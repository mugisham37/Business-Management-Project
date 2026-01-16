import { ObjectType, Field, InterfaceType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { GraphQLError } from './base.types';

/**
 * Base mutation response interface
 * All mutation responses should implement this interface
 */
@InterfaceType()
export abstract class IMutationResponse {
  @Field()
  @ApiProperty({ description: 'Whether the mutation was successful' })
  success!: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Success or error message', required: false })
  message?: string;

  @Field(() => [GraphQLError], { nullable: true })
  @ApiProperty({ type: [GraphQLError], description: 'List of errors', required: false })
  errors?: GraphQLError[];
}

/**
 * Standard mutation response
 * Use this for simple mutations that don't return an entity
 */
@ObjectType({ implements: () => [IMutationResponse] })
export class MutationResponse implements IMutationResponse {
  @Field()
  @ApiProperty({ description: 'Whether the mutation was successful' })
  success!: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Success or error message', required: false })
  message?: string;

  @Field(() => [GraphQLError], { nullable: true })
  @ApiProperty({ type: [GraphQLError], description: 'List of errors', required: false })
  errors?: GraphQLError[];
}

/**
 * Entity mutation response
 * Use this as a base for mutations that return an entity
 * 
 * Example:
 * @ObjectType()
 * export class ProductMutationResponse extends EntityMutationResponse {
 *   @Field(() => Product, { nullable: true })
 *   product?: Product;
 * }
 */
@ObjectType({ isAbstract: true, implements: () => [IMutationResponse] })
export abstract class EntityMutationResponse implements IMutationResponse {
  @Field()
  @ApiProperty({ description: 'Whether the mutation was successful' })
  success!: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Success or error message', required: false })
  message?: string;

  @Field(() => [GraphQLError], { nullable: true })
  @ApiProperty({ type: [GraphQLError], description: 'List of errors', required: false })
  errors?: GraphQLError[];
}

/**
 * Batch mutation response
 * Use this for mutations that operate on multiple entities
 */
@ObjectType({ implements: () => [IMutationResponse] })
export class BatchMutationResponse implements IMutationResponse {
  @Field()
  @ApiProperty({ description: 'Whether the mutation was successful' })
  success!: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Success or error message', required: false })
  message?: string;

  @Field(() => [GraphQLError], { nullable: true })
  @ApiProperty({ type: [GraphQLError], description: 'List of errors', required: false })
  errors?: GraphQLError[];

  @Field()
  @ApiProperty({ description: 'Number of entities processed' })
  processedCount!: number;

  @Field()
  @ApiProperty({ description: 'Number of entities successfully updated' })
  successCount!: number;

  @Field()
  @ApiProperty({ description: 'Number of entities that failed' })
  failureCount!: number;

  @Field(() => [String], { nullable: true })
  @ApiProperty({ type: [String], description: 'IDs of successfully processed entities', required: false })
  successIds?: string[];

  @Field(() => [String], { nullable: true })
  @ApiProperty({ type: [String], description: 'IDs of failed entities', required: false })
  failureIds?: string[];
}

/**
 * Async operation mutation response
 * Use this for mutations that enqueue background jobs
 */
@ObjectType({ implements: () => [IMutationResponse] })
export class AsyncOperationResponse implements IMutationResponse {
  @Field()
  @ApiProperty({ description: 'Whether the mutation was successful' })
  success!: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Success or error message', required: false })
  message?: string;

  @Field(() => [GraphQLError], { nullable: true })
  @ApiProperty({ type: [GraphQLError], description: 'List of errors', required: false })
  errors?: GraphQLError[];

  @Field()
  @ApiProperty({ description: 'Job ID for tracking the async operation' })
  jobId!: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Estimated completion time', required: false })
  estimatedCompletionTime?: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'URL to check job status', required: false })
  statusUrl?: string;
}

/**
 * Delete mutation response
 * Use this for delete operations
 */
@ObjectType({ implements: () => [IMutationResponse] })
export class DeleteMutationResponse implements IMutationResponse {
  @Field()
  @ApiProperty({ description: 'Whether the mutation was successful' })
  success!: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Success or error message', required: false })
  message?: string;

  @Field(() => [GraphQLError], { nullable: true })
  @ApiProperty({ type: [GraphQLError], description: 'List of errors', required: false })
  errors?: GraphQLError[];

  @Field()
  @ApiProperty({ description: 'ID of the deleted entity' })
  deletedId!: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Whether the entity was soft deleted', required: false })
  softDeleted?: boolean;
}

/**
 * Helper function to create a success response
 */
export function createSuccessResponse(message?: string): MutationResponse {
  return {
    success: true,
    message: message || 'Operation completed successfully',
  };
}

/**
 * Helper function to create an error response
 */
export function createErrorResponse(
  message: string,
  errors?: Array<{ message: string; code?: string; path?: string[] }>,
): MutationResponse {
  const response: MutationResponse = {
    success: false,
    message,
  };
  
  if (errors) {
    response.errors = errors.map(error => ({
      ...error,
      timestamp: new Date(),
    }));
  }
  
  return response;
}

/**
 * Helper function to create an async operation response
 */
export function createAsyncOperationResponse(
  jobId: string,
  message?: string,
  estimatedCompletionTime?: Date,
): AsyncOperationResponse {
  const response: AsyncOperationResponse = {
    success: true,
    message: message || 'Operation queued successfully',
    jobId,
    statusUrl: `/api/jobs/${jobId}/status`,
  };
  
  if (estimatedCompletionTime !== undefined) {
    response.estimatedCompletionTime = estimatedCompletionTime;
  }
  
  return response;
}

/**
 * Helper function to create a batch mutation response
 */
export function createBatchMutationResponse(
  processedCount: number,
  successCount: number,
  failureCount: number,
  successIds?: string[],
  failureIds?: string[],
  errors?: Array<{ message: string; code?: string; path?: string[] }>,
): BatchMutationResponse {
  const response: BatchMutationResponse = {
    success: failureCount === 0,
    message: `Processed ${processedCount} items: ${successCount} succeeded, ${failureCount} failed`,
    processedCount,
    successCount,
    failureCount,
  };
  
  if (errors) {
    response.errors = errors.map(error => ({
      ...error,
      timestamp: new Date(),
    }));
  }
  
  if (successIds !== undefined) {
    response.successIds = successIds;
  }
  
  if (failureIds !== undefined) {
    response.failureIds = failureIds;
  }
  
  return response;
}
