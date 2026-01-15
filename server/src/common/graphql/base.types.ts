import { Field, ObjectType, ID, Int } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Base GraphQL entity with common fields for all domain objects
 */
@ObjectType({ isAbstract: true })
export abstract class BaseEntity {
  @Field(() => ID)
  @ApiProperty({ description: 'Unique identifier' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'Tenant ID for multi-tenancy' })
  tenantId!: string;

  @Field()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @Field()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Soft deletion timestamp', required: false })
  deletedAt?: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'User who created this entity', required: false })
  createdBy?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'User who last updated this entity', required: false })
  updatedBy?: string;

  @Field(() => Int)
  @ApiProperty({ description: 'Version number for optimistic locking' })
  version!: number;
}

/**
 * Pagination info for GraphQL connections
 */
@ObjectType()
export class PageInfo {
  @Field()
  @ApiProperty({ description: 'Whether there are more items after the current page' })
  hasNextPage!: boolean;

  @Field()
  @ApiProperty({ description: 'Whether there are items before the current page' })
  hasPreviousPage!: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Cursor for the first item in the page', required: false })
  startCursor?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Cursor for the last item in the page', required: false })
  endCursor?: string;
}

/**
 * Generic edge type for GraphQL connections
 */
@ObjectType({ isAbstract: true })
export abstract class Edge<T> {
  @Field()
  @ApiProperty({ description: 'Cursor for this edge' })
  cursor!: string;

  abstract node: T;
}

/**
 * Generic connection type for GraphQL pagination
 */
@ObjectType({ isAbstract: true })
export abstract class Connection<T> {
  @Field(() => PageInfo)
  @ApiProperty({ type: PageInfo, description: 'Pagination information' })
  pageInfo!: PageInfo;

  @Field(() => Int)
  @ApiProperty({ description: 'Total count of items' })
  totalCount!: number;

  abstract edges: Edge<T>[];
}

/**
 * Standard error type for GraphQL responses
 */
@ObjectType()
export class GraphQLError {
  @Field()
  @ApiProperty({ description: 'Error message' })
  message!: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Error code', required: false })
  code?: string;

  @Field(() => [String], { nullable: true })
  @ApiProperty({ description: 'Field path where error occurred', required: false })
  path?: string[];

  @Field({ nullable: true })
  @ApiProperty({ description: 'Error timestamp', required: false })
  timestamp?: Date;
}

/**
 * Mutation response wrapper with error handling
 */
@ObjectType({ isAbstract: true })
export abstract class MutationResponse {
  @Field()
  @ApiProperty({ description: 'Whether the mutation was successful' })
  success!: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Success message', required: false })
  message?: string;

  @Field(() => [GraphQLError], { nullable: true })
  @ApiProperty({ type: [GraphQLError], description: 'List of errors', required: false })
  errors?: GraphQLError[];
}