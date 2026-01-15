import { Injectable, Logger } from '@nestjs/common';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

export interface ProgressiveLoadingOptions {
  pageSize: number;
  maxPages: number;
  preloadNext: boolean;
  cachePages: boolean;
  priorityFields: string[];
}

export interface ProgressiveLoadingResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  metadata: {
    loadingStrategy: 'progressive';
    preloadedPages: number[];
    cachedPages: number[];
    loadTime: number;
  };
}

export interface LoadingChunk<T> {
  id: string;
  data: T[];
  priority: 'high' | 'medium' | 'low';
  size: number;
  dependencies?: string[];
}

@Injectable()
export class ProgressiveLoadingService {
  private readonly logger = new Logger(ProgressiveLoadingService.name);

  constructor(private readonly cacheService: IntelligentCacheService) {}

  /**
   * Load data progressively for mobile optimization
   */
  async loadProgressively<T>(
    dataSource: () => Promise<T[]>,
    options: ProgressiveLoadingOptions,
    cacheKey?: string,
    page: number = 1,
  ): Promise<ProgressiveLoadingResult<T>> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cachedResult = await this.getCachedPage<T>(cacheKey, page);
      if (cachedResult) {
        this.logger.debug(`Progressive loading cache hit for page ${page}`);
        return cachedResult;
      }

      // Load full dataset (in production, this would be paginated at source)
      const fullData = await dataSource();
      
      // Calculate pagination
      const totalItems = fullData.length;
      const totalPages = Math.ceil(totalItems / options.pageSize);
      const startIndex = (page - 1) * options.pageSize;
      const endIndex = Math.min(startIndex + options.pageSize, totalItems);
      
      // Extract current page data
      const pageData = fullData.slice(startIndex, endIndex);
      
      // Optimize data for mobile
      const optimizedData = this.optimizeDataForMobile(pageData, options.priorityFields);
      
      const result: ProgressiveLoadingResult<T> = {
        data: optimizedData,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
        metadata: {
          loadingStrategy: 'progressive',
          preloadedPages: [],
          cachedPages: [],
          loadTime: Date.now() - startTime,
        },
      };

      // Cache current page
      if (cacheKey && options.cachePages) {
        await this.cacheService.set(
          `${cacheKey}:page:${page}`,
          result,
          { ttl: 600 }, // 10 minutes
        );
        result.metadata.cachedPages.push(page);
      }

      // Preload next page if requested
      if (options.preloadNext && result.pagination.hasNext) {
        this.preloadNextPage(dataSource, options, cacheKey, page + 1)
          .then((preloadedPage) => {
            result.metadata.preloadedPages.push(preloadedPage);
          })
          .catch((error) => {
            this.logger.warn(`Failed to preload next page: ${error.message}`);
          });
      }

      this.logger.debug(
        `Progressive loading completed: page ${page}/${totalPages}, ` +
        `${pageData.length} items in ${Date.now() - startTime}ms`,
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Progressive loading failed: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Load data in chunks for optimal mobile performance
   */
  async loadInChunks<T>(
    chunks: LoadingChunk<T>[],
    deviceType: 'phone' | 'tablet' | 'desktop',
  ): Promise<{
    data: T[];
    loadingOrder: string[];
    totalLoadTime: number;
  }> {
    const startTime = Date.now();
    const loadingOrder: string[] = [];
    let allData: T[] = [];

    try {
      // Sort chunks by priority and device optimization
      const sortedChunks = this.optimizeChunkOrder(chunks, deviceType);

      // Load high priority chunks first
      const highPriorityChunks = sortedChunks.filter(chunk => chunk.priority === 'high');
      for (const chunk of highPriorityChunks) {
        allData = allData.concat(chunk.data);
        loadingOrder.push(chunk.id);
        
        // Small delay to prevent blocking
        await this.delay(10);
      }

      // Load medium priority chunks
      const mediumPriorityChunks = sortedChunks.filter(chunk => chunk.priority === 'medium');
      for (const chunk of mediumPriorityChunks) {
        allData = allData.concat(chunk.data);
        loadingOrder.push(chunk.id);
        
        await this.delay(20);
      }

      // Load low priority chunks last
      const lowPriorityChunks = sortedChunks.filter(chunk => chunk.priority === 'low');
      for (const chunk of lowPriorityChunks) {
        allData = allData.concat(chunk.data);
        loadingOrder.push(chunk.id);
        
        await this.delay(50);
      }

      const totalLoadTime = Date.now() - startTime;
      
      this.logger.debug(
        `Chunk loading completed: ${chunks.length} chunks, ` +
        `${allData.length} total items in ${totalLoadTime}ms`,
      );

      return {
        data: allData,
        loadingOrder,
        totalLoadTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Chunk loading failed: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Create loading chunks from data based on mobile optimization
   */
  createMobileOptimizedChunks<T>(
    data: T[],
    chunkSize: number = 20,
    priorityFields: string[] = ['id', 'name', 'status'],
  ): LoadingChunk<T>[] {
    const chunks: LoadingChunk<T>[] = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunkData = data.slice(i, i + chunkSize);
      const chunkId = `chunk_${Math.floor(i / chunkSize) + 1}`;
      
      // Determine priority based on position and content
      let priority: 'high' | 'medium' | 'low' = 'medium';
      
      if (i === 0) {
        // First chunk is always high priority
        priority = 'high';
      } else if (i < chunkSize * 3) {
        // First 3 chunks are medium priority
        priority = 'medium';
      } else {
        // Rest are low priority
        priority = 'low';
      }

      // Optimize chunk data for mobile
      const optimizedChunkData = this.optimizeDataForMobile(chunkData, priorityFields);

      chunks.push({
        id: chunkId,
        data: optimizedChunkData,
        priority,
        size: this.calculateChunkSize(optimizedChunkData),
      });
    }

    return chunks;
  }

  /**
   * Get cached page if available
   */
  private async getCachedPage<T>(
    cacheKey: string | undefined,
    page: number,
  ): Promise<ProgressiveLoadingResult<T> | null> {
    if (!cacheKey) return null;

    try {
      const cached = await this.cacheService.get<ProgressiveLoadingResult<T>>(
        `${cacheKey}:page:${page}`,
      );
      
      if (cached) {
        // Update metadata to indicate cache hit
        cached.metadata.loadTime = 0;
        return cached;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to get cached page: ${errorMessage}`);
    }

    return null;
  }

  /**
   * Preload next page in background
   */
  private async preloadNextPage<T>(
    dataSource: () => Promise<T[]>,
    options: ProgressiveLoadingOptions,
    cacheKey: string | undefined,
    nextPage: number,
  ): Promise<number> {
    try {
      await this.loadProgressively(dataSource, options, cacheKey, nextPage);
      this.logger.debug(`Preloaded page ${nextPage}`);
      return nextPage;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to preload page ${nextPage}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Optimize data for mobile by keeping only essential fields
   */
  private optimizeDataForMobile<T>(data: T[], priorityFields: string[]): T[] {
    return data.map(item => {
      if (typeof item === 'object' && item !== null) {
        const optimized: Record<string, any> = {};
        const itemRecord = item as Record<string, any>;
        
        // Always include priority fields
        priorityFields.forEach(field => {
          if (field in itemRecord) {
            optimized[field] = itemRecord[field];
          }
        });

        // Include other essential fields
        const essentialFields = ['createdAt', 'updatedAt'];
        essentialFields.forEach(field => {
          if (field in itemRecord && !priorityFields.includes(field)) {
            optimized[field] = itemRecord[field];
          }
        });

        return optimized as T;
      }
      
      return item;
    });
  }

  /**
   * Optimize chunk loading order based on device type
   */
  private optimizeChunkOrder<T>(
    chunks: LoadingChunk<T>[],
    deviceType: 'phone' | 'tablet' | 'desktop',
  ): LoadingChunk<T>[] {
    // Sort by priority first, then by size (smaller chunks first for mobile)
    return chunks.sort((a, b) => {
      const priorityOrder = { high: 1, medium: 2, low: 3 };
      
      if (a.priority !== b.priority) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }

      // For mobile devices, prefer smaller chunks
      if (deviceType === 'phone') {
        return a.size - b.size;
      }

      // For desktop, size doesn't matter as much
      return 0;
    });
  }

  /**
   * Calculate chunk size in bytes
   */
  private calculateChunkSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return JSON.stringify(data).length * 2;
    }
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get progressive loading recommendations
   */
  getProgressiveLoadingRecommendations(
    dataSize: number,
    deviceType: 'phone' | 'tablet' | 'desktop',
    connectionType: 'wifi' | 'cellular' | 'offline',
  ): ProgressiveLoadingOptions {
    let pageSize = 50;
    let maxPages = 10;
    let preloadNext = true;
    let cachePages = true;

    // Optimize based on device type
    if (deviceType === 'phone') {
      pageSize = 20; // Smaller pages for phones
      maxPages = 5;
    } else if (deviceType === 'tablet') {
      pageSize = 30;
      maxPages = 8;
    }

    // Optimize based on connection type
    if (connectionType === 'cellular') {
      pageSize = Math.min(pageSize, 15); // Even smaller for cellular
      preloadNext = false; // Don't preload on cellular to save data
    } else if (connectionType === 'offline') {
      pageSize = 10; // Minimal for offline
      preloadNext = false;
      cachePages = false;
    }

    // Adjust based on data size
    if (dataSize > 10000) {
      pageSize = Math.min(pageSize, 10);
      maxPages = Math.min(maxPages, 3);
    }

    return {
      pageSize,
      maxPages,
      preloadNext,
      cachePages,
      priorityFields: ['id', 'name', 'status', 'createdAt'],
    };
  }
}