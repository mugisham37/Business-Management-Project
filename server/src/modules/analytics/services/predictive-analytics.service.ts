import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { QueueService } from '../../queue/queue.service';
import { DataWarehouseService } from './data-warehouse.service';

export interface DemandForecast {
  productId: string;
  locationId: string;
  forecastPeriod: 'daily' | 'weekly' | 'monthly';
  forecastHorizon: number; // Number of periods to forecast
  predictions: Array<{
    period: Date;
    predictedDemand: number;
    confidence: number; // 0-1
    upperBound: number;
    lowerBound: number;
  }>;
  accuracy: number; // Historical accuracy of the model
  lastUpdated: Date;
}

export interface ChurnPrediction {
  customerId: string;
  churnProbability: number; // 0-1
  riskLevel: 'low' | 'medium' | 'high';
  contributingFactors: Array<{
    factor: string;
    impact: number; // -1 to 1
    description: string;
  }>;
  recommendedActions: string[];
  lastPurchaseDate: Date;
  daysSinceLastPurchase: number;
  predictedChurnDate?: Date;
  lastUpdated: Date;
}

export interface PriceOptimization {
  productId: string;
  locationId: string;
  currentPrice: number;
  optimizedPrice: number;
  expectedDemandChange: number; // Percentage change
  expectedRevenueChange: number; // Percentage change
  priceElasticity: number;
  competitorPrices: Array<{
    competitor: string;
    price: number;
  }>;
  seasonalFactors: Record<string, number>;
  lastUpdated: Date;
}

export interface InventoryOptimization {
  productId: string;
  locationId: string;
  currentLevel: number;
  optimalLevel: number;
  reorderPoint: number;
  maxLevel: number;
  safetyStock: number;
  leadTime: number; // Days
  demandVariability: number;
  stockoutRisk: number; // 0-1
  carryingCost: number;
  stockoutCost: number;
  recommendations: Array<{
    action: 'increase' | 'decrease' | 'maintain';
    quantity: number;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  lastUpdated: Date;
}

export interface PredictiveModel {
  id: string;
  name: string;
  type: 'demand_forecast' | 'churn_prediction' | 'price_optimization' | 'inventory_optimization';
  algorithm: 'linear_regression' | 'arima' | 'lstm' | 'random_forest' | 'gradient_boosting';
  features: string[];
  hyperparameters: Record<string, any>;
  trainingData: {
    startDate: Date;
    endDate: Date;
    recordCount: number;
  };
  performance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    mse?: number; // For regression models
    mae?: number; // For regression models
  };
  lastTrained: Date;
  isActive: boolean;
}

@Injectable()
export class PredictiveAnalyticsService {
  private readonly logger = new Logger(PredictiveAnalyticsService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
    private readonly queueService: QueueService,
    private readonly dataWarehouseService: DataWarehouseService,
  ) {}

  /**
   * Generate demand forecast for products
   */
  async generateDemandForecast(
    tenantId: string,
    productId: string,
    locationId: string,
    options: {
      forecastPeriod: 'daily' | 'weekly' | 'monthly';
      forecastHorizon: number;
      includeSeasonality?: boolean;
      includePromotions?: boolean;
    }
  ): Promise<DemandForecast> {
    try {
      this.logger.log(`Generating demand forecast for product ${productId} at location ${locationId}`);

      // Check cache first
      const cacheKey = `demand-forecast:${tenantId}:${productId}:${locationId}:${options.forecastPeriod}`;
      const cachedForecast = await this.cacheService.get<DemandForecast>(cacheKey);
      
      if (cachedForecast && this.isForecastFresh(cachedForecast)) {
        return cachedForecast;
      }

      // Get historical sales data
      const historicalData = await this.getHistoricalSalesData(tenantId, productId, locationId, options.forecastPeriod);
      
      // Apply demand forecasting algorithm
      const predictions = await this.applyDemandForecastingModel(historicalData, options);
      
      // Calculate model accuracy based on recent predictions vs actual
      const accuracy = await this.calculateForecastAccuracy(tenantId, productId, locationId);

      const forecast: DemandForecast = {
        productId,
        locationId,
        forecastPeriod: options.forecastPeriod,
        forecastHorizon: options.forecastHorizon,
        predictions,
        accuracy,
        lastUpdated: new Date(),
      };

      // Cache forecast for 6 hours
      await this.cacheService.set(cacheKey, forecast, { ttl: 21600 });

      return forecast;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to generate demand forecast: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Predict customer churn probability
   */
  async predictCustomerChurn(
    tenantId: string,
    customerId: string
  ): Promise<ChurnPrediction> {
    try {
      this.logger.log(`Predicting churn for customer ${customerId}`);

      // Check cache first
      const cacheKey = `churn-prediction:${tenantId}:${customerId}`;
      const cachedPrediction = await this.cacheService.get<ChurnPrediction>(cacheKey);
      
      if (cachedPrediction && this.isPredictionFresh(cachedPrediction)) {
        return cachedPrediction;
      }

      // Get customer features
      const customerFeatures = await this.getCustomerFeatures(tenantId, customerId);
      
      // Apply churn prediction model
      const churnProbability = await this.applyChurnPredictionModel(customerFeatures);
      
      // Determine risk level
      const riskLevel = this.determineChurnRiskLevel(churnProbability);
      
      // Identify contributing factors
      const contributingFactors = await this.identifyChurnFactors(customerFeatures, churnProbability);
      
      // Generate recommended actions
      const recommendedActions = this.generateChurnPreventionActions(riskLevel, contributingFactors);

      const prediction: ChurnPrediction = {
        customerId,
        churnProbability,
        riskLevel,
        contributingFactors,
        recommendedActions,
        lastPurchaseDate: customerFeatures.lastPurchaseDate,
        daysSinceLastPurchase: customerFeatures.daysSinceLastPurchase,
        predictedChurnDate: churnProbability > 0.7 ? this.calculatePredictedChurnDate(customerFeatures) : new Date(),
        lastUpdated: new Date(),
      };

      // Cache prediction for 24 hours
      await this.cacheService.set(cacheKey, prediction, { ttl: 86400 });

      return prediction;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to predict customer churn: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Optimize product pricing
   */
  async optimizeProductPricing(
    tenantId: string,
    productId: string,
    locationId: string,
    options: {
      includeCompetitorPricing?: boolean;
      includeSeasonality?: boolean;
      maxPriceChange?: number; // Maximum percentage change allowed
    } = {}
  ): Promise<PriceOptimization> {
    try {
      this.logger.log(`Optimizing pricing for product ${productId} at location ${locationId}`);

      // Check cache first
      const cacheKey = `price-optimization:${tenantId}:${productId}:${locationId}`;
      const cachedOptimization = await this.cacheService.get<PriceOptimization>(cacheKey);
      
      if (cachedOptimization && this.isOptimizationFresh(cachedOptimization)) {
        return cachedOptimization;
      }

      // Get current pricing and sales data
      const currentPrice = await this.getCurrentPrice(tenantId, productId, locationId);
      const salesData = await this.getPricingSalesData(tenantId, productId, locationId);
      
      // Calculate price elasticity
      const priceElasticity = await this.calculatePriceElasticity(salesData);
      
      // Get competitor pricing if requested
      const competitorPrices = options.includeCompetitorPricing 
        ? await this.getCompetitorPricing(productId)
        : [];
      
      // Get seasonal factors if requested
      const seasonalFactors = options.includeSeasonality
        ? await this.getSeasonalFactors(tenantId, productId, locationId)
        : {};
      
      // Apply price optimization algorithm
      const optimizedPrice = await this.applyPriceOptimizationModel({
        currentPrice,
        priceElasticity,
        competitorPrices,
        seasonalFactors,
        maxPriceChange: options.maxPriceChange || 0.2, // 20% max change by default
      });

      // Calculate expected impact
      const expectedDemandChange = this.calculateDemandChange(priceElasticity, currentPrice, optimizedPrice);
      const expectedRevenueChange = this.calculateRevenueChange(expectedDemandChange, currentPrice, optimizedPrice);

      const optimization: PriceOptimization = {
        productId,
        locationId,
        currentPrice,
        optimizedPrice,
        expectedDemandChange,
        expectedRevenueChange,
        priceElasticity,
        competitorPrices,
        seasonalFactors,
        lastUpdated: new Date(),
      };

      // Cache optimization for 12 hours
      await this.cacheService.set(cacheKey, optimization, { ttl: 43200 });

      return optimization;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to optimize pricing: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Optimize inventory levels
   */
  async optimizeInventoryLevels(
    tenantId: string,
    productId: string,
    locationId: string,
    options: {
      serviceLevel?: number; // Target service level (0-1)
      leadTime?: number; // Lead time in days
      carryingCostRate?: number; // Annual carrying cost rate
      stockoutCostPerUnit?: number;
    } = {}
  ): Promise<InventoryOptimization> {
    try {
      this.logger.log(`Optimizing inventory for product ${productId} at location ${locationId}`);

      // Check cache first
      const cacheKey = `inventory-optimization:${tenantId}:${productId}:${locationId}`;
      const cachedOptimization = await this.cacheService.get<InventoryOptimization>(cacheKey);
      
      if (cachedOptimization && this.isOptimizationFresh(cachedOptimization)) {
        return cachedOptimization;
      }

      // Get current inventory level and demand data
      const currentLevel = await this.getCurrentInventoryLevel(tenantId, productId, locationId);
      const demandData = await this.getInventoryDemandData(tenantId, productId, locationId);
      
      // Calculate demand statistics
      const avgDemand = this.calculateAverageDemand(demandData);
      const demandVariability = this.calculateDemandVariability(demandData);
      
      // Get or use default parameters
      const serviceLevel = options.serviceLevel || 0.95; // 95% service level
      const leadTime = options.leadTime || await this.getAverageLeadTime(tenantId, productId);
      const carryingCostRate = options.carryingCostRate || 0.25; // 25% annual carrying cost
      const stockoutCostPerUnit = options.stockoutCostPerUnit || await this.estimateStockoutCost(tenantId, productId);

      // Apply inventory optimization algorithms
      const safetyStock = this.calculateSafetyStock(avgDemand, demandVariability, leadTime, serviceLevel);
      const reorderPoint = this.calculateReorderPoint(avgDemand, leadTime, safetyStock);
      const optimalLevel = this.calculateOptimalInventoryLevel(avgDemand, leadTime, safetyStock, carryingCostRate, stockoutCostPerUnit);
      const maxLevel = this.calculateMaxInventoryLevel(optimalLevel, avgDemand);

      // Calculate risks and costs
      const stockoutRisk = this.calculateStockoutRisk(currentLevel, avgDemand, demandVariability, leadTime);
      const carryingCost = this.calculateCarryingCost(currentLevel, carryingCostRate);

      // Generate recommendations
      const recommendations = this.generateInventoryRecommendations(
        currentLevel,
        optimalLevel,
        reorderPoint,
        stockoutRisk
      );

      const optimization: InventoryOptimization = {
        productId,
        locationId,
        currentLevel,
        optimalLevel,
        reorderPoint,
        maxLevel,
        safetyStock,
        leadTime,
        demandVariability,
        stockoutRisk,
        carryingCost,
        stockoutCost: stockoutCostPerUnit,
        recommendations,
        lastUpdated: new Date(),
      };

      // Cache optimization for 6 hours
      await this.cacheService.set(cacheKey, optimization, { ttl: 21600 });

      return optimization;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to optimize inventory: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Get all predictive models for tenant
   */
  async getPredictiveModels(tenantId: string): Promise<PredictiveModel[]> {
    try {
      const cacheKey = `predictive-models:${tenantId}`;
      let models = await this.cacheService.get<PredictiveModel[]>(cacheKey);
      
      if (!models) {
        models = await this.loadPredictiveModels(tenantId);
        await this.cacheService.set(cacheKey, models, { ttl: 3600 }); // Cache for 1 hour
      }

      return models;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get predictive models: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Train or retrain a predictive model
   */
  async trainPredictiveModel(
    tenantId: string,
    modelType: 'demand_forecast' | 'churn_prediction' | 'price_optimization' | 'inventory_optimization',
    options: {
      algorithm?: string;
      features?: string[];
      hyperparameters?: Record<string, any>;
      trainingPeriod?: { startDate: Date; endDate: Date };
    } = {}
  ): Promise<PredictiveModel> {
    try {
      this.logger.log(`Training ${modelType} model for tenant ${tenantId}`);

      // Queue model training job (this is computationally intensive)
      const jobId = await this.queueService.add('train-predictive-model', {
        tenantId,
        modelType,
        options,
      }, {
        priority: 3, // Medium priority
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000, // 1 minute
        },
      });

      // Return placeholder model that will be updated when training completes
      const model: PredictiveModel = {
        id: `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${modelType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Model`,
        type: modelType,
        algorithm: (options.algorithm || this.getDefaultAlgorithm(modelType)) as 'linear_regression' | 'arima' | 'lstm' | 'random_forest' | 'gradient_boosting',
        features: options.features || this.getDefaultFeatures(modelType),
        hyperparameters: options.hyperparameters || {},
        trainingData: {
          startDate: options.trainingPeriod?.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
          endDate: options.trainingPeriod?.endDate || new Date(),
          recordCount: 0, // Will be updated during training
        },
        performance: {
          accuracy: 0,
          precision: 0,
          recall: 0,
          f1Score: 0,
        },
        lastTrained: new Date(),
        isActive: false, // Will be activated after successful training
      };

      // Store model metadata
      await this.storePredictiveModel(tenantId, model);

      return model;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to train predictive model: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private isForecastFresh(forecast: DemandForecast): boolean {
    const maxAge = 6 * 60 * 60 * 1000; // 6 hours
    return Date.now() - forecast.lastUpdated.getTime() < maxAge;
  }

  private isPredictionFresh(prediction: ChurnPrediction): boolean {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    return Date.now() - prediction.lastUpdated.getTime() < maxAge;
  }

  private isOptimizationFresh(optimization: PriceOptimization | InventoryOptimization): boolean {
    const maxAge = 12 * 60 * 60 * 1000; // 12 hours
    return Date.now() - optimization.lastUpdated.getTime() < maxAge;
  }

  private async getHistoricalSalesData(
    tenantId: string,
    productId: string,
    locationId: string,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<Array<{ date: Date; quantity: number; revenue: number }>> {
    // This would query the data warehouse for historical sales data
    // For now, return mock data
    const data = [];
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
    
    for (let i = 0; i < 365; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      data.push({
        date,
        quantity: Math.floor(Math.random() * 50) + 10, // 10-60 units
        revenue: (Math.random() * 500) + 100, // $100-600
      });
    }
    
    return data;
  }

  private async applyDemandForecastingModel(
    historicalData: Array<{ date: Date; quantity: number; revenue: number }>,
    options: any
  ): Promise<Array<{
    period: Date;
    predictedDemand: number;
    confidence: number;
    upperBound: number;
    lowerBound: number;
  }>> {
    // Simple moving average forecast (in production, would use more sophisticated algorithms)
    const windowSize = 30; // 30-day moving average
    const predictions = [];
    
    // Calculate moving average from recent data
    const recentData = historicalData.slice(-windowSize);
    const avgDemand = recentData.reduce((sum, d) => sum + d.quantity, 0) / recentData.length;
    const stdDev = Math.sqrt(
      recentData.reduce((sum, d) => sum + Math.pow(d.quantity - avgDemand, 2), 0) / recentData.length
    );
    
    // Generate predictions for the forecast horizon
    const startDate = new Date();
    for (let i = 1; i <= options.forecastHorizon; i++) {
      const period = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      
      // Add some seasonality and trend
      const seasonalFactor = 1 + 0.1 * Math.sin((i / 365) * 2 * Math.PI); // Annual seasonality
      const trendFactor = 1 + (i * 0.001); // Small upward trend
      
      const predictedDemand = avgDemand * seasonalFactor * trendFactor;
      const confidence = Math.max(0.5, 1 - (i * 0.01)); // Confidence decreases over time
      
      predictions.push({
        period,
        predictedDemand: Math.round(predictedDemand),
        confidence,
        upperBound: Math.round(predictedDemand + 1.96 * stdDev), // 95% confidence interval
        lowerBound: Math.round(Math.max(0, predictedDemand - 1.96 * stdDev)),
      });
    }
    
    return predictions;
  }

  private async calculateForecastAccuracy(
    tenantId: string,
    productId: string,
    locationId: string
  ): Promise<number> {
    // This would compare recent predictions with actual sales
    // For now, return a mock accuracy
    return 0.75 + Math.random() * 0.2; // 75-95% accuracy
  }

  private async getCustomerFeatures(tenantId: string, customerId: string): Promise<{
    lastPurchaseDate: Date;
    daysSinceLastPurchase: number;
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    purchaseFrequency: number;
    loyaltyPoints: number;
    supportTickets: number;
    emailEngagement: number;
  }> {
    // This would query customer data from the database
    // For now, return mock data
    const lastPurchaseDate = new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000); // 0-180 days ago
    
    return {
      lastPurchaseDate,
      daysSinceLastPurchase: Math.floor((Date.now() - lastPurchaseDate.getTime()) / (24 * 60 * 60 * 1000)),
      totalOrders: Math.floor(Math.random() * 50) + 1,
      totalSpent: Math.random() * 5000 + 100,
      averageOrderValue: Math.random() * 200 + 50,
      purchaseFrequency: Math.random() * 30 + 1, // Days between purchases
      loyaltyPoints: Math.floor(Math.random() * 1000),
      supportTickets: Math.floor(Math.random() * 5),
      emailEngagement: Math.random(), // 0-1
    };
  }

  private async applyChurnPredictionModel(customerFeatures: any): Promise<number> {
    // Simple logistic regression-like model (in production, would use ML libraries)
    let score = 0;
    
    // Days since last purchase (higher = more likely to churn)
    score += customerFeatures.daysSinceLastPurchase * 0.01;
    
    // Purchase frequency (lower = more likely to churn)
    score += (30 - customerFeatures.purchaseFrequency) * 0.02;
    
    // Support tickets (higher = more likely to churn)
    score += customerFeatures.supportTickets * 0.1;
    
    // Email engagement (lower = more likely to churn)
    score += (1 - customerFeatures.emailEngagement) * 0.3;
    
    // Convert to probability using sigmoid function
    return 1 / (1 + Math.exp(-score));
  }

  private determineChurnRiskLevel(churnProbability: number): 'low' | 'medium' | 'high' {
    if (churnProbability < 0.3) return 'low';
    if (churnProbability < 0.7) return 'medium';
    return 'high';
  }

  private async identifyChurnFactors(customerFeatures: any, churnProbability: number): Promise<Array<{
    factor: string;
    impact: number;
    description: string;
  }>> {
    const factors = [];
    
    if (customerFeatures.daysSinceLastPurchase > 60) {
      factors.push({
        factor: 'Inactivity',
        impact: 0.4,
        description: `${customerFeatures.daysSinceLastPurchase} days since last purchase`,
      });
    }
    
    if (customerFeatures.purchaseFrequency > 45) {
      factors.push({
        factor: 'Low Purchase Frequency',
        impact: 0.3,
        description: `Purchases only every ${customerFeatures.purchaseFrequency} days on average`,
      });
    }
    
    if (customerFeatures.supportTickets > 2) {
      factors.push({
        factor: 'Support Issues',
        impact: 0.2,
        description: `${customerFeatures.supportTickets} support tickets indicate potential dissatisfaction`,
      });
    }
    
    if (customerFeatures.emailEngagement < 0.3) {
      factors.push({
        factor: 'Low Engagement',
        impact: 0.25,
        description: `Low email engagement rate (${Math.round(customerFeatures.emailEngagement * 100)}%)`,
      });
    }
    
    return factors;
  }

  private generateChurnPreventionActions(
    riskLevel: 'low' | 'medium' | 'high',
    factors: Array<{ factor: string; impact: number; description: string }>
  ): string[] {
    const actions = [];
    
    if (riskLevel === 'high') {
      actions.push('Immediate personal outreach by account manager');
      actions.push('Offer exclusive discount or loyalty bonus');
      actions.push('Schedule product demo or consultation');
    }
    
    if (riskLevel === 'medium' || riskLevel === 'high') {
      actions.push('Send targeted re-engagement email campaign');
      actions.push('Offer personalized product recommendations');
    }
    
    // Factor-specific actions
    factors.forEach(factor => {
      switch (factor.factor) {
        case 'Inactivity':
          actions.push('Send "We miss you" campaign with special offer');
          break;
        case 'Low Purchase Frequency':
          actions.push('Implement subscription or auto-reorder program');
          break;
        case 'Support Issues':
          actions.push('Proactive customer success check-in');
          break;
        case 'Low Engagement':
          actions.push('Optimize email content and frequency');
          break;
      }
    });
    
    return [...new Set(actions)]; // Remove duplicates
  }

  private calculatePredictedChurnDate(customerFeatures: any): Date {
    // Simple heuristic: if they haven't purchased in X days, they'll churn in X/2 more days
    const additionalDays = Math.max(30, customerFeatures.daysSinceLastPurchase / 2);
    return new Date(Date.now() + additionalDays * 24 * 60 * 60 * 1000);
  }

  // Additional helper methods for pricing and inventory optimization...
  private async getCurrentPrice(tenantId: string, productId: string, locationId: string): Promise<number> {
    // Mock current price
    return Math.random() * 100 + 10; // $10-110
  }

  private async getPricingSalesData(tenantId: string, productId: string, locationId: string): Promise<Array<{
    date: Date;
    price: number;
    quantity: number;
    revenue: number;
  }>> {
    // Mock pricing sales data
    const data = [];
    for (let i = 0; i < 90; i++) { // 90 days of data
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const price = 50 + Math.random() * 20; // $50-70
      const quantity = Math.floor(Math.random() * 20) + 5; // 5-25 units
      data.push({
        date,
        price,
        quantity,
        revenue: price * quantity,
      });
    }
    return data;
  }

  private async calculatePriceElasticity(salesData: Array<{ price: number; quantity: number }>): Promise<number> {
    // Simple price elasticity calculation
    // In production, would use more sophisticated econometric methods
    if (salesData.length < 2) return -1; // Default elasticity
    
    const avgPrice = salesData.reduce((sum, d) => sum + d.price, 0) / salesData.length;
    const avgQuantity = salesData.reduce((sum, d) => sum + d.quantity, 0) / salesData.length;
    
    let numerator = 0;
    let denominator = 0;
    
    salesData.forEach(d => {
      const priceChange = (d.price - avgPrice) / avgPrice;
      const quantityChange = (d.quantity - avgQuantity) / avgQuantity;
      numerator += quantityChange * priceChange;
      denominator += priceChange * priceChange;
    });
    
    return denominator !== 0 ? numerator / denominator : -1;
  }

  private async getCompetitorPricing(productId: string): Promise<Array<{ competitor: string; price: number }>> {
    // Mock competitor pricing data
    return [
      { competitor: 'Competitor A', price: Math.random() * 20 + 40 },
      { competitor: 'Competitor B', price: Math.random() * 20 + 45 },
      { competitor: 'Competitor C', price: Math.random() * 20 + 50 },
    ];
  }

  private async getSeasonalFactors(tenantId: string, productId: string, locationId: string): Promise<Record<string, number>> {
    // Mock seasonal factors
    return {
      'Q1': 0.9,
      'Q2': 1.1,
      'Q3': 1.2,
      'Q4': 1.3,
    };
  }

  private async applyPriceOptimizationModel(params: {
    currentPrice: number;
    priceElasticity: number;
    competitorPrices: Array<{ competitor: string; price: number }>;
    seasonalFactors: Record<string, number>;
    maxPriceChange: number;
  }): Promise<number> {
    // Simple price optimization algorithm
    const avgCompetitorPrice = params.competitorPrices.length > 0
      ? params.competitorPrices.reduce((sum, c) => sum + c.price, 0) / params.competitorPrices.length
      : params.currentPrice;
    
    // Current quarter seasonal factor
    const currentQuarter = `Q${Math.floor(new Date().getMonth() / 3) + 1}`;
    const seasonalFactor = params.seasonalFactors[currentQuarter] || 1;
    
    // Optimal price considering elasticity and competition
    let optimalPrice = params.currentPrice;
    
    // If demand is elastic (elasticity < -1), be more conservative with price increases
    if (params.priceElasticity < -1) {
      optimalPrice = Math.min(params.currentPrice * 1.05, avgCompetitorPrice * 0.95);
    } else {
      // If demand is inelastic, can increase price more aggressively
      optimalPrice = Math.min(params.currentPrice * 1.15, avgCompetitorPrice * 1.05);
    }
    
    // Apply seasonal adjustment
    optimalPrice *= seasonalFactor;
    
    // Respect maximum price change constraint
    const maxPrice = params.currentPrice * (1 + params.maxPriceChange);
    const minPrice = params.currentPrice * (1 - params.maxPriceChange);
    
    return Math.max(minPrice, Math.min(maxPrice, optimalPrice));
  }

  private calculateDemandChange(elasticity: number, oldPrice: number, newPrice: number): number {
    const priceChange = (newPrice - oldPrice) / oldPrice;
    return elasticity * priceChange * 100; // Return as percentage
  }

  private calculateRevenueChange(demandChange: number, oldPrice: number, newPrice: number): number {
    const priceChange = (newPrice - oldPrice) / oldPrice * 100;
    return priceChange + demandChange + (priceChange * demandChange / 100);
  }

  // Inventory optimization helper methods...
  private async getCurrentInventoryLevel(tenantId: string, productId: string, locationId: string): Promise<number> {
    // Mock current inventory level
    return Math.floor(Math.random() * 200) + 50; // 50-250 units
  }

  private async getInventoryDemandData(tenantId: string, productId: string, locationId: string): Promise<number[]> {
    // Mock daily demand data for the last 90 days
    const data = [];
    for (let i = 0; i < 90; i++) {
      data.push(Math.floor(Math.random() * 20) + 5); // 5-25 units per day
    }
    return data;
  }

  private calculateAverageDemand(demandData: number[]): number {
    return demandData.reduce((sum, d) => sum + d, 0) / demandData.length;
  }

  private calculateDemandVariability(demandData: number[]): number {
    const avg = this.calculateAverageDemand(demandData);
    const variance = demandData.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / demandData.length;
    return Math.sqrt(variance);
  }

  private async getAverageLeadTime(tenantId: string, productId: string): Promise<number> {
    // Mock lead time
    return Math.floor(Math.random() * 10) + 5; // 5-15 days
  }

  private async estimateStockoutCost(tenantId: string, productId: string): Promise<number> {
    // Mock stockout cost per unit
    return Math.random() * 50 + 10; // $10-60 per unit
  }

  private calculateSafetyStock(avgDemand: number, demandVariability: number, leadTime: number, serviceLevel: number): number {
    // Safety stock = Z-score * sqrt(lead time) * demand standard deviation
    const zScore = this.getZScore(serviceLevel);
    return Math.ceil(zScore * Math.sqrt(leadTime) * demandVariability);
  }

  private calculateReorderPoint(avgDemand: number, leadTime: number, safetyStock: number): number {
    return Math.ceil(avgDemand * leadTime + safetyStock);
  }

  private calculateOptimalInventoryLevel(
    avgDemand: number,
    leadTime: number,
    safetyStock: number,
    carryingCostRate: number,
    stockoutCost: number
  ): number {
    // Economic Order Quantity (EOQ) based approach
    const annualDemand = avgDemand * 365;
    const orderingCost = 50; // Assume $50 per order
    
    const eoq = Math.sqrt((2 * annualDemand * orderingCost) / carryingCostRate);
    return Math.ceil(eoq / 2 + safetyStock); // Average inventory level
  }

  private calculateMaxInventoryLevel(optimalLevel: number, avgDemand: number): number {
    // Max level is typically 2-3 times the optimal level
    return Math.ceil(optimalLevel * 2.5);
  }

  private calculateStockoutRisk(currentLevel: number, avgDemand: number, demandVariability: number, leadTime: number): number {
    // Probability of stockout during lead time
    const leadTimeDemand = avgDemand * leadTime;
    const leadTimeDemandStdDev = demandVariability * Math.sqrt(leadTime);
    
    if (leadTimeDemandStdDev === 0) return currentLevel < leadTimeDemand ? 1 : 0;
    
    const zScore = (currentLevel - leadTimeDemand) / leadTimeDemandStdDev;
    return Math.max(0, Math.min(1, 0.5 - this.normalCDF(zScore) + 0.5));
  }

  private calculateCarryingCost(inventoryLevel: number, carryingCostRate: number): number {
    // Assume average unit cost of $20
    const avgUnitCost = 20;
    return inventoryLevel * avgUnitCost * carryingCostRate;
  }

  private generateInventoryRecommendations(
    currentLevel: number,
    optimalLevel: number,
    reorderPoint: number,
    stockoutRisk: number
  ): Array<{
    action: 'increase' | 'decrease' | 'maintain';
    quantity: number;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    const recommendations = [];
    
    if (currentLevel < reorderPoint) {
      recommendations.push({
        action: 'increase' as const,
        quantity: optimalLevel - currentLevel,
        reason: 'Current level is below reorder point',
        priority: stockoutRisk > 0.2 ? 'high' as const : 'medium' as const,
      });
    } else if (currentLevel > optimalLevel * 1.5) {
      recommendations.push({
        action: 'decrease' as const,
        quantity: currentLevel - optimalLevel,
        reason: 'Current level is significantly above optimal',
        priority: 'medium' as const,
      });
    } else {
      recommendations.push({
        action: 'maintain' as const,
        quantity: 0,
        reason: 'Current level is within acceptable range',
        priority: 'low' as const,
      });
    }
    
    return recommendations;
  }

  private getZScore(serviceLevel: number): number {
    // Approximate Z-scores for common service levels
    const zScores: Record<string, number> = {
      '0.90': 1.28,
      '0.95': 1.65,
      '0.99': 2.33,
    };
    
    const key = serviceLevel.toFixed(2);
    return zScores[key] || 1.65; // Default to 95% service level
  }

  private normalCDF(x: number): number {
    // Approximation of the cumulative distribution function for standard normal distribution
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Approximation of the error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private async loadPredictiveModels(tenantId: string): Promise<PredictiveModel[]> {
    // This would load from database - for now return default models
    return [
      {
        id: 'demand-forecast-model',
        name: 'Demand Forecasting Model',
        type: 'demand_forecast',
        algorithm: 'arima',
        features: ['historical_sales', 'seasonality', 'promotions', 'weather'],
        hyperparameters: { p: 2, d: 1, q: 2 },
        trainingData: {
          startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          recordCount: 10000,
        },
        performance: {
          accuracy: 0.85,
          precision: 0.82,
          recall: 0.88,
          f1Score: 0.85,
          mse: 12.5,
          mae: 8.3,
        },
        lastTrained: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        isActive: true,
      },
      {
        id: 'churn-prediction-model',
        name: 'Customer Churn Prediction Model',
        type: 'churn_prediction',
        algorithm: 'random_forest',
        features: ['recency', 'frequency', 'monetary', 'engagement', 'support_tickets'],
        hyperparameters: { n_estimators: 100, max_depth: 10 },
        trainingData: {
          startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          recordCount: 5000,
        },
        performance: {
          accuracy: 0.78,
          precision: 0.75,
          recall: 0.82,
          f1Score: 0.78,
        },
        lastTrained: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
        isActive: true,
      },
    ];
  }

  private async storePredictiveModel(tenantId: string, model: PredictiveModel): Promise<void> {
    // This would store in database - for now just log
    this.logger.debug(`Storing predictive model for tenant ${tenantId}:`, model);
  }

  private getDefaultAlgorithm(modelType: string): string {
    const defaults: Record<string, string> = {
      'demand_forecast': 'arima',
      'churn_prediction': 'random_forest',
      'price_optimization': 'linear_regression',
      'inventory_optimization': 'gradient_boosting',
    };
    return defaults[modelType] || 'linear_regression';
  }

  private getDefaultFeatures(modelType: string): string[] {
    const defaults: Record<string, string[]> = {
      'demand_forecast': ['historical_sales', 'seasonality', 'promotions'],
      'churn_prediction': ['recency', 'frequency', 'monetary', 'engagement'],
      'price_optimization': ['demand_elasticity', 'competitor_prices', 'seasonality'],
      'inventory_optimization': ['demand_variability', 'lead_time', 'carrying_cost'],
    };
    return defaults[modelType] || [];
  }
}