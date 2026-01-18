import { Injectable } from '@nestjs/common';
import { CustomLoggerService } from '../logger.service';
import { LogExportInput } from '../inputs/logger.input';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);

@Injectable()
export class LoggerExportService {
  private readonly exportDir = path.join(process.cwd(), 'exports', 'logs');

  constructor(private readonly loggerService: CustomLoggerService) {
    this.loggerService.setContext('LoggerExportService');
    this.ensureExportDirectory();
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

  async exportLogs(
    input: LogExportInput,
    tenantId: string,
  ): Promise<{ recordCount: number; fileSize: number; filePath: string }> {
    const startTime = Date.now();
    
    try {
      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `logs-${tenantId}-${timestamp}.${input.format || 'json'}`;
      const filePath = path.join(this.exportDir, filename);

      this.loggerService.audit(
        'log_export_started',
        {
          tenantId,
          format: input.format,
          filters: input.filters,
          includeMetadata: input.includeMetadata,
          compress: input.compress,
        },
        { tenantId },
      );

      // Fetch logs based on filters
      const logs = await this.fetchLogsForExport(input.filters, tenantId);

      // Transform logs based on format
      let exportData: string;
      switch (input.format) {
        case 'csv':
          exportData = this.convertToCSV(logs, input.includeMetadata);
          break;
        case 'xml':
          exportData = this.convertToXML(logs, input.includeMetadata);
          break;
        case 'json':
        default:
          exportData = this.convertToJSON(logs, input.includeMetadata);
          break;
      }

      // Compress if requested
      let finalData: Buffer;
      let finalPath = filePath;
      
      if (input.compress) {
        finalData = await gzip(Buffer.from(exportData, 'utf8'));
        finalPath = `${filePath}.gz`;
      } else {
        finalData = Buffer.from(exportData, 'utf8');
      }

      // Write to file
      await fs.writeFile(finalPath, finalData);

      const fileStats = await fs.stat(finalPath);
      const duration = Date.now() - startTime;

      this.loggerService.performance(
        'log_export_completed',
        duration,
        {
          tenantId,
          recordCount: logs.length,
          fileSize: fileStats.size,
          format: input.format,
          compressed: input.compress,
        },
      );

      this.loggerService.audit(
        'log_export_completed',
        {
          tenantId,
          recordCount: logs.length,
          fileSize: fileStats.size,
          filePath: finalPath,
          duration,
        },
        { tenantId },
      );

      return {
        recordCount: logs.length,
        fileSize: fileStats.size,
        filePath: finalPath,
      };
    } catch (error) {
      this.loggerService.error(
        'Failed to export logs',
        this.getErrorStack(error),
        { tenantId, input, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  async getExportHistory(tenantId: string): Promise<any[]> {
    try {
      const files = await fs.readdir(this.exportDir);
      const tenantFiles = files.filter(file => file.includes(`-${tenantId}-`));
      
      const exports = await Promise.all(
        tenantFiles.map(async (file) => {
          const filePath = path.join(this.exportDir, file);
          const stats = await fs.stat(filePath);
          
          return {
            filename: file,
            filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
          };
        })
      );

      return exports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      this.loggerService.error(
        'Failed to get export history',
        this.getErrorStack(error),
        { tenantId, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  async deleteExport(filePath: string, tenantId: string): Promise<void> {
    try {
      // Verify the file belongs to the tenant
      if (!filePath.includes(`-${tenantId}-`)) {
        throw new Error('Unauthorized access to export file');
      }

      await fs.unlink(filePath);

      this.loggerService.audit(
        'log_export_deleted',
        { filePath, tenantId },
        { tenantId },
      );
    } catch (error) {
      this.loggerService.error(
        'Failed to delete export',
        this.getErrorStack(error),
        { filePath, tenantId, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  async scheduleExport(
    input: LogExportInput,
    tenantId: string,
    schedule: 'daily' | 'weekly' | 'monthly',
  ): Promise<void> {
    try {
      // In a real implementation, this would integrate with a job scheduler
      // For now, we'll just log the scheduled export
      
      this.loggerService.audit(
        'log_export_scheduled',
        {
          tenantId,
          schedule,
          filters: input.filters,
          format: input.format,
          compress: input.compress,
        },
        { tenantId },
      );

      // Emit event for job scheduler to pick up
      // this.eventEmitter.emit('log.export.scheduled', { input, tenantId, schedule });
    } catch (error) {
      this.loggerService.error(
        'Failed to schedule export',
        this.getErrorStack(error),
        { tenantId, schedule, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  async getExportMetrics(tenantId: string): Promise<any> {
    try {
      const history = await this.getExportHistory(tenantId);
      
      const totalExports = history.length;
      const totalSize = history.reduce((sum, exp) => sum + exp.size, 0);
      const avgSize = totalExports > 0 ? totalSize / totalExports : 0;
      
      const last30Days = history.filter(
        exp => exp.createdAt.getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
      );

      return {
        totalExports,
        totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
        averageSizeMB: Math.round(avgSize / 1024 / 1024 * 100) / 100,
        exportsLast30Days: last30Days.length,
        oldestExport: totalExports > 0 ? history[history.length - 1].createdAt : null,
        newestExport: totalExports > 0 ? history[0].createdAt : null,
      };
    } catch (error) {
      this.loggerService.error(
        'Failed to get export metrics',
        this.getErrorStack(error),
        { tenantId, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  private async ensureExportDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.exportDir, { recursive: true });
    } catch (error) {
      this.loggerService.error(
        'Failed to create export directory',
        this.getErrorStack(error),
        { exportDir: this.exportDir, error: this.getErrorMessage(error) },
      );
    }
  }

  private async fetchLogsForExport(filters: any, tenantId: string): Promise<any[]> {
    // Mock implementation - in production, this would query the actual log storage
    const mockLogs = Array.from({ length: Math.floor(Math.random() * 1000) + 100 }, (_, i) => ({
      id: `log_${Date.now()}_${i}`,
      timestamp: new Date(Date.now() - Math.random() * 86400000),
      level: ['ERROR', 'WARN', 'INFO', 'DEBUG'][Math.floor(Math.random() * 4)],
      category: ['GRAPHQL', 'SECURITY', 'PERFORMANCE', 'AUDIT', 'BUSINESS', 'SYSTEM'][Math.floor(Math.random() * 6)],
      message: `Export log message ${i + 1}`,
      context: `ExportContext${Math.floor(Math.random() * 5) + 1}`,
      tenantId,
      userId: `user_${Math.floor(Math.random() * 100) + 1}`,
      requestId: `req_${Date.now()}_${i}`,
      correlationId: `corr_${Date.now()}_${i}`,
      operation: `export_operation_${Math.floor(Math.random() * 10) + 1}`,
      duration: Math.floor(Math.random() * 2000) + 50,
      graphqlOperation: Math.random() > 0.5 ? `exportQuery${Math.floor(Math.random() * 5) + 1}` : null,
      graphqlOperationType: Math.random() > 0.5 ? ['query', 'mutation', 'subscription'][Math.floor(Math.random() * 3)] : null,
      metadata: {
        exportFlag: true,
        randomValue: Math.random(),
      },
    }));

    return mockLogs;
  }

  private convertToJSON(logs: any[], includeMetadata: boolean = false): string {
    const processedLogs = logs.map(log => {
      const processed = { ...log };
      if (!includeMetadata) {
        delete processed.metadata;
      }
      return processed;
    });

    return JSON.stringify({
      exportInfo: {
        timestamp: new Date().toISOString(),
        recordCount: logs.length,
        includeMetadata,
        format: 'json',
      },
      logs: processedLogs,
    }, null, 2);
  }

  private convertToCSV(logs: any[], includeMetadata: boolean = false): string {
    if (logs.length === 0) {
      return 'No logs to export';
    }

    // Get all unique keys from logs
    const allKeys = new Set<string>();
    logs.forEach(log => {
      Object.keys(log).forEach(key => {
        if (key !== 'metadata' || includeMetadata) {
          allKeys.add(key);
        }
      });
    });

    const headers = Array.from(allKeys);
    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      const row = headers.map(header => {
        let value = log[header];
        
        if (value === null || value === undefined) {
          return '';
        }
        
        if (typeof value === 'object') {
          value = JSON.stringify(value);
        }
        
        // Escape CSV special characters
        value = String(value).replace(/"/g, '""');
        
        // Wrap in quotes if contains comma, newline, or quote
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
          value = `"${value}"`;
        }
        
        return value;
      });
      
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  private convertToXML(logs: any[], includeMetadata: boolean = false): string {
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';
    const exportInfo = `<exportInfo>
  <timestamp>${new Date().toISOString()}</timestamp>
  <recordCount>${logs.length}</recordCount>
  <includeMetadata>${includeMetadata}</includeMetadata>
  <format>xml</format>
</exportInfo>\n`;

    const logsXml = logs.map(log => {
      const logXml = Object.entries(log)
        .filter(([key]) => key !== 'metadata' || includeMetadata)
        .map(([key, value]) => {
          let xmlValue = value;
          
          if (value === null || value === undefined) {
            return `  <${key}></${key}>`;
          }
          
          if (typeof value === 'object') {
            xmlValue = JSON.stringify(value);
          }
          
          // Escape XML special characters
          xmlValue = String(xmlValue)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
          
          return `  <${key}>${xmlValue}</${key}>`;
        })
        .join('\n');
      
      return `<log>\n${logXml}\n</log>`;
    }).join('\n');

    return `${xmlHeader}<export>\n${exportInfo}<logs>\n${logsXml}\n</logs>\n</export>`;
  }
}