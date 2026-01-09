import { Test, TestingModule } from '@nestjs/testing';
import { LocationReportingService } from './location-reporting.service';
import { LocationService } from './location.service';
import { FinancialReportingService } from '../../financial/services/financial-reporting.service';
import { InventoryReportingService } from '../../inventory/services/inventory-reporting.service';
import { CustomerAnalyticsService } from '../../crm/services/customer-analytics.service';
import { ProcurementAnalyticsService } from '../../supplier/services/procurement-analytics.service';
import { TransactionService } from '../../pos/services/transaction.service';
import { Location } from '../entities/location.entity';
import { LocationType, LocationStatus } from '../dto/location.dto';
import { Transaction } from '../../pos/entities/transaction.entity';

describe('LocationReportingService', () => {
  let service: LocationReportingService;
  let mockLocationService: jest.Mocked<LocationService>;
  let mockFinancialService: jest.Mocked<FinancialReportingService>;
  let mockInventoryService: jest.Mocked<InventoryReportingService>;
  let mockCustomerService: jest.Mocked<CustomerAnalyticsService>;
  let mockProcurementService: jest.Mocked<ProcurementAnalyticsService>;
  let mockTransactionService: jest.Mocked<TransactionService>;

  beforeEach(async () => {
    const mockLocationServiceValue = {
      findById: jest.fn(),
      findAll: jest.fn(),
    };

    const mockFinancialServiceValue = {
      generateIncomeStatement: jest.fn(),
    };

    const mockInventoryServiceValue = {
      generateStockLevelReport: jest.fn(),
      generateTurnoverReport: jest.fn(),
      generateMovementReport: jest.fn(),
    };

    const mockCustomerServiceValue = {
      getCustomerSegmentAnalytics: jest.fn(),
      getTopCustomersByValue: jest.fn(),
      getCustomerGrowthMetrics: jest.fn(),
    };

    const mockProcurementServiceValue = {};

    const mockTransactionServiceValue = {
      getTransactionSummary: jest.fn(),
      findTransactionsByTenant: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationReportingService,
        {
          provide: LocationService,
          useValue: mockLocationServiceValue,
        },
        {
          provide: FinancialReportingService,
          useValue: mockFinancialServiceValue,
        },
        {
          provide: InventoryReportingService,
          useValue: mockInventoryServiceValue,
        },
        {
          provide: CustomerAnalyticsService,
          useValue: mockCustomerServiceValue,
        },
        {
          provide: ProcurementAnalyticsService,
          useValue: mockProcurementServiceValue,
        },
        {
          provide: TransactionService,
          useValue: mockTransactionServiceValue,
        },
      ],
    }).compile();

    service = module.get<LocationReportingService>(LocationReportingService);
    mockLocationService = module.get(LocationService);
    mockFinancialService = module.get(FinancialReportingService);
    mockInventoryService = module.get(InventoryReportingService);
    mockCustomerService = module.get(CustomerAnalyticsService);
    mockProcurementService = module.get(ProcurementAnalyticsService);
    mockTransactionService = module.get(TransactionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateConsolidatedReport', () => {
    it('should generate a consolidated report with basic data', async () => {
      // Arrange
      const tenantId = 'test-tenant';
      const query = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        reportType: 'comprehensive' as const,
      };

      const mockLocation: Location = {
        id: 'location-1',
        tenantId: 'test-tenant',
        name: 'Test Location',
        code: 'LOC001',
        type: LocationType.STORE,
        status: LocationStatus.ACTIVE,
        address: {
          street: '123 Main St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'US',
        },
        timezone: 'UTC',
        currency: 'USD',
        managerId: 'manager-1',
        settings: {},
        metrics: {},
        taxSettings: {},
        inventorySettings: {},
        posSettings: {},
        featureFlags: {},
        capacity: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        isActive: true,
      };

      mockLocationService.findAll.mockResolvedValue({
        locations: [mockLocation],
        total: 1,
      });

      mockFinancialService.generateIncomeStatement.mockResolvedValue({
        reportType: 'income_statement',
        reportDate: new Date(),
        periodStart: query.startDate,
        periodEnd: query.endDate,
        currency: 'USD',
        data: {
          revenue: { totalRevenue: 10000 },
          costOfGoodsSold: { grossProfit: 6000 },
          netIncome: 4000,
          operatingExpenses: { totalOperatingExpenses: 1500 },
          otherExpenses: { totalOtherExpenses: 500 },
        },
        metadata: {
          generatedAt: new Date(),
          generatedBy: 'system',
          tenantId,
        },
      });

      mockInventoryService.generateStockLevelReport.mockResolvedValue({
        reportType: 'stock_level',
        generatedAt: new Date(),
        parameters: {},
        data: {
          products: [],
          summary: { totalValue: 50000, totalProducts: 100, lowStockItems: 5, outOfStockItems: 2, overstockItems: 3 },
        },
        summary: { totalValue: 50000 },
      });

      mockInventoryService.generateTurnoverReport.mockResolvedValue({
        reportType: 'turnover',
        generatedAt: new Date(),
        parameters: {},
        data: {
          products: [],
          summary: { averageTurnover: 6.5, fastMovingItems: 20, slowMovingItems: 10, deadStockItems: 5 },
        },
        summary: { averageTurnover: 6.5 },
      });

      mockInventoryService.generateMovementReport.mockResolvedValue({
        reportType: 'movement',
        generatedAt: new Date(),
        parameters: {},
        data: {
          movements: [],
          summary: { totalMovements: 150, totalInbound: 100, totalOutbound: 50, netMovement: 50, valueChange: 5000 },
        },
        summary: { totalMovements: 150 },
      });

      mockCustomerService.getCustomerSegmentAnalytics.mockResolvedValue([
        {
          segmentName: 'Gold Tier',
          customerCount: 50,
          averageLifetimeValue: 1200,
          averageOrderValue: 85,
          averagePurchaseFrequency: 2.5,
          churnRate: 0.1,
          loyaltyTierDistribution: { gold: 50 },
        },
      ]);

      mockCustomerService.getTopCustomersByValue.mockResolvedValue([]);
      mockCustomerService.getCustomerGrowthMetrics.mockResolvedValue({
        newCustomers: 25,
        returningCustomers: 40,
        churnedCustomers: 5,
        reactivatedCustomers: 3,
        growthRate: 15.5,
      });

      mockTransactionService.getTransactionSummary.mockResolvedValue({
        totalTransactions: 200,
        totalAmount: 10000,
        averageTransactionValue: 50,
        completedTransactions: 195,
        voidedTransactions: 3,
        refundedTransactions: 2,
      });

      mockTransactionService.findTransactionsByTenant.mockResolvedValue({
        transactions: [
          {
            id: '1',
            tenantId: 'test-tenant',
            transactionNumber: 'TXN001',
            locationId: 'location-1',
            subtotal: 45,
            taxAmount: 5,
            discountAmount: 0,
            tipAmount: 0,
            total: 50,
            status: 'completed',
            itemCount: 2,
            paymentMethod: 'cash',
            paymentStatus: 'completed',
            isOfflineTransaction: false,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
            isActive: true,
          } as Transaction,
          {
            id: '2',
            tenantId: 'test-tenant',
            transactionNumber: 'TXN002',
            locationId: 'location-1',
            subtotal: 27,
            taxAmount: 3,
            discountAmount: 0,
            tipAmount: 0,
            total: 30,
            status: 'refunded',
            itemCount: 1,
            paymentMethod: 'card',
            paymentStatus: 'refunded',
            isOfflineTransaction: false,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
            isActive: true,
          } as Transaction,
        ],
        total: 2,
      });

      // Act
      const result = await service.generateConsolidatedReport(tenantId, query);

      // Assert
      expect(result).toBeDefined();
      expect(result.reportType).toBe('comprehensive');
      expect(result.tenantId).toBe(tenantId);
      expect(result.totalLocations).toBe(1);
      expect(result.locationMetrics).toHaveLength(1);
      
      const locationMetric = result.locationMetrics[0];
      expect(locationMetric).toBeDefined();
      if (locationMetric) {
        expect(locationMetric.locationId).toBe('location-1');
        expect(locationMetric.locationName).toBe('Test Location');
        expect(locationMetric.revenue).toBe(10000);
        expect(locationMetric.grossProfit).toBe(6000);
        expect(locationMetric.netProfit).toBe(4000);
        expect(locationMetric.profitMargin).toBe(40); // 4000/10000 * 100
      }
      
      expect(result.aggregatedMetrics.totalRevenue).toBe(10000);
      expect(result.aggregatedMetrics.totalTransactions).toBe(200);
    });

    it('should handle empty location list', async () => {
      // Arrange
      const tenantId = 'test-tenant';
      const query = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        reportType: 'comprehensive' as const,
      };

      mockLocationService.findAll.mockResolvedValue({
        locations: [],
        total: 0,
      });

      // Act & Assert
      await expect(service.generateConsolidatedReport(tenantId, query))
        .rejects
        .toThrow('No locations found for the specified criteria');
    });
  });

  describe('generateLocationComparison', () => {
    it('should generate location comparison report', async () => {
      // Arrange
      const tenantId = 'test-tenant';
      const locationIds = ['loc-1', 'loc-2'];
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockLocations: Location[] = [
        {
          id: 'loc-1',
          tenantId: 'test-tenant',
          name: 'Location 1',
          code: 'L001',
          type: LocationType.STORE,
          status: LocationStatus.ACTIVE,
          address: {
            street: '123 Main St',
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'US',
          },
          timezone: 'UTC',
          currency: 'USD',
          settings: {},
          metrics: {},
          taxSettings: {},
          inventorySettings: {},
          posSettings: {},
          featureFlags: {},
          capacity: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          isActive: true,
        },
        {
          id: 'loc-2',
          tenantId: 'test-tenant',
          name: 'Location 2',
          code: 'L002',
          type: LocationType.STORE,
          status: LocationStatus.ACTIVE,
          address: {
            street: '456 Oak Ave',
            city: 'Test City',
            state: 'TS',
            postalCode: '12346',
            country: 'US',
          },
          timezone: 'UTC',
          currency: 'USD',
          settings: {},
          metrics: {},
          taxSettings: {},
          inventorySettings: {},
          posSettings: {},
          featureFlags: {},
          capacity: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          isActive: true,
        },
      ];

      mockLocationService.findById
        .mockResolvedValueOnce(mockLocations[0]!)
        .mockResolvedValueOnce(mockLocations[1]!);

      // Mock the same services as above for each location
      mockFinancialService.generateIncomeStatement.mockResolvedValue({
        reportType: 'income_statement',
        reportDate: new Date(),
        periodStart: startDate,
        periodEnd: endDate,
        currency: 'USD',
        data: {
          revenue: { totalRevenue: 5000 },
          costOfGoodsSold: { grossProfit: 3000 },
          netIncome: 2000,
          operatingExpenses: { totalOperatingExpenses: 750 },
          otherExpenses: { totalOtherExpenses: 250 },
        },
        metadata: { generatedAt: new Date(), generatedBy: 'system', tenantId },
      });

      // Mock other services with minimal data
      mockInventoryService.generateStockLevelReport.mockResolvedValue({
        reportType: 'stock_level',
        generatedAt: new Date(),
        parameters: {},
        data: { products: [], summary: { totalValue: 25000, totalProducts: 50, lowStockItems: 2, outOfStockItems: 1, overstockItems: 1 } },
        summary: { totalValue: 25000 },
      });

      mockInventoryService.generateTurnoverReport.mockResolvedValue({
        reportType: 'turnover',
        generatedAt: new Date(),
        parameters: {},
        data: { products: [], summary: { averageTurnover: 5.0, fastMovingItems: 10, slowMovingItems: 5, deadStockItems: 2 } },
        summary: { averageTurnover: 5.0 },
      });

      mockInventoryService.generateMovementReport.mockResolvedValue({
        reportType: 'movement',
        generatedAt: new Date(),
        parameters: {},
        data: { movements: [], summary: { totalMovements: 75, totalInbound: 50, totalOutbound: 25, netMovement: 25, valueChange: 2500 } },
        summary: { totalMovements: 75 },
      });

      mockCustomerService.getCustomerSegmentAnalytics.mockResolvedValue([]);
      mockCustomerService.getTopCustomersByValue.mockResolvedValue([]);
      mockCustomerService.getCustomerGrowthMetrics.mockResolvedValue({
        newCustomers: 10, returningCustomers: 20, churnedCustomers: 2, reactivatedCustomers: 1, growthRate: 8.0,
      });

      mockTransactionService.getTransactionSummary.mockResolvedValue({
        totalTransactions: 100, totalAmount: 5000, averageTransactionValue: 50,
        completedTransactions: 98, voidedTransactions: 1, refundedTransactions: 1,
      });

      mockTransactionService.findTransactionsByTenant.mockResolvedValue({
        transactions: [{
          id: '1',
          tenantId: 'test-tenant',
          transactionNumber: 'TXN001',
          locationId: 'loc-1',
          subtotal: 45,
          taxAmount: 5,
          discountAmount: 0,
          tipAmount: 0,
          total: 50,
          status: 'completed',
          itemCount: 2,
          paymentMethod: 'cash',
          paymentStatus: 'completed',
          isOfflineTransaction: false,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          isActive: true,
        } as Transaction],
        total: 1,
      });

      // Act
      const result = await service.generateLocationComparison(
        tenantId,
        locationIds,
        'peer',
        startDate,
        endDate,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.comparisonType).toBe('peer');
      expect(result.tenantId).toBe(tenantId);
      expect(result.locations).toHaveLength(2);
      expect(result.insights).toBeDefined();
      expect(result.insights.topPerformers).toBeDefined();
      expect(result.insights.underperformers).toBeDefined();
    });

    it('should throw error for insufficient locations', async () => {
      // Arrange
      const tenantId = 'test-tenant';
      const locationIds = ['loc-1'];
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockLocationService.findById.mockResolvedValue({
        id: 'loc-1',
        tenantId: 'test-tenant',
        name: 'Location 1',
        code: 'L001',
        type: LocationType.STORE,
        status: LocationStatus.ACTIVE,
        address: {
          street: '123 Main St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'US',
        },
        timezone: 'UTC',
        currency: 'USD',
        settings: {},
        metrics: {},
        taxSettings: {},
        inventorySettings: {},
        posSettings: {},
        featureFlags: {},
        capacity: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        isActive: true,
      } as Location);

      // Act & Assert
      await expect(service.generateLocationComparison(
        tenantId,
        locationIds,
        'peer',
        startDate,
        endDate,
      )).rejects.toThrow('At least 2 locations required for comparison');
    });
  });
});