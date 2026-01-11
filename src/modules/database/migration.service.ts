import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from './drizzle.service';
import { CustomLoggerService } from '../logger/logger.service';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

interface Migration {
  id: string;
  name: string;
  sql: string;
  appliedAt?: Date;
}

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly customLogger: CustomLoggerService,
  ) {
    this.customLogger.setContext('MigrationService');
  }

  async runMigrations(): Promise<void> {
    try {
      this.logger.log('Starting database migrations...');
      
      // Ensure migrations table exists
      await this.ensureMigrationsTable();
      
      // Get pending migrations
      const pendingMigrations = await this.getPendingMigrations();
      
      if (pendingMigrations.length === 0) {
        this.logger.log('No pending migrations found');
        return;
      }

      // Run each migration in a transaction
      for (const migration of pendingMigrations) {
        await this.runMigration(migration);
      }

      this.logger.log(`Successfully applied ${pendingMigrations.length} migrations`);
    } catch (error) {
      this.logger.error('Migration failed', error);
      throw error;
    }
  }

  async rollbackMigration(migrationId: string): Promise<void> {
    try {
      this.logger.log(`Rolling back migration: ${migrationId}`);
      
      const db = this.drizzleService.getDb();
      
      await db.transaction(async (tx) => {
        // Remove migration record
        await tx.execute(`
          DELETE FROM schema_migrations 
          WHERE id = '${migrationId}'
        `);
        
        this.customLogger.audit('migration_rollback', {
          migrationId,
          timestamp: new Date().toISOString(),
        });
      });

      this.logger.log(`Successfully rolled back migration: ${migrationId}`);
    } catch (error) {
      this.logger.error(`Failed to rollback migration: ${migrationId}`, error);
      throw error;
    }
  }

  async getMigrationStatus(): Promise<Migration[]> {
    const db = this.drizzleService.getDb();
    
    const appliedMigrations = await db.execute(`
      SELECT id, name, applied_at 
      FROM schema_migrations 
      ORDER BY applied_at ASC
    `);

    return appliedMigrations.rows.map(row => ({
      id: row.id as string,
      name: row.name as string,
      sql: '',
      appliedAt: row.applied_at as Date,
    }));
  }

  private async ensureMigrationsTable(): Promise<void> {
    const db = this.drizzleService.getDb();
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        checksum VARCHAR(64) NOT NULL
      )
    `);
  }

  private async getPendingMigrations(): Promise<Migration[]> {
    const migrationFiles = await this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();
    
    return migrationFiles.filter(
      migration => !appliedMigrations.includes(migration.id)
    );
  }

  private async getMigrationFiles(): Promise<Migration[]> {
    const migrationsDir = join(process.cwd(), 'drizzle');
    
    try {
      const files = await readdir(migrationsDir);
      const sqlFiles = files.filter(file => file.endsWith('.sql'));
      
      const migrations: Migration[] = [];
      
      for (const file of sqlFiles) {
        const filePath = join(migrationsDir, file);
        const sql = await readFile(filePath, 'utf-8');
        const id = file.replace('.sql', '');
        
        migrations.push({
          id,
          name: file,
          sql,
        });
      }
      
      return migrations.sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
      this.logger.warn('No migrations directory found or error reading migrations');
      return [];
    }
  }

  private async getAppliedMigrations(): Promise<string[]> {
    const db = this.drizzleService.getDb();
    
    try {
      const result = await db.execute(`
        SELECT id FROM schema_migrations ORDER BY applied_at ASC
      `);
      
      return result.rows.map(row => row.id as string);
    } catch (error) {
      // Table might not exist yet
      return [];
    }
  }

  private async runMigration(migration: Migration): Promise<void> {
    const db = this.drizzleService.getDb();
    
    await db.transaction(async (tx) => {
      try {
        this.logger.log(`Applying migration: ${migration.name}`);
        
        // Execute migration SQL
        await tx.execute(migration.sql);
        
        // Calculate checksum
        const checksum = await this.calculateChecksum(migration.sql);
        
        // Record migration
        await tx.execute(`
          INSERT INTO schema_migrations (id, name, checksum)
          VALUES ('${migration.id}', '${migration.name}', '${checksum}')
        `);
        
        this.customLogger.audit('migration_applied', {
          migrationId: migration.id,
          migrationName: migration.name,
          checksum,
          timestamp: new Date().toISOString(),
        });
        
        this.logger.log(`Successfully applied migration: ${migration.name}`);
      } catch (error) {
        this.logger.error(`Failed to apply migration: ${migration.name}`, error);
        throw error;
      }
    });
  }

  private async calculateChecksum(sql: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(sql).digest('hex');
  }
}