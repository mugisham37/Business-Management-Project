import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsEnum, IsArray, IsUUID, IsBoolean, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum ReportType {
  FINANCIAL = 'financial',
  INVENTORY = 'inventory',
  SALES = 'sales',
  CUSTOMER = 'customer',
  PROCUREMENT = 'procurement',
  COMPREHENSIVE = 'comprehensive',
}

export enum GroupByType {
  LOCATION = 'location',
  REGION = 'region',
  TYPE = 'type',
  MANAGER = 'manager',
}

export enum DrillDownLevel {
  SUMMARY = 'summary',
  DETAILED = 'detailed',
  TRANSACTION = 'transaction',
}

export enum ComparisonType {
  PEER = 'peer',
  HISTORICAL = 'historical',
  BENCHMARK = 'benchmark',
}

export class ConsolidatedReportQueryDto {
  @ApiPropertyOptional({
    description: 'Specific location IDs to include in report',
    type: [String],
    example: ['loc-1', 'loc-2'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  locationIds?: string[];

  @ApiProperty({
    description: 'Report start date',
    example: '2024-01-01',
  })
  @IsDateString()
  @Transform(({ value }) => new Date(value))
  startDate!: Date;

  @ApiProperty({
    description: 'Report end date',
    example: '2024-01-31',
  })
  @IsDateString()
  @Transform(({ value }) => new Date(value))
  endDate!: Date;

  @ApiProperty({
    description: 'Type of report to generate',
    enum: ReportType,
    example: ReportType.COMPREHENSIVE,
  })
  @IsEnum(ReportType)
  reportType!: ReportType;

  @ApiPropertyOptional({
    description: 'How to group the report data',
    enum: GroupByType,
    example: GroupByType.LOCATION,
  })
  @IsOptional()
  @IsEnum(GroupByType)
  groupBy?: GroupByType;

  @ApiPropertyOptional({
    description: 'Include period-over-period comparisons',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includeComparisons?: boolean;

  @ApiPropertyOptional({
    description: 'Include benchmark analysis',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includeBenchmarks?: boolean;

  @ApiPropertyOptional({
    description: 'Level of detail for drill-down data',
    enum: DrillDownLevel,
    example: DrillDownLevel.DETAILED,
  })
  @IsOptional()
  @IsEnum(DrillDownLevel)
  drillDownLevel?: DrillDownLevel;
}

export class LocationComparisonQueryDto {
  @ApiProperty({
    description: 'Location IDs to compare',
    type: [String],
    example: ['loc-1', 'loc-2', 'loc-3'],
  })
  @IsArray()
  @IsUUID(4, { each: true })
  locationIds!: string[];

  @ApiProperty({
    description: 'Type of comparison to perform',
    enum: ComparisonType,
    example: ComparisonType.PEER,
  })
  @IsEnum(ComparisonType)
  comparisonType!: ComparisonType;

  @ApiProperty({
    description: 'Comparison start date',
    example: '2024-01-01',
  })
  @IsDateString()
  @Transform(({ value }) => new Date(value))
  startDate!: Date;

  @ApiProperty({
    description: 'Comparison end date',
    example: '2024-01-31',
  })
  @IsDateString()
  @Transform(({ value }) => new Date(value))
  endDate!: Date;
}

export class LocationBenchmarkQueryDto {
  @ApiProperty({
    description: 'Location ID to benchmark',
    example: 'loc-1',
  })
  @IsUUID(4)
  locationId!: string;

  @ApiProperty({
    description: 'Benchmark start date',
    example: '2024-01-01',
  })
  @IsDateString()
  @Transform(({ value }) => new Date(value))
  startDate!: Date;

  @ApiProperty({
    description: 'Benchmark end date',
    example: '2024-01-31',
  })
  @IsDateString()
  @Transform(({ value }) => new Date(value))
  endDate!: Date;
}

export class LocationPerformanceMetricsDto {
  @ApiProperty({ description: 'Location ID', example: 'loc-1' })
  locationId!: string;

  @ApiProperty({ description: 'Location name', example: 'Downtown Store' })
  locationName!: string;

  @ApiProperty({ description: 'Location code', example: 'DT001' })
  locationCode!: string;

  @ApiProperty({ description: 'Location type', example: 'retail' })
  locationType!: string;

  @ApiPropertyOptional({ description: 'Region', example: 'North' })
  region?: string;

  @ApiPropertyOptional({ description: 'Manager ID', example: 'mgr-1' })
  managerId?: string;

  @ApiPropertyOptional({ description: 'Manager name', example: 'John Smith' })
  managerName?: string;

  // Financial Metrics
  @ApiProperty({ description: 'Total revenue', example: 125000.50 })
  revenue!: number;

  @ApiProperty({ description: 'Gross profit', example: 75000.30 })
  grossProfit!: number;

  @ApiProperty({ description: 'Net profit', example: 45000.20 })
  netProfit!: number;

  @ApiProperty({ description: 'Total expenses', example: 30000.10 })
  expenses!: number;

  @ApiProperty({ description: 'Profit margin percentage', example: 36.0 })
  profitMargin!: number;

  // Sales Metrics
  @ApiProperty({ description: 'Number of transactions', example: 1250 })
  transactionCount!: number;

  @ApiProperty({ description: 'Average transaction value', example: 100.00 })
  averageTransactionValue!: number;

  @ApiProperty({ description: 'Total items sold', example: 3750 })
  itemsSold!: number;

  @ApiProperty({ description: 'Total refund amount', example: 2500.00 })
  refundAmount!: number;

  @ApiProperty({ description: 'Refund rate percentage', example: 2.0 })
  refundRate!: number;

  // Inventory Metrics
  @ApiProperty({ description: 'Current inventory value', example: 85000.00 })
  inventoryValue!: number;

  @ApiProperty({ description: 'Inventory turnover ratio', example: 8.5 })
  inventoryTurnover!: number;

  @ApiProperty({ description: 'Number of stockout events', example: 12 })
  stockoutEvents!: number;

  @ApiProperty({ description: 'Excess inventory value', example: 5000.00 })
  excessInventoryValue!: number;

  // Customer Metrics
  @ApiProperty({ description: 'Number of unique customers', example: 850 })
  uniqueCustomers!: number;

  @ApiProperty({ description: 'Repeat customer rate percentage', example: 65.5 })
  repeatCustomerRate!: number;

  @ApiProperty({ description: 'Customer lifetime value', example: 450.00 })
  customerLifetimeValue!: number;

  @ApiPropertyOptional({ description: 'Customer satisfaction score', example: 4.2 })
  customerSatisfactionScore?: number;

  // Operational Metrics
  @ApiProperty({ description: 'Number of employees', example: 8 })
  employeeCount!: number;

  @ApiProperty({ description: 'Sales per employee', example: 15625.06 })
  salesPerEmployee!: number;

  @ApiProperty({ description: 'Operating hours per day', example: 12 })
  operatingHours!: number;

  @ApiProperty({ description: 'Sales per hour', example: 336.54 })
  salesPerHour!: number;

  // Comparative Metrics
  @ApiPropertyOptional({ description: 'Growth vs previous period (%)', example: 15.5 })
  previousPeriodGrowth?: number;

  @ApiPropertyOptional({ description: 'Benchmark comparison score', example: 85.2 })
  benchmarkComparison?: number;

  @ApiPropertyOptional({ description: 'Rank among all locations', example: 3 })
  rankAmongLocations?: number;
}

export class AggregatedMetricsDto {
  @ApiProperty({ description: 'Total revenue across all locations', example: 1250000.50 })
  totalRevenue!: number;

  @ApiProperty({ description: 'Total transactions across all locations', example: 12500 })
  totalTransactions!: number;

  @ApiProperty({ description: 'Total unique customers', example: 8500 })
  totalCustomers!: number;

  @ApiProperty({ description: 'Total inventory value', example: 850000.00 })
  totalInventoryValue!: number;

  @ApiProperty({ description: 'Average profit margin across locations', example: 32.5 })
  averageProfitMargin!: number;

  @ApiProperty({ description: 'ID of top performing location', example: 'loc-5' })
  topPerformingLocationId!: string;

  @ApiProperty({ description: 'ID of lowest performing location', example: 'loc-2' })
  lowestPerformingLocationId!: string;
}

export class ReportPeriodDto {
  @ApiProperty({ description: 'Report start date', example: '2024-01-01T00:00:00Z' })
  startDate!: Date;

  @ApiProperty({ description: 'Report end date', example: '2024-01-31T23:59:59Z' })
  endDate!: Date;

  @ApiProperty({ description: 'Number of days in report period', example: 31 })
  daysInPeriod!: number;
}

export class ComparativeAnalysisDto {
  @ApiProperty({ description: 'Period over period growth percentage', example: 12.5 })
  periodOverPeriodGrowth!: number;

  @ApiProperty({ 
    description: 'Best performing metrics', 
    type: [String],
    example: ['revenue', 'profitMargin', 'customerRetention'] 
  })
  bestPerformingMetrics!: string[];

  @ApiProperty({ 
    description: 'Areas needing improvement', 
    type: [String],
    example: ['inventory turnover', 'employee productivity'] 
  })
  improvementOpportunities!: string[];

  @ApiPropertyOptional({ description: 'Benchmark analysis data' })
  benchmarkAnalysis?: {
    aboveAverage: number;
    belowAverage: number;
    averagePerformance: LocationPerformanceMetricsDto;
  };
}

export class ConsolidatedReportDto {
  @ApiProperty({ description: 'Unique report ID', example: 'report_1704067200_abc123def' })
  reportId!: string;

  @ApiProperty({ description: 'Tenant ID', example: 'tenant-1' })
  tenantId!: string;

  @ApiProperty({ description: 'Report type', enum: ReportType })
  reportType!: string;

  @ApiProperty({ description: 'Report generation timestamp' })
  generatedAt!: Date;

  @ApiProperty({ description: 'Original query parameters' })
  @ValidateNested()
  @Type(() => ConsolidatedReportQueryDto)
  query!: ConsolidatedReportQueryDto;

  @ApiProperty({ description: 'Total number of locations in report', example: 5 })
  totalLocations!: number;

  @ApiProperty({ description: 'Report period information' })
  @ValidateNested()
  @Type(() => ReportPeriodDto)
  reportPeriod!: ReportPeriodDto;

  @ApiProperty({ description: 'Aggregated metrics across all locations' })
  @ValidateNested()
  @Type(() => AggregatedMetricsDto)
  aggregatedMetrics!: AggregatedMetricsDto;

  @ApiProperty({ 
    description: 'Performance metrics for each location',
    type: [LocationPerformanceMetricsDto]
  })
  @ValidateNested({ each: true })
  @Type(() => LocationPerformanceMetricsDto)
  locationMetrics!: LocationPerformanceMetricsDto[];

  @ApiPropertyOptional({ description: 'Comparative analysis (when enabled)' })
  @ValidateNested()
  @Type(() => ComparativeAnalysisDto)
  comparativeAnalysis?: ComparativeAnalysisDto;

  @ApiPropertyOptional({ description: 'Drill-down data (when requested)' })
  drillDownData?: {
    [locationId: string]: {
      dailyMetrics?: any[];
      topProducts?: any[];
      topCustomers?: any[];
      transactionDetails?: any[];
    };
  };
}

export class LocationComparisonItemDto {
  @ApiProperty({ description: 'Location ID', example: 'loc-1' })
  locationId!: string;

  @ApiProperty({ description: 'Location name', example: 'Downtown Store' })
  locationName!: string;

  @ApiProperty({ description: 'Location performance metrics' })
  @ValidateNested()
  @Type(() => LocationPerformanceMetricsDto)
  metrics!: LocationPerformanceMetricsDto;

  @ApiProperty({ description: 'Ranking among compared locations', example: 1 })
  ranking!: number;

  @ApiProperty({ description: 'Percentile rank (0-100)', example: 85.5 })
  percentileRank!: number;

  @ApiProperty({ 
    description: 'Areas where location excels',
    type: [String],
    example: ['High Revenue Generation', 'Strong Profit Margins']
  })
  strengthAreas!: string[];

  @ApiProperty({ 
    description: 'Areas needing improvement',
    type: [String],
    example: ['Inventory Management', 'Customer Retention']
  })
  improvementAreas!: string[];
}

export class ComparisonInsightsDto {
  @ApiProperty({ 
    description: 'Top performing locations',
    type: [String],
    example: ['Downtown Store', 'Mall Location']
  })
  topPerformers!: string[];

  @ApiProperty({ 
    description: 'Underperforming locations',
    type: [String],
    example: ['Suburban Store', 'Airport Location']
  })
  underperformers!: string[];

  @ApiProperty({ 
    description: 'Key success factors identified',
    type: [String],
    example: ['Strong operational efficiency', 'Effective customer relationship management']
  })
  keySuccessFactors!: string[];

  @ApiProperty({ 
    description: 'Recommended actions for specific locations',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        locationId: { type: 'string' },
        recommendations: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  recommendedActions!: {
    locationId: string;
    recommendations: string[];
  }[];
}

export class LocationComparisonReportDto {
  @ApiProperty({ description: 'Unique comparison ID', example: 'comp_1704067200_xyz789abc' })
  comparisonId!: string;

  @ApiProperty({ description: 'Tenant ID', example: 'tenant-1' })
  tenantId!: string;

  @ApiProperty({ description: 'Report generation timestamp' })
  generatedAt!: Date;

  @ApiProperty({ description: 'Type of comparison performed', enum: ComparisonType })
  comparisonType!: ComparisonType;

  @ApiProperty({ 
    description: 'Comparison data for each location',
    type: [LocationComparisonItemDto]
  })
  @ValidateNested({ each: true })
  @Type(() => LocationComparisonItemDto)
  locations!: LocationComparisonItemDto[];

  @ApiProperty({ description: 'Analysis insights and recommendations' })
  @ValidateNested()
  @Type(() => ComparisonInsightsDto)
  insights!: ComparisonInsightsDto;
}

export class BenchmarkDataDto {
  @ApiProperty({ description: 'Tenant average performance' })
  @ValidateNested()
  @Type(() => LocationPerformanceMetricsDto)
  tenantAverage!: LocationPerformanceMetricsDto;

  @ApiProperty({ description: 'Top quartile performance' })
  @ValidateNested()
  @Type(() => LocationPerformanceMetricsDto)
  topQuartile!: LocationPerformanceMetricsDto;

  @ApiPropertyOptional({ description: 'Industry average (when available)' })
  @ValidateNested()
  @Type(() => LocationPerformanceMetricsDto)
  industryAverage?: LocationPerformanceMetricsDto;
}

export class LocationBenchmarkReportDto {
  @ApiProperty({ description: 'Location performance metrics' })
  @ValidateNested()
  @Type(() => LocationPerformanceMetricsDto)
  location!: LocationPerformanceMetricsDto;

  @ApiProperty({ description: 'Benchmark comparison data' })
  @ValidateNested()
  @Type(() => BenchmarkDataDto)
  benchmarks!: BenchmarkDataDto;

  @ApiProperty({ 
    description: 'Specific recommendations for improvement',
    type: [String],
    example: [
      'Revenue is 15% below tenant average. Focus on sales growth initiatives.',
      'Inventory turnover is significantly below average. Optimize inventory management.'
    ]
  })
  recommendations!: string[];
}

// Export query interfaces for service layer
export interface ConsolidatedReportQuery {
  locationIds?: string[];
  startDate: Date;
  endDate: Date;
  reportType: 'financial' | 'inventory' | 'sales' | 'customer' | 'procurement' | 'comprehensive';
  groupBy?: 'location' | 'region' | 'type' | 'manager';
  includeComparisons?: boolean;
  includeBenchmarks?: boolean;
  drillDownLevel?: 'summary' | 'detailed' | 'transaction';
}