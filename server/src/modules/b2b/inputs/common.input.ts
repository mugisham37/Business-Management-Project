import { InputType, Field, Int } from '@nestjs/graphql';

/**
 * Common pagination input
 */
@InputType()
export class PaginationInput {
  @Field(() => Int, { defaultValue: 1 })
  page!: number;

  @Field(() => Int, { defaultValue: 20 })
  limit!: number;

  @Field({ nullable: true })
  sortBy?: string;

  @Field({ nullable: true })
  sortOrder?: string;
}

/**
 * Common date range input
 */
@InputType()
export class DateRangeInput {
  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  endDate?: Date;
}

/**
 * Common search input
 */
@InputType()
export class SearchInput {
  @Field({ nullable: true })
  search?: string;

  @Field(() => [String], { nullable: true })
  searchFields?: string[];
}

/**
 * Common filter input
 */
@InputType()
export class FilterInput {
  @Field({ nullable: true })
  field!: string;

  @Field({ nullable: true })
  operator!: string;

  @Field({ nullable: true })
  value?: string;
}