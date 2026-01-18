import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PubSub } from 'graphql-subscriptions';
import { Inject } from '@nestjs/common';
import { CustomLoggerService } from '../logger.service';
import { LogStreamArgs } from '../inputs/logger.input';
import { LogSubscriptionPayloadType } from '../types/logger.types';

@Injectable()
export class LoggerStreamService {
  private activeStreams = new Map<string, any>();
  private streamBuffers = new Map<string, any[]>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly loggerService: CustomLoggerService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    this.loggerService.setContext('LoggerStreamService');
    this.setupEventListeners();
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  }

  private getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.stack;
    }
    return undefined;
  }

  createLogStream(
    args: LogStreamArgs,
    tenantId: string,
    subscriptionId: string,
  ): AsyncIterator<LogSubscriptionPayloadType> {
    try {
      // Register the stream
      this.activeStreams.set(subscriptionId, {
        tenantId,
        filters: args.filters,
        bufferSize: args.bufferSize || 100,
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      // Initialize buffer
      this.streamBuffers.set(subscriptionId, []);

      this.loggerService.audit(
        'log_stream_created',
        {
          subscriptionId,
          tenantId,
          filters: args.filters,
          bufferSize: args.bufferSize,
        },
        { tenantId },
      );

      // Create async iterator for the stream
      return this.createAsyncIterator(subscriptionId, tenantId, args.filters);
    } catch (error) {
      this.loggerService.error(
        'Failed to create log stream',
        this.getErrorStack(error),
        { subscriptionId, tenantId, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  async closeLogStream(subscriptionId: string): Promise<void> {
    try {
      const stream = this.activeStreams.get(subscriptionId);
      if (stream) {
        this.activeStreams.delete(subscriptionId);
        this.streamBuffers.delete(subscriptionId);

        this.loggerService.audit(
          'log_stream_closed',
          {
            subscriptionId,
            tenantId: stream.tenantId,
            duration: Date.now() - stream.createdAt.getTime(),
          },
          { tenantId: stream.tenantId },
        );
      }
    } catch (error) {
      this.loggerService.error(
        'Failed to close log stream',
        this.getErrorStack(error),
        { subscriptionId, error: this.getErrorMessage(error) },
      );
    }
  }

  getActiveStreams(): Map<string, any> {
    return new Map(this.activeStreams);
  }

  getStreamMetrics(): any {
    const streams = Array.from(this.activeStreams.values());
    const now = Date.now();

    return {
      totalStreams: streams.length,
      activeStreams: streams.filter(s => now - s.lastActivity.getTime() < 60000).length,
      oldestStream: streams.length > 0 ? Math.min(...streams.map(s => s.createdAt.getTime())) : null,
      newestStream: streams.length > 0 ? Math.max(...streams.map(s => s.createdAt.getTime())) : null,
      totalBufferedEvents: Array.from(this.streamBuffers.values()).reduce((sum, buffer) => sum + buffer.length, 0),
    };
  }

  private setupEventListeners(): void {
    // Listen for log entries
    this.eventEmitter.on('log.entry', (logEntry) => {
      this.handleLogEntry(logEntry);
    });

    // Listen for batch log events
    this.eventEmitter.on('logs.batch', (batchData) => {
      this.handleLogBatch(batchData.logs);
    });

    // Cleanup inactive streams every 5 minutes
    setInterval(() => {
      this.cleanupInactiveStreams();
    }, 300000);

    // Flush stream buffers every 30 seconds
    setInterval(() => {
      this.flushStreamBuffers();
    }, 30000);
  }

  private handleLogEntry(logEntry: any): void {
    try {
      // Process each active stream
      for (const [subscriptionId, stream] of this.activeStreams.entries()) {
        if (this.matchesStreamFilters(logEntry, stream)) {
          this.addToStreamBuffer(subscriptionId, logEntry);
          stream.lastActivity = new Date();
        }
      }
    } catch (error) {
      this.loggerService.error(
        'Failed to handle log entry for streams',
        this.getErrorStack(error),
        { error: this.getErrorMessage(error) },
      );
    }
  }

  private handleLogBatch(logs: any[]): void {
    try {
      for (const logEntry of logs) {
        this.handleLogEntry(logEntry);
      }
    } catch (error) {
      this.loggerService.error(
        'Failed to handle log batch for streams',
        this.getErrorStack(error),
        { batchSize: logs.length, error: this.getErrorMessage(error) },
      );
    }
  }

  private matchesStreamFilters(logEntry: any, stream: any): boolean {
    const filters = stream.filters;
    
    // Check tenant isolation
    if (logEntry.tenantId !== stream.tenantId) {
      return false;
    }

    if (!filters) {
      return true;
    }

    // Apply filters
    if (filters.level && logEntry.level !== filters.level) {
      return false;
    }

    if (filters.category && logEntry.category !== filters.category) {
      return false;
    }

    if (filters.userId && logEntry.userId !== filters.userId) {
      return false;
    }

    if (filters.operation && !logEntry.operation?.includes(filters.operation)) {
      return false;
    }

    if (filters.context && !logEntry.context?.includes(filters.context)) {
      return false;
    }

    if (filters.correlationId && logEntry.correlationId !== filters.correlationId) {
      return false;
    }

    if (filters.graphqlOperation && !logEntry.graphqlOperation?.includes(filters.graphqlOperation)) {
      return false;
    }

    if (filters.graphqlOperationType && logEntry.graphqlOperationType !== filters.graphqlOperationType) {
      return false;
    }

    if (filters.startTime && new Date(logEntry.timestamp) < new Date(filters.startTime)) {
      return false;
    }

    if (filters.endTime && new Date(logEntry.timestamp) > new Date(filters.endTime)) {
      return false;
    }

    if (filters.minDuration && (logEntry.duration || 0) < filters.minDuration) {
      return false;
    }

    if (filters.maxDuration && (logEntry.duration || 0) > filters.maxDuration) {
      return false;
    }

    if (filters.ipAddress && logEntry.ipAddress !== filters.ipAddress) {
      return false;
    }

    if (filters.sessionId && logEntry.sessionId !== filters.sessionId) {
      return false;
    }

    if (filters.tags && filters.tags.length > 0) {
      const logTags = logEntry.tags || [];
      if (!filters.tags.some((tag: string) => logTags.includes(tag))) {
        return false;
      }
    }

    return true;
  }

  private addToStreamBuffer(subscriptionId: string, logEntry: any): void {
    const buffer = this.streamBuffers.get(subscriptionId) || [];
    const stream = this.activeStreams.get(subscriptionId);
    
    if (!stream) return;

    // Transform log entry to subscription payload
    const payload: LogSubscriptionPayloadType = {
      log: this.transformLogEntry(logEntry),
      subscriptionId,
      timestamp: new Date(),
    };

    buffer.push(payload);

    // Maintain buffer size limit
    const maxSize = stream.bufferSize || 100;
    if (buffer.length > maxSize) {
      buffer.splice(0, buffer.length - maxSize);
    }

    this.streamBuffers.set(subscriptionId, buffer);

    // Publish to GraphQL subscription
    this.pubSub.publish(`log_stream_${subscriptionId}`, payload);
  }

  private transformLogEntry(logEntry: any): any {
    return {
      id: logEntry.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(logEntry.timestamp),
      level: logEntry.level,
      category: logEntry.category,
      message: logEntry.message,
      context: logEntry.context,
      tenantId: logEntry.tenantId,
      userId: logEntry.userId,
      requestId: logEntry.requestId,
      correlationId: logEntry.correlationId,
      operation: logEntry.operation,
      duration: logEntry.duration,
      graphqlOperation: logEntry.graphqlOperation,
      graphqlOperationType: logEntry.graphqlOperationType,
      graphqlPath: logEntry.graphqlPath,
      graphqlVariables: logEntry.graphqlVariables,
      graphqlComplexity: logEntry.graphqlComplexity,
      graphqlDepth: logEntry.graphqlDepth,
      sessionId: logEntry.sessionId,
      ipAddress: logEntry.ipAddress,
      userAgent: logEntry.userAgent,
      metadata: logEntry.metadata || {},
    };
  }

  private async* createAsyncIterator(
    subscriptionId: string,
    tenantId: string,
    filters: any,
  ): AsyncIterator<LogSubscriptionPayloadType> {
    try {
      // Create subscription to PubSub
      const pubSubIterator = (this.pubSub as any).asyncIterator(`log_stream_${subscriptionId}`);

      // Send any buffered events first
      const buffer = this.streamBuffers.get(subscriptionId) || [];
      for (const payload of buffer) {
        yield payload;
      }

      // Clear buffer after sending
      this.streamBuffers.set(subscriptionId, []);

      // Yield new events as they come
      for await (const payload of pubSubIterator) {
        // Update last activity
        const stream = this.activeStreams.get(subscriptionId);
        if (stream) {
          stream.lastActivity = new Date();
        }

        yield payload;
      }
    } catch (error) {
      this.loggerService.error(
        'Error in log stream async iterator',
        this.getErrorStack(error),
        { subscriptionId, tenantId, error: this.getErrorMessage(error) },
      );
      throw error;
    } finally {
      // Cleanup when iterator is done
      this.closeLogStream(subscriptionId);
    }
  }

  private cleanupInactiveStreams(): void {
    const now = Date.now();
    const inactiveThreshold = 10 * 60 * 1000; // 10 minutes
    const streamsToRemove: string[] = [];

    for (const [subscriptionId, stream] of this.activeStreams.entries()) {
      if (now - stream.lastActivity.getTime() > inactiveThreshold) {
        streamsToRemove.push(subscriptionId);
      }
    }

    for (const subscriptionId of streamsToRemove) {
      this.closeLogStream(subscriptionId);
    }

    if (streamsToRemove.length > 0) {
      this.loggerService.audit(
        'inactive_log_streams_cleaned',
        {
          cleanedStreams: streamsToRemove.length,
          remainingStreams: this.activeStreams.size,
        },
      );
    }
  }

  private flushStreamBuffers(): void {
    let totalFlushed = 0;

    for (const [subscriptionId, buffer] of this.streamBuffers.entries()) {
      if (buffer.length > 0) {
        // In a real implementation, you might want to persist these or send them elsewhere
        totalFlushed += buffer.length;
        this.streamBuffers.set(subscriptionId, []);
      }
    }

    if (totalFlushed > 0) {
      this.loggerService.performance(
        'stream_buffer_flush',
        Date.now(),
        { flushedEvents: totalFlushed, activeStreams: this.activeStreams.size },
      );
    }
  }

  // Health check methods
  async getStreamHealth(): Promise<any> {
    const metrics = this.getStreamMetrics();
    const now = Date.now();
    
    return {
      status: metrics.totalStreams > 0 ? 'healthy' : 'idle',
      metrics,
      uptime: now,
      memoryUsage: {
        activeStreams: this.activeStreams.size,
        bufferedEvents: metrics.totalBufferedEvents,
        estimatedMemoryMB: (this.activeStreams.size * 1024 + metrics.totalBufferedEvents * 512) / 1024 / 1024,
      },
    };
  }

  // Administrative methods
  async forceCloseAllStreams(): Promise<void> {
    const streamIds = Array.from(this.activeStreams.keys());
    
    for (const subscriptionId of streamIds) {
      await this.closeLogStream(subscriptionId);
    }

    this.loggerService.audit(
      'all_log_streams_force_closed',
      { closedStreams: streamIds.length },
    );
  }

  async getStreamDetails(subscriptionId: string): Promise<any> {
    const stream = this.activeStreams.get(subscriptionId);
    const buffer = this.streamBuffers.get(subscriptionId) || [];

    if (!stream) {
      return null;
    }

    return {
      subscriptionId,
      tenantId: stream.tenantId,
      filters: stream.filters,
      bufferSize: stream.bufferSize,
      createdAt: stream.createdAt,
      lastActivity: stream.lastActivity,
      bufferedEvents: buffer.length,
      isActive: Date.now() - stream.lastActivity.getTime() < 60000,
    };
  }
}