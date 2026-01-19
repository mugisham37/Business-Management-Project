import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { Permissions } from '../../auth/decorators/require-permission.decorator';
import { InventoryReportingService, ReportQueryDto } from '../services/inventory-reporting.service';
import { ProductService } from '../services/product.service';
import { 
  StockLevelReportInput, 
  MovementReportInput, 
  AgingReportInput, 
  TurnoverReportInput 
} from '../inputs/inventory-reporting.input';
import { 
  StockLevelReport, 
  MovementReport, 
  AgingReport, 
  TurnoverReport 
} from '../types/inventory-reporting.types';

@Resolver()
@UseGuards(JwtAuthGuard)
export class InventoryReportingResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly reportingService: InventoryReportingService,
    private readonly productService: ProductService,
  ) {
    super(dataLoaderService);
  }

  private convertInputToQuery(input: StockLevelReportInput | MovementReportInput | AgingReportInput | TurnoverReportInput | null): ReportQueryDto {
    if (!input) return {};
    
    const query: ReportQueryDto = {};
    
    if (input.locationId) query.locationId = input.locationId;
    if (input.productId) query.productId = input.productId;
    if (input.categoryId) query.categoryId = input.categoryId;
    if (input.dateFrom) query.dateFrom = new Date(input.dateFrom);
    if (input.dateTo) query.dateTo = new Date(input.dateTo);
    
    return query;
  }

  @Query(() => StockLevelReport, { description: 'Generate stock level report' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:read')
  async stockLevelReport(
    @Args('input', { type: () => StockLevelReportInput, nullable: true }) input: StockLevelReportInput | null,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<StockLevelReport> {
    const query = this.convertInputToQuery(input);
    const report = await this.reportingService.generateStockLevelReport(tenantId, query);
    return report.data as StockLevelReport;
  }

  @Query(() => MovementReport, { description: 'Generate movement report' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:read')
  async movementReport(
    @Args('input', { type: () => MovementReportInput, nullable: true }) input: MovementReportInput | null,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<MovementReport> {
    const query = this.convertInputToQuery(input);
    const report = await this.reportingService.generateMovementReport(tenantId, query);
    return report.data as MovementReport;
  }

  @Query(() => AgingReport, { description: 'Generate aging report' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:read')
  async agingReport(
    @Args('input', { type: () => AgingReportInput, nullable: true }) input: AgingReportInput | null,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<AgingReport> {
    const query = this.convertInputToQuery(input);
    const report = await this.reportingService.generateAgingReport(tenantId, query);
    return report.data as AgingReport;
  }

  @Query(() => TurnoverReport, { description: 'Generate turnover report' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:read')
  async turnoverReport(
    @Args('input', { type: () => TurnoverReportInput, nullable: true }) input: TurnoverReportInput | null,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<TurnoverReport> {
    const query = this.convertInputToQuery(input);
    const report = await this.reportingService.generateTurnoverReport(tenantId, query);
    return report.data as TurnoverReport;
  }
}
