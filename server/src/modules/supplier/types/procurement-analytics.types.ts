import { ObjectType, Field, Float, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

// Object Types
@ObjectType('SupplierPerformanceMetrics')
export class SupplierPerformanceMetricsType {
  @Field()
  @ApiProperty({ description: 'Supplier ID' })
  supplierId!: string;

  @Field()
  @ApiProperty({ description: 'Supplier name' })
  supplierName!: string;

  @Field(() => Float)
  @ApiProperty({ description: 'Overall score' })
  overallScore!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Quality score' })
  qualityScore!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Delivery score' })
  deliveryScore!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Service score' })
  serviceScore!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'On-time delivery rate' })
  onTimeDeliveryRate!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Quality defect rate' })
  qualityDefectRate!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Average response time' })
  averageResponseTime!: number;

  @Field()
  @ApiProperty({ description: 'Total orders' })
  totalOrders!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Total spend' })
  totalSpend!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Average order value' })
  averageOrderValue!: number;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Last evaluation date', required: false })
  lastEvaluationDate?: Date;

  @Field()
  @ApiProperty({ description: 'Performance trend' })
  trend!: string;
}

@ObjectType('SpendBySupplier')
export class SpendBySupplierType {
  @Field()
  @ApiProperty({ description: 'Supplier ID' })
  supplierId!: string;

  @Field()
  @ApiProperty({ description: 'Supplier name' })
  supplierName!: string;

  @Field(() => Float)
  @ApiProperty({ description: 'Total spend' })
  totalSpend!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Percentage of total spend' })
  percentage!: number;

  @Field()
  @ApiProperty({ description: 'Order count' })
  orderCount!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Average order value' })
  averageOrderValue!: number;
}

@ObjectType('SpendAnalysis')
export class SpendAnalysisType {
  @Field(() => Float)
  @ApiProperty({ description: 'Total spend' })
  totalSpend!: number;

  @Field(() => [SpendBySupplierType])
  @ApiProperty({ description: 'Spend by supplier', type: [SpendBySupplierType] })
  spendBySupplier!: SpendBySupplierType[];

  @Field(() => [SpendBySupplierType])
  @ApiProperty({ description: 'Top suppliers', type: [SpendBySupplierType] })
  topSuppliers!: SpendBySupplierType[];
}

@ObjectType('CostTrend')
export class CostTrendType {
  @Field()
  @ApiProperty({ description: 'Period (month/year)' })
  period!: string;

  @Field(() => Float)
  @ApiProperty({ description: 'Total cost' })
  totalCost!: number;

  @Field()
  @ApiProperty({ description: 'Order count' })
  orderCount!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Average order value' })
  averageOrderValue!: number;
}

@ObjectType('LeadTimeAnalysis')
export class LeadTimeAnalysisType {
  @Field()
  @ApiProperty({ description: 'Supplier ID' })
  supplierId!: string;

  @Field()
  @ApiProperty({ description: 'Supplier name' })
  supplierName!: string;

  @Field(() => Float)
  @ApiProperty({ description: 'Average lead time in days' })
  averageLeadTime!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Minimum lead time in days' })
  minLeadTime!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Maximum lead time in days' })
  maxLeadTime!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'On-time delivery percentage' })
  onTimeDeliveryPercentage!: number;
}

// Input Types
@InputType()
export class AnalyticsDateRangeInput {
  @Field()
  @IsDate()
  @Type(() => Date)
  startDate!: Date;

  @Field()
  @IsDate()
  @Type(() => Date)
  endDate!: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
