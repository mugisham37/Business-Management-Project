import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job, JobOptions } from 'bull';
import { CustomLoggerService } from '../logger/logger.service';

export interface EmailJobData {
  to: string | string[];
  subject: string;
  template: string;
  data: Record<string, any>;
  tenantId?: string;
}

export interface ReportJobData {
  reportType: string;
  parameters: Record<string, any>;
  userId: string;
  tenantId: string;
  format: 'pdf' | 'excel' | 'csv';
}

export interface SyncJobData {
  syncType: 'inventory' | 'customers' | 'transactions' | 'full';
  sourceLocationId?: string;
  targetLocationId?: string;
  tenantId: string;
  userId: string;
}

export interface NotificationJobData {
  type: 'push' | 'sms' | 'email' | 'in-app';
  recipients: string[];
  title: string;
  message: string;
  data?: Record<string, any>;
  tenantId?: string;
}

export interface AnalyticsJobData {
  eventType: string;
  event: Record<string, any>;
  tenantId?: string;
  userId?: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue<EmailJobData>,
    @InjectQueue('reports') private readonly reportsQueue: Queue<ReportJobData>,
    @InjectQueue('sync') private readonly syncQueue: Queue<SyncJobData>,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue<NotificationJobData>,
    @InjectQueue('analytics') private readonly analyticsQueue: Queue<AnalyticsJobData>,
    private readonly customLogger: CustomLoggerService,
  ) {
    this.customLogger.setContext('QueueService');
    this.setupQueueEventListeners();
  }

  // Email queue operations
  async addEmailJob(
    data: EmailJobData,
    options: JobOptions = {}
  ): Promise<Job<EmailJobData>> {
    try {
      const job = await this.emailQueue.add('send-email', data, {
        priority: options.priority || 0,
        delay: options.delay || 0,
        attempts: options.attempts || 3,
        ...options,
      });

      this.customLogger.log('Email job added to queue', {
        jobId: job.id,
        to: data.to,
        subject: data.subject,
        tenantId: data.tenantId,
      });

      return job;
    } catch (error) {
      this.customLogger.error('Failed to add email job', error instanceof Error ? error.stack : undefined, {
        data,
        options,
      });
      throw error;
    }
  }

  async addBulkEmailJobs(
    jobs: Array<{ data: EmailJobData; options?: JobOptions }>
  ): Promise<Job<EmailJobData>[]> {
    try {
      const bulkJobs = jobs.map(job => ({
        name: 'send-email',
        data: job.data,
        opts: job.options || {},
      }));

      const addedJobs = await this.emailQueue.addBulk(bulkJobs);

      this.customLogger.log('Bulk email jobs added to queue', {
        jobCount: addedJobs.length,
      });

      return addedJobs;
    } catch (error) {
      this.customLogger.error('Failed to add bulk email jobs', error instanceof Error ? error.stack : undefined, {
        jobCount: jobs.length,
      });
      throw error;
    }
  }

  // Report queue operations
  async addReportJob(
    data: ReportJobData,
    options: JobOptions = {}
  ): Promise<Job<ReportJobData>> {
    try {
      const job = await this.reportsQueue.add('generate-report', data, {
        priority: options.priority || 0,
        delay: options.delay || 0,
        attempts: options.attempts || 2,
        timeout: 300000, // 5 minutes timeout for reports
        ...options,
      });

      this.customLogger.log('Report job added to queue', {
        jobId: job.id,
        reportType: data.reportType,
        format: data.format,
        tenantId: data.tenantId,
        userId: data.userId,
      });

      return job;
    } catch (error) {
      this.customLogger.error('Failed to add report job', error instanceof Error ? error.stack : undefined, {
        data,
        options,
      });
      throw error;
    }
  }

  // Sync queue operations
  async addSyncJob(
    data: SyncJobData,
    options: JobOptions = {}
  ): Promise<Job<SyncJobData>> {
    try {
      const job = await this.syncQueue.add('sync-data', data, {
        priority: options.priority || 5, // Higher priority for sync jobs
        delay: options.delay || 0,
        attempts: options.attempts || 5,
        timeout: 600000, // 10 minutes timeout for sync
        ...options,
      });

      this.customLogger.log('Sync job added to queue', {
        jobId: job.id,
        syncType: data.syncType,
        tenantId: data.tenantId,
        userId: data.userId,
      });

      return job;
    } catch (error) {
      this.customLogger.error('Failed to add sync job', error instanceof Error ? error.stack : undefined, {
        data,
        options,
      });
      throw error;
    }
  }

  // Notification queue operations
  async addNotificationJob(
    data: NotificationJobData,
    options: JobOptions = {}
  ): Promise<Job<NotificationJobData>> {
    try {
      const job = await this.notificationsQueue.add('send-notification', data, {
        priority: options.priority || 3,
        delay: options.delay || 0,
        attempts: options.attempts || 3,
        ...options,
      });

      this.customLogger.log('Notification job added to queue', {
        jobId: job.id,
        type: data.type,
        recipientCount: data.recipients.length,
        tenantId: data.tenantId,
      });

      return job;
    } catch (error) {
      this.customLogger.error('Failed to add notification job', error instanceof Error ? error.stack : undefined, {
        data,
        options,
      });
      throw error;
    }
  }

  // Analytics queue operations
  async addAnalyticsJob(
    data: AnalyticsJobData,
    options: JobOptions = {}
  ): Promise<Job<AnalyticsJobData>> {
    try {
      const job = await this.analyticsQueue.add('process-analytics-event', data, {
        priority: options.priority || 2,
        delay: options.delay || 0,
        attempts: options.attempts || 3,
        timeout: 300000, // 5 minutes timeout for analytics
        ...options,
      });

      this.customLogger.log('Analytics job added to queue', {
        jobId: job.id,
        eventType: data.eventType,
        tenantId: data.tenantId,
        userId: data.userId,
      });

      return job;
    } catch (error) {
      this.customLogger.error('Failed to add analytics job', error instanceof Error ? error.stack : undefined, {
        data,
        options,
      });
      throw error;
    }
  }

  // Generic add method for backward compatibility and custom jobs
  async add(jobName: string, data: any, options: JobOptions = {}): Promise<Job<any>> {
    try {
      // Route to appropriate queue based on job name
      let queue: Queue;
      let processName: string;

      if (jobName.includes('email') || jobName.includes('notification')) {
        queue = this.notificationsQueue;
        processName = 'send-notification';
      } else if (jobName.includes('report') || jobName.includes('analytics')) {
        queue = this.analyticsQueue;
        processName = 'process-analytics-event';
      } else if (jobName.includes('sync') || jobName.includes('warehouse') || jobName.includes('inventory')) {
        queue = this.syncQueue;
        processName = 'sync-data';
      } else {
        // Default to sync queue for warehouse operations
        queue = this.syncQueue;
        processName = jobName;
      }

      const job = await queue.add(processName, data, {
        priority: options.priority || 1,
        delay: options.delay || 0,
        attempts: options.attempts || 3,
        timeout: 300000, // 5 minutes default timeout
        ...options,
      });

      this.customLogger.log('Generic job added to queue', {
        jobId: job.id,
        jobName,
        queueName: queue.name,
        processName,
      });

      return job;
    } catch (error) {
      this.customLogger.error('Failed to add generic job', error instanceof Error ? error.stack : undefined, {
        jobName,
        data,
        options,
      });
      throw error;
    }
  }
  async getQueueStats(): Promise<{
    email: any;
    reports: any;
    sync: any;
    notifications: any;
  }> {
    try {
      const [emailStats, reportsStats, syncStats, notificationsStats] = await Promise.all([
        this.getQueueCounts(this.emailQueue),
        this.getQueueCounts(this.reportsQueue),
        this.getQueueCounts(this.syncQueue),
        this.getQueueCounts(this.notificationsQueue),
      ]);

      return {
        email: emailStats,
        reports: reportsStats,
        sync: syncStats,
        notifications: notificationsStats,
      };
    } catch (error) {
      this.customLogger.error('Failed to get queue stats', error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async pauseQueue(queueName: 'email' | 'reports' | 'sync' | 'notifications'): Promise<void> {
    try {
      const queue = this.getQueueByName(queueName);
      await queue.pause();
      
      this.customLogger.log('Queue paused', { queueName });
    } catch (error) {
      this.customLogger.error('Failed to pause queue', error instanceof Error ? error.stack : undefined, {
        queueName,
      });
      throw error;
    }
  }

  async resumeQueue(queueName: 'email' | 'reports' | 'sync' | 'notifications'): Promise<void> {
    try {
      const queue = this.getQueueByName(queueName);
      await queue.resume();
      
      this.customLogger.log('Queue resumed', { queueName });
    } catch (error) {
      this.customLogger.error('Failed to resume queue', error instanceof Error ? error.stack : undefined, {
        queueName,
      });
      throw error;
    }
  }

  async cleanQueue(
    queueName: 'email' | 'reports' | 'sync' | 'notifications',
    grace: number = 0,
    status: 'completed' | 'failed' | 'active' = 'completed'
  ): Promise<void> {
    try {
      const queue = this.getQueueByName(queueName);
      await queue.clean(grace, status);
      
      this.customLogger.log('Queue cleaned', { queueName, grace, status });
    } catch (error) {
      this.customLogger.error('Failed to clean queue', error instanceof Error ? error.stack : undefined, {
        queueName,
        grace,
        status,
      });
      throw error;
    }
  }

  async getJob(queueName: 'email' | 'reports' | 'sync' | 'notifications', jobId: string): Promise<Job | null> {
    try {
      const queue = this.getQueueByName(queueName);
      return await queue.getJob(jobId);
    } catch (error) {
      this.customLogger.error('Failed to get job', error instanceof Error ? error.stack : undefined, {
        queueName,
        jobId,
      });
      return null;
    }
  }

  async retryJob(queueName: 'email' | 'reports' | 'sync' | 'notifications', jobId: string): Promise<void> {
    try {
      const job = await this.getJob(queueName, jobId);
      if (job) {
        await job.retry();
        this.customLogger.log('Job retried', { queueName, jobId });
      }
    } catch (error) {
      this.customLogger.error('Failed to retry job', error instanceof Error ? error.stack : undefined, {
        queueName,
        jobId,
      });
      throw error;
    }
  }

  private getQueueByName(queueName: string): Queue {
    switch (queueName) {
      case 'email':
        return this.emailQueue;
      case 'reports':
        return this.reportsQueue;
      case 'sync':
        return this.syncQueue;
      case 'notifications':
        return this.notificationsQueue;
      default:
        throw new Error(`Unknown queue name: ${queueName}`);
    }
  }

  private async getQueueCounts(queue: Queue): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    // getPaused is not available in all Bull versions
    let paused: any[] = [];
    try {
      if (typeof (queue as any).getPaused === 'function') {
        paused = await (queue as any).getPaused();
      }
    } catch (error) {
      paused = [];
    }

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: paused.length,
    };
  }

  private setupQueueEventListeners(): void {
    // Email queue events
    this.emailQueue.on('completed', (job) => {
      this.customLogger.log('Email job completed', {
        jobId: job.id,
        processingTime: job.processedOn ? Date.now() - job.processedOn : 0,
      });
    });

    this.emailQueue.on('failed', (job, err) => {
      this.customLogger.error('Email job failed', err.stack, {
        jobId: job.id,
        attempts: job.attemptsMade,
        data: job.data,
      });
    });

    // Reports queue events
    this.reportsQueue.on('completed', (job) => {
      this.customLogger.log('Report job completed', {
        jobId: job.id,
        reportType: job.data.reportType,
        processingTime: job.processedOn ? Date.now() - job.processedOn : 0,
      });
    });

    this.reportsQueue.on('failed', (job, err) => {
      this.customLogger.error('Report job failed', err.stack, {
        jobId: job.id,
        reportType: job.data.reportType,
        attempts: job.attemptsMade,
      });
    });

    // Sync queue events
    this.syncQueue.on('completed', (job) => {
      this.customLogger.log('Sync job completed', {
        jobId: job.id,
        syncType: job.data.syncType,
        processingTime: job.processedOn ? Date.now() - job.processedOn : 0,
      });
    });

    this.syncQueue.on('failed', (job, err) => {
      this.customLogger.error('Sync job failed', err.stack, {
        jobId: job.id,
        syncType: job.data.syncType,
        attempts: job.attemptsMade,
      });
    });

    // Notifications queue events
    this.notificationsQueue.on('completed', (job) => {
      this.customLogger.log('Notification job completed', {
        jobId: job.id,
        type: job.data.type,
        processingTime: job.processedOn ? Date.now() - job.processedOn : 0,
      });
    });

    this.notificationsQueue.on('failed', (job, err) => {
      this.customLogger.error('Notification job failed', err.stack, {
        jobId: job.id,
        type: job.data.type,
        attempts: job.attemptsMade,
      });
    });
  }
}